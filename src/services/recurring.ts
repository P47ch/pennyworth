import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type RecurringFrequency, type TransactionType } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { loadConfig } from "../lib/config.js";
import { validateRecurringSettings } from "../lib/recurringSettings.js";
import { calculateRecurringAmounts, nextRecurringDate, type RecurringAmountMode, type RecurringFeeAccount } from "../finance/recurring.js";
import { assertPrimaryCurrency } from "../finance/currency.js";
import { getAccountBalanceMap } from "../queries/accountBalances.js";
import { createTransaction, transactionTypes } from "./transactions.js";
import { assertCategorySupportsTransaction, lockCategoriesForUse, lockCategoryForUse } from "./relationshipValidation.js";

export { recurringFrequencies } from "../finance/recurring.js";
const recurringInclude = { sourceAccount: true, destinationAccount: true, category: true, feeCategory: true };
export function addOneMonth(date: Date): Date { return nextRecurringDate(date, "monthly"); }

export type RecurringInput = {
  userId: string; name: string; type: TransactionType; amountMinor: number | null;
  amountMode?: RecurringAmountMode; targetBalanceMinor?: number | null;
  feeAmountMinor?: number; feeAccount?: RecurringFeeAccount; feeCategoryId?: string;
  sourceAccountId?: string; destinationAccountId?: string; categoryId?: string;
  description?: string; notes?: string; frequency: RecurringFrequency; nextDate: Date; isActive: boolean;
};

function assertRecurringWriteName(name: string, existingName?: string) {
  const trimmed = name.trim();
  if (!trimmed || (trimmed.length > 100 && trimmed !== existingName?.trim())) {
    throw new Error("Name must contain between 1 and 100 characters.");
  }
}
async function assertRecurringReferences(input: RecurringInput, tx: Prisma.TransactionClient) {
  if (!transactionTypes.includes(input.type)) throw new Error("Choose a valid transaction type.");
  if (!Number.isFinite(input.nextDate.getTime())) throw new Error("Choose a valid next date.");
  validateRecurringSettings({ ...input, amountMode: input.amountMode ?? "fixed", targetBalanceMinor: input.targetBalanceMinor ?? null,
    feeAmountMinor: input.feeAmountMinor ?? 0, feeAccount: input.feeAccount ?? "source" });
  if (!input.sourceAccountId) throw new Error("Choose an account.");
  if (input.type === "transfer" && !input.destinationAccountId) throw new Error("Transfers require source and destination accounts.");
  if (input.type === "transfer" && input.sourceAccountId === input.destinationAccountId) throw new Error("Transfer accounts must be different.");
  const ids = [...new Set([input.sourceAccountId, input.type === "transfer" ? input.destinationAccountId : undefined].filter((id): id is string => Boolean(id)))];
  const accounts = await tx.account.findMany({ where: { userId: input.userId, id: { in: ids } } });
  if (accounts.length !== ids.length) throw new Error("Choose valid accounts.");
  for (const account of accounts) assertPrimaryCurrency(account.currency, loadConfig().primaryCurrency, "accounts");
  await lockCategoriesForUse(input.userId, [input.categoryId, input.feeCategoryId].filter((id): id is string => Boolean(id)), tx);
  for (const [id, type] of [[input.type === "transfer" ? undefined : input.categoryId, input.type], [input.feeCategoryId, "expense"]] as const) {
    if (!id) continue;
    const category = await lockCategoryForUse(input.userId, id, tx);
    if (!category) throw new Error("Choose a valid category.");
    assertCategorySupportsTransaction(category.type, type);
  }
}
function recurringData(input: RecurringInput) {
  return {
    name: input.name.trim(), type: input.type, amountMinor: input.amountMinor,
    amountMode: input.amountMode ?? "fixed", targetBalanceMinor: input.targetBalanceMinor ?? null,
    feeAmountMinor: input.feeAmountMinor ?? 0, feeAccount: input.feeAccount ?? "source", feeCategoryId: input.feeCategoryId || null,
    sourceAccountId: input.sourceAccountId || null, destinationAccountId: input.type === "transfer" ? input.destinationAccountId || null : null,
    categoryId: input.type === "transfer" ? null : input.categoryId || null,
    description: input.description || null, notes: input.notes || null, frequency: input.frequency,
    nextDate: input.nextDate, isActive: input.isActive
  };
}
export function listRecurringTransactions(userId: string) {
  return prisma.recurringTransaction.findMany({ where: { userId }, include: recurringInclude,
    orderBy: [{ isActive: "desc" }, { nextDate: "asc" }, { name: "asc" }] });
}
export function getRecurringForUser(userId: string, recurringId: string) {
  return prisma.recurringTransaction.findFirst({ where: { id: recurringId, userId }, include: recurringInclude });
}
export function createRecurringTransaction(input: RecurringInput) {
  return prisma.$transaction(async (tx) => {
    assertRecurringWriteName(input.name);
    await assertRecurringReferences(input, tx);
    return tx.recurringTransaction.create({ data: { userId: input.userId, ...recurringData(input) } });
  });
}
export function updateRecurringTransaction(input: RecurringInput & { recurringId: string }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.recurringTransaction.findFirst({ where: { id: input.recurringId, userId: input.userId } });
    if (!existing) throw new Error("Recurring transaction not found.");
    assertRecurringWriteName(input.name, existing.name);
    await lockCategoriesForUse(input.userId, [existing.categoryId, existing.feeCategoryId].filter((id): id is string => Boolean(id)), tx);
    await assertRecurringReferences(input, tx);
    return tx.recurringTransaction.update({ where: { id: input.recurringId, userId: input.userId }, data: recurringData(input) });
  });
}
export function deleteRecurringTransaction(userId: string, recurringId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.recurringTransaction.findFirst({ where: { id: recurringId, userId } });
    if (!existing) throw new Error("Recurring transaction not found.");
    await lockCategoriesForUse(userId, [existing.categoryId, existing.feeCategoryId].filter((id): id is string => Boolean(id)), tx);
    await tx.recurringTransaction.delete({ where: { id: recurringId, userId } });
  });
}

