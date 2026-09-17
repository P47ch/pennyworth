# AGENTS.md

## Project

Build Pennyworth, a self-hosted personal finance accounting web app for one user initially, but keep the architecture clean enough to support more users later.

The app must be private, mobile-friendly, reliable, and easy to deploy on a personal server.

## Product goals

The app should allow the user to:

- Track income and expenses.
- Track multiple bank/cash/credit accounts.
- Track transfers between own accounts without counting them as income or expense.
- Track investments such as stocks, ETFs, funds, bonds, and similar assets.
- Track crypto/digital coins and wallets.
- Use categories and tags for reporting and filtering.
- View useful statistics and charts.
- Self-host the app using Docker or Podman.
- Use the app comfortably from a smartphone browser.

## Recommended stack

Prefer the simplest architecture that can stay reliable, fast, and easy to review.

Use this stack unless the repository already contains a different one:

- TypeScript
- Fastify
- Server-rendered HTML templates with EJS or Eta
- PostgreSQL
- Prisma ORM
- Plain CSS
- Minimal vanilla browser JavaScript only where it clearly improves usability
- Docker Compose or Podman Compose for local/self-hosted deployment
- Vitest for financial logic tests

Avoid unnecessary frontend frameworks, microservices, client-side state frameworks, build complexity, analytics, and external APIs. Do not use React, Next.js, Tailwind CSS, shadcn/ui, chart libraries, or PWA tooling for the MVP unless explicitly requested later.

The application should feel like a fast traditional web app: request, validate, run service/domain logic, render HTML.

Keep maintained project documentation inside `wiki/`. The directory is a Karpathy-style LLM Wiki: repository files are authoritative sources, focused Markdown pages are maintained synthesis, and `wiki/AGENTS.md` defines its ingest/query/lint contract. Read `wiki/index.md` before documentation work. Update affected canonical pages and append `wiki/log.md` whenever implementation decisions change architecture, setup commands, data model, security posture, or product scope, then run `npm run wiki:lint`. Documentation changes should be made alongside the relevant code change.

Docker or Podman may run on another machine in the local network. Keep setup compatible with running the Node app locally while connecting to PostgreSQL through a LAN `DATABASE_URL`.

Recommended source layout:

- `src/server.ts` for app startup.
- `src/routes/` for HTTP routes.
- `src/services/` for use-case orchestration and database access.
- `src/finance/` for pure financial calculations.
- `src/views/` for server-rendered templates.
- `src/public/` for CSS and small optional browser scripts.
- `prisma/` for schema, migrations, and seed data.

## Core domain rules

### Accounts

An account represents a place where money or assets are held.

Supported account types:

- `bank`
- `cash`
- `credit_card`
- `savings`
- `investment`
- `crypto_wallet`
- `other`

Each account should support:

- Name
- Type
- Currency
- Opening balance
- Current balance calculation
- Optional institution
- Active/inactive state

### Transactions

Use one transaction model for normal money movement.

Transaction types:

- `income`
- `expense`
- `transfer`

Rules:

- Income increases net cashflow.
- Expense decreases net cashflow.
- Transfer moves money between two owned accounts and must not affect income/expense reports.
- Store money in minor units, for example cents, using integers. Do not use floating point for money.
- Every transaction should have a date, amount, optional category, optional tags, and optional notes.
- Income and expense transactions should reference one account.
- Transfer transactions should reference both source and destination accounts.
- Store one amount for a transfer. Subtract it from the source account and add it to the destination account.
- Current account balances should be calculated from opening balance plus transactions. Add cached balances only if a clear performance need appears later.

### Categories and tags

Categories are structured reporting groups.

- A transaction has zero or one category.
- Categories may be nested with parent/child relationships.
- Categories should support custom name, type, color, and icon.
- Category type should be `income`, `expense`, or `both`.

Tags are flexible metadata.

- A transaction can have many tags.
- Tags should support custom name and color.

Examples:

- Categories: Food, Rent, Salary, Taxes, Transport, Health, Subscriptions.
- Tags: vacation, business, recurring, tax-deductible, shared, reimbursable.

### Investments

Track investment assets separately from normal spending transactions, but associate them with accounts.

Asset types:

- `stock`
- `etf`
- `fund`
- `bond`
- `crypto`
- `other`

Investment transaction types:

