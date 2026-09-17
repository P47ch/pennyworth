import { prisma } from "../lib/db.js";
import { assertPrimaryCurrency } from "../finance/currency.js";
import { maximumMoneyMinor, minimumMoneyMinor } from "../finance/money.js";
import { loadConfig } from "../lib/config.js";
import {
  bulkWorkflowBatchSize,
  bulkWorkflowTransactionMaxWaitMs,
  bulkWorkflowTransactionTimeoutMs
} from "./bulkWorkflow.js";
import { validateBackupRelationshipSemantics } from "./relationshipValidation.js";

const primaryCurrency = loadConfig().primaryCurrency;
export const currentBackupSchemaVersion = 9;

type BackupRecord = Record<string, unknown>;
const restoreBatchSize = bulkWorkflowBatchSize;

export type BackupPreview = {
  exportedAt: string;
  userEmail: string;
  accountCount: number;
  categoryCount: number;
  tagCount: number;
  transactionCount: number;
  budgetCount: number;
  ruleCount: number;
  recurringCount: number;
  assetCount: number;
  assetPriceCount: number;
  holdingCount: number;
  investmentTransactionCount: number;
};

function groupTagIds<T extends { tagId: string }>(
  rows: T[],
  ownerId: (row: T) => string
): Map<string, string[]> {
  const tagIdsByOwner = new Map<string, string[]>();

  for (const row of rows) {
    const id = ownerId(row);
    const tagIds = tagIdsByOwner.get(id) ?? [];
    tagIds.push(row.tagId);
    tagIdsByOwner.set(id, tagIds);
  }

  return tagIdsByOwner;
}

export async function buildUserBackup(userId: string) {
  const [
    user,
    accounts,
    categories,
    tags,
    transactions,
    transactionTags,
    budgets,
    rules,
    ruleTags,
    recurringTransactions,
    assets,
    assetPrices,
    holdings,
    investmentTransactions
  ] = await prisma.$transaction(
    async (tx) => Promise.all([
    tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    tx.account.findMany({
      where: { userId },
      orderBy: { name: "asc" }
    }),
    tx.category.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    }),
    tx.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" }
    }),
    tx.transaction.findMany({
      where: { userId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    }),
    tx.transactionTag.findMany({
      where: { userId },
      select: { transactionId: true, tagId: true },
      orderBy: [{ transactionId: "asc" }, { tagId: "asc" }]
    }),
    tx.budget.findMany({
      where: { userId },
      orderBy: [{ month: "asc" }, { createdAt: "asc" }]
    }),
    tx.rule.findMany({
      where: { userId },
      orderBy: [{ priority: "asc" }, { name: "asc" }]
    }),
    tx.ruleTag.findMany({
      where: { userId },
      select: { ruleId: true, tagId: true },
      orderBy: [{ ruleId: "asc" }, { tagId: "asc" }]
    }),
    tx.recurringTransaction.findMany({
      where: { userId },
      orderBy: [{ nextDate: "asc" }, { name: "asc" }]
    }),
    tx.asset.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { symbol: "asc" }]
    }),
    tx.assetPrice.findMany({
      where: { userId },
      orderBy: [{ date: "asc" }, { asset: { symbol: "asc" } }]
    }),
    tx.holding.findMany({
      where: { userId },
      orderBy: [{ account: { name: "asc" } }, { asset: { symbol: "asc" } }]
    }),
    tx.investmentTransaction.findMany({
      where: { userId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    })
    ]),
    {
      isolationLevel: "RepeatableRead",
      maxWait: bulkWorkflowTransactionMaxWaitMs,
      timeout: bulkWorkflowTransactionTimeoutMs
    }
  );

  if (!user) {
    throw new Error("User not found.");
  }

  const transactionTagIds = groupTagIds(transactionTags, (item) => item.transactionId);
  const ruleTagIds = groupTagIds(ruleTags, (item) => item.ruleId);

  return {
    app: "Pennyworth",
    schemaVersion: currentBackupSchemaVersion,
    exportedAt: new Date().toISOString(),
    user,
    accounts,
    categories,
    tags,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      date: transaction.date,
      amountMinor: transaction.amountMinor,
      sourceAccountId: transaction.sourceAccountId,
      destinationAccountId: transaction.destinationAccountId,
      categoryId: transaction.categoryId,
      description: transaction.description,
      notes: transaction.notes,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      tagIds: transactionTagIds.get(transaction.id) ?? []
    })),
    budgets,
    rules: rules.map((rule) => ({
      id: rule.id,
      userId: rule.userId,
      categoryId: rule.categoryId,
      name: rule.name,
      matchText: rule.matchText,
      priority: rule.priority,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      tagIds: ruleTagIds.get(rule.id) ?? []
    })),
    recurringTransactions,
    assets,
    assetPrices,
    holdings,
    investmentTransactions
  };
}

