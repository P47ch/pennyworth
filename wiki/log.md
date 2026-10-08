---
title: Pennyworth Wiki Log
type: log
status: current
updated: 2026-10-07
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

## [2026-09-17] source-sync | Patch Fastify and Vitest security advisories

Updated Fastify and Vitest to their patched compatible releases, refreshed the locked dependency graph, and recorded successful unit tests, application and test typechecks, production build, wiki lint, and a zero-vulnerability npm audit.

## [2026-09-17] source-sync | Define the Git branch workflow

Established `main` as the stable release branch and `develop` as the integration branch, with short-lived `feature/*`, `fix/*`, and `chore/*` branches targeting `develop` and release or hotfix branches merged back into both long-lived branches.

## [2026-09-18] source-sync | Add password-protected user backups

Added version-1 `.pwb` envelopes around the unchanged user-scoped JSON backup contract, using fixed OWASP scrypt fallback parameters, AES-256-GCM authenticated metadata, bounded in-memory upload parsing, generic decryption failures, and a short-lived preview-bound confirmation token. Documented the private-HTTP passphrase limitation, recovery boundaries, test vector, and MIT-compatible multipart dependency; JSON schema version 9 and its starter file remain unchanged.

## [2026-09-18] source-sync | Harden encrypted backup confirmation and passphrases

Preserved original uploaded UTF-8 bytes across preview confirmation with bounded Base64url transport, enforced a 12-character minimum only for new encrypted exports, and added a shared bounded KDF gate. Kept malformed encrypted candidates in the generic decrypt-failure category and routed unexpected export failures through the generic server error handler rather than exposing backend messages.

## [2026-09-18] source-sync | Make Git Flow branch names explicit

Clarified that all development branches use Git Flow prefixes with lowercase kebab-case suffixes and no agent or tool-specific namespace.

## [2026-09-18] source-sync | Add optional administrator update notification

Added an opt-in, process-local GitHub Release metadata check with SemVer channel filtering, strict response validation, bounded network behavior, cache/ETag handling, and an administrator-only passive interface. No database migration or user backup contract change was required because update state remains process memory only.

## [2026-10-02] source-sync | Resolve rule matching and automatic categorization for issue 7

Added a shared comma-alternative matcher with quoted literal phrases, automatic application to new uncategorized expenses and recurring generation, explicit-category protection including CSV imports, duplicate-safe tag merging, retained validation-error form values, and localized one-time save feedback. Added the native question-mark help control and persistent form guidance, and stopped silently reusing a previous quick-entry category. Published JSON backup schema/starter version 10 and a data migration preserving historical literal matching; version 8 and 9 artifacts remain unchanged, and restore does not rerun categorization rules. Updated canonical automation, transaction, interface, security, backup, product-status, and source pages plus unreleased upgrade notes. Unit tests, application/test typechecks, build, Prisma validation, and wiki lint passed; PostgreSQL integration execution requires an explicit disposable `TEST_DATABASE_URL`.

## [2026-10-02] lint | Verify rule automation and backup compatibility

Validated 206 unit tests across 35 files, both TypeScript checks, production build, Prisma schema, wiki links, and version-10 starter conformance to its published JSON Schema. Targeted rendered Rules fixtures passed desktop/mobile English/Italian light/dark browser checks, keyboard/outside-click dismissal, and native details operation without JavaScript at 320 pixels. Fixed the mobile help panel's keyboard-focusable scroll region after axe identified it. The guarded integration runner refused to start without `TEST_DATABASE_URL`; no configured database was changed. Historical version 8/9 schemas and examples remain untouched, and final branch `feature/issue-7-rule-automation` follows the repository's Git Flow convention.

## [2026-10-02] source-sync | Fix inert-rule backup compatibility and repeated bulk parsing

