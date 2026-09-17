import { createHash, randomUUID } from "node:crypto";
import type { CategoryType, TransactionType } from "@prisma/client";
import { maximumMoneyMinor, minimumMoneyMinor, parseMoneyToMinorUnits } from "../finance/money.js";
import { parseCsv, toCsv } from "../lib/csv.js";
import { parseDateOnly } from "../lib/dates.js";
import { prisma } from "../lib/db.js";
import {
  bulkWorkflowBatchSize,
  bulkWorkflowTransactionMaxWaitMs,
  bulkWorkflowTransactionTimeoutMs
} from "./bulkWorkflow.js";
import { transactionTypes } from "./transactions.js";
import { assertCategorySupportsTransaction, lockCategoriesForUse } from "./relationshipValidation.js";

type ImportAccount = {
  id: string;
  name: string;
  currency?: string;
};

type ImportCategory = {
  id: string;
  name: string;
  type: CategoryType;
  color?: string | null;
  icon?: string | null;
};

type ImportTag = {
  id: string;
  name: string;
};

type ImportRule = {
  id: string;
  name: string;
  matchText: string;
  categoryId: string;
  category: ImportCategory;
  tags: Array<{ tag: ImportTag }>;
};

export type TransactionImportRefs = {
  accounts: ImportAccount[];
  categories: ImportCategory[];
  tags: ImportTag[];
  existingTransactions?: ImportExistingTransaction[];
  rules?: ImportRule[];
};

export type ImportExistingTransaction = {
  id: string;
  type: TransactionType;
  date: Date;
  amountMinor: number;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  description: string | null;
};

export type TransactionImportRow = {
  rowNumber: number;
  type: TransactionType | null;
  date: Date | null;
  dateValue: string;
  amountMinor: number | null;
  sourceAccountId: string | null;
  sourceAccountName: string;
  sourceAccountCurrency: string | null;
  destinationAccountId: string | null;
  destinationAccountName: string;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  tagIds: string[];
  tagNames: string[];
  description: string;
  notes: string;
  errors: string[];
  warnings: string[];
  duplicateOfRowNumber: number | null;
  duplicateOfTransactionId: string | null;
  appliedRuleName: string | null;
};

export type TransactionImportPreview = {
  rows: TransactionImportRow[];
  validCount: number;
  errorCount: number;
  warningCount: number;
  duplicateCount: number;
};

export type TransactionImportMapping = {
  dateColumn: string;
  typeColumn: string;
  amountColumn: string;
  amountMinorColumn: string;
  debitColumn: string;
  creditColumn: string;
  accountColumn: string;
  destinationAccountColumn: string;
  categoryColumn: string;
  tagsColumn: string;
  descriptionColumn: string;
  notesColumn: string;
  defaultType: string;
  defaultAccountId: string;
};

export type TransactionImportMappingOption = {
  key: keyof TransactionImportMapping;
  label: string;
  required: boolean;
  guess: string;
};

export const importBatchSize = bulkWorkflowBatchSize;

export function normalizeCsvHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

function buildLookup<T extends { id: string; name: string }>(items: T[]): Map<string, T> {
  const lookup = new Map<string, T>();

  for (const item of items) {
    lookup.set(normalizeLookup(item.id), item);
    lookup.set(normalizeLookup(item.name), item);
  }

  return lookup;
}

function parseDate(value: string): Date | null {
  if (!value.trim()) {
    return null;
  }

  try {
    return parseDateOnly(value.trim());
  } catch {
    return null;
  }
}

