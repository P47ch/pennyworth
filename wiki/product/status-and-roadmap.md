---
title: Product Status and Roadmap
type: status
status: current
updated: 2026-09-18
source_ids: [application-source, database-schema, migrations, test-suite, ci-workflow, container-definitions, project-contract, release-policy]
tags: [status, roadmap, verification]
---

# Product Status and Roadmap

This page separates implemented behavior, dated verification evidence, and genuinely planned work. A route, schema model, or task-list claim alone is not enough to call a feature verified.

## Release status

Pennyworth `0.8.0-alpha.1` is an actively developed public preview, not a stable v1 release. The alpha designation reflects that application contracts and upgrade behavior are still being stabilized. Operators should expect compatible migrations where practical but must keep tested JSON and PostgreSQL backups and review release changes before updating.

## Implemented

- Local login/logout, signed cookie sessions, login throttling, password changes, operator-console password recovery, and session invalidation support.
- Administrator-managed family accounts with isolated ledgers, one-time temporary passwords, forced password replacement, access activation/deactivation, and starter categories/tags.
- Account, nested-category, tag, transaction, budget, rule, and recurring-template management.
- Income, expense, and transfer accounting with account balances and monthly reporting.
- A focused dashboard with net worth, combined monthly cashflow, conditional budget/recurring attention items, recent activity, and limited spending/account previews.
- Statistics with 12-month net-worth, per-account balance, monthly cashflow, and category-spending history; category/tag drilldowns; largest expenses; and current account balances.
- Transaction filters, pagination, CSV export, CSV mapping/import preview, duplicate handling, and formula-safe exported text.
- Retried and concurrent CSV confirmations are idempotent through user-scoped import receipts.
- Categorization-rule priority, optional rule tags, import-time rule application, and preview against existing expenses.
- Manual recurring generation for monthly income, expenses, and transfers.
- Asset catalog, manual prices, investment activity, cash impact, derived positions, average cost, valuation, and allocation reporting.
- JSON backup and transactional restore across supported user-owned records; investment projections are rebuilt rather than backed up.
- Password-protected `.pwb` backup export and file-based restore using bounded scrypt and AES-256-GCM envelopes, metadata authentication, generic decrypt failures, and preview-bound confirmation; ordinary JSON remains supported.
- Repeatable-read JSON export snapshots, primary-currency enforcement, and central signed-32-bit money bounds.
- English/Italian localization, light/dark themes, configurable sidebar, responsive layouts, server-rendered icons, and an administrator-only optional update indicator backed by a bounded GitHub Release metadata check.
- CSRF, CSP and browser headers, signed `HttpOnly` and `SameSite=Strict` cookies for the documented LAN-only HTTP topology, service ownership validation, and PostgreSQL constraints.
- Generic server-rendered error and not-found pages that keep internal exception details in server logs and expose only a request ID for correlation.
- Docker and Podman-compatible Compose definitions for development and private-LAN HTTP production with either managed or externally managed PostgreSQL.

## Verification evidence

The most recent review validation on 2026-07-18 recorded:

- 90 unit tests passing across 16 test files.
- Application and test TypeScript checks passing.
- Production TypeScript build passing.
- Prisma schema validation passing.
- Dependency audit reporting zero vulnerabilities.
- The original four Compose definitions parsed successfully with Docker Compose during the 2026-07-18 review. The external-database definition was added and validated separately on 2026-08-25.
- Dockerfile static build check reporting no warnings after Podman portability changes.
- Database migration `20260718004000_fix_review_findings` applied successfully to the configured local PostgreSQL database, followed by Prisma Client generation and a `200 {"ok":true}` readiness response.

The guarded integration runner was not executed in that review because `TEST_DATABASE_URL` was absent; it exited before changing a database. Historical documentation records a successful local accessibility sweep on 2026-07-18 across 16 authenticated routes in desktop and mobile viewports, but that evidence should be rerun after material UI changes.

The isolated-user implementation was locally verified on 2026-09-03 with 120 unit tests across 24 files, application and test TypeScript checks, a production build, Prisma schema validation, and wiki lint. Its new PostgreSQL/Fastify provisioning and access-revocation scenario is present in the guarded integration suite but was not executed because `TEST_DATABASE_URL` was unavailable.

A documentation publication audit on 2026-09-04 passed 137 unit tests across 26 files, application and test TypeScript checks, a production build, Prisma schema validation, wiki lint, local Markdown-link checks, and parsing of all three Compose definitions with `.env.example`. It did not rerun the guarded integration suite, live browser accessibility audit, live deployment, or Podman smoke test.

## Current focus

Operationally validate the intended self-hosted environment rather than adding another architecture layer:

- Run the appropriate managed- or external-PostgreSQL HTTP profile on the target private-LAN server.
- Verify that the configured private address and port are reachable from intended desktop and phone clients but not exposed outside the trusted LAN.
- Exercise SQL and JSON recovery using non-production data.
- Run the guarded PostgreSQL integration suite against an explicit disposable test database.
- Smoke-test the shared Compose definitions with Podman on a host where Podman is installed.

## Roadmap

High-value product work not currently implemented:

1. Persisted dashboard widget visibility, ordering, density, and item limits.
2. Investment-return performance, longer historical ranges, and benchmark comparison.
3. Crypto-specific transfers, staking rewards, mining rewards, and wallet flows on the shared asset model.
4. CSV create-missing-tags behavior if real imports demonstrate the need.
5. Recurring-transaction preview and confirmation refinements; background scheduling remains intentionally deferred.
6. Manual exchange rates and multi-currency reporting.
7. Receipt attachments.
8. User-facing backup/restore drills and operational automation.

## Removed stale backlog

The former task page listed dashboard budget state, recurring templates, categorization tags, rule previews, and the investment skeleton as future work even though the repository already implements them. They are now documented as current behavior on canonical feature pages rather than retained as misleading tasks.

## Related pages

- [`product-brief.md`](product-brief.md)
- [`../operations/testing-and-performance.md`](../operations/testing-and-performance.md)
- [`../operations/deployment.md`](../operations/deployment.md)
- [`../operations/releases.md`](../operations/releases.md)
- [`../features/investments.md`](../features/investments.md)

## Sources

- [`application-source`](../sources.md#sourceapplication-source)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`migrations`](../sources.md#sourcemigrations)
- [`test-suite`](../sources.md#sourcetest-suite)
- [`ci-workflow`](../sources.md#sourceci-workflow)
- [`container-definitions`](../sources.md#sourcecontainer-definitions)
- [`project-contract`](../sources.md#sourceproject-contract)
- [`release-policy`](../sources.md#sourcerelease-policy)
