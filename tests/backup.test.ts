import { readFileSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUserBackup, currentBackupSchemaVersion, previewBackupJson, restoreUserBackup } from "../src/services/backup.js";
import { prisma } from "../src/lib/db.js";
import { matchRuleForText } from "../src/lib/ruleMatching.js";

afterEach(() => vi.restoreAllMocks());

function sampleBackup() {
  const now = "2026-07-10T00:00:00.000Z";

  return {
    app: "Pennyworth",
    schemaVersion: 10,
    exportedAt: now,
    user: {
      id: "user-source",
      email: "admin@example.com",
      name: "Admin",
      createdAt: now,
      updatedAt: now
    },
    accounts: [
      {
        id: "account-bank",
        userId: "user-source",
        name: "Main Bank",
        type: "bank",
        currency: "EUR",
        openingBalanceMinor: 10000,
        institution: null,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "account-broker",
        userId: "user-source",
        name: "Brokerage",
        type: "investment",
        currency: "EUR",
        openingBalanceMinor: 0,
        institution: "Example Broker",
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ],
    categories: [
      {
        id: "category-food",
        userId: "user-source",
        parentId: null as string | null,
        name: "Food",
        type: "expense",
        color: "#2563eb",
        icon: "food",
        createdAt: now,
        updatedAt: now
      }
    ],
    tags: [
      {
        id: "tag-recurring",
        userId: "user-source",
        name: "recurring",
        color: "#2563eb",
        createdAt: now,
        updatedAt: now
      }
    ],
    transactions: [
      {
        id: "transaction-1",
        userId: "user-source",
        type: "expense",
        date: now,
        amountMinor: 1200,
        sourceAccountId: "account-bank",
        destinationAccountId: null,
        categoryId: "category-food" as string | null,
        description: "Groceries",
        notes: null,
        createdAt: now,
        updatedAt: now,
        tagIds: ["tag-recurring"]
      }
    ],
    budgets: [
      {
        id: "budget-food",
        userId: "user-source",
        categoryId: "category-food",
        month: "2026-07-01T00:00:00.000Z",
        amountMinor: 30000,
        createdAt: now,
        updatedAt: now
      }
    ],
    rules: [
      {
        id: "rule-food",
        userId: "user-source",
        categoryId: "category-food",
        name: "Food rule",
        matchText: "grocery",
        priority: 10,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        tagIds: ["tag-recurring"]
      }
    ],
    recurringTransactions: [
      {
        id: "recurring-rent",
        userId: "user-source",
        name: "Rent",
        type: "expense",
        amountMinor: 100000,
        sourceAccountId: "account-bank",
        destinationAccountId: null,
        categoryId: "category-food",
        description: "Rent",
        notes: null,
        frequency: "monthly",
        nextDate: "2026-08-01T00:00:00.000Z",
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ],
    assets: [
      {
        id: "asset-vwce",
        userId: "user-source",
        symbol: "VWCE",
        name: "Vanguard FTSE All-World UCITS ETF",
        type: "etf",
        currency: "EUR",
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ],
    assetPrices: [
      {
        id: "asset-price-vwce",
        userId: "user-source",
        assetId: "asset-vwce",
        date: "2026-07-10T00:00:00.000Z",
        priceMinor: 11640,
        createdAt: now,
        updatedAt: now
      }
    ],
    holdings: [
      {
        id: "holding-vwce",
        userId: "user-source",
        accountId: "account-broker",
        assetId: "asset-vwce",
        quantity: "12.50000000",
        averageCostMinor: 10250,
        notes: "Sample ETF position",
        createdAt: now,
        updatedAt: now
      }
    ],
    investmentTransactions: [
      {
        id: "investment-transaction-vwce",
        userId: "user-source",
        accountId: "account-broker",
        cashAccountId: "account-bank",
        assetId: "asset-vwce",
        type: "buy",
        date: "2026-06-15T00:00:00.000Z",
        quantity: "12.50000000",
        priceMinor: 10250,
        amountMinor: 128125,
        cashAmountMinor: 128125,
        notes: "Sample ETF purchase",
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

describe("backup restore preview", () => {
  it("keeps the published schema and starter example aligned with the current importer", () => {
    const schema = JSON.parse(
      readFileSync(new URL("../src/public/schemas/pennyworth-backup-v10.schema.json", import.meta.url), "utf8")
    ) as { properties: { schemaVersion: { const: number } } };
    const starter = readFileSync(
      new URL("../src/public/examples/pennyworth-backup-v10-starter.json", import.meta.url),
      "utf8"
    );

    expect(schema.properties.schemaVersion.const).toBe(currentBackupSchemaVersion);
    expect(previewBackupJson(starter)).toMatchObject({
      accountCount: 1,
      categoryCount: 1,
      tagCount: 1,
      transactionCount: 1,
      ruleCount: 2
    });
  });

  it("summarizes a valid backup", () => {
    expect(previewBackupJson(JSON.stringify(sampleBackup()))).toEqual({
      exportedAt: "2026-07-10T00:00:00.000Z",
      userEmail: "admin@example.com",
      accountCount: 2,
      categoryCount: 1,
      tagCount: 1,
      transactionCount: 1,
      budgetCount: 1,
      ruleCount: 1,
      recurringCount: 1,
      assetCount: 1,
      assetPriceCount: 1,
      holdingCount: 1,
      investmentTransactionCount: 1
    });
  });

  it("accepts valid version 10 alternatives and literal quoted phrases", () => {
    for (const matchText of ["lidl, aldi", '"Smith, Inc", grocery', "grocery, , grocery"]) {
      const backup = sampleBackup();
      backup.rules[0].matchText = matchText;
      expect(previewBackupJson(JSON.stringify(backup)).ruleCount).toBe(1);
    }
  });

  it("validates version 10 matching syntax before restore", () => {
    for (const matchText of [", ,", '"unclosed', '"closed"extra']) {
      const backup = sampleBackup();
      backup.rules[0].matchText = matchText;
      expect(() => previewBackupJson(JSON.stringify(backup))).toThrow("rules[0].matchText:");
    }
  });

  it("keeps historical backups with literal commas and quotes importable", () => {
    for (const schemaVersion of [1, 8, 9]) {
      const backup = sampleBackup();
      backup.schemaVersion = schemaVersion;
      backup.rules[0].matchText = 'Smith, "Inc"';
      expect(previewBackupJson(JSON.stringify(backup)).ruleCount).toBe(1);
    }
    for (const version of [8, 9]) {
      const starter = readFileSync(new URL(`../src/public/examples/pennyworth-backup-v${version}-starter.json`, import.meta.url), "utf8");
      expect(previewBackupJson(starter).transactionCount).toBe(1);
    }
  });

  it("preserves literal legacy rules during restore and never reapplies them to saved transactions", async () => {
    const backup = sampleBackup();
    backup.schemaVersion = 9;
    backup.rules[0].matchText = 'Smith, "Inc"';
    const restoredRules: Array<{ matchText: string }> = [];
    const restoredTransactions: Array<{ categoryId: string | null }> = [];
    backup.transactions[0].categoryId = null;
    backup.transactions[0].description = 'Smith, "Inc"';
    const models = ["investmentTransactionResult", "investmentPosition", "investmentTransaction", "holding", "assetPrice", "asset",
      "recurringTransaction", "rule", "transaction", "budget", "tag", "category", "account", "user", "transactionTag", "ruleTag"];
    const tx = Object.fromEntries(models.map((model) => [model, {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockImplementation(async ({ data }: { data: Array<{ matchText: string; categoryId: string | null }> }) => {
        if (model === "rule") restoredRules.push(...data);
        if (model === "transaction") restoredTransactions.push(...data);
        return { count: data.length };
      })
    }])) as unknown as Prisma.TransactionClient;
    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback) => {
      if (typeof callback === "function") return callback(tx);
      throw new Error("Expected a transaction callback.");
    });

    await restoreUserBackup("target-user", JSON.stringify(backup));
    expect(restoredRules[0].matchText).toBe('"Smith, ""Inc"""');
    expect(matchRuleForText({ description: 'Smith, "Inc"' }, restoredRules)).not.toBeNull();
    expect(matchRuleForText({ description: "Smith" }, restoredRules)).toBeNull();
    expect(restoredTransactions[0].categoryId).toBeNull();

    backup.schemaVersion = 10;
    backup.rules[0].matchText = "lidl, aldi";
    await restoreUserBackup("target-user", JSON.stringify(backup));
    expect(restoredRules[1].matchText).toBe("lidl, aldi");
  });

  it("restores, exports, and reimports legacy inert rules without losing data or enabling matches", async () => {
    const backup = sampleBackup();
    const models = ["investmentTransactionResult", "investmentPosition", "investmentTransaction", "holding", "assetPrice", "asset",
      "recurringTransaction", "rule", "transaction", "budget", "tag", "category", "account", "user", "transactionTag", "ruleTag"];
    const records: Record<string, Array<Record<string, unknown>>> = Object.fromEntries(models.map((model) => [model, []]));
    const tx = Object.fromEntries(models.map((model) => [model, {
      deleteMany: async () => {
        const count = records[model].length;
        records[model] = [];
        if (model === "rule") records.ruleTag = [];
        if (model === "transaction") records.transactionTag = [];
        return { count };
      },
      updateMany: async () => ({ count: 0 }),
      update: async () => ({}),
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        records[model].push(...data);
        return { count: data.length };
      },
      findMany: async () => records[model],
      findUnique: async () => ({ ...backup.user, id: "target-user" })
    }])) as unknown as Prisma.TransactionClient;
    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback) => {
      if (typeof callback === "function") return callback(tx);
      throw new Error("Expected a transaction callback.");
    });

    for (const schemaVersion of [1, 8, 9]) {
      for (const matchText of ["   ", "\t", "\r\n", " \n\t ", "\u00a0\n"]) {
        for (const isActive of [true, false]) {
          backup.schemaVersion = schemaVersion;
          backup.rules[0].matchText = matchText;
          backup.rules[0].isActive = isActive;
          await restoreUserBackup("target-user", JSON.stringify(backup));
          const exported = await buildUserBackup("target-user");
          expect(exported.schemaVersion).toBe(currentBackupSchemaVersion);
          expect(exported.rules[0].isActive).toBe(isActive);
          expect(matchRuleForText({ description: "Anything", notes: matchText }, exported.rules)).toBeNull();
          expect(previewBackupJson(JSON.stringify(exported))).toMatchObject({ ruleCount: 1, transactionCount: 1 });
          await restoreUserBackup("target-user", JSON.stringify(exported));
          const reexported = await buildUserBackup("target-user");
          expect(reexported.rules).toEqual(exported.rules);
          expect(reexported.transactions).toEqual(exported.transactions);
        }
      }
    }
  });

  it("rejects invalid JSON", () => {
    expect(() => previewBackupJson("{")).toThrow("Backup JSON is not valid JSON.");
  });

  it("rejects backups from another app", () => {
    const backup = sampleBackup();
    backup.app = "Other";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow("Backup was not created by Pennyworth.");
  });

  it("rejects account and asset currencies outside the configured primary currency", () => {
    const accountBackup = sampleBackup();
    accountBackup.accounts[0].currency = "USD";
    expect(() => previewBackupJson(JSON.stringify(accountBackup))).toThrow("Only EUR accounts are supported");

    const assetBackup = sampleBackup();
    assetBackup.assets[0].currency = "USD";
    expect(() => previewBackupJson(JSON.stringify(assetBackup))).toThrow("Only EUR assets are supported");
  });

  it("rejects monetary values outside the supported integer range", () => {
    const backup = sampleBackup();
    backup.transactions[0].amountMinor = 2_147_483_648;

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow("supported money range");
  });

  it("rejects duplicate record IDs", () => {
    const backup = sampleBackup();
    backup.accounts.push({ ...backup.accounts[0] });

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow("accounts contains duplicate IDs.");
  });

  it("rejects cyclic category hierarchies", () => {
    const backup = sampleBackup();
    backup.categories.push({
      ...backup.categories[0],
      id: "category-child",
      parentId: "category-food",
      name: "Child"
    });
    backup.categories[0].parentId = "category-child";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow("categories contains a parent cycle.");
  });

  it("accepts schema version 1 backups without budgets", () => {
    const backup = sampleBackup();
    backup.schemaVersion = 1;
    delete (backup as Partial<typeof backup>).budgets;

    expect(previewBackupJson(JSON.stringify(backup)).budgetCount).toBe(0);
  });

  it("rejects transactions with missing account references", () => {
    const backup = sampleBackup();
    backup.transactions[0].sourceAccountId = "missing-account";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow(
      "transactions[0].sourceAccountId references a missing account."
    );
  });

  it("rejects budgets with missing category references", () => {
    const backup = sampleBackup();
    backup.budgets[0].categoryId = "missing-category";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow(
      "budgets[0].categoryId references a missing category."
    );
  });

  it("rejects rules with missing tag references", () => {
    const backup = sampleBackup();
    backup.rules[0].tagIds = ["missing-tag"];

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow("rules[0].tagIds references a missing tag.");
  });

  it("rejects recurring templates with missing category references", () => {
    const backup = sampleBackup();
    backup.recurringTransactions[0].categoryId = "missing-category";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow(
      "recurringTransactions[0].categoryId references a missing category."
    );
  });

  it("rejects holdings with missing asset references", () => {
    const backup = sampleBackup();
    backup.holdings[0].assetId = "missing-asset";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow("holdings[0].assetId references a missing asset.");
  });

  it("rejects asset prices with missing asset references", () => {
    const backup = sampleBackup();
    backup.assetPrices[0].assetId = "missing-asset";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow("assetPrices[0].assetId references a missing asset.");
  });

  it("rejects investment transactions with missing asset references", () => {
    const backup = sampleBackup();
    backup.investmentTransactions[0].assetId = "missing-asset";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow(
      "investmentTransactions[0].assetId references a missing asset."
    );
  });

  it("rejects investment transactions with missing cash account references", () => {
    const backup = sampleBackup();
    backup.investmentTransactions[0].cashAccountId = "missing-account";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow(
      "investmentTransactions[0].cashAccountId references a missing account."
    );
  });

  it("rejects category relationships that normal services would reject", () => {
    const backup = sampleBackup();
    backup.categories[0].type = "income";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow(
      "transactions[0].categoryId is incompatible with its transaction type."
    );
  });

  it("rejects investment records on non-investment accounts", () => {
    const backup = sampleBackup();
    backup.accounts[1].type = "bank";

    expect(() => previewBackupJson(JSON.stringify(backup))).toThrow(
      "holdings[0].accountId must be an investment or crypto wallet account."
    );
  });
});
