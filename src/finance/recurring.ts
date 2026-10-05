import { maximumMoneyMinor } from "./money.js";

export type RecurringAmountMode = "fixed" | "target_balance";
export type RecurringFeeAccount = "source" | "destination";

export function nextRecurringDate(date: Date, frequency: "monthly" | "weekly"): Date {
  if (frequency === "weekly") {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
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
