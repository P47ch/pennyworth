import { performance } from "node:perf_hooks";
import { getQueryCount, prisma, resetQueryCount } from "../src/lib/db.js";
import { listAccountsWithBalances } from "../src/services/accounts.js";
import { getDashboardSummary } from "../src/services/dashboard.js";
import { getStatistics } from "../src/services/statistics.js";
import { listTransactionPage, listTransactions } from "../src/services/transactions.js";

const performanceUserEmail = "performance@pennyworth.local";

function benchmarkIterations(): number {
  const value = Number.parseInt(process.env.PERF_BENCHMARK_ITERATIONS ?? "5", 10);

  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new Error("PERF_BENCHMARK_ITERATIONS must be an integer between 1 and 50.");
  }

  return value;
}

function percentile(sortedValues: number[], ratio: number): number {
  const index = Math.max(0, Math.ceil(sortedValues.length * ratio) - 1);
  return sortedValues[index];
}

async function measure(name: string, iterations: number, operation: () => Promise<unknown>) {
  resetQueryCount();
  await operation();
  resetQueryCount();
  const durations: number[] = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const startedAt = performance.now();
    await operation();
    durations.push(performance.now() - startedAt);
  }

  const sortedDurations = [...durations].sort((left, right) => left - right);
  const total = sortedDurations.reduce((sum, duration) => sum + duration, 0);

  return {
    operation: name,
    iterations,
    minimumMs: Number(sortedDurations[0].toFixed(1)),
    medianMs: Number(percentile(sortedDurations, 0.5).toFixed(1)),
    p95Ms: Number(percentile(sortedDurations, 0.95).toFixed(1)),
    maximumMs: Number(sortedDurations.at(-1)?.toFixed(1)),
    averageMs: Number((total / sortedDurations.length).toFixed(1)),
    queryCount: getQueryCount()
  };
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: performanceUserEmail },
    select: { id: true }
  });

  if (!user) {
    throw new Error("Performance user not found. Run npm run db:seed:performance first.");
  }

  const transactionCount = await prisma.transaction.count({ where: { userId: user.id } });
  const iterations = benchmarkIterations();
  const operations = [
    ["accounts with balances", () => listAccountsWithBalances(user.id)],
    ["dashboard summary", () => getDashboardSummary(user.id)],
    ["statistics", () => getStatistics(user.id)],
    ["transaction page", () => listTransactionPage(user.id, {}, 1, 50)],
    ["transaction search", () => listTransactionPage(user.id, { search: "expense" }, 1, 50)]
  ] as const;
  const results = [];

  console.log(
    `Benchmarking ${transactionCount.toLocaleString("en-US")} transactions with ${iterations} measured iterations. Query counting: ${process.env.PERF_QUERY_COUNT === "true" ? "on" : "off"}.`
  );

  for (const [name, operation] of operations) {
    results.push(await measure(name, iterations, operation));
  }

  if (process.env.PERF_INCLUDE_FULL_EXPORT === "true") {
    results.push(await measure("full transaction export query", iterations, () => listTransactions(user.id)));
  }

  console.table(results);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
