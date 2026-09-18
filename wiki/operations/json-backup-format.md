---
title: JSON Backup Format
type: runbook
status: current
updated: 2026-09-18
source_ids: [application-source, database-schema, migrations, test-suite, project-contract, owasp-password-storage, node-crypto]
tags: [backup, restore, json, schema, migration, excel, encryption]
---

# JSON Backup Format

Pennyworth publishes its current user-backup format so data from spreadsheets or other finance systems can be transformed into an importable file. Use schema version `9` for newly generated files.

- [`pennyworth-backup-v9.schema.json`](../../src/public/schemas/pennyworth-backup-v9.schema.json) is the machine-readable JSON Schema 2020-12 definition.
- [`pennyworth-backup-v9-starter.json`](../../src/public/examples/pennyworth-backup-v9-starter.json) is a small importable example with one account, category, tag, and expense.
- Both files are also downloadable from **Settings → Security** in a running Pennyworth installation.

The application restore preview remains authoritative. JSON Schema checks field shapes and enum values, while Pennyworth additionally checks references, duplicate IDs, category cycles, configured currency, money bounds, and database constraints.

## Encrypted envelope wrapper

An encrypted `.pwb` backup wraps, but does not alter, a complete JSON document in this contract. Its independent format identifier is `pennyworth-encrypted-backup` and its independent format version is `1`; it is not a JSON schema version. The published version-9 JSON Schema and starter file therefore remain unchanged.

Envelope version 1 is UTF-8 JSON with exactly these properties, serialized with ordinary padded Base64 (not Base64url):

```json
{
  "format": "pennyworth-encrypted-backup",
  "version": 1,
  "kdf": { "algorithm": "scrypt", "N": 131072, "r": 8, "p": 1, "keyLength": 32 },
  "cipher": { "algorithm": "aes-256-gcm" },
  "salt": "16-byte padded-Base64 value",
  "nonce": "12-byte padded-Base64 value",
  "tag": "16-byte padded-Base64 value",
  "ciphertext": "padded-Base64 value"
}
```

Each export creates a fresh 16-byte random salt and 12-byte random nonce. scrypt derives a 32-byte key using fixed allow-listed `N=2^17`, `r=8`, `p=1` parameters (approximately 128 MiB memory cost); the server reserves 256 MiB for the operation. AES-256-GCM encrypts the exact UTF-8 JSON bytes and produces a 16-byte tag. The authenticated additional data is the UTF-8 encoding of this exact compact JSON, with properties in the shown order and no `tag` or `ciphertext`:

```json
{"format":"pennyworth-encrypted-backup","version":1,"kdf":{"algorithm":"scrypt","N":131072,"r":8,"p":1,"keyLength":32},"cipher":{"algorithm":"aes-256-gcm"},"salt":"…","nonce":"…"}
```

The parser rejects unknown or missing properties, malformed Base64, anything other than the fixed KDF/cipher parameters, incorrect component lengths, empty ciphertext, envelopes over 14 MiB, and decrypted JSON over 10 MiB before the JSON backup preview runs. It does not accept caller-selected KDF settings. Authentication failure, malformed metadata, and wrong passphrases intentionally share one user-facing error category.

### Known test vector

Passphrase `vector passphrase` decrypts this version-1 envelope to UTF-8 plaintext `test vector plaintext`:

```json
{"format":"pennyworth-encrypted-backup","version":1,"kdf":{"algorithm":"scrypt","N":131072,"r":8,"p":1,"keyLength":32},"cipher":{"algorithm":"aes-256-gcm"},"salt":"TIPtsxSDKlD43YKr18jixg==","nonce":"YJBEAfDL6C3MbQPH","tag":"6czHAmpCJTEKE2nxPTSnAQ==","ciphertext":"OclItQk8Tj6RjnQQ6a3wdKoI7R34"}
```

## Before importing

