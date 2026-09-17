import type { AccountType, CategoryType, Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../lib/db.js";

export const investmentAccountTypes = ["investment", "crypto_wallet"] as const;

type Database = Prisma.TransactionClient | typeof prisma;

export type LockedCategory = {
  id: string;
  type: CategoryType;
};

export type LockedAccount = {
  id: string;
  type: AccountType;
};

/**
 * Lock a category while a dependent record is validated and written. The
 * category edit path uses FOR UPDATE, so these locks make the validation and
 * dependent write serialize with category type changes.
 */
export async function lockCategoryForUse(
  userId: string,
  categoryId: string,
  db: Database = prisma
): Promise<LockedCategory | null> {
  const rows = await db.$queryRaw<LockedCategory[]>`
    SELECT "id", "type"
    FROM "Category"
    WHERE "id" = ${categoryId} AND "userId" = ${userId}
    FOR KEY SHARE
  `;

  return rows[0] ?? null;
}

export async function lockCategoriesForUse(
  userId: string,
  categoryIds: string[],
  db: Database = prisma
): Promise<Map<string, LockedCategory>> {
  const locked = new Map<string, LockedCategory>();

  for (const categoryId of Array.from(new Set(categoryIds)).sort()) {
    const category = await lockCategoryForUse(userId, categoryId, db);

    if (category) {
      locked.set(category.id, category);
    }
  }

  return locked;
}

/**
 * Lock an investment account while a holding or investment activity record is
 * validated and written. Account type changes use FOR UPDATE and therefore
 * cannot pass this lock while the dependent write is in flight.
 */
export async function lockAccountForInvestmentUse(
  userId: string,
  accountId: string,
  db: Database = prisma
): Promise<LockedAccount | null> {
  const rows = await db.$queryRaw<LockedAccount[]>`
    SELECT "id", "type"
    FROM "Account"
    WHERE "id" = ${accountId} AND "userId" = ${userId}
    FOR KEY SHARE
  `;

  return rows[0] ?? null;
}

export async function lockAccountsForInvestmentUse(
  userId: string,
  accountIds: string[],
  db: Database = prisma
): Promise<Map<string, LockedAccount>> {
  const locked = new Map<string, LockedAccount>();

  for (const accountId of Array.from(new Set(accountIds)).sort()) {
    const account = await lockAccountForInvestmentUse(userId, accountId, db);

    if (account) {
      locked.set(account.id, account);
    }
  }

  return locked;
}

export type CategoryDependencyCounts = {
  transactions: number;
  budgets: number;
  rules: number;
  recurringTransactions: number;
};

export type AccountDependencyCounts = {
  holdings: number;
  investmentTransactions: number;
};

export function categorySupportsTransactionType(categoryType: CategoryType, transactionType: TransactionType) {
  return transactionType === "income"
    ? categoryType === "income" || categoryType === "both"
    : transactionType === "expense"
      ? categoryType === "expense" || categoryType === "both"
      : false;
}

export function categorySupportsExpenseUse(categoryType: CategoryType) {
  return categoryType === "expense" || categoryType === "both";
}

export function categoryDependencyCountsForType(
  categoryType: CategoryType,
  dependencies: CategoryDependencyCounts
) {
  if (categoryType === "both") {
    return {
      transactions: 0,
      budgets: 0,
      rules: 0,
      recurringTransactions: 0
    };
  }

  return {
    transactions: dependencies.transactions,
    budgets: categoryType === "income" ? dependencies.budgets : 0,
    rules: categoryType === "income" ? dependencies.rules : 0,
    recurringTransactions: dependencies.recurringTransactions
  };
}

export function assertCategoryTypeDependencies(
  categoryType: CategoryType,
  dependencies: CategoryDependencyCounts,
  label = "Category"
) {
  const incompatible = categoryDependencyCountsForType(categoryType, dependencies);
  const details: string[] = [];

  if (incompatible.transactions > 0) {
    details.push(`${incompatible.transactions} transaction${incompatible.transactions === 1 ? "" : "s"}`);
  }

  if (incompatible.budgets > 0) {
    details.push(`${incompatible.budgets} budget${incompatible.budgets === 1 ? "" : "s"}`);
  }

  if (incompatible.rules > 0) {
    details.push(`${incompatible.rules} categorization rule${incompatible.rules === 1 ? "" : "s"}`);
  }

  if (incompatible.recurringTransactions > 0) {
    details.push(
      `${incompatible.recurringTransactions} recurring transaction${incompatible.recurringTransactions === 1 ? "" : "s"}`
    );
  }

  if (details.length > 0) {
    throw new Error(`${label} type change is incompatible with ${details.join(", ")}. Resolve these dependencies first.`);
  }
}

export async function getCategoryDependencyCounts(
  userId: string,
  categoryId: string,
  nextType: CategoryType,
  db: Database = prisma
): Promise<CategoryDependencyCounts> {
  if (nextType === "both") {
    return { transactions: 0, budgets: 0, rules: 0, recurringTransactions: 0 };
  }

  const [transactions, budgets, rules, recurringTransactions] = await Promise.all([
    db.transaction.count({ where: { userId, categoryId, type: { not: nextType } } }),
    nextType === "income" ? db.budget.count({ where: { userId, categoryId } }) : Promise.resolve(0),
    nextType === "income" ? db.rule.count({ where: { userId, categoryId } }) : Promise.resolve(0),
    db.recurringTransaction.count({ where: { userId, categoryId, type: { not: nextType } } })
  ]);

  return { transactions, budgets, rules, recurringTransactions };
}

export async function assertCategoryTypeChangeCompatible(
  userId: string,
  categoryId: string,
  nextType: CategoryType,
  db: Database = prisma
) {
  const dependencies = await getCategoryDependencyCounts(userId, categoryId, nextType, db);
  assertCategoryTypeDependencies(nextType, dependencies);
}

export function assertCategorySupportsTransaction(
  categoryType: CategoryType,
  transactionType: TransactionType,
  label = "Category"
) {
  if (!categorySupportsTransactionType(categoryType, transactionType)) {
    throw new Error(`${label} type must match the transaction type.`);
  }
}

export function assertCategorySupportsExpense(categoryType: CategoryType, label = "Category") {
  if (!categorySupportsExpenseUse(categoryType)) {
    throw new Error(`${label} must be an expense or both category.`);
  }
}

export function accountSupportsInvestmentActivity(accountType: AccountType | string) {
  return investmentAccountTypes.includes(accountType as (typeof investmentAccountTypes)[number]);
}

export function assertAccountSupportsInvestmentActivity(accountType: AccountType | string, label = "Account") {
  if (!accountSupportsInvestmentActivity(accountType)) {
    throw new Error(`${label} must be an investment or crypto wallet account.`);
  }
}

export async function getAccountDependencyCounts(
  userId: string,
  accountId: string,
  db: Database = prisma
): Promise<AccountDependencyCounts> {
  const [holdings, investmentTransactions] = await Promise.all([
    db.holding.count({ where: { userId, accountId } }),
    db.investmentTransaction.count({ where: { userId, accountId } })
  ]);

  return { holdings, investmentTransactions };
}

export async function assertAccountTypeChangeCompatible(
  userId: string,
  accountId: string,
  nextType: AccountType,
  db: Database = prisma
) {
  if (accountSupportsInvestmentActivity(nextType)) {
    return;
  }

  const dependencies = await getAccountDependencyCounts(userId, accountId, db);
  const details: string[] = [];

  if (dependencies.holdings > 0) {
    details.push(`${dependencies.holdings} holding${dependencies.holdings === 1 ? "" : "s"}`);
  }

  if (dependencies.investmentTransactions > 0) {
    details.push(
      `${dependencies.investmentTransactions} investment activit${dependencies.investmentTransactions === 1 ? "y" : "ies"}`
    );
  }

  if (details.length > 0) {
    throw new Error(`Account type change is incompatible with ${details.join(" and ")}. Resolve these dependencies first.`);
  }
}

export type BackupRelationshipInput = {
  accounts: Array<{ id: string; type: string }>;
  categories: Array<{ id: string; type: string }>;
  transactions: Array<{
    type: string;
    sourceAccountId: string | null;
    destinationAccountId: string | null;
    categoryId: string | null;
  }>;
  budgets: Array<{ categoryId: string }>;
  rules: Array<{ categoryId: string }>;
  recurringTransactions: Array<{
    type: string;
    sourceAccountId: string | null;
    destinationAccountId: string | null;
    categoryId: string | null;
  }>;
  holdings: Array<{ accountId: string }>;
  investmentTransactions: Array<{ accountId: string; cashAccountId: string | null }>;
};

function backupCategory(categories: Map<string, { id: string; type: string }>, categoryId: string) {
  const category = categories.get(categoryId);

  if (!category) {
    return null;
  }

  return category;
}

function backupAccount(accounts: Map<string, { id: string; type: string }>, accountId: string) {
  const account = accounts.get(accountId);

  if (!account) {
    return null;
  }

  return account;
}

export function validateBackupRelationshipSemantics(input: BackupRelationshipInput) {
  const accounts = new Map(input.accounts.map((account) => [account.id, account]));
  const categories = new Map(input.categories.map((category) => [category.id, category]));

  for (const [index, account] of input.accounts.entries()) {
    if (!["bank", "cash", "credit_card", "savings", "investment", "crypto_wallet", "other"].includes(account.type)) {
      throw new Error(`accounts[${index}].type is not supported.`);
    }
  }

  for (const [index, category] of input.categories.entries()) {
    if (!["income", "expense", "both"].includes(category.type)) {
      throw new Error(`categories[${index}].type is not supported.`);
    }
  }

  for (const [index, transaction] of input.transactions.entries()) {
    const label = `transactions[${index}]`;

    if (!["income", "expense", "transfer"].includes(transaction.type)) {
      throw new Error(`${label}.type must be income, expense, or transfer.`);
    }

    if ((transaction.type === "income" || transaction.type === "expense") && !transaction.sourceAccountId) {
      throw new Error(`${label}.sourceAccountId is required for ${transaction.type} transactions.`);
    }

    if (transaction.type === "transfer") {
      if (!transaction.sourceAccountId || !transaction.destinationAccountId) {
        throw new Error(`${label} transfers require sourceAccountId and destinationAccountId.`);
      }

      if (transaction.sourceAccountId === transaction.destinationAccountId) {
        throw new Error(`${label} transfer accounts must be different.`);
      }

      if (transaction.categoryId) {
        throw new Error(`${label}.categoryId must be empty for transfers.`);
      }
    } else if (transaction.destinationAccountId) {
      throw new Error(`${label}.destinationAccountId must be empty for non-transfer transactions.`);
    }

    if (transaction.sourceAccountId && !backupAccount(accounts, transaction.sourceAccountId)) {
      throw new Error(`${label}.sourceAccountId references a missing account.`);
    }

    if (
      transaction.destinationAccountId &&
      !backupAccount(accounts, transaction.destinationAccountId)
    ) {
      throw new Error(`${label}.destinationAccountId references a missing account.`);
    }

    if (transaction.categoryId) {
      const category = backupCategory(categories, transaction.categoryId);

      if (!category) {
        throw new Error(`${label}.categoryId references a missing category.`);
      }

      if ((transaction.type === "income" || transaction.type === "expense") && !categorySupportsTransactionType(category.type as CategoryType, transaction.type)) {
        throw new Error(`${label}.categoryId is incompatible with its transaction type.`);
      }

    }
  }

  for (const [index, budget] of input.budgets.entries()) {
    const category = backupCategory(categories, budget.categoryId);

    if (!category) {
      throw new Error(`budgets[${index}].categoryId references a missing category.`);
    }

    if (!categorySupportsExpenseUse(category.type as CategoryType)) {
      throw new Error(`budgets[${index}].categoryId must reference an expense or both category.`);
    }

  }

  for (const [index, rule] of input.rules.entries()) {
    const category = backupCategory(categories, rule.categoryId);

    if (!category) {
      throw new Error(`rules[${index}].categoryId references a missing category.`);
    }

    if (!categorySupportsExpenseUse(category.type as CategoryType)) {
      throw new Error(`rules[${index}].categoryId must reference an expense or both category.`);
    }

  }

  for (const [index, recurring] of input.recurringTransactions.entries()) {
    const label = `recurringTransactions[${index}]`;

    if (!["income", "expense", "transfer"].includes(recurring.type)) {
      throw new Error(`${label}.type must be income, expense, or transfer.`);
    }

    if (!recurring.sourceAccountId) {
      throw new Error(`${label}.sourceAccountId is required.`);
    }

    if (recurring.type === "transfer") {
      if (!recurring.destinationAccountId) {
        throw new Error(`${label} transfers require destinationAccountId.`);
      }

      if (recurring.sourceAccountId === recurring.destinationAccountId) {
        throw new Error(`${label} transfer accounts must be different.`);
      }

      if (recurring.categoryId) {
        throw new Error(`${label}.categoryId must be empty for transfers.`);
      }
    } else if (recurring.destinationAccountId) {
      throw new Error(`${label}.destinationAccountId must be empty for non-transfer transactions.`);
    }

    if (!backupAccount(accounts, recurring.sourceAccountId)) {
      throw new Error(`${label}.sourceAccountId references a missing account.`);
    }

    if (recurring.destinationAccountId && !backupAccount(accounts, recurring.destinationAccountId)) {
      throw new Error(`${label}.destinationAccountId references a missing account.`);
    }

    if (recurring.categoryId) {
      const category = backupCategory(categories, recurring.categoryId);

      if (!category) {
        throw new Error(`${label}.categoryId references a missing category.`);
      }

      if ((recurring.type === "income" || recurring.type === "expense") && !categorySupportsTransactionType(category.type as CategoryType, recurring.type)) {
        throw new Error(`${label}.categoryId is incompatible with its transaction type.`);
      }

    }
  }

  for (const [index, holding] of input.holdings.entries()) {
    const account = backupAccount(accounts, holding.accountId);

    if (!account) {
      throw new Error(`holdings[${index}].accountId references a missing account.`);
    }

    assertAccountSupportsInvestmentActivity(account.type, `holdings[${index}].accountId`);
  }

  for (const [index, activity] of input.investmentTransactions.entries()) {
    const account = backupAccount(accounts, activity.accountId);

    if (!account) {
      throw new Error(`investmentTransactions[${index}].accountId references a missing account.`);
    }

    assertAccountSupportsInvestmentActivity(account.type, `investmentTransactions[${index}].accountId`);

    if (activity.cashAccountId && !backupAccount(accounts, activity.cashAccountId)) {
      throw new Error(`investmentTransactions[${index}].cashAccountId references a missing account.`);
    }
  }

}
