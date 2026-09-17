import type { FastifyReply, FastifyRequest } from "fastify";

export const sessionCookieName = "pennyworth_session";
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;

export type SessionData = {
  userId: string;
  sessionVersion: number;
  expiresAt: number;
};

function writeSessionCookie(reply: FastifyReply, session: SessionData, secure: boolean) {
  const remainingLifetimeSeconds = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));

  reply.setCookie(sessionCookieName, JSON.stringify(session), {
    httpOnly: true,
    maxAge: remainingLifetimeSeconds,
    path: "/",
    sameSite: "strict",
    secure,
    signed: true
  });
}

export function getSessionData(request: FastifyRequest): SessionData | null {
  const signedCookie = request.cookies[sessionCookieName];

  if (!signedCookie) {
    return null;
  }

  const unsigned = request.unsignCookie(signedCookie);

  if (!unsigned.valid || !unsigned.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(unsigned.value) as Partial<SessionData>;

    const { userId, sessionVersion, expiresAt } = parsed;

    if (
      typeof userId !== "string" ||
      typeof sessionVersion !== "number" ||
      typeof expiresAt !== "number" ||
      !Number.isInteger(sessionVersion) ||
      !Number.isInteger(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      userId,
      sessionVersion,
      expiresAt
    };
  } catch {
    return null;
  }
}

export function getSessionUserId(request: FastifyRequest): string | null {
  return getSessionData(request)?.userId ?? null;
}

export function setSessionCookie(reply: FastifyReply, userId: string, sessionVersion: number, secure = false) {
  const expiresAt = Date.now() + sessionLifetimeMs;

  writeSessionCookie(reply, { userId, sessionVersion, expiresAt }, secure);
}

export function refreshSessionCookie(reply: FastifyReply, session: SessionData, secure = false) {
  writeSessionCookie(reply, session, secure);
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(sessionCookieName, {
    path: "/"
  });
}