Preserved historical whitespace-only and quoted whitespace-only rules as inert backup records regardless of active state, while retaining strict rule-form validation. Updated the unpublished version-10 schema description and starter, JSON contract and recovery documentation, automation behavior, and unreleased notes; historical schema/example artifacts and application version remain unchanged. Added regression tests covering active/inactive legacy restore, export, and reimport across spaces, tabs, and quoted line breaks, plus deterministic preparation-count checks for CSV and existing-expense previews. Prepared matching terms once per batch without retaining a cache across requests. All 211 unit tests, application/test TypeScript checks, and the production build passed. The actual CSV-preview benchmark with 1,000 uncategorized rows and 10,000 unmatched rules improved from 7,393 ms to 351–380 ms. Added a PostgreSQL backup regression; integration execution stopped at its safety guard because `TEST_DATABASE_URL` was unset.

## [2026-10-02] lint | Verify rule-review fixes and published backup examples

Wiki lint passed with 22 pages and 21 source IDs. Validated the version-10 starter and representative inert-rule variants against the JSON Schema 2020-12 structure using the existing Ajv runtime. The starter also passes the authoritative importer regression test. Reviewed the final matching and backup paths, documentation references, and diff whitespace checks; superseded version-8/9 artifacts were preserved.

## [2026-10-02] source-sync | Preserve literal labels in transaction notices

Replaced sequential translation substitutions with a single callback-based pass so dollar sequences and placeholder-shaped rule, category, and tag names retain their exact text. Missing or inherited values leave placeholders unchanged. Added English/Italian interpolation regressions and a signed-cookie notice regression; three new cases reproduced the bug before the fix. All 215 unit tests and both application/test TypeScript checks passed. Updated the canonical localization page and unreleased changelog.

## [2026-10-02] source-sync | Localize rule validation errors

Updated Add rule and Edit rule to translate server-side validation messages before HTML-escaped rendering. Added 16 regression cases covering all four matching-parser errors in both forms and both interface languages; the eight Italian cases reproduced the review finding before the fix. All 20 Rules view tests and the test TypeScript check passed. Updated the canonical localization page and unreleased changelog.

## [2026-10-02] source-sync | Add quick rule activation and refine help examples

Added localized Enable/Disable form buttons to the rule list with rule-specific accessible names and the existing CSRF protection. State updates are scoped to the current user, set the requested value rather than inverting stale state, and preserve matching settings, tags, and order; saved transactions are not recategorized. Added a PostgreSQL/Fastify regression covering state changes, repeated submissions, access boundaries, unchanged settings, and future matching. Removed the help icon's filled background and outer border while retaining its 44-pixel target and keyboard focus outline. Changed field and localized help examples to Netflix, Spotify, and Amazon Prime. Updated canonical automation, interface, and product status pages alongside the unreleased changelog.

## [2026-10-02] lint | Verify rule-list activation against disposable PostgreSQL

Passed all 231 unit tests, both TypeScript checks, the production build, and all 16 PostgreSQL/Fastify integration tests. Created a separate `pennyworth_rule_test` database in the local Docker PostgreSQL 16 service and used the guarded integration runner; all 25 migrations applied, including the literal-rule migration. The new activation scenario verifies CSRF rejection, malformed state rejection, cross-user denial, repeated requested states, unchanged settings/tags/order, and future matching without changing saved expenses. Eight rendered Rules fixtures passed desktop/mobile English/Italian light/dark checks, including 320-pixel native controls and localized active/inactive actions. Updated product verification evidence to distinguish the earlier unavailable database from this successful run.

## [2026-10-02] source-sync | Repair Docker bind-mount server reload

The live development app served updated Rules templates while its original server process retained the old route table: an authenticated invalid-state POST to the new activation endpoint returned 404 instead of the expected 400. Enabled the installed Chokidar watcher's polling environment settings in the development Compose profile at a 300-millisecond interval and documented app-only recreation. This aligns server module reloads with template updates across Docker Desktop bind mounts. The production profiles and database format are unchanged.

## [2026-10-02] lint | Verify live rule buttons and development reload

Recreated only the app container with polling enabled. The authenticated live route probe now returns the expected 400 for invalid state. Headless Chromium created a temporary rule, clicked Disable and Enable, and verified both actions returned to `/rules` with the correct requested state; the temporary rule was then removed. A source timestamp change produced a confirmed `tsx` restart in Docker logs, followed by successful browser checks. Docker Compose configuration validation and wiki lint passed.

