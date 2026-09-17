import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/passwords.js";

describe("password hashing", () => {
  it("verifies the original password", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    expect(passwordHash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword("correct horse battery staple", passwordHash)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("wrong password", passwordHash)).resolves.toBe(false);
  });

  it("keeps existing bcrypt hashes verifiable for legacy long passwords", async () => {
    const legacyPassword = "a".repeat(72);
    const passwordHash = await hashPassword(legacyPassword);

    await expect(verifyPassword(`${legacyPassword}legacy-suffix`, passwordHash)).resolves.toBe(true);
  });
});
