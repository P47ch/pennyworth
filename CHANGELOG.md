# Changelog

All notable changes to Pennyworth will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Pennyworth uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Because the application is still pre-v1.0, every release should be reviewed for documented upgrade and compatibility notes.

## [Unreleased]

### Added

- Comma-separated rule alternatives with quoted literal phrases, automatic categorization of new uncategorized expenses, localized save feedback, and an accessible Rules help panel.

### Changed

- Choosing a category skips rule categorization and rule tags, including during CSV import. New quick entries remember the account but start with an empty category.
- JSON backup schema version 10 defines the rule matching syntax. Historical versions 1–9 restore their match text as one literal phrase; published version 8 and 9 artifacts remain available. Restored transactions retain their saved categories and tags.

### Fixed

- Historical whitespace-only rules remain inert and can be exported and restored in version 10, including quoted line breaks and active rules.
- CSV and existing-expense previews parse rule terms once per batch instead of once per transaction.
- Transaction save notices preserve literal rule, category, and tag names containing dollar sequences or translation placeholder text.
- Add rule and Edit rule display validation errors in the selected interface language.

### Upgrade notes

- Apply migration `20261002000000_preserve_literal_rule_matching` before running the new matcher. It quotes existing literal commas and quotes to preserve behavior. Edit an existing comma-containing rule to opt into alternatives.
- Keep pre-upgrade JSON and PostgreSQL backups. Earlier application builds cannot import version 10 backups and interpret the migrated quoted rule text differently; use the pre-upgrade database backup when rolling back.

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
