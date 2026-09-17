---
title: Pennyworth Wiki Log
type: log
status: current
updated: 2026-09-17
source_ids: [llm-wiki-pattern, project-contract]
tags: [log, audit]
---

# Pennyworth Wiki Log

This file is append-only. New operations go at the bottom using the format defined in [`AGENTS.md`](AGENTS.md).

## [2026-07-19] transform | Established the Pennyworth LLM Wiki

Replaced the monolithic project documentation with a source map, operating schema, complete index, focused product/architecture/feature/operations pages, and deterministic lint workflow. Reconciled stale roadmap items against the current repository and preserved Docker and Podman operational knowledge.

## [2026-07-19] source-sync | Integrated the wiki contract with repository workflows

Updated the root agent contract and repository navigation to point at the new wiki schema and canonical pages. Added `wiki:lint` to package scripts and continuous integration so structural drift fails deterministically.

## [2026-07-19] lint | Validated the initial knowledge graph

Verified frontmatter, 15 registered source IDs, index coverage, internal links, orphan detection, and chronological log formatting across the transformed wiki.

## [2026-08-25] source-sync | Remediated project review findings

Documented primary-currency and monetary-range enforcement, repeatable-read JSON exports, durable CSV import idempotency receipts, and bounded concurrency-safe rule application alongside their schema, migration, service, and test changes.

## [2026-08-25] source-sync | Added external PostgreSQL deployment profile

Added a private-LAN HTTPS Compose profile that runs only Pennyworth and Caddy against an independently managed PostgreSQL server, with Docker and Podman setup, connectivity, ownership, security, migration, certificate, and backup guidance.

## [2026-08-25] source-sync | Simplified external PostgreSQL profile to HTTP

Removed Caddy from the external-database profile, published the production app directly with explicit insecure-cookie compatibility, and documented its LAN-only trust boundary, port binding, and unencrypted transport risk.

## [2026-08-25] source-sync | Removed Caddy deployment support

Removed the remaining Caddy configurations and Compose profiles, made both production profiles directly served LAN-only HTTP deployments, and reconciled setup, security, backup, Podman, architecture, and status documentation.

## [2026-08-25] source-sync | Removed obsolete proxy and TLS configuration

Removed unused trust-proxy and configurable secure-cookie plumbing after the deployment model was reduced to direct LAN-only HTTP, while retaining the effective session and CSRF protections applicable to that topology.

## [2026-08-25] lint | Removed redundant production image inputs

Confirmed strict compiler unused checks and direct dependency consumers, then removed the test-source copy from the production builder and the unnecessary lockfile copy from the runtime image.

## [2026-08-25] lint | Minimized the Docker build context

Excluded tests, wiki content, Compose definitions, repository agent metadata, CI configuration, and test-only TypeScript configuration that the production Dockerfile never copies.

## [2026-08-25] source-sync | Added safe production error pages

Added centralized exception and not-found handling that preserves safe HTTP status codes, logs unhandled details server-side, and renders only generic browser messages plus a request ID; added regression coverage for Prisma error-detail suppression.

## [2026-08-25] source-sync | Reconciled development Compose filename

Updated source-map and Podman references after the development Compose definition was renamed to `docker-compose.dev.yml`.

## [2026-08-26] source-sync | Reorganize Compose profiles

Renamed the default development profile to `compose.yml` so ordinary Compose commands discover it automatically, moved both production profiles under `deploy/`, excluded the renamed profile from production build contexts, and synchronized local-development, deployment, backup, Podman, and source-map references.

## [2026-08-27] source-sync | Focus the default dashboard

Reworked the dashboard into a quieter widget hierarchy with one net-worth overview, combined monthly cashflow, conditional budget and recurring attention items, recent activity, and limited category/account previews. Removed duplicate quick-action, investment-performance, and largest-expense sections; recorded persisted widget customization as follow-up scope.

## [2026-09-02] source-sync | Add monthly net-worth history

Added a statistics graph and accessible table for 12 month-end net-worth points split into cash and investment value. Documented opening-state assumptions, historical manual-price selection, investment-ledger replay, available browser controls, and the remaining richer performance scope.

## [2026-09-02] source-sync | Add category and account history graphs

Added statistics graphs and accessible tables for stacked monthly category spending and per-account month-end balances. Reused the category aggregate for the existing ranking and the account series for net-worth cash totals, and documented range controls, series selection, transfer and investment cash effects, and top-category grouping.

## [2026-09-02] source-sync | Add operator password recovery

Added an interactive Docker/Podman-compatible administrator password reset command that shares the application password policy, keeps credentials out of arguments and environment variables, and invalidates existing sessions. Added collapsed login guidance, tests, and deployment/security documentation.

## [2026-09-02] source-sync | Make password recovery Compose-independent

Changed login and runbook guidance to invoke the reset command directly with `docker exec` or `podman exec`, using the discovered application container name instead of depending on a particular Compose filename, project name, or working directory.

## [2026-09-03] query | Define isolated family-user scope

Recorded the product decision that one private home-lab installation may serve trusted family members while retaining `User` as the strict ownership boundary. Each user has independent financial data; public registration, internet-facing tenancy, and shared household ledgers remain excluded.

## [2026-09-03] source-sync | Add administrator-managed isolated users

Implemented private administrator provisioning for family members with roles, activation state, generated one-time temporary passwords, forced password replacement, starter taxonomy, session revocation, normalized email uniqueness, tenant-scoped mutation keys, and database-backed isolation coverage. Public registration and shared ledgers remain excluded.

## [2026-09-03] source-sync | Route password recovery by account role

