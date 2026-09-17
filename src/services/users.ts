import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { getSessionData } from "../lib/session.js";
import { hashPassword } from "../lib/passwords.js";
import { assertPasswordPolicy } from "../lib/passwordPolicy.js";
import type { UserPreferences } from "../lib/preferences.js";
import type { FastifyRequest } from "fastify";

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function requireCurrentUser(request: FastifyRequest) {
  const session = getSessionData(request);

  if (!session) {
    throw new Error("Authentication required.");
  }

  const user = request.currentUser ?? (await findUserById(session.userId));

  if (!user || user.id !== session.userId) {
    throw new Error("Authenticated user no longer exists.");
  }

  if (!user.isActive) {
    throw new Error("Authenticated user is inactive.");
  }

  if (user.sessionVersion !== session.sessionVersion) {
    throw new Error("Session expired.");
  }

  return user;
}

export async function updateUserPassword(
  userId: string,
  password: string,
  db: PrismaClient = prisma,
  options: { mustChangePassword?: boolean } = {}
) {
  assertPasswordPolicy(password, "New password");

  return db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: options.mustChangePassword ?? false,
      sessionVersion: { increment: 1 }
    }
  });
}

export async function updateUserPreferences(userId: string, preferences: UserPreferences) {
  return prisma.user.update({
    where: { id: userId },
    data: preferences
  });
}
