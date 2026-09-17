import { describe, expect, it } from "vitest";
import { balanceRowsToMap } from "../src/queries/accountBalances.js";

describe("account balance query results", () => {
  it("converts PostgreSQL bigint balances to application numbers", () => {
    const balances = balanceRowsToMap([
      { accountId: "checking", balanceMinor: 125_000n },
      { accountId: "credit-card", balanceMinor: -42_500n }
    ]);

    expect(balances).toEqual(
      new Map([
        ["checking", 125_000],
        ["credit-card", -42_500]
      ])
    );
  });

  it("accepts balances at the JavaScript safe integer boundaries", () => {
    expect(
      balanceRowsToMap([
        { accountId: "maximum", balanceMinor: BigInt(Number.MAX_SAFE_INTEGER) },
        { accountId: "minimum", balanceMinor: BigInt(Number.MIN_SAFE_INTEGER) }
      ])
    ).toEqual(
      new Map([
        ["maximum", Number.MAX_SAFE_INTEGER],
        ["minimum", Number.MIN_SAFE_INTEGER]
      ])
    );
  });

  it("rejects balances that cannot be represented exactly", () => {
    expect(() =>
      balanceRowsToMap([{ accountId: "overflow", balanceMinor: BigInt(Number.MAX_SAFE_INTEGER) + 1n }])
    ).toThrow("Account overflow balance exceeds the safe integer range.");
  });
});
