import type { RecurringFrequency, TransactionType } from "@prisma/client";
import { parseMoneyToMinorUnits } from "../finance/money.js";
import type { RecurringAmountMode, RecurringFeeAccount } from "../finance/recurring.js";
import { parseDateOnly, todayDateInput } from "../lib/dates.js";
import { validateRecurringSettings } from "../lib/recurringSettings.js";
import { transactionTypes } from "../services/transactions.js";
import { field, type formBody } from "./form.js";

type Body = ReturnType<typeof formBody>;
export function parseRecurringConfirmationDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseDateOnly(value, "Choose a valid next date.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new Error("Choose a valid next date.");
  return date;
}
export function recurringFormValues(timeZone: string, body?: Body) {
  return {
    name: body ? field(body, "name") : "", type: body ? field(body, "type") : "expense",
    amountMode: body ? field(body, "amountMode") || "fixed" : "fixed",
    amount: body ? field(body, "amount") : "", targetBalance: body ? field(body, "targetBalance") : "",
    feeAmount: body ? field(body, "feeAmount") : "0.00", feeAccount: body ? field(body, "feeAccount") || "source" : "source",
    feeCategoryId: body ? field(body, "feeCategoryId") : "",
    sourceAccountId: body ? field(body, "sourceAccountId") : "", destinationAccountId: body ? field(body, "destinationAccountId") : "",
    categoryId: body ? field(body, "categoryId") : "", description: body ? field(body, "description") : "",
    notes: body ? field(body, "notes") : "", frequency: body ? field(body, "frequency") : "monthly",
    nextDate: body ? field(body, "nextDate") : todayDateInput(timeZone), isActive: body ? field(body, "isActive") === "on" : true
  };
}
export function validateRecurringInput(body: Body) {
  const type = field(body, "type") as TransactionType;
  if (!transactionTypes.includes(type)) throw new Error("Choose a valid transaction type.");
  const amountMode = (field(body, "amountMode") || "fixed") as RecurringAmountMode;
  const amountMinor = amountMode === "target_balance" ? null : parseMoneyToMinorUnits(field(body, "amount"));
  const targetBalanceMinor = amountMode === "target_balance" ? parseMoneyToMinorUnits(field(body, "targetBalance")) : null;
  const feeAmountMinor = parseMoneyToMinorUnits(field(body, "feeAmount") || "0");
  const feeAccount = (field(body, "feeAccount") || "source") as RecurringFeeAccount;
  const feeCategoryId = field(body, "feeCategoryId");
  const frequency = field(body, "frequency") as RecurringFrequency;
  validateRecurringSettings({ type, amountMode, amountMinor, targetBalanceMinor, feeAmountMinor, feeAccount, feeCategoryId, frequency });
  return { name: field(body, "name").trim(), type, amountMode, amountMinor, targetBalanceMinor, feeAmountMinor, feeAccount, feeCategoryId,
    sourceAccountId: field(body, "sourceAccountId"), destinationAccountId: field(body, "destinationAccountId"),
    categoryId: field(body, "categoryId"), description: field(body, "description").trim(), notes: field(body, "notes").trim(),
    frequency, nextDate: parseDateOnly(field(body, "nextDate"), "Choose a valid next date."), isActive: field(body, "isActive") === "on" };
}
