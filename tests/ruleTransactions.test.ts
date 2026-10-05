import type { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db.js";
import { createTransaction, updateTransaction } from "../src/services/transactions.js";
import { previewRuleApplications } from "../src/services/rules.js";

const rule = {
  id: "rule-1",
  name: "Supermarkets",
  matchText: "lidl, aldi, carrefour",
  isActive: true,
  categoryId: "food",
  category: { id: "food", name: "Food", type: "expense" },
  tags: [{ tag: { id: "household", name: "Household" } }, { tag: { id: "shared", name: "Shared" } }]
};
const input = {
  userId: "user-1",
  type: "expense" as const,
  date: new Date("2026-10-02T00:00:00.000Z"),
  amountMinor: 2500,
  sourceAccountId: "bank",
  description: "Card payment",
  notes: "ALDI weekly shopping",
  tagIds: ["shared", "personal"]
};

function database() {
  const mocks = {
    rule: { findMany: vi.fn().mockResolvedValue([rule]) },
    account: { count: vi.fn().mockResolvedValue(1) },
    tag: { count: vi.fn().mockResolvedValue(3) },
    $queryRaw: vi.fn().mockResolvedValue([{ id: "food", type: "expense" }]),
    transaction: {
      create: vi.fn().mockResolvedValue({ id: "created-1", amountMinor: 2500 }),
      findFirst: vi.fn().mockResolvedValue({ categoryId: "food" }),
      update: vi.fn().mockResolvedValue({ id: "created-1", categoryId: null })
    }
  };
  return { mocks, db: mocks as unknown as Prisma.TransactionClient };
}

afterEach(() => vi.restoreAllMocks());

it("prepares rules once when previewing existing expenses", async () => {
  let matchTextReads = 0;
  vi.spyOn(prisma.rule, "findMany").mockResolvedValue([
    { ...rule, get matchText() { matchTextReads += 1; return "lidl, ALDI"; } }
  ] as unknown as Awaited<ReturnType<typeof prisma.rule.findMany>>);
  vi.spyOn(prisma.transaction, "findMany").mockResolvedValue(
    Array.from({ length: 100 }, (_, index) => ({ ...input, id: `expense-${index}`, tags: [{ tagId: "shared" }] })) as unknown as
      Awaited<ReturnType<typeof prisma.transaction.findMany>>
  );
  const applications = await previewRuleApplications(input.userId);
  expect(applications).toHaveLength(100);
  expect(applications.every((application) => application.category.id === "food" &&
    application.suggestedTags.map((tag) => tag.id).join(",") === "household")).toBe(true);
  expect(matchTextReads).toBe(1);
});

describe("rules on transaction creation", () => {
  it("applies a user-scoped rule and merges tags before validating and saving", async () => {
    const { db, mocks } = database();
    const result = await createTransaction(input, db);
    expect(mocks.rule.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", isActive: true },
      orderBy: [{ priority: "asc" }, { name: "asc" }]
    }));
    expect(mocks.transaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      categoryId: "food", amountMinor: 2500, sourceAccountId: "bank",
      tags: { create: ["shared", "personal", "household"].map((id) => ({ tag: { connect: { id_userId: { id, userId: "user-1" } } } })) }
    }) });
    expect(result.appliedRule).toEqual({ name: "Supermarkets", categoryName: "Food", addedTagNames: ["Household"] });
  });

  it("leaves unmatched expenses uncategorized", async () => {
    const { db, mocks } = database();
    mocks.tag.count.mockResolvedValue(2);
    const result = await createTransaction({ ...input, notes: "Unrelated merchant" }, db);
    expect(result.appliedRule).toBeNull();
    expect(mocks.transaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ categoryId: null }) });
  });

  it("skips rules and rule tags when a category was selected", async () => {
    const { db, mocks } = database();
    mocks.tag.count.mockResolvedValue(2);
    await createTransaction({ ...input, categoryId: "food" }, db);
    expect(mocks.rule.findMany).not.toHaveBeenCalled();
    expect(mocks.transaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tags: { create: input.tagIds.map((id) => ({ tag: { connect: { id_userId: { id, userId: "user-1" } } } })) }
    }) });
  });

  it("does not apply expense rules to income or transfers", async () => {
    for (const type of ["income", "transfer"] as const) {
      const { db, mocks } = database();
      mocks.tag.count.mockResolvedValue(2);
      if (type === "transfer") mocks.account.count.mockResolvedValue(2);
      expect((await createTransaction({ ...input, type, destinationAccountId: "savings" }, db)).appliedRule).toBeNull();
      expect(mocks.rule.findMany).not.toHaveBeenCalled();
    }
  });

  it("validates rule-derived relationships before any write", async () => {
    const { db, mocks } = database();
    mocks.$queryRaw.mockResolvedValue([{ id: "food", type: "income" }]);
    await expect(createTransaction(input, db)).rejects.toThrow("Category type must match");
    expect(mocks.transaction.create).not.toHaveBeenCalled();
  });

  it("keeps manual edits and category removal without rerunning rules", async () => {
    const { db, mocks } = database();
    mocks.tag.count.mockResolvedValue(2);
    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback) => {
      if (typeof callback === "function") return callback(db);
      throw new Error("Expected a transaction callback.");
    });
    await updateTransaction({ ...input, transactionId: "created-1" });
    expect(mocks.rule.findMany).not.toHaveBeenCalled();
    expect(mocks.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ categoryId: null }) }));
  });
});
