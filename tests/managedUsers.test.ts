import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "../src/lib/passwords.js";
import {
  createManagedUser,
  generateTemporaryPassword,
  normalizeManagedUserInput,
  resetManagedUserPassword,
  setManagedUserActiveState
} from "../src/services/managedUsers.js";

function transactionDatabase(tx: object) {
  return {
    $transaction: vi.fn(async (callback: (transaction: object) => unknown) => callback(tx))
  } as unknown as PrismaClient;
}

describe("managed users", () => {
  it("normalizes names and email addresses", () => {
    expect(normalizeManagedUserInput({ name: "  Family Member  ", email: " Member@Example.COM " })).toEqual({
      name: "Family Member",
      email: "member@example.com"
    });
    expect(() => normalizeManagedUserInput({ name: " ", email: "member@example.com" })).toThrow("Name is required");
    expect(() => normalizeManagedUserInput({ name: "Member", email: "invalid" })).toThrow("valid email");
  });

  it("generates distinct URL-safe temporary passwords", () => {
    const passwords = Array.from({ length: 20 }, generateTemporaryPassword);

    expect(new Set(passwords).size).toBe(passwords.length);
    expect(passwords.every((password) => password.length === 24 && /^[A-Za-z0-9_-]+$/.test(password))).toBe(true);
  });

  it("creates an isolated member with defaults and a one-time password", async () => {
    const createdUser = {
      id: "member-1",
      name: "Family Member",
      email: "member@example.com",
      role: "member",
      isActive: true,
      mustChangePassword: true
    };
    const findUnique = vi.fn().mockResolvedValue({ id: "admin-1", role: "admin", isActive: true });
    const create = vi.fn().mockResolvedValue(createdUser);
    const categoryCreateMany = vi.fn().mockResolvedValue({ count: 9 });
    const tagCreateMany = vi.fn().mockResolvedValue({ count: 5 });
    const db = transactionDatabase({
      user: { findUnique, create },
      category: { createMany: categoryCreateMany },
      tag: { createMany: tagCreateMany }
    });

    const result = await createManagedUser(
      "admin-1",
      { name: " Family Member ", email: " Member@Example.COM " },
      db
    );

    expect(result.user).toEqual(createdUser);
    expect(create).toHaveBeenCalledOnce();
    const createData = create.mock.calls[0]?.[0].data;
    expect(createData).toMatchObject({
      name: "Family Member",
      email: "member@example.com",
      role: "member",
      isActive: true,
      mustChangePassword: true
    });
    await expect(verifyPassword(result.temporaryPassword, createData.passwordHash)).resolves.toBe(true);
    expect(categoryCreateMany).toHaveBeenCalledOnce();
    expect(tagCreateMany).toHaveBeenCalledOnce();
  });

  it("invalidates sessions when an administrator deactivates another user", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "admin-1", role: "admin", isActive: true })
      .mockResolvedValueOnce({ id: "member-1", role: "member", isActive: true });
    const update = vi.fn().mockResolvedValue({ id: "member-1", isActive: false });
    const db = transactionDatabase({
      user: { findUnique, update, count: vi.fn() }
    });

    await setManagedUserActiveState("admin-1", "member-1", false, db);

    expect(update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { isActive: false, sessionVersion: { increment: 1 } }
    });
  });

  it("prevents administrators from deactivating themselves", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "admin-1", role: "admin", isActive: true })
      .mockResolvedValueOnce({ id: "admin-1", role: "admin", isActive: true });
    const update = vi.fn();
    const db = transactionDatabase({
      user: { findUnique, update, count: vi.fn() }
    });

    await expect(setManagedUserActiveState("admin-1", "admin-1", false, db)).rejects.toThrow(
      "cannot deactivate your own account"
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("resets another user's password and requires replacement", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "admin-1", role: "admin", isActive: true })
      .mockResolvedValueOnce({ id: "member-1", name: "Member", email: "member@example.com" });
    const update = vi.fn().mockResolvedValue({ id: "member-1" });
    const db = transactionDatabase({ user: { findUnique, update } });

    const result = await resetManagedUserPassword("admin-1", "member-1", db);
    const updateData = update.mock.calls[0]?.[0].data;

    expect(updateData).toMatchObject({
      mustChangePassword: true,
      sessionVersion: { increment: 1 }
    });
    await expect(verifyPassword(result.temporaryPassword, updateData.passwordHash)).resolves.toBe(true);
  });
});
