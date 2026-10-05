---
title: Categories, Budgets, Rules, and Recurring Templates
type: feature
status: current
updated: 2026-10-02
source_ids: [project-contract, application-source, finance-source, database-schema, migrations, test-suite]
tags: [categories, tags, budgets, rules, recurring]
---

# Categories, Budgets, Rules, and Recurring Templates

Pennyworth keeps automation visible and user-controlled. Categories and tags organize records; budgets summarize spending; rules propose categorization; recurring templates generate only when the user asks.

## Categories and tags

Categories are structured reporting groups with name, type, optional parent, color, and icon. Types are `income`, `expense`, and `both`. A transaction has at most one category. Category forms expose a validated visual Lucide icon catalog rather than accepting arbitrary icon strings; existing unknown values display with a safe fallback until edited.

Parent categories must belong to the same user. A category cannot parent itself or use a descendant as its parent. Existing cyclic data is rejected during parent validation, and JSON restore rejects a cyclic category graph before replacing records.

Tags are flexible name/color metadata with many-to-many transaction relationships. Category and tag lists present colors as visual identity cues instead of raw hexadecimal text. The same compact category identity appears with transaction, recurring, rule, budget, dashboard, statistics, and CSV preview references; native select options remain text because browsers do not reliably support rich option content. Tag junction rows carry `userId`, so the database can prevent a cross-user link even through direct SQL.

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

Recurring templates currently support monthly `income`, `expense`, and `transfer` shapes. They store the next accounting date and active state.

There is no background scheduler. The user selects **Generate**, which creates the next normal transaction through validated service logic and advances the template by one UTC calendar month. End-of-month dates clamp to the last valid day of the next month.

## Related pages

- [`transactions.md`](transactions.md)
- [`../architecture/data-and-financial-model.md`](../architecture/data-and-financial-model.md)
- [`../product/status-and-roadmap.md`](../product/status-and-roadmap.md)

## Sources

- [`project-contract`](../sources.md#sourceproject-contract)
- [`application-source`](../sources.md#sourceapplication-source)
- [`finance-source`](../sources.md#sourcefinance-source)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`migrations`](../sources.md#sourcemigrations)
- [`test-suite`](../sources.md#sourcetest-suite)
