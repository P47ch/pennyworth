---
title: Investments
type: feature
status: current
updated: 2026-09-02
source_ids: [project-contract, application-source, finance-source, query-source, database-schema, migrations, test-suite]
tags: [investments, assets, positions, valuation]
---

# Investments

Investments are a separate asset ledger associated with owned accounts. They affect cash balances and net worth but do not masquerade as normal income or expenses.

## Assets and prices

The asset catalog supports `stock`, `etf`, `fund`, `bond`, `crypto`, and `other`. Assets have a symbol, name, currency, type, and active state. Symbols are unique per user.

Prices are entered manually as positive minor-unit values on strict accounting dates. Reports select the latest price per asset in PostgreSQL. No external market API is required or called.

## Activity and cash impact

Supported activity is `buy`, `sell`, `dividend`, `interest`, and `fee`:

- Buys require quantity and price, increase position quantity/cost basis, and reduce cash.
- Sells require quantity and price, reduce the position, increase cash, and calculate realized gain.
- Dividends and interest increase cash and accumulate as investment income.
- Fees reduce cash and accumulate as negative realized performance.

Each activity selects an investment account and cash-impact account. “Same as account” normalizes to the investment account for new writes; older null values are interpreted identically. Cash effects participate in account balances and total net worth but are excluded from monthly normal income/expense summaries.

## Position calculation

Investment activity is the authoritative history. Average-cost calculations use scaled integer quantity arithmetic and integer money. Same-day events order by date, creation timestamp, and ID.

`InvestmentPosition` stores one rebuildable row per user/account/asset. `InvestmentTransactionResult` stores rebuildable per-entry results such as realized gain. Creating, editing, or deleting activity serializes projection updates per user and recalculates affected pairs. Existing or restored ledgers rebuild on an investment read when their projection version is stale.

Manual `Holding` rows are additive adjustments for positions not represented by activity; they do not replace the activity ledger.

## Reporting

The investment overview reports total value, cost basis, unrealized gain, realized gain, dividend/interest income, fees, and allocations by asset type, account, and asset. Holdings combine derived positions, manual adjustments, and latest manual prices. Activity browsing is paginated to 50 entries.

The statistics page also reports a 12-month net-worth history. For each month-end it replays investment activity, adds manual holdings as opening positions, and selects the latest manual price available by that date. The graph exposes total net worth, cash, and investment value as separate series. This is historical valuation, not an investment-return calculation.

## Integrity boundaries

Services validate owned accounts/assets and transaction shape. Composite database foreign keys prevent cross-user references. Check constraints enforce positive cash amounts and prices, required buy/sell fields, positive manual quantities, and non-negative derived position values.

Projection tables are deliberately omitted from JSON backup. Restore imports authoritative activity and rebuilds derived state.

## Deferred work

- Investment-return performance over time, longer history ranges, and benchmark comparison.
- Crypto-specific transfer and reward flows.
- Automatic price retrieval.
- Multi-currency valuation.

## Related pages

- [`../architecture/data-and-financial-model.md`](../architecture/data-and-financial-model.md)
- [`transactions.md`](transactions.md)
- [`../operations/backup-and-restore.md`](../operations/backup-and-restore.md)

## Sources

- [`project-contract`](../sources.md#sourceproject-contract)
- [`application-source`](../sources.md#sourceapplication-source)
- [`finance-source`](../sources.md#sourcefinance-source)
- [`query-source`](../sources.md#sourcequery-source)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`migrations`](../sources.md#sourcemigrations)
- [`test-suite`](../sources.md#sourcetest-suite)