- `buy`
- `sell`
- `dividend`
- `interest`
- `fee`
- `deposit`
- `withdrawal`

The app should eventually calculate:

- Holdings
- Average cost
- Current value
- Realized gain/loss
- Unrealized gain/loss
- Allocation by asset type

Manual price entry is acceptable. Do not require external market APIs.

### Crypto

Crypto should be treated as an asset class with support for wallets.

Crypto-specific transaction types may include:

- buy
- sell
- transfer
- staking_reward
- mining_reward
- fee

Manual price entry is acceptable. Do not require external market APIs.

### Statistics

The dashboard should eventually include:

- Net worth over time
- Income vs expenses by month
- Spending by category
- Spending by tag
- Account balances
- Investment allocation
- Crypto allocation
- Savings rate
- Largest expenses
- Recurring expense overview
- Month-over-month comparison

Start with simple server-rendered summaries. Use simple HTML/CSS tables or bars before adding any chart dependency.

## MVP scope

Build these first:

1. Local authentication for one user.
2. Account CRUD.
3. Category CRUD.
4. Tag CRUD.
5. Transaction CRUD for income, expense, and transfer.
6. Basic dashboard:
   - Total balance
   - Monthly income
   - Monthly expenses
   - Net cashflow
   - Spending by category
7. Responsive mobile layout.
8. Docker/Podman-compatible Compose with PostgreSQL.
9. Seed script with useful example categories.
10. CSV export of transactions.

MVP exclusions:

- No React or frontend framework.
- No Tailwind or component library.
- No chart library.
- No PWA tooling.
- No external market data APIs.
- No public registration.
- No investment or crypto transaction implementation beyond reserving clean model space for later.

After MVP:

1. CSV import.
2. Recurring transactions.
3. Budgets.
4. Investment tracking.
5. Crypto tracking.
6. Manual asset price history.
7. Rules for automatic categorization.
8. Receipt attachments.
9. Backup/restore.
10. Multi-currency exchange rates.

## Suggested data model

Use Prisma models equivalent to:

- User
- Account
- Transaction
- Category
- Tag
- TransactionTag

Reserve these for after the cash/accounting MVP unless explicitly needed sooner:

- Asset
- AssetPrice
- InvestmentTransaction
- Budget
- RecurringTransaction
- Rule
- Attachment
- AuditLog

Important constraints:

- Use UUID/CUID primary keys.
- Keep `userId` on all user-owned records even while the MVP supports only one user.
- Use `createdAt` and `updatedAt` on mutable records.
- Use integer minor units for money.
- Use Decimal for asset quantities and prices.
- Use indexes on date fields, account IDs, category IDs, and transaction type.
- Prefer soft delete only if clearly useful; otherwise use normal delete with confirmation.
- For MVP reporting, assume one primary currency. Multi-currency conversion is deferred.

## UX expectations

- Mobile-first responsive layout.
- Fast transaction entry.
- Clear account balance overview.
- Good filters by date, account, category, tag, and text search.
- Forms should be simple and validated.
- Use accessible form controls, links, buttons, tables, and semantic HTML.
- Avoid clutter. Personal finance apps should feel calm and trustworthy.
- Keep pages usable without client-side JavaScript where practical.

## Security and privacy

This app stores sensitive financial data.

- Do not log secrets or financial payloads unnecessarily.
- Use environment variables for secrets.
- Hash passwords with a strong password hashing function such as Argon2id or bcrypt.
- Use local cookie sessions for MVP.
- Session cookies should be `HttpOnly`, `SameSite=Lax` or `SameSite=Strict`, and `Secure` in production.
- Add CSRF protection for mutating form posts.
- Validate all inputs on the server.
- Avoid exposing stack traces in production.
- Keep external integrations optional.
- Do not add analytics or telemetry unless explicitly requested.
- Do not expose public registration by default. Start with one configured or seeded local user.

## Backup format contract

Treat the user-scoped JSON backup format as a public, versioned data interchange contract. It must remain usable by people generating imports from spreadsheets or other systems.

Whenever a change adds, removes, renames, retypes, or changes the meaning or default of any exported/restored field, enum, relationship, validation rule, or record family, update all affected backup contract artifacts in the same change:

