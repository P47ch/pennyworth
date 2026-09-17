import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import {
  assertCategorySupportsExpense,
  lockCategoriesForUse,
  lockCategoryForUse
} from "./relationshipValidation.js";

const ruleInclude = {
  category: true,
  tags: { include: { tag: true } }
};
export const ruleApplicationLimit = 500;

async function assertRuleCategory(
  userId: string,
  categoryId: string,
  db: typeof prisma | Prisma.TransactionClient = prisma
) {
  const category = await lockCategoryForUse(userId, categoryId, db);

  if (!category) {
    throw new Error("Choose a valid expense category.");
  }

  assertCategorySupportsExpense(category.type);
}

async function assertRuleTags(
  userId: string,
  tagIds: string[],
  db: typeof prisma | Prisma.TransactionClient = prisma
) {
  const uniqueTagIds = Array.from(new Set(tagIds));

  if (uniqueTagIds.length === 0) {
    return;
  }

  const tagCount = await db.tag.count({
    where: { userId, id: { in: uniqueTagIds } }
  });

  if (tagCount !== uniqueTagIds.length) {
    throw new Error("Choose valid tags.");
  }
}

export async function listRules(userId: string) {
  return prisma.rule.findMany({
    where: { userId },
    include: ruleInclude,
    orderBy: [{ priority: "asc" }, { name: "asc" }]
  });
}

export async function listActiveRules(userId: string) {
  return prisma.rule.findMany({
    where: { userId, isActive: true },
    include: ruleInclude,
    orderBy: [{ priority: "asc" }, { name: "asc" }]
  });
}

export async function getRuleForUser(userId: string, ruleId: string) {
  return prisma.rule.findFirst({
    where: { id: ruleId, userId },
    include: ruleInclude
  });
}

export async function createRule(input: {
  userId: string;
  name: string;
  matchText: string;
  categoryId: string;
  tagIds: string[];
  isActive: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    await assertRuleCategory(input.userId, input.categoryId, tx);
    await assertRuleTags(input.userId, input.tagIds, tx);
    const highestPriority = await tx.rule.aggregate({
      where: { userId: input.userId },
      _max: { priority: true }
    });

    return tx.rule.create({
      data: {
        userId: input.userId,
        name: input.name,
        matchText: input.matchText,
        categoryId: input.categoryId,
        priority: (highestPriority._max.priority ?? -10) + 10,
        isActive: input.isActive,
        tags: {
          create: Array.from(new Set(input.tagIds)).map((tagId) => ({
            tag: { connect: { id_userId: { id: tagId, userId: input.userId } } }
          }))
        }
      }
    });
  });
}

export async function updateRule(input: {
  userId: string;
  ruleId: string;
  name: string;
  matchText: string;
  categoryId: string;
  tagIds: string[];
  isActive: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const rule = await tx.rule.findFirst({
      where: { id: input.ruleId, userId: input.userId },
      select: { categoryId: true }
    });

    if (!rule) {
      throw new Error("Rule not found.");
    }

    await lockCategoriesForUse(input.userId, [rule.categoryId, input.categoryId], tx);
    await assertRuleCategory(input.userId, input.categoryId, tx);
    await assertRuleTags(input.userId, input.tagIds, tx);

    return tx.rule.update({
      where: { id_userId: { id: input.ruleId, userId: input.userId } },
      data: {
        name: input.name,
        matchText: input.matchText,
        categoryId: input.categoryId,
        isActive: input.isActive,
        tags: {
          deleteMany: {},
          create: Array.from(new Set(input.tagIds)).map((tagId) => ({
            tag: { connect: { id_userId: { id: tagId, userId: input.userId } } }
          }))
        }
      }
    });
  });
}

export async function deleteRule(userId: string, ruleId: string) {
  await prisma.$transaction(async (tx) => {
    const rule = await tx.rule.findFirst({
      where: { id: ruleId, userId },
      select: { categoryId: true }
    });

    if (!rule) {
      throw new Error("Rule not found.");
    }

    await lockCategoryForUse(userId, rule.categoryId, tx);
    await tx.rule.delete({ where: { id_userId: { id: ruleId, userId } } });
  });
}

export async function moveRule(userId: string, ruleId: string, direction: "up" | "down") {
  const rules = await prisma.rule.findMany({
    where: { userId },
    orderBy: [{ priority: "asc" }, { name: "asc" }]
  });
  const currentIndex = rules.findIndex((rule) => rule.id === ruleId);

  if (currentIndex === -1) {
    throw new Error("Rule not found.");
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (!rules[targetIndex]) {
    return;
  }

  const current = rules[currentIndex];
  const target = rules[targetIndex];

  await prisma.$transaction([
    prisma.rule.update({ where: { id_userId: { id: current.id, userId } }, data: { priority: target.priority } }),
    prisma.rule.update({ where: { id_userId: { id: target.id, userId } }, data: { priority: current.priority } })
  ]);
}

export type RuleApplicationTransaction = {
  id: string;
  date: Date;
  amountMinor: number;
  description: string | null;
  notes: string | null;
  tags: Array<{ tagId: string }>;
};

export function matchRuleForText(
  transaction: { description: string | null; notes: string | null },
  rules: Awaited<ReturnType<typeof listActiveRules>>
) {
  const searchableText = `${transaction.description ?? ""} ${transaction.notes ?? ""}`.toLowerCase();

  return rules.find((rule) => rule.matchText.trim() && searchableText.includes(rule.matchText.trim().toLowerCase())) ?? null;
}

export async function previewRuleApplications(userId: string, limit = ruleApplicationLimit) {
  const safeLimit = Math.min(ruleApplicationLimit, Math.max(1, Math.trunc(limit)));
  const [rules, transactions] = await Promise.all([
    listActiveRules(userId),
    prisma.transaction.findMany({
      where: { userId, type: "expense", categoryId: null },
      include: {
        sourceAccount: true,
        tags: true
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: safeLimit
    })
  ]);

  return transactions
    .map((transaction) => {
      const rule = matchRuleForText(transaction, rules);

      if (!rule) {
        return null;
      }

      const existingTagIds = new Set(transaction.tags.map((tag) => tag.tagId));
      const suggestedTags = rule.tags.map((item) => item.tag).filter((tag) => !existingTagIds.has(tag.id));

      return {
        transaction,
        rule,
        category: rule.category,
        suggestedTags
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function applyRuleApplications(userId: string) {
  const applications = await previewRuleApplications(userId);
  let appliedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const application of applications) {
      const category = await lockCategoryForUse(userId, application.category.id, tx);

      if (!category) {
        throw new Error("Rule category no longer exists.");
      }

      assertCategorySupportsExpense(category.type, "Rule category");

      const updated = await tx.transaction.updateMany({
        where: { id: application.transaction.id, userId, type: "expense", categoryId: null },
        data: { categoryId: application.category.id }
      });

      if (updated.count !== 1) {
        continue;
      }

      if (application.suggestedTags.length > 0) {
        await tx.transactionTag.createMany({
          data: application.suggestedTags.map((tag) => ({
            transactionId: application.transaction.id,
            tagId: tag.id,
            userId
          })),
          skipDuplicates: true
        });
      }

      appliedCount += 1;
    }
  });

  return appliedCount;
}
