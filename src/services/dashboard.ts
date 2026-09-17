import { prisma } from "../lib/db.js";
import { calculateBudgetProgressFromSpending, monthStart } from "../finance/budgets.js";
import { getAccountBalanceMap } from "../queries/accountBalances.js";
import { getExpenseTotalsByCategory, getMonthlyCashflowTotals } from "../queries/reporting.js";
import { loadConfig } from "../lib/config.js";
import { calendarMonthRange, currentDateOnly } from "../lib/dates.js";
import { getInvestmentValueSummary } from "./investmentSummary.js";
import { assertSingleCurrency } from "../finance/currency.js";
import { dashboardRecurringCutoff, selectDashboardBudgetAlerts } from "../finance/dashboard.js";

const timeZone = loadConfig().timeZone;

export async function getDashboardSummary(userId: string) {
  const now = new Date();
  const { start: currentMonthStart, end: nextMonthStart } = calendarMonthRange(timeZone, now);
  const today = currentDateOnly(timeZone, now);
  const normalizedMonth = monthStart(today);
  const recurringCutoff = dashboardRecurringCutoff(today);
  const [
    accounts,
    balances,
    monthCashflow,
    categorySpending,
    recentTransactions,
    budgets,
    recurringDue,
    investmentSummary
  ] = await Promise.all([
    prisma.account.findMany({ where: { userId, isActive: true }, orderBy: { name: "asc" } }),
    getAccountBalanceMap(userId),
    getMonthlyCashflowTotals(userId, currentMonthStart, nextMonthStart),
    getExpenseTotalsByCategory(userId, currentMonthStart, nextMonthStart),
    prisma.transaction.findMany({
      where: { userId },
      include: {
        category: true,
        sourceAccount: true,
        destinationAccount: true
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6
    }),
    prisma.budget.findMany({
      where: { userId, month: normalizedMonth },
      include: { category: true },
      orderBy: { category: { name: "asc" } }
    }),
    prisma.recurringTransaction.findMany({
      where: { userId, isActive: true, nextDate: { lte: recurringCutoff } },
      include: {
        sourceAccount: true,
        destinationAccount: true,
        category: true
      },
      orderBy: [{ nextDate: "asc" }, { name: "asc" }],
      take: 3
    }),
    getInvestmentValueSummary(userId)
  ]);

  assertSingleCurrency(accounts, loadConfig().primaryCurrency, "accounts");

  const totalCashBalanceMinor = accounts.reduce(
    (total, account) => total + (balances.get(account.id) ?? account.openingBalanceMinor),
    0
  );
  const totalBalanceMinor = totalCashBalanceMinor + investmentSummary.totalInvestmentValueMinor;
  const monthSummary = monthCashflow[0] ?? {
    incomeMinor: 0,
    expensesMinor: 0,
    netCashflowMinor: 0
  };
  const budgetProgress = calculateBudgetProgressFromSpending(
    budgets.map((budget) => ({
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryColor: budget.category.color,
      categoryIcon: budget.category.icon,
      amountMinor: budget.amountMinor
    })),
    categorySpending.flatMap((category) =>
      category.id ? [{ categoryId: category.id, amountMinor: category.amountMinor }] : []
    )
  );
  const budgetAlerts = selectDashboardBudgetAlerts(budgetProgress);

  return {
    totalBalanceMinor,
    totalCashBalanceMinor,
    investmentSummary,
    ...monthSummary,
    accounts: accounts.map((account) => ({
      ...account,
      currentBalanceMinor: balances.get(account.id) ?? account.openingBalanceMinor
    })),
    recentTransactions,
    recurringDue,
    budgetAlerts,
    spendingByCategory: categorySpending
  };
}
