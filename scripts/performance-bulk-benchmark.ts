import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { buildUserBackup, restoreUserBackup } from "../src/services/backup.js";
import { getQueryCount, prisma, resetQueryCount } from "../src/lib/db.js";
import { toCsv } from "../src/lib/csv.js";
import {
  createTransactionImportBatch,
  persistTransactionImport,
  previewTransactionImportCsv,
  type TransactionImportRefs
} from "../src/services/transactionImport.js";

const performanceUserEmail = "performance@pennyworth.local";
const confirmationValue = "measure";
const benchmarkUserPrefix = "performance-bulk-benchmark-";

function requiredConfirmation() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Bulk performance benchmarking is disabled when NODE_ENV=production.");
  }

  if (process.env.PERF_BULK_BENCHMARK_CONFIRM !== confirmationValue) {
    throw new Error(`Set PERF_BULK_BENCHMARK_CONFIRM=${confirmationValue} before running this benchmark.`);
  }
}

async function createBenchmarkUser(label: string) {
  const id = `${benchmarkUserPrefix}${label}-${randomUUID()}`;
  return prisma.user.create({
    data: {
      id,
      email: `${id}@pennyworth.local`,
      name: `Bulk benchmark ${label}`,
      passwordHash: "benchmark-only-user"
    }
  });
}

async function createImportReferences(
  userId: string,
  backup: Awaited<ReturnType<typeof buildUserBackup>>
): Promise<TransactionImportRefs> {
  const accounts = backup.accounts.map((account, index) => ({
    id: `${benchmarkUserPrefix}account-${index}-${randomUUID()}`,
    userId,
    name: account.name,
    type: account.type,
    currency: account.currency,
    openingBalanceMinor: account.openingBalanceMinor
  }));
  const categories = backup.categories.map((category, index) => ({
    id: `${benchmarkUserPrefix}category-${index}-${randomUUID()}`,
    userId,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon
  }));
  const tags = backup.tags.map((tag, index) => ({
    id: `${benchmarkUserPrefix}tag-${index}-${randomUUID()}`,
    userId,
    name: tag.name
  }));

  await prisma.$transaction([
    prisma.account.createMany({ data: accounts }),
    prisma.category.createMany({ data: categories }),
    prisma.tag.createMany({ data: tags })
  ]);

  return { accounts, categories, tags };
}

function buildImportCsv(backup: Awaited<ReturnType<typeof buildUserBackup>>) {
  const accountNames = new Map(backup.accounts.map((account) => [account.id, account.name]));
  const categoryNames = new Map(backup.categories.map((category) => [category.id, category.name]));
  const tagNames = new Map(backup.tags.map((tag) => [tag.id, tag.name]));
  const transactions = backup.transactions;

  const rows: Array<Array<string | number | null | undefined>> = [
    ["date", "type", "amount_minor", "account", "destination_account", "category", "tags", "description", "notes"]
  ];

  for (const transaction of transactions) {
    rows.push([
      transaction.date.toISOString().slice(0, 10),
      transaction.type,
      transaction.amountMinor,
      accountNames.get(transaction.sourceAccountId ?? "") ?? "",
      accountNames.get(transaction.destinationAccountId ?? "") ?? "",
      categoryNames.get(transaction.categoryId ?? "") ?? "",
      transaction.tagIds.map((tagId) => tagNames.get(tagId) ?? "").filter(Boolean).join("; "),
      transaction.description ?? "",
      transaction.notes ?? ""
    ]);
  }

  return { csvText: toCsv(rows), transactionCount: transactions.length };
}

async function measure(name: string, operation: () => Promise<number | void>) {
  resetQueryCount();
  const startedAt = performance.now();
  const records = (await operation()) ?? 0;
  const elapsedMs = performance.now() - startedAt;

  return {
    operation: name,
    records,
    elapsedMs: Number(elapsedMs.toFixed(1)),
    queryCount: getQueryCount()
  };
}

