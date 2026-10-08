---
title: JSON Backup Format
type: runbook
status: current
updated: 2026-10-08
source_ids: [application-source, database-schema, migrations, test-suite, project-contract, owasp-password-storage, node-crypto]
tags: [backup, restore, json, schema, migration, excel, encryption]
---

# JSON Backup Format

Pennyworth publishes its current user-backup format so data from spreadsheets or other finance systems can be transformed into an importable file. Use schema version `12` for newly generated files.

- [`pennyworth-backup-v12.schema.json`](../../src/public/schemas/pennyworth-backup-v12.schema.json) is the machine-readable JSON Schema 2020-12 definition.
- [`pennyworth-backup-v12-starter.json`](../../src/public/examples/pennyworth-backup-v12-starter.json) is a small importable example with two accounts, two categories, one tag, a grocery expense, a transfer with its destination-paid fee, two rules, a weekly target-balance template, and daily, quarterly, and semiannual fixed expenses.
- Both files are also downloadable from **Settings → Security** in a running Pennyworth installation.

The application restore preview remains authoritative. JSON Schema checks field shapes and enum values, while Pennyworth additionally checks references, duplicate IDs, category cycles, configured currency, money bounds, and database constraints.

## Encrypted envelope wrapper

An encrypted `.pwb` backup wraps, but does not alter, a complete JSON document in this contract. Its independent format identifier is `pennyworth-encrypted-backup` and its independent format version is `1`; it is not a JSON schema version. The wrapper remains version 1 when its contained JSON uses schema version 12.

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
  "$schema": "/public/schemas/pennyworth-backup-v12.schema.json",
  "app": "Pennyworth",
  "schemaVersion": 12,
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

`app`, `schemaVersion`, `exportedAt`, `user`, `accounts`, `categories`, `tags`, and `transactions` are required. The remaining arrays may be omitted and then restore as empty arrays, although normal version 12 exports always include them.

Every record inside an array requires:

- `id`: non-empty and unique within that array;
- `createdAt`: valid ISO 8601 date-time;
- `updatedAt`: valid ISO 8601 date-time.

`userId` may appear because normal exports include it, but handcrafted files may omit it.

Restore preserves the record's `createdAt` and `updatedAt` values. Assigning a linked transfer fee to its parent after insertion also preserves those timestamps, regardless of transaction order. Re-exporting that fee retains its saved update time.

## Record fields

The following table lists fields in addition to the common record fields above. “Optional” includes fields that may be `null`, have a restore default, or may be omitted as detailed in the schema.

| Array | Required fields | Optional fields |
| --- | --- | --- |
| `accounts` | `name`, `type`, `currency`, `openingBalanceMinor` | `institution`, `isActive` (default `true`) |
| `categories` | `name`, `type` | `parentId`, `color`, `icon` |
| `tags` | `name` | `color` |
| `transactions` | `type`, `date`, `amountMinor`, `sourceAccountId`; transfers also require `destinationAccountId` | `categoryId`, `destinationAccountId` for non-transfers, `description`, `notes`, `tagIds`, `feeForTransactionId` (default `null`) |
| `budgets` | `categoryId`, `month`, `amountMinor` | none |
| `rules` | `categoryId`, `name`, `matchText` | `priority` (defaults from array order), `isActive` (default `true`), `tagIds` |
| `recurringTransactions` | `name`, `type`, `amountMinor` (nullable for target mode), `sourceAccountId`, `nextDate`; transfers also require `destinationAccountId`; target mode also requires `targetBalanceMinor` | `amountMode` (default `fixed`), `targetBalanceMinor` (default `null`), `feeAmountMinor` (default `0`), `feeAccount` (default `source`), `feeCategoryId` (default `null`), `categoryId`, `destinationAccountId` for non-transfers, `description`, `notes`, `frequency` (default `monthly`), `isActive` (default `true`) |
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
| Recurring `frequency` | `daily`, `weekly`, `monthly`, `every_3_months`, `every_6_months` |
| Recurring `amountMode` | `fixed`, `target_balance` |
| Recurring `feeAccount` | `source`, `destination` |
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

## Recurring and transfer-fee fields

Versions 11 and 12 fixed mode require a positive integer `amountMinor` and null/omitted `targetBalanceMinor`. Target-balance mode requires `type: "transfer"`, `amountMinor: null`, and a nonnegative integer target. Targets and fee amounts must fit PostgreSQL's signed 32-bit range. The target is reached after fees; fixed amounts remain the transfer principal. See [recurring templates](../features/automation.md#optional-top-up-fees) for examples.

Only transfers can have fee settings: non-transfer templates require fee amount zero, fee account source, and fee category null/omitted. Fee categories must reference an expense-compatible category in the same backup. The fee role is relative to the stored transfer accounts; there is no third-account option. Daily and weekly schedules advance one and seven UTC calendar days. Monthly, quarterly (`every_3_months`), and semiannual (`every_6_months`) schedules advance one, three, and six calendar months from the stored occurrence, clamping the day to the destination month when necessary. Restore preserves the next date and active state without generating an occurrence.

