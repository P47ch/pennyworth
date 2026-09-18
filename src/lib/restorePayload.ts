import { createHmac, timingSafeEqual } from "node:crypto";

const restorePayloadLifetimeMs = 15 * 60 * 1000;

export class RestorePayloadError extends Error {
  constructor() {
    super("Restore preview has expired or changed. Preview the backup again.");
    this.name = "RestorePayloadError";
  }
}

export function encodeRestorePayload(payload: string): string {
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodeRestorePayload(encodedPayload: string, maximumPayloadBytes: number): string {
  if (!/^[A-Za-z0-9_-]+$/.test(encodedPayload)) {
    throw new RestorePayloadError();
  }

  const payload = Buffer.from(encodedPayload, "base64url");

  if (payload.length > maximumPayloadBytes || payload.toString("base64url") !== encodedPayload) {
    throw new RestorePayloadError();
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    throw new RestorePayloadError();
  }
}

function signature(sessionSecret: string, userId: string, payload: string, previewPayload: string, expiresAt: number): Buffer {
  return createHmac("sha256", sessionSecret)
    .update(`${userId}\n${expiresAt}\n`)
    .update(`${Buffer.byteLength(payload, "utf8")}\n`)
    .update(payload, "utf8")
    .update("\n", "utf8")
    .update(`${Buffer.byteLength(previewPayload, "utf8")}\n`)
    .update(previewPayload, "utf8")
    .digest();
}

export function createRestorePayloadToken(
  sessionSecret: string,
  userId: string,
  payload: string,
  previewPayload = ""
): string {
  const expiresAt = Date.now() + restorePayloadLifetimeMs;
  return `${expiresAt}.${signature(sessionSecret, userId, payload, previewPayload, expiresAt).toString("base64url")}`;
}

export function isRestorePayloadTokenValid(
  sessionSecret: string,
  userId: string,
  payload: string,
  token: string,
  previewPayload = ""
): boolean {
  const [expiresAtText, encodedSignature, ...extra] = token.split(".");
  const expiresAt = Number(expiresAtText);

  if (
    extra.length ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < Date.now() ||
    !/^[A-Za-z0-9_-]{43}$/.test(encodedSignature)
  ) {
    return false;
  }

  const actual = Buffer.from(encodedSignature, "base64url");
  const expected = signature(sessionSecret, userId, payload, previewPayload, expiresAt);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
