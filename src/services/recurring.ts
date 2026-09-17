import type { Prisma, RecurringFrequency, TransactionType } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { createTransaction, transactionTypes } from "./transactions.js";
import {
  assertCategorySupportsTransaction,
  lockCategoriesForUse,
  lockCategoryForUse
} from "./relationshipValidation.js";

export const recurringFrequencies: RecurringFrequency[] = ["monthly"];

const recurringInclude = {
  sourceAccount: true,
  destinationAccount: true,
  category: true
};

export function addOneMonth(date: Date): Date {
  const nextYear = date.getUTCMonth() === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
  const nextMonth = (date.getUTCMonth() + 1) % 12;
  const originalDay = date.getUTCDate();
  const lastDayOfNextMonth = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    Math.min(originalDay, lastDayOfNextMonth),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  ));
}

async function assertRecurringReferences(input: {
  userId: string;
  type: TransactionType;
  sourceAccountId?: string;
  destinationAccountId?: string;
  categoryId?: string;
}, db: typeof prisma | Prisma.TransactionClient = prisma) {
  if (!transactionTypes.includes(input.type)) {
    throw new Error("Choose a valid transaction type.");
  }

  if ((input.type === "income" || input.type === "expense") && !input.sourceAccountId) {
    throw new Error("Choose an account.");
  }

  if (input.type === "transfer" && (!input.sourceAccountId || !input.destinationAccountId)) {
    throw new Error("Transfers require source and destination accounts.");
  }

  if (input.type === "transfer" && input.sourceAccountId === input.destinationAccountId) {
    throw new Error("Transfer accounts must be different.");
  }

  const accountIds = [input.sourceAccountId, input.type === "transfer" ? input.destinationAccountId : undefined].filter(
    (id): id is string => Boolean(id)
  );

  if (accountIds.length > 0) {
    const accountCount = await db.account.count({
      where: { userId: input.userId, id: { in: Array.from(new Set(accountIds)) } }
    });

    if (accountCount !== Array.from(new Set(accountIds)).length) {
      throw new Error("Choose valid accounts.");
    }
  }

  if (input.type !== "transfer" && input.categoryId) {
    const category = await lockCategoryForUse(input.userId, input.categoryId, db);

    if (!category) {
      throw new Error("Choose a valid category.");
    }

    assertCategorySupportsTransaction(category.type, input.type);
  }
}

export async function listRecurringTransactions(userId: string) {
  return prisma.recurringTransaction.findMany({
    where: { userId },
    include: recurringInclude,
    orderBy: [{ isActive: "desc" }, { nextDate: "asc" }, { name: "asc" }]
  });
}

export async function getRecurringForUser(userId: string, recurringId: string) {
  return prisma.recurringTransaction.findFirst({
    where: { id: recurringId, userId },
    include: recurringInclude
  });
}

export async function createRecurringTransaction(input: {
  userId: string;
  name: string;
  type: TransactionType;
  amountMinor: number;
  sourceAccountId?: string;
  destinationAccountId?: string;
  categoryId?: string;
  description?: string;
  notes?: string;
  frequency: RecurringFrequency;
  nextDate: Date;
  isActive: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    await assertRecurringReferences(input, tx);

    return tx.recurringTransaction.create({
      data: {
        userId: input.userId,
        name: input.name,
        type: input.type,
        amountMinor: input.amountMinor,
        sourceAccountId: input.sourceAccountId || null,
        destinationAccountId: input.type === "transfer" ? input.destinationAccountId || null : null,
        categoryId: input.type === "transfer" ? null : input.categoryId || null,
        description: input.description || null,
        notes: input.notes || null,
        frequency: input.frequency,
        nextDate: input.nextDate,
        isActive: input.isActive
      }
    });
  });
}

export async function updateRecurringTransaction(input: {
  userId: string;
  recurringId: string;
  name: string;
  type: TransactionType;
  amountMinor: number;
  sourceAccountId?: string;
  destinationAccountId?: string;
  categoryId?: string;
  description?: string;
  notes?: string;
  frequency: RecurringFrequency;
  nextDate: Date;
  isActive: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const recurring = await tx.recurringTransaction.findFirst({
      where: { id: input.recurringId, userId: input.userId },
      select: { categoryId: true }
    });

    if (!recurring) {
      throw new Error("Recurring transaction not found.");
    }

    await lockCategoriesForUse(
      input.userId,
      [recurring.categoryId, input.type === "transfer" ? null : input.categoryId].filter(
        (categoryId): categoryId is string => Boolean(categoryId)
      ),
      tx
    );
    await assertRecurringReferences(input, tx);

    return tx.recurringTransaction.update({
      where: { id: input.recurringId, userId: input.userId },
      data: {
        name: input.name,
        type: input.type,
        amountMinor: input.amountMinor,
        sourceAccountId: input.sourceAccountId || null,
        destinationAccountId: input.type === "transfer" ? input.destinationAccountId || null : null,
        categoryId: input.type === "transfer" ? null : input.categoryId || null,
        description: input.description || null,
        notes: input.notes || null,
        frequency: input.frequency,
        nextDate: input.nextDate,
        isActive: input.isActive
      }
    });
  });
}

export async function deleteRecurringTransaction(userId: string, recurringId: string) {
  await prisma.$transaction(async (tx) => {
    const recurring = await tx.recurringTransaction.findFirst({
      where: { id: recurringId, userId },
      select: { categoryId: true }
    });

    if (!recurring) {
      throw new Error("Recurring transaction not found.");
    }

    if (recurring.categoryId) {
      await lockCategoryForUse(userId, recurring.categoryId, tx);
    }

    await tx.recurringTransaction.delete({ where: { id: recurringId, userId } });
  });
}

export async function generateRecurringTransaction(userId: string, recurringId: string) {
  const recurring = await getRecurringForUser(userId, recurringId);

  if (!recurring) {
    throw new Error("Recurring transaction not found.");
  }

  if (!recurring.isActive) {
    throw new Error("Recurring transaction is inactive.");
  }

  await prisma.$transaction(async (tx) => {
    const nextDate = addOneMonth(recurring.nextDate);
    const advanceResult = await tx.recurringTransaction.updateMany({
      where: { id: recurringId, userId, nextDate: recurring.nextDate, isActive: true },
      data: { nextDate }
    });

    if (advanceResult.count !== 1) {
      throw new Error("Recurring transaction was already generated or is inactive.");
    }

    await createTransaction(
      {
        userId,
        type: recurring.type,
        date: recurring.nextDate,
        amountMinor: recurring.amountMinor,
        sourceAccountId: recurring.sourceAccountId ?? undefined,
        destinationAccountId: recurring.destinationAccountId ?? undefined,
        categoryId: recurring.categoryId ?? undefined,
        description: recurring.description ?? recurring.name,
        notes: recurring.notes ?? undefined,
        tagIds: []
      },
      tx
    );
  });
}