function parseAmount(row: Record<string, string>, errors: string[], rowNumber: number): number | null {
  const amountMinorValue = row.amount_minor?.trim();

  if (amountMinorValue) {
    if (!/^-?\d+$/.test(amountMinorValue)) {
      errors.push(`Row ${rowNumber}, column amount_minor: amount minor must be a canonical signed integer.`);
      return null;
    }

    const amountMinor = Number(amountMinorValue);

    if (
      !Number.isSafeInteger(amountMinor) ||
      amountMinor < minimumMoneyMinor ||
      amountMinor > maximumMoneyMinor ||
      Math.abs(amountMinor) > maximumMoneyMinor
    ) {
      errors.push(`Row ${rowNumber}, column amount_minor: amount minor is outside the supported money range.`);
      return null;
    }

    if (amountMinor === 0) {
      errors.push(`Row ${rowNumber}, column amount_minor: amount minor must be non-zero.`);
      return null;
    }

    return Math.abs(amountMinor);
  }

  const amountValue = row.amount?.trim();

  if (!amountValue) {
    errors.push(`Row ${rowNumber}, column amount: amount is required.`);
    return null;
  }

  try {
    const amountMinor = parseMoneyToMinorUnits(amountValue);

    if (amountMinor === 0) {
      errors.push(`Row ${rowNumber}, column amount: amount must be greater than zero.`);
      return null;
    }

    if (Math.abs(amountMinor) > maximumMoneyMinor) {
      errors.push(`Row ${rowNumber}, column amount: amount is outside the supported money range.`);
      return null;
    }

    return Math.abs(amountMinor);
  } catch (error) {
    errors.push(`Row ${rowNumber}, column amount: ${error instanceof Error ? error.message : "Amount is invalid."}`);
    return null;
  }
}

