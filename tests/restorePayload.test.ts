import { describe, expect, it } from "vitest";
import {
  createRestorePayloadToken,
  decodeRestorePayload,
  encodeRestorePayload,
  isRestorePayloadTokenValid,
  RestorePayloadError
} from "../src/lib/restorePayload.js";

describe("restore preview payload tokens", () => {
  it("binds a confirmation to its user and exact previewed payload", () => {
    const sessionSecret = "test-session-secret-that-is-long-enough";
    const token = createRestorePayloadToken(sessionSecret, "user-one", "encrypted backup payload", "preview");

    expect(isRestorePayloadTokenValid(sessionSecret, "user-one", "encrypted backup payload", token, "preview")).toBe(true);
    expect(isRestorePayloadTokenValid(sessionSecret, "user-one", "changed payload", token, "preview")).toBe(false);
    expect(isRestorePayloadTokenValid(sessionSecret, "user-one", "encrypted backup payload", token, "other preview")).toBe(false);
    expect(isRestorePayloadTokenValid(sessionSecret, "user-two", "encrypted backup payload", token, "preview")).toBe(false);
    expect(isRestorePayloadTokenValid(sessionSecret, "user-one", "encrypted backup payload", `${token}x`, "preview")).toBe(false);
  });
});

describe("restore payload transport", () => {
  it("preserves source bytes without textarea newline normalization", () => {
    const payload = "{\r\n  \"format\": \"pennyworth-encrypted-backup\"\n}\r";
    const encoded = encodeRestorePayload(payload);

    expect(encoded).not.toContain("\n");
    expect(decodeRestorePayload(encoded, 1_024)).toBe(payload);
  });

  it("rejects altered, oversized, and invalid UTF-8 encoded payloads", () => {
    expect(() => decodeRestorePayload("not+base64url", 1_024)).toThrow(RestorePayloadError);
    expect(() => decodeRestorePayload(encodeRestorePayload("too big"), 1)).toThrow(RestorePayloadError);
    expect(() => decodeRestorePayload("_w", 1_024)).toThrow(RestorePayloadError);
  });
});
