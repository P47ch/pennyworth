---
title: Testing and Performance
type: verification
status: current
updated: 2026-09-16
source_ids: [package-manifest, test-suite, ci-workflow, operational-scripts, database-schema]
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

## Unit tests

Vitest covers money conversion, account balance effects, transfers, monthly summaries, category aggregation, budgets, recurrence, investments, configuration, CSV behavior, backup validation, authentication helpers, preferences, icons, and SQL query result adapters.

The last recorded review run on 2026-07-18 passed 90 tests in 16 files. Treat counts as dated evidence; `npm run test` is the current truth.

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

## CI

The GitHub Actions workflow first lints the LLM wiki, then starts disposable PostgreSQL, applies migrations, prepares the audit user, and runs unit tests, guarded integration tests, application/test typechecks, build, high-severity dependency audit, and browser accessibility audit.

CI configuration is executable truth. When package scripts change, update the workflow and this page together.

## Performance dataset

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
- [`test-suite`](../sources.md#sourcetest-suite)
- [`ci-workflow`](../sources.md#sourceci-workflow)
- [`operational-scripts`](../sources.md#sourceoperational-scripts)
- [`database-schema`](../sources.md#sourcedatabase-schema)