async function main() {
  requiredConfirmation();
  const sourceUser = await prisma.user.findUnique({
    where: { email: performanceUserEmail },
    select: { id: true }
  });

  if (!sourceUser) {
    throw new Error("Performance user not found. Run npm run db:seed:performance first.");
  }

  let backup!: Awaited<ReturnType<typeof buildUserBackup>>;
  const exportResult = await measure("JSON backup export", async () => {
    backup = await buildUserBackup(sourceUser.id);
    return backup.transactions.length;
  });
  const { csvText, transactionCount } = buildImportCsv(backup);
  const restoreTransactionCount = backup.transactions.length;
  const importUser = await createBenchmarkUser("import");
  const results: Array<Record<string, unknown>> = [exportResult];

  try {
    const refs = await createImportReferences(importUser.id, backup);
    const previewResult = await measure("CSV import preview", async () => {
      const preview = previewTransactionImportCsv(csvText, refs);

      if (preview.errorCount !== 0 || preview.validCount !== transactionCount) {
        throw new Error(`CSV preview rejected ${preview.errorCount} rows.`);
      }

      return preview.validCount;
    });
    results.push(previewResult);

    const importBatchId = await createTransactionImportBatch(importUser.id, csvText);
    const preview = previewTransactionImportCsv(csvText, refs);
    results.push(
      await measure("CSV import persistence", () =>
        persistTransactionImport(importUser.id, importBatchId, csvText, preview, false)
      )
    );

    const backupJson = JSON.stringify(backup);
    results.push(
      await measure("JSON backup restore", async () => {
        await restoreUserBackup(sourceUser.id, backupJson);
        return restoreTransactionCount;
      })
    );

    const [importedCount, restoredCount, restoredAccounts, restoredCategories, restoredTags, restoredBudgets, restoredRules, restoredRecurring,
      restoredAssets, restoredAssetPrices, restoredHoldings, restoredInvestmentTransactions] = await Promise.all([
      prisma.transaction.count({ where: { userId: importUser.id } }),
      prisma.transaction.count({ where: { userId: sourceUser.id } }),
      prisma.account.count({ where: { userId: sourceUser.id } }),
      prisma.category.count({ where: { userId: sourceUser.id } }),
      prisma.tag.count({ where: { userId: sourceUser.id } }),
      prisma.budget.count({ where: { userId: sourceUser.id } }),
      prisma.rule.count({ where: { userId: sourceUser.id } }),
      prisma.recurringTransaction.count({ where: { userId: sourceUser.id } }),
      prisma.asset.count({ where: { userId: sourceUser.id } }),
      prisma.assetPrice.count({ where: { userId: sourceUser.id } }),
      prisma.holding.count({ where: { userId: sourceUser.id } }),
      prisma.investmentTransaction.count({ where: { userId: sourceUser.id } })
    ]);
    const restoredCounts = {
      accounts: restoredAccounts,
      categories: restoredCategories,
      tags: restoredTags,
      transactions: restoredCount,
      budgets: restoredBudgets,
      rules: restoredRules,
      recurringTransactions: restoredRecurring,
      assets: restoredAssets,
      assetPrices: restoredAssetPrices,
      holdings: restoredHoldings,
      investmentTransactions: restoredInvestmentTransactions
    };
    const expectedRestoreCounts = {
      accounts: backup.accounts.length,
      categories: backup.categories.length,
      tags: backup.tags.length,
      transactions: backup.transactions.length,
      budgets: backup.budgets.length,
      rules: backup.rules.length,
      recurringTransactions: backup.recurringTransactions.length,
      assets: backup.assets.length,
      assetPrices: backup.assetPrices.length,
      holdings: backup.holdings.length,
      investmentTransactions: backup.investmentTransactions.length
    };
    const countMismatch = Object.keys(expectedRestoreCounts).find(
      (key) => restoredCounts[key as keyof typeof restoredCounts] !== expectedRestoreCounts[key as keyof typeof expectedRestoreCounts]
    );
    if (importedCount !== transactionCount || countMismatch) {
      throw new Error(
        `Bulk benchmark counts did not match: import=${importedCount}/${transactionCount}, restore=${JSON.stringify(restoredCounts)}, mismatch=${countMismatch ?? "none"}.`
      );
    }

    console.log(
      JSON.stringify(
        {
          importTransactionCount: transactionCount,
          restoreTransactionCount,
          restoredCounts,
          csvBytes: Buffer.byteLength(csvText, "utf8"),
          backupBytes: Buffer.byteLength(backupJson, "utf8"),
          results
        },
        null,
        2
      )
    );
  } finally {
    await prisma.user.deleteMany({ where: { id: importUser.id } });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