function value(row: Record<string, string>, key: string): string {
  return row[key]?.trim() ?? "";
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function descriptionKey(description: string | null | undefined): string {
  return (description ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function duplicateSignature(input: {
  type: TransactionType;
  date: Date;
  amountMinor: number;
  sourceAccountId: string;
  destinationAccountId: string | null;
  description: string;
}): string {
  return [
    dateKey(input.date),
    input.type,
    String(input.amountMinor),
    input.sourceAccountId,
    input.destinationAccountId ?? "",
    descriptionKey(input.description)
  ].join("|");
}

function findMatchingRule(input: { type: TransactionType | null; description: string; notes: string }, rules: ImportRule[]) {
  if (input.type !== "expense") {
    return null;
  }

  const searchableText = `${input.description} ${input.notes}`.toLowerCase();

  return rules.find((rule) => rule.matchText.trim() && searchableText.includes(rule.matchText.trim().toLowerCase())) ?? null;
}

export function previewTransactionImportCsv(csvText: string, refs: TransactionImportRefs): TransactionImportPreview {
  const csvRows = parseCsv(csvText);

  if (csvRows.length < 2) {
    throw new Error("CSV must include a header row and at least one transaction row.");
  }

  const headers = csvRows[0].map(normalizeCsvHeader);
  const requiredHeaders = ["date", "type", "account"];

  for (const requiredHeader of requiredHeaders) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`CSV is missing the ${requiredHeader} column.`);
    }
  }

  if (!headers.includes("amount") && !headers.includes("amount_minor")) {
    throw new Error("CSV is missing the amount or amount_minor column.");
  }

  const accountLookup = buildLookup(refs.accounts);
  const categoryLookup = buildLookup(refs.categories);
  const tagLookup = buildLookup(refs.tags);
  const existingSignatures = new Map<string, ImportExistingTransaction>();

  for (const transaction of refs.existingTransactions ?? []) {
    if (!transaction.sourceAccountId) {
      continue;
    }

    existingSignatures.set(
      duplicateSignature({
        type: transaction.type,
        date: transaction.date,
        amountMinor: transaction.amountMinor,
        sourceAccountId: transaction.sourceAccountId,
        destinationAccountId: transaction.destinationAccountId,
        description: transaction.description ?? ""
      }),
      transaction
    );
  }

  const importedSignatures = new Map<string, number>();

  const rows = csvRows.slice(1).map((csvRow, index) => {
    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, csvRow[headerIndex] ?? ""]));
    const errors: string[] = [];
    const warnings: string[] = [];
    const typeValue = value(row, "type") as TransactionType;
    const type = transactionTypes.includes(typeValue) ? typeValue : null;
    const dateValue = value(row, "date");
    const date = parseDate(dateValue);
    const amountMinor = parseAmount(row, errors, index + 2);
    const sourceAccountName = value(row, "account");
    const destinationAccountName = value(row, "destination_account");
    const categoryName = value(row, "category");
    const sourceAccount = sourceAccountName ? accountLookup.get(normalizeLookup(sourceAccountName)) : undefined;
    const destinationAccount = destinationAccountName
      ? accountLookup.get(normalizeLookup(destinationAccountName))
      : undefined;
    const category = categoryName ? categoryLookup.get(normalizeLookup(categoryName)) : undefined;
    const tagNames = value(row, "tags")
      .split(";")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const tagIds: string[] = [];

    if (!type) {
      errors.push("Type must be income, expense, or transfer.");
    }

    if (!date) {
      errors.push("Date is required and must be valid.");
    }

    if (!sourceAccount) {
      errors.push("Account must match an existing account.");
    }

    if (type === "transfer" && !destinationAccount) {
      errors.push("Transfer destination account must match an existing account.");
    }

    if (type === "transfer" && sourceAccount && destinationAccount && sourceAccount.id === destinationAccount.id) {
      errors.push("Transfer accounts must be different.");
    }

    let appliedRuleName: string | null = null;
    let resolvedCategory = category;
    let resolvedCategoryName = categoryName;
    const description = value(row, "description");
    const notes = value(row, "notes");
    const matchingRule = findMatchingRule({ type, description, notes }, refs.rules ?? []);

    if (matchingRule) {
      if (!categoryName) {
        resolvedCategory = matchingRule.category;
        resolvedCategoryName = matchingRule.category.name;
      }
      appliedRuleName = matchingRule.name;
      warnings.push(`Rule applied: ${matchingRule.name}.`);
    }

    if (categoryName && !category) {
      errors.push("Category must match an existing category.");
    }

    if (type && type !== "transfer" && resolvedCategory && resolvedCategory.type !== type && resolvedCategory.type !== "both") {
      errors.push("Category type must match the transaction type.");
    }

    for (const tagName of tagNames) {
      const tag = tagLookup.get(normalizeLookup(tagName));

      if (tag) {
        tagIds.push(tag.id);
      } else {
        errors.push(`Tag "${tagName}" must match an existing tag.`);
      }
    }

    if (matchingRule) {
      for (const item of matchingRule.tags) {
        if (!tagIds.includes(item.tag.id)) {
          tagIds.push(item.tag.id);
          tagNames.push(item.tag.name);
        }
      }
    }

    let duplicateOfRowNumber: number | null = null;
    let duplicateOfTransactionId: string | null = null;

    if (errors.length === 0 && type && date && amountMinor !== null && sourceAccount) {
      const signature = duplicateSignature({
        type,
        date,
        amountMinor,
        sourceAccountId: sourceAccount.id,
        destinationAccountId: type === "transfer" ? destinationAccount?.id ?? null : null,
        description
      });
      const existingDuplicate = existingSignatures.get(signature);
      const importDuplicateRowNumber = importedSignatures.get(signature);

      if (existingDuplicate) {
        duplicateOfTransactionId = existingDuplicate.id;
        warnings.push("Possible duplicate of an existing transaction.");
      }

      if (importDuplicateRowNumber) {
        duplicateOfRowNumber = importDuplicateRowNumber;
        warnings.push(`Possible duplicate of CSV row ${importDuplicateRowNumber}.`);
      } else {
        importedSignatures.set(signature, index + 2);
      }
    }

    return {
      rowNumber: index + 2,
      type,
      date,
      dateValue,
      amountMinor,
      sourceAccountId: sourceAccount?.id ?? null,
      sourceAccountName,
      sourceAccountCurrency: sourceAccount?.currency ?? null,
      destinationAccountId: type === "transfer" ? destinationAccount?.id ?? null : null,
      destinationAccountName,
      categoryId: type === "transfer" ? null : resolvedCategory?.id ?? null,
      categoryName: type === "transfer" ? "" : resolvedCategoryName,
      categoryColor: type === "transfer" ? null : resolvedCategory?.color ?? null,
      categoryIcon: type === "transfer" ? null : resolvedCategory?.icon ?? null,
      tagIds: Array.from(new Set(tagIds)),
      tagNames,
      description,
      notes,
      errors,
      warnings,
      duplicateOfRowNumber,
      duplicateOfTransactionId,
      appliedRuleName
    };
  });

  return {
    rows,
    validCount: rows.filter((row) => row.errors.length === 0).length,
    errorCount: rows.filter((row) => row.errors.length > 0).length,
    warningCount: rows.reduce((count, row) => count + row.warnings.length, 0),
    duplicateCount: rows.filter((row) => row.duplicateOfRowNumber || row.duplicateOfTransactionId).length
  };
}