- backup export, preview, and restore behavior in `src/services/backup.ts`;
- the current machine-readable schema in `src/public/schemas/`;
- the matching importable starter file in `src/public/examples/`;
- `wiki/operations/json-backup-format.md` and related backup documentation;
- tests that keep the published schema version and starter file aligned with the importer.

For an incompatible format change, increment `currentBackupSchemaVersion`, publish new versioned schema and example filenames, preserve superseded schemas for users of older exports, and document compatibility behavior. Do not silently rewrite a published historical schema to describe a different format.

The restore implementation is authoritative. The published JSON Schema may add useful structural constraints, but it must not reject backups currently exported by the matching Pennyworth version. Run the backup tests and `npm run wiki:lint` after every backup-contract change.

## Release version contract

Pennyworth uses Semantic Versioning. The `version` in `package.json` is the authoritative application version; keep the root entry and application package entry in `package-lock.json` synchronized. The running application must obtain its displayed version from that manifest rather than from a separately maintained constant.

While Pennyworth is pre-v1.0, use the following release meanings:

- increment the patch component for compatible fixes and documentation-only corrections to an existing release line;
- increment the minor component for meaningful features, behavior changes, database migrations, or intentionally incompatible application contracts;
- use `alpha.N` for actively changing previews, `beta.N` after the target feature set is complete and undergoing real-world validation, and `rc.N` only when no known release blocker remains;
- do not increment the application version for every development commit; increment it when preparing an identifiable release or preview.

Application versions, JSON backup schema versions, and timestamped database migrations are independent identifiers. Never infer one from another. A backup-contract change follows the separate backup format contract above and may or may not require a new application minor version depending on its product impact.

For every release, update `CHANGELOG.md`, synchronize package metadata, document breaking changes and upgrade or backup requirements, run the release checks in `wiki/operations/releases.md`, commit the exact release state, and create an annotated Git tag named `v<version>`. Do not move or reuse a published release tag. Keep public release-status documentation and `wiki/log.md` synchronized with version changes.

## License contract

Pennyworth is released under the MIT License with P47ch as the copyright holder. Treat `LICENSE` as a fundamental public contract.

Keep the license identifier, holder, and public licensing statements synchronized across `LICENSE`, `package.json`, `package-lock.json`, `README.md`, and affected canonical wiki pages. Do not change the license, copyright attribution, year, or licensing scope without the user's explicit approval.

Before adding a dependency, generated asset, copied resource, or third-party code, confirm that its license and required notices are compatible with Pennyworth's MIT distribution. Preserve all required third-party notices. If a change affects Pennyworth's licensing or redistribution obligations, update every affected artifact and `wiki/log.md` in the same change, then run `npm run wiki:lint`.

## Testing expectations

Add tests for financial logic first.

Required test areas:

- Income balance effects.
- Expense balance effects.
- Transfer behavior.
- Monthly income/expense summaries.
- Category aggregation.
- Money formatting and minor-unit conversion.

Use the repository's existing test framework if present. Otherwise choose a standard TypeScript-friendly setup.

## Code style

- Use TypeScript strictly.
- Keep business logic separate from route handlers and templates.
- Prefer small modules and pure functions for calculations.
- Avoid floating-point arithmetic for money.
- Use clear names over clever abstractions.
- Add comments only where they clarify non-obvious financial logic.
- Keep routes, services, and validators consistent.
- Avoid clever minimalism. Keep code boring, explicit, and easy to inspect.

## First task for Codex

If starting from an empty repository, create the initial MVP scaffold:

1. Fastify TypeScript app.
2. Server-rendered templates with EJS or Eta.
3. Prisma configured for PostgreSQL.
4. Docker/Podman-compatible Compose with PostgreSQL and app service.
5. Initial Prisma schema for User, Account, Category, Tag, Transaction, TransactionTag.
6. Seed script with categories and sample accounts.
7. Basic pages:
   - Dashboard
   - Accounts
   - Transactions
   - Categories
   - Tags
8. Basic transaction creation form.
9. Basic dashboard summary cards.
10. Plain responsive CSS.
11. `wiki/operations/local-development.md` with setup commands and `wiki/index.md` navigation.

## Setup commands

When the project exists, prefer commands like:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
npm run test
npm run typecheck
```

Keep commands consistent in `wiki/operations/local-development.md`, relevant deployment runbooks, and package scripts.
