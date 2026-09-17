import { describe, expect, it } from "vitest";
import {
  cashflowRowsToTotals,
  expenseRowsToTotals,
  monthlyCategoryExpenseRowsToTotals
} from "../src/queries/reporting.js";

describe("reporting query results", () => {
  it("converts monthly PostgreSQL totals and derives net cashflow", () => {
    expect(
      cashflowRowsToTotals([
        { monthKey: "2026-06", incomeMinor: 500_000n, expensesMinor: 129_500n }
      ])
    ).toEqual([
      {
        monthKey: "2026-06",
        incomeMinor: 500_000,
        expensesMinor: 129_500,
        netCashflowMinor: 370_500
      }
    ]);
  });

  it("preserves category and tag identifiers while converting totals", () => {
    expect(
      expenseRowsToTotals([
        { id: "food", name: "Food", amountMinor: 42_500n },
        { id: null, name: "Untagged", amountMinor: 1_200n }
      ])
    ).toEqual([
      { id: "food", name: "Food", amountMinor: 42_500 },
      { id: null, name: "Untagged", amountMinor: 1_200 }
    ]);
  });

  it("rejects report totals outside the safe integer range", () => {
    expect(() =>
      expenseRowsToTotals([
        { id: "large", name: "Large", amountMinor: BigInt(Number.MAX_SAFE_INTEGER) + 1n }
      ])
    ).toThrow("Expense total for Large exceeds the safe integer range.");
  });

  it("converts monthly category totals and preserves chart metadata", () => {
    expect(
      monthlyCategoryExpenseRowsToTotals([
        {
          monthKey: "2026-06",
          categoryId: "food",
          categoryName: "Food",
          categoryColor: "#247a3d",
          categoryIcon: "food",
          amountMinor: 42_500n
        }
      ])
    ).toEqual([
      {
        monthKey: "2026-06",
        categoryId: "food",
        categoryName: "Food",
        categoryColor: "#247a3d",
        categoryIcon: "food",
        amountMinor: 42_500
      }
    ]);
  });
});
