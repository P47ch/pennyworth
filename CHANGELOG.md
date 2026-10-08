# Changelog

All notable changes to Pennyworth will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Pennyworth uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Because the application is still pre-v1.0, every release should be reviewed for documented upgrade and compatibility notes.

## [Unreleased]

## [0.9.0-alpha.1] - 2026-10-08

This preview expands recurring schedules and categorization, adds encrypted backups and optional update notifications, and improves deletion safety and interface consistency.

### Added

- Password-protected `.pwb` backup downloads and file-based `.pwb` or `.json` restore with validation, a confirmation preview, and authenticated encryption. Ordinary JSON export and restore remain available.
- Optional administrator-only update notifications using public GitHub Release metadata, with stable or prerelease channels and no automatic installation.
- Daily, Quarterly, and Semiannual recurring schedules with calendar-aware date advancement and localized labels.
- Weekly/monthly recurring previews, target-balance top-ups, optional source/destination fee expenses, per-occurrence fee overrides, safe confirmation/skipping, and localized Rules-style help.
- Localized hover, focus, and touch explanations for recurring Name, Description, and Fee account labels.
- Create categories and tags from transaction quick entry in accessible dialogs, preserving the draft and selecting the new record immediately.
- Comma-separated rule alternatives with quoted literal phrases, automatic categorization of new uncategorized expenses, localized save feedback, and an accessible Rules help panel.
- Enable or disable rules directly from the rule list while retaining their settings and order.

### Changed

- JSON backup schema version 12 adds daily, three-month, and six-month frequencies. Versions 1–11 remain importable; historical schemas and examples stay unchanged.
- Choosing a category skips rule categorization and rule tags, including during CSV import. New quick entries remember the account but start with an empty category.
- JSON backup schema version 11 adds recurring amount modes, weekly schedules, optional fee settings, nullable target-mode amounts, and transfer-fee links. Versions 1–10 remain importable as fixed monthly templates without fees; all published historical artifacts remain available.
- JSON backup schema version 10 introduced the rule matching syntax. Historical versions 1–9 restore their match text as one literal phrase; published version 8 and 9 artifacts remain available. Restored transactions retain their saved categories and tags.
- Document Git Flow branch naming and the release workflow for `main` and `develop`.

### Fixed

- JSON and encrypted restore preserve the original update timestamps on linked transfer fees when rebuilding their relationships, including version-11 backups.
- Every Delete action requires a separate, localized server-rendered confirmation with Cancel, preserving data on a misclick even without JavaScript.
- Delete buttons share the dimensions of adjacent Edit and other row actions throughout the application, including their hover and keyboard-focus states.
- Category icons stay centered in dashboard spending rows and budget badges; long category names wrap within narrow reporting cards.
- Date inputs stay within their form fields on iOS, and Settings tabs wrap on narrow mobile screens.
- Update the locked development dependency `source-map-js` to 1.2.2, clearing the high-severity dependency audit failure (GHSA-68fv-2mgg-jv7q).
- Recurring help-label dotted underlines align consistently beneath Name, Description, and Fee account.
- Transfer-fee validation uses separate indexed fee and parent lookups, avoiding full-ledger scans during imports and restores.
- Recurring generation and skipping preserve complete imported occurrence timestamps, including milliseconds, through confirmation.
- Existing and restored recurring names longer than 100 characters remain usable, including unchanged-name settings edits; the limit applies to new and renamed templates.
- Quick category/tag creation can recover a saved record after an interrupted response through an explicit Use existing action, preserving the transaction draft and checking category compatibility.
- Type selectors, badges, and summaries use capitalized, localized labels with readable spaces and the ETF acronym.
- Update Fastify, Vitest, and the locked `fast-uri` and `brace-expansion` dependencies to compatible versions that clear the reported dependency audit failures.
- Encrypted-backup tampering tests always change a byte, preventing intermittent CI failures when a random Base64 value already starts with `A`.
- Docker development reloads server code through file polling, avoiding new form actions pointing at routes absent from a stale process.
- Historical whitespace-only rules remain inert and can be exported and restored in version 10, including quoted line breaks and active rules.
- CSV and existing-expense previews parse rule terms once per batch instead of once per transaction.
- Transaction save notices preserve literal rule, category, and tag names containing dollar sequences or translation placeholder text.
- Add rule and Edit rule display validation errors in the selected interface language.

