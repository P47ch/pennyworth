import {
  calculateInvestmentPositionsExact,
  calculatePositionAmountMinorExact,
  safeMoneyBigIntToNumber,
  type InvestmentTransactionInput
} from "./investments.js";

export type StatisticsTransaction = {
  type: "income" | "expense" | "transfer";
  amountMinor: number;
  date: Date;
  categoryName?: string | null;
  categoryId?: string | null;
  currency?: string;
  tagNames?: string[];
  tagIds?: string[];
  description?: string | null;
};

export type MonthlyStat = {
  key: string;
  label: string;
  from: string;
  to: string;
  incomeMinor: number;
  expensesMinor: number;
  netCashflowMinor: number;
  savingsRate: number | null;
};

export type MonthlyTotalInput = {
  monthKey: string;
  incomeMinor: number;
  expensesMinor: number;
};

export type NetWorthHistoryPoint = {
  key: string;
  label: string;
  from: string;
  to: string;
  cashBalanceMinor: number;
  investmentValueMinor: number;
  netWorthMinor: number;
};

export type NetWorthHolding = {
  assetId: string;
  quantity: string | { toString(): string };
};

export type NetWorthAssetPrice = {
  assetId: string;
  date: Date;
  priceMinor: number;
};

export type NetWorthCashBalance = {
  monthKey: string;
  cashBalanceMinor: number;
};

export type MonthlyCategoryExpenseInput = {
  monthKey: string;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon?: string | null;
  amountMinor: number;
};

export type CategorySpendingHistory = {
  months: Array<{ key: string; label: string; from: string; to: string }>;
  series: Array<{
    key: string;
    categoryId: string | null;
    name: string;
    color: string | null;
    icon: string | null;
    totalMinor: number;
    amountsMinor: number[];
  }>;
};

export type AccountBalanceHistoryInput = {
  monthKey: string;
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  balanceMinor: number;
};

export type AccountBalanceHistory = {
  months: Array<{ key: string; label: string; from: string; to: string }>;
  series: Array<{
    accountId: string;
    name: string;
    type: string;
    currency: string;
    balancesMinor: number[];
  }>;
};

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

export function recentMonths(
  count: number,
  endDate = new Date(),
  locale = "en-US"
): Array<{ key: string; label: string; from: string; to: string }> {
  const months = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - offset, 1));
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    const key = monthKey(date);
    months.push({
      key,
      label: monthLabel(date, locale),
      from: `${key}-01`,
      to: `${key}-${String(lastDay).padStart(2, "0")}`
    });
  }

  return months;
}

export function monthlyStats(
  transactions: StatisticsTransaction[],
  count = 12,
  endDate = new Date(),
  locale = "en-US"
): MonthlyStat[] {
  const totalsByMonth = new Map<string, { incomeMinor: number; expensesMinor: number }>();

  for (const transaction of transactions) {
    const key = monthKey(transaction.date);
    const totals = totalsByMonth.get(key) ?? { incomeMinor: 0, expensesMinor: 0 };

    if (transaction.type === "income") {
      totals.incomeMinor += transaction.amountMinor;
    }

    if (transaction.type === "expense") {
      totals.expensesMinor += transaction.amountMinor;
    }

    totalsByMonth.set(key, totals);
  }

  return monthlyStatsFromTotals(
    Array.from(totalsByMonth, ([key, totals]) => ({ monthKey: key, ...totals })),
    count,
    endDate,
    locale
  );
}

export function monthlyStatsFromTotals(
  totals: MonthlyTotalInput[],
  count = 12,
  endDate = new Date(),
  locale = "en-US"
): MonthlyStat[] {
  const totalByMonth = new Map(totals.map((total) => [total.monthKey, total]));

  return recentMonths(count, endDate, locale).map((month) => {
    const total = totalByMonth.get(month.key);
    const incomeMinor = total?.incomeMinor ?? 0;
    const expensesMinor = total?.expensesMinor ?? 0;
    const netCashflowMinor = incomeMinor - expensesMinor;

    return {
      ...month,
      incomeMinor,
      expensesMinor,
      netCashflowMinor,
      savingsRate: incomeMinor > 0 ? netCashflowMinor / incomeMinor : null
    };
  });
}