Recurring `nextDate` accepts a complete timestamp, including an intraday time and milliseconds. Generate and skip confirmation preserve that exact stored occurrence, and schedule advancement retains its time. Existing and restored names longer than 100 characters remain valid for preview and generation, and can remain unchanged while editing other settings. The 100-character limit applies to new or renamed templates in the application, not backup preview, restore, or export. These compatibility fixes do not change the format or schema version.

`transactions[].feeForTransactionId` is null/omitted for ordinary entries. A linked record must be an expense whose parent is a transfer in this backup, on exactly the same date, debiting that transfer's source or destination. Each transfer can have at most one fee; self-links, missing parents, duplicate fees, foreign accounts, and incompatible categories are rejected before replacement. Restore creates records before assigning links, so input transaction order is irrelevant. Fees remain ordinary reportable expenses. Deleting a parent transfer later also deletes its linked fee.

## Rule matching syntax

In versions 10–12, `rules[].matchText` is a comma-separated list of case-insensitive substring alternatives. For example, `lidl, aldi, carrefour` matches any of those terms anywhere in description or notes. Spaces stay inside a phrase: `amazon prime` remains one alternative. Empty alternatives and case-insensitive duplicates are ignored, but at least one non-empty term is required.

For compatibility with historical imports, backup validation also accepts a non-empty string consisting only of whitespace, or a single quoted whitespace-only literal (including `""`). These rules never match a transaction, regardless of `isActive`, and their text and active state survive restore, export, and reimport. This also covers whitespace line breaks quoted by the data migration. Rule creation/edit forms still require a non-empty matching term. Empty strings, malformed quoting, and lists containing only empty alternatives such as `, ,` remain invalid backup input.

Quote a phrase containing literal commas or double quotes using CSV-style quoting. JSON must also escape its own double quotes:

```json
{ "matchText": "\"Smith, Inc\", \"The \"\"Corner\"\" Shop\"" }
```

Malformed quoting is rejected during preview, before restore can replace any data. The schema describes this grammar; the importer validates it. Restore always writes the saved transaction categories and tags without applying current rules, even when a transaction is uncategorized and matches a restored rule.

## Version compatibility

Version 12 adds `daily`, `every_3_months` (Quarterly), and `every_6_months` (Semiannual). Version 11 still accepts only monthly and weekly schedules, including its original target/fee settings; new frequency values require version 12. Its [published schema](../../src/public/schemas/pennyworth-backup-v11.schema.json) and [starter](../../src/public/examples/pennyworth-backup-v11-starter.json) remain unchanged. Migration `20261006000000_add_recurring_frequencies` adds the three enum values without modifying saved occurrences. Application builds predating this change cannot import version-12 backups or represent its new frequencies; retain pre-upgrade JSON and PostgreSQL backups for rollback.

Pennyworth imports schema versions `1` through `12`, defaulting record families that did not exist in earlier versions. Version `9` introduced stricter service-level relationship validation. Version `10` changes `rules[].matchText` from one literal phrase to comma-separated alternatives. Versions `1`–`9` are upgraded during restore by quoting literal commas and quotes, preserving their old matching behavior. Restoring versions 10–12 retains the saved matching text. Version 11 introduces weekly and target-balance recurring templates, fee settings, nullable fixed amounts, and transfer-fee links. Versions 1–10 restore recurring records as fixed monthly templates using their original positive amount, with no fee preset. Missing version-11/version-12 settings default to fixed mode, null target, zero fee, source role, and null fee category; ordinary transactions default to no fee link. The [version 10 schema](../../src/public/schemas/pennyworth-backup-v10.schema.json) and [version 10 starter](../../src/public/examples/pennyworth-backup-v10-starter.json) remain published unchanged, along with the [version 9 schema](../../src/public/schemas/pennyworth-backup-v9.schema.json), [version 9 starter](../../src/public/examples/pennyworth-backup-v9-starter.json), and version 8 artifacts remain published without modification.

Migration `20261002000000_preserve_literal_rule_matching` performs the equivalent quoting for existing database rules. Editing an old comma-containing rule is required to opt it into alternatives. Migration `20261005000000_add_recurring_top_ups` adds the recurring and fee database fields without altering existing fixed monthly rows. Earlier application builds cannot import version 11 backups or interpret its nullable target-mode amounts; keep pre-upgrade PostgreSQL and JSON backups for rollback. Builds predating the rule change also cannot import version 10 backups and do not understand the migrated quoted matching syntax; retain pre-upgrade PostgreSQL and JSON backups for rollback. External conversion tools should generate only the current version and treat the filename and `schemaVersion` as versioned contracts.

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
