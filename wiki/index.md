---
title: Pennyworth Wiki Index
type: index
status: current
updated: 2026-09-05
source_ids: [project-contract, application-source, llm-wiki-pattern]
tags: [index, navigation]
---

# Pennyworth Wiki Index

Read this page first. It catalogs every maintained page and gives agents a bounded route into the knowledge base.

## Operating layer

- [`README.md`](README.md) — overview, current thesis, and starting points.
- [`AGENTS.md`](AGENTS.md) — page schema and ingest/query/lint rules.
- [`sources.md`](sources.md) — source IDs, locations, authority, and coverage.
- [`raw/README.md`](raw/README.md) — policy for immutable imported sources.
- [`log.md`](log.md) — append-only record of wiki operations.

## Product

- [`product/product-brief.md`](product/product-brief.md) — product definition, user, scope, exclusions, and principles.
- [`product/status-and-roadmap.md`](product/status-and-roadmap.md) — implemented capabilities, verification evidence, current focus, and backlog.

## Architecture

- [`architecture/system-overview.md`](architecture/system-overview.md) — stack, module boundaries, request flow, query strategy, dates, and preferences.
- [`architecture/data-and-financial-model.md`](architecture/data-and-financial-model.md) — Prisma entities, ownership, money rules, transfers, reporting, and investments.
- [`architecture/security-and-privacy.md`](architecture/security-and-privacy.md) — authentication, sessions, request protection, database integrity, secrets, and deployment boundaries.

## Features

- [`features/transactions.md`](features/transactions.md) — transaction lifecycle, filters, pagination, CSV import/export, and duplicate handling.
- [`features/automation.md`](features/automation.md) — categories, tags, budgets, categorization rules, and recurring templates.
- [`features/investments.md`](features/investments.md) — assets, prices, activity, positions, valuation, and cash impact.
- [`features/interface-and-accessibility.md`](features/interface-and-accessibility.md) — server-rendered UI, themes, localization, navigation, mobile behavior, and audits.

## Operations

- [`operations/releases.md`](operations/releases.md) — Semantic Versioning, prerelease stages, release checks, tags, and version-system boundaries.
- [`operations/local-development.md`](operations/local-development.md) — prerequisites, environment, local database topologies, initialization, and scripts.
- [`operations/testing-and-performance.md`](operations/testing-and-performance.md) — unit, integration, accessibility, CI, performance data, and release verification.
- [`operations/deployment.md`](operations/deployment.md) — LAN production requirements, Compose profiles, updates, and troubleshooting.
- [`operations/backup-and-restore.md`](operations/backup-and-restore.md) — JSON and PostgreSQL backup/restore boundaries and procedures.
- [`operations/json-backup-format.md`](operations/json-backup-format.md) — version 9 JSON fields, relationships, conversion guidance, schema, and starter file.
- [`operations/podman.md`](operations/podman.md) — Podman setup, Compose lifecycle, rootless operation, reboots, and engine migration.

## Sources

- [`project-contract`](sources.md#sourceproject-contract)
- [`application-source`](sources.md#sourceapplication-source)
- [`llm-wiki-pattern`](sources.md#sourcellm-wiki-pattern)
