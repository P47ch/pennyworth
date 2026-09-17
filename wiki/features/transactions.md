---
title: Transactions and CSV
type: feature
status: current
updated: 2026-09-15
source_ids: [project-contract, application-source, finance-source, query-source, database-schema, migrations, test-suite]
tags: [transactions, csv, ledger]
---

# Transactions and CSV

Normal money movement uses one transaction model with `income`, `expense`, and `transfer` types. The same service validation supports forms and confirmed imports.

## Transaction lifecycle

The authenticated UI supports create, edit, delete, filtered browsing, and pagination. Forms accept an accounting date, positive amount, account references, optional category, tags, description, and notes.

- Income and expense use one source account.
- Transfer uses different source and destination accounts and cannot have a category.
- Service checks verify ownership and category compatibility.
- PostgreSQL repeats the essential shape, positivity, and same-user checks.
- Delete actions require explicit user interaction; normal records are not soft-deleted.

Browsing supports date, type, account, category, tag, and text filters. Normal pages return at most 50 transactions; CSV export intentionally returns every transaction matching the active filters.

## CSV export

Export columns are:

```text
date,type,amount_minor,account,destination_account,category,tags,description,notes
```

CSV quoting handles commas, quotes, and newlines. User-controlled text beginning with spreadsheet formula prefixes is exported as literal text to reduce formula-injection risk.

## CSV import

Import accepts pasted CSV or a local file read in the browser. The raw upload is not stored separately. Supported normalized columns are:

```text
date,type,amount,amount_minor,debit,credit,account,destination_account,category,tags,description,notes
```

Rules:

- Date, type, account, and one amount representation are required after mapping.
- Dates must be strict `YYYY-MM-DD` values and become UTC date-only records.
- `amount_minor` is authoritative integer money when present; it must be a fully matched signed base-10 integer, within the application's supported money range, and non-zero. Decimals, scientific notation, trailing characters, unsafe integers, and a leading plus sign are rejected. Surrounding CSV cell whitespace is trimmed consistently.
- Separate debit/credit columns may be mapped. Debit becomes expense and credit becomes income; a row cannot contain both.
- Account, destination, category, and tag values match existing records by name or ID.
- Transfers require a destination; tags use semicolon separation.
- A missing type or account column may be supplied as a mapping default.
- Browser-local mapping presets are keyed by source header layout and can be cleared by the user.
- Active categorization rules apply only to uncategorized expense rows and remain visible in preview.
- Nothing is written until every row is valid and the user confirms.
- Import preview errors identify the source row and amount column for malformed monetary values. Confirmed imports use bounded bulk inserts inside one transaction and repeat reference checks against current database state.
- A valid preview creates a user-scoped import receipt bound to the normalized CSV hash. Confirmation locks and completes that receipt in the same transaction as ledger insertion, so concurrent or retried confirmation returns the original result without duplicating rows.

## Duplicate handling

Preview flags possible duplicates using date, type, amount, source account, destination account, and description. It detects both existing transactions and repeated rows inside the same CSV. Confirmation defaults to skipping possible duplicates; including them requires an explicit choice.

Existing duplicate candidates are queried only for the import's minimum/maximum date range and only with the fields required for matching. Preview does not load the complete transaction ledger or full relation graph.

## Related pages

- [`../architecture/data-and-financial-model.md`](../architecture/data-and-financial-model.md)
- [`automation.md`](automation.md)
- [`../operations/backup-and-restore.md`](../operations/backup-and-restore.md)
- [`../operations/testing-and-performance.md`](../operations/testing-and-performance.md)

## Sources

- [`project-contract`](../sources.md#sourceproject-contract)
- [`application-source`](../sources.md#sourceapplication-source)
- [`finance-source`](../sources.md#sourcefinance-source)
- [`query-source`](../sources.md#sourcequery-source)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`migrations`](../sources.md#sourcemigrations)
- [`test-suite`](../sources.md#sourcetest-suite)
