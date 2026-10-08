import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/server.js";
import { prisma } from "../../src/lib/db.js";
import { hashPassword } from "../../src/lib/passwords.js";
import { sessionCookieName } from "../../src/lib/session.js";
import { buildUserBackup } from "../../src/services/backup.js";

const families = ["accounts", "transactions", "categories", "tags", "budgets", "rules", "recurring",
  "assets", "asset-prices", "holdings", "investment-transactions"] as const;
type Family = typeof families[number];
type Target = { id: string; exists: () => Promise<unknown> };
const userIds: string[] = [];
let app: FastifyInstance;
let targets: Record<Family, Target>;
let otherTargets: Record<Family, Target>;
let userId: string;
let cookie: string;
let csrfToken: string;
let bankId: string;
let investmentAccountId: string;
let categoryId: string;

function responseCookie(response: { headers: Record<string, unknown> }, name: string) {
  const headers = response.headers["set-cookie"];
  const values = Array.isArray(headers) ? headers : [String(headers)];
  const value = values.find((header: string) => header.startsWith(`${name}=`));
  if (!value) throw new Error(`Missing ${name} cookie`);
  return value.split(";", 1)[0] as string;
}

async function fixture() {
  const id = `integration-test-deletions-${randomUUID()}`;
  const password = "deletion-fixture-password-2026";
  const user = await prisma.user.create({ data: {
    id, name: "Deletion Test User", email: `${id}@pennyworth.local`, passwordHash: await hashPassword(password)
  } });
  userIds.push(user.id);
  const account = (name: string, type: "bank" | "investment" = "bank") => prisma.account.create({
    data: { userId: id, name, type, currency: "EUR", openingBalanceMinor: 10000 }
  });
  const bank = await account("Main bank");
  const unusedAccount = await account("Unused account");
  const investment = await account("Investments", "investment");
  const category = await prisma.category.create({ data: { userId: id, name: "Used category", type: "expense" } });
  const unusedCategory = await prisma.category.create({ data: { userId: id, name: "Unused category", type: "expense" } });
  const tag = await prisma.tag.create({ data: { userId: id, name: "Fixture tag" } });
  const date = new Date("2026-10-07T00:00:00Z");
  const transaction = await prisma.transaction.create({ data: {
    userId: id, type: "expense", date, amountMinor: 2387, description: "Fixture expense",
    sourceAccountId: bank.id, categoryId: category.id, tags: { create: { tag: { connect: { id_userId: { id: tag.id, userId: id } } } } }
  } });
  const budget = await prisma.budget.create({ data: { userId: id, categoryId: category.id,
    month: new Date("2026-10-01T00:00:00Z"), amountMinor: 10000 } });
  const rule = await prisma.rule.create({ data: { userId: id, name: "Fixture rule", matchText: "fixture",
    categoryId: category.id, tags: { create: { tag: { connect: { id_userId: { id: tag.id, userId: id } } } } } } });
  const recurring = await prisma.recurringTransaction.create({ data: { userId: id, name: "Fixture recurring",
    type: "expense", frequency: "monthly", amountMode: "fixed", amountMinor: 500, nextDate: date,
    sourceAccountId: bank.id, categoryId: category.id } });
  const asset = (symbol: string) => prisma.asset.create({ data: {
    userId: id, name: `Fixture ${symbol}`, symbol, type: "etf", currency: "EUR"
  } });
  const unusedAsset = await asset("UNUSED");
  const heldAsset = await asset("HELD");
  const tradedAsset = await asset("TRADED");
  const price = await prisma.assetPrice.create({ data: { userId: id, assetId: tradedAsset.id, date, priceMinor: 1200 } });
  const holding = await prisma.holding.create({ data: { userId: id, accountId: investment.id,
    assetId: heldAsset.id, quantity: "2", averageCostMinor: 1000 } });
  const activity = await prisma.investmentTransaction.create({ data: { userId: id, accountId: investment.id,
    cashAccountId: bank.id, assetId: tradedAsset.id, type: "buy", date, quantity: "1", priceMinor: 1000,
    amountMinor: 1000, cashAmountMinor: 1000 } });
  return { user, password, bank, investment, category, targets: {
    accounts: { id: unusedAccount.id, exists: () => prisma.account.findUnique({ where: { id: unusedAccount.id } }) },
    transactions: { id: transaction.id, exists: () => prisma.transaction.findUnique({ where: { id: transaction.id } }) },
    categories: { id: unusedCategory.id, exists: () => prisma.category.findUnique({ where: { id: unusedCategory.id } }) },
    tags: { id: tag.id, exists: () => prisma.tag.findUnique({ where: { id: tag.id } }) },
    budgets: { id: budget.id, exists: () => prisma.budget.findUnique({ where: { id: budget.id } }) },
    rules: { id: rule.id, exists: () => prisma.rule.findUnique({ where: { id: rule.id } }) },
    recurring: { id: recurring.id, exists: () => prisma.recurringTransaction.findUnique({ where: { id: recurring.id } }) },
    assets: { id: unusedAsset.id, exists: () => prisma.asset.findUnique({ where: { id: unusedAsset.id } }) },
    "asset-prices": { id: price.id, exists: () => prisma.assetPrice.findUnique({ where: { id: price.id } }) },
    holdings: { id: holding.id, exists: () => prisma.holding.findUnique({ where: { id: holding.id } }) },
    "investment-transactions": { id: activity.id, exists: () => prisma.investmentTransaction.findUnique({ where: { id: activity.id } }) }
  } };
}

