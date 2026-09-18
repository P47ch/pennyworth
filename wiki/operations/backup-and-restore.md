---
title: Backup and Restore
type: runbook
status: current
updated: 2026-09-18
source_ids: [application-source, database-schema, test-suite, container-definitions, project-contract, owasp-password-storage, node-crypto, fastify-multipart]
tags: [backup, restore, recovery, encryption]
---

# Backup and Restore

Pennyworth has two complementary recovery layers: user-scoped JSON for portable application data and PostgreSQL dumps for full server recovery. Neither is useful until a restore has been tested.

## User-scoped backups

Authenticated users export JSON from Security. Current schema version `9` includes:

- accounts, categories, tags, transactions, and transaction-tag links;
- budgets, rules, rule tags, and recurring templates;
- assets, manual prices, holdings, and investment activity including cash impact.

Derived `InvestmentPosition` and `InvestmentTransactionResult` rows are excluded because they rebuild from authoritative investment activity. Export reads all included record families inside one PostgreSQL repeatable-read transaction, preventing a backup from mixing states across concurrent edits.

Account credentials, roles, and interface preferences such as language, theme, menu visibility, and avatar choice are not replaced by JSON restore. Use a PostgreSQL dump when full installation recovery, including those settings, is required.

Restore accepts schema version `1` without budgets and versions `2` through `9` with later record families defaulted when absent. Preview validates app identity, schema version, unique IDs, references, category cycles, the configured primary currency, integer money bounds, supported values, and service-level relationship semantics. Restore independently parses and validates the exact submitted payload immediately before opening its replacement transaction, then writes the captured validated graph without reparsing it inside the transaction.

The current version 9 structure is documented in the [JSON backup format](json-backup-format.md). A machine-readable schema and an importable starter example are available there and from the Security page for conversions from Excel or another application. The version 8 schema and starter remain published for historical exports.

The user must review the preview and confirm with `RESTORE`. Replacement is user-scoped and transactional: a failure rolls back rather than leaving a partial ledger. A successful restore rebuilds derived investment state.

### Encrypted `.pwb` backup

Security also offers a password-protected download named `pennyworth-backup-YYYY-MM-DD.pwb`. New exports require a passphrase of at least 12 characters; existing encrypted backups with shorter passphrases remain restorable for compatibility. The passphrase is never stored, placed in a URL, or included in the filename. Pennyworth cannot recover a backup when its passphrase is lost, so keep a separate recovery copy and use a unique, memorable passphrase.

The `.pwb` file is an encrypted envelope around the exact same JSON export. It does **not** change JSON schema version `9`, and ordinary `.json` export and restore remain available for interoperability. The envelope is parsed from content rather than relying on a filename or MIME type. Restore accepts one `.pwb` or `.json` file, or pasted JSON; it shows the ordinary record-count preview and requires a second passphrase entry plus `RESTORE` before replacing data. A 15-minute server-signed token binds the confirmation to the exact payload shown in the preview, and decryption plus JSON validation run again immediately before the existing transactional restore.

Pennyworth limits encrypted JSON plaintext to 10 MiB and the UTF-8 envelope to 14 MiB. Multipart accepts only one file and four non-file fields, with the same resource bounds; uploaded files are held only in request memory and are never written to disk. The confirmation preserves the exact UTF-8 payload using bounded Base64url transport (the confirmation route is limited to 20 MiB). A 15-minute server-signed token binds it to the preview. Passphrase attempts are limited to three per 15 minutes per Fastify rate-limit key; across export, preview, and confirmation, the service runs at most one scrypt operation at a time and queues at most two more. Wrong passphrases, malformed envelopes, and modified encrypted metadata or ciphertext all report the same safe failure message.

Encryption protects a stored file from a cloud-storage or removable-media disclosure and detects modification. It does not protect an unlocked Pennyworth session, a leaked passphrase, or passphrase transit over an untrusted HTTP connection. In `trusted-private-http` mode the Security page warns that the passphrase crosses the network; use HTTPS or a trusted private network/VPN for that workflow.

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
3. Select a `.json` or `.pwb` backup file, or paste JSON. Enter the passphrase for a `.pwb` file.
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
- [`owasp-password-storage`](../sources.md#sourceowasp-password-storage)
- [`node-crypto`](../sources.md#sourcenode-crypto)
- [`fastify-multipart`](../sources.md#sourcefastify-multipart)