export function netWorthHistoryFromLedgers(
  months: Array<{ key: string; label: string; from: string; to: string }>,
  cashBalances: NetWorthCashBalance[],
  investmentTransactions: InvestmentTransactionInput[],
  manualHoldings: NetWorthHolding[],
  assetPrices: NetWorthAssetPrice[]
): NetWorthHistoryPoint[] {
  const cashBalanceByMonth = new Map(cashBalances.map((point) => [point.monthKey, point.cashBalanceMinor]));

  return months.map((month) => {
    const [year, monthNumber] = month.key.split("-").map(Number);
    const endExclusive = new Date(Date.UTC(year, monthNumber, 1));
    const latestPriceByAsset = new Map<string, NetWorthAssetPrice>();

    for (const price of assetPrices) {
      if (price.date >= endExclusive) {
        continue;
      }

      const latest = latestPriceByAsset.get(price.assetId);

      if (!latest || price.date > latest.date) {
        latestPriceByAsset.set(price.assetId, price);
      }
    }

    const { positions } = calculateInvestmentPositionsExact(
      investmentTransactions.filter((transaction) => transaction.date < endExclusive)
    );
    const investmentValueMinorExact = [...positions, ...manualHoldings].reduce((total, position) => {
      const latestPrice = latestPriceByAsset.get(position.assetId);
      return total + (latestPrice ? calculatePositionAmountMinorExact(position.quantity, latestPrice.priceMinor) : 0n);
    }, 0n);
    const investmentValueMinor = safeMoneyBigIntToNumber(investmentValueMinorExact, "Investment value in net worth history");
    const cashBalanceMinor = cashBalanceByMonth.get(month.key) ?? 0;

    return {
      ...month,
      cashBalanceMinor,
      investmentValueMinor,
      netWorthMinor: cashBalanceMinor + investmentValueMinor
    };
  });
}

export function categorySpendingHistoryFromTotals(
  months: Array<{ key: string; label: string; from: string; to: string }>,
  totals: MonthlyCategoryExpenseInput[],
  categoryLimit = 5
): CategorySpendingHistory {
  const categoryTotals = new Map<
    string,
    { categoryId: string | null; name: string; color: string | null; icon: string | null; totalMinor: number }
  >();

  for (const total of totals) {
    const key = total.categoryId ? `category:${total.categoryId}` : "uncategorized";
    const current = categoryTotals.get(key) ?? {
      categoryId: total.categoryId,
      name: total.categoryName,
      color: total.categoryColor,
      icon: total.categoryIcon ?? null,
      totalMinor: 0
    };
    current.totalMinor = safeMoneySum(current.totalMinor, total.amountMinor, `Category ${total.categoryName} total`);
    categoryTotals.set(key, current);
  }

  const topCategories = Array.from(categoryTotals.entries())
    .sort(([, left], [, right]) => right.totalMinor - left.totalMinor || left.name.localeCompare(right.name))
    .slice(0, categoryLimit);
  const topCategoryKeys = new Set(topCategories.map(([key]) => key));
  const amountByMonthAndCategory = new Map<string, number>();

  for (const total of totals) {
    const categoryKey = total.categoryId ? `category:${total.categoryId}` : "uncategorized";
    const seriesKey = topCategoryKeys.has(categoryKey) ? categoryKey : "other";
    const valueKey = `${total.monthKey}\u0000${seriesKey}`;
    amountByMonthAndCategory.set(
      valueKey,
      safeMoneySum(
        amountByMonthAndCategory.get(valueKey) ?? 0,
        total.amountMinor,
        `Category spending for ${total.monthKey}`
      )
    );
  }

  const series = topCategories.map(([key, category]) => ({
    key,
    categoryId: category.categoryId,
    name: category.name,
    color: category.color,
    icon: category.icon,
    totalMinor: category.totalMinor,
    amountsMinor: months.map((month) => amountByMonthAndCategory.get(`${month.key}\u0000${key}`) ?? 0)
  }));
  const otherTotalMinor = Array.from(categoryTotals.entries())
    .filter(([key]) => !topCategoryKeys.has(key))
    .reduce(
      (sum, [, category]) => safeMoneySum(sum, category.totalMinor, "Other category total"),
      0
    );

  if (otherTotalMinor > 0) {
    series.push({
      key: "other",
      categoryId: null,
      name: "Other",
      color: null,
      icon: null,
      totalMinor: otherTotalMinor,
      amountsMinor: months.map((month) => amountByMonthAndCategory.get(`${month.key}\u0000other`) ?? 0)
    });
  }

  return { months, series };
}