const mappingGuesses: Record<keyof Omit<TransactionImportMapping, "defaultType" | "defaultAccountId">, string[]> = {
  dateColumn: ["date", "transaction_date", "posted_date", "posting_date", "book_date"],
  typeColumn: ["type", "transaction_type"],
  amountColumn: ["amount", "value", "transaction_amount", "debit", "credit"],
  amountMinorColumn: ["amount_minor"],
  debitColumn: ["debit", "withdrawal", "withdrawals", "money_out", "outflow"],
  creditColumn: ["credit", "deposit", "deposits", "money_in", "inflow"],
  accountColumn: ["account", "account_name"],
  destinationAccountColumn: ["destination_account", "to_account"],
  categoryColumn: ["category"],
  tagsColumn: ["tags", "tag"],
  descriptionColumn: ["description", "memo", "merchant", "payee", "name", "details", "narrative"],
  notesColumn: ["notes", "note"]
};

function findHeader(headers: string[], guesses: string[]): string {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeCsvHeader(header), header]));

  for (const guess of guesses) {
    const exact = normalizedHeaders.get(guess);

    if (exact) {
      return exact;
    }
  }

  for (const [normalized, header] of normalizedHeaders) {
    if (guesses.some((guess) => normalized.includes(guess))) {
      return header;
    }
  }

  return "";
}

export function detectTransactionImportHeaders(csvText: string): string[] {
  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one transaction row.");
  }

  return rows[0].map((header) => header.trim()).filter(Boolean);
}

export function buildTransactionImportMappingOptions(headers: string[]): TransactionImportMappingOption[] {
  return [
    { key: "dateColumn", label: "Date", required: true, guess: findHeader(headers, mappingGuesses.dateColumn) },
    { key: "typeColumn", label: "Type", required: false, guess: findHeader(headers, mappingGuesses.typeColumn) },
    { key: "amountColumn", label: "Amount", required: false, guess: findHeader(headers, mappingGuesses.amountColumn) },
    {
      key: "amountMinorColumn",
      label: "Amount minor",
      required: false,
      guess: findHeader(headers, mappingGuesses.amountMinorColumn)
    },
    { key: "debitColumn", label: "Debit", required: false, guess: findHeader(headers, mappingGuesses.debitColumn) },
    { key: "creditColumn", label: "Credit", required: false, guess: findHeader(headers, mappingGuesses.creditColumn) },
    { key: "accountColumn", label: "Account", required: false, guess: findHeader(headers, mappingGuesses.accountColumn) },
    {
      key: "destinationAccountColumn",
      label: "Destination account",
      required: false,
      guess: findHeader(headers, mappingGuesses.destinationAccountColumn)
    },
    { key: "categoryColumn", label: "Category", required: false, guess: findHeader(headers, mappingGuesses.categoryColumn) },
    { key: "tagsColumn", label: "Tags", required: false, guess: findHeader(headers, mappingGuesses.tagsColumn) },
    {
      key: "descriptionColumn",
      label: "Description",
      required: false,
      guess: findHeader(headers, mappingGuesses.descriptionColumn)
    },
    { key: "notesColumn", label: "Notes", required: false, guess: findHeader(headers, mappingGuesses.notesColumn) }
  ];
}

function mappedValue(row: Record<string, string>, column: string): string {
  return column ? row[column]?.trim() ?? "" : "";
}

