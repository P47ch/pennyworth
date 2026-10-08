---
title: Pennyworth Source Map
type: source-map
status: current
updated: 2026-10-08
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

- Location: [`../package.json`](../package.json) and [`../package-lock.json`](../package-lock.json)
- Kind: executable manifest
- Authority: current scripts and installed application/tooling dependencies
- Covers: authoritative application version, Node commands, Fastify/EJS/Prisma stack, tests, accessibility tools, and Chart.js

## source:release-policy

- Location: [`../AGENTS.md`](../AGENTS.md#release-version-contract), [`../package.json`](../package.json), and [`../CHANGELOG.md`](../CHANGELOG.md)
- Kind: repository policy and release history
- Authority: application version, pre-v1 increment rules, release procedure, compatibility notes, and published change history
- Covers: Semantic Versioning, prerelease stages, release checks, Git tags, changelog maintenance, and separation from backup-schema and database-migration versions

## source:release-0-9-0-alpha-1

- Location: [GitHub prerelease v0.9.0-alpha.1](https://github.com/P47ch/pennyworth/releases/tag/v0.9.0-alpha.1), [tagged main commit](https://github.com/P47ch/pennyworth/commit/3a6aeaa27ea71599e1b3d410714e4312286bc3a8), [main PR #16](https://github.com/P47ch/pennyworth/pull/16), [develop PR #17](https://github.com/P47ch/pennyworth/pull/17), and [main CI run](https://github.com/P47ch/pennyworth/actions/runs/37801932900)
- Kind: published repository release and dated verification, inspected on 2026-10-08
- Authority: GitHub publication metadata, branch merge history, CI outcome, and annotated tag target
- Covers: non-draft alpha prerelease published at 15:50:41 UTC, release commit preserved in main and develop, successful CI on the tagged main commit, and release notes with upgrade and compatibility requirements

## source:database-schema

- Location: [`../prisma/schema.prisma`](../prisma/schema.prisma)
- Kind: executable schema
- Authority: current Prisma entities, fields, relations, indexes, and enums
- Covers: users, ledger, automation, investments, projections, and ownership relations

## source:migrations

- Location: [`../prisma/migrations/`](../prisma/migrations/)
- Kind: executable history
- Authority: applied PostgreSQL constraints and schema evolution
- Covers: transaction integrity, tenant integrity, investments, preferences, reporting indexes, literal-rule matching compatibility, and review fixes

## source:application-source

- Location: [`../src/`](../src/)
- Kind: executable source
- Authority: current HTTP, service, validation, rendering, configuration, session, and backup behavior
- Covers: runtime behavior across routes, services, libraries, views, and public assets

## source:issue-6

- Location: [GitHub issue #6: Creazione rapida di categorie e tag](https://github.com/P47ch/pennyworth/issues/6)
- Kind: user-reported enhancement request, inspected on 2026-10-05
- Authority: requested transaction-entry workflow; repository code remains authoritative for current behavior
- Covers: creating a missing category or tag without leaving an in-progress transaction, with a proposed quick-add dialog

## source:issue-8

- Location: [GitHub issue #8: Giroconti ricorrenti fissi e variabili](https://github.com/P47ch/pennyworth/issues/8)
- Kind: user-reported enhancement request, inspected on 2026-10-05
- Authority: requested recurring-transfer workflow; repository code remains authoritative for current behavior, the approved implementation uses target-balance replenishment
- Covers: fixed and variable recurring transfers, weekly account replenishment using a Satispay example, and monthly account activity visibility

## source:issue-8-fees

- Location: direct user clarification in the current Codex chat on 2026-10-05, recorded in [`log.md`](log.md)
- Kind: primary user requirement
- Authority: optional top-up fees and choosing source or destination as the fee-paying account are requested scope; repository code defines implemented accounting and workflow
- Covers: optional costs of replenishing an account, occasions where a top-up is free, and a fee-account selector limited to the transfer's source or destination

## source:issue-8-help

- Location: direct user clarification in the current Codex chat on 2026-10-05, recorded in [`log.md`](log.md); interaction reference is [`../src/views/partials/rules-help.ejs`](../src/views/partials/rules-help.ejs)
- Kind: primary user requirement with an existing application UI reference
- Authority: Rules-style help for the expanded Recurring page is requested scope; repository code remains authoritative for what is implemented
- Covers: accessible localized in-page recurring help, explanation of amount modes and fee-account choices, and keeping forms understandable as the feature grows

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

- Location: [`../tests/`](../tests/), [`../scripts/a11y-audit.mjs`](../scripts/a11y-audit.mjs), [`../scripts/quick-taxonomy-browser.ts`](../scripts/quick-taxonomy-browser.ts), and [`../scripts/recurring-browser.ts`](../scripts/recurring-browser.ts)
- Kind: executable verification
- Authority: tested behavior and regression coverage; passing status must be dated separately
- Covers: finance, configuration, CSV, backup, authentication, queries, integration boundaries, accessibility, and quick-entry dialog behavior including interrupted-response recovery, and recurring form/help behavior

## source:ci-workflow

- Location: [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- Kind: executable automation
- Authority: current continuous-integration sequence and service configuration
- Covers: PostgreSQL test service, migrations, tests, build, audit, and browser checks

## source:container-definitions

- Location: [`../Dockerfile`](../Dockerfile), [`../compose.dev.yml`](../compose.dev.yml), and [`../deploy/`](../deploy/)
- Kind: executable deployment source
- Authority: images, services, health checks, ports, volumes, and startup commands
- Covers: Docker, Podman-compatible Compose, development with bind-mount file polling, private-LAN HTTP production, and managed or externally managed PostgreSQL

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

## source:owasp-password-storage

- Location: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- Kind: external security guidance
- Authority: KDF selection and work-factor guidance
- Covers: the scrypt fallback configuration used for encrypted backup passphrases

## source:node-crypto

- Location: [Node.js Crypto documentation](https://nodejs.org/api/crypto.html)
- Kind: external primary documentation
- Authority: Node cryptographic API behavior
- Covers: `scrypt`, `randomBytes`, AES-GCM authentication tags, and authenticated additional data

## source:fastify-multipart

- Location: [@fastify/multipart](https://github.com/fastify/fastify-multipart)
- Kind: external primary documentation and dependency
- Authority: bounded multipart parsing behavior and dependency licensing
- Covers: single-file upload limits, in-memory parsing, and the MIT-licensed Fastify multipart plugin

## source:github-rest-releases

- Location: [GitHub REST API — Releases](https://docs.github.com/en/rest/releases/releases)
- Kind: external primary documentation
- Authority: public Releases endpoint, conditional request, and rate-limit response behavior
- Covers: optional Pennyworth update-check request and release metadata boundary

## source:source-map-js-advisory

- Location: [GitHub advisory GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
- Kind: reviewed security advisory
- Authority: affected source-map-js versions and patched version
- Covers: indexed source-map denial of service through 1.2.1 and the 1.2.2 correction

## source:dependabot-docs

- Location: [Configuring Dependabot version updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates), [Optimizing update pull requests](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/optimizing-pr-creation-version-updates), and [Customizing Dependabot pull requests](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/customizing-dependabot-prs)
- Kind: external primary documentation
- Authority: Dependabot scheduling, grouping, and branch behavior
- Covers: weekly version checks, compatible-update groups, and security updates targeting only the default branch

## Sources

- [`llm-wiki-pattern`](#sourcellm-wiki-pattern)
- [`project-contract`](#sourceproject-contract)
