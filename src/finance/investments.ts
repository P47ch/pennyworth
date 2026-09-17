const quantityScale = 100_000_000n;

export type InvestmentTransactionInput = {
  id: string;
  accountId: string;
  assetId: string;
  type: "buy" | "sell" | "dividend" | "interest" | "fee";
  date: Date;
  createdAt?: Date;
  quantity: string | { toString(): string } | null;
  amountMinor: number;
};

export type InvestmentPosition = {
  accountId: string;
  assetId: string;
  quantity: string;
  costBasisMinor: number;
  averageCostMinor: number;
  realizedGainMinor: number;
  dividendMinor: number;
  interestMinor: number;
  feeMinor: number;
};

export type ExactInvestmentPosition = Omit<InvestmentPosition, "costBasisMinor" | "averageCostMinor" | "realizedGainMinor" | "dividendMinor" | "interestMinor" | "feeMinor"> & {
  costBasisMinor: bigint;
  averageCostMinor: bigint;
  realizedGainMinor: bigint;
  dividendMinor: bigint;
  interestMinor: bigint;
  feeMinor: bigint;
};

export type InvestmentTransactionResult = InvestmentTransactionInput & {
  realizedGainMinor: number | null;
};

export type ExactInvestmentTransactionResult = InvestmentTransactionInput & {
  realizedGainMinor: bigint | null;
};

export type InvestmentValuedPosition = InvestmentPosition & {
  accountName: string;
  assetSymbol: string;
  assetName: string;
  assetType: string;
  marketValueMinor: number | null;
};

export type InvestmentPerformance = ReturnType<typeof summarizeInvestmentPerformance>;

export type InvestmentAllocationRow = {
  key: string;
  name: string;
  valueMinor: number;
  costBasisMinor: number;
  percent: number;
};