JSON restore replaces all financial records owned by the signed-in user. It does not merge records into the existing ledger. Export a Pennyworth backup first, keep it somewhere safe, restore the converted file only to the intended user, and inspect the preview counts before entering `RESTORE`.

The `user` object is informational during preview. Restore keeps the signed-in user's account, password, role, and preferences. Any `userId` fields copied from another installation are ignored; restored records are assigned to the signed-in user.

## Spreadsheet conversion workflow

1. Export an ordinary Pennyworth backup to use as a reference and download the starter example.
2. Keep one worksheet for each record array: accounts, categories, tags, transactions, and any optional feature arrays in use.
3. Give every row a stable, non-empty ID. Simple values such as `account-main` and `category-food` are valid; UUIDs or CUIDs are not required.
4. Use those exact IDs in relationship columns such as `sourceAccountId`, `categoryId`, `tagIds`, `accountId`, and `assetId`.
5. Convert monetary values to integer minor units. For a two-decimal currency, `12.34` becomes `1234`; do not put `12.34` in an `amountMinor` field.
6. Emit dates as ISO 8601 strings, preferably UTC, such as `2026-09-04T12:00:00.000Z`.
7. Use the same generation timestamp for `createdAt` and `updatedAt` when the source system has no equivalent values.
8. Validate the result against the published schema, then paste it into **Settings → Security → Restore** and review Pennyworth's validation result.

For Excel, semicolon-separated tag cells must be converted to JSON arrays of tag IDs—for example `tag-tax;tag-business` becomes `["tag-tax", "tag-business"]`. Empty relationships should be `null` or omitted where the schema permits them, not an Excel placeholder such as `-`.

## Top-level structure

```json
{
  "$schema": "/public/schemas/pennyworth-backup-v9.schema.json",
  "app": "Pennyworth",
  "schemaVersion": 9,
  "exportedAt": "2026-09-04T12:00:00.000Z",
  "user": { "email": "import@example.com" },
  "accounts": [],
  "categories": [],
  "tags": [],
  "transactions": [],
  "budgets": [],
  "rules": [],
  "recurringTransactions": [],
  "assets": [],
  "assetPrices": [],
  "holdings": [],
  "investmentTransactions": []
}
```

`app`, `schemaVersion`, `exportedAt`, `user`, `accounts`, `categories`, `tags`, and `transactions` are required. The remaining arrays may be omitted and then restore as empty arrays, although normal version 9 exports always include them.

Every record inside an array requires:

- `id`: non-empty and unique within that array;
- `createdAt`: valid ISO 8601 date-time;
- `updatedAt`: valid ISO 8601 date-time.

`userId` may appear because normal exports include it, but handcrafted files may omit it.

## Record fields

The following table lists fields in addition to the common record fields above. “Optional” includes fields that may be `null`, have a restore default, or may be omitted as detailed in the schema.

| Array | Required fields | Optional fields |
| --- | --- | --- |
| `accounts` | `name`, `type`, `currency`, `openingBalanceMinor` | `institution`, `isActive` (default `true`) |
| `categories` | `name`, `type` | `parentId`, `color`, `icon` |
| `tags` | `name` | `color` |
| `transactions` | `type`, `date`, `amountMinor`, `sourceAccountId`; transfers also require `destinationAccountId` | `categoryId`, `destinationAccountId` for non-transfers, `description`, `notes`, `tagIds` |
| `budgets` | `categoryId`, `month`, `amountMinor` | none |
| `rules` | `categoryId`, `name`, `matchText` | `priority` (defaults from array order), `isActive` (default `true`), `tagIds` |
| `recurringTransactions` | `name`, `type`, `amountMinor`, `sourceAccountId`, `nextDate`; transfers also require `destinationAccountId` | `categoryId`, `destinationAccountId` for non-transfers, `description`, `notes`, `frequency` (default `monthly`), `isActive` (default `true`) |
| `assets` | `symbol`, `name`, `type`, `currency` | `isActive` (default `true`) |
| `assetPrices` | `assetId`, `date`, `priceMinor` | none |
| `holdings` | `accountId`, `assetId`, `quantity`, `averageCostMinor` | `notes` |
| `investmentTransactions` | `accountId`, `assetId`, `type`, `date`, `amountMinor`; buys and sells also require `quantity` and `priceMinor` | `cashAccountId`, `cashAmountMinor` (defaults to `amountMinor`), `notes`; non-trades use `null` quantity and price |

