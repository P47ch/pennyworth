import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { hashPassword } from "../lib/passwords.js";
import { assertPasswordPolicy } from "../lib/passwordPolicy.js";

const defaultAdminEmail = "admin@example.com";

export function initialAdminCredentials(env: NodeJS.ProcessEnv = process.env) {
  const email = (env.INITIAL_ADMIN_EMAIL ?? defaultAdminEmail).trim().toLowerCase();
  const password = env.INITIAL_ADMIN_PASSWORD ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("INITIAL_ADMIN_EMAIL must be a valid email address.");
  }

  assertPasswordPolicy(password, "INITIAL_ADMIN_PASSWORD");

  return { email, password };
}

export async function ensureInitialAdmin(
  env: NodeJS.ProcessEnv = process.env,
  db: PrismaClient = prisma
) {
  const { email, password } = initialAdminCredentials(env);

  return db.user.upsert({
    where: { email },
    update: { role: "admin" },
    create: {
      email,
      name: "Admin",
      passwordHash: await hashPassword(password),
      role: "admin"
    }
  });
}