export function categoryExpenseTotalsFromMonthly(totals: MonthlyCategoryExpenseInput[]) {
  const categoryTotals = new Map<
    string,
    { id: string | null; name: string; color: string | null; icon: string | null; amountMinor: number }
  >();

  for (const total of totals) {
    const key = total.categoryId ? `category:${total.categoryId}` : "uncategorized";
    const current = categoryTotals.get(key) ?? {
      id: total.categoryId,
      name: total.categoryName,
      color: total.categoryColor,
      icon: total.categoryIcon ?? null,
      amountMinor: 0
    };
    current.amountMinor = safeMoneySum(current.amountMinor, total.amountMinor, `Category ${total.categoryName} total`);
    categoryTotals.set(key, current);
  }

  return Array.from(categoryTotals.values()).sort(
    (left, right) => right.amountMinor - left.amountMinor || left.name.localeCompare(right.name)
  );
}

export function accountBalanceHistoryFromTotals(
  months: Array<{ key: string; label: string; from: string; to: string }>,
  totals: AccountBalanceHistoryInput[]
): AccountBalanceHistory {
  const accounts = new Map<
    string,
    { name: string; type: string; currency: string; balancesByMonth: Map<string, number> }
  >();

  for (const total of totals) {
    const account = accounts.get(total.accountId) ?? {
      name: total.accountName,
      type: total.accountType,
      currency: total.currency,
      balancesByMonth: new Map<string, number>()
    };
    account.balancesByMonth.set(total.monthKey, total.balanceMinor);
    accounts.set(total.accountId, account);
  }

  return {
    months,
    series: Array.from(accounts.entries())
      .map(([accountId, account]) => ({
        accountId,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balancesMinor: months.map((month) => account.balancesByMonth.get(month.key) ?? 0)
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
  };
}

export function cashBalanceHistoryFromAccounts(
  history: AccountBalanceHistory
): NetWorthCashBalance[] {
  return history.months.map((month, monthIndex) => ({
    monthKey: month.key,
    cashBalanceMinor: history.series.reduce(
      (sum, account) => safeMoneySum(sum, account.balancesMinor[monthIndex] ?? 0, `Cash balance for ${month.key}`),
      0
    )
  }));
}

export function aggregateExpensesByCategory(transactions: StatisticsTransaction[]) {
  const totals = new Map<string, { id: string | null; name: string; amountMinor: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== "expense") {
      continue;
    }

    const categoryName = transaction.categoryName ?? "Uncategorized";
    const categoryId = transaction.categoryId ?? null;
    const key = categoryId ?? `name:${categoryName}`;
    const current = totals.get(key);
    totals.set(key, {
      id: categoryId,
      name: categoryName,
      amountMinor: (current?.amountMinor ?? 0) + transaction.amountMinor
    });
  }

  return Array.from(totals.values())
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export function aggregateExpensesByTag(transactions: StatisticsTransaction[]) {
  const totals = new Map<string, { id: string | null; name: string; amountMinor: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== "expense") {
      continue;
    }

    const tagNames = transaction.tagNames?.length ? transaction.tagNames : ["Untagged"];

    for (const [index, tagName] of tagNames.entries()) {
      const tagId = transaction.tagIds?.[index] ?? null;
      const key = tagId ?? `name:${tagName}`;
      const current = totals.get(key);
      totals.set(key, {
        id: tagId,
        name: tagName,
        amountMinor: (current?.amountMinor ?? 0) + transaction.amountMinor
      });
    }
  }

  return Array.from(totals.values())
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export function largestExpenses(transactions: StatisticsTransaction[], limit = 10) {
  return transactions
    .filter((transaction) => transaction.type === "expense")
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, limit);
}

function safeMoneySum(left: number, right: number, label: string) {
  const total = left + right;

  if (!Number.isSafeInteger(total)) {
    throw new Error(`${label} exceeds the safe integer range.`);
  }

  return total;
}
