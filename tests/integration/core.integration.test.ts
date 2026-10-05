import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/server.js";
import { hashPassword, verifyPassword } from "../../src/lib/passwords.js";
import { sessionCookieName } from "../../src/lib/session.js";
import { prisma } from "../../src/lib/db.js";
import { getAccountBalanceMap } from "../../src/queries/accountBalances.js";
import {
  getMonthlyAccountBalanceHistory,
  getMonthlyCashBalanceHistory
} from "../../src/queries/netWorth.js";
import {
  getExpenseTotalsByCategory,
  getExpenseTotalsByTag,
  getMonthlyCashflowTotals,
  getMonthlyExpenseTotalsByCategory
} from "../../src/queries/reporting.js";
import { buildUserBackup, currentBackupSchemaVersion, previewBackupJson, restoreUserBackup } from "../../src/services/backup.js";
import { getInvestmentReport } from "../../src/services/investmentSummary.js";
import { resetUserPasswordByEmail } from "../../src/services/passwordRecovery.js";
import { createHolding } from "../../src/services/holdings.js";
import {
  createInvestmentTransaction,
  deleteInvestmentTransaction,
  listInvestmentTransactionPage,
  updateInvestmentTransaction
} from "../../src/services/investmentTransactions.js";
import { createTransaction, updateTransaction } from "../../src/services/transactions.js";
import { createRule, previewRuleApplications } from "../../src/services/rules.js";
import { generateRecurringTransaction } from "../../src/services/recurring.js";
import { matchRuleForText } from "../../src/lib/ruleMatching.js";

const testIdPrefix = "integration-test-";
const createdUserIds: string[] = [];
const createdManagedUserEmails: string[] = [];
let app: FastifyInstance;

function integrationId(label: string): string {
  return `${testIdPrefix}${label}-${randomUUID()}`;
}

async function createUser(password?: string) {
  const id = integrationId("user");
  const user = await prisma.user.create({
    data: {
      id,
      email: `${id}@pennyworth.local`,
      name: "Integration Test User",
      passwordHash: password ? await hashPassword(password) : "integration-test-user-cannot-login"
    }
  });

  createdUserIds.push(user.id);
  return user;
}

async function createAccount(
  userId: string,
  label: string,
  openingBalanceMinor: number,
  type: "bank" | "investment" = "bank"
) {
  return prisma.account.create({
    data: {
      id: integrationId(`account-${label}`),
      userId,
      name: `Integration ${label} ${randomUUID()}`,
      type,
      currency: "EUR",
      openingBalanceMinor
    }
  });
}

function responseCookie(
  response: { headers: Record<string, string | string[] | number | undefined> },
  name: string
): string {
  const rawHeaders = response.headers["set-cookie"];
  const headers = Array.isArray(rawHeaders) ? rawHeaders : typeof rawHeaders === "string" ? [rawHeaders] : [];
  const cookie = headers.find((header) => header.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`Response did not set ${name}.`);
  }

  return cookie.split(";", 1)[0];
}