export function safeMoneyBigIntToNumber(value: bigint, label: string): number {
  const result = Number(value);

  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the safe integer range.`);
  }

  return result;
}

export function calculatePositionAmountMinorExact(
  quantityInput: string | { toString(): string },
  unitAmountMinor: number
): bigint {
  if (!Number.isSafeInteger(unitAmountMinor)) {
    throw new Error("Unit amount must be a safe integer minor-unit value.");
  }

  const quantity = quantityInput.toString();

  if (!/^\d+(\.\d{1,8})?$/.test(quantity)) {
    throw new Error("Quantity must have up to 8 decimal places.");
  }

  const [whole, fraction = ""] = quantity.split(".");
  const quantityScaled = BigInt(whole) * quantityScale + BigInt(fraction.padEnd(8, "0"));

  return (quantityScaled * BigInt(unitAmountMinor) + quantityScale / 2n) / quantityScale;
}

export function calculatePositionAmountMinor(quantityInput: string | { toString(): string }, unitAmountMinor: number): number {
  return safeMoneyBigIntToNumber(
    calculatePositionAmountMinorExact(quantityInput, unitAmountMinor),
    "Calculated investment value"
  );
}

export function calculateInvestmentPositionsExact(transactions: InvestmentTransactionInput[]) {
  const positionStates = new Map<string, { quantityScaled: bigint; costBasisMinor: bigint }>();
  const realizedTotals = new Map<string, bigint>();
  const dividendTotals = new Map<string, bigint>();
  const interestTotals = new Map<string, bigint>();
  const feeTotals = new Map<string, bigint>();
  const transactionResults: ExactInvestmentTransactionResult[] = [];

  for (const transaction of [...transactions].sort(compareInvestmentTransactions)) {
    const key = positionKey(transaction.accountId, transaction.assetId);
    const state = positionStates.get(key) ?? { quantityScaled: 0n, costBasisMinor: 0n };
    const amountMinor = toMoneyBigInt(transaction.amountMinor, `${transaction.id} amount`);
    let realizedGainMinor: bigint | null = null;

    if (transaction.type === "buy") {
      const quantityScaled = parseQuantityScaled(requiredQuantity(transaction));

      state.quantityScaled += quantityScaled;
      state.costBasisMinor += amountMinor;
      positionStates.set(key, state);
    } else if (transaction.type === "sell") {
      const quantityScaled = parseQuantityScaled(requiredQuantity(transaction));

      if (quantityScaled > state.quantityScaled) {
        throw new Error("Sell quantity cannot exceed current position quantity.");
      }

      const soldCostBasisMinor = prorateAmountMinor(state.costBasisMinor, quantityScaled, state.quantityScaled);
      realizedGainMinor = amountMinor - soldCostBasisMinor;
      state.quantityScaled -= quantityScaled;
      state.costBasisMinor -= soldCostBasisMinor;

      if (state.quantityScaled === 0n) {
        state.costBasisMinor = 0n;
      }

      positionStates.set(key, state);
      addToMap(realizedTotals, key, realizedGainMinor);
    } else if (transaction.type === "dividend") {
      addToMap(dividendTotals, key, amountMinor);
    } else if (transaction.type === "interest") {
      addToMap(interestTotals, key, amountMinor);
    } else if (transaction.type === "fee") {
      realizedGainMinor = -amountMinor;
      addToMap(feeTotals, key, amountMinor);
      addToMap(realizedTotals, key, realizedGainMinor);
    }

    transactionResults.push({ ...transaction, realizedGainMinor });
  }

  const allKeys = new Set([
    ...positionStates.keys(),
    ...realizedTotals.keys(),
    ...dividendTotals.keys(),
    ...interestTotals.keys(),
    ...feeTotals.keys()
  ]);
  const positions: ExactInvestmentPosition[] = Array.from(allKeys).map((key) => {
    const positionState = positionStates.get(key) ?? { quantityScaled: 0n, costBasisMinor: 0n };
    const [accountId, assetId] = splitPositionKey(key);

    return {
      accountId,
      assetId,
      quantity: formatQuantityScaled(positionState.quantityScaled),
      costBasisMinor: positionState.costBasisMinor,
      averageCostMinor:
        positionState.quantityScaled === 0n
          ? 0n
          : divideAmountByQuantity(positionState.costBasisMinor, positionState.quantityScaled),
      realizedGainMinor: realizedTotals.get(key) ?? 0n,
      dividendMinor: dividendTotals.get(key) ?? 0n,
      interestMinor: interestTotals.get(key) ?? 0n,
      feeMinor: feeTotals.get(key) ?? 0n
    };
  });

  return { positions, transactionResults };
}

export function calculateInvestmentPositions(transactions: InvestmentTransactionInput[]) {
  const exact = calculateInvestmentPositionsExact(transactions);

  return {
    positions: exact.positions.map((position) => toNumberPosition(position)),
    transactionResults: exact.transactionResults.map((result) => ({
      ...result,
      realizedGainMinor:
        result.realizedGainMinor === null
          ? null
          : safeMoneyBigIntToNumber(result.realizedGainMinor, `${result.id} realized gain`)
    }))
  };
}

function toNumberPosition(position: ExactInvestmentPosition): InvestmentPosition {
  return {
    ...position,
    costBasisMinor: safeMoneyBigIntToNumber(position.costBasisMinor, `${position.accountId}/${position.assetId} cost basis`),
    averageCostMinor: safeMoneyBigIntToNumber(position.averageCostMinor, `${position.accountId}/${position.assetId} average cost`),
    realizedGainMinor: safeMoneyBigIntToNumber(position.realizedGainMinor, `${position.accountId}/${position.assetId} realized gain`),
    dividendMinor: safeMoneyBigIntToNumber(position.dividendMinor, `${position.accountId}/${position.assetId} dividends`),
    interestMinor: safeMoneyBigIntToNumber(position.interestMinor, `${position.accountId}/${position.assetId} interest`),
    feeMinor: safeMoneyBigIntToNumber(position.feeMinor, `${position.accountId}/${position.assetId} fees`)
  };
}

export function summarizeInvestmentPerformance(positions: InvestmentValuedPosition[]) {
  const totalInvestmentValueMinor = positions.reduce(
    (total, position) => total + toMoneyBigInt(position.marketValueMinor ?? 0, "Investment value"),
    0n
  );
  const totalCostBasisMinor = positions.reduce(
    (total, position) => total + toMoneyBigInt(position.costBasisMinor, "Investment cost basis"),
    0n
  );
  const realizedGainMinor = positions.reduce(
    (total, position) => total + toMoneyBigInt(position.realizedGainMinor, "Realized gain"),
    0n
  );
  const investmentIncomeMinor = positions.reduce(
    (total, position) =>
      total + toMoneyBigInt(position.dividendMinor, "Investment dividend") + toMoneyBigInt(position.interestMinor, "Investment interest"),
    0n
  );
  const investmentFeesMinor = positions.reduce(
    (total, position) => total + toMoneyBigInt(position.feeMinor, "Investment fee"),
    0n
  );

  return {
    positionCount: positions.length,
    totalInvestmentValueMinor: safeMoneyBigIntToNumber(totalInvestmentValueMinor, "Total investment value"),
    totalCostBasisMinor: safeMoneyBigIntToNumber(totalCostBasisMinor, "Total investment cost basis"),
    totalUnrealizedGainMinor: safeMoneyBigIntToNumber(
      totalInvestmentValueMinor - totalCostBasisMinor,
      "Total unrealized gain"
    ),
    realizedGainMinor: safeMoneyBigIntToNumber(realizedGainMinor, "Total realized gain"),
    investmentIncomeMinor: safeMoneyBigIntToNumber(investmentIncomeMinor, "Total investment income"),
    investmentFeesMinor: safeMoneyBigIntToNumber(investmentFeesMinor, "Total investment fees")
  };
}

export function allocateInvestmentPositions(
  positions: InvestmentValuedPosition[],
  groupBy: (position: InvestmentValuedPosition) => { key: string; name: string }
): InvestmentAllocationRow[] {
  const totals = new Map<string, { name: string; valueMinor: bigint; costBasisMinor: bigint }>();

  for (const position of positions) {
    const group = groupBy(position);
    const current = totals.get(group.key) ?? { name: group.name, valueMinor: 0n, costBasisMinor: 0n };

    current.valueMinor += toMoneyBigInt(position.marketValueMinor ?? 0, `${group.name} value`);
    current.costBasisMinor += toMoneyBigInt(position.costBasisMinor, `${group.name} cost basis`);
    totals.set(group.key, current);
  }

  const totalValueMinor = Array.from(totals.values()).reduce((total, row) => total + row.valueMinor, 0n);
  safeMoneyBigIntToNumber(totalValueMinor, "Total investment allocation value");

  return Array.from(totals.entries())
    .map(([key, row]) => {
      const valueMinor = safeMoneyBigIntToNumber(row.valueMinor, `${row.name} value`);

      return {
        key,
        name: row.name,
        valueMinor,
        costBasisMinor: safeMoneyBigIntToNumber(row.costBasisMinor, `${row.name} cost basis`),
        percent: totalValueMinor === 0n ? 0 : Number(row.valueMinor) / Number(totalValueMinor)
      };
    })
    .sort((a, b) => b.valueMinor - a.valueMinor || a.name.localeCompare(b.name));
}

function compareInvestmentTransactions(a: InvestmentTransactionInput, b: InvestmentTransactionInput) {
  return (
    a.date.getTime() - b.date.getTime() ||
    (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) ||
    a.id.localeCompare(b.id)
  );
}

function requiredQuantity(transaction: InvestmentTransactionInput) {
  if (!transaction.quantity) {
    throw new Error(`${transaction.type} transaction requires a quantity.`);
  }

  return transaction.quantity;
}

function parseQuantityScaled(quantityInput: string | { toString(): string }) {
  const quantity = quantityInput.toString();

  if (!/^\d+(\.\d{1,8})?$/.test(quantity)) {
    throw new Error("Quantity must have up to 8 decimal places.");
  }

  const [whole, fraction = ""] = quantity.split(".");
  return BigInt(whole) * quantityScale + BigInt(fraction.padEnd(8, "0"));
}

function formatQuantityScaled(quantityScaled: bigint) {
  const whole = quantityScaled / quantityScale;
  const fraction = (quantityScaled % quantityScale).toString().padStart(8, "0").replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function prorateAmountMinor(amountMinor: bigint, partQuantityScaled: bigint, totalQuantityScaled: bigint) {
  return (amountMinor * partQuantityScaled + totalQuantityScaled / 2n) / totalQuantityScaled;
}

function divideAmountByQuantity(amountMinor: bigint, quantityScaled: bigint) {
  return (amountMinor * quantityScale + quantityScaled / 2n) / quantityScaled;
}

function toMoneyBigInt(value: number | bigint, label: string) {
  if (typeof value === "bigint") {
    return value;
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds the safe integer range.`);
  }

  return BigInt(value);
}

function positionKey(accountId: string, assetId: string) {
  return `${accountId}\u0000${assetId}`;
}

function splitPositionKey(key: string) {
  const [accountId, assetId] = key.split("\u0000");
  return [accountId, assetId] as const;
}

function addToMap(map: Map<string, bigint>, key: string, amountMinor: bigint) {
  map.set(key, (map.get(key) ?? 0n) + amountMinor);
}
