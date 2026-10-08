---
title: Categories, Budgets, Rules, and Recurring Templates
type: feature
status: current
updated: 2026-10-07
source_ids: [project-contract, application-source, finance-source, query-source, database-schema, migrations, test-suite, issue-8, issue-8-fees, issue-8-help]
tags: [categories, tags, budgets, rules, recurring]
---

# Categories, Budgets, Rules, and Recurring Templates

Pennyworth keeps automation visible and user-controlled. Categories and tags organize records; budgets summarize spending; rules propose categorization; recurring templates generate only when the user asks.

Categories, tags, budgets, rules, and recurring templates all require the shared [Delete confirmation](interface-and-accessibility.md#deletion-confirmations). Cancelling keeps their records unchanged. Confirmed rule/template deletion retains existing transactions, tag deletion removes its associations without removing transactions or rules, and categories in use remain protected by the existing service/database constraints.

## Categories and tags

Categories are structured reporting groups with name, type, optional parent, color, and icon. Types are `income`, `expense`, and `both`. A transaction has at most one category. Category forms expose a validated visual Lucide icon catalog rather than accepting arbitrary icon strings; existing unknown values display with a safe fallback until edited.

Parent categories must belong to the same user. A category cannot parent itself or use a descendant as its parent. Existing cyclic data is rejected during parent validation, and JSON restore rejects a cyclic category graph before replacing records.

Tags are flexible name/color metadata with many-to-many transaction relationships. Category and tag lists present colors as visual identity cues instead of raw hexadecimal text. The same compact category identity appears with transaction, recurring, rule, budget, dashboard, statistics, and CSV preview references; native select options remain text because browsers do not reliably support rich option content. Tag junction rows carry `userId`, so the database can prevent a cross-user link even through direct SQL.

Manual transaction entry supports [quick creation of categories and tags](transactions.md#quick-category-and-tag-creation-issue-6) without leaving its draft. These records use the same validation, ownership, and per-user name uniqueness as the management forms. Selecting the new category counts as an explicit category choice and skips categorization rules.

## Monthly budgets

A budget assigns a positive integer minor-unit amount to one user-owned category and UTC calendar month. A user/category/month combination is unique.

Budget progress compares that month’s category spending with the configured amount. The UI shows progress bars and over-budget state on budget pages and dashboard summaries. Budgets do not alter transactions or balances.

## Categorization rules

A rule contains:

- unique user-owned name;
- case-insensitive substring alternatives separated by commas;
- expense-compatible category;
- integer priority;
- active state;
- optional tags.

Active rules are evaluated from top to bottom in priority order against description and notes. Any matching alternative is enough, and the first matching rule supplies its category and tags. Spaces remain inside a phrase: `amazon prime` searches that phrase, while `lidl, aldi` searches either merchant. Matching uses substrings, not whole-word boundaries or regular expressions. Empty alternatives and case-insensitive duplicates are ignored; rule forms reject input with no non-empty terms or malformed quoting. Historical whitespace-only literals remain inert regardless of active state and are preserved by backup restore/export, including quoted whitespace introduced by migration. Quote a literal comma as `"Smith, Inc"` and double literal quotes inside a quoted phrase.

Rules automatically apply when a new expense has no category, including manual entry and newly generated recurring expenses. CSV preview uses the same matcher and shows its proposed category and tags before import confirmation. Selecting or mapping a category skips the rule entirely, including its tags. Rule tags are merged with existing tags without duplicates. Income and transfers are unaffected. Saving a manual or recurring entry reports the applied rule, category, and newly added tags in a localized, one-time notice.

CSV and existing-expense previews prepare each active rule's parsed, lowercase terms once per batch. Matching reuses that snapshot while retaining the original priority order and category/tag references. No rule cache is retained across requests, so later previews see rule edits.

Rules can be enabled or disabled directly from the list with a CSRF-protected form button. The action sets the requested state on a user-owned rule and preserves its name, matching text, category, tags, and priority. Disabled rules remain in the list and are excluded from future automatic matching and previews. Repeated submissions of the same action retain the requested state.

Editing a transaction, changing a rule, or restoring a JSON backup does not reapply rules. The UI previews existing uncategorized expenses before explicit application. A question-mark control on the Rules and Edit rule pages explains matching, ordering, automatic application, and these boundaries without requiring JavaScript.

Migration `20261002000000_preserve_literal_rule_matching` quotes special characters in existing match text so an old comma-containing rule continues to match its complete literal phrase. Users can edit it to opt into alternatives. [JSON backup version 10](../operations/json-backup-format.md) defines the new syntax; historical backups are converted to quoted literal phrases during restore.

Existing-ledger preview and application are capped at 500 candidate expenses per request. Application conditionally updates only records that are still uncategorized and uses duplicate-safe tag insertion, so a concurrent manual categorization is not overwritten. The user can apply another bounded batch when more candidates remain.

## Recurring templates

Templates support Daily, Weekly, Monthly, Quarterly, and Semiannual income, expense, and transfer entries (Italian: Giornaliera, Settimanale, Mensile, Trimestrale, Semestrale). Generation remains manual: select **Preview**, review the accounting date and amounts, then **Confirm and generate**. These actions record the ledger; they do not initiate bank or wallet payments. Daily and weekly advance one and seven UTC calendar days. Monthly, quarterly, and semiannual advance one, three, and six calendar months from the stored occurrence. Invalid days clamp to that month's last day: January 31 plus three months becomes April 30; the following quarterly occurrence is July 30. All intervals retain the stored time and milliseconds. Missed occurrences are processed one at a time at their stored dates.

New or renamed templates require a name of 1–100 characters. Existing and restored longer names remain usable for preview, generation, and skipping. Other settings can be edited while keeping such a name unchanged; backup import/export does not impose the new-write limit.

### Fixed and variable recurring transfers (issue #8)

[Issue #8](https://github.com/P47ch/pennyworth/issues/8) is implemented with fixed transfers and target-balance replenishment, plus the user's source/destination fee and help requirements. The variable mode restores a target balance; it does not sum a spending period. A dedicated monthly account income/expense summary remains additional reporting scope. Existing transaction account/date filters and per-account statistics show wallet activity; replenishments remain transfers rather than accounting income.

| Amount mode | Configuration | Result |
| --- | --- | --- |
| Fixed amount | Positive `amountMinor`; no target | Repeat the configured transfer principal. A destination fee reduces its net credit. |
| Restore target balance | Null fixed amount; nonnegative `targetBalanceMinor`; transfers only | Replenish the destination to its target after any fee. An equal/above-target balance needs no transfer. |

The target is a template setting, separate from category budgets. Balances include opening balance, normal ledger movements, and investment cash effects through the end of the stored occurrence's UTC date. The cutoff is the next day's midnight, so imported intraday movements on that date count and future movements do not. Recorded refunds and other inflows reduce a top-up; a negative balance increases it. Calculations use checked integer minor units, reject overflow, and never reverse the transfer direction. Historical corrections affect later previews but do not rewrite previously generated occurrences.

#### Optional top-up fees

The optional fee preset defaults to zero and its account defaults to **Source account**. **Fee account** permits exactly **Source account** or **Destination account**, stored as a role so changing template accounts keeps that choice coherent. The optional fee category must be user-owned and expense-compatible. A preview can override the amount (including zero for a free occurrence) and role without changing the template. No provider tariff or external wallet API is assumed.

The principal is one normal transfer; a positive fee is a separate linked expense on the chosen account and same accounting date. Transfers remain absent from income/expense totals, while the fee reduces cash and net cashflow once. Generated fee expenses retain their selected category and bypass categorization rules; ordinary recurring expenses retain normal rule behavior.

For a EUR 100 target, EUR 35 balance, and EUR 0.50 fee:

| Fee account | Transfer | Expense | Total source debit | Destination net credit |
| --- | --- | --- | --- | --- |
| Source | EUR 65.00 | EUR 0.50 on source | EUR 65.50 | EUR 65.00 |
| Destination | EUR 65.50 | EUR 0.50 on destination | EUR 65.50 | EUR 65.00 |

Both reach EUR 100 after fees. For fixed templates the principal is unchanged, even with a destination fee. The preview shows the principal, fee and account, source debit, destination net credit, before/after destination balances, target where applicable, occurrence date, and next date.

#### Confirmation and corrections

Confirmation is bound to the authenticated user, stored occurrence, template revision, fee override, and calculated preview by a signed HMAC. Generation recomputes inside serializable isolation, retries serialization conflicts at most twice, then conditionally advances the template and creates principal/fee atomically. A ledger/template change or repeat submission returns a fresh preview for explicit review; it cannot silently generate the following occurrence. Competing replenishment templates also recheck the dated balance.

Generate and skip confirmation submit the complete UTC occurrence timestamp, including milliseconds. Imported intraday `nextDate` values retain their time through confirmation, generated entries, and schedule advancement. Date-only confirmation values remain accepted for existing midnight occurrences.

When the balance is already at or above target, **Skip occurrence** advances once without creating a transfer or fee. It uses the same signed confirmation and conditional advancement. Inactive templates cannot generate or skip. Ownership, currency, input validation, authentication, and CSRF apply throughout.

Each transfer has at most one linked fee expense. PostgreSQL enforces same-user ownership, transfer-parent type, equal dates, and a fee account belonging to that transfer. While linked, their type/date/accounts cannot be changed separately; amounts, descriptions, categories, notes, and tags can be corrected. Deleting a linked transfer requires a confirmation explaining that its fee also disappears. Deleting only the fee leaves the transfer and likewise asks for confirmation. Corrections do not rewind the template schedule.

#### Recurring help, following Rules

Recurring, Edit recurring, and the preview expose a question-mark **How recurring transactions work** control using the shared Rules-style native `details`/`summary` pattern. English/Italian guidance covers scheduling, fixed/target modes, refunds, both fee examples, overrides, confirmation, skipping, reporting, and deletion. Opening help preserves the draft and creates no ledger entries. It has a 44-pixel target, keyboard focus, mobile scrolling, native no-JavaScript operation, and Escape/outside-click dismissal with JavaScript. Amount-mode and fee hints remain next to their controls.

Create/edit forms also explain **Name**, **Description**, and **Fee account** directly on label hover, field focus, or label tap. Name identifies the recurring operation; Description is used for generated transactions, with Name used when Description is blank. Fee account explains which account pays: source fees add to the transfer debit, and destination fees reduce the money received. The same Fee account hint appears in the preview override form. The explanations are localized, linked to their controls for screen readers, and preserve the draft. See [interface guidance](interface-and-accessibility.md).

#### Migration and public backup contract

Migration `20261005000000_add_recurring_top_ups` adds weekly scheduling, amount mode, nullable fixed amount, target and fee settings, conditional checks, and the transfer/fee relationship. Existing rows retain fixed monthly amounts and no fee. Migration `20261006000000_add_recurring_frequencies` adds daily, three-month, and six-month frequency values without rewriting existing schedules. [JSON backup version 12](../operations/json-backup-format.md) exports and restores all five schedules, recurring fields, and fee links; versions 1–10 remain importable as fixed monthly templates with their original amount and no fee preset, and version 11 keeps its monthly/weekly settings. Historical schemas/examples remain published. Application versioning is independent and this implementation does not prepare a release.

Follow-up migration `20261005001000_optimize_transfer_fee_validation` replaces the deferred validation function with separate indexed lookups for the changed fee and any fee linked to the changed parent. Apply it also to databases that already applied the top-up migration. It preserves relationship checks and changes neither ledger data nor the backup schema.

#### Verification

Financial and PostgreSQL tests cover both fee roles, free overrides, skips, dated refunds/future exclusions, checked amounts, stale/repeated confirmations, competing templates, injected fee failure rollback, ownership, conditional constraints, linked corrections/deletion, and out-of-order backup round-trips. `npm run test:recurring` covers localized mobile/desktop light/dark forms and preview, accessibility, keyboard help/draft preservation, and no-JavaScript controls. See [testing and performance](../operations/testing-and-performance.md#recurring-form-and-help-checks) for dated results and commands.

## Related pages

- [`transactions.md`](transactions.md)
- [`../architecture/data-and-financial-model.md`](../architecture/data-and-financial-model.md)
- [`../product/status-and-roadmap.md`](../product/status-and-roadmap.md)

## Sources

- [`project-contract`](../sources.md#sourceproject-contract)
- [`application-source`](../sources.md#sourceapplication-source)
- [`finance-source`](../sources.md#sourcefinance-source)
- [`query-source`](../sources.md#sourcequery-source)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`migrations`](../sources.md#sourcemigrations)
- [`test-suite`](../sources.md#sourcetest-suite)
- [`issue-8`](../sources.md#sourceissue-8)
- [`issue-8-fees`](../sources.md#sourceissue-8-fees)
- [`issue-8-help`](../sources.md#sourceissue-8-help)
