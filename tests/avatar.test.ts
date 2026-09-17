import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avatarInitials, avatarOptions, isAvatarKey, normalizeAvatarKey, resolveAvatar } from "../src/lib/avatar.js";

describe("user avatars", () => {
  it("uses the first and last name initials", () => {
    expect(avatarInitials("Pat Example Smith", "pat@example.com")).toBe("PS");
  });

  it("uses up to two characters for a single name", () => {
    expect(avatarInitials("Ada", "ada@example.com")).toBe("AD");
  });

  it("falls back to the email when the name is blank", () => {
    expect(avatarInitials("  ", "person@example.com")).toBe("PE");
  });

  it("falls back safely when a stored avatar is not available", () => {
    expect(normalizeAvatarKey("future-avatar")).toBe("initials");
    expect(isAvatarKey("initials")).toBe(true);
    expect(resolveAvatar({ avatarKey: "future-avatar", name: "Pat Smith", email: "pat@example.com" })).toEqual({
      key: "initials",
      label: "Initials",
      imagePath: null,
      initials: "PS"
    });
  });

  it("provides five local portraits in addition to initials", () => {
    const portraits = avatarOptions.filter((option) => option.imagePath);

    expect(portraits).toHaveLength(5);
    expect(isAvatarKey("operator")).toBe(true);
    expect(portraits.every((option) => existsSync(new URL(`../src${option.imagePath}`, import.meta.url)))).toBe(true);
  });

  it("resolves a selected portrait without losing the initials fallback", () => {
    expect(resolveAvatar({ avatarKey: "custodian", name: "Pat Smith", email: "pat@example.com" })).toEqual({
      key: "custodian",
      label: "Custodian",
      imagePath: "/public/avatars/custodian.png",
      initials: "PS"
    });
  });
});
