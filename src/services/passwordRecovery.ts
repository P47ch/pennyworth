import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { assertPasswordPolicy } from "../lib/passwordPolicy.js";
import { updateUserPassword } from "./users.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRecoveryEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!emailPattern.test(normalizedEmail)) {
    throw new Error("A valid user email is required.");
  }

  return normalizedEmail;
}

export async function resetUserPasswordByEmail(
  email: string,
  password: string,
  db: PrismaClient = prisma
) {
  const normalizedEmail = normalizeRecoveryEmail(email);
  assertPasswordPolicy(password, "New password");

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true }
  });

  if (!user) {
    throw new Error(`No Pennyworth user exists with email ${normalizedEmail}.`);
  }

  await updateUserPassword(user.id, password, db);
  return user;
}
