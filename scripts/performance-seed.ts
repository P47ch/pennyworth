import { randomBytes } from "node:crypto";
import type { Prisma, TransactionType } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/passwords.js";

const prisma = new PrismaClient();
const performanceUserId = "pennyworth-performance-user";
const performanceUserEmail = "performance@pennyworth.local";
const requiredConfirmation = "replace-performance-user";

function positiveIntegerFromEnvironment(name: string, fallback: number, maximum: number): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }

  return value;
}

function assertSafeToReplacePerformanceUser() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Performance data generation is disabled when NODE_ENV=production.");
  }

  if (process.env.PERF_DATASET_CONFIRM !== requiredConfirmation) {
    throw new Error(
      `Set PERF_DATASET_CONFIRM=${requiredConfirmation} to replace only ${performanceUserEmail}.`
    );
  }
}

function transactionTypeForIndex(index: number): TransactionType {
  if (index % 31 === 0) {
    return "income";
  }

  if (index % 17 === 0) {
    return "transfer";
  }

  return "expense";
}

function transactionDate(index: number, endDate: Date): Date {
  const fiveYearsInDays = 365 * 5;
  const dayOffset = index % fiveYearsInDays;
  return new Date(endDate.getTime() - dayOffset * 24 * 60 * 60 * 1000);
}

async function replacePerformanceUser() {
  const [userWithEmail, userWithId] = await Promise.all([
    prisma.user.findUnique({ where: { email: performanceUserEmail }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: performanceUserId }, select: { email: true } })
  ]);

  if (userWithEmail && userWithEmail.id !== performanceUserId) {
    throw new Error(`${performanceUserEmail} belongs to a non-performance user and will not be replaced.`);
  }

  if (userWithId && userWithId.email !== performanceUserEmail) {
    throw new Error(`${performanceUserId} belongs to a different email and will not be replaced.`);
  }

  if (userWithEmail) {
    await prisma.user.delete({ where: { id: performanceUserId } });
  }

  return prisma.user.create({
    data: {
      id: performanceUserId,
      email: performanceUserEmail,
      name: "Performance Dataset",
      passwordHash: await hashPassword(randomBytes(32).toString("base64url"))
    }
  });
}

async function createReferenceData(userId: string) {
  const accounts = Array.from({ length: 12 }, (_, index) => ({
    id: `perf-account-${index + 1}`,
    userId,
    name: `Performance Account ${String(index + 1).padStart(2, "0")}`,
    type: index === 0 ? ("bank" as const) : index === 1 ? ("cash" as const) : ("savings" as const),
    currency: "EUR",
    openingBalanceMinor: index * 100_000,
    institution: index % 2 === 0 ? "Performance Bank" : null
  })) satisfies Prisma.AccountCreateManyInput[];
  const categories = [
    { id: "perf-category-salary", name: "Performance Salary", type: "income" as const },
    { id: "perf-category-food", name: "Performance Food", type: "expense" as const },
    { id: "perf-category-housing", name: "Performance Housing", type: "expense" as const },
    { id: "perf-category-transport", name: "Performance Transport", type: "expense" as const },
    { id: "perf-category-health", name: "Performance Health", type: "expense" as const },
    { id: "perf-category-shopping", name: "Performance Shopping", type: "expense" as const },
    { id: "perf-category-utilities", name: "Performance Utilities", type: "expense" as const },
    { id: "perf-category-other", name: "Performance Other", type: "expense" as const }
  ];
  const tags = Array.from({ length: 5 }, (_, index) => ({
    id: `perf-tag-${index + 1}`,
    userId,
    name: `performance-tag-${index + 1}`,
    color: ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"][index]
  })) satisfies Prisma.TagCreateManyInput[];

  await prisma.$transaction([
    prisma.account.createMany({ data: accounts }),
    prisma.category.createMany({
      data: categories.map((category, index) => ({
        ...category,
        userId,
        color: ["#247a3d", "#d97706", "#b91c1c", "#2563eb", "#0f766e", "#7c3aed", "#0891b2", "#525252"][index]
      }))
    }),
    prisma.tag.createMany({ data: tags })
  ]);

  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const expenseCategories = categories.filter((category) => category.type === "expense");

  await prisma.budget.createMany({
    data: expenseCategories.slice(0, 5).map((category, index) => ({
      userId,
      categoryId: category.id,
      month: currentMonth,
      amountMinor: 25_000 + index * 10_000
    }))
  });

  return { accounts, categories, tags };
}