Investment `quantity` values are decimal **strings**, not JSON numbers, with at most eight decimal places—for example `"12.50000000"`. This avoids floating-point changes during conversion. See [Investments](../features/investments.md) for the meaning of activity amounts and cash impact.

## Allowed values

| Field | Values |
| --- | --- |
| Account `type` | `bank`, `cash`, `credit_card`, `savings`, `investment`, `crypto_wallet`, `other` |
| Category `type` | `income`, `expense`, `both` |
| Transaction and recurring `type` | `income`, `expense`, `transfer` |
| Recurring `frequency` | `monthly` |
| Asset `type` | `stock`, `etf`, `fund`, `bond`, `crypto`, `other` |
| Investment transaction `type` | `buy`, `sell`, `dividend`, `interest`, `fee` |

Currencies use uppercase three-letter codes and must match the server's configured primary currency. Category and tag colors use `#RRGGBB`. Current category icon names are `salary`, `food`, `home`, `transport`, `health`, `subscription`, `investment`, `tax`, `shopping`, `entertainment`, `education`, `travel`, `business`, `gift`, `pets`, `utilities`, `savings`, and `other`. Unknown legacy icon strings restore safely but display a fallback icon.

## Relationship and uniqueness rules

- Every referenced ID must exist in its corresponding array.
- Category `parentId` values must form an acyclic tree.
- Transfer source and destination account IDs must differ, and transfers cannot have a category.
- Income and expense transactions require one source account and no destination account.
- Transaction and rule `tagIds` contain IDs from `tags` and should not contain duplicates.
- Account, category, tag, rule, and recurring names must each be unique for the restored user.
- Asset symbols must be unique.
- A budget is unique by category and month; an asset price by asset and date; a holding by account and asset.
- Transaction, budget, recurring, asset-price, and investment-activity amounts that are defined as positive must be greater than zero.

These cross-record rules cannot all be represented by JSON Schema. The restore preview checks them before replacement, including category compatibility, account investment compatibility, transfer semantics, and dependent feature relationships. The transactional restore repeats the complete validation immediately before replacement and rolls back if a database constraint rejects the data.

## Version compatibility

Pennyworth currently imports historical schema versions `1` through `9`, defaulting record families that did not exist in earlier versions. Version `9` publishes the stricter service-level relationship validation contract; version `8` remains available for historical exports and is not rewritten. External conversion tools should generate only the current version and should treat the filename and `schemaVersion` as versioned contracts that may gain a new file in a future release.

The repository treats this format as a fundamental public contract. Any implementation change affecting exported or restored fields, types, enums, defaults, relationships, validation, or record families must update the current schema, starter example, documentation, and synchronization tests in the same change. Incompatible changes require a new schema version and new versioned filenames; superseded published schemas remain available for historical exports.

## Related pages

- [`backup-and-restore.md`](backup-and-restore.md)
- [`../architecture/data-and-financial-model.md`](../architecture/data-and-financial-model.md)
- [`../features/transactions.md`](../features/transactions.md)
- [`../features/investments.md`](../features/investments.md)

## Sources

- [`application-source`](../sources.md#sourceapplication-source)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`migrations`](../sources.md#sourcemigrations)
- [`test-suite`](../sources.md#sourcetest-suite)
- [`project-contract`](../sources.md#sourceproject-contract)
- [`owasp-password-storage`](../sources.md#sourceowasp-password-storage)
- [`node-crypto`](../sources.md#sourcenode-crypto)
