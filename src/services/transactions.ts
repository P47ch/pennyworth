import type { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../lib/db.js";
import {
  assertCategorySupportsTransaction,
  lockCategoriesForUse,
  lockCategoryForUse
} from "./relationshipValidation.js";

export const transactionTypes: TransactionType[] = ["income", "expense", "transfer"];

export type TransactionFilters = {
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  tagId?: string;
  search?: string;
  from?: Date;
  to?: Date;
};

function buildTransactionWhere(userId: string, filters: TransactionFilters = {}): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.tagId) {
    where.tags = { some: { tagId: filters.tagId } };
  }

  if (filters.accountId) {
    where.OR = [{ sourceAccountId: filters.accountId }, { destinationAccountId: filters.accountId }];
  }

  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {})
    };
  }

  if (filters.search) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { description: { contains: filters.search, mode: "insensitive" } },
          { notes: { contains: filters.search, mode: "insensitive" } }
        ]
      }
    ];
  }

  return where;
}

const transactionInclude = {
  sourceAccount: true,
  destinationAccount: true,
  category: true,
  tags: { include: { tag: true } }
} satisfies Prisma.TransactionInclude;

export async function listTransactions(userId: string, filters: TransactionFilters = {}) {
  return prisma.transaction.findMany({
    where: buildTransactionWhere(userId, filters),
    include: transactionInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });
}

export async function listTransactionDuplicateCandidates(userId: string, from: Date, to: Date) {
  return prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: from, lte: to }
    },
    select: {
      id: true,
      type: true,
      date: true,
      amountMinor: true,
      sourceAccountId: true,
      destinationAccountId: true,
      description: true
    }
  });
}

export type TransactionPage = {
  transactions: Awaited<ReturnType<typeof listTransactions>>;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export async function listTransactionPage(
  userId: string,
  filters: TransactionFilters = {},
  page = 1,
  pageSize = 50
): Promise<TransactionPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const where = buildTransactionWhere(userId, filters);
  const [transactions, totalCount] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize
    }),
    prisma.transaction.count({ where })
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));

  return {
    transactions,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages
  };
}

export async function getTransactionForUser(userId: string, transactionId: string) {
  return prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    include: transactionInclude
  });
}

async function assertTransactionReferences(input: {
  userId: string;
  type: TransactionType;
  sourceAccountId?: string;
  destinationAccountId?: string;
  categoryId?: string;
  tagIds: string[];
}, db: Prisma.TransactionClient | typeof prisma = prisma) {
  if ((input.type === "income" || input.type === "expense") && !input.sourceAccountId) {
    throw new Error("Choose an account.");
  }

  if (input.type === "transfer" && (!input.sourceAccountId || !input.destinationAccountId)) {
    throw new Error("Transfers require source and destination accounts.");
  }

  if (input.type === "transfer" && input.sourceAccountId === input.destinationAccountId) {
    throw new Error("Transfer accounts must be different.");
  }

  const accountIds = [input.sourceAccountId, input.type === "transfer" ? input.destinationAccountId : undefined].filter(
    (id): id is string => Boolean(id)
  );
  const uniqueAccountIds = Array.from(new Set(accountIds));

  if (uniqueAccountIds.length > 0) {
    const accountCount = await db.account.count({
      where: { userId: input.userId, id: { in: uniqueAccountIds } }
    });

    if (accountCount !== uniqueAccountIds.length) {
      throw new Error("Choose valid accounts.");
    }
  }

  if (input.type !== "transfer" && input.categoryId) {
    const category = await lockCategoryForUse(input.userId, input.categoryId, db);

    if (!category) {
      throw new Error("Choose a valid category.");
    }

    assertCategorySupportsTransaction(category.type, input.type);
  }

  const uniqueTagIds = Array.from(new Set(input.tagIds));

  if (uniqueTagIds.length > 0) {
    const tagCount = await db.tag.count({
      where: { userId: input.userId, id: { in: uniqueTagIds } }
    });

    if (tagCount !== uniqueTagIds.length) {
      throw new Error("Choose valid tags.");
    }
  }
}

export async function createTransaction(input: {
  userId: string;
  type: TransactionType;
  date: Date;
  amountMinor: number;
  sourceAccountId?: string;
  destinationAccountId?: string;
  categoryId?: string;
  description?: string;
  notes?: string;
  tagIds: string[];
}, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<Prisma.TransactionGetPayload<{}>> {
  if (db === prisma) {
    return prisma.$transaction((tx) => createTransaction(input, tx));
  }

  await assertTransactionReferences(input, db);

  return db.transaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      date: input.date,
      amountMinor: input.amountMinor,
      sourceAccountId: input.sourceAccountId || null,
      destinationAccountId: input.type === "transfer" ? input.destinationAccountId || null : null,
      categoryId: input.type === "transfer" ? null : input.categoryId || null,
      description: input.description || null,
      notes: input.notes || null,
      tags: {
        create: Array.from(new Set(input.tagIds)).map((tagId) => ({
          tag: { connect: { id_userId: { id: tagId, userId: input.userId } } }
        }))
      }
    }
  });
}

export async function updateTransaction(input: {
  userId: string;
  transactionId: string;
  type: TransactionType;
  date: Date;
  amountMinor: number;
  sourceAccountId?: string;
  destinationAccountId?: string;
  categoryId?: string;
  description?: string;
  notes?: string;
  tagIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: { id: input.transactionId, userId: input.userId }
    });

    if (!transaction) {
      throw new Error("Transaction not found.");
    }

    await lockCategoriesForUse(
      input.userId,
      [transaction.categoryId, input.type === "transfer" ? null : input.categoryId].filter(
        (categoryId): categoryId is string => Boolean(categoryId)
      ),
      tx
    );
    await assertTransactionReferences(input, tx);

    return tx.transaction.update({
      where: { id_userId: { id: input.transactionId, userId: input.userId } },
      data: {
        type: input.type,
        date: input.date,
        amountMinor: input.amountMinor,
        sourceAccountId: input.sourceAccountId || null,
        destinationAccountId: input.type === "transfer" ? input.destinationAccountId || null : null,
        categoryId: input.type === "transfer" ? null : input.categoryId || null,
        description: input.description || null,
        notes: input.notes || null,
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

export async function deleteTransaction(userId: string, transactionId: string) {
  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: { id: transactionId, userId },
      select: { categoryId: true }
    });

    if (!transaction) {
      throw new Error("Transaction not found.");
    }

    if (transaction.categoryId) {
      await lockCategoryForUse(userId, transaction.categoryId, tx);
    }

    await tx.transaction.delete({ where: { id_userId: { id: transactionId, userId } } });
  });
}
