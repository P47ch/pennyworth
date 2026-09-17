import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";

export const defaultCategories = [
  { name: "Salary", type: "income", color: "#247a3d", icon: "salary" },
  { name: "Food", type: "expense", color: "#d97706", icon: "food" },
  { name: "Rent", type: "expense", color: "#b91c1c", icon: "home" },
  { name: "Transport", type: "expense", color: "#2563eb", icon: "transport" },
  { name: "Health", type: "expense", color: "#0f766e", icon: "health" },
  { name: "Subscriptions", type: "expense", color: "#7c3aed", icon: "subscription" },
  { name: "Investment", type: "both", color: "#4b5563", icon: "investment" },
  { name: "Taxes", type: "expense", color: "#be123c", icon: "tax" },
  { name: "Other", type: "both", color: "#525252", icon: "other" }
] satisfies Array<{
  name: string;
  type: "income" | "expense" | "both";
  color: string;
  icon: string;
}>;

export const defaultTags = [
  { name: "recurring", color: "#2563eb" },
  { name: "business", color: "#7c3aed" },
  { name: "personal", color: "#16a34a" },
  { name: "reimbursable", color: "#d97706" },
  { name: "vacation", color: "#0891b2" }
] as const;

type UserDefaultsDatabase = Pick<Prisma.TransactionClient, "category" | "tag">;

export async function createUserDefaults(
  userId: string,
  db: UserDefaultsDatabase = prisma
) {
  await Promise.all([
    db.category.createMany({
      data: defaultCategories.map((category) => ({ userId, ...category })),
      skipDuplicates: true
    }),
    db.tag.createMany({
      data: defaultTags.map((tag) => ({ userId, ...tag })),
      skipDuplicates: true
    })
  ]);
}