## [2026-10-05] source-sync | Explain development file-watcher settings

Expanded the local-development runbook with a dedicated Development file watching section naming `CHOKIDAR_USEPOLLING` and `CHOKIDAR_INTERVAL`, their configured values, the Docker Desktop bind-mount problem they address, interval tradeoffs, and how to edit and apply the settings. Clarified that the current Compose values are fixed in `app.environment`, require no additional `.env` entries, and apply to the development watcher. Added app-only recreation and log verification commands, and updated the wiki index description.

## [2026-10-05] source-sync | Make encrypted-backup tampering tests deterministic

Investigated failed GitHub Actions run `37290967655`: the ciphertext tampering test replaced its first Base64 character with `A`, leaving the encrypted envelope unchanged whenever random ciphertext already began with that character. Added a fixed valid envelope starting with `A` and reproduced the failed rejection deterministically before correcting the shared mutation helper. Ciphertext, tag, salt, and nonce tests now flip a decoded bit and preserve canonical Base64 and field lengths. All 232 unit tests and the test TypeScript check passed. Updated the canonical testing page and unreleased changelog; application encryption and backup contracts retain their existing behavior.

## [2026-10-05] source-sync | Patch dependencies exposed by the CI audit

GitHub Actions run `37292247421` passed the corrected encryption tests, PostgreSQL integration tests, typechecks, and build, then failed the high-severity dependency audit. Raised the Fastify minimum to 5.12.5 and refreshed only the affected lockfile packages: Fastify 5.12.5, `fast-uri` 3.1.8/4.2.1, and `brace-expansion` 2.1.7/5.0.12. Verified the updated packages retain compatible MIT or BSD-3-Clause licenses and their bundled notices. All 232 unit tests, 16 PostgreSQL/Fastify integration tests against the disposable `pennyworth_rule_test` database, both TypeScript checks, and the production build passed; a fresh audit reported zero vulnerabilities. Updated the canonical testing page and unreleased changelog. Application and backup schema versions remain unchanged for this development fix.

## [2026-10-05] source-sync | Capitalize and localize visible type labels

Addressed issue #5 with a shared presentation formatter for account, category, transaction, asset, and investment activity types. Dropdowns, edit selections, badges, CSV previews, dashboard/statistics summaries, and investment allocation labels use translated sentence case, readable spaces, and the ETF acronym. Storage identifiers, submitted values, badge classes, CSV/backup contracts, and user-authored names retain their existing meaning. Updated the canonical interface page, wiki index, and unreleased changelog. All 232 unit tests, both TypeScript checks, the production build, and wiki lint passed. Additional English/Italian rendered category create/edit checks verified labels, unchanged option values, selected state, literal user names, compound account types, and ETF; all 41 EJS templates compiled. Read-only browser checks confirmed live Docker category create/edit pages, account and asset labels, and investment allocation/position labels.

## [2026-10-05] query | Analyze issue #6 quick category and tag creation

Read the open enhancement request and traced transaction templates, taxonomy routes/services, Prisma uniqueness, transaction ownership/type checks, browser enhancements, localization, and global request guards. Recorded the current limitation and a clearly planned recommendation in the canonical transaction page: manual-entry dialogs, shared creation validation, explicit JSON endpoints, draft preservation, immediate selection, duplicate/error handling, and targeted acceptance tests. Added issue provenance, index navigation, and a roadmap reference. The recommendation preserves existing category/tag and backup contracts and adds no dependency. No application implementation, release version, or GitHub issue state was changed.

## [2026-10-05] source-sync | Implement issue #6 quick category and tag creation

Added native Add category/Add tag dialogs to manual transaction entry, with shared taxonomy validation and authenticated CSRF-protected JSON creation endpoints. Successful creation selects the new record without clearing the draft or other tags; cancellation, localized validation/duplicate errors, session redirects, malformed responses, and network errors preserve the page. Category choices match transaction type, transfers keep categories unavailable, and explicit categories retain the existing rule boundary. Added bounded requests, token refresh with explicit retry, keyboard focus handling, responsive themes, and optional parent/color/icon details. Added unit and PostgreSQL/Fastify regressions plus a database-free Playwright/axe command wired into CI after Chromium installation. Updated canonical feature, architecture, interface, testing, development, and status pages and the unreleased changelog. No dependency, migration, backup contract, or release version changed. Validation passed 239 unit tests, 17 integration tests against `pennyworth_issue6_test`, both TypeScript checks, the production build, and eight localized desktop/mobile/theme dialog fixtures plus the no-JavaScript fallback.

