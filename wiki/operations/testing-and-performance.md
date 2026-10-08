---
title: Testing and Performance
type: verification
status: current
updated: 2026-10-08
source_ids: [package-manifest, application-source, test-suite, ci-workflow, release-0-9-0-alpha-1, operational-scripts, database-schema, source-map-js-advisory, dependabot-docs]
tags: [testing, integration, accessibility, performance, ci]
---

# Testing and Performance

Verification is layered: pure financial tests first, guarded PostgreSQL integration tests for real constraints, browser audits for rendered behavior, and measured performance before adding caches.

## Local verification

Recommended code checks:

```bash
npm run test
npm run test:typecheck
npm run typecheck
npm run build
npm audit --audit-level=high
npm run wiki:lint
```

Run `npm run audit:a11y` against a prepared, running application after interface changes. Build the production image before a release that changes dependencies, Prisma generation, build output, or the Dockerfile.

## 0.9.0-alpha.1 release verification

Local release verification on 2026-10-08 passed against the prepared working tree on `release/0.9.0-alpha.1`:

- 290 unit tests across 38 files and all 56 PostgreSQL/Fastify integration tests across three files.
- Application/test TypeScript checks, production TypeScript build, and wiki lint.
- A fresh `npm audit --audit-level=high` with zero vulnerabilities; the production image also installed and pruned dependencies successfully.
- All 28 migrations applied to a new, isolated PostgreSQL 16 database. Integration tests left the normal development database untouched.
- Eight quick-entry browser fixtures plus the no-JavaScript fallback, and all 30 recurring browser configurations.
- The authenticated Chromium/axe audit across 17 routes in desktop and mobile viewports, with no accessibility violations, horizontal overflow, console/page errors, or failed requests.
- Draft 2020-12 schema validation, including date-time formats, of published version-8 through version-12 starters and two actual PostgreSQL-backed version-12 exports.
- Real production HTTP import of the version-12 starter, JSON file export/restore, and encrypted `.pwb` export/file restore with explicit confirmation. Replacement removed deliberately added test tags and preserved the complete exported ledger, relationships, and record timestamps.
- A production Docker build using Node 22 Alpine, and managed/external PostgreSQL profile startup, readiness, login, displayed version, and served CSS checks. A PostgreSQL dump restored into a second disposable database and matched the original ledger through the external-database app.
- All three Compose profiles parsed through Docker Compose and Podman's installed Compose provider.

The backup rehearsal exposed transfer-fee `updatedAt` drift during relinking. Versions 11 and 12 reproduced it before the fix; the expanded PostgreSQL regression, full test suites, rebuilt production image, and real JSON/encrypted round-trips passed after timestamp preservation was corrected. Published backup fields, validation, schemas, and examples retain their contract.

**Podman limitation:** the local Windows Podman 5.7.1 WSL VM could not complete a runtime smoke test because its user-session bus was unavailable, preventing rootless DNS/network startup. Static Compose validation passed; runtime compatibility on this host is not verified. Temporary socket services and test resources were used without changing the configured default connection or rootful setting. Repair that VM or repeat the smoke test on the intended Podman host before deploying there.