function objectValue(value: unknown, name: string): BackupRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }

  return value as BackupRecord;
}

function arrayValue(value: unknown, name: string): BackupRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }

  return value.map((item, index) => objectValue(item, `${name}[${index}]`));
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value;
}

function optionalStringValue(value: unknown, name: string): string | null {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }

  return value;
}

function numberValue(value: unknown, name: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimumMoneyMinor ||
    value > maximumMoneyMinor
  ) {
    throw new Error(`${name} must be an integer in the supported money range.`);
  }

  return value;
}

function positiveNumberValue(value: unknown, name: string): number {
  const number = numberValue(value, name);

  if (number <= 0) {
    throw new Error(`${name} must be greater than zero.`);
  }

  return number;
}

function nonNegativeNumberValue(value: unknown, name: string): number {
  const number = numberValue(value, name);

  if (number < 0) {
    throw new Error(`${name} must not be negative.`);
  }

  return number;
}

function stringArrayValue(value: unknown, name: string): string[] {
  if (typeof value === "undefined") {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }

  const values = value.map((item, index) => stringValue(item, `${name}[${index}]`));

  if (new Set(values).size !== values.length) {
    throw new Error(`${name} contains duplicate IDs.`);
  }

  return values;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

async function createManyInBatches<T>(rows: T[], create: (batch: T[]) => Promise<unknown>) {
  for (let start = 0; start < rows.length; start += restoreBatchSize) {
    await create(rows.slice(start, start + restoreBatchSize));
  }
}

function orderCategoriesParentFirst<T extends { id: string; parentId: string | null }>(rows: T[]) {
  const remaining = new Map(rows.map((row) => [row.id, row]));
  const ordered: T[] = [];

  while (remaining.size > 0) {
    const ready = rows.filter(
      (row) => remaining.has(row.id) && (!row.parentId || !remaining.has(row.parentId))
    );

    if (ready.length === 0) {
      throw new Error("Category hierarchy contains a cycle.");
    }

    for (const row of ready) {
      remaining.delete(row.id);
      ordered.push(row);
    }
  }

  return ordered;
}

function dateValue(value: unknown, name: string): Date {
  const date = new Date(stringValue(value, name));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid date.`);
  }

  return date;
}

function assertUniqueIds(records: BackupRecord[], name: string) {
  const ids = records.map((record, index) => stringValue(record.id, `${name}[${index}].id`));
  const uniqueIds = new Set(ids);

  if (uniqueIds.size !== ids.length) {
    throw new Error(`${name} contains duplicate IDs.`);
  }
}

function assertAcyclicCategoryTree(categories: BackupRecord[]) {
  const parentById = new Map(
    categories.map((category, index) => [
      stringValue(category.id, `categories[${index}].id`),
      optionalStringValue(category.parentId, `categories[${index}].parentId`)
    ])
  );

  for (const categoryId of parentById.keys()) {
    const path = new Set<string>();
    let currentId: string | null | undefined = categoryId;

    while (currentId) {
      if (path.has(currentId)) {
        throw new Error("categories contains a parent cycle.");
      }

      path.add(currentId);
      currentId = parentById.get(currentId);
    }
  }
}

function parseBackupJson(rawJson: string): BackupRecord {
  try {
    return objectValue(JSON.parse(rawJson), "Backup");
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Backup JSON is not valid JSON.");
    }

    throw error;
  }
}

function previewParsedBackup(backup: BackupRecord): BackupPreview {
  if (backup.app !== "Pennyworth") {
    throw new Error("Backup was not created by Pennyworth.");
  }

  if (
    backup.schemaVersion !== 1 &&
    backup.schemaVersion !== 2 &&
    backup.schemaVersion !== 3 &&
    backup.schemaVersion !== 4 &&
    backup.schemaVersion !== 5 &&
    backup.schemaVersion !== 6 &&
    backup.schemaVersion !== 7 &&
    backup.schemaVersion !== 8 &&
    backup.schemaVersion !== 9
  ) {
    throw new Error("Unsupported backup schema version.");
  }

  const user = objectValue(backup.user, "user");
  const accounts = arrayValue(backup.accounts, "accounts");
  const categories = arrayValue(backup.categories, "categories");
  const tags = arrayValue(backup.tags, "tags");
  const transactions = arrayValue(backup.transactions, "transactions");
  const budgets = typeof backup.budgets === "undefined" ? [] : arrayValue(backup.budgets, "budgets");
  const rules = typeof backup.rules === "undefined" ? [] : arrayValue(backup.rules, "rules");
  const recurringTransactions =
    typeof backup.recurringTransactions === "undefined" ? [] : arrayValue(backup.recurringTransactions, "recurringTransactions");
  const assets = typeof backup.assets === "undefined" ? [] : arrayValue(backup.assets, "assets");
  const assetPrices = typeof backup.assetPrices === "undefined" ? [] : arrayValue(backup.assetPrices, "assetPrices");
  const holdings = typeof backup.holdings === "undefined" ? [] : arrayValue(backup.holdings, "holdings");
  const investmentTransactions =
    typeof backup.investmentTransactions === "undefined" ? [] : arrayValue(backup.investmentTransactions, "investmentTransactions");

  assertUniqueIds(accounts, "accounts");
  assertUniqueIds(categories, "categories");
  assertUniqueIds(tags, "tags");
  assertUniqueIds(transactions, "transactions");
  assertUniqueIds(budgets, "budgets");
  assertUniqueIds(rules, "rules");
  assertUniqueIds(recurringTransactions, "recurringTransactions");
  assertUniqueIds(assets, "assets");
  assertUniqueIds(assetPrices, "assetPrices");
  assertUniqueIds(holdings, "holdings");
  assertUniqueIds(investmentTransactions, "investmentTransactions");
  validateBackupReferences(
    accounts,
    categories,
    tags,
    transactions,
    budgets,
    rules,
    recurringTransactions,
    assets,
    assetPrices,
    holdings,
    investmentTransactions
  );
  validateBackupRelationshipSemantics({
    accounts: accounts.map((account, index) => ({
      id: stringValue(account.id, `accounts[${index}].id`),
      type: stringValue(account.type, `accounts[${index}].type`)
    })),
    categories: categories.map((category, index) => ({
      id: stringValue(category.id, `categories[${index}].id`),
      type: stringValue(category.type, `categories[${index}].type`)
    })),
    transactions: transactions.map((transaction, index) => ({
      type: stringValue(transaction.type, `transactions[${index}].type`),
      sourceAccountId: optionalStringValue(transaction.sourceAccountId, `transactions[${index}].sourceAccountId`),
      destinationAccountId: optionalStringValue(
        transaction.destinationAccountId,
        `transactions[${index}].destinationAccountId`
      ),
      categoryId: optionalStringValue(transaction.categoryId, `transactions[${index}].categoryId`)
    })),
    budgets: budgets.map((budget, index) => ({
      categoryId: stringValue(budget.categoryId, `budgets[${index}].categoryId`)
    })),
    rules: rules.map((rule, index) => ({
      categoryId: stringValue(rule.categoryId, `rules[${index}].categoryId`)
    })),
    recurringTransactions: recurringTransactions.map((recurring, index) => ({
      type: stringValue(recurring.type, `recurringTransactions[${index}].type`),
      sourceAccountId: optionalStringValue(recurring.sourceAccountId, `recurringTransactions[${index}].sourceAccountId`),
      destinationAccountId: optionalStringValue(
        recurring.destinationAccountId,
        `recurringTransactions[${index}].destinationAccountId`
      ),
      categoryId: optionalStringValue(recurring.categoryId, `recurringTransactions[${index}].categoryId`)
    })),
    holdings: holdings.map((holding, index) => ({
      accountId: stringValue(holding.accountId, `holdings[${index}].accountId`)
    })),
    investmentTransactions: investmentTransactions.map((investmentTransaction, index) => ({
      accountId: stringValue(investmentTransaction.accountId, `investmentTransactions[${index}].accountId`),
      cashAccountId: optionalStringValue(
        investmentTransaction.cashAccountId,
        `investmentTransactions[${index}].cashAccountId`
      )
    }))
  });

  return {
    exportedAt: stringValue(backup.exportedAt, "exportedAt"),
    userEmail: stringValue(user.email, "user.email"),
    accountCount: accounts.length,
    categoryCount: categories.length,
    tagCount: tags.length,
    transactionCount: transactions.length,
    budgetCount: budgets.length,
    ruleCount: rules.length,
    recurringCount: recurringTransactions.length,
    assetCount: assets.length,
    assetPriceCount: assetPrices.length,
    holdingCount: holdings.length,
    investmentTransactionCount: investmentTransactions.length
  };
}

export function previewBackupJson(rawJson: string): BackupPreview {
  return previewParsedBackup(parseBackupJson(rawJson));
}

function validateBackupReferences(
  accounts: BackupRecord[],
  categories: BackupRecord[],
  tags: BackupRecord[],
  transactions: BackupRecord[],
  budgets: BackupRecord[],
  rules: BackupRecord[],
  recurringTransactions: BackupRecord[],
  assets: BackupRecord[],
  assetPrices: BackupRecord[],
  holdings: BackupRecord[],
  investmentTransactions: BackupRecord[]
) {
  const accountIds = new Set(accounts.map((account, index) => stringValue(account.id, `accounts[${index}].id`)));
  const categoryIds = new Set(categories.map((category, index) => stringValue(category.id, `categories[${index}].id`)));
  const tagIds = new Set(tags.map((tag, index) => stringValue(tag.id, `tags[${index}].id`)));
  const assetIds = new Set(assets.map((asset, index) => stringValue(asset.id, `assets[${index}].id`)));

  for (const [index, account] of accounts.entries()) {
    assertPrimaryCurrency(stringValue(account.currency, `accounts[${index}].currency`), primaryCurrency, "accounts");
    numberValue(account.openingBalanceMinor, `accounts[${index}].openingBalanceMinor`);
  }

  for (const [index, asset] of assets.entries()) {
    assertPrimaryCurrency(stringValue(asset.currency, `assets[${index}].currency`), primaryCurrency, "assets");
  }

  for (const [index, transaction] of transactions.entries()) {
    positiveNumberValue(transaction.amountMinor, `transactions[${index}].amountMinor`);
  }

  for (const [index, budget] of budgets.entries()) {
    positiveNumberValue(budget.amountMinor, `budgets[${index}].amountMinor`);
  }

  for (const [index, recurring] of recurringTransactions.entries()) {
    positiveNumberValue(recurring.amountMinor, `recurringTransactions[${index}].amountMinor`);
  }

  for (const [index, assetPrice] of assetPrices.entries()) {
    positiveNumberValue(assetPrice.priceMinor, `assetPrices[${index}].priceMinor`);
  }

  for (const [index, holding] of holdings.entries()) {
    nonNegativeNumberValue(holding.averageCostMinor, `holdings[${index}].averageCostMinor`);
  }

  for (const [index, investmentTransaction] of investmentTransactions.entries()) {
    positiveNumberValue(investmentTransaction.amountMinor, `investmentTransactions[${index}].amountMinor`);
    if (typeof investmentTransaction.cashAmountMinor !== "undefined") {
      positiveNumberValue(investmentTransaction.cashAmountMinor, `investmentTransactions[${index}].cashAmountMinor`);
    }
    if (investmentTransaction.priceMinor !== null && typeof investmentTransaction.priceMinor !== "undefined") {
      positiveNumberValue(investmentTransaction.priceMinor, `investmentTransactions[${index}].priceMinor`);
    }
  }

  for (const [index, category] of categories.entries()) {
    const parentId = optionalStringValue(category.parentId, `categories[${index}].parentId`);

    if (parentId && !categoryIds.has(parentId)) {
      throw new Error(`categories[${index}].parentId references a missing category.`);
    }
  }

  assertAcyclicCategoryTree(categories);

  for (const [index, transaction] of transactions.entries()) {
    const sourceAccountId = optionalStringValue(transaction.sourceAccountId, `transactions[${index}].sourceAccountId`);
    const destinationAccountId = optionalStringValue(
      transaction.destinationAccountId,
      `transactions[${index}].destinationAccountId`
    );
    const categoryId = optionalStringValue(transaction.categoryId, `transactions[${index}].categoryId`);
    const transactionTagIds = stringArrayValue(transaction.tagIds, `transactions[${index}].tagIds`);

    if (sourceAccountId && !accountIds.has(sourceAccountId)) {
      throw new Error(`transactions[${index}].sourceAccountId references a missing account.`);
    }

    if (destinationAccountId && !accountIds.has(destinationAccountId)) {
      throw new Error(`transactions[${index}].destinationAccountId references a missing account.`);
    }

    if (categoryId && !categoryIds.has(categoryId)) {
      throw new Error(`transactions[${index}].categoryId references a missing category.`);
    }

    for (const tagId of transactionTagIds) {
      if (typeof tagId !== "string" || !tagIds.has(tagId)) {
        throw new Error(`transactions[${index}].tagIds references a missing tag.`);
      }
    }
  }

  for (const [index, budget] of budgets.entries()) {
    const categoryId = stringValue(budget.categoryId, `budgets[${index}].categoryId`);

    if (!categoryIds.has(categoryId)) {
      throw new Error(`budgets[${index}].categoryId references a missing category.`);
    }
  }

  for (const [index, rule] of rules.entries()) {
    const categoryId = stringValue(rule.categoryId, `rules[${index}].categoryId`);
    const ruleTagIds = stringArrayValue(rule.tagIds, `rules[${index}].tagIds`);

    if (!categoryIds.has(categoryId)) {
      throw new Error(`rules[${index}].categoryId references a missing category.`);
    }

    for (const tagId of ruleTagIds) {
      if (typeof tagId !== "string" || !tagIds.has(tagId)) {
        throw new Error(`rules[${index}].tagIds references a missing tag.`);
      }
    }
  }

  for (const [index, recurring] of recurringTransactions.entries()) {
    const sourceAccountId = optionalStringValue(recurring.sourceAccountId, `recurringTransactions[${index}].sourceAccountId`);
    const destinationAccountId = optionalStringValue(
      recurring.destinationAccountId,
      `recurringTransactions[${index}].destinationAccountId`
    );
    const categoryId = optionalStringValue(recurring.categoryId, `recurringTransactions[${index}].categoryId`);

    if (sourceAccountId && !accountIds.has(sourceAccountId)) {
      throw new Error(`recurringTransactions[${index}].sourceAccountId references a missing account.`);
    }

    if (destinationAccountId && !accountIds.has(destinationAccountId)) {
      throw new Error(`recurringTransactions[${index}].destinationAccountId references a missing account.`);
    }

    if (categoryId && !categoryIds.has(categoryId)) {
      throw new Error(`recurringTransactions[${index}].categoryId references a missing category.`);
    }
  }

  for (const [index, holding] of holdings.entries()) {
    const accountId = stringValue(holding.accountId, `holdings[${index}].accountId`);
    const assetId = stringValue(holding.assetId, `holdings[${index}].assetId`);

    if (!accountIds.has(accountId)) {
      throw new Error(`holdings[${index}].accountId references a missing account.`);
    }

    if (!assetIds.has(assetId)) {
      throw new Error(`holdings[${index}].assetId references a missing asset.`);
    }
  }

  for (const [index, assetPrice] of assetPrices.entries()) {
    const assetId = stringValue(assetPrice.assetId, `assetPrices[${index}].assetId`);

    if (!assetIds.has(assetId)) {
      throw new Error(`assetPrices[${index}].assetId references a missing asset.`);
    }
  }

  for (const [index, investmentTransaction] of investmentTransactions.entries()) {
    const accountId = stringValue(investmentTransaction.accountId, `investmentTransactions[${index}].accountId`);
    const cashAccountId = optionalStringValue(investmentTransaction.cashAccountId, `investmentTransactions[${index}].cashAccountId`);
    const assetId = stringValue(investmentTransaction.assetId, `investmentTransactions[${index}].assetId`);

    if (!accountIds.has(accountId)) {
      throw new Error(`investmentTransactions[${index}].accountId references a missing account.`);
    }

    if (cashAccountId && !accountIds.has(cashAccountId)) {
      throw new Error(`investmentTransactions[${index}].cashAccountId references a missing account.`);
    }

    if (!assetIds.has(assetId)) {
      throw new Error(`investmentTransactions[${index}].assetId references a missing asset.`);
    }
  }
}

export async function restoreUserBackup(userId: string, rawJson: string) {
  const backup = parseBackupJson(rawJson);
  const preview = previewParsedBackup(backup);
  const accounts = arrayValue(backup.accounts, "accounts");
  const categories = arrayValue(backup.categories, "categories");
  const tags = arrayValue(backup.tags, "tags");
  const transactions = arrayValue(backup.transactions, "transactions");
  const budgets = typeof backup.budgets === "undefined" ? [] : arrayValue(backup.budgets, "budgets");
  const rules = typeof backup.rules === "undefined" ? [] : arrayValue(backup.rules, "rules");
  const recurringTransactions =
    typeof backup.recurringTransactions === "undefined" ? [] : arrayValue(backup.recurringTransactions, "recurringTransactions");
  const assets = typeof backup.assets === "undefined" ? [] : arrayValue(backup.assets, "assets");
  const assetPrices = typeof backup.assetPrices === "undefined" ? [] : arrayValue(backup.assetPrices, "assetPrices");
  const holdings = typeof backup.holdings === "undefined" ? [] : arrayValue(backup.holdings, "holdings");
  const investmentTransactions =
    typeof backup.investmentTransactions === "undefined" ? [] : arrayValue(backup.investmentTransactions, "investmentTransactions");

  await prisma.$transaction(async (tx) => {
    await tx.investmentTransactionResult.deleteMany({ where: { userId } });
    await tx.investmentPosition.deleteMany({ where: { userId } });
    await tx.investmentTransaction.deleteMany({ where: { userId } });
    await tx.holding.deleteMany({ where: { userId } });
    await tx.assetPrice.deleteMany({ where: { userId } });
    await tx.asset.deleteMany({ where: { userId } });
    await tx.recurringTransaction.deleteMany({ where: { userId } });
    await tx.rule.deleteMany({ where: { userId } });
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.budget.deleteMany({ where: { userId } });
    await tx.tag.deleteMany({ where: { userId } });
    await tx.category.updateMany({ where: { userId }, data: { parentId: null } });
    await tx.category.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });

    if (accounts.length > 0) {
      const accountRows = accounts.map((account, index) => ({
        id: stringValue(account.id, `accounts[${index}].id`),
        userId,
        name: stringValue(account.name, `accounts[${index}].name`),
        type: stringValue(account.type, `accounts[${index}].type`) as never,
        currency: stringValue(account.currency, `accounts[${index}].currency`),
        openingBalanceMinor: numberValue(account.openingBalanceMinor, `accounts[${index}].openingBalanceMinor`),
        institution: optionalStringValue(account.institution, `accounts[${index}].institution`),
        isActive: booleanValue(account.isActive, true),
        createdAt: dateValue(account.createdAt, `accounts[${index}].createdAt`),
        updatedAt: dateValue(account.updatedAt, `accounts[${index}].updatedAt`)
      }));
      await createManyInBatches(accountRows, (batch) => tx.account.createMany({ data: batch }));
    }

    if (categories.length > 0) {
      const categoryRows = orderCategoriesParentFirst(
        categories.map((category, index) => ({
          id: stringValue(category.id, `categories[${index}].id`),
          userId,
          parentId: optionalStringValue(category.parentId, `categories[${index}].parentId`),
          name: stringValue(category.name, `categories[${index}].name`),
          type: stringValue(category.type, `categories[${index}].type`) as never,
          color: optionalStringValue(category.color, `categories[${index}].color`),
          icon: optionalStringValue(category.icon, `categories[${index}].icon`),
          createdAt: dateValue(category.createdAt, `categories[${index}].createdAt`),
          updatedAt: dateValue(category.updatedAt, `categories[${index}].updatedAt`)
        }))
      );
      await createManyInBatches(categoryRows, (batch) => tx.category.createMany({ data: batch }));
    }

    if (tags.length > 0) {
      const tagRows = tags.map((tag, index) => ({
        id: stringValue(tag.id, `tags[${index}].id`),
        userId,
        name: stringValue(tag.name, `tags[${index}].name`),
        color: optionalStringValue(tag.color, `tags[${index}].color`),
        createdAt: dateValue(tag.createdAt, `tags[${index}].createdAt`),
        updatedAt: dateValue(tag.updatedAt, `tags[${index}].updatedAt`)
      }));
      await createManyInBatches(tagRows, (batch) => tx.tag.createMany({ data: batch }));
    }

    const transactionRows = transactions.map((transaction, index) => ({
      id: stringValue(transaction.id, `transactions[${index}].id`),
      userId,
      type: stringValue(transaction.type, `transactions[${index}].type`) as never,
      date: dateValue(transaction.date, `transactions[${index}].date`),
      amountMinor: numberValue(transaction.amountMinor, `transactions[${index}].amountMinor`),
      sourceAccountId: optionalStringValue(transaction.sourceAccountId, `transactions[${index}].sourceAccountId`),
      destinationAccountId: optionalStringValue(transaction.destinationAccountId, `transactions[${index}].destinationAccountId`),
      categoryId: optionalStringValue(transaction.categoryId, `transactions[${index}].categoryId`),
      description: optionalStringValue(transaction.description, `transactions[${index}].description`),
      notes: optionalStringValue(transaction.notes, `transactions[${index}].notes`),
      createdAt: dateValue(transaction.createdAt, `transactions[${index}].createdAt`),
      updatedAt: dateValue(transaction.updatedAt, `transactions[${index}].updatedAt`)
    }));
    await createManyInBatches(transactionRows, (batch) => tx.transaction.createMany({ data: batch }));

    const transactionTagRows = transactions.flatMap((transaction, index) =>
      (Array.isArray(transaction.tagIds) ? Array.from(new Set(transaction.tagIds)) : []).map((tagId) => ({
        transactionId: stringValue(transaction.id, `transactions[${index}].id`),
        tagId: stringValue(tagId, `transactions[${index}].tagIds`),
        userId
      }))
    );
    await createManyInBatches(transactionTagRows, (batch) => tx.transactionTag.createMany({ data: batch, skipDuplicates: true }));

    if (budgets.length > 0) {
      const budgetRows = budgets.map((budget, index) => ({
        id: stringValue(budget.id, `budgets[${index}].id`),
        userId,
        categoryId: stringValue(budget.categoryId, `budgets[${index}].categoryId`),
        month: dateValue(budget.month, `budgets[${index}].month`),
        amountMinor: numberValue(budget.amountMinor, `budgets[${index}].amountMinor`),
        createdAt: dateValue(budget.createdAt, `budgets[${index}].createdAt`),
        updatedAt: dateValue(budget.updatedAt, `budgets[${index}].updatedAt`)
      }));
      await createManyInBatches(budgetRows, (batch) => tx.budget.createMany({ data: batch }));
    }

    const ruleRows = rules.map((rule, index) => ({
      id: stringValue(rule.id, `rules[${index}].id`),
      userId,
      categoryId: stringValue(rule.categoryId, `rules[${index}].categoryId`),
      name: stringValue(rule.name, `rules[${index}].name`),
      matchText: stringValue(rule.matchText, `rules[${index}].matchText`),
      priority: typeof rule.priority === "undefined" ? index * 10 : numberValue(rule.priority, `rules[${index}].priority`),
      isActive: booleanValue(rule.isActive, true),
      createdAt: dateValue(rule.createdAt, `rules[${index}].createdAt`),
      updatedAt: dateValue(rule.updatedAt, `rules[${index}].updatedAt`)
    }));
    await createManyInBatches(ruleRows, (batch) => tx.rule.createMany({ data: batch }));

    const ruleTagRows = rules.flatMap((rule, index) =>
      (Array.isArray(rule.tagIds) ? Array.from(new Set(rule.tagIds)) : []).map((tagId) => ({
        ruleId: stringValue(rule.id, `rules[${index}].id`),
        tagId: stringValue(tagId, `rules[${index}].tagIds`),
        userId
      }))
    );
    await createManyInBatches(ruleTagRows, (batch) => tx.ruleTag.createMany({ data: batch, skipDuplicates: true }));

    if (recurringTransactions.length > 0) {
      const recurringRows = recurringTransactions.map((recurring, index) => ({
        id: stringValue(recurring.id, `recurringTransactions[${index}].id`),
        userId,
        name: stringValue(recurring.name, `recurringTransactions[${index}].name`),
        type: stringValue(recurring.type, `recurringTransactions[${index}].type`) as never,
        amountMinor: numberValue(recurring.amountMinor, `recurringTransactions[${index}].amountMinor`),
        sourceAccountId: optionalStringValue(recurring.sourceAccountId, `recurringTransactions[${index}].sourceAccountId`),
        destinationAccountId: optionalStringValue(
          recurring.destinationAccountId,
          `recurringTransactions[${index}].destinationAccountId`
        ),
        categoryId: optionalStringValue(recurring.categoryId, `recurringTransactions[${index}].categoryId`),
        description: optionalStringValue(recurring.description, `recurringTransactions[${index}].description`),
        notes: optionalStringValue(recurring.notes, `recurringTransactions[${index}].notes`),
        frequency: (optionalStringValue(recurring.frequency, `recurringTransactions[${index}].frequency`) ?? "monthly") as never,
        nextDate: dateValue(recurring.nextDate, `recurringTransactions[${index}].nextDate`),
        isActive: booleanValue(recurring.isActive, true),
        createdAt: dateValue(recurring.createdAt, `recurringTransactions[${index}].createdAt`),
        updatedAt: dateValue(recurring.updatedAt, `recurringTransactions[${index}].updatedAt`)
      }));
      await createManyInBatches(recurringRows, (batch) => tx.recurringTransaction.createMany({ data: batch }));
    }

    if (assets.length > 0) {
      const assetRows = assets.map((asset, index) => ({
        id: stringValue(asset.id, `assets[${index}].id`),
        userId,
        symbol: stringValue(asset.symbol, `assets[${index}].symbol`),
        name: stringValue(asset.name, `assets[${index}].name`),
        type: stringValue(asset.type, `assets[${index}].type`) as never,
        currency: stringValue(asset.currency, `assets[${index}].currency`),
        isActive: booleanValue(asset.isActive, true),
        createdAt: dateValue(asset.createdAt, `assets[${index}].createdAt`),
        updatedAt: dateValue(asset.updatedAt, `assets[${index}].updatedAt`)
      }));
      await createManyInBatches(assetRows, (batch) => tx.asset.createMany({ data: batch }));
    }

    if (assetPrices.length > 0) {
      const assetPriceRows = assetPrices.map((assetPrice, index) => ({
        id: stringValue(assetPrice.id, `assetPrices[${index}].id`),
        userId,
        assetId: stringValue(assetPrice.assetId, `assetPrices[${index}].assetId`),
        date: dateValue(assetPrice.date, `assetPrices[${index}].date`),
        priceMinor: numberValue(assetPrice.priceMinor, `assetPrices[${index}].priceMinor`),
        createdAt: dateValue(assetPrice.createdAt, `assetPrices[${index}].createdAt`),
        updatedAt: dateValue(assetPrice.updatedAt, `assetPrices[${index}].updatedAt`)
      }));
      await createManyInBatches(assetPriceRows, (batch) => tx.assetPrice.createMany({ data: batch }));
    }

    if (holdings.length > 0) {
      const holdingRows = holdings.map((holding, index) => ({
        id: stringValue(holding.id, `holdings[${index}].id`),
        userId,
        accountId: stringValue(holding.accountId, `holdings[${index}].accountId`),
        assetId: stringValue(holding.assetId, `holdings[${index}].assetId`),
        quantity: stringValue(holding.quantity, `holdings[${index}].quantity`),
        averageCostMinor: numberValue(holding.averageCostMinor, `holdings[${index}].averageCostMinor`),
        notes: optionalStringValue(holding.notes, `holdings[${index}].notes`),
        createdAt: dateValue(holding.createdAt, `holdings[${index}].createdAt`),
        updatedAt: dateValue(holding.updatedAt, `holdings[${index}].updatedAt`)
      }));
      await createManyInBatches(holdingRows, (batch) => tx.holding.createMany({ data: batch }));
    }

    if (investmentTransactions.length > 0) {
      const investmentTransactionRows = investmentTransactions.map((investmentTransaction, index) => ({
        id: stringValue(investmentTransaction.id, `investmentTransactions[${index}].id`),
        userId,
        accountId: stringValue(investmentTransaction.accountId, `investmentTransactions[${index}].accountId`),
        cashAccountId: optionalStringValue(investmentTransaction.cashAccountId, `investmentTransactions[${index}].cashAccountId`),
        assetId: stringValue(investmentTransaction.assetId, `investmentTransactions[${index}].assetId`),
        type: stringValue(investmentTransaction.type, `investmentTransactions[${index}].type`) as never,
        date: dateValue(investmentTransaction.date, `investmentTransactions[${index}].date`),
        quantity:
          typeof investmentTransaction.quantity === "undefined" || investmentTransaction.quantity === null
            ? null
            : stringValue(investmentTransaction.quantity, `investmentTransactions[${index}].quantity`),
        priceMinor:
          typeof investmentTransaction.priceMinor === "undefined" || investmentTransaction.priceMinor === null
            ? null
            : numberValue(investmentTransaction.priceMinor, `investmentTransactions[${index}].priceMinor`),
        amountMinor: numberValue(investmentTransaction.amountMinor, `investmentTransactions[${index}].amountMinor`),
        cashAmountMinor:
          typeof investmentTransaction.cashAmountMinor === "undefined"
            ? numberValue(investmentTransaction.amountMinor, `investmentTransactions[${index}].amountMinor`)
            : numberValue(investmentTransaction.cashAmountMinor, `investmentTransactions[${index}].cashAmountMinor`),
        notes: optionalStringValue(investmentTransaction.notes, `investmentTransactions[${index}].notes`),
        createdAt: dateValue(investmentTransaction.createdAt, `investmentTransactions[${index}].createdAt`),
        updatedAt: dateValue(investmentTransaction.updatedAt, `investmentTransactions[${index}].updatedAt`)
      }));
      await createManyInBatches(investmentTransactionRows, (batch) => tx.investmentTransaction.createMany({ data: batch }));
    }

    await tx.user.update({
      where: { id: userId },
      data: { investmentProjectionVersion: 0 }
    });
  }, {
    maxWait: bulkWorkflowTransactionMaxWaitMs,
    timeout: bulkWorkflowTransactionTimeoutMs
  });

  return preview;
}
