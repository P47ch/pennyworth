---
title: Interface, Localization, and Accessibility
type: feature
status: current
updated: 2026-09-18
source_ids: [project-contract, application-source, interface-source, finance-source, query-source, package-manifest, test-suite]
tags: [interface, accessibility, localization, themes]
---

# Interface, Localization, and Accessibility

Pennyworth is a mobile-first traditional web application. The server renders semantic HTML; CSS provides the component system; browser JavaScript is used where it materially improves interaction.

## Rendering model

Fastify renders EJS templates for authenticated pages and forms. Routes return full page responses after validation and service operations. Core forms and navigation remain usable without a client-side state framework.

Approved Lucide icons render server-side. This keeps navigation consistent while preserving the self-only script Content Security Policy. Category forms use a keyboard-accessible visual icon picker, while category references throughout ledger and reporting views combine their saved icon and color with the name instead of exposing storage strings as separate columns. Native select options remain text-only because browsers do not reliably support SVG or other rich option content.

## Navigation and responsive behavior

The interface has a grouped sidebar that can collapse to icons on wider screens and become a drawer on mobile. Users can hide feature menu items, but Settings and logout remain available so preferences can always be recovered.

Authenticated pages also expose an account control in the header. Users may keep up to two initials derived from their name or select one of five bundled Terminal Clerk pixel-art characters: Auditor, Archivist, Operator, Courier, or Custodian. The email local part is a defensive initials fallback. The control opens a native-details account panel containing the signed-in identity, Preferences, Security, and logout; lightweight browser behavior closes it on outside click or Escape. Avatar keys resolve only to registered local assets, and unknown stored values fall back safely to initials.

Forms use accessible labels and native controls. Dense tables gain mobile alternatives or constrained overflow behavior. The visual tone favors calm summaries, clear financial sign/color semantics, and fast transaction entry.

The login form includes collapsed forgotten-password guidance. Members are directed to another application administrator for a temporary password; the only administrator is directed to the self-hosted console recovery command. The form does not collect an address or imply that Pennyworth can deliver recovery mail.

Administrators see a Users settings tab. It creates isolated member accounts, shows each generated temporary password only in the immediate response, and offers password reset and access activation controls. A member using a temporary password is restricted to Security until the password is replaced.

Administrators also see a quiet Application settings tab. When the optional server-side update check finds a newer eligible GitHub Release, the installed-version footer becomes a normal link with visible “Update available” text and a small dot; the same link appears in the mobile account menu. Members receive neither the indicator nor update details. The interface does not use a popup, live region, automatic navigation, or client-side GitHub request.

## Dashboard hierarchy

The default dashboard uses a small set of server-rendered widgets rather than presenting every available report at equal weight. Net worth and current-month cashflow form the primary overview. Recent transactions remain prominent, while category spending and account balances are intentionally limited previews that link to their detailed pages.

The conditional "Needs attention" widget appears only when a category budget is at least 80% used or an active recurring transaction is due within seven days. Over-budget items are prioritized. Investment value remains visible as part of the net-worth breakdown; detailed investment performance stays on the investment and statistics pages. Empty secondary states do not create additional panels.

The widget markup and CSS are separated by responsibility so persisted visibility and ordering can be added later. User dashboard customization is not implemented in the current version.

## Themes

Current appearances are `light` and `dark`. Theme values are CSS custom properties in `src/public/styles.css`; the allowed preference list lives in `src/lib/preferences.ts`. The selected theme and avatar key are stored on `User`. Theme selection is written before styles load to avoid a visible flash, while the avatar key is normalized server-side before rendering. Settings previews a theme choice immediately and persists the complete preference set on submit.

Migration `20260716001000_replace_legacy_themes` mapped former theme experiments to the two supported values.

## Localization

Current interface languages are English and Italian. English is the fallback. Static template text and translatable accessibility attributes are localized before EJS compilation through `src/lib/localizedEjs.ts`; user-authored and calculated values are left intact. Translation data and preference normalization live under `src/lib/`.

## Statistics interaction

The statistics page uses Chart.js for four 12-month visualizations: month-end net worth with togglable total, cash, and investment series; per-account month-end balances; combined monthly cashflow; and stacked monthly spending for the top five categories plus `Other`. Each graph provides 3-, 6-, and 12-month range controls, localized currency tooltips, reduced-motion behavior, and an expandable accessible data table so the canvas is not the only representation of financial results. Series buttons allow individual accounts and categories to be hidden without removing them from the table.

## Accessibility verification

`npm run audit:a11y` drives authenticated desktop and mobile Chromium sessions with Playwright and axe-core. It checks main routes for axe violations, console/page/request failures, strict CSP, a single page-level heading, and visible horizontal overflow.

The last recorded local sweep on 2026-07-18 covered 16 authenticated routes in desktop and mobile viewports with zero accessibility failures. This is dated evidence, not a permanent guarantee; rerun it after template, navigation, CSS, or browser-script changes.

## Related pages

- [`../architecture/system-overview.md`](../architecture/system-overview.md)
- [`../architecture/security-and-privacy.md`](../architecture/security-and-privacy.md)
- [`../operations/testing-and-performance.md`](../operations/testing-and-performance.md)

## Sources

- [`project-contract`](../sources.md#sourceproject-contract)
- [`application-source`](../sources.md#sourceapplication-source)
- [`interface-source`](../sources.md#sourceinterface-source)
- [`finance-source`](../sources.md#sourcefinance-source)
- [`query-source`](../sources.md#sourcequery-source)
- [`package-manifest`](../sources.md#sourcepackage-manifest)
- [`test-suite`](../sources.md#sourcetest-suite)
