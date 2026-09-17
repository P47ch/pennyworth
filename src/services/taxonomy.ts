import type { CategoryType } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { assertCategoryTypeChangeCompatible } from "./relationshipValidation.js";

export const categoryTypes: CategoryType[] = ["income", "expense", "both"];

export async function listCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    include: { parent: true },
    orderBy: [{ type: "asc" }, { name: "asc" }]
  });
}

export async function createCategory(input: {
  userId: string;
  name: string;
  type: CategoryType;
  parentId?: string;
  color?: string;
  icon?: string;
}) {
  await assertValidCategoryParent(input.userId, null, input.parentId);

  return prisma.category.create({
    data: {
      userId: input.userId,
      name: input.name,
      type: input.type,
      parentId: input.parentId || null,
      color: input.color || null,
      icon: input.icon || null
    }
  });
}

export async function getCategoryForUser(userId: string, categoryId: string) {
  return prisma.category.findFirst({
    where: { id: categoryId, userId },
    include: { parent: true }
  });
}

async function assertValidCategoryParent(
  userId: string,
  categoryId: string | null,
  parentId: string | undefined,
  db: typeof prisma | import("@prisma/client").Prisma.TransactionClient = prisma
) {
  if (!parentId) {
    return;
  }

  if (categoryId && parentId === categoryId) {
    throw new Error("A category cannot be its own parent.");
  }

  const categories = await db.category.findMany({
    where: { userId },
    select: { id: true, parentId: true }
  });
  const parentById = new Map(categories.map((category) => [category.id, category.parentId]));

  if (!parentById.has(parentId)) {
    throw new Error("Choose a valid parent category.");
  }

  let currentParentId: string | null | undefined = parentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      throw new Error("Category hierarchy contains a cycle.");
    }

    visited.add(currentParentId);

    if (categoryId && currentParentId === categoryId) {
      throw new Error("A category cannot use one of its children as parent.");
    }

    currentParentId = parentById.get(currentParentId);
  }
}

export async function updateCategory(input: {
  userId: string;
  categoryId: string;
  name: string;
  type: CategoryType;
  parentId?: string;
  color?: string;
  icon?: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Category" WHERE "id" = ${input.categoryId} AND "userId" = ${input.userId} FOR UPDATE`;
    const category = await tx.category.findFirst({
      where: { id: input.categoryId, userId: input.userId }
    });

    if (!category) {
      throw new Error("Category not found.");
    }

    await assertValidCategoryParent(input.userId, input.categoryId, input.parentId, tx);
    await assertCategoryTypeChangeCompatible(input.userId, input.categoryId, input.type, tx);

    return tx.category.update({
      where: { id_userId: { id: input.categoryId, userId: input.userId } },
      data: {
        name: input.name,
        type: input.type,
        parentId: input.parentId || null,
        color: input.color || null,
        icon: input.icon || null
      }
    });
  });
}

export async function deleteCategoryIfUnused(userId: string, categoryId: string) {
  const category = await getCategoryForUser(userId, categoryId);

  if (!category) {
    throw new Error("Category not found.");
  }

  const [transactionCount, childCount] = await Promise.all([
    prisma.transaction.count({ where: { userId, categoryId } }),
    prisma.category.count({ where: { userId, parentId: categoryId } })
  ]);

  if (transactionCount > 0) {
    throw new Error("Category is used by transactions and cannot be deleted.");
  }

  if (childCount > 0) {
    throw new Error("Category has child categories and cannot be deleted.");
  }

  await prisma.category.delete({ where: { id_userId: { id: categoryId, userId } } });
}

export async function listTags(userId: string) {
  return prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

export async function createTag(input: { userId: string; name: string; color?: string }) {
  return prisma.tag.create({
    data: {
      userId: input.userId,
      name: input.name,
      color: input.color || null
    }
  });
}

export async function getTagForUser(userId: string, tagId: string) {
  return prisma.tag.findFirst({
    where: { id: tagId, userId }
  });
}

export async function updateTag(input: { userId: string; tagId: string; name: string; color?: string }) {
  const tag = await getTagForUser(input.userId, input.tagId);

  if (!tag) {
    throw new Error("Tag not found.");
  }

  return prisma.tag.update({
    where: { id_userId: { id: input.tagId, userId: input.userId } },
    data: {
      name: input.name,
      color: input.color || null
    }
  });
}

export async function deleteTag(userId: string, tagId: string) {
  const tag = await getTagForUser(userId, tagId);

  if (!tag) {
    throw new Error("Tag not found.");
  }

  await prisma.tag.delete({ where: { id_userId: { id: tagId, userId } } });
}