## [2026-10-05] lint | Verify quick-entry documentation and full application accessibility

Reviewed current feature claims against the implementation, replaced the issue #6 planned analysis with implemented behavior, preserved its earlier query log entry, and synchronized source provenance, roadmap, architecture, interface, commands, CI, and unreleased notes. Wiki lint passed with 22 pages and 22 source IDs; diff whitespace checks passed with CRLF-aware checking. The full authenticated accessibility audit used a separately seeded app on port 3001 and `pennyworth_issue6_test`: all 17 routes passed desktop/mobile checks with zero axe violations, horizontal overflow, console/page errors, or failed requests. Dialog fixtures separately verify the open/error states and type/selection behavior.

## [2026-10-05] source-sync | Align the quick category creation control

Responded to the transaction-entry screenshot showing a tall Add category label row and a dropdown out of alignment with Account. Moved category creation to a 44-pixel plus button beside the dropdown, retained its localized accessible name and tooltip, and matched the label spacing and control font size to neighboring fields. Kept a visible keyboard focus outline and a full-width dropdown without JavaScript. Added a closed quick-entry screenshot to the existing browser verification tool and updated the canonical interface guidance; creation behavior is unchanged.

## [2026-10-05] source-sync | Recover quick taxonomy after interrupted creation responses

Addressed the confirmed reliability finding where a persisted category/tag remained unavailable after its creation response was lost and retry hit name uniqueness. HTTP 409 responses now include the minimal existing record scoped to the authenticated user and trimmed name. Dialogs offer localized Use existing with a saved-details explanation, check category compatibility before offering and selecting, and clear stale recovery candidates when fields change or the dialog reopens. Explicit recovery preserves transaction fields and existing tags; duplicate requests never overwrite saved details. Added persisted-but-lost/truncated browser regressions for both record types and a PostgreSQL/Fastify regression that discards success responses and verifies exactly one record, same-user IDs despite other users' matching names, and unchanged stored settings. Corrected fixture UTF-8 metadata and isolated the new integration login's injected client address from the shared rate-limit bucket. Validation passed 239 unit tests, all 18 integration tests against the separate `pennyworth_issue6_test` database, both TypeScript checks, the production build, and eight expanded browser/axe fixtures plus the JavaScript-disabled fallback. Updated canonical transaction, interface, architecture, verification, status, provenance, index, and unreleased changelog guidance. No dependency, migration, backup format, or release version changed.

## [2026-10-05] query | Analyze issue #8 fixed and variable recurring transfers

Read the open enhancement request and traced recurring templates, route/form validation, generation concurrency, account balance queries, transfer reporting, PostgreSQL constraints, and version-10 backup artifacts. Recorded the implemented fixed-monthly baseline and clearly planned recommendations in the canonical automation page: weekly recurrence, target-balance versus period-spending semantics, manual calculated-amount preview/confirmation, dated ledger calculations, explicit zero-amount skipping, occurrence-bound retries, and migration/backup compatibility requirements. Flagged a dedicated monthly account summary as additional reporting scope. Added issue provenance, navigation, and a roadmap reference. Existing recurring, finance, account-balance-query, and statistics suites passed 32 tests across four files. No application implementation, database migration, backup format, release version, or GitHub issue state was changed.

## [2026-10-05] query | Include top-up fees in issue #8

The user clarified that topping up accounts, including accounts such as Satispay, may incur a small fee rather than always being free. Extended the planned recurring-transfer analysis with a separate fee expense, source-paid versus destination-deducted accounting, a target balance after fees, optional presets with occurrence-specific zero/amount confirmation, checked totals, atomic generation and retry protection, transfer/fee association and correction requirements, and migration/backup round-trip coverage. Recorded the direct clarification as a source and synchronized roadmap/navigation. Provider tariffs were not inferred. No application implementation or published data contract changed.