Updated login recovery guidance so members first ask another application administrator for a temporary password, while the only administrator retains the interactive container-console recovery path.

## [2026-09-04] source-sync | Make category and tag identity visual

Replaced raw color and icon strings in taxonomy lists with compact visual treatments, added a validated keyboard-accessible Lucide category icon picker, and retained safe fallbacks for legacy unknown icon values.

## [2026-09-04] source-sync | Reuse category identity across the application

Applied the category icon-and-color label to transactions, recurring templates, rules, budgets, dashboard summaries, statistics, and CSV previews, and carried visual metadata through reporting aggregates while retaining text-only native selects.

## [2026-09-04] source-sync | Publish the JSON backup contract

Added a downloadable version 8 JSON Schema and importable starter file, linked them from Security, and documented spreadsheet conversion, fields, values, money and date representation, relationships, validation boundaries, and destructive restore behavior.

## [2026-09-04] source-sync | Make backup contract synchronization mandatory

Added a repository-level invariant requiring every backup-affecting implementation change to update the versioned schema, starter example, documentation, and tests together, with version increments and preservation rules for incompatible formats.

## [2026-09-04] source-sync | Add the user-avatar foundation

Added a persisted avatar key with initials as the safe default, a server-resolved avatar presentation, and an accessible header account panel linking preferences, security, and logout. Reserved local image-path support for a later set of built-in avatars and confirmed that interface preferences remain outside user-scoped JSON restore.

## [2026-09-04] source-sync | Add five built-in avatar portraits

Added five optimized local illustrated portraits, exposed them with initials through an accessible Preferences radio-card selector, and constrained persisted avatar keys to the application registry with a safe initials fallback.

## [2026-09-04] source-sync | Adopt the Terminal Clerk avatar roster

Replaced the initial portrait set with five distinct, locally bundled Terminal Clerk pixel-art characters: Auditor, Archivist, Operator, Courier, and Custodian. Updated their stable registry keys, localized labels, tests, and interface documentation while retaining initials as the default and safe fallback.

## [2026-09-04] lint | Reconcile documentation for public publication

Corrected README reporting and single-currency claims, removed obsolete TLS and secure-cookie references, clarified locally built container-image updates and disposable test-database setup, narrowed PostgreSQL compatibility to the verified baseline, and documented Pennyworth's pre-v1.0 status plus the latest publication-audit evidence.

## [2026-09-05] source-sync | Publish licensing and vulnerability-reporting policies

Released Pennyworth under the MIT License with P47ch as copyright holder, added a GitHub Private Vulnerability Reporting policy with pre-v1 support and safe-research boundaries, and linked both policies from the README and canonical security documentation.

## [2026-09-05] source-sync | Defer the repository security policy

Removed the pre-v1 `SECURITY.md` and its active documentation references because the self-hosted project does not yet need a formal reporting policy. Retained the implemented security and LAN-only deployment boundaries, and added a fundamental repository rule requiring the MIT license text, attribution, package metadata, public documentation, third-party compatibility, and notices to remain synchronized.

## [2026-09-05] source-sync | Establish the first application preview version

Established `0.8.0-alpha.1` as Pennyworth's first formally versioned public preview, made the package manifest authoritative, exposed the version in the authenticated interface, added a changelog, and documented Semantic Versioning, prerelease stages, release verification, immutable tags, and the independence of application, backup-schema, and database-migration versions.

## [2026-09-15] query | Accept the private HTTP residual risk and plan review remediation

Recorded the product decision to retain certificate-free HTTP as a low residual risk for a trusted home lab with authenticated VPN-only remote access, no public exposure, and interface or firewall isolation. Added a root action plan for the remaining project-review findings and documented the controls and reassessment triggers for the accepted transport boundary.

## [2026-09-15] source-sync | Implement review remediation controls

Added configured-currency view formatting, transactional category and account dependency checks, shared backup relationship validation, strict CSV minor-unit parsing, exact bigint-backed investment calculations, bounded bulk restore/import writes, explicit private-HTTP transport configuration, and the bcrypt UTF-8 byte-length password limit. Published backup schema version 9 while retaining version 8 artifacts for historical exports.

## [2026-09-15] source-sync | Close concurrency and bulk-capacity remediation gaps

Added parent-row `FOR KEY SHARE` locking to category and investment-dependent writes, kept type changes on `FOR UPDATE`, and added deterministic PostgreSQL race coverage for category/transaction and account/holding relationships. Increased bulk workflow batches to 2,000 rows, applied batching to every restore record family, added measured transaction timeout settings, and added a disposable CSV-import/JSON-restore benchmark command.

## [2026-09-16] source-sync | Validate supported bulk backup and restore capacity

Removed large relation-include parameter lists from JSON export, eliminated repeated restore payload parsing and validation, expanded the performance seed to 100,000 transactions plus 10,000 rules and 10,000 recurring templates, and made the benchmark perform an identifier-safe in-place restore of the reserved performance user. The full workflow completed with bounded query counts; the measured restore took about 52 seconds, so the atomic bulk transaction budget is 120 seconds to retain operational headroom on slower home-lab hardware.

## [2026-09-16] source-sync | Upgrade cookies when HTTPS is enabled

Reissued valid CSRF and session cookies with the active transport attributes so switching an existing deployment to `TRANSPORT_SECURITY=https` upgrades previously stored private-HTTP cookies without extending the signed session lifetime. Synchronized the canonical security description for both cookie types.

## [2026-09-17] source-sync | Keep the descriptive development Compose filename

Updated the container source map and local Docker and Podman commands to use `compose.dev.yml` explicitly, preserving the descriptive development-profile filename without relying on Compose's default filename discovery.
