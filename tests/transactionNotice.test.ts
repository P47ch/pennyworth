import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { createTranslator } from "../src/lib/i18n.js";
import type { AppliedRule } from "../src/lib/ruleMatching.js";
import { consumeTransactionNotice, setTransactionNotice, transactionNoticeCookieName } from "../src/lib/transactionNotice.js";

async function noticeApp(secure = false, oversized = false, appliedRule?: AppliedRule) {
  const app = Fastify();
  await app.register(cookie, { secret: "notice-test-secret" });
  app.post("/save", async (_request, reply) => {
    setTransactionNotice(reply, "user-1", appliedRule ?? {
      name: oversized ? "Supermarkets".repeat(1000) : "Supermarkets",
      categoryName: "Food",
      addedTagNames: ["Household"]
    }, createTranslator("it"), secure);
    return reply.redirect("/transactions");
  });
  app.get("/transactions", async (request, reply) => ({ notice: consumeTransactionNotice(request, reply, "user-1") }));
  app.get("/other-user", async (request, reply) => ({ notice: consumeTransactionNotice(request, reply, "user-2") }));
  return app;
}

describe("transaction save feedback", () => {
  it("preserves rule, category, and tag names through the signed notice cookie", async () => {
    const appliedRule = {
      name: "Groceries $& $$ {category}",
      categoryName: "Food $` $' $$ {rule}",
      addedTagNames: ["Shared $& $$ {tags}"]
    };
    const app = await noticeApp(false, false, appliedRule);
    try {
      const saved = await app.inject({ method: "POST", url: "/save" });
      const header = String(saved.headers["set-cookie"]);
      const feedback = await app.inject({ url: "/transactions", headers: { cookie: header.split(";", 1)[0] } });
      expect(feedback.json().notice).toBe(
        `Transazione salvata. Applicata regola "${appliedRule.name}": categoria ${appliedRule.categoryName}. Etichette aggiunte: ${appliedRule.addedTagNames[0]}.`
      );
    } finally { await app.close(); }
  });

  it("uses a short-lived signed HttpOnly cookie and consumes localized feedback", async () => {
    const app = await noticeApp(true);
    try {
      const saved = await app.inject({ method: "POST", url: "/save" });
      const header = String(saved.headers["set-cookie"]);
      expect(header).toContain("HttpOnly");
      expect(header).toContain("Secure");
      expect(header).toContain("SameSite=Strict");
      expect(header).toContain("Max-Age=60");
      const feedback = await app.inject({ url: "/transactions", headers: { cookie: header.split(";", 1)[0] } });
      expect(feedback.json().notice).toBe('Transazione salvata. Applicata regola "Supermarkets": categoria Food. Etichette aggiunte: Household.');
      expect(String(feedback.headers["set-cookie"])).toContain("Max-Age=0");
      expect((await app.inject({ url: "/transactions" })).json().notice).toBeNull();
    } finally { await app.close(); }
  });

  it("rejects tampered, expired, and other-user messages", async () => {
    const app = await noticeApp();
    try {
      for (const value of ["forged", app.signCookie(JSON.stringify({ userId: "user-1", message: "expired", expiresAt: 1 }))]) {
        const response = await app.inject({ url: "/transactions", headers: { cookie: `${transactionNoticeCookieName}=${encodeURIComponent(value)}` } });
        expect(response.json().notice).toBeNull();
      }
      const saved = await app.inject({ method: "POST", url: "/save" });
      const response = await app.inject({ url: "/other-user", headers: { cookie: String(saved.headers["set-cookie"]).split(";", 1)[0] } });
      expect(response.json().notice).toBeNull();
    } finally { await app.close(); }
  });

  it("bounds feedback size even for very long rule names", async () => {
    const app = await noticeApp(false, true);
    try {
      const saved = await app.inject({ method: "POST", url: "/save" });
      const header = String(saved.headers["set-cookie"]);
      expect(Buffer.byteLength(header)).toBeLessThan(4096);
      const response = await app.inject({ url: "/transactions", headers: { cookie: header.split(";", 1)[0] } });
      expect(response.json().notice).toBe("Transazione salvata. È stata applicata una regola di categorizzazione.");
    } finally { await app.close(); }
  });
});
