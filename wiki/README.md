---
title: Pennyworth LLM Wiki
type: overview
status: current
updated: 2026-07-19
source_ids: [project-contract, package-manifest, application-source, llm-wiki-pattern]
tags: [pennyworth, overview, knowledge-base]
---

# Pennyworth LLM Wiki

This is the maintained knowledge layer for Pennyworth: a private, self-hosted personal-finance web application. It follows Andrej Karpathy's LLM Wiki pattern: repository sources remain authoritative, an LLM maintains focused and interlinked Markdown pages, and [`AGENTS.md`](AGENTS.md) defines the operating contract.

## Start here

- [`index.md`](index.md) — complete catalog of wiki pages.
- [`product/product-brief.md`](product/product-brief.md) — product purpose, users, scope, and principles.
- [`product/status-and-roadmap.md`](product/status-and-roadmap.md) — implemented capabilities, verification state, and genuine backlog.
- [`architecture/system-overview.md`](architecture/system-overview.md) — runtime structure and request flow.
- [`architecture/data-and-financial-model.md`](architecture/data-and-financial-model.md) — accounting rules, persistence model, and derived investment state.
- [`architecture/security-and-privacy.md`](architecture/security-and-privacy.md) — security boundaries and operational requirements.
- [`operations/local-development.md`](operations/local-development.md) — local setup and database topologies.
- [`operations/deployment.md`](operations/deployment.md) — private-LAN production deployment runbooks.

## Current thesis

Pennyworth stays understandable by treating financial rules as explicit domain logic, using PostgreSQL as the integrity boundary, and keeping the web layer server-rendered. The current implementation extends beyond the original cash-accounting MVP into budgets, categorization rules, recurring templates, investments, backups, localization, and accessibility verification without changing that core architecture.

## How to use this wiki

For a question, read [`index.md`](index.md) first, then follow the smallest relevant page set. For implementation work, verify claims against the source IDs in each page and [`sources.md`](sources.md). For a new source or a durable synthesis, follow the ingest workflow in [`AGENTS.md`](AGENTS.md) and append the operation to [`log.md`](log.md).

The wiki is optimized for both people and coding agents. Standard relative Markdown links keep it usable in GitHub, editors, and Obsidian without a special runtime.

## Sources

- [`project-contract`](sources.md#sourceproject-contract)
- [`package-manifest`](sources.md#sourcepackage-manifest)
- [`application-source`](sources.md#sourceapplication-source)
- [`llm-wiki-pattern`](sources.md#sourcellm-wiki-pattern)
