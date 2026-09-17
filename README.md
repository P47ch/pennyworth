# Pennyworth

Pennyworth is a private, self-hosted personal-finance accounting application. It tracks everyday money, account balances, budgets, and manually managed investments through a responsive web interface designed for desktop and mobile browsers.

The application runs on infrastructure you control, stores its data in PostgreSQL, and does not connect to banks, brokers, exchanges, analytics services, or market-data providers. One installation can have an administrator and trusted family members, but every user has a separate financial ledger. There are no shared accounts or household-wide reports.

> **Development status:** The current version is **v0.8.0-alpha.1**. Pennyworth is under active development and has not reached a stable v1.0 release. Features, behavior, and data structures may still change, so keep tested backups and review the [changelog](CHANGELOG.md) before updating. Work toward a reliable v1.0 is progressing as quickly as possible without compromising financial correctness or data safety.

## What Pennyworth does

### Accounts and transactions

- Tracks bank, cash, credit-card, savings, investment, crypto-wallet, and other accounts.
- Calculates balances from opening balances and ledger activity instead of relying on an editable cached balance.
- Supports income, expense, and transfer transactions with accounting dates, descriptions, notes, categories, and tags.
- Treats transfers as movement between owned accounts, excluding them from income and expense totals.
- Provides transaction editing, deletion, pagination, and filters for date, type, account, category, tag, and text.
- Imports normal transactions from CSV through column mapping, validation, duplicate detection, and a confirmation preview.
- Exports the currently filtered normal transactions to CSV.

### Organization and automation

- Supports nested income, expense, or mixed categories with custom colors and icons.
- Supports reusable colored tags with many-to-many transaction assignment.
- Tracks monthly category budgets and highlights approaching or exceeded limits.
- Applies user-defined text-matching rules to uncategorized expenses during CSV preview or through an explicit existing-ledger preview.
- Stores monthly recurring income, expense, and transfer templates. Recurring entries are generated only when the user requests them; there is no background scheduler.

### Dashboard and reports

- Summarizes total balance, current-month income, expenses, net cashflow, net worth, and investment value.
- Reports spending by category and tag, current account balances, savings rate, and largest expenses.
- Shows 12-month cashflow, account-balance, category-spending, and net-worth history.
- Breaks investment allocation down by asset type, account, and asset.

### Data ownership and recovery

- Provides versioned, user-scoped JSON backup and destructive restore with validation and a confirmation preview.
- Includes a published [JSON Schema and starter backup](wiki/operations/json-backup-format.md) for converting data from spreadsheets or other systems.
- Supports full-installation recovery through normal PostgreSQL dumps.
- Keeps credentials, roles, and interface preferences outside user-scoped JSON restore; a database dump is required to preserve the complete installation state.

### Interface and access

- Uses server-rendered pages with a mobile-friendly layout, light and dark appearances, and English or Italian localization.
- Provides local password authentication, CSRF protection, signed sessions, and administrator-provisioned users without public registration.
- Keeps each user's accounts, transactions, automation, and investments isolated at both application and database levels.
- Includes customizable navigation, category iconography, and local built-in avatars without remote image dependencies.

## Investment tracking

Pennyworth's investment section is a manual portfolio ledger. It is intended to record positions and their cash impact without requiring an external financial service. This section is still evolving and will be improved over time; the capabilities and limitations below describe its current pre-v1.0 behavior.

It currently supports:

- stocks, ETFs, funds, bonds, crypto, and generic assets;
- manually entered dated prices;
- buy, sell, dividend, interest, and fee activity;
- separate investment and cash-impact accounts;
- positions calculated from activity using average cost;
- quantity precision of up to eight decimal places;
- realized gain on sales, unrealized gain, cost basis, dividends, interest, and fees;
- optional manual holding adjustments for positions not fully represented by activity;
- current valuation and a 12-month month-end contribution to net worth;
- JSON backup and restore of assets, prices, holdings, and investment activity.

### Investment limitations

These boundaries are important when interpreting investment totals:

- **Prices are entirely manual.** There are no live quotes, automatic price updates, ticker lookup, or broker/exchange synchronization.
- **The investment ledger is single-currency.** Accounts and assets must use the configured `PRIMARY_CURRENCY`. There is no exchange-rate conversion, and aggregate reports reject pre-existing mixed-currency records rather than combining unlike values.
- **Cost basis uses average cost only.** Pennyworth does not model individual tax lots, FIFO, LIFO, specific-lot selection, wash sales, or jurisdiction-specific capital-gains tax rules.
- **Sales cannot create a negative position.** Short selling, margin, leverage, options, derivatives, and other advanced brokerage behavior are not modeled.
- **Corporate actions are not first-class events.** Splits, mergers, spin-offs, rights issues, and similar changes require manual adjustments or reconstructed activity.
- **Crypto uses the generic asset model.** Wallet-to-wallet asset transfers, staking rewards, mining rewards, on-chain fees, and blockchain/exchange synchronization are not implemented as dedicated flows.
- **Historical reporting is valuation history, not return analysis.** The 12-month graph replays activity and uses the latest manual price available at each month-end. It does not calculate time-weighted return, money-weighted return, IRR, benchmark comparison, volatility, or risk metrics.
- **Missing prices count as zero value.** A position contributes nothing to historical or current valuation until a manual price exists for the relevant date.
- **Manual holdings are undated additive adjustments.** They are treated as opening positions throughout the displayed history and should not be used to represent dated trades.
- **Investment cashflow is separate from normal cashflow reporting.** Buys, sells, dividends, interest, and fees affect account balances, but they do not appear as ordinary income or expenses in monthly cashflow reports.
- **Normal transaction CSV tools do not cover investments.** Investment records are portable through the JSON backup format, not the normal transaction CSV importer/exporter.

Pennyworth therefore provides useful manual position and valuation accounting, but it should not be treated as a broker statement, tax calculator, live trading system, or professional portfolio-performance platform.

## Deployment boundary

The supplied Docker and Podman configurations are intended for a private, trusted home LAN. The current direct HTTP deployment does not encrypt browser traffic and must not be exposed to the public internet. Pennyworth is not designed or hardened as a public SaaS service.

See the documentation for installation and operation:

- [Local development](wiki/operations/local-development.md)
- [Docker deployment](wiki/operations/deployment.md)
- [Podman deployment](wiki/operations/podman.md)
- [Backup and restore](wiki/operations/backup-and-restore.md)
- [Complete documentation index](wiki/index.md)

## License

Pennyworth is open-source software released under the [MIT License](LICENSE). Copyright © 2026 Patrick Giacoletto.

## Technology

Pennyworth uses TypeScript, Fastify, server-rendered EJS templates, PostgreSQL, Prisma, plain CSS, and minimal browser JavaScript. Tests use Vitest and Playwright-based accessibility checks.
