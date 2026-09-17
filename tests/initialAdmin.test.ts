import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ensureInitialAdmin, initialAdminCredentials } from "../src/services/initialAdmin.js";

describe("initial administrator configuration", () => {
  it("normalizes a configured email and accepts a strong password", () => {
    expect(
      initialAdminCredentials({
        INITIAL_ADMIN_EMAIL: " Admin@Example.COM ",
        INITIAL_ADMIN_PASSWORD: "strong-admin-password-2026"
      })
    ).toEqual({
      email: "admin@example.com",
      password: "strong-admin-password-2026"
    });
  });

  it("uses the documented default email", () => {
    expect(initialAdminCredentials({ INITIAL_ADMIN_PASSWORD: "strong-admin-password-2026" }).email).toBe(
      "admin@example.com"
    );
  });

  it("rejects missing, weak, forbidden, and invalid values", () => {
    expect(() => initialAdminCredentials({})).toThrow("INITIAL_ADMIN_PASSWORD is required");
    expect(() => initialAdminCredentials({ INITIAL_ADMIN_PASSWORD: "short" })).toThrow("at least 12 characters");
    expect(() => initialAdminCredentials({ INITIAL_ADMIN_PASSWORD: "change-me-now" })).toThrow("forbidden default");
    expect(() =>
      initialAdminCredentials({ INITIAL_ADMIN_EMAIL: "invalid", INITIAL_ADMIN_PASSWORD: "strong-admin-password-2026" })
    ).toThrow("valid email address");
  });

  it("creates or preserves the configured account as an administrator", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "admin-1", email: "admin@example.com", role: "admin" });
    const db = { user: { upsert } } as unknown as PrismaClient;

    await ensureInitialAdmin(
      { INITIAL_ADMIN_EMAIL: "admin@example.com", INITIAL_ADMIN_PASSWORD: "strong-admin-password-2026" },
      db
    );

    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { email: "admin@example.com" },
      update: { role: "admin" },
      create: { email: "admin@example.com", role: "admin" }
    });
  });
});
