---
title: Pennyworth Wiki Operating Schema
type: schema
status: current
updated: 2026-07-19
source_ids: [llm-wiki-pattern, project-contract]
tags: [schema, workflow, provenance]
---

# Pennyworth Wiki Operating Schema

These instructions apply to every file under `wiki/`. They extend the repository-level `AGENTS.md` and turn this directory into an LLM-maintained, source-grounded knowledge base.

## Knowledge layers

1. **Sources** are authoritative inputs. For this software project, source code, Prisma schema, migrations, tests, manifests, and deployment definitions remain in their normal repository locations. [`sources.md`](sources.md) assigns stable IDs and authority levels. `wiki/raw/` is reserved for immutable imported material that has no better canonical repository location.
2. **Wiki pages** are maintained synthesis. The LLM may create, reorganize, and update them, but must preserve provenance and distinguish implemented behavior from plans.
3. **This schema** defines page formats and ingest, query, and lint workflows. Evolve it deliberately when repeated maintenance reveals a better convention.

## Authority and conflict rules

- Repository code, `prisma/schema.prisma`, migrations, and tests are authoritative for current implementation behavior.
- The root `AGENTS.md` is authoritative for product intent, domain invariants, architecture constraints, and security expectations.
- Primary vendor documentation is authoritative for external tool behavior.
- Wiki pages summarize sources; they never override them.
- `log.md` records operations and is not evidence that an implementation exists.
- When sources conflict, record the contradiction on the relevant page, identify both sources, and mark the claim `needs-review`. Never silently choose the more convenient claim.

## Page contract

Every Markdown page in `wiki/`, including indexes and runbooks, begins with this YAML-compatible frontmatter using single-line arrays:

```yaml
---
title: Human-readable title
type: overview
status: current
updated: 2026-07-19
source_ids: [project-contract]
tags: [example]
---
```

Allowed `type` values are `overview`, `schema`, `index`, `log`, `source-map`, `product`, `status`, `architecture`, `security`, `feature`, `runbook`, and `verification`.

Allowed `status` values are `current`, `planned`, `historical`, and `needs-review`.

Use lowercase kebab-case filenames. Give each durable concept one canonical page and update that page instead of creating near-duplicates. Use standard relative Markdown links. Link related concepts in prose, not only from the index.

Every maintained synthesis page ends with a `## Sources` section that links its source IDs to [`sources.md`](sources.md). A page may include inference, but it must label the inference and identify the facts it rests on.

## Ingest workflow

When the user asks to ingest or when an implementation change materially changes maintained knowledge:

1. Read the source completely enough to understand its scope. Do not modify an authoritative source merely to make the wiki consistent.
2. Add or update its entry in [`sources.md`](sources.md). Prefer stable repository paths or primary-source URLs.
3. Search [`index.md`](index.md) and existing pages before creating anything.
4. Update every affected canonical page, including cross-references, status, source IDs, and `updated` date.
5. Create a new page only for a distinct concept, feature, decision, or runbook that other pages will link to.
6. Update [`index.md`](index.md) with a one-line description.
7. Append one entry to [`log.md`](log.md) using `## [YYYY-MM-DD] ingest | Description` or `source-sync` for repository reconciliation.
8. Run `npm run wiki:lint` and fix every failure.

## Query workflow

1. Read [`index.md`](index.md).
2. Read the smallest set of relevant wiki pages and follow their cross-links.
3. For security, financial correctness, deployment, or potentially stale claims, inspect the authoritative source before answering.
4. Cite wiki pages and source IDs in the answer.
5. If the answer creates durable new synthesis within the user's requested scope, file it into the canonical page, update the index if needed, and append a `query` entry to the log.

## Lint workflow

Run `npm run wiki:lint` after every wiki change. The deterministic lint checks frontmatter, source IDs, internal links, index coverage, orphan pages, and log format. A semantic lint pass should additionally look for:

- implemented work still described as backlog;
- planned work presented as current behavior;
- duplicate pages or conflicting definitions;
- pages not updated after their sources changed;
- missing links between closely related concepts;
- operational commands that disagree with `package.json` or Compose files;
- security or financial claims without authoritative sources.

Append semantic lint work to [`log.md`](log.md) with `## [YYYY-MM-DD] lint | Description`.

## Log policy

`log.md` is append-only. Never rewrite or delete an existing operation entry. Corrections are new entries that point back to the earlier one. Keep newest entries at the bottom so ordinary file append behavior preserves chronology.

## Sources

- [`llm-wiki-pattern`](sources.md#sourcellm-wiki-pattern)
- [`project-contract`](sources.md#sourceproject-contract)