### Upgrade notes

- Create and test both user-scoped JSON and full PostgreSQL backups before upgrading. Follow the [deployment update procedure](wiki/operations/deployment.md#updates) for the selected Docker or Podman profile, or run `npm run db:generate` and `npm run db:deploy` for a host Node installation before starting the new application.
- Apply all four migrations introduced since `0.8.0-alpha.1` in their normal timestamp order:

  - `20261002000000_preserve_literal_rule_matching` quotes existing literal commas and quotes to preserve rule behavior. Edit an existing comma-containing rule to opt into alternatives.
  - `20261005000000_add_recurring_top_ups` adds target-balance templates and fees. Existing templates keep their fixed monthly amounts without fees.
  - `20261005001000_optimize_transfer_fee_validation` replaces the validation function with indexed lookups. Apply it even if the top-up migration was already applied; it does not change ledger data or the backup format.
  - `20261006000000_add_recurring_frequencies` adds the new schedule frequencies without changing saved schedules.

- New JSON exports use schema version `12`; versions `1`–`11` remain importable. Earlier application builds cannot import version-12 exports. Application version `0.9.0-alpha.1`, JSON schema version `12`, and encrypted-envelope version `1` are independent identifiers. See the [backup format contract](wiki/operations/json-backup-format.md).
- Rollback requires the pre-upgrade PostgreSQL snapshot and the matching older application. Earlier builds cannot represent the new recurring settings or interpret migrated rule text correctly. Do not rely on a new backup export as a rollback copy.
- New encrypted exports require a passphrase of at least 12 characters. Store it separately; a lost passphrase cannot be recovered. User-scoped backups exclude credentials, roles, and interface preferences, so keep PostgreSQL dumps for full-installation recovery. See [backup and restore](wiki/operations/backup-and-restore.md).
- Update checking remains opt-in through `UPDATE_CHECK_ENABLED=true`. The default `UPDATE_CHANNEL=prerelease` includes alpha, beta, RC, and stable releases; `stable` includes only full releases. The setting requires a public GitHub metadata request and does not update the application automatically.

### Known limitations

- This is an alpha preview; application behavior and data structures may still change before v1.0.
- Recurring generation requires manual preview and confirmation; there is no background scheduler.
- Investment prices are manual, cost basis uses average cost, and dedicated brokerage, tax, return-analysis, and crypto-wallet flows remain outside the current scope.
- Reports assume one primary currency. Bank, broker, exchange, analytics, and market-data integrations are not provided.
- The supplied HTTP deployment profiles are intended for a trusted private LAN. Keep tested backups and rehearse upgrades and recovery using non-production data.

## [0.8.0-alpha.1] - 2026-09-05

This is Pennyworth's first formally versioned public preview. Earlier development history is consolidated into this entry.

### Added

- Local authentication, administrator-managed isolated users, session invalidation, and console password recovery.
- Account, transaction, transfer, nested-category, tag, budget, rule, and recurring-template management.
- Dashboard and statistics views for balances, cashflow, net worth, spending, savings, and account history.
- CSV transaction import and export with mapping, validation, duplicate detection, and idempotent confirmation.
- Manual investment assets, prices, activity, holdings, valuation, allocation, and average-cost gain calculations.
- Versioned user-scoped JSON backup and transactional restore, including a published schema and starter file.
- English and Italian interfaces, light and dark appearances, responsive navigation, accessible server-rendered icons, and built-in avatars.
- Docker and Podman-compatible private-LAN deployment profiles with managed or external PostgreSQL.

### Known limitations

- Pennyworth is an alpha release; behavior and data structures may still change before v1.0.
- Investment prices are manual, cost basis is average-cost only, and advanced brokerage, tax, return-analysis, and crypto-wallet flows are not modeled.
- The application is single-currency and has no bank, broker, exchange, analytics, or market-data integrations.
- The supplied HTTP deployment profiles are intended only for a trusted private LAN.
- Operators should keep tested JSON and PostgreSQL backups and review release notes before updating.