These are local working-tree results. The prepared release commit `7adf9dd` was subsequently merged into `main` as `3a6aeaa27ea71599e1b3d410714e4312286bc3a8`, whose [GitHub Actions CI run passed](https://github.com/P47ch/pennyworth/actions/runs/37801932900). The annotated tag `v0.9.0-alpha.1` targets that verified commit, and the matching [GitHub prerelease](https://github.com/P47ch/pennyworth/releases/tag/v0.9.0-alpha.1) was published on 2026-10-08.

Removed the disposable test databases, containers, volumes, release-test images, and temporary validation files after verification. Returned the Podman VM to its original stopped state. The original Docker development app and PostgreSQL remained running; app readiness returned 200 after cleanup.

## Unit tests

Vitest covers money conversion, account balance effects, transfers, monthly summaries, category aggregation, budgets, recurrence, investments, configuration, CSV behavior, backup validation, authentication helpers, preferences, icons, and SQL query result adapters.

The dependency-security verification on 2026-09-17 passed 151 tests in 28 files with Vitest 4.1.11. Treat counts as dated evidence; `npm run test` is the current truth.

The 2026-10-02 rule-review fixes passed 211 unit tests across 35 files, both TypeScript checks, and the production build. Regression coverage checks legacy inert-rule restore/export/reimport and verifies that CSV and existing-expense previews prepare rule text once per batch. The corresponding PostgreSQL backup regression was added, but the guarded integration runner could not start because `TEST_DATABASE_URL` was unset.

Encrypted-backup tamper tests decode the selected ciphertext, authentication tag, salt, or nonce, flip a bit, and re-encode it. This guarantees a byte change while retaining valid Base64 and field lengths. A fixed, valid envelope whose ciphertext starts with `A` covers the case where the previous character-replacement test left its randomized input unchanged. The 2026-10-05 correction passed 232 unit tests across 35 files and the test TypeScript check.

## Deletion confirmation checks

`tests/deleteConfirmation.test.ts` checks explicit scalar confirmation, rejection of missing/invalid/repeated fields, safe name escaping, and English/Italian review controls. The guarded `tests/integration/deletions.integration.test.ts` covers all 11 Delete actions against PostgreSQL. It compares user-scoped domain snapshots before and after review/cancellation, verifies confirmation requires CSRF and cannot access another user's record, and exercises confirmed removal, used-account/asset inactivation, and linked transfer/fee deletion. The existing authenticated transaction lifecycle test also covers the two-step flow.

On 2026-10-07, 290 unit tests and all 55 PostgreSQL/Fastify integration tests passed in the separate `pennyworth_delete_confirmations_test` database with all 28 migrations. Test users and their records were removed afterward.

Both TypeScript checks and the production build passed. Sixteen browser configurations checked the shared review in desktop/320-pixel mobile, English/Italian, light/dark, accessibility, long-name wrapping, keyboard cancellation, and explicit confirmation with JavaScript disabled. Inspected desktop/mobile screenshots showed no horizontal overflow.

## Recurring form and help checks

Run `npm run test:recurring` after installing Chromium with `npx playwright install chromium`. The existing Playwright/axe dependencies serve temporary rendered fixtures without a database or real financial data. Thirty page configurations cover Recurring, Edit recurring, and preview across desktop/320-pixel mobile, English/Italian, light/dark, and native no-JavaScript controls. Checks cover keyboard help, Escape/outside-click dismissal, preserved drafts, all five localized frequency options, exactly source/destination fee options, fixed/target field switching, localized breakdowns, zero unintended POST requests, horizontal overflow, and axe violations. CI runs it after Chromium installation.

The guarded integration suite additionally covers source/destination fee accounting, per-occurrence zero overrides, explicit skipping, dated balance calculations, stale and duplicate confirmations, competing replenishment templates, injected fee-creation rollback, category/account ownership, conditional database checks, correction/deletion semantics, and out-of-order version-11 backup round-trips.

The 2026-10-05 issue #8 implementation passed 253 unit tests across 37 files, all 30 PostgreSQL/Fastify integration tests in the separate `pennyworth_issue8_test` database, both TypeScript checks, the production build, Prisma validation, and wiki lint. All 26 migrations applied there. Thirty recurring browser configurations passed with no accessibility violations or page overflow; mobile screenshots were inspected. Version-11 JSON Schema validation accepted the starter, an actual PostgreSQL-backed export, and an export normalized from version 10; legacy fixed/monthly/no-fee defaults were verified. A full authenticated audit of the running test container passed all 17 routes in desktop/mobile viewports, plus a live recurring preview/help/zero-top-up check, using a temporary isolated user removed afterward. Its migration applied, `/readyz` and `/login` returned 200, and `UPDATE_CHECK_ENABLED=true` was verified in the running app container. No release version or dependencies changed.

The 2026-10-05 recurring-review remediation passed 261 unit tests, all 35 PostgreSQL/Fastify integration tests in the isolated `pennyworth_issue8_review_test` database, both TypeScript checks, the production build, and all 30 recurring browser configurations. All 27 migrations applied. New rendered-form regressions cover imported intraday timestamps with milliseconds for both generation and skipping, repeat-submission rejection, and version-10/version-11 restored 101-character names that still generate and allow unchanged-name edits while rejecting new long names. Published backup fields, schemas, and starter files retain their compatibility behavior; no schema or application version changed.

The trigger regression seeds 51,000 rows inside a rolled-back transaction, then validates 100 updates with the fee trigger enabled and a two-second statement budget. The original trigger exceeded that budget; separate indexed lookups completed in 41.7 ms during the full integration run (44.2 ms in the focused run). These timings measure trigger validation, not an entire import or restore. The fixture and test users are removed afterward.

The 2026-10-06 recurring label explanations passed all 30 existing browser configurations and the application TypeScript check. Create/edit checks now cover localized Name/Description text, label hover, persistence while hovering the popup, keyboard focus, Escape without focus loss, click/touch opening, outside dismissal, unchanged drafts, accessible input descriptions, and no-JavaScript touch fallback. Open-tooltip desktop/mobile screenshots were inspected; accessibility and horizontal-overflow checks passed. No form-control action sent a POST request.

The same day's Fee account follow-up also passed all 30 configurations and the application TypeScript check. Create/edit checks include the fee selector's hover, focus, touch, dismissal, preserved draft and shared guidance, plus no-JavaScript fallback; preview checks cover the localized fee explanation and Escape dismissal. Open-tooltip desktop/mobile screenshots were inspected.

The 2026-10-06 frequency extension passed 279 unit tests across 37 files, all 42 PostgreSQL/Fastify integration tests against the isolated `pennyworth_issue8_review_test` database, both TypeScript checks, the production build, and all 30 recurring browser configurations. All 28 migrations applied. Regressions cover daily UTC calendar boundaries, quarterly/semiannual month-end clamping and leap years, exact occurrence timestamps, generated and skipped occurrences, and version-12 export/restore for each new frequency. Version-11 target/fee settings and published artifacts retain their behavior; versions 1–11 remain importable. The expanded fixtures use independent client addresses for login so they exercise authentication without exhausting a shared rate-limit bucket; production throttling is unchanged.

Draft 2020-12 JSON Schema validation accepted the version-12 starter and an actual PostgreSQL-backed export containing all five frequencies; the temporary export user was removed afterward. The existing Docker test app applied `20261006000000_add_recurring_frequencies`, then passed live readiness, login, recurring-selector label/value checks, and current schema/starter download-link checks. No normal-user financial records, dependencies, or application release version changed.

## Dependency audit

The 2026-09-17 security-maintenance run upgraded Fastify to 5.12.1 and Vitest to 4.1.11, then passed application and test typechecks, the production build, wiki lint, and `npm audit --audit-level=high` with zero reported vulnerabilities. Dependency audit results are time-sensitive; CI and a fresh release-time audit remain authoritative.

The 2026-10-05 CI follow-up raised the Fastify dependency minimum to 5.12.5 and refreshed the lockfile to `fast-uri` 3.1.8/4.2.1 and `brace-expansion` 2.1.7/5.0.12 within their existing major-version ranges. All 232 unit tests, 16 PostgreSQL/Fastify integration tests against the separate `pennyworth_rule_test` database, both TypeScript checks, the production build, and a fresh `npm audit --audit-level=high` passed; the audit reported zero vulnerabilities. The updated packages retain their MIT or BSD-3-Clause licenses and bundled notices, compatible with Pennyworth's MIT distribution.

The 2026-10-06 recurring-branch CI failure occurred at `npm audit --audit-level=high` after migrations, 279 unit tests, 42 integration tests, both TypeScript checks, and build had passed. [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) affects the locked `source-map-js` 1.2.1 used through PostCSS/Vite/Vitest. Updating that single transitive dependency to the compatible 1.2.2 patch cleared the audit with zero vulnerabilities; all 279 unit tests passed locally after the update. The package retains its BSD-3-Clause license and bundled notice, compatible with Pennyworth's MIT distribution. No manifest dependency ranges, application version, data contract, or CI audit threshold changed.

### Dependency maintenance follow-up

Planned for a separate change following the 0.9.0-alpha.1 release; repository automation is not configured yet:

- Add weekly Dependabot version-update PRs for npm and GitHub Actions, targeting `develop` for normal development updates.
- Group compatible patch/minor updates into small runtime and development-tool groups; keep paired Prisma packages aligned and major upgrades separate for review.
- Enable repository Dependabot alerts and security-update PRs. GitHub sends security fixes only to the default branch, so a `develop` target for version updates does not cover security maintenance of the default branch. Carry each accepted security correction to both maintained branches through the normal PR/release flow.
- Require passing CI and human review before merging dependency updates. Keep `npm audit --audit-level=high` enabled and add a scheduled audit of `develop` to detect new advisories even when no application change is pushed.

See [Dependabot version-update configuration](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates), [grouping](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/optimizing-pr-creation-version-updates), and [branch behavior](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/customizing-dependabot-prs). This is a maintenance plan, not a promise that future vulnerability reports cannot make CI fail.

## Integration tests

Set an empty or disposable PostgreSQL database separate from normal data:

```text
TEST_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/pennyworth_test?schema=public"
```

The default Compose stack creates only the database named by `POSTGRES_DB`; it does not automatically create `pennyworth_test`. Create the disposable test database or schema explicitly before running the suite. Use `localhost` when the test runner is on the host and the Compose service name `postgres` only when the runner is inside the Compose network. The value in `.env.example` is a template, not a ready-to-run test database.

Then run:

```bash
npm run test:integration
```

The runner refuses production, requires the database or schema name to contain `test`, applies every migration, and executes integration files serially. Reserved `integration-test-` records are cleaned after each test.

Coverage includes normal and investment balance effects, transaction constraints, cross-user ownership rejection, PostgreSQL report aggregation, restore rollback and full round-trip behavior, projection rebuilding, authentication redirects, login, CSRF, signed sessions, and category-parent ownership.

The 2026-07-18 review did not run this suite because `TEST_DATABASE_URL` was absent; the guard stopped before touching a database.

## Accessibility audit

Prepare the seeded app, run it, then execute:

```bash
npm run audit:a11y
```

The Playwright/axe-core script signs in and checks main authenticated routes in desktop and mobile Chromium. It treats accessibility violations, console/page errors, failed requests, CSP regressions, multiple page headings, and visible horizontal overflow as failures.

The last recorded sweep on 2026-07-18 covered 16 routes across both viewports without failures.

## Quick-entry dialog checks

Install the Chromium browser used by the existing Playwright dependency, then run:

```bash
npx playwright install chromium
npm run test:quick-entry
```

This command serves UTF-8 rendered transaction fixtures on a temporary loopback port and intercepts creation responses, so it needs no database, running app, or real financial data. It checks English/Italian desktop and 320-pixel mobile layouts in light/dark themes, empty/populated category/tag lists, initial focus, Escape/cancel behavior, immediate selection, literal user names, draft preservation, transaction-type compatibility, duplicate/network/session/CSRF/non-JSON failures, and repeated submission. For both categories and tags it also simulates persistence followed by a lost or truncated response, then retries: exactly one record persists, the draft stays unchanged until explicit **Use existing**, and recovery retains existing tags. Incompatible conflicts offer no selection; editing or reopening clears the old candidate. Playwright examines open, conflict, and error dialogs with axe; ordinary controls remain usable in a separate JavaScript-disabled fixture. CI runs this command after installing Chromium and before the full authenticated audit.

The 2026-10-05 issue #6 implementation passed 239 unit tests across 36 files, all 17 PostgreSQL/Fastify integration tests against the separate `pennyworth_issue6_test` database, both TypeScript checks, and the production build. The new integration scenario verifies actual creation, foreign-parent rejection, localized validation, duplicate races, minimal JSON responses, CSRF/session restrictions, escaped names, and persistence of the created references in a saved transaction. Eight browser fixtures passed the dialog checks with no axe violations or horizontal overflow, plus the JavaScript-disabled fallback. A full authenticated accessibility audit against a separately seeded app on port 3001 and the same test database passed all 17 routes in desktop/mobile viewports with zero violations, overflow, or browser failures. Wiki lint also passed. Windows Prisma migration diagnostics were initially empty; the successful integration run used the development container's configured credentials without printing them and changed only the database name to the disposable test database.

The same day's interrupted-response remediation passed 239 unit tests, all 18 PostgreSQL/Fastify integration tests, both TypeScript checks, the production build, and all eight expanded browser fixtures plus the JavaScript-disabled fallback. The additional integration test discards successful category/tag responses, retries with differing details, and verifies recovery of the same user-owned IDs, exactly one record per name, and unchanged stored settings, even when another user owns the same names. Its separate injected client address keeps the login rate-limit bucket independent of other scenarios. Browser regressions verify explicit recovery and preserved draft selections in both languages, themes, and viewports, with no axe violations or horizontal overflow. Live deployment and other browser engines were not exercised for this remediation.

## CI

The GitHub Actions workflow first lints the LLM wiki, then starts disposable PostgreSQL, applies migrations, prepares the audit user, and runs unit tests, guarded integration tests, application/test typechecks, build, high-severity dependency audit, and browser accessibility audit.

CI configuration is executable truth. When package scripts change, update the workflow and this page together.

## Performance dataset

An in-memory CSV-preview benchmark on 2026-10-02 used 1,000 uncategorized expense rows and 10,000 unmatched active rules. The original per-transaction parser took 7,393 ms; preparing terms once per preview reduced three subsequent runs to 380, 360, and 351 ms on the same host. This measures the actual CSV-preview function without database access, not the full PostgreSQL bulk workflow. Terms are held only for the current batch, so no cross-request rule cache is required.

Performance tools operate only on the reserved `performance@pennyworth.local` user and refuse production. Generate a dataset on macOS/Linux:

```bash
PERF_DATASET_CONFIRM=replace-performance-user \
PERF_TRANSACTION_COUNT=100000 \
PERF_RULE_COUNT=10000 \
PERF_RECURRING_COUNT=10000 \
npm run db:seed:performance
```

PowerShell:

```powershell
$env:PERF_DATASET_CONFIRM="replace-performance-user"
$env:PERF_TRANSACTION_COUNT="100000"
$env:PERF_RULE_COUNT="10000"
$env:PERF_RECURRING_COUNT="10000"
npm run db:seed:performance
```

`PERF_TRANSACTION_COUNT` accepts `1` through `1,000,000`. `PERF_RULE_COUNT` and `PERF_RECURRING_COUNT` accept `1` through `100,000`; their defaults match the supported 10,000-record automation reference size. `PERF_BATCH_SIZE` defaults to `1,000` and accepts at most `5,000`.

The supported bulk-workflow reference size is 100,000 transactions, 10,000 rules, and 10,000 recurring templates per user. Restore and CSV import use bounded 2,000-record database batches inside one atomic transaction with a 120-second transaction timeout and a 10-second connection wait budget. The timeout was selected after the full reference workflow completed in about 52 seconds on the documented local verification setup, leaving headroom for slower home-lab storage and processors. Treat a larger dataset as a capacity test rather than a supported deployment size until a benchmark records query count, elapsed time, and p95 duration on the target host.

Benchmark with:

```bash
npm run benchmark:performance
```

The benchmark warms each operation, then reports minimum, median, p95, maximum, and average duration plus measured SQL query count for balances, dashboard, statistics, pagination, and search. Enable query counting with `PERF_QUERY_COUNT=true`; compare results only with the same machine, database, dataset, and Node environment. Full CSV export is excluded unless `PERF_INCLUDE_FULL_EXPORT=true` because it is intentionally unbounded.

Measure the supported import and restore workflow against disposable users derived from the performance dataset:

```bash
PERF_BULK_BENCHMARK_CONFIRM=measure \
npm run benchmark:bulk
```

PowerShell:

```powershell
$env:PERF_BULK_BENCHMARK_CONFIRM="measure"
npm run benchmark:bulk
```

The bulk benchmark requires the seeded `performance@pennyworth.local` user, previews and persists a real CSV import into a disposable user, restores the performance user's own JSON backup in place, reports bytes, elapsed time, and SQL query count for each operation, verifies imported transactions plus every restored record family, and removes the disposable import user in a `finally` block. In-place restore preserves globally unique backup identifiers and remains atomic if benchmarking fails. For a smaller diagnostic run, reseed the reserved performance user with smaller count variables before running the benchmark. Enable `PERF_QUERY_COUNT=true` before starting the process to collect query counts.

## Related pages

- [`../architecture/data-and-financial-model.md`](../architecture/data-and-financial-model.md)
- [`../features/interface-and-accessibility.md`](../features/interface-and-accessibility.md)
- [`local-development.md`](local-development.md)
- [`deployment.md`](deployment.md)

## Sources

- [`package-manifest`](../sources.md#sourcepackage-manifest)
- [`application-source`](../sources.md#sourceapplication-source)
- [`test-suite`](../sources.md#sourcetest-suite)
- [`ci-workflow`](../sources.md#sourceci-workflow)
- [`release-0-9-0-alpha-1`](../sources.md#sourcerelease-0-9-0-alpha-1)
- [`operational-scripts`](../sources.md#sourceoperational-scripts)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`source-map-js-advisory`](../sources.md#sourcesource-map-js-advisory)
- [`dependabot-docs`](../sources.md#sourcedependabot-docs)
