import { describe, expect, it } from "vitest";
import { assertPasswordPolicy, passwordPolicyError } from "../src/lib/passwordPolicy.js";

describe("password policy", () => {
  it("accepts a password that meets the shared policy", () => {
    expect(passwordPolicyError("correct horse battery staple", "New password")).toBeNull();
    expect(() => assertPasswordPolicy("correct horse battery staple", "New password")).not.toThrow();
  });

  it("rejects missing, short, and forbidden default passwords", () => {
    expect(passwordPolicyError("", "New password")).toBe("New password is required.");
    expect(passwordPolicyError("too-short", "New password")).toBe(
      "New password must be at least 12 characters."
    );
    expect(passwordPolicyError("CHANGE-ME-NOW", "New password")).toBe(
      "New password uses a forbidden default password."
    );
  });

  it("counts UTF-8 bytes for the bcrypt compatibility limit", () => {
    expect(passwordPolicyError("a".repeat(72))).toBeNull();
    expect(passwordPolicyError("a".repeat(73))).toContain("72 UTF-8 bytes");
    expect(passwordPolicyError("é".repeat(36))).toBeNull();
    expect(passwordPolicyError("é".repeat(37))).toContain("72 UTF-8 bytes");
  });
});
