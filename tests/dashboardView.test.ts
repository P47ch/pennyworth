import { readFileSync } from "node:fs";
import ejs from "ejs";
import { describe, expect, it } from "vitest";
import { createTranslator } from "../src/lib/i18n.js";
import { renderCategoryLabel } from "../src/lib/icons.js";
import { localizeEjsTemplate } from "../src/lib/localizedEjs.js";
import { createMoneyFormatter } from "../src/finance/money.js";

const renderDashboard = ejs.compile(
  localizeEjsTemplate(readFileSync(new URL("../src/views/dashboard.ejs", import.meta.url), "utf8"))
);

function summary(overrides: Record<string, unknown> = {}) {
  return {
    totalBalanceMinor: 0,
    totalCashBalanceMinor: 0,
    incomeMinor: 0,
    expensesMinor: 0,
    netCashflowMinor: 0,
    investmentSummary: { totalInvestmentValueMinor: 0 },
    budgetAlerts: [],
    recurringDue: [],
    recentTransactions: [],
    spendingByCategory: [],
    accounts: [],
    ...overrides
  };
}

function render(overrides: Record<string, unknown> = {}, currency = "EUR") {
  return renderDashboard({
    summary: summary(overrides),
    formatMoney: createMoneyFormatter(currency),
    categoryLabel: renderCategoryLabel,
    icon: () => "",
    t: createTranslator("en")
  });
}

describe("dashboard view", () => {
  it("keeps the default overview focused and omits empty attention UI", () => {
    const html = render();

    expect(html).toContain("Net worth");
    expect(html).toContain("This month");
    expect(html).toContain("Recent transactions");
    expect(html).not.toContain("Needs attention");
    expect(html).not.toContain("Largest expenses");
  });

  it("shows the attention widget when a budget needs review", () => {
    const html = render({
      budgetAlerts: [
        {
          categoryName: "Food",
          categoryColor: "#d97706",
          categoryIcon: "food",
          percentUsed: 0.9,
          isOverBudget: false,
          spentMinor: 9000,
          amountMinor: 10000
        }
      ]
    });

    expect(html).toContain("Needs attention");
    expect(html).toContain("90% of budget used");
    expect(html).toContain("Food");
    expect(html).toContain('class="icon icon-food"');
  });

  it.each([
    ["EUR", "€"],
    ["USD", "$"],
    ["JPY", "¥"]
  ])("formats primary-currency totals as %s", (currency, symbol) => {
    expect(render({}, currency)).toContain(symbol);
  });
});
