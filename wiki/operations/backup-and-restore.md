---
title: Backup and Restore
type: runbook
status: current
updated: 2026-09-16
source_ids: [application-source, database-schema, test-suite, container-definitions, project-contract]
tags: [backup, restore, recovery]
---

# Backup and Restore

Pennyworth has two complementary recovery layers: user-scoped JSON for portable application data and PostgreSQL dumps for full server recovery. Neither is useful until a restore has been tested.

## JSON backup

Authenticated users export JSON from Security. Current schema version `9` includes:

- accounts, categories, tags, transactions, and transaction-tag links;
- budgets, rules, rule tags, and recurring templates;
- assets, manual prices, holdings, and investment activity including cash impact.

Derived `InvestmentPosition` and `InvestmentTransactionResult` rows are excluded because they rebuild from authoritative investment activity. Export reads all included record families inside one PostgreSQL repeatable-read transaction, preventing a backup from mixing states across concurrent edits.

Account credentials, roles, and interface preferences such as language, theme, menu visibility, and avatar choice are not replaced by JSON restore. Use a PostgreSQL dump when full installation recovery, including those settings, is required.

Restore accepts schema version `1` without budgets and versions `2` through `9` with later record families defaulted when absent. Preview validates app identity, schema version, unique IDs, references, category cycles, the configured primary currency, integer money bounds, supported values, and service-level relationship semantics. Restore independently parses and validates the exact submitted payload immediately before opening its replacement transaction, then writes the captured validated graph without reparsing it inside the transaction.

The current version 9 structure is documented in the [JSON backup format](json-backup-format.md). A machine-readable schema and an importable starter example are available there and from the Security page for conversions from Excel or another application. The version 8 schema and starter remain published for historical exports.

The user must review the preview and confirm with `RESTORE`. Replacement is user-scoped and transactional: a failure rolls back rather than leaving a partial ledger. A successful restore rebuilds derived investment state.

## PostgreSQL dump

A SQL dump captures the whole database and is preferred for server-level disaster recovery. Example with the managed PostgreSQL production profile:

```bash
docker compose --env-file .env -f deploy/compose.prod.yml exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > pennyworth-backup.sql
```

Store dumps encrypted and away from the application host. The command's shell redirection writes sensitive plaintext until external encryption/storage policy protects it.

## SQL recovery

Restore only into the intended database and preferably rehearse with disposable data:

```bash
docker compose --env-file .env -f deploy/compose.prod.yml stop app
docker compose --env-file .env -f deploy/compose.prod.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < pennyworth-backup.sql
docker compose --env-file .env -f deploy/compose.prod.yml up -d app
```

Verify `/readyz`, login, balances, recent transactions, investment positions, and backup export after recovery.

## JSON recovery

1. Start a compatible Pennyworth version and sign in.
2. Open **Security**.
3. Paste the JSON backup.
4. Review record counts and validation output.
5. Confirm with `RESTORE`.
6. Verify balances, reports, tags, automation, and investments.

## Recovery policy

- Create both JSON and SQL backups before upgrades that change schema or financial logic.
- Keep multiple dated copies; do not overwrite the only known-good backup.
- Protect backups as strongly as the live database.
- Keep container volumes until migration to a new host or engine is verified.
- Test restore using non-production data and record the result in operational notes.
- Never use `compose down --volumes` unless permanent database deletion is explicitly intended.

## Related pages

- [`deployment.md`](deployment.md)
- [`json-backup-format.md`](json-backup-format.md)
- [`podman.md`](podman.md)
- [`../architecture/security-and-privacy.md`](../architecture/security-and-privacy.md)
- [`../features/investments.md`](../features/investments.md)

## Sources

- [`application-source`](../sources.md#sourceapplication-source)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`test-suite`](../sources.md#sourcetest-suite)
- [`container-definitions`](../sources.md#sourcecontainer-definitions)
- [`project-contract`](../sources.md#sourceproject-contract)
