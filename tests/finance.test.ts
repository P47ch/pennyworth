import { describe, expect, it } from "vitest";
import { calculateAccountBalances } from "../src/finance/balances.js";
import {
  allocateInvestmentPositions,
  calculateInvestmentPositions,
  calculateInvestmentPositionsExact,
  calculatePositionAmountMinorExact,
  calculatePositionAmountMinor,
  summarizeInvestmentPerformance
} from "../src/finance/investments.js";
import { formatMoneyFromMinorUnits, parseMoneyToMinorUnits } from "../src/finance/money.js";
import { spendingByCategory, summarizeMonth } from "../src/finance/summaries.js";

describe("finance calculations", () => {
  it("adds income to account balance and monthly cashflow", () => {
    const balances = calculateAccountBalances(
      [{ id: "bank", openingBalanceMinor: 10000 }],
      [{ type: "income", amountMinor: 2500, sourceAccountId: "bank", destinationAccountId: null }]
    );
    const summary = summarizeMonth(
      [{ type: "income", amountMinor: 2500, date: new Date("2026-06-01"), categoryName: "Salary" }],
      new Date("2026-06-15")
    );

    expect(balances.get("bank")).toBe(12500);
    expect(summary.incomeMinor).toBe(2500);
    expect(summary.netCashflowMinor).toBe(2500);
  });

  it("subtracts expenses from account balance and monthly cashflow", () => {
    const balances = calculateAccountBalances(
      [{ id: "bank", openingBalanceMinor: 10000 }],
      [{ type: "expense", amountMinor: 1500, sourceAccountId: "bank", destinationAccountId: null }]
    );
    const summary = summarizeMonth(
      [{ type: "expense", amountMinor: 1500, date: new Date("2026-06-02"), categoryName: "Food" }],
      new Date("2026-06-15")
    );

    expect(balances.get("bank")).toBe(8500);
    expect(summary.expensesMinor).toBe(1500);
    expect(summary.netCashflowMinor).toBe(-1500);
  });

  it("moves transfers between accounts without affecting income or expense totals", () => {
    const balances = calculateAccountBalances(
      [
        { id: "bank", openingBalanceMinor: 10000 },
        { id: "cash", openingBalanceMinor: 2000 }
      ],
      [{ type: "transfer", amountMinor: 3000, sourceAccountId: "bank", destinationAccountId: "cash" }]
    );
    const summary = summarizeMonth(
      [{ type: "transfer", amountMinor: 3000, date: new Date("2026-06-03"), categoryName: null }],
      new Date("2026-06-15")
    );

    expect(balances.get("bank")).toBe(7000);
    expect(balances.get("cash")).toBe(5000);
    expect(summary.incomeMinor).toBe(0);
    expect(summary.expensesMinor).toBe(0);
  });

  it("applies investment cash impacts to account balances without income or expense transactions", () => {
    const balances = calculateAccountBalances(
      [
        { id: "broker", openingBalanceMinor: 100000 },
        { id: "bank", openingBalanceMinor: 50000 }
      ],
      [],
      [
        { type: "buy", accountId: "broker", cashAccountId: "broker", cashAmountMinor: 25000 },
        { type: "sell", accountId: "broker", cashAccountId: "broker", cashAmountMinor: 12000 },
        { type: "dividend", accountId: "broker", cashAccountId: null, cashAmountMinor: 500 },
        { type: "interest", accountId: "broker", cashAccountId: "bank", cashAmountMinor: 300 },
        { type: "fee", accountId: "broker", cashAccountId: "broker", cashAmountMinor: 200 }
      ]
    );

    expect(balances.get("broker")).toBe(87300);
    expect(balances.get("bank")).toBe(50300);
  });

  it("aggregates spending by category", () => {
    const totals = spendingByCategory([
      { type: "expense", amountMinor: 1000, date: new Date("2026-06-01"), categoryName: "Food" },
      { type: "expense", amountMinor: 2500, date: new Date("2026-06-02"), categoryName: "Food" },
      { type: "income", amountMinor: 500000, date: new Date("2026-06-03"), categoryName: "Salary" }
    ]);

    expect(totals.get("Food")).toBe(3500);
    expect(totals.has("Salary")).toBe(false);
  });

  it("converts money to and from minor units without floating point arithmetic in parsing", () => {
    expect(parseMoneyToMinorUnits("12.34")).toBe(1234);
    expect(parseMoneyToMinorUnits("12,30")).toBe(1230);
    expect(formatMoneyFromMinorUnits(1234, "EUR")).toBe("€12.34");
  });

  it("rejects monetary values outside the database-supported integer range", () => {
    expect(parseMoneyToMinorUnits("21474836.47")).toBe(2_147_483_647);
    expect(parseMoneyToMinorUnits("-21474836.48")).toBe(-2_147_483_648);
    expect(() => parseMoneyToMinorUnits("21474836.48")).toThrow("outside the supported range");
    expect(() => parseMoneyToMinorUnits("-21474836.49")).toThrow("outside the supported range");
    expect(() => parseMoneyToMinorUnits("999999999999999999999.99")).toThrow("outside the supported range");
  });

  it("calculates position value from fractional quantities using integer minor units", () => {
    expect(calculatePositionAmountMinor("12.50000000", 11640)).toBe(145500);
    expect(calculatePositionAmountMinor("0.07500000", 6200000)).toBe(465000);
  });

  it("rounds fractional minor units to the nearest minor unit", () => {
    expect(calculatePositionAmountMinor("0.33333333", 100)).toBe(33);
    expect(calculatePositionAmountMinor("0.33500000", 100)).toBe(34);
  });

  it("keeps investment values exact until a checked number boundary", () => {
    expect(calculatePositionAmountMinorExact("1000000000000000", 1000000000)).toBe(1000000000000000000000000n);
    expect(() => calculatePositionAmountMinor("1000000000000000", 1000000000)).toThrow("safe integer range");

    const exact = calculateInvestmentPositionsExact([
      {
        id: "large-buy-1",
        accountId: "broker",
        assetId: "fund",
        type: "buy",
        date: new Date("2026-01-01"),
        quantity: "1",
        amountMinor: Number.MAX_SAFE_INTEGER
      },
      {
        id: "large-buy-2",
        accountId: "broker",
        assetId: "fund",
        type: "buy",
        date: new Date("2026-01-02"),
        quantity: "1",
        amountMinor: Number.MAX_SAFE_INTEGER
      }
    ]);

    expect(exact.positions[0].costBasisMinor).toBe(BigInt(Number.MAX_SAFE_INTEGER) * 2n);
    expect(() => calculateInvestmentPositions([
      {
        id: "large-buy-1",
        accountId: "broker",
        assetId: "fund",
        type: "buy",
        date: new Date("2026-01-01"),
        quantity: "1",
        amountMinor: Number.MAX_SAFE_INTEGER
      },
      {
        id: "large-buy-2",
        accountId: "broker",
        assetId: "fund",
        type: "buy",
        date: new Date("2026-01-02"),
        quantity: "1",
        amountMinor: Number.MAX_SAFE_INTEGER
      }
    ])).toThrow("safe integer range");
  });

  it("derives average cost from multiple investment buys", () => {
    const { positions } = calculateInvestmentPositions([
      {
        id: "buy-1",
        accountId: "broker",
        assetId: "vwce",
        type: "buy",
        date: new Date("2026-01-01"),
        quantity: "10",
        amountMinor: 100000
      },
      {
        id: "buy-2",
        accountId: "broker",
        assetId: "vwce",
        type: "buy",
        date: new Date("2026-02-01"),
        quantity: "5",
        amountMinor: 60000
      }
    ]);

    expect(positions[0]).toMatchObject({
      quantity: "15",
      costBasisMinor: 160000,
      averageCostMinor: 10667
    });
  });

  it("calculates realized gain on a partial sell and leaves remaining cost basis", () => {
    const { positions, transactionResults } = calculateInvestmentPositions([
      {
        id: "buy",
        accountId: "broker",
        assetId: "vwce",
        type: "buy",
        date: new Date("2026-01-01"),
        quantity: "10",
        amountMinor: 100000
      },
      {
        id: "sell",
        accountId: "broker",
        assetId: "vwce",
        type: "sell",
        date: new Date("2026-02-01"),
        quantity: "4",
        amountMinor: 50000
      }
    ]);

    expect(transactionResults.find((transaction) => transaction.id === "sell")?.realizedGainMinor).toBe(10000);
    expect(positions[0]).toMatchObject({
      quantity: "6",
      costBasisMinor: 60000,
      realizedGainMinor: 10000
    });
  });

  it("orders same-day investment activity by creation time before record ID", () => {
    const date = new Date("2026-02-01T00:00:00.000Z");
    const { positions } = calculateInvestmentPositions([
      {
        id: "z-buy",
        accountId: "broker",
        assetId: "vwce",
        type: "buy",
        date,
        createdAt: new Date("2026-02-01T08:00:00.000Z"),
        quantity: "2",
        amountMinor: 20000
      },
      {
        id: "a-sell",
        accountId: "broker",
        assetId: "vwce",
        type: "sell",
        date,
        createdAt: new Date("2026-02-01T09:00:00.000Z"),
        quantity: "1",
        amountMinor: 12000
      }
    ]);

    expect(positions[0]).toMatchObject({
      quantity: "1",
      costBasisMinor: 10000,
      realizedGainMinor: 2000
    });
  });

  it("keeps closed positions in lifetime performance totals", () => {
    const { positions } = calculateInvestmentPositions([
      {
        id: "buy",
        accountId: "broker",
        assetId: "vwce",
        type: "buy",
        date: new Date("2026-01-01"),
        quantity: "10",
        amountMinor: 100000
      },
      {
        id: "sell",
        accountId: "broker",
        assetId: "vwce",
        type: "sell",
        date: new Date("2026-02-01"),
        quantity: "10",
        amountMinor: 90000
      }
    ]);

    expect(positions[0]).toMatchObject({
      quantity: "0",
      costBasisMinor: 0,
      realizedGainMinor: -10000
    });
  });

  it("tracks fees, dividends, and interest separately from position quantity", () => {
    const { positions } = calculateInvestmentPositions([
      {
        id: "buy",
        accountId: "broker",
        assetId: "vwce",
        type: "buy",
        date: new Date("2026-01-01"),
        quantity: "10",
        amountMinor: 100000
      },
      {
        id: "dividend",
        accountId: "broker",
        assetId: "vwce",
        type: "dividend",
        date: new Date("2026-01-10"),
        quantity: null,
        amountMinor: 500
      },
      {
        id: "interest",
        accountId: "broker",
        assetId: "vwce",
        type: "interest",
        date: new Date("2026-01-11"),
        quantity: null,
        amountMinor: 300
      },
      {
        id: "fee",
        accountId: "broker",
        assetId: "vwce",
        type: "fee",
        date: new Date("2026-01-12"),
        quantity: null,
        amountMinor: 200
      }
    ]);

    expect(positions[0]).toMatchObject({
      quantity: "10",
      dividendMinor: 500,
      interestMinor: 300,
      feeMinor: 200,
      realizedGainMinor: -200
    });
  });

  it("rejects sells larger than the current position", () => {
    expect(() =>
      calculateInvestmentPositions([
        {
          id: "sell",
          accountId: "broker",
          assetId: "vwce",
          type: "sell",
          date: new Date("2026-01-01"),
          quantity: "1",
          amountMinor: 10000
        }
      ])
    ).toThrow("Sell quantity cannot exceed current position quantity.");
  });

  it("summarizes investment performance from valued positions", () => {
    const performance = summarizeInvestmentPerformance([
      {
        accountId: "broker",
        accountName: "Brokerage",
        assetId: "vwce",
        assetSymbol: "VWCE",
        assetName: "All World",
        assetType: "etf",
        quantity: "10",
        costBasisMinor: 100000,
        averageCostMinor: 10000,
        realizedGainMinor: 5000,
        dividendMinor: 700,
        interestMinor: 100,
        feeMinor: 200,
        marketValueMinor: 125000
      },
      {
        accountId: "broker",
        accountName: "Brokerage",
        assetId: "unpriced",
        assetSymbol: "NOPRICE",
        assetName: "No Price",
        assetType: "stock",
        quantity: "1",
        costBasisMinor: 5000,
        averageCostMinor: 5000,
        realizedGainMinor: 0,
        dividendMinor: 0,
        interestMinor: 0,
        feeMinor: 0,
        marketValueMinor: null
      }
    ]);

    expect(performance).toMatchObject({
      positionCount: 2,
      totalInvestmentValueMinor: 125000,
      totalCostBasisMinor: 105000,
      totalUnrealizedGainMinor: 20000,
      realizedGainMinor: 5000,
      investmentIncomeMinor: 800,
      investmentFeesMinor: 200
    });
  });

  it("allocates investment positions by type, account, and asset", () => {
    const positions = [
      {
        accountId: "broker",
        accountName: "Brokerage",
        assetId: "vwce",
        assetSymbol: "VWCE",
        assetName: "All World",
        assetType: "etf",
        quantity: "10",
        costBasisMinor: 100000,
        averageCostMinor: 10000,
        realizedGainMinor: 0,
        dividendMinor: 0,
        interestMinor: 0,
        feeMinor: 0,
        marketValueMinor: 120000
      },
      {
        accountId: "wallet",
        accountName: "Crypto Wallet",
        assetId: "btc",
        assetSymbol: "BTC",
        assetName: "Bitcoin",
        assetType: "crypto",
        quantity: "0.1",
        costBasisMinor: 400000,
        averageCostMinor: 4000000,
        realizedGainMinor: 0,
        dividendMinor: 0,
        interestMinor: 0,
        feeMinor: 0,
        marketValueMinor: 480000
      }
    ];

    expect(allocateInvestmentPositions(positions, (position) => ({ key: position.assetType, name: position.assetType }))).toEqual([
      { key: "crypto", name: "crypto", valueMinor: 480000, costBasisMinor: 400000, percent: 0.8 },
      { key: "etf", name: "etf", valueMinor: 120000, costBasisMinor: 100000, percent: 0.2 }
    ]);
    expect(allocateInvestmentPositions(positions, (position) => ({ key: position.accountId, name: position.accountName }))[0]).toMatchObject({
      key: "wallet",
      name: "Crypto Wallet",
      valueMinor: 480000
    });
    expect(allocateInvestmentPositions(positions, (position) => ({ key: position.assetId, name: position.assetSymbol }))[1]).toMatchObject({
      key: "vwce",
      name: "VWCE",
      valueMinor: 120000
    });
  });
});
