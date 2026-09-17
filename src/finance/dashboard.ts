export type DashboardBudgetProgress = {
  percentUsed: number;
  isOverBudget: boolean;
};

export function selectDashboardBudgetAlerts<T extends DashboardBudgetProgress>(
  budgets: T[],
  threshold = 0.8,
  limit = 3
): T[] {
  return budgets
    .filter((budget) => budget.percentUsed >= threshold)
    .sort((left, right) => {
      if (left.isOverBudget !== right.isOverBudget) {
        return left.isOverBudget ? -1 : 1;
      }

      return right.percentUsed - left.percentUsed;
    })
    .slice(0, limit);
}

export function dashboardRecurringCutoff(today: Date, daysAhead = 7): Date {
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() + daysAhead);
  return cutoff;
}