async function createAutomationData(
  userId: string,
  ruleCount: number,
  recurringCount: number,
  batchSize: number,
  referenceData: Awaited<ReturnType<typeof createReferenceData>>
) {
  const { accounts, categories } = referenceData;
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const now = new Date();

  for (let batchStart = 0; batchStart < ruleCount; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, ruleCount);
    const rules: Prisma.RuleCreateManyInput[] = [];

    for (let index = batchStart; index < batchEnd; index += 1) {
      rules.push({
        id: `perf-rule-${String(index + 1).padStart(7, "0")}`,
        userId,
        categoryId: expenseCategories[index % expenseCategories.length].id,
        name: `Performance rule ${index + 1}`,
        matchText: `performance-match-${index + 1}`,
        priority: index * 10,
        isActive: true
      });
    }

    await prisma.rule.createMany({ data: rules });
  }

  for (let batchStart = 0; batchStart < recurringCount; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, recurringCount);
    const recurringTransactions: Prisma.RecurringTransactionCreateManyInput[] = [];

    for (let index = batchStart; index < batchEnd; index += 1) {
      recurringTransactions.push({
        id: `perf-recurring-${String(index + 1).padStart(7, "0")}`,
        userId,
        name: `Performance recurring ${index + 1}`,
        type: "expense",
        amountMinor: 1_000 + (index % 50_000),
        sourceAccountId: accounts[index % accounts.length].id,
        categoryId: expenseCategories[index % expenseCategories.length].id,
        description: `Performance recurring expense ${index + 1}`,
        frequency: "monthly",
        nextDate: new Date(now.getTime() + ((index % 365) + 1) * 24 * 60 * 60 * 1000),
        isActive: true
      });
    }

    await prisma.recurringTransaction.createMany({ data: recurringTransactions });
  }

  console.log(
    `Created ${ruleCount.toLocaleString("en-US")} rules and ${recurringCount.toLocaleString("en-US")} recurring templates.`
  );
}

async function createTransactions(
  userId: string,
  transactionCount: number,
  batchSize: number,
  referenceData: Awaited<ReturnType<typeof createReferenceData>>
) {
  const { accounts, categories, tags } = referenceData;
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const endDate = new Date();
  endDate.setUTCHours(12, 0, 0, 0);

  for (let batchStart = 0; batchStart < transactionCount; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, transactionCount);
    const transactions: Prisma.TransactionCreateManyInput[] = [];
    const transactionTags: Prisma.TransactionTagCreateManyInput[] = [];

    for (let index = batchStart; index < batchEnd; index += 1) {
      const type = transactionTypeForIndex(index);
      const transactionId = `perf-transaction-${String(index + 1).padStart(9, "0")}`;
      const sourceAccount = accounts[index % accounts.length];
      const destinationAccount = accounts[(index + 1) % accounts.length];
      const category =
        type === "income" ? categories[0] : type === "expense" ? expenseCategories[index % expenseCategories.length] : null;
      const amountMinor =
        type === "income" ? 200_000 + ((index * 7_919) % 300_000) : 500 + ((index * 7_919) % 50_000);

      transactions.push({
        id: transactionId,
        userId,
        type,
        date: transactionDate(index, endDate),
        amountMinor,
        sourceAccountId: sourceAccount.id,
        destinationAccountId: type === "transfer" ? destinationAccount.id : null,
        categoryId: category?.id ?? null,
        description: `Performance ${type} ${index + 1}`,
        notes: index % 20 === 0 ? "Deterministic performance sample" : null
      });

      if (index % 4 === 0) {
        transactionTags.push({
          transactionId,
          tagId: tags[index % tags.length].id,
          userId: performanceUserId
        });
      }
    }

    await prisma.$transaction([
      prisma.transaction.createMany({ data: transactions }),
      prisma.transactionTag.createMany({ data: transactionTags })
    ]);

    if (batchEnd === transactionCount || batchEnd % 10_000 === 0) {
      console.log(`Created ${batchEnd.toLocaleString("en-US")} of ${transactionCount.toLocaleString("en-US")} transactions.`);
    }
  }
}

async function main() {
  assertSafeToReplacePerformanceUser();
  const transactionCount = positiveIntegerFromEnvironment("PERF_TRANSACTION_COUNT", 100_000, 1_000_000);
  const ruleCount = positiveIntegerFromEnvironment("PERF_RULE_COUNT", 10_000, 100_000);
  const recurringCount = positiveIntegerFromEnvironment("PERF_RECURRING_COUNT", 10_000, 100_000);
  const batchSize = positiveIntegerFromEnvironment("PERF_BATCH_SIZE", 1_000, 5_000);
  const user = await replacePerformanceUser();
  const referenceData = await createReferenceData(user.id);

  await createAutomationData(user.id, ruleCount, recurringCount, batchSize, referenceData);
  await createTransactions(user.id, transactionCount, batchSize, referenceData);
  console.log(`Performance dataset ready for ${performanceUserEmail}.`);
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
