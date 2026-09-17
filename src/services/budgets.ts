import { calculateBudgetProgress, monthStart } from "../finance/budgets.js";
import { prisma } from "../lib/db.js";
import {
  assertCategorySupportsExpense,
  lockCategoriesForUse,
  lockCategoryForUse
} from "./relationshipValidation.js";

export async function getBudgetPageData(userId: string, month: Date) {
  const normalizedMonth = monthStart(month);
  const nextMonth = new Date(Date.UTC(normalizedMonth.getUTCFullYear(), normalizedMonth.getUTCMonth() + 1, 1));
  const [budgets, categories, transactions] = await Promise.all([
    prisma.budget.findMany({
      where: { userId, month: normalizedMonth },
      include: { category: true },
      orderBy: { category: { name: "asc" } }
    }),
    prisma.category.findMany({
      where: {
        userId,
        type: { in: ["expense", "both"] }
      },
      orderBy: { name: "asc" }
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: normalizedMonth,
          lt: nextMonth
        }
      },
      select: {
        type: true,
        amountMinor: true,
        categoryId: true,
        date: true
      }
    })
  ]);

  return {
    budgets,
    categories,
    progress: calculateBudgetProgress(
      budgets.map((budget) => ({
        id: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        categoryColor: budget.category.color,
        categoryIcon: budget.category.icon,
        amountMinor: budget.amountMinor
      })),
      transactions,
      normalizedMonth
    )
  };
}

export async function getBudgetForUser(userId: string, budgetId: string) {
  return prisma.budget.findFirst({
    where: { id: budgetId, userId },
    include: { category: true }
  });
}

async function assertBudgetCategory(
  userId: string,
  categoryId: string,
  db: typeof prisma | import("@prisma/client").Prisma.TransactionClient = prisma
) {
  const category = await lockCategoryForUse(userId, categoryId, db);

  if (!category) {
    throw new Error("Choose a valid expense category.");
  }

  assertCategorySupportsExpense(category.type);
}

export async function createBudget(input: { userId: string; categoryId: string; month: Date; amountMinor: number }) {
  return prisma.$transaction(async (tx) => {
    await assertBudgetCategory(input.userId, input.categoryId, tx);

    return tx.budget.create({
      data: {
        userId: input.userId,
        categoryId: input.categoryId,
        month: monthStart(input.month),
        amountMinor: input.amountMinor
      }
    });
  });
}

export async function updateBudget(input: {
  userId: string;
  budgetId: string;
  categoryId: string;
  month: Date;
  amountMinor: number;
}) {
  return prisma.$transaction(async (tx) => {
    const budget = await tx.budget.findFirst({
      where: { id: input.budgetId, userId: input.userId },
      select: { categoryId: true }
    });

    if (!budget) {
      throw new Error("Budget not found.");
    }

    await lockCategoriesForUse(input.userId, [budget.categoryId, input.categoryId], tx);
    await assertBudgetCategory(input.userId, input.categoryId, tx);

    return tx.budget.update({
      where: { id: input.budgetId, userId: input.userId },
      data: {
        categoryId: input.categoryId,
        month: monthStart(input.month),
        amountMinor: input.amountMinor
      }
    });
  });
}

export async function deleteBudget(userId: string, budgetId: string) {
  await prisma.$transaction(async (tx) => {
    const budget = await tx.budget.findFirst({
      where: { id: budgetId, userId },
      select: { categoryId: true }
    });

    if (!budget) {
      throw new Error("Budget not found.");
    }

    await lockCategoryForUse(userId, budget.categoryId, tx);
    await tx.budget.delete({ where: { id: budgetId, userId } });
  });
}