export type RecurringFeeOverride = { feeAmountMinor?: number; feeAccount?: RecurringFeeAccount };
async function buildPreview(userId: string, recurringId: string, overrides: RecurringFeeOverride, tx: Prisma.TransactionClient) {
  const recurring = await tx.recurringTransaction.findFirst({ where: { id: recurringId, userId }, include: recurringInclude });
  if (!recurring) throw new Error("Recurring transaction not found.");
  if (!recurring.isActive) throw new Error("Recurring transaction is inactive.");
  const feeAmountMinor = overrides.feeAmountMinor ?? recurring.feeAmountMinor;
  const feeAccount = overrides.feeAccount ?? recurring.feeAccount;
  await assertRecurringReferences({ ...recurring, sourceAccountId: recurring.sourceAccountId ?? undefined,
    destinationAccountId: recurring.destinationAccountId ?? undefined, categoryId: recurring.categoryId ?? undefined,
    feeCategoryId: recurring.feeCategoryId ?? undefined, description: recurring.description ?? undefined,
    notes: recurring.notes ?? undefined, feeAmountMinor, feeAccount }, tx);
  const balances = await getAccountBalanceMap(userId, tx, recurring.nextDate);
  const destinationBalanceMinor = recurring.destinationAccountId ? balances.get(recurring.destinationAccountId) ?? 0 : 0;
  const amounts = calculateRecurringAmounts({ amountMode: recurring.amountMode, amountMinor: recurring.amountMinor,
    targetBalanceMinor: recurring.targetBalanceMinor, destinationBalanceMinor, feeAmountMinor, feeAccount });
  const signature = createHmac("sha256", loadConfig().sessionSecret).update(JSON.stringify([
    "recurring-preview-v1", userId, recurringId, recurring.updatedAt.toISOString(), recurring.nextDate.toISOString(),
    recurring.sourceAccountId, recurring.destinationAccountId, recurring.feeCategoryId, amounts, feeAccount,
    feeAmountMinor, destinationBalanceMinor
  ])).digest("hex");
  return { recurring, ...amounts, destinationBalanceMinor, feeAccount, requestedFeeAmountMinor: feeAmountMinor,
    nextDate: nextRecurringDate(recurring.nextDate, recurring.frequency), signature };
}
export type RecurringPreview = Awaited<ReturnType<typeof buildPreview>>;
async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
}
export function previewRecurringTransaction(userId: string, recurringId: string, overrides: RecurringFeeOverride = {}) {
  return serializable((tx) => buildPreview(userId, recurringId, overrides, tx));
}
export type RecurringConfirmation = RecurringFeeOverride & { expectedDate: Date; expectedRevision: string; signature: string };
export class RecurringPreviewChangedError extends Error {
  constructor() { super("This preview changed or the occurrence was already processed. Review it before confirming again."); }
}
function assertConfirmation(preview: RecurringPreview, confirmation: RecurringConfirmation) {
  const expected = Buffer.from(preview.signature, "hex");
  const submitted = /^[a-f0-9]{64}$/.test(confirmation.signature) ? Buffer.from(confirmation.signature, "hex") : Buffer.alloc(0);
  if (preview.recurring.nextDate.getTime() !== confirmation.expectedDate.getTime()
    || preview.recurring.updatedAt.toISOString() !== confirmation.expectedRevision
    || submitted.length !== expected.length || !timingSafeEqual(expected, submitted)) throw new RecurringPreviewChangedError();
}
export function generateRecurringTransaction(userId: string, recurringId: string, confirmation?: RecurringConfirmation) {
  return serializable(async (tx) => {
    const preview = await buildPreview(userId, recurringId, confirmation ?? {}, tx);
    if (confirmation) assertConfirmation(preview, confirmation);
    else if (preview.recurring.amountMode !== "fixed" || preview.feeAmountMinor !== 0) throw new Error("Preview this recurring transfer before confirming.");
    if (preview.transferAmountMinor === 0) throw new Error("No top-up is needed. Skip this occurrence instead.");
    const recurring = preview.recurring;
    const advance = await tx.recurringTransaction.updateMany({ where: { id: recurringId, userId, nextDate: recurring.nextDate,
      updatedAt: recurring.updatedAt, isActive: true }, data: { nextDate: preview.nextDate } });
    if (advance.count !== 1) throw new RecurringPreviewChangedError();
    const transaction = await createTransaction({ userId, type: recurring.type, date: recurring.nextDate,
      amountMinor: preview.transferAmountMinor, sourceAccountId: recurring.sourceAccountId ?? undefined,
      destinationAccountId: recurring.destinationAccountId ?? undefined, categoryId: recurring.categoryId ?? undefined,
      description: recurring.description ?? recurring.name, notes: recurring.notes ?? undefined, tagIds: [] }, tx);
    if (preview.feeAmountMinor > 0) {
      await createTransaction({ userId, type: "expense", date: recurring.nextDate, amountMinor: preview.feeAmountMinor,
        sourceAccountId: (preview.feeAccount === "source" ? recurring.sourceAccountId : recurring.destinationAccountId) ?? undefined,
        categoryId: recurring.feeCategoryId ?? undefined, description: `${recurring.name} - Top-up fee`,
        feeForTransactionId: transaction.id, applyRules: false, tagIds: [] }, tx);
    }
    return transaction;
  });
}
export function skipRecurringOccurrence(userId: string, recurringId: string, confirmation: RecurringConfirmation) {
  return serializable(async (tx) => {
    const preview = await buildPreview(userId, recurringId, confirmation, tx);
    assertConfirmation(preview, confirmation);
    if (preview.transferAmountMinor !== 0) throw new Error("Only a zero-value top-up can be skipped here.");
    const advance = await tx.recurringTransaction.updateMany({ where: { id: recurringId, userId,
      nextDate: preview.recurring.nextDate, updatedAt: preview.recurring.updatedAt, isActive: true }, data: { nextDate: preview.nextDate } });
    if (advance.count !== 1) throw new RecurringPreviewChangedError();
  });
}
