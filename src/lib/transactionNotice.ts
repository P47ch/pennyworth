import type { FastifyReply, FastifyRequest } from "fastify";
import type { Translator } from "./i18n.js";
import type { AppliedRule } from "./ruleMatching.js";

export const transactionNoticeCookieName = "pennyworth_transaction_notice";
const noticeLifetimeMs = 60_000;
const cookiePath = "/transactions";

export function setTransactionNotice(
  reply: FastifyReply,
  userId: string,
  appliedRule: AppliedRule | null,
  t: Translator,
  secure: boolean
) {
  let message = t("Transaction saved.");
  if (appliedRule) {
    message = t('Transaction saved. Applied rule "{rule}": category {category}.', {
      rule: appliedRule.name,
      category: appliedRule.categoryName
    });
    if (appliedRule.addedTagNames.length > 0) {
      message += ` ${t("Added tags: {tags}.", { tags: appliedRule.addedTagNames.join(", ") })}`;
    }
  }

  const expiresAt = Date.now() + noticeLifetimeMs;
  let payload = JSON.stringify({ userId, message, expiresAt });
  // Leave room for URL encoding, the signature, and cookie attributes.
  if (Buffer.byteLength(encodeURIComponent(payload), "utf8") > 3000) {
    message = t("Transaction saved. A categorization rule was applied.");
    payload = JSON.stringify({ userId, message, expiresAt });
  }

  reply.setCookie(transactionNoticeCookieName, payload, {
    httpOnly: true,
    sameSite: "strict",
    signed: true,
    secure,
    path: cookiePath,
    maxAge: noticeLifetimeMs / 1000
  });
}

export function consumeTransactionNotice(request: FastifyRequest, reply: FastifyReply, userId: string): string | null {
  const cookie = request.cookies[transactionNoticeCookieName];
  if (!cookie) {
    return null;
  }

  reply.clearCookie(transactionNoticeCookieName, { path: cookiePath });
  const unsigned = request.unsignCookie(cookie);
  if (!unsigned.valid || !unsigned.value) {
    return null;
  }

  try {
    const notice = JSON.parse(unsigned.value) as { userId?: unknown; message?: unknown; expiresAt?: unknown };
    return notice.userId === userId && typeof notice.message === "string" &&
      typeof notice.expiresAt === "number" && Number.isSafeInteger(notice.expiresAt) && notice.expiresAt > Date.now()
      ? notice.message : null;
  } catch {
    return null;
  }
}
