---
title: Product Status and Roadmap
type: status
status: current
updated: 2026-10-06
source_ids: [application-source, database-schema, migrations, test-suite, ci-workflow, container-definitions, project-contract, release-policy, issue-6, issue-8, issue-8-fees, issue-8-help]
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
- Quick category/tag creation in manual transaction entry with draft preservation, immediate selection, localized accessible dialogs, and explicit recovery after interrupted creation responses.
- Retried and concurrent CSV confirmations are idempotent through user-scoped import receipts.
- Categorization-rule priority, comma-separated alternatives, optional rule tags, direct list Enable/Disable actions, automatic application to new uncategorized expenses and recurring generation, CSV preview, localized save feedback, and explicit preview against existing expenses.
- Manual daily/weekly/monthly/quarterly/semiannual recurring generation with signed preview, fixed amounts or target-balance transfers, optional source/destination fee expenses, safe confirmation/skipping, and localized Rules-style help.
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

The rule-automation change was initially verified on 2026-10-02 with 206 unit tests across 35 files, application and test TypeScript checks, a production build, Prisma validation, wiki lint, and published version-10 starter validation against its JSON Schema. Targeted Rules-page browser fixtures passed six JavaScript-enabled desktop/mobile English/Italian light/dark scenarios with no WCAG axe violations, plus two native-control scenarios with JavaScript disabled (including a 320-pixel viewport). This was fixture-based UI verification, not a full authenticated application audit. At that stage, the guarded PostgreSQL suite exited before any database operation because `TEST_DATABASE_URL` was absent, and the new data migration remained unapplied locally.

Review fixes on the same date preserved inert legacy rules through version-10 backup export/reimport and removed repeated parsing from bulk rule matching. Verification passed 211 unit tests, both TypeScript checks, and the production build. The actual 1,000-row/10,000-rule CSV-preview benchmark improved from 7.4 seconds to 0.35–0.38 seconds; see [testing and performance](../operations/testing-and-performance.md) for its scope. The PostgreSQL regression was still pending at that stage.

Follow-up verification on 2026-10-02 passed 231 unit tests across 35 files, both TypeScript checks, the production build, and all 16 PostgreSQL/Fastify integration tests against a separate disposable `pennyworth_rule_test` database in Docker PostgreSQL 16. All 25 migrations applied successfully there, including the literal-rule migration. The integration suite verifies the new list Enable/Disable action, CSRF and user ownership, repeated state submissions, unchanged settings and saved transactions, and future matching. Eight Rules browser fixtures also passed desktop/mobile English/Italian light/dark checks, including native controls without JavaScript and both active/inactive buttons.

## Current focus

Issue #8 recurring top-ups was verified on 2026-10-05 with 253 unit tests, 30 PostgreSQL/Fastify integration tests in a disposable database, 30 recurring browser configurations, both TypeScript checks, production build, Prisma validation, backup schema/export compatibility checks, and wiki lint. The running test container passed an authenticated 17-route desktop/mobile accessibility sweep and live preview/help checks using a temporary isolated user. Its migration is applied and update checking is enabled at the user's request. Fixed/target-balance transfers and source/destination fee choices are current behavior; generation remains manual. See [testing and performance](../operations/testing-and-performance.md#recurring-form-and-help-checks).

Issue #6 quick category/tag creation, including interrupted-response recovery, was verified on 2026-10-05 with 239 unit tests across 36 files, all 18 PostgreSQL/Fastify integration tests against a separate test database, both TypeScript checks, and the production build. Eight expanded English/Italian desktop/mobile light/dark dialog fixtures and a JavaScript-disabled fallback passed. The earlier implementation also passed wiki lint and a full isolated-app accessibility audit across all 17 routes in both desktop/mobile viewports. See [testing and performance](../operations/testing-and-performance.md#quick-entry-dialog-checks).

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
5. Background recurring scheduling and dedicated monthly per-account cashflow summaries; manual weekly fixed/target-balance transfers from [issue #8](../features/automation.md#fixed-and-variable-recurring-transfers-issue-8) are implemented.
6. Manual exchange rates and multi-currency reporting.
7. Receipt attachments.
8. User-facing backup/restore drills and operational automation.

Quick category/tag creation from issue #6 is implemented in [manual transaction entry](../features/transactions.md#quick-category-and-tag-creation-issue-6). Extending it to editing, recurring forms, rules, and CSV import remains future work.

After the recurring PR merges, add dependency maintenance in a separate PR: weekly Dependabot version updates for npm/GitHub Actions, small compatible-update groups, security alerts and fixes for maintained branches, required CI/review, and a scheduled audit. No update automation is configured yet; the [maintenance plan](../operations/testing-and-performance.md#dependency-maintenance-follow-up) records scope and Dependabot's default-branch security behavior.

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
- [`issue-6`](../sources.md#sourceissue-6)
- [`issue-8`](../sources.md#sourceissue-8)
- [`issue-8-fees`](../sources.md#sourceissue-8-fees)
- [`issue-8-help`](../sources.md#sourceissue-8-help)
