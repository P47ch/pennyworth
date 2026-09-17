export type BudgetInput = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  amountMinor: number;
};

export type BudgetTransactionInput = {
  type: "income" | "expense" | "transfer";
  amountMinor: number;
  categoryId: string | null;
  date: Date;
};

export type BudgetProgress = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  amountMinor: number;
  spentMinor: number;
  remainingMinor: number;
  percentUsed: number;
  isOverBudget: boolean;
};

export type CategorySpendingInput = {
  categoryId: string;
  amountMinor: number;
};

export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function monthInputValue(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseBudgetMonth(input: string): Date {
  if (!/^\d{4}-\d{2}$/.test(input)) {
    throw new Error("Choose a valid budget month.");
  }

  const [year, month] = input.split("-").map(Number);

  if (month < 1 || month > 12) {
    throw new Error("Choose a valid budget month.");
  }

  return new Date(Date.UTC(year, month - 1, 1));
}

export function calculateBudgetProgress(
  budgets: BudgetInput[],
  transactions: BudgetTransactionInput[],
  month: Date
): BudgetProgress[] {
  const start = monthStart(month);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const spentByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "expense" || !transaction.categoryId) {
      continue;
    }

    if (transaction.date < start || transaction.date >= end) {
      continue;
    }

    spentByCategory.set(transaction.categoryId, (spentByCategory.get(transaction.categoryId) ?? 0) + transaction.amountMinor);
  }

  return calculateBudgetProgressFromSpending(
    budgets,
    Array.from(spentByCategory, ([categoryId, amountMinor]) => ({ categoryId, amountMinor }))
  );
}

export function calculateBudgetProgressFromSpending(
  budgets: BudgetInput[],
  categorySpending: CategorySpendingInput[]
): BudgetProgress[] {
  const spentByCategory = new Map(categorySpending.map((item) => [item.categoryId, item.amountMinor]));

  return budgets
    .map((budget) => {
      const spentMinor = spentByCategory.get(budget.categoryId) ?? 0;
      const remainingMinor = budget.amountMinor - spentMinor;

      return {
        ...budget,
        spentMinor,
        remainingMinor,
        percentUsed: budget.amountMinor > 0 ? spentMinor / budget.amountMinor : 0,
        isOverBudget: spentMinor > budget.amountMinor
      };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed);
}
