import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export const csrfCookieName = "pennyworth_csrf";
export const csrfFieldName = "csrfToken";

function setCsrfCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply.setCookie(csrfCookieName, token, {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure,
    signed: true
  });
}

function tokenFromBody(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>)[csrfFieldName];
  return typeof value === "string" ? value : "";
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function getOrCreateCsrfToken(request: FastifyRequest, reply: FastifyReply, secure = false): string {
  const signedCookie = request.cookies[csrfCookieName];

  if (signedCookie) {
    const unsigned = request.unsignCookie(signedCookie);

    if (unsigned.valid && unsigned.value) {
      if (secure) {
        // Upgrade a private-HTTP cookie without changing the token in forms.
        setCsrfCookie(reply, unsigned.value, true);
      }

      return unsigned.value;
    }
  }

  const token = randomBytes(32).toString("base64url");
  setCsrfCookie(reply, token, secure);

  return token;
}

export function validateCsrfToken(request: FastifyRequest): boolean {
  const signedCookie = request.cookies[csrfCookieName];

  if (!signedCookie) {
    return false;
  }

  const unsigned = request.unsignCookie(signedCookie);

  if (!unsigned.valid || !unsigned.value) {
    return false;
  }

  return safeEqual(unsigned.value, tokenFromBody(request.body));
}