## [2026-10-05] query | Clarify the top-up fee account selector

The user confirmed that the fee-paying account choice means the transfer's source or destination. Kept the planned selector limited to those two roles, proposed source as its default, and specified deriving the expense account from the validated transfer so account edits preserve the selected role. Added acceptance coverage for both debit choices and invalid roles, and synchronized the clarification source. No third-account option, application implementation, or published data contract was added.

## [2026-10-05] query | Require Rules-style help for Recurring

The user requested help like Rules as part of the more complex Recurring page. Inspected the Rules help partial, native-details styling, browser dismissal enhancement, and current recurring templates. Added a clearly planned requirement for question-mark help on Recurring and Edit recurring, covering schedules, supported amount modes, source/destination fee examples, preview/confirmation/skipping, and reporting. Specified English/Italian text, field hints, mobile/keyboard/no-JavaScript behavior, draft preservation, and publishing guidance only alongside the behavior it explains. Synchronized canonical automation/interface pages, provenance, navigation, and roadmap. This turn updates the issue analysis; no application help UI or recurring feature was implemented.

## [2026-10-05] source-sync | Implement issue #8 recurring top-ups and requested test-container setting

Implemented the approved Recurring rework with weekly/monthly scheduling, fixed amounts or target-balance replenishment through the occurrence's UTC date, optional fee presets and per-occurrence overrides, and a fee account limited to source or destination. Targets are reached after fees. Principal transfers and separate linked expense fees generate atomically with schedule advancement, signed occurrence/revision/amount confirmation, serializable conflict retries, stale/repeated-submission protection, and explicit zero-top-up skipping. Conditional PostgreSQL constraints enforce template modes and transfer-fee relationships. Linked structural edits are guarded and deletion explains cascade versus keeping the principal. Added English/Italian Rules-style help, field hints, shared forms, preview breakdowns, no-JavaScript operation, mobile styling, and a transfer badge contrast correction.

Published backup schema/starter version 11 with weekly/target/fee fields and transaction links; preserved all historical artifacts and versions 1–10 restore as fixed monthly templates without fee presets. Updated canonical data, architecture, security, feature, backup, deployment, verification, status, navigation, provenance, README, CI, and unreleased changelog guidance alongside the implementation. Earlier query entries remain historical; the feature synthesis now describes current behavior. No dependencies or application release version changed.

Verification passed 253 unit tests across 37 files, all 30 integration tests in the separate `pennyworth_issue8_test` database with all 26 migrations, both TypeScript checks, production build, Prisma validation, and wiki lint. Thirty recurring browser configurations passed mobile/desktop English/Italian light/dark, keyboard, draft-preservation, accessibility, and no-JavaScript checks; inspected mobile screenshots. Current JSON Schema accepted the starter, actual export, and legacy-normalized export; legacy settings and linked round-trips were verified. The running test container passed all 17 authenticated routes in desktop/mobile viewports and a live preview/help/zero-top-up check using a temporary isolated user removed afterward.

At the user's explicit request, set `UPDATE_CHECK_ENABLED=true` in the ignored environment file used by the existing `pennyworth-issue7` test Compose stack, recreated only its app service, and verified the migration applied. The two containers were stopped during the intervening task pause; on Continue, started that existing test stack, confirmed the flag reads `true` inside its running app, and received HTTP 200 from `/readyz` and `/login`. No unrelated containers or normal-user financial records were changed by verification.

## [2026-10-05] source-sync | Align recurring form fields with multiline guidance

Fixed the screenshot-reported Recurring grid misalignment caused by shared bottom alignment: ordinary recurring labels now align at the top of each row, including fee labels, while the Active checkbox and submit action retain their existing placement. This applies to both create and edit forms and preserves the mobile single-column layout. Added a narrow desktop expense-form screenshot to the existing browser verification command and updated the canonical interface guidance. Thirty recurring browser configurations passed; inspected the corrected screenshot and ran wiki lint. Financial behavior and container settings are unchanged.

