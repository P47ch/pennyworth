---
title: Pennyworth Source Map
type: source-map
status: current
updated: 2026-09-05
source_ids: [llm-wiki-pattern, project-contract]
tags: [sources, provenance]
---

# Pennyworth Source Map

Source IDs are stable handles used in page frontmatter and `## Sources` sections. Repository paths are relative to `wiki/`. A source may be mutable; Git history should pin the version when the repository is version-controlled.

## source:llm-wiki-pattern

- Location: [Andrej Karpathy's original LLM Wiki idea file](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- Kind: external primary source
- Authority: operating pattern for the knowledge-base structure
- Covers: source/wiki/schema layers, ingest/query/lint, index, and append-only log

## source:project-contract

- Location: [`../AGENTS.md`](../AGENTS.md)
- Kind: repository policy
- Authority: normative product, domain, security, architecture, and documentation intent
- Covers: goals, financial invariants, preferred stack, MVP scope, UX, security, versioned backup and license contract maintenance, tests, and code style

## source:license-policy

- Location: [`../LICENSE`](../LICENSE), [`../package.json`](../package.json), and [`../AGENTS.md`](../AGENTS.md#license-contract)
- Kind: repository policy
- Authority: Pennyworth license terms, copyright attribution, package identifier, and synchronization requirements
- Covers: MIT licensing, P47ch attribution, third-party compatibility, required notices, and public metadata synchronization

## source:package-manifest

- Location: [`../package.json`](../package.json)
- Kind: executable manifest
- Authority: current scripts and installed application/tooling dependencies
- Covers: authoritative application version, Node commands, Fastify/EJS/Prisma stack, tests, accessibility tools, and Chart.js

## source:release-policy

- Location: [`../AGENTS.md`](../AGENTS.md#release-version-contract), [`../package.json`](../package.json), and [`../CHANGELOG.md`](../CHANGELOG.md)
- Kind: repository policy and release history
- Authority: application version, pre-v1 increment rules, release procedure, compatibility notes, and published change history
- Covers: Semantic Versioning, prerelease stages, release checks, Git tags, changelog maintenance, and separation from backup-schema and database-migration versions

## source:database-schema

- Location: [`../prisma/schema.prisma`](../prisma/schema.prisma)
- Kind: executable schema
- Authority: current Prisma entities, fields, relations, indexes, and enums
- Covers: users, ledger, automation, investments, projections, and ownership relations

## source:migrations

- Location: [`../prisma/migrations/`](../prisma/migrations/)
- Kind: executable history
- Authority: applied PostgreSQL constraints and schema evolution
- Covers: transaction integrity, tenant integrity, investments, preferences, reporting indexes, and review fixes

## source:application-source

- Location: [`../src/`](../src/)
- Kind: executable source
- Authority: current HTTP, service, validation, rendering, configuration, session, and backup behavior
- Covers: runtime behavior across routes, services, libraries, views, and public assets

## source:finance-source

- Location: [`../src/finance/`](../src/finance/)
- Kind: executable source
- Authority: pure financial calculations
- Covers: balances, money conversion, monthly summaries, budgets, statistics, and investment positions

## source:query-source

- Location: [`../src/queries/`](../src/queries/)
- Kind: executable source
- Authority: read-heavy PostgreSQL aggregation and safe result conversion
- Covers: account balances, reporting, asset prices, and `bigint` boundaries

## source:interface-source

- Location: [`../src/views/`](../src/views/) and [`../src/public/`](../src/public/)
- Kind: executable presentation source
- Authority: current HTML structure, forms, responsive styling, and browser enhancements
- Covers: server-rendered pages, themes, navigation, charts, forms, and mobile layout

## source:test-suite

- Location: [`../tests/`](../tests/) and [`../scripts/a11y-audit.mjs`](../scripts/a11y-audit.mjs)
- Kind: executable verification
- Authority: tested behavior and regression coverage; passing status must be dated separately
- Covers: finance, configuration, CSV, backup, authentication, queries, integration boundaries, and accessibility

## source:ci-workflow

- Location: [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- Kind: executable automation
- Authority: current continuous-integration sequence and service configuration
- Covers: PostgreSQL test service, migrations, tests, build, audit, and browser checks

## source:container-definitions

- Location: [`../Dockerfile`](../Dockerfile), [`../compose.yml`](../compose.yml), and [`../deploy/`](../deploy/)
- Kind: executable deployment source
- Authority: images, services, health checks, ports, volumes, and startup commands
- Covers: Docker, Podman-compatible Compose, development, private-LAN HTTP production, and managed or externally managed PostgreSQL

## source:environment-template

- Location: [`../.env.example`](../.env.example)
- Kind: configuration template
- Authority: supported deployment variable names and safe placeholders
- Covers: database, sessions, administrator, currency, timezone, and application host/port settings

## source:operational-scripts

- Location: [`../scripts/`](../scripts/) and [`../prisma/seed.ts`](../prisma/seed.ts)
- Kind: executable operations
- Authority: integration guards, initial administration, seeding, performance data, and benchmarks
- Covers: database preparation, administrator password recovery, protected integration testing, synthetic datasets, and measurements

## source:podman-docs

- Location: [Podman Compose](https://docs.podman.io/en/stable/markdown/podman-compose.1.html), [Podman Machine](https://docs.podman.io/en/stable/markdown/podman-machine.1.html), and [restart policy](https://docs.podman.io/en/latest/markdown/options/restart.html)
- Kind: external primary sources
- Authority: current Podman provider, virtual-machine, rootless, and restart behavior
- Covers: Compose delegation, Windows/macOS machines, and reboot management

## Sources

- [`llm-wiki-pattern`](#sourcellm-wiki-pattern)
- [`project-contract`](#sourceproject-contract)
