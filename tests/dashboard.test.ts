import { describe, expect, it } from "vitest";
import { dashboardRecurringCutoff, selectDashboardBudgetAlerts } from "../src/finance/dashboard.js";

describe("dashboard attention", () => {
  it("keeps only budgets at or above the warning threshold", () => {
    const alerts = selectDashboardBudgetAlerts([
      { name: "Food", percentUsed: 0.79, isOverBudget: false },
      { name: "Transport", percentUsed: 0.8, isOverBudget: false },
      { name: "Rent", percentUsed: 1.1, isOverBudget: true }
    ]);

    expect(alerts.map((alert) => alert.name)).toEqual(["Rent", "Transport"]);
  });

  it("prioritizes over-budget categories and limits dashboard noise", () => {
    const alerts = selectDashboardBudgetAlerts(
      [
        { name: "A", percentUsed: 0.85, isOverBudget: false },
        { name: "B", percentUsed: 1.05, isOverBudget: true },
        { name: "C", percentUsed: 0.95, isOverBudget: false },
        { name: "D", percentUsed: 1.01, isOverBudget: true }
      ],
      0.8,
      3
    );

    expect(alerts.map((alert) => alert.name)).toEqual(["B", "D", "C"]);
  });

  it("builds a seven-day recurring cutoff without mutating today", () => {
    const today = new Date("2026-08-27T00:00:00.000Z");

    expect(dashboardRecurringCutoff(today)).toEqual(new Date("2026-09-03T00:00:00.000Z"));
    expect(today).toEqual(new Date("2026-08-27T00:00:00.000Z"));
  });
});
