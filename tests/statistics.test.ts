import { describe, expect, it } from "vitest";
import {
  accountBalanceHistoryFromTotals,
  aggregateExpensesByCategory,
  aggregateExpensesByTag,
  cashBalanceHistoryFromAccounts,
  categoryExpenseTotalsFromMonthly,
  categorySpendingHistoryFromTotals,
  largestExpenses,
  monthlyStats,
  monthlyStatsFromTotals,
  netWorthHistoryFromLedgers,
  recentMonths
} from "../src/finance/statistics.js";

describe("statistics calculations", () => {
  const transactions = [
    {
      type: "income" as const,
      amountMinor: 500000,
      date: new Date("2026-06-01"),
      categoryName: "Salary",
      tagNames: []
    },
    {
      type: "expense" as const,
      amountMinor: 125000,
      date: new Date("2026-06-02"),
      categoryName: "Rent",
      tagNames: ["recurring"]
    },
    {
      type: "expense" as const,
      amountMinor: 4500,
      date: new Date("2026-06-03"),
      categoryName: "Food",
      tagNames: ["personal"]
    },
    {
      type: "transfer" as const,
      amountMinor: 100000,
      date: new Date("2026-06-04"),
      categoryName: null,
      tagNames: []
    }
  ];

  it("summarizes monthly income, expenses, net cashflow, and savings rate", () => {
    const months = monthlyStats(transactions, 1, new Date("2026-06-15"));

    expect(months[0]).toMatchObject({
      incomeMinor: 500000,
      expensesMinor: 129500,
      netCashflowMinor: 370500
    });
    expect(months[0].savingsRate).toBeCloseTo(0.741);
  });

  it("aggregates spending by category and tag", () => {
    expect(aggregateExpensesByCategory(transactions)).toEqual([
      { id: null, name: "Rent", amountMinor: 125000 },
      { id: null, name: "Food", amountMinor: 4500 }
    ]);
    expect(aggregateExpensesByTag(transactions)).toEqual([
      { id: null, name: "recurring", amountMinor: 125000 },
      { id: null, name: "personal", amountMinor: 4500 }
    ]);
  });

  it("finds largest expenses only", () => {
    expect(largestExpenses(transactions, 1)).toEqual([transactions[1]]);
  });

  it("builds localized month labels with exact drilldown date ranges", () => {
    expect(recentMonths(2, new Date(2024, 2, 15), "it-IT")).toEqual([
      { key: "2024-02", label: "feb 24", from: "2024-02-01", to: "2024-02-29" },
      { key: "2024-03", label: "mar 24", from: "2024-03-01", to: "2024-03-31" }
    ]);
  });

  it("fills missing months around database-aggregated totals", () => {
    expect(
      monthlyStatsFromTotals(
        [{ monthKey: "2026-06", incomeMinor: 500000, expensesMinor: 125000 }],
        2,
        new Date(2026, 5, 15),
        "en-US"
      )
    ).toEqual([
      {
        key: "2026-05",
        label: "May 26",
        from: "2026-05-01",
        to: "2026-05-31",
        incomeMinor: 0,
        expensesMinor: 0,
        netCashflowMinor: 0,
        savingsRate: null
      },
      {
        key: "2026-06",
        label: "Jun 26",
        from: "2026-06-01",
        to: "2026-06-30",
        incomeMinor: 500000,
        expensesMinor: 125000,
        netCashflowMinor: 375000,
        savingsRate: 0.75
      }
    ]);
  });

  it("builds month-end net worth from cash, investment activity, manual holdings, and historical prices", () => {
    const months = recentMonths(2, new Date("2026-06-15"));
    const history = netWorthHistoryFromLedgers(
      months,
      [
        { monthKey: "2026-05", cashBalanceMinor: 100_000 },
        { monthKey: "2026-06", cashBalanceMinor: 80_000 }
      ],
      [
        {
          id: "may-buy",
          accountId: "broker",
          assetId: "fund",
          type: "buy",
          date: new Date("2026-05-15"),
          quantity: "2",
          amountMinor: 20_000
        },
        {
          id: "june-buy",
          accountId: "broker",
          assetId: "fund",
          type: "buy",
          date: new Date("2026-06-10"),
          quantity: "1",
          amountMinor: 12_000
        }
      ],
      [{ assetId: "fund", quantity: "1" }],
      [
        { assetId: "fund", date: new Date("2026-05-31"), priceMinor: 11_000 },
        { assetId: "fund", date: new Date("2026-06-20"), priceMinor: 15_000 }
      ]
    );

    expect(history).toEqual([
      expect.objectContaining({
        key: "2026-05",
        cashBalanceMinor: 100_000,
        investmentValueMinor: 33_000,
        netWorthMinor: 133_000
      }),
      expect.objectContaining({
        key: "2026-06",
        cashBalanceMinor: 80_000,
        investmentValueMinor: 60_000,
        netWorthMinor: 140_000
      })
    ]);
  });

  it("keeps stable category and tag IDs for transaction drilldowns", () => {
    const expense = {
      type: "expense" as const,
      amountMinor: 1200,
      date: new Date("2026-06-05"),
      categoryId: "category-food",
      categoryName: "Food",
      tagIds: ["tag-shared"],
      tagNames: ["shared"]
    };

    expect(aggregateExpensesByCategory([expense])).toEqual([
      { id: "category-food", name: "Food", amountMinor: 1200 }
    ]);
    expect(aggregateExpensesByTag([expense])).toEqual([
      { id: "tag-shared", name: "shared", amountMinor: 1200 }
    ]);
  });

  it("groups monthly category spending into top series and Other", () => {
    const months = recentMonths(2, new Date("2026-06-15"));
    const totals = [
      { monthKey: "2026-05", categoryId: "food", categoryName: "Food", categoryColor: null, amountMinor: 10_000 },
      { monthKey: "2026-06", categoryId: "food", categoryName: "Food", categoryColor: null, amountMinor: 5_000 },
      { monthKey: "2026-05", categoryId: "rent", categoryName: "Rent", categoryColor: null, amountMinor: 20_000 },
      { monthKey: "2026-06", categoryId: "travel", categoryName: "Travel", categoryColor: null, amountMinor: 3_000 }
    ];

    expect(categorySpendingHistoryFromTotals(months, totals, 2).series).toEqual([
      expect.objectContaining({ key: "category:rent", name: "Rent", totalMinor: 20_000, amountsMinor: [20_000, 0] }),
      expect.objectContaining({ key: "category:food", name: "Food", totalMinor: 15_000, amountsMinor: [10_000, 5_000] }),
      expect.objectContaining({ key: "other", name: "Other", totalMinor: 3_000, amountsMinor: [0, 3_000] })
    ]);
    expect(categoryExpenseTotalsFromMonthly(totals)).toEqual([
      { id: "rent", name: "Rent", color: null, icon: null, amountMinor: 20_000 },
      { id: "food", name: "Food", color: null, icon: null, amountMinor: 15_000 },
      { id: "travel", name: "Travel", color: null, icon: null, amountMinor: 3_000 }
    ]);
  });

  it("builds per-account series and derives total cash history", () => {
    const months = recentMonths(2, new Date("2026-06-15"));
    const history = accountBalanceHistoryFromTotals(months, [
      { monthKey: "2026-05", accountId: "bank", accountName: "Bank", accountType: "bank", currency: "EUR", balanceMinor: 100_000 },
      { monthKey: "2026-06", accountId: "bank", accountName: "Bank", accountType: "bank", currency: "EUR", balanceMinor: 120_000 },
      { monthKey: "2026-05", accountId: "card", accountName: "Card", accountType: "credit_card", currency: "EUR", balanceMinor: -20_000 },
      { monthKey: "2026-06", accountId: "card", accountName: "Card", accountType: "credit_card", currency: "EUR", balanceMinor: -35_000 }
    ]);

    expect(history.series).toEqual([
      expect.objectContaining({ accountId: "bank", name: "Bank", balancesMinor: [100_000, 120_000] }),
      expect.objectContaining({ accountId: "card", name: "Card", balancesMinor: [-20_000, -35_000] })
    ]);
    expect(cashBalanceHistoryFromAccounts(history)).toEqual([
      { monthKey: "2026-05", cashBalanceMinor: 80_000 },
      { monthKey: "2026-06", cashBalanceMinor: 85_000 }
    ]);
  });
});
