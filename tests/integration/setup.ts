import { afterAll } from "vitest";
import { requireTestDatabaseUrl } from "../../scripts/integration-environment.js";

process.env.DATABASE_URL = requireTestDatabaseUrl();
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ??= "integration-test-session-secret-change-me";
process.env.PRIMARY_CURRENCY ??= "EUR";

afterAll(async () => {
  const { prisma } = await import("../../src/lib/db.js");
  await prisma.$disconnect();
});
