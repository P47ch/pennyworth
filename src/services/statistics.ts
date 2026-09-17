import {
  accountBalanceHistoryFromTotals,
  cashBalanceHistoryFromAccounts,
  categoryExpenseTotalsFromMonthly,
  categorySpendingHistoryFromTotals,
  monthlyStatsFromTotals,
  netWorthHistoryFromLedgers
} from "../finance/statistics.js";
import { loadConfig } from "../lib/config.js";
import { calendarMonthRange, currentDateOnly } from "../lib/dates.js";
import { prisma } from "../lib/db.js";
import { getAccountBalanceMap } from "../queries/accountBalances.js";
import { getMonthlyAccountBalanceHistory } from "../queries/netWorth.js";
import {
  getExpenseTotalsByTag,
  getMonthlyCashflowTotals,
  getMonthlyExpenseTotalsByCategory
} from "../queries/reporting.js";
import { getInvestmentValueSummary } from "./investmentSummary.js";
import { assertSingleCurrency } from "../finance/currency.js";

const timeZone = loadConfig().timeZone;

export async function getStatistics(userId: string, locale = "en-US") {
  const now = new Date();
  const primaryCurrency = loadConfig().primaryCurrency;
  const { start: reportStart, end: reportEnd } = calendarMonthRange(timeZone, now, -11);
  const [
    accounts,
    balances,
    cashflowTotals,
    monthlyCategoryExpenses,
    tagExpenses,
    largestExpenseRecords,
    investmentSummary,
    accountBalanceHistoryTotals,
    investmentTransactions,
    manualHoldings,
    assetPrices
  ] = await Promise.all([
    prisma.account.findMany({ where: { userId, isActive: true }, orderBy: { name: "asc" } }),
    getAccountBalanceMap(userId),
    getMonthlyCashflowTotals(userId, reportStart, reportEnd),
    getMonthlyExpenseTotalsByCategory(userId, reportStart, reportEnd),
    getExpenseTotalsByTag(userId, reportStart, reportEnd),
    prisma.transaction.findMany({
      where: {
        userId,
        type: "expense",
        date: { gte: reportStart, lt: reportEnd }
      },
      select: {
        amountMinor: true,
        date: true,
        description: true,
        category: { select: { id: true, name: true, color: true, icon: true } },
        sourceAccount: { select: { currency: true } }
      },
      orderBy: [{ amountMinor: "desc" }, { date: "desc" }],
      take: 10
    }),
    getInvestmentValueSummary(userId),
    getMonthlyAccountBalanceHistory(userId, reportStart, reportEnd),
    prisma.investmentTransaction.findMany({
      where: { userId, date: { lt: reportEnd } },
      select: {
        id: true,
        accountId: true,
        assetId: true,
        type: true,
        date: true,
        createdAt: true,
        quantity: true,
        amountMinor: true
      }
    }),
    prisma.holding.findMany({
      where: { userId },
      select: { assetId: true, quantity: true }
    }),
    prisma.assetPrice.findMany({
      where: { userId, date: { lt: reportEnd } },
      select: { assetId: true, date: true, priceMinor: true }
    })
  ]);
  assertSingleCurrency(accounts, primaryCurrency, "accounts");
  const months = monthlyStatsFromTotals(cashflowTotals, 12, currentDateOnly(timeZone, now), locale);
  const accountBalanceHistory = accountBalanceHistoryFromTotals(months, accountBalanceHistoryTotals);
  const cashBalanceHistory = cashBalanceHistoryFromAccounts(accountBalanceHistory);
  const categorySpendingHistory = categorySpendingHistoryFromTotals(months, monthlyCategoryExpenses);
  const categoryExpenses = categoryExpenseTotalsFromMonthly(monthlyCategoryExpenses);
  const netWorthHistory = netWorthHistoryFromLedgers(
    months,
    cashBalanceHistory,
    investmentTransactions,
    manualHoldings,
    assetPrices
  );
  const currentMonth = months.at(-1) ?? {
    incomeMinor: 0,
    expensesMinor: 0,
    netCashflowMinor: 0,
    savingsRate: null
  };
  const accountsWithBalances = accounts.map((account) => ({
    ...account,
    currentBalanceMinor: balances.get(account.id) ?? account.openingBalanceMinor
  }));
  const totalCashBalanceMinor = accountsWithBalances.reduce((sum, account) => sum + account.currentBalanceMinor, 0);
  const totalBalanceMinor = totalCashBalanceMinor + investmentSummary.totalInvestmentValueMinor;

  return {
    months,
    netWorthHistory,
    accountBalanceHistory,
    categorySpendingHistory,
    primaryCurrency,
    currentMonth,
    totalBalanceMinor,
    totalCashBalanceMinor,
    investmentSummary,
    accounts: accountsWithBalances,
    categoryExpenses: categoryExpenses.slice(0, 10),
    tagExpenses: tagExpenses.slice(0, 10),
    largestExpenses: largestExpenseRecords.map((transaction) => ({
      type: "expense" as const,
      amountMinor: transaction.amountMinor,
      date: transaction.date,
      categoryName: transaction.category?.name,
      categoryId: transaction.category?.id,
      categoryColor: transaction.category?.color,
      categoryIcon: transaction.category?.icon,
      description: transaction.description,
      currency: transaction.sourceAccount?.currency
    }))
  };
}
