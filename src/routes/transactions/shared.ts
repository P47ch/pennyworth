import type { TransactionType } from "@prisma/client";
import { parseMoneyToMinorUnits } from "../../finance/money.js";
import { loadConfig } from "../../lib/config.js";
import { parseDateOnly, todayDateInput } from "../../lib/dates.js";
import { transactionTypes, type TransactionFilters } from "../../services/transactions.js";
import { field, fields, formBody } from "../form.js";

const timeZone = loadConfig().timeZone;

export type TransactionFilterViewModel = TransactionFilters & {
  typeValue: string;
  accountIdValue: string;
  categoryIdValue: string;
  tagIdValue: string;
  searchValue: string;
  fromValue: string;
  toValue: string;
  pageValue: string;
};

export function transactionFormValues(body?: ReturnType<typeof formBody>) {
  return {
    type: body ? field(body, "type") : "expense",
    date: body ? field(body, "date") : todayDateInput(timeZone),
    amount: body ? field(body, "amount") : "",
    sourceAccountId: body ? field(body, "sourceAccountId") : "",
    destinationAccountId: body ? field(body, "destinationAccountId") : "",
    categoryId: body ? field(body, "categoryId") : "",
    description: body ? field(body, "description") : "",
    notes: body ? field(body, "notes") : "",
    tagIds: body ? fields(body, "tagIds").filter(Boolean) : []
  };
}

export function parseTransactionFilters(query: unknown): TransactionFilterViewModel {
  const params = query && typeof query === "object" ? (query as Record<string, string | undefined>) : {};
  const type = params.type as TransactionType | undefined;
  const from = params.from ? parseOptionalDate(params.from) : undefined;
  const to = params.to ? parseOptionalDate(params.to) : undefined;

  return {
    type: type && transactionTypes.includes(type) ? type : undefined,
    accountId: params.accountId || undefined,
    categoryId: params.categoryId || undefined,
    tagId: params.tagId || undefined,
    search: params.search?.trim() || undefined,
    from,
    to,
    typeValue: params.type || "",
    accountIdValue: params.accountId || "",
    categoryIdValue: params.categoryId || "",
    tagIdValue: params.tagId || "",
    searchValue: params.search || "",
    fromValue: params.from || "",
    toValue: params.to || "",
    pageValue: params.page || "1"
  };
}

function parseOptionalDate(value: string): Date | undefined {
  try {
    return parseDateOnly(value);
  } catch {
    return undefined;
  }
}

export function parseTransactionPage(query: unknown): number {
  const params = query && typeof query === "object" ? (query as Record<string, string | undefined>) : {};
  const page = Number.parseInt(params.page ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function validateTransactionInput(body: ReturnType<typeof formBody>) {
  const type = field(body, "type") as TransactionType;
  const sourceAccountId = field(body, "sourceAccountId");
  const destinationAccountId = field(body, "destinationAccountId");

  if (!transactionTypes.includes(type)) {
    throw new Error("Choose a valid transaction type.");
  }

  if ((type === "income" || type === "expense") && !sourceAccountId) {
    throw new Error("Choose an account.");
  }

  if (type === "transfer" && (!sourceAccountId || !destinationAccountId)) {
    throw new Error("Transfers require source and destination accounts.");
  }

  if (type === "transfer" && sourceAccountId === destinationAccountId) {
    throw new Error("Transfer accounts must be different.");
  }

  const amountMinor = parseMoneyToMinorUnits(field(body, "amount"));

  if (amountMinor <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  return {
    type,
    date: parseDateOnly(field(body, "date"), "Choose a valid transaction date."),
    amountMinor,
    sourceAccountId,
    destinationAccountId,
    categoryId: field(body, "categoryId"),
    description: field(body, "description").trim(),
    notes: field(body, "notes").trim(),
    tagIds: fields(body, "tagIds").filter(Boolean)
  };
}
