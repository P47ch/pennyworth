import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "../src/lib/passwords.js";
import { normalizeRecoveryEmail, resetUserPasswordByEmail } from "../src/services/passwordRecovery.js";

describe("password recovery", () => {
  it("normalizes the account email", () => {
    expect(normalizeRecoveryEmail(" Admin@Example.COM ")).toBe("admin@example.com");
    expect(() => normalizeRecoveryEmail("not-an-email")).toThrow("A valid user email is required.");
  });

  it("replaces the password hash and invalidates existing sessions", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "user-1", email: "admin@example.com" });
    const update = vi.fn().mockResolvedValue({ id: "user-1" });
    const db = { user: { findUnique, update } } as unknown as PrismaClient;

    await expect(
      resetUserPasswordByEmail(" Admin@Example.COM ", "replacement-password-2026", db)
    ).resolves.toEqual({ id: "user-1", email: "admin@example.com" });

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "admin@example.com" },
      select: { id: true, email: true }
    });
    expect(update).toHaveBeenCalledOnce();

    const updateData = update.mock.calls[0]?.[0].data;
    expect(updateData.sessionVersion).toEqual({ increment: 1 });
    expect(updateData.mustChangePassword).toBe(false);
    await expect(verifyPassword("replacement-password-2026", updateData.passwordHash)).resolves.toBe(true);
  });

  it("does not update anything when the account does not exist", async () => {
    const update = vi.fn();
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        update
      }
    } as unknown as PrismaClient;

    await expect(resetUserPasswordByEmail("missing@example.com", "replacement-password-2026", db)).rejects.toThrow(
      "No Pennyworth user exists"
    );
    expect(update).not.toHaveBeenCalled();
  });
});