## [2026-10-05] source-sync | Match recurring Delete action dimensions

Matched the recurring list Delete button to Preview and Edit by reusing the action-link geometry for height, padding, font, and border radius, with an explicit danger variant preserving red normal/hover/focus styling. Added a recurring-list screenshot to the existing browser verification command and synchronized interface guidance. Thirty existing browser configurations passed; inspected the list screenshot and ran wiki lint. Delete behavior, financial logic, and container settings are unchanged.

## [2026-10-05] source-sync | Clarify the recurring destination prompt

Replaced the confusing Only for transfers empty option in the shared recurring create/edit form with Choose destination account and its Italian translation. Clarified that the destination is the owned account receiving the transfer and must be selected. Updated canonical interface guidance; account validation and accounting behavior are unchanged.

## [2026-10-05] source-sync | Match recurring account placeholders

At the user's request, changed the shared recurring create/edit destination placeholder to Choose account, matching the source selector and reusing Scegli un conto in Italian. Kept Destination account as the field label and synchronized canonical interface guidance. Verified rendered English/Italian account placeholders and wiki lint; selection and accounting behavior are unchanged.

## [2026-10-05] source-sync | Fix recurring review compatibility and trigger performance

Added follow-up migration `20261005001000_optimize_transfer_fee_validation` with separate indexed fee and parent checks, preserving the original migration for already-upgraded databases. Generate/skip forms now submit and parse full UTC timestamps with milliseconds while accepting old date-only midnight confirmations. Moved the recurring name limit to new/renamed writes, preserving saved/restored long-name previews, generation, and unchanged-name settings edits. Synchronized automation, financial-model, backup compatibility, deployment, and verification guidance plus the unreleased changelog. New regressions reproduced HTTP 409 for intraday occurrences, HTTP 400 for version-10/version-11 long-name previews, and the original trigger exceeding a two-second budget. The fixes passed 261 unit tests, 35 isolated PostgreSQL/Fastify integration tests, both TypeScript checks, the production build, and all 30 recurring browser configurations; 100 trigger checks against 51,000 fixture rows took 41.7 ms in the full run. No backup schema, application version, or dependency change was required; test data was cleaned.

## [2026-10-06] source-sync | Explain recurring Name and Description labels

Added English/Italian field explanations to the shared recurring create/edit form. Label hover, input focus, and label taps explain the recurring operation name versus the generated transaction description, including the existing name fallback for a blank description. Explicit labels and `aria-describedby` preserve accessible field names; the popups remain hoverable, fit the field width, and use existing theme colors. Small JavaScript handlers dismiss on Escape or outside click without changing focus or drafts, while hover/focus remain available without JavaScript. Extended the existing recurring browser checks; all 30 configurations and application TypeScript passed, and inspected desktop/mobile tooltip screenshots. Synchronized canonical interface, automation, verification, index, and unreleased changelog guidance. No accounting, backup, database, or version changes.

## [2026-10-06] source-sync | Explain recurring Fee account

Applied the existing localized field-hint interaction to Fee account in recurring create/edit and preview. The explanation distinguishes an extra source debit from a fee deducted on the destination, while retaining the shared fee guidance on template selectors. Reused existing CSS and dismissal behavior, explicit labels, and accessible descriptions. All 30 expanded browser configurations and application TypeScript passed, including fee selector hover/focus/touch, Escape/outside dismissal, preserved selections and drafts, preview guidance, accessibility, mobile overflow, and no-JavaScript create/edit fallback. Inspected desktop/mobile tooltip screenshots and synchronized interface, automation, verification, and unreleased changelog guidance. No accounting, schema, database, dependency, or version changes.

## [2026-10-06] source-sync | Add daily, quarterly, and semiannual recurring schedules

Added Daily, Quarterly, and Semiannual to recurring create/edit/list and help, with Giornaliera, Trimestrale, and Semestrale translations. Daily advances one UTC calendar day; quarterly and semiannual advance three and six calendar months from the stored occurrence, preserving its time and milliseconds and clamping month-end dates consistently with existing monthly scheduling. Generation and skipping remain manual, processing missed dates one at a time. Migration `20261006000000_add_recurring_frequencies` extends the database enum without rewriting existing templates.

