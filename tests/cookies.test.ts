import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { csrfCookieName, getOrCreateCsrfToken } from "../src/lib/csrf.js";
import { refreshSessionCookie, sessionCookieName } from "../src/lib/session.js";

describe("transport cookie attributes", () => {
  it("reissues an existing CSRF cookie with the active Secure attribute", () => {
    const setCookie = vi.fn();
    const request = {
      cookies: { [csrfCookieName]: "signed-existing-token" },
      unsignCookie: () => ({ valid: true, renew: false, value: "existing-token" })
    } as unknown as FastifyRequest;
    const reply = { setCookie } as unknown as FastifyReply;

    expect(getOrCreateCsrfToken(request, reply, true)).toBe("existing-token");
    expect(setCookie).toHaveBeenCalledWith(
      csrfCookieName,
      "existing-token",
      expect.objectContaining({ httpOnly: true, sameSite: "strict", secure: true, signed: true })
    );
  });

  it("upgrades a session cookie without extending its signed expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T00:00:00.000Z"));
    const setCookie = vi.fn();
    const reply = { setCookie } as unknown as FastifyReply;
    const session = {
      userId: "user-1",
      sessionVersion: 3,
      expiresAt: Date.now() + 60_000
    };

    try {
      refreshSessionCookie(reply, session, true);

      expect(setCookie).toHaveBeenCalledWith(
        sessionCookieName,
        JSON.stringify(session),
        expect.objectContaining({ maxAge: 60, secure: true, signed: true })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