export function applyTransactionImportMapping(csvText: string, mapping: TransactionImportMapping): string {
  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one transaction row.");
  }

  if (!mapping.dateColumn) {
    throw new Error("Map a date column.");
  }

  if (!mapping.amountColumn && !mapping.amountMinorColumn && !mapping.debitColumn && !mapping.creditColumn) {
    throw new Error("Map an amount, amount minor, debit, or credit column.");
  }

  if (!mapping.typeColumn && !mapping.debitColumn && !mapping.creditColumn && !transactionTypes.includes(mapping.defaultType as TransactionType)) {
    throw new Error("Map a type column or choose a default transaction type.");
  }

  if (!mapping.accountColumn && !mapping.defaultAccountId) {
    throw new Error("Map an account column or choose a default account.");
  }

  const sourceHeaders = rows[0].map((header) => header.trim());
  const requiredMappedColumns = [
    mapping.dateColumn,
    mapping.typeColumn,
    mapping.amountColumn,
    mapping.amountMinorColumn,
    mapping.debitColumn,
    mapping.creditColumn,
    mapping.accountColumn,
    mapping.destinationAccountColumn,
    mapping.categoryColumn,
    mapping.tagsColumn,
    mapping.descriptionColumn,
    mapping.notesColumn
  ].filter(Boolean);

  for (const column of requiredMappedColumns) {
    if (!sourceHeaders.includes(column)) {
      throw new Error(`Mapped column "${column}" does not exist in the CSV.`);
    }
  }

  const normalizedRows: Array<Array<string | number | null | undefined>> = [
    ["date", "type", "amount", "amount_minor", "account", "destination_account", "category", "tags", "description", "notes"]
  ];

  for (const sourceRow of rows.slice(1)) {
    const row = Object.fromEntries(sourceHeaders.map((header, index) => [header, sourceRow[index] ?? ""]));
    const debit = mappedValue(row, mapping.debitColumn);
    const credit = mappedValue(row, mapping.creditColumn);

    if (debit && credit) {
      throw new Error("Rows cannot have both debit and credit values.");
    }

    const debitCreditType = debit ? "expense" : credit ? "income" : "";
    const debitCreditAmount = debit || credit;

    normalizedRows.push([
      mappedValue(row, mapping.dateColumn),
      debitCreditType || mappedValue(row, mapping.typeColumn) || mapping.defaultType,
      debitCreditAmount || mappedValue(row, mapping.amountColumn),
      mappedValue(row, mapping.amountMinorColumn),
      mappedValue(row, mapping.accountColumn) || mapping.defaultAccountId,
      mappedValue(row, mapping.destinationAccountColumn),
      mappedValue(row, mapping.categoryColumn),
      mappedValue(row, mapping.tagsColumn),
      mappedValue(row, mapping.descriptionColumn),
      mappedValue(row, mapping.notesColumn)
    ]);
  }

  return toCsv(normalizedRows);
}

