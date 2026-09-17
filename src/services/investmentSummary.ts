import { prisma } from "../lib/db.js";
import { getLatestAssetPrices } from "../queries/latestAssetPrices.js";
import {
  allocateInvestmentPositions,
  calculatePositionAmountMinorExact,
  safeMoneyBigIntToNumber,
  summarizeInvestmentPerformance
} from "../finance/investments.js";
import { ensureInvestmentPositionProjection } from "./investmentPositions.js";
import { assertSingleCurrency } from "../finance/currency.js";
import { loadConfig } from "../lib/config.js";

export async function getInvestmentValueSummary(userId: string) {
  const report = await getInvestmentReport(userId);

  return report.performance;
}

export async function getInvestmentReport(userId: string) {
  await ensureInvestmentPositionProjection(userId);

  const [projectedPositions, manualHoldings] = await Promise.all([
    prisma.investmentPosition.findMany({
      where: { userId },
      include: { account: true, asset: true },
      orderBy: [{ account: { name: "asc" } }, { asset: { symbol: "asc" } }]
    }),
    prisma.holding.findMany({
      where: { userId },
      include: { account: true, asset: true },
      orderBy: [{ account: { name: "asc" } }, { asset: { symbol: "asc" } }]
    })
  ]);
  assertSingleCurrency(
    [...projectedPositions.map((position) => position.asset), ...manualHoldings.map((holding) => holding.asset)],
    loadConfig().primaryCurrency,
    "assets"
  );
  const assetIds = Array.from(
    new Set([...projectedPositions.map((position) => position.assetId), ...manualHoldings.map((holding) => holding.assetId)])
  );
  const latestPrices = await getLatestAssetPrices(userId, assetIds);

  const calculatedPositions = projectedPositions.map((position) => {
    const latestPrice = latestPrices.get(position.assetId);
    const quantity = position.quantity.toString();

    return {
      accountId: position.accountId,
      assetId: position.assetId,
      quantity,
      costBasisMinor: position.costBasisMinor,
      averageCostMinor: position.averageCostMinor,
      realizedGainMinor: position.realizedGainMinor,
      dividendMinor: position.dividendMinor,
      interestMinor: position.interestMinor,
      feeMinor: position.feeMinor,
      source: "calculated" as const,
      accountName: position.account.name,
      assetSymbol: position.asset.symbol,
      assetName: position.asset.name,
      assetType: position.asset.type,
      currency: position.asset.currency,
      latestPrice,
      marketValueMinor: latestPrice
        ? safeMoneyBigIntToNumber(
            calculatePositionAmountMinorExact(quantity, latestPrice.priceMinor),
            `${position.asset.symbol} market value`
          )
        : null
    };
  });
  const manualPositions = manualHoldings.map((holding) => {
    const latestPrice = latestPrices.get(holding.assetId);
    const quantity = holding.quantity.toString();
    const costBasisMinor = safeMoneyBigIntToNumber(
      calculatePositionAmountMinorExact(quantity, holding.averageCostMinor),
      `${holding.asset.symbol} cost basis`
    );

    return {
      accountId: holding.accountId,
      assetId: holding.assetId,
      quantity,
      costBasisMinor,
      averageCostMinor: holding.averageCostMinor,
      realizedGainMinor: 0,
      dividendMinor: 0,
      interestMinor: 0,
      feeMinor: 0,
      source: "manual" as const,
      accountName: holding.account.name,
      assetSymbol: holding.asset.symbol,
      assetName: holding.asset.name,
      assetType: holding.asset.type,
      currency: holding.asset.currency,
      latestPrice,
      marketValueMinor: latestPrice
        ? safeMoneyBigIntToNumber(
            calculatePositionAmountMinorExact(quantity, latestPrice.priceMinor),
            `${holding.asset.symbol} market value`
          )
        : null
    };
  });
  const valuedPositions = [...calculatedPositions, ...manualPositions];
  const performance = summarizeInvestmentPerformance(valuedPositions);

  return {
    performance,
    positions: valuedPositions,
    allocationByType: allocateInvestmentPositions(valuedPositions, (position) => ({
      key: position.assetType,
      name: position.assetType
    })),
    allocationByAccount: allocateInvestmentPositions(valuedPositions, (position) => ({
      key: position.accountId,
      name: position.accountName
    })),
    allocationByAsset: allocateInvestmentPositions(valuedPositions, (position) => ({
      key: position.assetId,
      name: `${position.assetSymbol} - ${position.assetName}`
    }))
  };
}
