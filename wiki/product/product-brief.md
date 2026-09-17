---
title: Pennyworth Product Brief
type: product
status: current
updated: 2026-09-05
source_ids: [project-contract, release-policy, license-policy, application-source, database-schema]
tags: [product, scope, principles]
---

# Pennyworth Product Brief

Pennyworth is a private, self-hosted personal-finance accounting web application. One home-lab installation can serve its owner and trusted family members, but every application user has an independent financial ledger. Accounts, transactions, categories, investments, reports, exports, and backups are not shared between users.

The current application version is `0.8.0-alpha.1`. Pennyworth is under active development and has not reached a stable v1.0 release. Behavior and data structures may still change, so operators should keep tested backups and review changes before updating. The project is moving toward v1.0 as quickly as reliability, financial correctness, and data safety allow.

## Primary user

A technically capable home-lab owner who wants full control over sensitive financial data and may provide isolated accounts to trusted family members. Each person uses a responsive browser interface on desktop or smartphone and sees only their own financial data.

## Core jobs

- Track income, expenses, and transfers across bank, cash, credit, savings, investment, crypto-wallet, and other accounts.
- Organize money movement with nested categories and flexible tags.
- Understand balances, cashflow, spending, savings, budgets, and trends.
- Maintain recurring templates and visible categorization rules without opaque automation.
- Track manually priced investments and crypto-class assets without depending on market-data APIs.
- Export transactions and create restorable backups.
- Operate privately through Docker or Podman on a personal server.

## Current product boundary

The original MVP was normal cash accounting: authentication, account/category/tag CRUD, income/expense/transfer CRUD, a dashboard, responsive forms, PostgreSQL, container deployment, seed data, and CSV export. The repository now also implements budgets, CSV import, recurring templates, categorization rules, investments, manual prices, JSON backup/restore, localization, themes, and accessibility auditing. See [`status-and-roadmap.md`](status-and-roadmap.md) for evidence and remaining work.

The app remains manual-first. It does not integrate with banks, brokerages, crypto exchanges, telemetry platforms, or external pricing services. Administrators provision family accounts privately; there is no public registration.

Pennyworth is open-source software distributed under the MIT License. `LICENSE` is the authoritative license text; package metadata and public documentation must remain synchronized with it.

## Non-goals

- Public registration or a public multi-tenant service.
- Bank, brokerage, or exchange synchronization.
- Native mobile applications.
- Complex tax filing or jurisdiction-specific tax advice.
- Shared household ledgers, shared accounts, or cross-user financial collaboration.
- Automatic external market data.
- Frontend-framework or microservice complexity without a demonstrated need.

## Product principles

- **Private by default.** Sensitive records stay in infrastructure controlled by the user.
- **Financial correctness first.** Integer minor units, explicit transfer rules, and database integrity matter more than visual novelty.
- **Manual and inspectable.** Automation is introduced as previewable, reversible behavior.
- **Traditional web ergonomics.** Request, validate, execute service/domain logic, and render HTML.
- **Mobile-first calmness.** Forms and summaries should be fast, accessible, uncluttered, and trustworthy.
- **Operational ownership.** Backups, migration commands, health checks, and deployment boundaries are part of the product.
- **Boring architecture.** Prefer small explicit modules and pure calculations over clever abstraction.

## Related pages

- [`../architecture/data-and-financial-model.md`](../architecture/data-and-financial-model.md)
- [`../architecture/security-and-privacy.md`](../architecture/security-and-privacy.md)
- [`../features/transactions.md`](../features/transactions.md)
- [`../features/investments.md`](../features/investments.md)
- [`../operations/releases.md`](../operations/releases.md)

## Sources

- [`project-contract`](../sources.md#sourceproject-contract)
- [`release-policy`](../sources.md#sourcerelease-policy)
- [`license-policy`](../sources.md#sourcelicense-policy)
- [`application-source`](../sources.md#sourceapplication-source)
- [`database-schema`](../sources.md#sourcedatabase-schema)
