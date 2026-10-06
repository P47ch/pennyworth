import { assertMinorAmount, recurringFrequencies, type RecurringAmountMode, type RecurringFeeAccount } from "../finance/recurring.js";

export type RecurringSettings = {
  type: string; amountMode: RecurringAmountMode; amountMinor: number | null; targetBalanceMinor: number | null;
  feeAmountMinor: number; feeAccount: RecurringFeeAccount; feeCategoryId?: string | null; frequency: string;
};
export function validateRecurringSettings(input: RecurringSettings): void {
  if (!recurringFrequencies.some(frequency => frequency === input.frequency)) throw new Error("Choose a valid frequency.");
  if (!["fixed", "target_balance"].includes(input.amountMode)) throw new Error("Choose a valid amount mode.");
  if (!["source", "destination"].includes(input.feeAccount)) throw new Error("Choose source or destination for the fee.");
  assertMinorAmount(input.feeAmountMinor, true);
  if (input.amountMode === "fixed") {
    if (input.amountMinor === null) throw new Error("Amount must be greater than zero.");
    assertMinorAmount(input.amountMinor);
    if (input.targetBalanceMinor !== null) throw new Error("Fixed amounts cannot have a target balance.");
  } else {
    if (input.type !== "transfer") throw new Error("Target balances are only available for transfers.");
    if (input.amountMinor !== null || input.targetBalanceMinor === null) throw new Error("Choose a valid target balance.");
    assertMinorAmount(input.targetBalanceMinor, true);
  }
  if (input.type !== "transfer" && (input.feeAmountMinor !== 0 || input.feeCategoryId || input.feeAccount !== "source")) {
    throw new Error("Top-up fees are only available for transfers.");
  }
}
