export type SummaryTransaction = {
  type: "income" | "expense" | "transfer";
  amountMinor: number;
  date: Date;
  categoryName?: string | null;
};

export function summarizeMonth(transactions: SummaryTransaction[], month: Date) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  let incomeMinor = 0;
  let expensesMinor = 0;

  for (const transaction of transactions) {
    if (transaction.date.getUTCFullYear() !== year || transaction.date.getUTCMonth() !== monthIndex) {
      continue;
    }

    if (transaction.type === "income") {
      incomeMinor += transaction.amountMinor;
    }

    if (transaction.type === "expense") {
      expensesMinor += transaction.amountMinor;
    }
  }

  return {
    incomeMinor,
    expensesMinor,
    netCashflowMinor: incomeMinor - expensesMinor
  };
}

export function spendingByCategory(transactions: SummaryTransaction[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "expense") {
      continue;
    }

    const category = transaction.categoryName ?? "Uncategorized";
    totals.set(category, (totals.get(category) ?? 0) + transaction.amountMinor);
  }

  return totals;
}
