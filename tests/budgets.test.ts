import { describe, expect, it } from "vitest";
import {
  calculateBudgetProgress,
  calculateBudgetProgressFromSpending,
  monthInputValue,
  parseBudgetMonth
} from "../src/finance/budgets.js";

describe("budget calculations", () => {
  it("calculates spent, remaining, and over-budget state for a month", () => {
    const progress = calculateBudgetProgress(
      [{ id: "b1", categoryId: "food", categoryName: "Food", amountMinor: 10000 }],
      [
        { type: "expense", amountMinor: 4000, categoryId: "food", date: new Date("2026-06-05") },
        { type: "expense", amountMinor: 7000, categoryId: "food", date: new Date("2026-06-06") },
        { type: "expense", amountMinor: 9000, categoryId: "food", date: new Date("2026-07-01") },
        { type: "income", amountMinor: 999999, categoryId: "food", date: new Date("2026-06-07") }
      ],
      new Date("2026-06-15")
    );

    expect(progress[0]).toMatchObject({
      spentMinor: 11000,
      remainingMinor: -1000,
      isOverBudget: true
    });
    expect(progress[0].percentUsed).toBeCloseTo(1.1);
  });

  it("parses and formats budget months", () => {
    const month = parseBudgetMonth("2026-06");

    expect(month.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(monthInputValue(month)).toBe("2026-06");
  });

  it("calculates progress from database-aggregated category spending", () => {
    expect(
      calculateBudgetProgressFromSpending(
        [
          { id: "food-budget", categoryId: "food", categoryName: "Food", amountMinor: 10_000 },
          { id: "rent-budget", categoryId: "rent", categoryName: "Rent", amountMinor: 100_000 }
        ],
        [{ categoryId: "food", amountMinor: 12_000 }]
      )
    ).toEqual([
      {
        id: "food-budget",
        categoryId: "food",
        categoryName: "Food",
        amountMinor: 10_000,
        spentMinor: 12_000,
        remainingMinor: -2_000,
        percentUsed: 1.2,
        isOverBudget: true
      },
      {
        id: "rent-budget",
        categoryId: "rent",
        categoryName: "Rent",
        amountMinor: 100_000,
        spentMinor: 0,
        remainingMinor: 100_000,
        percentUsed: 0,
        isOverBudget: false
      }
    ]);
  });
});