export async function persistTransactionImport(
  userId: string,
  importBatchId: string,
  csvText: string,
  preview: TransactionImportPreview,
  includeDuplicates: boolean
): Promise<number> {
  if (preview.errorCount > 0) {
    throw new Error("Fix import errors before confirming.");
  }

  return prisma.$transaction(async (tx) => {
    const batches = await tx.$queryRaw<Array<{
      contentHash: string;
      status: string;
      importedCount: number | null;
    }>>`
      SELECT "contentHash", "status", "importedCount"
      FROM "TransactionImportBatch"
      WHERE "id" = ${importBatchId} AND "userId" = ${userId}
      FOR UPDATE
    `;
    const batch = batches[0];

    if (!batch || batch.contentHash !== transactionImportContentHash(csvText)) {
      throw new Error("Import confirmation is invalid or expired. Preview the CSV again.");
    }

    if (batch.status === "completed") {
      return batch.importedCount ?? 0;
    }

    const rowsToImport = preview.rows.filter((row) => {
      if (!includeDuplicates && (row.duplicateOfRowNumber || row.duplicateOfTransactionId)) {
        return false;
      }

      return true;
    });

    for (const row of rowsToImport) {
      if (!row.type || !row.date || row.amountMinor === null || !row.sourceAccountId) {
        throw new Error(`Row ${row.rowNumber} is incomplete.`);
      }
    }

    const accountIds = Array.from(
      new Set(
        rowsToImport.flatMap((row) => [row.sourceAccountId, row.destinationAccountId]).filter(
          (id): id is string => Boolean(id)
        )
      )
    );
    const categoryIds = Array.from(
      new Set(rowsToImport.map((row) => row.categoryId).filter((id): id is string => Boolean(id)))
    );
    const tagIds = Array.from(new Set(rowsToImport.flatMap((row) => row.tagIds)));
    const [accounts, tags] = await Promise.all([
      tx.account.findMany({ where: { userId, id: { in: accountIds } }, select: { id: true } }),
      tx.tag.findMany({ where: { userId, id: { in: tagIds } }, select: { id: true } })
    ]);
    const categories = await lockCategoriesForUse(userId, categoryIds, tx);
    const accountIdSet = new Set(accounts.map((account) => account.id));
    const categoryById = categories;
    const tagIdSet = new Set(tags.map((tag) => tag.id));

    for (const row of rowsToImport) {
      if (!row.type || !row.sourceAccountId || !accountIdSet.has(row.sourceAccountId)) {
        throw new Error(`Row ${row.rowNumber} references an account that no longer exists.`);
      }

      if (row.destinationAccountId && !accountIdSet.has(row.destinationAccountId)) {
        throw new Error(`Row ${row.rowNumber} references a transfer account that no longer exists.`);
      }

      if (row.categoryId) {
        const category = categoryById.get(row.categoryId);

        if (!category) {
          throw new Error(`Row ${row.rowNumber} references a category that no longer exists.`);
        }

        assertCategorySupportsTransaction(category.type, row.type, `Row ${row.rowNumber} category`);
      }

      const missingTag = row.tagIds.find((tagId) => !tagIdSet.has(tagId));

      if (missingTag) {
        throw new Error(`Row ${row.rowNumber} references tag ${missingTag} that no longer exists.`);
      }
    }

    const transactionRows = rowsToImport.map((row) => ({
      id: randomUUID(),
      userId,
      type: row.type as never,
      date: row.date as Date,
      amountMinor: row.amountMinor as number,
      sourceAccountId: row.sourceAccountId,
      destinationAccountId: row.type === "transfer" ? row.destinationAccountId : null,
      categoryId: row.type === "transfer" ? null : row.categoryId,
      description: row.description || null,
      notes: row.notes || null
    }));

    for (let start = 0; start < transactionRows.length; start += importBatchSize) {
      await tx.transaction.createMany({ data: transactionRows.slice(start, start + importBatchSize) });
    }

    const transactionTagRows = rowsToImport.flatMap((row, index) =>
      row.tagIds.map((tagId) => ({ transactionId: transactionRows[index].id, tagId, userId }))
    );
    for (let start = 0; start < transactionTagRows.length; start += importBatchSize) {
      await tx.transactionTag.createMany({
        data: transactionTagRows.slice(start, start + importBatchSize),
        skipDuplicates: true
      });
    }

    const importedCount = rowsToImport.length;

    await tx.transactionImportBatch.update({
      where: { id_userId: { id: importBatchId, userId } },
      data: { status: "completed", importedCount, completedAt: new Date() }
    });

    return importedCount;
  }, {
    maxWait: bulkWorkflowTransactionMaxWaitMs,
    timeout: bulkWorkflowTransactionTimeoutMs
  });
}

function transactionImportContentHash(csvText: string): string {
  return createHash("sha256").update(csvText, "utf8").digest("hex");
}

export async function createTransactionImportBatch(userId: string, csvText: string): Promise<string> {
  const batch = await prisma.transactionImportBatch.create({
    data: {
      userId,
      contentHash: transactionImportContentHash(csvText)
    },
    select: { id: true }
  });

  return batch.id;
}