function backupDomainSnapshot(backup: Awaited<ReturnType<typeof buildUserBackup>>) {
  const snapshot = JSON.parse(JSON.stringify(backup)) as Record<string, unknown>;

  delete snapshot.exportedAt;
  delete snapshot.user;
  return snapshot;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

beforeAll(async () => {
  app = await buildApp();
});

afterEach(async () => {
  const userIds = createdUserIds.splice(0);
  const managedUserEmails = createdManagedUserEmails.splice(0);

  if (userIds.some((userId) => !userId.startsWith(testIdPrefix))) {
    throw new Error("Refusing to clean up a user outside the integration-test namespace.");
  }

  if (
    managedUserEmails.some(
      (email) => !email.startsWith(`${testIdPrefix}managed-member-`) || !email.endsWith("@pennyworth.local")
    )
  ) {
    throw new Error("Refusing to clean up a managed user outside the integration-test namespace.");
  }

  if (userIds.length > 0 || managedUserEmails.length > 0) {
    await prisma.user.deleteMany({
      where: {
        OR: [
          ...(userIds.length > 0 ? [{ id: { in: userIds } }] : []),
          ...(managedUserEmails.length > 0 ? [{ email: { in: managedUserEmails } }] : [])
        ]
      }
    });
  }
});

afterAll(async () => {
  await app.close();
});

describe("database-backed finance behavior", () => {
  it("keeps legacy inert rules importable after export and reimport", async () => {
    const user = await createUser();
    const category = await prisma.category.create({ data: { userId: user.id, name: "Legacy rule category", type: "expense" } });
    await prisma.rule.createMany({ data: [
      { userId: user.id, categoryId: category.id, name: "Active whitespace", matchText: "   ", isActive: true },
      { userId: user.id, categoryId: category.id, name: "Inactive line breaks", matchText: " \r\n\t ", isActive: false }
    ] });
    const legacy = await buildUserBackup(user.id);
    legacy.schemaVersion = 9;
    await restoreUserBackup(user.id, JSON.stringify(legacy));
    const exported = await buildUserBackup(user.id);
    expect(previewBackupJson(JSON.stringify(exported)).ruleCount).toBe(2);
    expect(matchRuleForText({ description: "Any merchant", notes: " \r\n\t " }, exported.rules)).toBeNull();
    await restoreUserBackup(user.id, JSON.stringify(exported));
    const reexported = await buildUserBackup(user.id);
    expect(reexported.rules).toEqual(exported.rules);
  });

  it("shares rule matching across creation, recurring generation, preview, and versioned restore", async () => {
    const [user, otherUser] = await Promise.all([createUser(), createUser()]);
    const account = await createAccount(user.id, "rule-cash", 10_000);
    const [category, manualCategory, otherCategory] = await Promise.all([
      prisma.category.create({ data: { userId: user.id, name: "Rule food", type: "expense" } }),
      prisma.category.create({ data: { userId: user.id, name: "Manual food", type: "expense" } }),
      prisma.category.create({ data: { userId: otherUser.id, name: "Other food", type: "expense" } })
    ]);
    const tag = await prisma.tag.create({ data: { userId: user.id, name: "household" } });
    await createRule({ userId: otherUser.id, name: "Other user", matchText: "aldi", categoryId: otherCategory.id, tagIds: [], isActive: true });
    await createRule({ userId: user.id, name: "Inactive", matchText: "aldi", categoryId: manualCategory.id, tagIds: [], isActive: false });
    await createRule({ userId: user.id, name: "Supermarkets", matchText: "lidl, aldi", categoryId: category.id, tagIds: [tag.id], isActive: true });
    const entry = {
      userId: user.id, type: "expense" as const, date: new Date("2026-10-02T00:00:00.000Z"), amountMinor: 1000,
      sourceAccountId: account.id, description: "Card payment", notes: "ALDI weekly shopping", tagIds: [tag.id]
    };
    const created = await createTransaction(entry);
    expect(created.categoryId).toBe(category.id);
    expect(created.appliedRule).toEqual({ name: "Supermarkets", categoryName: "Rule food", addedTagNames: [] });
    await expect(prisma.transactionTag.count({ where: { transactionId: created.id, userId: user.id } })).resolves.toBe(1);
    const manual = await createTransaction({ ...entry, categoryId: manualCategory.id, tagIds: [] });
    expect(manual.appliedRule).toBeNull();
    await expect(prisma.transactionTag.count({ where: { transactionId: manual.id } })).resolves.toBe(0);

    const recurring = await prisma.recurringTransaction.create({ data: {
      userId: user.id, name: "Recurring shopping", type: "expense", amountMinor: 500,
      sourceAccountId: account.id, description: "LIDL", nextDate: entry.date, frequency: "monthly"
    } });
    const generated = await generateRecurringTransaction(user.id, recurring.id);
    expect(generated.categoryId).toBe(category.id);
    expect(generated.appliedRule?.addedTagNames).toEqual(["household"]);
    await expect(prisma.recurringTransaction.findUnique({ where: { id: recurring.id } })).resolves.toMatchObject({
      nextDate: new Date("2026-11-02T00:00:00.000Z")
    });

    await updateTransaction({ ...entry, transactionId: created.id, tagIds: [] });
    const applications = await previewRuleApplications(user.id);
    expect(applications.map((item) => item.transaction.id)).toContain(created.id);
    const backup = await buildUserBackup(user.id);
    expect(backup.schemaVersion).toBe(currentBackupSchemaVersion);
    await restoreUserBackup(user.id, JSON.stringify(backup));
    await expect(prisma.transaction.findUnique({ where: { id: created.id } })).resolves.toMatchObject({ categoryId: null });
    await expect(prisma.transactionTag.count({ where: { transactionId: created.id } })).resolves.toBe(0);

    const legacy = JSON.parse(JSON.stringify(backup));
    legacy.schemaVersion = 9;
    legacy.rules[1].matchText = 'Smith, "Inc"';
    await restoreUserBackup(user.id, JSON.stringify(legacy));
    const restored = await prisma.rule.findUniqueOrThrow({ where: { id: legacy.rules[1].id } });
    expect(matchRuleForText({ description: 'Smith, "Inc"' }, [restored])).not.toBeNull();
    expect(matchRuleForText({ description: "Smith" }, [restored])).toBeNull();
  });

  it("enforces investment ownership and value shapes inside PostgreSQL", async () => {
    const [user, otherUser] = await Promise.all([createUser(), createUser()]);
    const [account, cashAccount, otherAccount] = await Promise.all([
      createAccount(user.id, "integrity-investment", 0, "investment"),
      createAccount(user.id, "integrity-cash", 0),
      createAccount(otherUser.id, "integrity-other", 0, "investment")
    ]);
    const [asset, otherAsset] = await Promise.all([
      prisma.asset.create({
        data: {
          id: integrationId("integrity-asset"),
          userId: user.id,
          symbol: `INTEGRITY-${randomUUID()}`,
          name: "Integrity Asset",
          type: "stock",
          currency: "EUR"
        }
      }),
      prisma.asset.create({
        data: {
          id: integrationId("integrity-other-asset"),
          userId: otherUser.id,
          symbol: `OTHER-${randomUUID()}`,
          name: "Other Asset",
          type: "stock",
          currency: "EUR"
        }
      })
    ]);
    const baseInvestment = {
      userId: user.id,
      accountId: account.id,
      cashAccountId: cashAccount.id,
      assetId: asset.id,
      type: "buy" as const,
      date: new Date("2026-03-01T00:00:00.000Z"),
      quantity: "1",
      priceMinor: 10_000,
      amountMinor: 10_000,
      cashAmountMinor: 10_000
    };

    await expect(
      prisma.investmentTransaction.create({
        data: { ...baseInvestment, id: integrationId("foreign-investment-account"), accountId: otherAccount.id }
      })
    ).rejects.toThrow();
    await expect(
      prisma.investmentTransaction.create({
        data: { ...baseInvestment, id: integrationId("foreign-cash-account"), cashAccountId: otherAccount.id }
      })
    ).rejects.toThrow();
    await expect(
      prisma.investmentTransaction.create({
        data: { ...baseInvestment, id: integrationId("foreign-investment-asset"), assetId: otherAsset.id }
      })
    ).rejects.toThrow();
    await expect(
      prisma.investmentTransaction.create({
        data: { ...baseInvestment, id: integrationId("zero-investment-amount"), amountMinor: 0 }
      })
    ).rejects.toThrow();
    await expect(
      prisma.investmentTransaction.create({
        data: { ...baseInvestment, id: integrationId("zero-investment-cash"), cashAmountMinor: 0 }
      })
    ).rejects.toThrow();
    await expect(
      prisma.investmentTransaction.create({
        data: { ...baseInvestment, id: integrationId("missing-trade-quantity"), quantity: null }
      })
    ).rejects.toThrow();
    await expect(
      prisma.investmentTransaction.create({
        data: {
          ...baseInvestment,
          id: integrationId("income-with-trade-fields"),
          type: "dividend",
          quantity: "1",
          priceMinor: 10_000
        }
      })
    ).rejects.toThrow();

    await expect(
      prisma.holding.create({
        data: {
          id: integrationId("foreign-holding-account"),
          userId: user.id,
          accountId: otherAccount.id,
          assetId: asset.id,
          quantity: "1",
          averageCostMinor: 10_000
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.holding.create({
        data: {
          id: integrationId("foreign-holding-asset"),
          userId: user.id,
          accountId: account.id,
          assetId: otherAsset.id,
          quantity: "1",
          averageCostMinor: 10_000
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.holding.create({
        data: {
          id: integrationId("invalid-holding-quantity"),
          userId: user.id,
          accountId: account.id,
          assetId: asset.id,
          quantity: "0",
          averageCostMinor: 10_000
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.holding.create({
        data: {
          id: integrationId("negative-holding-cost"),
          userId: user.id,
          accountId: account.id,
          assetId: asset.id,
          quantity: "1",
          averageCostMinor: -1
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.assetPrice.create({
        data: {
          id: integrationId("foreign-asset-price"),
          userId: user.id,
          assetId: otherAsset.id,
          date: new Date("2026-03-01T00:00:00.000Z"),
          priceMinor: 10_000
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.assetPrice.create({
        data: {
          id: integrationId("zero-asset-price"),
          userId: user.id,
          assetId: asset.id,
          date: new Date("2026-03-01T00:00:00.000Z"),
          priceMinor: 0
        }
      })
    ).rejects.toThrow();

    await prisma.investmentTransaction.create({
      data: { ...baseInvestment, id: integrationId("valid-investment") }
    });
    await expect(prisma.investmentTransaction.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("lazily rebuilds investment positions from authoritative activity", async () => {
    const user = await createUser();
    const account = await createAccount(user.id, "legacy-investments", 0, "investment");
    const asset = await prisma.asset.create({
      data: {
        id: integrationId("legacy-asset"),
        userId: user.id,
        symbol: `LEGACY-${randomUUID()}`,
        name: "Legacy Asset",
        type: "etf",
        currency: "EUR"
      }
    });

    await prisma.investmentTransaction.create({
      data: {
        id: integrationId("legacy-buy"),
        userId: user.id,
        accountId: account.id,
        assetId: asset.id,
        type: "buy",
        date: new Date("2026-01-10T00:00:00.000Z"),
        quantity: "4.5",
        priceMinor: 2_000,
        amountMinor: 9_000,
        cashAmountMinor: 9_000
      }
    });

    await expect(prisma.investmentPosition.count({ where: { userId: user.id } })).resolves.toBe(0);

    const report = await getInvestmentReport(user.id);
    const projection = await prisma.investmentPosition.findUnique({
      where: { userId_accountId_assetId: { userId: user.id, accountId: account.id, assetId: asset.id } }
    });
    const refreshedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(report.positions).toHaveLength(1);
    expect(projection?.quantity.toString()).toBe("4.5");
    expect(projection?.costBasisMinor).toBe(9_000);
    expect(refreshedUser.investmentProjectionVersion).toBe(2);
    const transactionResult = await prisma.investmentTransactionResult.findFirstOrThrow({
      where: { userId: user.id }
    });
    expect(transactionResult.realizedGainMinor).toBeNull();
  });

  it("updates only the affected investment position and rolls back invalid sells", async () => {
    const user = await createUser();
    const account = await createAccount(user.id, "projected-investments", 0, "investment");
    const asset = await prisma.asset.create({
      data: {
        id: integrationId("projected-asset"),
        userId: user.id,
        symbol: `PROJECTED-${randomUUID()}`,
        name: "Projected Asset",
        type: "stock",
        currency: "EUR"
      }
    });
    const firstBuy = await createInvestmentTransaction({
      userId: user.id,
      accountId: account.id,
      cashAccountId: null,
      assetId: asset.id,
      type: "buy",
      date: new Date("2026-02-01T00:00:00.000Z"),
      quantity: "2",
      priceMinor: 10_000,
      amountMinor: 20_000,
      cashAmountMinor: 20_000
    });
    expect(firstBuy.cashAccountId).toBe(account.id);
    const secondBuy = await createInvestmentTransaction({
      userId: user.id,
      accountId: account.id,
      cashAccountId: null,
      assetId: asset.id,
      type: "buy",
      date: new Date("2026-02-02T00:00:00.000Z"),
      quantity: "1",
      priceMinor: 15_000,
      amountMinor: 15_000,
      cashAmountMinor: 15_000
    });
    const sell = await createInvestmentTransaction({
      userId: user.id,
      accountId: account.id,
      cashAccountId: null,
      assetId: asset.id,
      type: "sell",
      date: new Date("2026-02-03T00:00:00.000Z"),
      quantity: "1",
      priceMinor: 20_000,
      amountMinor: 20_000,
      cashAmountMinor: 20_000
    });

    const pair = { userId_accountId_assetId: { userId: user.id, accountId: account.id, assetId: asset.id } };
    let projection = await prisma.investmentPosition.findUniqueOrThrow({ where: pair });

    expect(projection.quantity.toString()).toBe("2");
    expect(projection.costBasisMinor).toBe(23_333);
    expect(projection.realizedGainMinor).toBe(8_333);
    await expect(
      prisma.investmentTransactionResult.findUnique({ where: { transactionId: sell.id } })
    ).resolves.toMatchObject({ realizedGainMinor: 8_333 });
    await expect(
      getMonthlyCashBalanceHistory(
        user.id,
        new Date("2026-02-01T00:00:00.000Z"),
        new Date("2026-03-01T00:00:00.000Z")
      )
    ).resolves.toEqual([{ monthKey: "2026-02", cashBalanceMinor: -15_000 }]);

    const firstPage = await listInvestmentTransactionPage(user.id, 1, 2);
    const secondPage = await listInvestmentTransactionPage(user.id, 2, 2);

    expect(firstPage.totalCount).toBe(3);
    expect(firstPage.transactions).toHaveLength(2);
    expect(firstPage.transactions[0]).toMatchObject({ id: sell.id, realizedGainMinor: 8_333 });
    expect(firstPage.hasNextPage).toBe(true);
    expect(secondPage.transactions).toHaveLength(1);
    expect(secondPage.hasPreviousPage).toBe(true);

    await updateInvestmentTransaction({
      userId: user.id,
      investmentTransactionId: secondBuy.id,
      accountId: account.id,
      cashAccountId: null,
      assetId: asset.id,
      type: "buy",
      date: secondBuy.date,
      quantity: "1",
      priceMinor: 12_000,
      amountMinor: 12_000,
      cashAmountMinor: 12_000
    });

    projection = await prisma.investmentPosition.findUniqueOrThrow({ where: pair });
    expect(projection.costBasisMinor).toBe(21_333);
    expect(projection.realizedGainMinor).toBe(9_333);
    await expect(
      prisma.investmentTransactionResult.findUnique({ where: { transactionId: sell.id } })
    ).resolves.toMatchObject({ realizedGainMinor: 9_333 });

    await expect(
      createInvestmentTransaction({
        userId: user.id,
        accountId: account.id,
        cashAccountId: null,
        assetId: asset.id,
        type: "sell",
        date: new Date("2026-02-04T00:00:00.000Z"),
        quantity: "99",
        priceMinor: 1,
        amountMinor: 99,
        cashAmountMinor: 99
      })
    ).rejects.toThrow("Sell quantity cannot exceed current position quantity.");
    await expect(prisma.investmentTransaction.count({ where: { userId: user.id } })).resolves.toBe(3);

    await deleteInvestmentTransaction(user.id, sell.id);
    projection = await prisma.investmentPosition.findUniqueOrThrow({ where: pair });

    expect(projection.quantity.toString()).toBe("3");
    expect(projection.costBasisMinor).toBe(32_000);
    expect(projection.realizedGainMinor).toBe(0);
    await expect(
      prisma.investmentTransactionResult.findUnique({ where: { transactionId: sell.id } })
    ).resolves.toBeNull();
    await expect(prisma.investmentTransactionResult.count({ where: { userId: user.id } })).resolves.toBe(2);
    await expect(prisma.investmentTransaction.findUnique({ where: { id: firstBuy.id } })).resolves.not.toBeNull();
  });

  it("enforces transaction shape and tenant ownership inside PostgreSQL", async () => {
    const [user, otherUser] = await Promise.all([createUser(), createUser()]);
    const [account, destination, otherAccount] = await Promise.all([
      createAccount(user.id, "constraint-source", 10_000),
      createAccount(user.id, "constraint-destination", 5_000),
      createAccount(otherUser.id, "constraint-other", 5_000)
    ]);
    const [category, otherCategory] = await Promise.all([
      prisma.category.create({
        data: { id: integrationId("constraint-category"), userId: user.id, name: `Food ${randomUUID()}`, type: "expense" }
      }),
      prisma.category.create({
        data: {
          id: integrationId("constraint-other-category"),
          userId: otherUser.id,
          name: `Other food ${randomUUID()}`,
          type: "expense"
        }
      })
    ]);
    const baseTransaction = {
      userId: user.id,
      type: "expense" as const,
      date: new Date("2026-06-01T00:00:00.000Z"),
      amountMinor: 1_000,
      sourceAccountId: account.id,
      categoryId: category.id
    };

    await expect(
      prisma.transaction.create({ data: { ...baseTransaction, id: integrationId("zero-amount"), amountMinor: 0 } })
    ).rejects.toThrow();
    await expect(
      prisma.transaction.create({
        data: {
          ...baseTransaction,
          id: integrationId("income-with-destination"),
          type: "income",
          destinationAccountId: destination.id
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.transaction.create({
        data: {
          ...baseTransaction,
          id: integrationId("same-account-transfer"),
          type: "transfer",
          destinationAccountId: account.id,
          categoryId: null
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.transaction.create({
        data: { ...baseTransaction, id: integrationId("foreign-account"), sourceAccountId: otherAccount.id }
      })
    ).rejects.toThrow();
    await expect(
      prisma.transaction.create({
        data: { ...baseTransaction, id: integrationId("foreign-category"), categoryId: otherCategory.id }
      })
    ).rejects.toThrow();

    await prisma.transaction.create({
      data: {
        id: integrationId("valid-transfer"),
        userId: user.id,
        type: "transfer",
        date: new Date("2026-06-02T00:00:00.000Z"),
        amountMinor: 2_500,
        sourceAccountId: account.id,
        destinationAccountId: destination.id,
        categoryId: null
      }
    });

    await expect(prisma.transaction.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("serializes category type changes with dependent transaction creation", async () => {
    const user = await createUser();
    const account = await createAccount(user.id, "category-race-account", 0);
    const category = await prisma.category.create({
      data: {
        id: integrationId("category-race"),
        userId: user.id,
        name: `Category race ${randomUUID()}`,
        type: "both"
      }
    });
    const connectionA = new PrismaClient();
    const connectionB = new PrismaClient();
    const typeChangeReady = deferred();
    const releaseTypeChange = deferred();

    try {
      const typeChange = connectionB.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Category"
          WHERE "id" = ${category.id} AND "userId" = ${user.id}
          FOR UPDATE
        `;
        await tx.category.update({
          where: { id_userId: { id: category.id, userId: user.id } },
          data: { type: "income" }
        });
        typeChangeReady.resolve();
        await releaseTypeChange.promise;
      });

      await typeChangeReady.promise;
      const dependentWrite = connectionA.$transaction((tx) =>
        createTransaction(
          {
            userId: user.id,
            type: "expense",
            date: new Date("2026-07-01T00:00:00.000Z"),
            amountMinor: 1_000,
            sourceAccountId: account.id,
            categoryId: category.id,
            tagIds: []
          },
          tx
        )
      );
      releaseTypeChange.resolve();
      await typeChange;

      await expect(dependentWrite).rejects.toThrow("Category type must match the transaction type.");
      await expect(prisma.category.findUnique({ where: { id: category.id } })).resolves.toMatchObject({ type: "income" });
      await expect(prisma.transaction.count({ where: { userId: user.id, categoryId: category.id } })).resolves.toBe(0);
    } finally {
      releaseTypeChange.resolve();
      await Promise.allSettled([connectionA.$disconnect(), connectionB.$disconnect()]);
    }
  });

  it("serializes account type changes with dependent holding creation", async () => {
    const user = await createUser();
    const account = await createAccount(user.id, "account-race-investment", 0, "investment");
    const asset = await prisma.asset.create({
      data: {
        id: integrationId("account-race-asset"),
        userId: user.id,
        symbol: `RACE-${randomUUID()}`,
        name: "Account race asset",
        type: "stock",
        currency: "EUR"
      }
    });
    const connectionA = new PrismaClient();
    const connectionB = new PrismaClient();
    const typeChangeReady = deferred();
    const releaseTypeChange = deferred();

    try {
      const typeChange = connectionB.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Account"
          WHERE "id" = ${account.id} AND "userId" = ${user.id}
          FOR UPDATE
        `;
        await tx.account.update({
          where: { id_userId: { id: account.id, userId: user.id } },
          data: { type: "bank" }
        });
        typeChangeReady.resolve();
        await releaseTypeChange.promise;
      });

      await typeChangeReady.promise;
      const dependentWrite = connectionA.$transaction((tx) =>
        createHolding(
          {
            userId: user.id,
            accountId: account.id,
            assetId: asset.id,
            quantity: "1",
            averageCostMinor: 10_000
          },
          tx
        )
      );
      releaseTypeChange.resolve();
      await typeChange;

      await expect(dependentWrite).rejects.toThrow("Account must be an investment or crypto wallet account.");
      await expect(prisma.account.findUnique({ where: { id: account.id } })).resolves.toMatchObject({ type: "bank" });
      await expect(prisma.holding.count({ where: { userId: user.id, accountId: account.id } })).resolves.toBe(0);
    } finally {
      releaseTypeChange.resolve();
      await Promise.allSettled([connectionA.$disconnect(), connectionB.$disconnect()]);
    }
  });

  it("enforces budget, rule, recurring, and tag-link tenant integrity inside PostgreSQL", async () => {
    const [user, otherUser] = await Promise.all([createUser(), createUser()]);
    const [account, destination, otherAccount] = await Promise.all([
      createAccount(user.id, "remaining-source", 10_000),
      createAccount(user.id, "remaining-destination", 5_000),
      createAccount(otherUser.id, "remaining-other", 5_000)
    ]);
    const [category, otherCategory] = await Promise.all([
      prisma.category.create({
        data: { id: integrationId("remaining-category"), userId: user.id, name: `Remaining ${randomUUID()}`, type: "expense" }
      }),
      prisma.category.create({
        data: {
          id: integrationId("remaining-other-category"),
          userId: otherUser.id,
          name: `Remaining other ${randomUUID()}`,
          type: "expense"
        }
      })
    ]);
    const [tag, otherTag] = await Promise.all([
      prisma.tag.create({ data: { id: integrationId("remaining-tag"), userId: user.id, name: `remaining-${randomUUID()}` } }),
      prisma.tag.create({
        data: { id: integrationId("remaining-other-tag"), userId: otherUser.id, name: `remaining-other-${randomUUID()}` }
      })
    ]);
    const transaction = await prisma.transaction.create({
      data: {
        id: integrationId("remaining-transaction"),
        userId: user.id,
        type: "expense",
        date: new Date("2026-05-01T00:00:00.000Z"),
        amountMinor: 1_000,
        sourceAccountId: account.id,
        categoryId: category.id
      }
    });
    const rule = await prisma.rule.create({
      data: {
        id: integrationId("remaining-rule"),
        userId: user.id,
        categoryId: category.id,
        name: `Remaining rule ${randomUUID()}`,
        matchText: "remaining"
      }
    });

    await expect(
      prisma.budget.create({
        data: {
          id: integrationId("foreign-budget-category"),
          userId: user.id,
          categoryId: otherCategory.id,
          month: new Date("2026-05-01T00:00:00.000Z"),
          amountMinor: 10_000
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.budget.create({
        data: {
          id: integrationId("zero-budget"),
          userId: user.id,
          categoryId: category.id,
          month: new Date("2026-05-01T00:00:00.000Z"),
          amountMinor: 0
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.rule.create({
        data: {
          id: integrationId("foreign-rule-category"),
          userId: user.id,
          categoryId: otherCategory.id,
          name: `Foreign rule ${randomUUID()}`,
          matchText: "foreign"
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.category.update({
        where: { id: category.id },
        data: { parentId: otherCategory.id }
      })
    ).rejects.toThrow();
    await expect(
      prisma.recurringTransaction.create({
        data: {
          id: integrationId("foreign-recurring-source"),
          userId: user.id,
          name: `Foreign recurring ${randomUUID()}`,
          type: "expense",
          amountMinor: 1_000,
          sourceAccountId: otherAccount.id,
          categoryId: category.id,
          nextDate: new Date("2026-06-01T00:00:00.000Z")
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.recurringTransaction.create({
        data: {
          id: integrationId("foreign-recurring-category"),
          userId: user.id,
          name: `Foreign category recurring ${randomUUID()}`,
          type: "expense",
          amountMinor: 1_000,
          sourceAccountId: account.id,
          categoryId: otherCategory.id,
          nextDate: new Date("2026-06-01T00:00:00.000Z")
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.recurringTransaction.create({
        data: {
          id: integrationId("invalid-recurring-transfer"),
          userId: user.id,
          name: `Invalid transfer ${randomUUID()}`,
          type: "transfer",
          amountMinor: 1_000,
          sourceAccountId: account.id,
          destinationAccountId: account.id,
          nextDate: new Date("2026-06-01T00:00:00.000Z")
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.recurringTransaction.create({
        data: {
          id: integrationId("zero-recurring"),
          userId: user.id,
          name: `Zero recurring ${randomUUID()}`,
          type: "transfer",
          amountMinor: 0,
          sourceAccountId: account.id,
          destinationAccountId: destination.id,
          nextDate: new Date("2026-06-01T00:00:00.000Z")
        }
      })
    ).rejects.toThrow();
    await expect(
      prisma.transactionTag.create({
        data: { transactionId: transaction.id, tagId: otherTag.id, userId: user.id }
      })
    ).rejects.toThrow();
    await expect(
      prisma.ruleTag.create({
        data: { ruleId: rule.id, tagId: otherTag.id, userId: user.id }
      })
    ).rejects.toThrow();

    await prisma.transactionTag.create({ data: { transactionId: transaction.id, tagId: tag.id, userId: user.id } });
    await prisma.ruleTag.create({ data: { ruleId: rule.id, tagId: tag.id, userId: user.id } });
    await prisma.budget.create({
      data: {
        id: integrationId("valid-budget"),
        userId: user.id,
        categoryId: category.id,
        month: new Date("2026-05-01T00:00:00.000Z"),
        amountMinor: 10_000
      }
    });
    await prisma.recurringTransaction.create({
      data: {
        id: integrationId("valid-recurring"),
        userId: user.id,
        name: `Valid recurring ${randomUUID()}`,
        type: "transfer",
        amountMinor: 1_000,
        sourceAccountId: account.id,
        destinationAccountId: destination.id,
        nextDate: new Date("2026-06-01T00:00:00.000Z")
      }
    });

    await expect(prisma.transactionTag.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(prisma.ruleTag.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(prisma.budget.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(prisma.recurringTransaction.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("persists income, expenses, and transfers and rejects another user's account", async () => {
    const [user, otherUser] = await Promise.all([createUser(), createUser()]);
    const [checking, savings, otherAccount] = await Promise.all([
      createAccount(user.id, "checking", 10_000),
      createAccount(user.id, "savings", 2_000),
      createAccount(otherUser.id, "other", 90_000)
    ]);
    const salary = await prisma.category.create({
      data: { id: integrationId("salary"), userId: user.id, name: `Salary ${randomUUID()}`, type: "income" }
    });
    const food = await prisma.category.create({
      data: { id: integrationId("food"), userId: user.id, name: `Food ${randomUUID()}`, type: "expense" }
    });
    const recurring = await prisma.tag.create({
      data: { id: integrationId("tag"), userId: user.id, name: `recurring-${randomUUID()}` }
    });

    await createTransaction({
      userId: user.id,
      type: "income",
      date: new Date("2026-06-01T00:00:00.000Z"),
      amountMinor: 500_000,
      sourceAccountId: checking.id,
      categoryId: salary.id,
      tagIds: []
    });
    await createTransaction({
      userId: user.id,
      type: "expense",
      date: new Date("2026-06-02T00:00:00.000Z"),
      amountMinor: 125_000,
      sourceAccountId: checking.id,
      categoryId: food.id,
      tagIds: [recurring.id]
    });
    await createTransaction({
      userId: user.id,
      type: "expense",
      date: new Date("2026-06-03T00:00:00.000Z"),
      amountMinor: 4_500,
      sourceAccountId: checking.id,
      categoryId: food.id,
      tagIds: []
    });
    await createTransaction({
      userId: user.id,
      type: "transfer",
      date: new Date("2026-06-04T00:00:00.000Z"),
      amountMinor: 10_000,
      sourceAccountId: checking.id,
      destinationAccountId: savings.id,
      tagIds: []
    });

    await expect(
      createTransaction({
        userId: user.id,
        type: "expense",
        date: new Date("2026-06-05T00:00:00.000Z"),
        amountMinor: 1_000,
        sourceAccountId: otherAccount.id,
        categoryId: food.id,
        tagIds: []
      })
    ).rejects.toThrow("Choose valid accounts.");

    const from = new Date("2026-06-01T00:00:00.000Z");
    const to = new Date("2026-07-01T00:00:00.000Z");
    const [balances, cashflow, cashBalanceHistory, accountBalanceHistory, categories, monthlyCategories, tags] = await Promise.all([
      getAccountBalanceMap(user.id),
      getMonthlyCashflowTotals(user.id, from, to),
      getMonthlyCashBalanceHistory(user.id, from, to),
      getMonthlyAccountBalanceHistory(user.id, from, to),
      getExpenseTotalsByCategory(user.id, from, to),
      getMonthlyExpenseTotalsByCategory(user.id, from, to),
      getExpenseTotalsByTag(user.id, from, to)
    ]);

    expect(balances.get(checking.id)).toBe(370_500);
    expect(balances.get(savings.id)).toBe(12_000);
    expect(cashflow).toEqual([
      {
        monthKey: "2026-06",
        incomeMinor: 500_000,
        expensesMinor: 129_500,
        netCashflowMinor: 370_500
      }
    ]);
    expect(cashBalanceHistory).toEqual([{ monthKey: "2026-06", cashBalanceMinor: 382_500 }]);
    expect(accountBalanceHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ monthKey: "2026-06", accountId: checking.id, balanceMinor: 370_500 }),
        expect.objectContaining({ monthKey: "2026-06", accountId: savings.id, balanceMinor: 12_000 })
      ])
    );
    expect(categories).toEqual([
      { id: food.id, name: food.name, color: null, icon: null, amountMinor: 129_500 }
    ]);
    expect(monthlyCategories).toEqual([
      {
        monthKey: "2026-06",
        categoryId: food.id,
        categoryName: food.name,
        categoryColor: null,
        categoryIcon: null,
        amountMinor: 129_500
      }
    ]);
    expect(tags).toEqual([
      { id: recurring.id, name: recurring.name, amountMinor: 125_000 },
      { id: null, name: "Untagged", amountMinor: 4_500 }
    ]);
    await expect(prisma.transaction.count({ where: { userId: user.id } })).resolves.toBe(4);
  });

  it("rolls back destructive restore work when an imported record fails", async () => {
    const user = await createUser();
    const account = await createAccount(user.id, "original", 25_000);
    const backup = await buildUserBackup(user.id);
    const invalidBackup = structuredClone(backup) as unknown as {
      accounts: Array<Record<string, unknown>>;
    };
    invalidBackup.accounts[0].type = "invalid_account_type";

    await expect(restoreUserBackup(user.id, JSON.stringify(invalidBackup))).rejects.toThrow();

    await expect(
      prisma.account.findMany({ where: { userId: user.id }, select: { id: true, openingBalanceMinor: true } })
    ).resolves.toEqual([{ id: account.id, openingBalanceMinor: 25_000 }]);
  });

  it("round-trips every supported user-owned record and rebuilds derived investment data", async () => {
    const user = await createUser();
    const checking = await createAccount(user.id, "backup-checking", 250_000);
    const savings = await createAccount(user.id, "backup-savings", 50_000);
    const investmentAccount = await createAccount(user.id, "backup-investment", 0, "investment");
    const parentCategory = await prisma.category.create({
      data: {
        id: integrationId("backup-parent-category"),
        userId: user.id,
        name: `Living ${randomUUID()}`,
        type: "expense",
        color: "#334455",
        icon: "home"
      }
    });
    const category = await prisma.category.create({
      data: {
        id: integrationId("backup-category"),
        userId: user.id,
        parentId: parentCategory.id,
        name: `Food ${randomUUID()}`,
        type: "expense",
        color: "#556677",
        icon: "utensils"
      }
    });
    const tag = await prisma.tag.create({
      data: {
        id: integrationId("backup-tag"),
        userId: user.id,
        name: `recurring-${randomUUID()}`,
        color: "#778899"
      }
    });
    const transaction = await prisma.transaction.create({
      data: {
        id: integrationId("backup-transaction"),
        userId: user.id,
        type: "expense",
        date: new Date("2026-04-02T00:00:00.000Z"),
        amountMinor: 12_345,
        sourceAccountId: checking.id,
        categoryId: category.id,
        description: "Backup groceries",
        notes: "Round-trip transaction",
        tags: { create: { tagId: tag.id } }
      }
    });
    await prisma.transaction.create({
      data: {
        id: integrationId("backup-transfer"),
        userId: user.id,
        type: "transfer",
        date: new Date("2026-04-03T00:00:00.000Z"),
        amountMinor: 20_000,
        sourceAccountId: checking.id,
        destinationAccountId: savings.id,
        description: "Backup transfer"
      }
    });
    await prisma.budget.create({
      data: {
        id: integrationId("backup-budget"),
        userId: user.id,
        categoryId: category.id,
        month: new Date("2026-04-01T00:00:00.000Z"),
        amountMinor: 40_000
      }
    });
    await prisma.rule.create({
      data: {
        id: integrationId("backup-rule"),
        userId: user.id,
        categoryId: category.id,
        name: `Groceries ${randomUUID()}`,
        matchText: "market",
        priority: 10,
        isActive: true,
        tags: { create: { tagId: tag.id } }
      }
    });
    await prisma.recurringTransaction.create({
      data: {
        id: integrationId("backup-recurring"),
        userId: user.id,
        name: `Monthly groceries ${randomUUID()}`,
        type: "expense",
        amountMinor: 25_000,
        sourceAccountId: checking.id,
        categoryId: category.id,
        description: "Planned groceries",
        notes: "Confirm manually",
        frequency: "monthly",
        nextDate: new Date("2026-05-01T00:00:00.000Z"),
        isActive: true
      }
    });
    const asset = await prisma.asset.create({
      data: {
        id: integrationId("backup-asset"),
        userId: user.id,
        symbol: `BACKUP-${randomUUID()}`,
        name: "Backup ETF",
        type: "etf",
        currency: "EUR"
      }
    });
    const assetPrice = await prisma.assetPrice.create({
      data: {
        id: integrationId("backup-price"),
        userId: user.id,
        assetId: asset.id,
        date: new Date("2026-04-04T00:00:00.000Z"),
        priceMinor: 12_500
      }
    });
    await prisma.holding.create({
      data: {
        id: integrationId("backup-holding"),
        userId: user.id,
        accountId: investmentAccount.id,
        assetId: asset.id,
        quantity: "0.5",
        averageCostMinor: 11_000,
        notes: "Manual adjustment"
      }
    });
    await prisma.investmentTransaction.create({
      data: {
        id: integrationId("backup-investment-transaction"),
        userId: user.id,
        accountId: investmentAccount.id,
        cashAccountId: checking.id,
        assetId: asset.id,
        type: "buy",
        date: new Date("2026-04-05T00:00:00.000Z"),
        quantity: "2",
        priceMinor: 12_000,
        amountMinor: 24_000,
        cashAmountMinor: 24_050,
        notes: "Includes broker cash difference"
      }
    });

    await getInvestmentReport(user.id);
    await expect(prisma.investmentPosition.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(prisma.investmentTransactionResult.count({ where: { userId: user.id } })).resolves.toBe(1);

    const originalBackup = await buildUserBackup(user.id);
    const originalSnapshot = backupDomainSnapshot(originalBackup);

    await prisma.account.update({ where: { id: checking.id }, data: { name: `Mutated ${randomUUID()}` } });
    await prisma.transaction.delete({ where: { id: transaction.id } });
    await prisma.assetPrice.update({ where: { id: assetPrice.id }, data: { priceMinor: 99_999 } });
    await prisma.tag.create({
      data: { id: integrationId("backup-extra-tag"), userId: user.id, name: `extra-${randomUUID()}` }
    });

    const preview = await restoreUserBackup(user.id, JSON.stringify(originalBackup));
    const restoredBackup = await buildUserBackup(user.id);
    const restoredUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(preview).toMatchObject({
      accountCount: 3,
      categoryCount: 2,
      tagCount: 1,
      transactionCount: 2,
      budgetCount: 1,
      ruleCount: 1,
      recurringCount: 1,
      assetCount: 1,
      assetPriceCount: 1,
      holdingCount: 1,
      investmentTransactionCount: 1
    });
    expect(backupDomainSnapshot(restoredBackup)).toEqual(originalSnapshot);
    expect(restoredUser.investmentProjectionVersion).toBe(0);
    await expect(prisma.investmentPosition.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.investmentTransactionResult.count({ where: { userId: user.id } })).resolves.toBe(0);

    const report = await getInvestmentReport(user.id);
    const rebuiltUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(report.positions).toHaveLength(2);
    expect(rebuiltUser.investmentProjectionVersion).toBe(2);
    await expect(prisma.investmentPosition.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(prisma.investmentTransactionResult.count({ where: { userId: user.id } })).resolves.toBe(1);
  });
});

describe("Password recovery", () => {
  it("replaces the stored password and increments the session version", async () => {
    const oldPassword = "old-integration-password-2026";
    const newPassword = "new-integration-password-2026";
    const user = await createUser(oldPassword);

    await resetUserPasswordByEmail(user.email, newPassword);

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    await expect(verifyPassword(oldPassword, updatedUser.passwordHash)).resolves.toBe(false);
    await expect(verifyPassword(newPassword, updatedUser.passwordHash)).resolves.toBe(true);
    expect(updatedUser.sessionVersion).toBe(user.sessionVersion + 1);
  });
});

describe("Fastify authentication boundary", () => {
  it("quickly creates user-owned taxonomy with CSRF, localized errors, and duplicate protection", async () => {
    const password = "quick-taxonomy-integration-2026";
    const [user, otherUser] = await Promise.all([createUser(password), createUser()]);
    await prisma.user.update({ where: { id: user.id }, data: { language: "it" } });
    const account = await createAccount(user.id, "quick-taxonomy", 10_000);
    const parent = await prisma.category.create({ data: { userId: user.id, name: "Household", type: "expense" } });
    const foreignParent = await prisma.category.create({ data: { userId: otherUser.id, name: "Household", type: "expense" } });

    const loginPage = await app.inject({ method: "GET", url: "/login" });
    const csrfCookie = responseCookie(loginPage, "pennyworth_csrf");
    const csrfToken = loginPage.body.match(/name="csrfToken" value="([^"]+)"/)?.[1] ?? "";
    const login = await app.inject({ method: "POST", url: "/login", headers: { cookie: csrfCookie, "content-type": "application/x-www-form-urlencoded" }, payload: new URLSearchParams({ csrfToken, email: user.email, password }).toString() });
    const cookie = `${csrfCookie}; ${responseCookie(login, sessionCookieName)}`;
    const post = (url: string, values: Record<string, string>, token = csrfToken, cookies = cookie) => app.inject({
      method: "POST", url, headers: { cookie: cookies, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ csrfToken: token, ...values }).toString()
    });

    for (const url of ["/categories/quick", "/tags/quick"]) {
      expect((await post(url, { name: "Denied", type: "expense" }, "")).statusCode).toBe(403);
      expect((await post(url, { name: "Denied", type: "expense" }, "incorrect")).statusCode).toBe(403);
      const anonymous = await post(url, { name: "Denied", type: "expense" }, csrfToken, csrfCookie);
      expect(anonymous.statusCode).toBe(302);
      expect(anonymous.headers.location).toBe("/login");
    }
    const invalidParent = await post("/categories/quick", { name: "Food", type: "expense", parentId: foreignParent.id });
    expect(invalidParent.statusCode).toBe(400);
    expect(invalidParent.json()).toEqual({ error: "Scegli una categoria principale valida." });
    expect((await post("/categories/quick", { name: "Food", type: "transfer" })).statusCode).toBe(400);
    expect((await post("/categories/quick", { name: "Food", type: "expense", color: "red" })).statusCode).toBe(400);
    expect((await post("/categories/quick", { name: "Food", type: "expense", icon: "<svg>" })).statusCode).toBe(400);
    const emptyTag = await post("/tags/quick", { name: "  " });
    expect(emptyTag.statusCode).toBe(400);
    expect(emptyTag.json()).toEqual({ error: "Il nome dell'etichetta è obbligatorio." });

    const categoryName = "Food <img src=x> $&";
    const createdCategory = await post("/categories/quick", {
      name: ` ${categoryName} `, type: "expense", parentId: parent.id, color: "#AABBCC", icon: "food", userId: otherUser.id
    });
    expect(createdCategory.statusCode).toBe(201);
    expect(createdCategory.headers["content-type"]).toContain("application/json");
    const category = createdCategory.json().category as { id: string; name: string; type: string };
    expect(Object.keys(category).sort()).toEqual(["id", "name", "type"]);
    expect(category).toMatchObject({ name: categoryName, type: "expense" });
    await expect(prisma.category.findUnique({ where: { id: category.id } })).resolves.toMatchObject({
      userId: user.id, parentId: parent.id, color: "#aabbcc", icon: "food"
    });
    const duplicateCategory = await post("/categories/quick", { name: categoryName, type: "expense" });
    expect(duplicateCategory.statusCode).toBe(409);
    expect(duplicateCategory.json()).toEqual({ error: "Esiste già una categoria con questo nome.", existing: category });

    const concurrentTags = await Promise.all([
      post("/tags/quick", { name: "travel", color: "#123456", userId: otherUser.id }),
      post("/tags/quick", { name: "travel", color: "#123456", userId: otherUser.id })
    ]);
    expect(concurrentTags.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    const tag = concurrentTags.find((response) => response.statusCode === 201)!.json().tag as { id: string; name: string };
    expect(Object.keys(tag).sort()).toEqual(["id", "name"]);
    expect(concurrentTags.find((response) => response.statusCode === 409)!.json()).toEqual({
      error: "Esiste già un'etichetta con questo nome.", existing: tag
    });
    await expect(prisma.tag.count({ where: { userId: user.id, name: "travel" } })).resolves.toBe(1);
    await expect(prisma.tag.count({ where: { userId: otherUser.id } })).resolves.toBe(0);
    await prisma.tag.create({ data: { userId: otherUser.id, name: "travel" } });

    await createRule({ userId: user.id, name: "Merchant", matchText: "merchant", categoryId: parent.id, tagIds: [], isActive: true });
    const transactionResponse = await post("/transactions", {
      type: "expense", date: "2026-10-05", amount: "12.34", sourceAccountId: account.id,
      categoryId: category.id, tagIds: tag.id, description: "Merchant quick entry"
    });
    expect(transactionResponse.statusCode).toBe(302);
    const transaction = await prisma.transaction.findFirst({ where: { userId: user.id }, include: { tags: true } });
    expect(transaction).toMatchObject({ categoryId: category.id, amountMinor: 1234 });
    expect(transaction?.tags.map((item) => item.tagId)).toEqual([tag.id]);
    const page = await app.inject({ method: "GET", url: "/transactions", headers: { cookie } });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Food &lt;img src=x&gt; $&amp;");
    expect(page.body).toContain("Dettagli facoltativi");
    expect(page.body).not.toContain("Food <img src=x>");

    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
    const passwordRequired = await post("/tags/quick", { name: "Denied" });
    expect(passwordRequired.statusCode).toBe(302);
    expect(passwordRequired.headers.location).toBe("/settings/security?required=1");
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false, sessionVersion: { increment: 1 } } });
    expect((await post("/tags/quick", { name: "Denied" })).headers.location).toBe("/login");
    await expect(prisma.tag.count({ where: { name: "Denied", userId: user.id } })).resolves.toBe(0);
  });

  it("recovers quick taxonomy after a discarded creation response without duplicating or overwriting records", async () => {
    const password = "lost-response-integration-2026";
    // Keep this scenario independent of other tests' per-IP login rate limit.
    const remoteAddress = "127.0.0.2";
    const [user, otherUser] = await Promise.all([createUser(password), createUser()]);
    const loginPage = await app.inject({ method: "GET", url: "/login", remoteAddress });
    const csrfCookie = responseCookie(loginPage, "pennyworth_csrf");
    const csrfToken = loginPage.body.match(/name="csrfToken" value="([^"]+)"/)?.[1] ?? "";
    const login = await app.inject({ method: "POST", url: "/login", remoteAddress, headers: { cookie: csrfCookie, "content-type": "application/x-www-form-urlencoded" }, payload: new URLSearchParams({ csrfToken, email: user.email, password }).toString() });
    expect(login.statusCode).toBe(302);
    const cookie = `${csrfCookie}; ${responseCookie(login, sessionCookieName)}`;
    const post = (url: string, values: Record<string, string>) => app.inject({
      method: "POST", url, remoteAddress, headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ csrfToken, ...values }).toString()
    });

    const name = "Interrupted <literal> creation";
    const parent = await prisma.category.create({ data: { userId: user.id, name: "Parent", type: "expense" } });
    const foreignCategory = await prisma.category.create({ data: { userId: otherUser.id, name, type: "income" } });
    const foreignTag = await prisma.tag.create({ data: { userId: otherUser.id, name } });
    // Deliberately discard both successful responses: the browser never learns their IDs.
    expect((await post("/categories/quick", { name, type: "expense", parentId: parent.id, icon: "food", color: "#123456" })).statusCode).toBe(201);
    expect((await post("/tags/quick", { name, color: "#123456" })).statusCode).toBe(201);
    const category = await prisma.category.findUniqueOrThrow({ where: { userId_name: { userId: user.id, name } } });
    const tag = await prisma.tag.findUniqueOrThrow({ where: { userId_name: { userId: user.id, name } } });

    // Retrying with different details offers the saved record, without equating or updating it.
    const categoryRetry = await post("/categories/quick", { name: ` ${name} `, type: "income", icon: "other", color: "#abcdef", userId: otherUser.id });
    expect(categoryRetry.statusCode).toBe(409);
    expect(categoryRetry.json()).toEqual({ error: "A category with that name already exists.", existing: { id: category.id, name, type: "expense" } });
    expect(categoryRetry.json().existing.id).not.toBe(foreignCategory.id);
    const tagRetry = await post("/tags/quick", { name: ` ${name} `, color: "#abcdef", userId: otherUser.id });
    expect(tagRetry.statusCode).toBe(409);
    expect(tagRetry.json()).toEqual({ error: "A tag with that name already exists.", existing: { id: tag.id, name } });
    expect(tagRetry.json().existing.id).not.toBe(foreignTag.id);
    await expect(prisma.category.findUnique({ where: { id: category.id } })).resolves.toEqual(category);
    await expect(prisma.tag.findUnique({ where: { id: tag.id } })).resolves.toEqual(tag);
    await expect(prisma.category.count({ where: { userId: user.id, name } })).resolves.toBe(1);
    await expect(prisma.tag.count({ where: { userId: user.id, name } })).resolves.toBe(1);
  });

  it("switches user-owned rules from the list without changing settings or saved transactions", async () => {
    const password = "rule-activation-integration-2026";
    const [user, otherUser] = await Promise.all([createUser(password), createUser()]);
    const account = await createAccount(user.id, "rule-activation", 10_000);
    const [category, otherCategory] = await Promise.all([
      prisma.category.create({ data: { userId: user.id, name: "Subscriptions", type: "expense" } }),
      prisma.category.create({ data: { userId: otherUser.id, name: "Other subscriptions", type: "expense" } })
    ]);
    const tag = await prisma.tag.create({ data: { userId: user.id, name: "Subscription" } });
    const rule = await createRule({ userId: user.id, name: "Streaming", matchText: "netflix, spotify", categoryId: category.id, tagIds: [tag.id], isActive: true });
    const otherRule = await createRule({ userId: otherUser.id, name: "Private", matchText: "netflix", categoryId: otherCategory.id, tagIds: [], isActive: true });
    const original = await prisma.rule.findUniqueOrThrow({ where: { id: rule.id }, include: { tags: true } });

    const loginPage = await app.inject({ method: "GET", url: "/login" });
    const csrfCookie = responseCookie(loginPage, "pennyworth_csrf");
    const csrfToken = loginPage.body.match(/name="csrfToken" value="([^"]+)"/)?.[1] ?? "";
    const login = await app.inject({ method: "POST", url: "/login", headers: { cookie: csrfCookie, "content-type": "application/x-www-form-urlencoded" }, payload: new URLSearchParams({ csrfToken, email: user.email, password }).toString() });
    expect(login.statusCode).toBe(302);
    const cookie = `${csrfCookie}; ${responseCookie(login, sessionCookieName)}`;
    const postState = (ruleId: string, isActive: string, token = csrfToken) => app.inject({
      method: "POST", url: `/rules/${ruleId}/active`,
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ csrfToken: token, isActive }).toString()
    });

    expect((await postState(rule.id, "false", "invalid-token")).statusCode).toBe(403);
    expect((await postState(rule.id, "invalid")).statusCode).toBe(400);
    expect((await postState(otherRule.id, "false")).statusCode).toBe(404);
    await expect(prisma.rule.findUnique({ where: { id: otherRule.id } })).resolves.toMatchObject({ isActive: true });
    await expect(prisma.rule.findUnique({ where: { id: rule.id } })).resolves.toMatchObject({ isActive: true });

    const disabled = await postState(rule.id, "false");
    expect(disabled.statusCode).toBe(302);
    expect(disabled.headers.location).toBe("/rules");
    expect((await postState(rule.id, "false")).statusCode).toBe(302);
    const afterDisable = await prisma.rule.findUniqueOrThrow({ where: { id: rule.id }, include: { tags: true } });
    expect({ ...afterDisable, updatedAt: original.updatedAt }).toEqual({ ...original, isActive: false });
    const disabledList = await app.inject({ method: "GET", url: "/rules", headers: { cookie } });
    expect(disabledList.body).toContain('aria-label="Enable rule: Streaming"');

    const entry = { userId: user.id, type: "expense" as const, date: new Date("2026-10-02T00:00:00.000Z"), amountMinor: 1000, sourceAccountId: account.id, description: "NETFLIX", tagIds: [] };
    const unmatched = await createTransaction(entry);
    expect(unmatched.categoryId).toBeNull();
    expect(await previewRuleApplications(user.id)).toEqual([]);

    expect((await postState(rule.id, "true")).statusCode).toBe(302);
    expect((await postState(rule.id, "true")).statusCode).toBe(302);
    const afterEnable = await prisma.rule.findUniqueOrThrow({ where: { id: rule.id }, include: { tags: true } });
    expect({ ...afterEnable, updatedAt: original.updatedAt }).toEqual(original);
    const enabledList = await app.inject({ method: "GET", url: "/rules", headers: { cookie } });
    expect(enabledList.body).toContain('aria-label="Disable rule: Streaming"');
    await expect(prisma.transaction.findUnique({ where: { id: unmatched.id } })).resolves.toMatchObject({ categoryId: null });
    await expect(prisma.transactionTag.count({ where: { transactionId: unmatched.id } })).resolves.toBe(0);
    const matched = await createTransaction(entry);
    expect(matched.categoryId).toBe(category.id);
    await expect(prisma.transactionTag.findMany({ where: { transactionId: matched.id } })).resolves.toMatchObject([{ tagId: tag.id }]);
    expect((await previewRuleApplications(user.id)).map((application) => application.transaction.id)).toEqual([unmatched.id]);
  });

  it("requires CSRF for login and accepts a signed authenticated session", async () => {
    const password = "integration-password-2026";
    const user = await createUser(password);
    const account = await createAccount(user.id, "route-checking", 10_000);
    const category = await prisma.category.create({
      data: {
        id: integrationId("route-category"),
        userId: user.id,
        name: `Route food ${randomUUID()}`,
        type: "expense"
      }
    });
    const unauthenticated = await app.inject({ method: "GET", url: "/" });

    expect(unauthenticated.statusCode).toBe(302);
    expect(unauthenticated.headers.location).toBe("/login");

    const loginPage = await app.inject({ method: "GET", url: "/login" });
    const csrfCookie = responseCookie(loginPage, "pennyworth_csrf");
    const csrfToken = loginPage.body.match(/name="csrfToken" value="([^"]+)"/)?.[1];

    expect(loginPage.statusCode).toBe(200);
    expect(csrfToken).toBeTruthy();

    const rejectedLogin = await app.inject({
      method: "POST",
      url: "/login",
      headers: {
        cookie: csrfCookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({
        csrfToken: "incorrect-token",
        email: user.email,
        password
      }).toString()
    });

    expect(rejectedLogin.statusCode).toBe(403);

    const acceptedLogin = await app.inject({
      method: "POST",
      url: "/login",
      headers: {
        cookie: csrfCookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({
        csrfToken: csrfToken ?? "",
        email: user.email,
        password
      }).toString()
    });
    const sessionCookie = responseCookie(acceptedLogin, sessionCookieName);

    expect(acceptedLogin.statusCode).toBe(302);
    expect(acceptedLogin.headers.location).toBe("/");

    const dashboard = await app.inject({
      method: "GET",
      url: "/",
      headers: { cookie: `${csrfCookie}; ${sessionCookie}` }
    });

    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.body).toContain("Dashboard");

    const authenticatedCookie = `${csrfCookie}; ${sessionCookie}`;
    const transactionsPage = await app.inject({
      method: "GET",
      url: "/transactions",
      headers: { cookie: authenticatedCookie }
    });
    const importPage = await app.inject({
      method: "GET",
      url: "/transactions/import",
      headers: { cookie: authenticatedCookie }
    });

    expect(transactionsPage.statusCode).toBe(200);
    expect(importPage.statusCode).toBe(200);

    const createResponse = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: {
        cookie: authenticatedCookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({
        csrfToken: csrfToken ?? "",
        type: "expense",
        date: "2026-06-15",
        amount: "12.34",
        sourceAccountId: account.id,
        categoryId: category.id,
        description: "Route integration expense"
      }).toString()
    });
    const transaction = await prisma.transaction.findFirst({
      where: { userId: user.id, description: "Route integration expense" }
    });

    expect(createResponse.statusCode).toBe(302);
    expect(createResponse.headers.location).toBe("/transactions");
    expect(transaction?.amountMinor).toBe(1_234);

    if (!transaction) {
      throw new Error("Transaction route did not persist the expense.");
    }

    const [editPage, exportResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: `/transactions/${transaction.id}/edit`,
        headers: { cookie: authenticatedCookie }
      }),
      app.inject({
        method: "GET",
        url: "/transactions/export.csv",
        headers: { cookie: authenticatedCookie }
      })
    ]);

    expect(editPage.statusCode).toBe(200);
    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
    expect(exportResponse.body).toContain("Route integration expense");

    const importCsv = [
      "date,type,amount_minor,account,category,description",
      `2026-06-16,expense,789,${account.name},${category.name},Imported route expense`
    ].join("\n");
    const importPreview = await app.inject({
      method: "POST",
      url: "/transactions/import/preview",
      headers: {
        cookie: authenticatedCookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({ csrfToken: csrfToken ?? "", mappedCsvText: importCsv }).toString()
    });
    const importBatchId = importPreview.body.match(/name="importBatchId" value="([^"]+)"/)?.[1];

    expect(importBatchId).toBeTruthy();

    const importConfirm = await app.inject({
      method: "POST",
      url: "/transactions/import/confirm",
      headers: {
        cookie: authenticatedCookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({ csrfToken: csrfToken ?? "", csvText: importCsv, importBatchId: importBatchId ?? "" }).toString()
    });
    const importRetry = await app.inject({
      method: "POST",
      url: "/transactions/import/confirm",
      headers: {
        cookie: authenticatedCookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({ csrfToken: csrfToken ?? "", csvText: importCsv, importBatchId: importBatchId ?? "" }).toString()
    });

    expect(importPreview.statusCode).toBe(200);
    expect(importPreview.body).toContain("Imported route expense");
    expect(importConfirm.statusCode).toBe(302);
    expect(importRetry.statusCode).toBe(302);
    await expect(
      prisma.transaction.count({ where: { userId: user.id, description: "Imported route expense" } })
    ).resolves.toBe(1);

    const deleteResponse = await app.inject({
      method: "POST",
      url: `/transactions/${transaction.id}/delete`,
      headers: {
        cookie: authenticatedCookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({ csrfToken: csrfToken ?? "" }).toString()
    });

    expect(deleteResponse.statusCode).toBe(302);
    await expect(
      prisma.transaction.count({ where: { userId: user.id, description: "Route integration expense" } })
    ).resolves.toBe(0);
  });
});

describe("Administrator-managed users", () => {
  it("provisions an isolated member, requires a password change, and can revoke access", async () => {
    const adminPassword = "integration-admin-password-2026";
    const existingMemberPassword = "integration-member-password-2026";
    const replacementPassword = "replacement-member-password-2026";
    const [administrator, existingMember] = await Promise.all([
      createUser(adminPassword),
      createUser(existingMemberPassword)
    ]);
    await prisma.user.update({ where: { id: administrator.id }, data: { role: "admin" } });

    const memberLoginPage = await app.inject({ method: "GET", url: "/login" });
    const memberCsrfCookie = responseCookie(memberLoginPage, "pennyworth_csrf");
    const memberCsrfToken = memberLoginPage.body.match(/name="csrfToken" value="([^"]+)"/)?.[1] ?? "";
    const memberLogin = await app.inject({
      method: "POST",
      url: "/login",
      headers: { cookie: memberCsrfCookie, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        csrfToken: memberCsrfToken,
        email: existingMember.email,
        password: existingMemberPassword
      }).toString()
    });
    const memberSessionCookie = responseCookie(memberLogin, sessionCookieName);
    const forbiddenUsersPage = await app.inject({
      method: "GET",
      url: "/settings/users",
      headers: { cookie: `${memberCsrfCookie}; ${memberSessionCookie}` }
    });

    expect(forbiddenUsersPage.statusCode).toBe(403);

    const forbiddenApplicationPage = await app.inject({
      method: "GET",
      url: "/settings/application",
      headers: { cookie: `${memberCsrfCookie}; ${memberSessionCookie}` }
    });
    expect(forbiddenApplicationPage.statusCode).toBe(403);
    expect(forbiddenApplicationPage.body).not.toContain("Update available");

    const adminLoginPage = await app.inject({ method: "GET", url: "/login" });
    const adminCsrfCookie = responseCookie(adminLoginPage, "pennyworth_csrf");
    const adminCsrfToken = adminLoginPage.body.match(/name="csrfToken" value="([^"]+)"/)?.[1] ?? "";
    const adminLogin = await app.inject({
      method: "POST",
      url: "/login",
      headers: { cookie: adminCsrfCookie, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        csrfToken: adminCsrfToken,
        email: administrator.email,
        password: adminPassword
      }).toString()
    });
    const adminSessionCookie = responseCookie(adminLogin, sessionCookieName);
    const adminCookies = `${adminCsrfCookie}; ${adminSessionCookie}`;
    const applicationPage = await app.inject({ method: "GET", url: "/settings/application", headers: { cookie: adminCookies } });
    expect(applicationPage.statusCode).toBe(200);
    expect(applicationPage.body).toContain("Application updates");
    const newEmail = `${integrationId("managed-member")}@pennyworth.local`;
    createdManagedUserEmails.push(newEmail);
    const createResponse = await app.inject({
      method: "POST",
      url: "/settings/users",
      headers: { cookie: adminCookies, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        csrfToken: adminCsrfToken,
        name: "Managed Family Member",
        email: newEmail
      }).toString()
    });
    const temporaryPassword = createResponse.body.match(/<dt>Password<\/dt><dd><code>([^<]+)<\/code>/)?.[1];
    const managedMember = await prisma.user.findUnique({ where: { email: newEmail } });

    expect(createResponse.statusCode).toBe(201);
    expect(temporaryPassword).toBeTruthy();
    expect(managedMember).toMatchObject({ role: "member", isActive: true, mustChangePassword: true });

    if (!managedMember || !temporaryPassword) {
      throw new Error("Managed member was not created with a temporary password.");
    }

    await expect(prisma.category.count({ where: { userId: managedMember.id } })).resolves.toBe(9);
    await expect(prisma.tag.count({ where: { userId: managedMember.id } })).resolves.toBe(5);
    await expect(prisma.account.count({ where: { userId: managedMember.id } })).resolves.toBe(0);

    const newMemberLoginPage = await app.inject({ method: "GET", url: "/login" });
    const newMemberCsrfCookie = responseCookie(newMemberLoginPage, "pennyworth_csrf");
    const newMemberCsrfToken = newMemberLoginPage.body.match(/name="csrfToken" value="([^"]+)"/)?.[1] ?? "";
    const newMemberLogin = await app.inject({
      method: "POST",
      url: "/login",
      headers: { cookie: newMemberCsrfCookie, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        csrfToken: newMemberCsrfToken,
        email: newEmail,
        password: temporaryPassword
      }).toString()
    });
    const temporarySessionCookie = responseCookie(newMemberLogin, sessionCookieName);
    const temporaryCookies = `${newMemberCsrfCookie}; ${temporarySessionCookie}`;

    expect(newMemberLogin.headers.location).toBe("/settings/security?required=1");
    const blockedLedger = await app.inject({ method: "GET", url: "/accounts", headers: { cookie: temporaryCookies } });
    expect(blockedLedger.headers.location).toBe("/settings/security?required=1");

    const passwordChange = await app.inject({
      method: "POST",
      url: "/settings/security/password",
      headers: { cookie: temporaryCookies, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        csrfToken: newMemberCsrfToken,
        currentPassword: temporaryPassword,
        newPassword: replacementPassword,
        confirmPassword: replacementPassword
      }).toString()
    });
    const permanentSessionCookie = responseCookie(passwordChange, sessionCookieName);

    expect(passwordChange.headers.location).toBe("/settings/security?passwordUpdated=1");
    await expect(prisma.user.findUnique({ where: { id: managedMember.id } })).resolves.toMatchObject({
      mustChangePassword: false
    });
    const ledger = await app.inject({
      method: "GET",
      url: "/accounts",
      headers: { cookie: `${newMemberCsrfCookie}; ${permanentSessionCookie}` }
    });
    expect(ledger.statusCode).toBe(200);

    const deactivateResponse = await app.inject({
      method: "POST",
      url: `/settings/users/${managedMember.id}/active`,
      headers: { cookie: adminCookies, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ csrfToken: adminCsrfToken, isActive: "false" }).toString()
    });
    expect(deactivateResponse.statusCode).toBe(302);

    const rejectedLogin = await app.inject({
      method: "POST",
      url: "/login",
      headers: { cookie: newMemberCsrfCookie, "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        csrfToken: newMemberCsrfToken,
        email: newEmail,
        password: replacementPassword
      }).toString()
    });
    expect(rejectedLogin.statusCode).toBe(401);
  });
});
