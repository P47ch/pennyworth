---
title: Transactions and CSV
type: feature
status: current
updated: 2026-10-05
source_ids: [project-contract, application-source, finance-source, query-source, database-schema, migrations, test-suite, issue-6]
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

New uncategorized expenses use the [categorization rules](automation.md#categorization-rules), merging rule tags while preserving manually selected tags. An explicitly selected category skips all rule changes. Manual and recurring creation show localized save feedback with the matched rule and resulting category/tags. Quick entry remembers the account but leaves the category empty rather than silently reusing a previous category. Edits keep the user's choices and never rerun rules automatically.

## Quick category and tag creation (issue #6)

Manual transaction quick entry implements [issue #6](https://github.com/P47ch/pennyworth/issues/6) with **Add category** and **Add tag** controls beside the respective fields, including empty lists. Each opens a native dialog backed by a separate form outside the transaction form. Editing, recurring forms, rules, and CSV import do not yet offer these controls.

- Opening, cancelling, and handling errors keep the draft and existing selected tags in the current page; the financial draft is not persisted in browser storage.
- A category requires a name and defaults to the current income/expense type, with `both` also available. Parent, color, and the approved icon picker are under optional details. Color defaults to `#2563eb` and icon to `other`, matching the normal category form. A tag requires a name and offers a color.
- Saving immediately persists the category/tag, even if the transaction is later abandoned. The new category is selected, or the new tag is checked without clearing existing selections. Filter controls and category-parent choices also receive the new record.
- Category options follow the selected transaction type; changing type clears an incompatible selection. Transfers have no category action, while tag creation remains available. Transaction services independently recheck compatibility and ownership on save.
- Selecting a newly created category skips automatic rules, including rule tags. Creating only a tag retains the existing uncategorized-expense rule behavior.

`POST /categories/quick` and `POST /tags/quick` reuse taxonomy services and the shared input validators in `src/routes/taxonomyInput.ts`. Success returns HTTP 201 with `{ category: { id, name, type } }` or `{ tag: { id, name } }`. Expected validation errors return localized HTTP 400 responses. The per-user name uniqueness constraint produces HTTP 409 on duplicates, including concurrent submissions, with `{ error, existing }`: `existing` contains the same minimal fields as a successful creation, looked up by the authenticated user and validated, trimmed name. It can be `null` if the conflicting record was deleted before lookup. Unexpected failures return a generic HTTP 500 message without database details.

If creation was saved but its response was lost, truncated, or timed out, retrying the unchanged name retrieves the existing record. The dialog offers an explicit **Use existing** action and explains that saved details are retained, even if the requested type, parent, color, or icon differs. No selection or update happens automatically. The action selects a compatible category or checks the tag while preserving the other draft fields and existing tags. An incompatible category instead gets a localized explanation and no recovery action. Editing dialog fields, submitting again, or reopening clears the previous recovery candidate; compatibility is checked again when selecting it.

The page loads `src/public/quick-taxonomy.js`, using same-origin URL-encoded requests with the rendered `csrfToken`. Existing session and CSRF hooks apply. Redirected session/password responses, non-JSON server failures, malformed responses, and network failures stay in the dialog and preserve the draft. On CSRF rejection, an authenticated GET refreshes the form token in place; the user explicitly retries. Requests time out after 15 seconds. Controls are disabled while pending, including dismissal, to avoid a hidden request saving after cancellation. Errors regain focus, successful/cancelled dialogs restore focus to the opener, and success is announced through a localized status region.

Dialog markup is shared through `src/views/partials/quick-taxonomy.ejs`; partial strings are explicitly translated because EJS includes are not passed through the top-level localization compiler. User-authored names enter browser controls through text nodes. Responsive light/dark styling and approved server-rendered icons retain the self-only CSP. Controls appear only after JavaScript initializes; ordinary transaction submission and category/tag management remain usable without it. No dependency, migration, or backup-format change is required.

`npm run test:quick-entry` verifies the open dialogs with Playwright and axe against rendered fixtures without a database, including persistence followed by lost responses, explicit recovery, draft preservation, and incompatible conflicts. PostgreSQL/Fastify integration coverage verifies actual creation, discarded-response retries without duplicate records or overwritten details, CSRF, ownership, localized errors, duplicate races, session boundaries, and persistence into a saved transaction. See [testing and performance](../operations/testing-and-performance.md#quick-entry-dialog-checks) for commands and dated results.

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
- [`issue-6`](../sources.md#sourceissue-6)
