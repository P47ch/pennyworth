---
title: Data and Financial Model
type: architecture
status: current
updated: 2026-09-15
source_ids: [project-contract, database-schema, migrations, finance-source, query-source]
tags: [data-model, accounting, money, investments]
---

# Data and Financial Model

Pennyworth stores financial state as explicit ledgers and derives balances and reports from those ledgers. Money uses integer minor units; asset quantities use decimal values.

## Ownership model

Every user-owned record carries `userId`. An administrator can provision family members, and every user receives a completely independent ledger. Financial records are not shared, so `userId` remains the ownership boundary rather than introducing a household or workspace entity. Composite `(id, userId)` keys support same-user relations in PostgreSQL, and service mutations include both fields in their selectors even when the primary-key index is sufficient for lookup.

The `User` record also stores interface preferences, including language, light/dark appearance, hidden navigation entries, and an `avatarKey`. Avatar keys refer only to application-provided presentations: initials or one of five bundled Terminal Clerk portraits. Unknown values fall back to initials at the rendering boundary, so neither arbitrary paths nor remote images are accepted.

The current Prisma model contains:

- Identity and preferences: `User`, including `admin` or `member` role, active status, forced-password-change state, session version, and interface preferences.
- Cash accounting: `Account`, `Transaction`, `Category`, `Tag`, `TransactionTag`.
- Automation: `Budget`, `Rule`, `RuleTag`, `RecurringTransaction`.
- Investments: `Asset`, `AssetPrice`, `InvestmentTransaction`, `InvestmentTransactionResult`, `InvestmentPosition`, `Holding`.
- Import coordination: `TransactionImportBatch`, a user-scoped idempotency receipt for confirmed CSV imports.

## Accounts and normal transactions

Account types are `bank`, `cash`, `credit_card`, `savings`, `investment`, `crypto_wallet`, and `other`. An account has one currency, an integer opening balance, optional institution, and active state.

Normal transaction types are `income`, `expense`, and `transfer`:

- Income adds one positive amount to its source account and contributes to income reports.
- Expense subtracts one positive amount from its source account and contributes to expense reports.
- Transfer subtracts one amount from the source and adds it to a different destination account. It never contributes to income or expense reporting.

Current balances are opening balance plus normal-transaction effects plus investment cash effects. They are not stored as a mutable cached account field.

## Categories, tags, and automation

A transaction has at most one category and many tags. Category types are `income`, `expense`, and `both`. Categories may be nested, but service validation and backup validation reject cycles; the category parent relation also includes `userId` so a parent cannot belong to another user.

Budgets are unique per user/category/month. Rules point to a user-owned category, may add user-owned tags, and use integer priority plus active state. Recurring templates currently support only `monthly` frequency and reuse normal transaction shapes.

## Money and numeric boundaries

- Monetary values use integers in minor units. Floating-point values are never authoritative money.
- Decimal text is parsed centrally and formatted from minor units.
- Stored monetary values are limited to PostgreSQL's signed 32-bit integer range and rejected before persistence when outside it.
- PostgreSQL aggregate sums are returned as `bigint`; adapters reject results outside JavaScript's safe integer range.
- Asset quantities allow up to eight decimal places and use Prisma `Decimal` at persistence boundaries and scaled integer arithmetic in pure calculations.
- Asset and activity prices remain integer minor-unit values.

The current product is single-currency. Account and asset writes and JSON restore require `PRIMARY_CURRENCY`; aggregate reports defensively reject pre-existing mixed-currency records instead of adding unlike minor units. Exchange-rate conversion remains deferred.

Application-facing money formatting binds its default currency to `PRIMARY_CURRENCY`. The display locale is an independent fixed `en-US` policy today; it is never inferred from the currency code or browser locale. Account- and asset-specific values pass their explicit stored currency.

## Dates and reporting

Accounting dates are stored at UTC midnight and compared using UTC calendar operations. Month reports use inclusive start and exclusive end. `APP_TIME_ZONE` determines which date/month is “current” for the user but does not change stored accounting dates.

Transaction indexes begin with `userId` and then date, type, account, or category fields used by filters and reports. Monthly cashflow, category spending, and per-account historical balances execute in PostgreSQL, while pure functions fill missing months, derive savings rates, rank category series, replay investment positions, and combine account and investment series into net worth.

Statistics contains 12 month-end points for every active account. Each series starts with the account's opening balance and applies income, expense, both sides of transfers, and investment cash effects dated before each following month boundary. The total cash series used by net worth is derived from these same per-account points. Because accounts do not have a separate opening-balance effective date, their opening balances apply throughout the displayed window. Transfers between two included accounts cancel at the total-net-worth level.

Category history groups expenses by accounting month and category. The graph selects the five categories with the largest totals across the complete 12-month report, fills absent category/month combinations with zero, and combines every remaining category into `Other`. Transfers and investment activity do not enter this expense report.

The investment component replays investment activity through each month-end and values the resulting quantities with the latest manual asset price recorded on or before that boundary. Manual `Holding` adjustments have no effective date, so they are treated as opening positions throughout the window. A position without an available price contributes zero until its first price is recorded.

## Investment ledger

Asset types are `stock`, `etf`, `fund`, `bond`, `crypto`, and `other`. Current investment activity types are `buy`, `sell`, `dividend`, `interest`, and `fee`.

Investment activity is authoritative:

- Buy and fee cash effects subtract from the selected cash account.
- Sell, dividend, and interest cash effects add to it.
- “Same as account” is stored as the investment account for new activity; legacy null values are interpreted the same way.
- Buy and sell quantities build positions using average cost.
- Sells produce realized gain; latest manual prices produce market value and unrealized gain.

`InvestmentPosition` and `InvestmentTransactionResult` are rebuildable projections. `Holding` is a separate manual adjustment, not a replacement for transaction-derived positions. Projection rows are excluded from JSON backups and rebuilt from authoritative activity.

Same-day investment events are ordered by accounting date, creation time, then ID so a sell cannot accidentally precede an earlier buy merely because of identifier order.

## Deferred model areas

Multi-currency conversion, crypto-specific activity types, attachments, audit logs, background recurrence, and external market feeds remain outside the current model or behavior. See [`../product/status-and-roadmap.md`](../product/status-and-roadmap.md).

## Related pages

- [`system-overview.md`](system-overview.md)
- [`../features/transactions.md`](../features/transactions.md)
- [`../features/automation.md`](../features/automation.md)
- [`../features/investments.md`](../features/investments.md)

## Sources

- [`project-contract`](../sources.md#sourceproject-contract)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`migrations`](../sources.md#sourcemigrations)
- [`finance-source`](../sources.md#sourcefinance-source)
- [`query-source`](../sources.md#sourcequery-source)