Published JSON backup schema/starter version 12 with the new frequency values, preserving historical artifacts and versions 1–11 imports. Version-11 recurring target/fee settings and fee links remain intact; rule alternatives continue to retain version-10-and-later semantics. Synchronized current downloads, canonical automation, data model, interface, backup, deployment, status, verification, index, README, and unreleased changelog guidance. No dependencies or application release version changed.

Validation passed 279 unit tests across 37 files, all 42 isolated PostgreSQL/Fastify integration tests with all 28 migrations, both TypeScript checks, production build, and all 30 recurring browser configurations. New regressions cover daily calendar boundaries, month-end/leap-year progression, exact timestamps, generation/skipping, each new frequency's backup round-trip, and preserved version-11 contracts. Draft 2020-12 JSON Schema accepted the starter and an actual export containing all five frequencies; removed the isolated fixture afterward. Applied the migration to the existing Docker test app and verified live readiness, login, localized recurring options, and version-12 download links without changing normal-user financial records.

## [2026-10-06] source-sync | Align recurring help-label underlines

Replaced the font-dependent dotted text decoration on Name, Description, and Fee account with a one-pixel dotted border positioned at the label's bottom edge. Shared styling covers create/edit and preview without moving controls or changing tooltip interactions. All 30 existing recurring browser configurations passed, including accessibility and no-JavaScript behavior; inspected English desktop and Italian mobile underline screenshots. Synchronized canonical interface guidance and the unreleased changelog. No accounting, database, backup, or version changes.

## [2026-10-06] source-sync | Fix dependency-audit CI failure and plan maintenance

Inspected both failed GitHub Actions runs for commit `07b5a35`: migrations, unit/integration tests, both TypeScript checks, and build passed before the dependency audit reported GHSA-68fv-2mgg-jv7q in source-map-js 1.2.1. Updated only that transitive lockfile entry to the compatible patched 1.2.2 release; its BSD-3-Clause license and bundled notice remain intact. A fresh high-severity audit reported zero vulnerabilities and all 279 unit tests passed. Preserved the audit threshold, application version, and published data contracts. Updated unreleased notes and verification/source provenance.

At the user's request, recorded dependency maintenance as a separate follow-up after this PR merges: weekly npm/GitHub Actions version PRs, compatible-update grouping and paired Prisma packages, security alerts/fixes, required CI/review, and a scheduled audit. Documented that Dependabot security updates target only the default branch even when version PRs target develop. The plan is not yet implemented; no repository automation or security settings were changed.

## [2026-10-07] source-sync | Require confirmation for every Delete action

Added a shared English/Italian server-rendered deletion review for accounts, transactions, categories, tags, budgets, rules, recurring templates, assets, asset prices, manual holdings, and investment activity. The first POST reads the owned record without changing it; only the confirmation button submits the scalar `confirmDelete=yes` value. Missing, invalid, and repeated values cannot delete. Cancel uses a normal link, and both stages retain authentication, ownership, and CSRF checks. Reviews show identifying fields and explain linked fees, retained transactions/tag associations, valuation changes, and used-account/asset inactivation. Replaced the fee-only transaction confirmation view and synchronized canonical interface, security, transaction, automation, investment, verification, index, and unreleased changelog guidance.

Validation passed 290 unit tests, all 55 PostgreSQL/Fastify integration tests in the separate `pennyworth_delete_confirmations_test` database with all 28 migrations, both TypeScript checks, and the production build. New integration checks compare domain snapshots across preview/cancellation for all 11 Delete actions, verify CSRF and ownership, and cover confirmed removal, inactivation, and transfer/fee cascades. Sixteen browser configurations covered desktop/320-pixel mobile, English/Italian, light/dark, accessibility, long-name wrapping, keyboard cancellation, and explicit form confirmation with JavaScript disabled. Inspected desktop/mobile review screenshots. Test users and their records were cleaned up. No accounting model, backup schema, dependency, or application version changes.
