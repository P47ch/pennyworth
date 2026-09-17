import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { prisma } from "../lib/db.js";
import { hashPassword } from "../lib/passwords.js";
import { createUserDefaults } from "./userDefaults.js";
import { requireCurrentUser } from "./users.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UserDatabase = PrismaClient | Prisma.TransactionClient;

function forbiddenError(message: string) {
  return Object.assign(new Error(message), { statusCode: 403 });
}

export function normalizeManagedUserInput(input: { name: string; email: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) {
    throw new Error("Name is required.");
  }

  if (name.length > 100) {
    throw new Error("Name must be 100 characters or fewer.");
  }

  if (!emailPattern.test(email) || email.length > 320) {
    throw new Error("A valid email address is required.");
  }

  return { name, email };
}

export function generateTemporaryPassword() {
  return randomBytes(18).toString("base64url");
}

async function assertAdministrator(userId: string, db: UserDatabase = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true }
  });

  if (!user || !user.isActive || user.role !== "admin") {
    throw forbiddenError("Administrator access is required.");
  }

  return user;
}

export async function requireAdministrator(request: FastifyRequest) {
  const user = await requireCurrentUser(request);

  if (user.role !== "admin") {
    throw forbiddenError("Administrator access is required.");
  }

  return user;
}

export async function listManagedUsers(administratorId: string, db: PrismaClient = prisma) {
  await assertAdministrator(administratorId, db);

  return db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true
    },
    orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }]
  });
}

export async function createManagedUser(
  administratorId: string,
  input: { name: string; email: string },
  db: PrismaClient = prisma
) {
  const normalized = normalizeManagedUserInput(input);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const user = await db.$transaction(async (tx) => {
      await assertAdministrator(administratorId, tx);
      const createdUser = await tx.user.create({
        data: {
          ...normalized,
          passwordHash,
          role: "member",
          isActive: true,
          mustChangePassword: true
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true }
      });

      await createUserDefaults(createdUser.id, tx);
      return createdUser;
    });

    return { user, temporaryPassword };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("A user with that email address already exists.");
    }

    throw error;
  }
}

export async function setManagedUserActiveState(
  administratorId: string,
  userId: string,
  isActive: boolean,
  db: PrismaClient = prisma
) {
  return db.$transaction(async (tx) => {
    await assertAdministrator(administratorId, tx);
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true }
    });

    if (!target) {
      throw new Error("User not found.");
    }

    if (target.id === administratorId && !isActive) {
      throw new Error("You cannot deactivate your own account.");
    }

    if (!isActive && target.role === "admin") {
      throw new Error("Administrator accounts cannot be deactivated here.");
    }

    if (target.isActive === isActive) {
      return target;
    }

    return tx.user.update({
      where: { id: target.id },
      data: {
        isActive,
        sessionVersion: { increment: 1 }
      }
    });
  });
}

export async function resetManagedUserPassword(
  administratorId: string,
  userId: string,
  db: PrismaClient = prisma
) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await db.$transaction(async (tx) => {
    await assertAdministrator(administratorId, tx);
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });

    if (!target) {
      throw new Error("User not found.");
    }

    if (target.id === administratorId) {
      throw new Error("Use the Security page to change your own password.");
    }

    await tx.user.update({
      where: { id: target.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        sessionVersion: { increment: 1 }
      }
    });

    return target;
  });

  return { user, temporaryPassword };
}
