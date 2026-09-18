---
title: System Overview
type: architecture
status: current
updated: 2026-09-18
source_ids: [project-contract, package-manifest, application-source, query-source, interface-source]
tags: [architecture, fastify, server-rendering]
---

# System Overview

Pennyworth is a single TypeScript web application backed by PostgreSQL. It uses Fastify, server-rendered EJS, Prisma, plain CSS, and limited browser JavaScript. Chart.js is currently used only for the interactive statistics visualization; the rest of the application follows a traditional request/response model.

## Runtime structure

```text
Browser
  -> Fastify route and form parsing
  -> service/use-case validation
  -> Prisma or focused PostgreSQL query
  -> pure finance calculation where needed
  -> EJS HTML response
```

`src/server.ts` loads validated configuration, registers cookies, form parsing, rate limiting, static assets, and EJS, installs security/session hooks, registers routes, and starts the server. The session hook validates the account once and stores the current user on the request for tenant-scoped route services, avoiding a second identity query. `/healthz` reports process health; `/readyz` checks database readiness.

When explicitly enabled, `src/services/updateCheck.ts` runs one process-local, non-blocking GitHub Release metadata check after Fastify is ready. It uses a bounded response, timeout, ETag cache, and an unref'ed timer; it never participates in readiness, authentication, request rendering, or financial operations. Each replica has its own memory cache and timer, so deployments with multiple replicas make one request per configured interval per replica.

## Module boundaries

```text
src/
  server.ts       startup, plugins, hooks, route registration
  routes/         HTTP endpoints, form parsing, response rendering
  services/       use-case orchestration, ownership checks, Prisma writes
  queries/        read-heavy PostgreSQL aggregation and result adapters
  finance/        pure money, balance, budget, statistics, investment logic
  views/          EJS templates and partials
  public/         CSS and small browser scripts
prisma/
  schema.prisma   data model
  migrations/     PostgreSQL evolution and integrity constraints
scripts/          admin, integration, accessibility, and performance tooling
tests/            unit and guarded integration coverage
```

Transaction routes are further split into CRUD, import, export, and shared parsing modules behind `src/routes/transactions.ts`. Routes do not write through Prisma directly; confirmed CSV imports use the normal transaction service and persist atomically.

## Read and write paths

Writes favor explicit service functions. Services validate user ownership and domain shape before Prisma writes, while PostgreSQL constraints independently reject invalid direct writes.

Read-heavy summaries avoid replaying complete ledgers in Node:

- `src/queries/accountBalances.ts` aggregates opening balances, cash transactions, and investment cash effects in PostgreSQL.
- `src/queries/reporting.ts` groups monthly cashflow and category/tag spending.
- `src/queries/latestAssetPrices.ts` selects one latest price per asset.
- Query adapters convert PostgreSQL `bigint` only after checking JavaScript safe-integer bounds.

Investment positions and per-entry realized gains are rebuildable database projections. They bound dashboard, holdings, and activity reads while keeping investment activity authoritative.

## Dates and time zones

Accounting dates are strict date-only values normalized to UTC midnight. Financial grouping uses UTC getters and inclusive-start/exclusive-end month ranges. `APP_TIME_ZONE` selects the user's current calendar date and month, preventing a local Node process and a UTC container from disagreeing near midnight.

## Rendering and preferences

The app renders usable HTML on the server. Browser scripts add targeted behavior such as navigation state, chart controls, file-to-text CSV handling, and immediate theme preview.

The `User` record stores language, theme, hidden navigation items, and session/projection versions. English is the translation fallback. Static template content is localized before EJS compilation; user-authored values are not translated. Lucide SVG icons are rendered server-side through an approved icon helper so no browser icon runtime or broader script policy is needed.

## Deployment shape

The same image runs under Docker or Podman. Compose profiles cover development, private-LAN HTTP with managed PostgreSQL, and private-LAN HTTP backed by an independently managed PostgreSQL server. Production startup applies migrations, initializes the configured administrator idempotently, and starts the compiled server. See [`../operations/deployment.md`](../operations/deployment.md).

## Related pages

- [`data-and-financial-model.md`](data-and-financial-model.md)
- [`security-and-privacy.md`](security-and-privacy.md)
- [`../features/interface-and-accessibility.md`](../features/interface-and-accessibility.md)
- [`../operations/testing-and-performance.md`](../operations/testing-and-performance.md)

## Sources

- [`project-contract`](../sources.md#sourceproject-contract)
- [`package-manifest`](../sources.md#sourcepackage-manifest)
- [`application-source`](../sources.md#sourceapplication-source)
- [`query-source`](../sources.md#sourcequery-source)
- [`interface-source`](../sources.md#sourceinterface-source)
