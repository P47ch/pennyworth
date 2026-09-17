import { describe, expect, it } from "vitest";
import {
  accountBalanceHistoryRowsToPoints,
  cashBalanceHistoryRowsToPoints
} from "../src/queries/netWorth.js";

describe("net worth query results", () => {
  it("converts monthly PostgreSQL cash balances to application numbers", () => {
    expect(
      cashBalanceHistoryRowsToPoints([
        { monthKey: "2026-05", cashBalanceMinor: 125_000n },
        { monthKey: "2026-06", cashBalanceMinor: -42_500n }
      ])
    ).toEqual([
      { monthKey: "2026-05", cashBalanceMinor: 125_000 },
      { monthKey: "2026-06", cashBalanceMinor: -42_500 }
    ]);
  });

  it("rejects balances outside the JavaScript safe integer range", () => {
    expect(() =>
      cashBalanceHistoryRowsToPoints([
        { monthKey: "2026-06", cashBalanceMinor: BigInt(Number.MAX_SAFE_INTEGER) + 1n }
      ])
    ).toThrow("Cash balance for 2026-06 exceeds the safe integer range.");
  });

  it("converts per-account history rows and retains account metadata", () => {
    expect(
      accountBalanceHistoryRowsToPoints([
        {
          monthKey: "2026-06",
          accountId: "checking",
          accountName: "Checking",
          accountType: "bank",
          currency: "EUR",
          balanceMinor: 125_000n
        }
      ])
    ).toEqual([
      {
        monthKey: "2026-06",
        accountId: "checking",
        accountName: "Checking",
        accountType: "bank",
        currency: "EUR",
        balanceMinor: 125_000
      }
    ]);
  });
});