async function domainSnapshot() {
  const backup = await buildUserBackup(userId);
  const { exportedAt, user, ...records } = backup;
  return JSON.parse(JSON.stringify(records));
}

function post(url: string, fields: Record<string, string> = {}, withCsrf = true) {
  return app.inject({ method: "POST", url, headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({ ...(withCsrf ? { csrfToken } : {}), ...fields }).toString() });
}

beforeAll(async () => {
  app = await buildApp();
  const f = await fixture();
  const other = await fixture();
  userId = f.user.id;
  bankId = f.bank.id;
  investmentAccountId = f.investment.id;
  categoryId = f.category.id;
  targets = f.targets;
  otherTargets = other.targets;
  const loginPage = await app.inject({ url: "/login" });
  const csrfCookie = responseCookie(loginPage, "pennyworth_csrf");
  csrfToken = loginPage.body.match(/name="csrfToken" value="([^"]+)"/)?.[1] ?? "";
  const login = await app.inject({ method: "POST", url: "/login", remoteAddress: "10.1.1.1",
    headers: { cookie: csrfCookie, "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({ email: f.user.email, password: f.password, csrfToken }).toString() });
  expect(login.statusCode).toBe(302);
  cookie = `${responseCookie(login, sessionCookieName)}; ${csrfCookie}`;
});

afterAll(async () => {
  if (userIds.some(id => !id.startsWith("integration-test-deletions-"))) throw new Error("Unsafe test cleanup");
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await app?.close();
});

describe("all Delete actions", () => {
  it.each(families)("requires a separate, CSRF-protected confirmation for %s", async (family) => {
    const target = targets[family];
    const url = `/${family}/${target.id}/delete`;
    const before = await domainSnapshot();
    const preview = await post(url);
    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain('name="confirmDelete" value="yes"');
    expect(preview.body).toContain(`action="${url}"`);
    expect(preview.body).toContain("Confirm deletion");
    expect(await target.exists()).not.toBeNull();
    expect(await domainSnapshot()).toEqual(before);

    const invalid = await post(url, { confirmDelete: "no" });
    expect(invalid.statusCode).toBe(200);
    const cancelHref = preview.body.match(/class="action-link" href="([^"]+)">Cancel/)?.[1];
    expect(cancelHref).toBeTruthy();
    expect((await app.inject({ url: cancelHref!, headers: { cookie } })).statusCode).toBe(200);
    expect(await domainSnapshot()).toEqual(before);

    expect((await post(url, { confirmDelete: "yes" }, false)).statusCode).toBe(403);
    expect(await target.exists()).not.toBeNull();
    const otherUrl = `/${family}/${otherTargets[family].id}/delete`;
    const confirmations: Record<string, string>[] = [{}, { confirmDelete: "yes" }];
    for (const fields of confirmations) {
      const response = await post(otherUrl, fields);
      expect(response.statusCode).toBe(302);
      expect(response.body).not.toContain("Confirm deletion");
      expect(await otherTargets[family].exists()).not.toBeNull();
    }

    const confirmed = await post(url, { confirmDelete: "yes" });
    expect(confirmed.statusCode).toBe(302);
    expect(await target.exists()).toBeNull();
  });

  it("keeps used accounts and assets active until confirmation, then inactivates them", async () => {
    const asset = await prisma.asset.create({ data: { userId, name: "Used asset", symbol: "USED", type: "etf", currency: "EUR" } });
    await prisma.holding.create({ data: { userId, accountId: investmentAccountId, assetId: asset.id, quantity: "1", averageCostMinor: 1000 } });
    for (const target of [
      { url: `/accounts/${investmentAccountId}/delete`, find: () => prisma.account.findUniqueOrThrow({ where: { id: investmentAccountId } }) },
      { url: `/assets/${asset.id}/delete`, find: () => prisma.asset.findUniqueOrThrow({ where: { id: asset.id } }) }
    ]) {
      const preview = await post(target.url);
      expect(preview.body).toContain("marked inactive instead");
      expect((await target.find()).isActive).toBe(true);
      expect((await post(target.url, { confirmDelete: "yes" })).statusCode).toBe(302);
      expect((await target.find()).isActive).toBe(false);
    }
  });

  it("explains and confirms linked transfer/fee deletion without deleting either on preview", async () => {
    const destination = await prisma.account.create({ data: { userId, name: "Wallet", type: "cash", currency: "EUR", openingBalanceMinor: 0 } });
    const date = new Date("2026-10-07T00:00:00Z");
    const transfer = await prisma.transaction.create({ data: { userId, type: "transfer", date, amountMinor: 1000,
      sourceAccountId: bankId, destinationAccountId: destination.id } });
    const fee = await prisma.transaction.create({ data: { userId, type: "expense", date, amountMinor: 50,
      sourceAccountId: bankId, categoryId, feeForTransactionId: transfer.id } });
    const transferUrl = `/transactions/${transfer.id}/delete`;
    expect((await post(transferUrl)).body).toContain("also deletes its linked fee expense");
    expect((await post(`/transactions/${fee.id}/delete`)).body).toContain("keeps the linked transfer");
    expect(await prisma.transaction.count({ where: { id: { in: [transfer.id, fee.id] } } })).toBe(2);
    expect((await post(transferUrl, { confirmDelete: "yes" })).statusCode).toBe(302);
    expect(await prisma.transaction.count({ where: { id: { in: [transfer.id, fee.id] } } })).toBe(0);
  });
});
