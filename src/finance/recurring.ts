import { maximumMoneyMinor } from "./money.js";

export type RecurringAmountMode = "fixed" | "target_balance";
export type RecurringFeeAccount = "source" | "destination";

export const recurringFrequencies = ["daily", "weekly", "monthly", "every_3_months", "every_6_months"] as const;
export type RecurringFrequency = typeof recurringFrequencies[number];
export const recurringFrequencyLabels: Record<RecurringFrequency, string> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly", every_3_months: "Quarterly", every_6_months: "Semiannual"
};

export function nextRecurringDate(date: Date, frequency: RecurringFrequency): Date {
  if (frequency === "daily" || frequency === "weekly") {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + (frequency === "daily" ? 1 : 7));
    return next;
  }
  const year = date.getUTCFullYear();
  const monthIntervals = { monthly: 1, every_3_months: 3, every_6_months: 6 };
  const month = date.getUTCMonth() + monthIntervals[frequency];
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

export function assertMinorAmount(amount: number, allowZero = false): void {
  if (!Number.isSafeInteger(amount) || amount < (allowZero ? 0 : 1) || amount > maximumMoneyMinor) {
    throw new Error("Amount is outside the supported range.");
  }
}

export function calculateRecurringAmounts(input: {
  amountMode: RecurringAmountMode;
  amountMinor: number | null;
  targetBalanceMinor: number | null;
  destinationBalanceMinor: number;
  feeAmountMinor: number;
  feeAccount: RecurringFeeAccount;
}) {
  assertMinorAmount(input.feeAmountMinor, true);
  if (!Number.isSafeInteger(input.destinationBalanceMinor)) throw new Error("Amount is outside the supported range.");
  let transferAmountMinor: number;
  if (input.amountMode === "target_balance") {
    if (input.targetBalanceMinor === null) throw new Error("Choose a valid target balance.");
    assertMinorAmount(input.targetBalanceMinor, true);
    const gap = Math.max(0, input.targetBalanceMinor - input.destinationBalanceMinor);
    if (!Number.isSafeInteger(gap)) throw new Error("Amount is outside the supported range.");
    transferAmountMinor = gap === 0 ? 0 : gap + (input.feeAccount === "destination" ? input.feeAmountMinor : 0);
  } else {
    if (input.amountMinor === null) throw new Error("Amount must be greater than zero.");
    assertMinorAmount(input.amountMinor);
    transferAmountMinor = input.amountMinor;
  }
  assertMinorAmount(transferAmountMinor, true);
  const feeAmountMinor = transferAmountMinor === 0 ? 0 : input.feeAmountMinor;
  const sourceDebitMinor = transferAmountMinor + (input.feeAccount === "source" ? feeAmountMinor : 0);
  const destinationCreditMinor = transferAmountMinor - (input.feeAccount === "destination" ? feeAmountMinor : 0);
  const destinationAfterMinor = input.destinationBalanceMinor + destinationCreditMinor;
  if (![sourceDebitMinor, destinationCreditMinor, destinationAfterMinor].every(Number.isSafeInteger)) {
    throw new Error("Amount is outside the supported range.");
  }
  return { transferAmountMinor, feeAmountMinor, sourceDebitMinor, destinationCreditMinor, destinationAfterMinor };
}
