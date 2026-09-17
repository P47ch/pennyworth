import { describe, expect, it } from "vitest";
import { recoveryEmailArgument } from "../scripts/reset-password.js";

describe("password reset command", () => {
  it("requires an explicit email argument", () => {
    expect(recoveryEmailArgument(["--email", "admin@example.com"])).toBe("admin@example.com");
    expect(() => recoveryEmailArgument([])).toThrow("Usage:");
    expect(() => recoveryEmailArgument(["admin@example.com"])).toThrow("Usage:");
  });
});
