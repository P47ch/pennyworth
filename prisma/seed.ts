import { PrismaClient } from "@prisma/client";
import { ensureInitialAdmin } from "../src/services/initialAdmin.js";
import { createUserDefaults } from "../src/services/userDefaults.js";

const prisma = new PrismaClient();
async function main() {
  const user = await ensureInitialAdmin(process.env, prisma);

  await prisma.account.createMany({
    data: [
      {
        userId: user.id,
        name: "Main Bank",
        type: "bank",
        currency: "EUR",
        openingBalanceMinor: 125000,
        institution: "Example Bank"
      },
      {
        userId: user.id,
        name: "Cash Wallet",
        type: "cash",
        currency: "EUR",
        openingBalanceMinor: 8000
      },
      {
        userId: user.id,
        name: "Savings",
        type: "savings",
        currency: "EUR",
        openingBalanceMinor: 500000,
        institution: "Example Bank"
      },
      {
        userId: user.id,
        name: "Brokerage",
        type: "investment",
        currency: "EUR",
        openingBalanceMinor: 0,
        institution: "Example Broker"
      },
      {
        userId: user.id,
        name: "Crypto Wallet",
        type: "crypto_wallet",
        currency: "EUR",
        openingBalanceMinor: 0
      }
    ],
    skipDuplicates: true
  });

  await createUserDefaults(user.id, prisma);

  const categories = await prisma.category.findMany({
    where: { userId: user.id, name: { in: ["Food", "Rent", "Subscriptions"] } },
    select: { id: true, name: true }
  });
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
  const seedRules = [
    { name: "Grocery stores", matchText: "grocery", categoryName: "Food", priority: 10 },
    { name: "Rent payment", matchText: "rent", categoryName: "Rent", priority: 20 },
    { name: "Subscription services", matchText: "spotify", categoryName: "Subscriptions", priority: 30 }
  ];

  for (const rule of seedRules) {
    const categoryId = categoryIdByName.get(rule.categoryName);

    if (!categoryId) {
      continue;
    }

    await prisma.rule.upsert({
      where: { userId_name: { userId: user.id, name: rule.name } },
      update: {},
      create: {
        userId: user.id,
        name: rule.name,
        matchText: rule.matchText,
        categoryId,
        priority: rule.priority,
        isActive: true
      }
    });
  }

  await prisma.asset.createMany({
    data: [
      { userId: user.id, symbol: "VWCE", name: "Vanguard FTSE All-World UCITS ETF", type: "etf", currency: "EUR" },
      { userId: user.id, symbol: "AAPL", name: "Apple Inc.", type: "stock", currency: "EUR" },
      { userId: user.id, symbol: "BTC", name: "Bitcoin", type: "crypto", currency: "EUR" }
    ],
    skipDuplicates: true
  });

  const [accounts, assets] = await Promise.all([
    prisma.account.findMany({
      where: { userId: user.id, name: { in: ["Brokerage", "Crypto Wallet"] } },
      select: { id: true, name: true }
    }),
    prisma.asset.findMany({
      where: { userId: user.id, symbol: { in: ["VWCE", "BTC"] } },
      select: { id: true, symbol: true }
    })
  ]);
  const accountIdByName = new Map(accounts.map((account) => [account.name, account.id]));
  const assetIdBySymbol = new Map(assets.map((asset) => [asset.symbol, asset.id]));
  const brokerageId = accountIdByName.get("Brokerage");
  const cryptoWalletId = accountIdByName.get("Crypto Wallet");
  const vwceId = assetIdBySymbol.get("VWCE");
  const btcId = assetIdBySymbol.get("BTC");

  const assetPrices = [
    vwceId
      ? {
          userId: user.id,
          assetId: vwceId,
          date: new Date("2026-07-10T00:00:00.000Z"),
          priceMinor: 11640
        }
      : null,
    btcId
      ? {
          userId: user.id,
          assetId: btcId,
          date: new Date("2026-07-10T00:00:00.000Z"),
          priceMinor: 6200000
        }
      : null
  ].filter((assetPrice): assetPrice is Exclude<typeof assetPrice, null> => assetPrice !== null);

  if (assetPrices.length > 0) {
    await prisma.assetPrice.createMany({
      data: assetPrices,
      skipDuplicates: true
    });
  }

  const holdings = [
    brokerageId && vwceId
      ? {
          userId: user.id,
          accountId: brokerageId,
          assetId: vwceId,
          quantity: "12.50000000",
          averageCostMinor: 10250,
          notes: "Sample ETF position"
        }
      : null,
    cryptoWalletId && btcId
      ? {
          userId: user.id,
          accountId: cryptoWalletId,
          assetId: btcId,
          quantity: "0.07500000",
          averageCostMinor: 4200000,
          notes: "Sample crypto position"
        }
      : null
  ].filter((holding): holding is Exclude<typeof holding, null> => holding !== null);

  if (holdings.length > 0) {
    await prisma.holding.createMany({
      data: holdings,
      skipDuplicates: true
    });
  }

  const investmentTransactions = [
    brokerageId && vwceId
      ? {
          userId: user.id,
          accountId: brokerageId,
          cashAccountId: brokerageId,
          assetId: vwceId,
          type: "buy" as const,
          date: new Date("2026-06-15T00:00:00.000Z"),
          quantity: "12.50000000",
          priceMinor: 10250,
          amountMinor: 128125,
          cashAmountMinor: 128125,
          notes: "Sample ETF purchase"
        }
      : null,
    brokerageId && vwceId
      ? {
          userId: user.id,
          accountId: brokerageId,
          cashAccountId: brokerageId,
          assetId: vwceId,
          type: "dividend" as const,
          date: new Date("2026-07-01T00:00:00.000Z"),
          quantity: null,
          priceMinor: null,
          amountMinor: 1850,
          cashAmountMinor: 1850,
          notes: "Sample dividend"
        }
      : null,
    cryptoWalletId && btcId
      ? {
          userId: user.id,
          accountId: cryptoWalletId,
          cashAccountId: cryptoWalletId,
          assetId: btcId,
          type: "buy" as const,
          date: new Date("2026-06-20T00:00:00.000Z"),
          quantity: "0.07500000",
          priceMinor: 4200000,
          amountMinor: 315000,
          cashAmountMinor: 315000,
          notes: "Sample crypto purchase"
        }
      : null
  ].filter((transaction): transaction is Exclude<typeof transaction, null> => transaction !== null);

  for (const transaction of investmentTransactions) {
    await prisma.investmentTransaction.upsert({
      where: { id: `${transaction.accountId}-${transaction.assetId}-${transaction.type}-${transaction.date.toISOString()}` },
      update: {},
      create: {
        id: `${transaction.accountId}-${transaction.assetId}-${transaction.type}-${transaction.date.toISOString()}`,
        ...transaction
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
