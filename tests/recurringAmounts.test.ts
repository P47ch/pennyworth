import { describe, expect, it } from "vitest";
import { calculateRecurringAmounts, nextRecurringDate } from "../src/finance/recurring.js";
import { maximumMoneyMinor } from "../src/finance/money.js";

const topUp = { amountMode: "target_balance" as const, amountMinor: null, targetBalanceMinor: 10_000,
  destinationBalanceMinor: 3_500, feeAmountMinor: 50, feeAccount: "source" as const };

describe("recurring amounts", () => {
  it("records the source fee separately from the principal", () => {
    expect(calculateRecurringAmounts(topUp)).toEqual({ transferAmountMinor: 6_500, feeAmountMinor: 50,
      sourceDebitMinor: 6_550, destinationCreditMinor: 6_500, destinationAfterMinor: 10_000 });
  });
  it("grosses up a destination-paid fee to reach the target after fees", () => {
    expect(calculateRecurringAmounts({ ...topUp, feeAccount: "destination" })).toEqual({
      transferAmountMinor: 6_550, feeAmountMinor: 50, sourceDebitMinor: 6_550,
      destinationCreditMinor: 6_500, destinationAfterMinor: 10_000 });
  });
  it.each([10_000, 15_000])("skips at or above target (%i), including the fee", (balance) => {
    expect(calculateRecurringAmounts({ ...topUp, destinationBalanceMinor: balance })).toMatchObject({
      transferAmountMinor: 0, feeAmountMinor: 0, sourceDebitMinor: 0, destinationCreditMinor: 0 });
  });
  it("includes negative balances and incoming refunds", () => {
    expect(calculateRecurringAmounts({ ...topUp, destinationBalanceMinor: -500 }).transferAmountMinor).toBe(10_500);
    expect(calculateRecurringAmounts({ ...topUp, destinationBalanceMinor: 5_500 }).transferAmountMinor).toBe(4_500);
  });
  it("retains the configured gross amount for fixed transfers", () => {
    expect(calculateRecurringAmounts({ ...topUp, amountMode: "fixed", amountMinor: 6_500, feeAccount: "destination" }))
      .toMatchObject({ transferAmountMinor: 6_500, destinationCreditMinor: 6_450, destinationAfterMinor: 9_950 });
  });
  it("accepts a free occurrence", () => {
    expect(calculateRecurringAmounts({ ...topUp, feeAmountMinor: 0 })).toMatchObject({ feeAmountMinor: 0, sourceDebitMinor: 6_500 });
  });
  it.each([-1, 0.5, maximumMoneyMinor + 1])("rejects invalid fees (%s)", (fee) => {
    expect(() => calculateRecurringAmounts({ ...topUp, feeAmountMinor: fee })).toThrow("supported range");
  });
  it("rejects a grossed-up transfer beyond the database integer limit", () => {
    expect(() => calculateRecurringAmounts({ ...topUp, targetBalanceMinor: maximumMoneyMinor,
      destinationBalanceMinor: 0, feeAccount: "destination" })).toThrow("supported range");
  });
  it("advances seven calendar days across DST, month and year boundaries", () => {
    for (const [from, to] of [["2026-03-27", "2026-04-03"], ["2026-12-28", "2027-01-04"]]) {
      expect(nextRecurringDate(new Date(from), "weekly").toISOString().slice(0, 10)).toBe(to);
    }
  });
});
