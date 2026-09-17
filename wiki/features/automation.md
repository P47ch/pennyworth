---
title: Categories, Budgets, Rules, and Recurring Templates
type: feature
status: current
updated: 2026-09-04
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
- case-insensitive match text;
- expense-compatible category;
- integer priority;
- active state;
- optional tags.

Active rules are evaluated in priority order against description and notes. They apply during CSV preview only when an expense row has no category. A supplied category is never overridden. The UI can also preview rules against existing uncategorized expenses before changes are applied, keeping behavior visible and reversible.

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
