---
title: Interface, Localization, and Accessibility
type: feature
status: current
updated: 2026-10-08
source_ids: [project-contract, application-source, interface-source, finance-source, query-source, package-manifest, test-suite, issue-8-help]
tags: [interface, accessibility, localization, themes]
---

# Interface, Localization, and Accessibility

Pennyworth is a mobile-first traditional web application. The server renders semantic HTML; CSS provides the component system; browser JavaScript is used where it materially improves interaction.

## Rendering model

Fastify renders EJS templates for authenticated pages and forms. Routes return full page responses after validation and service operations. Core forms and navigation remain usable without a client-side state framework.

Approved Lucide icons render server-side. This keeps navigation consistent while preserving the self-only script Content Security Policy. Category forms use a keyboard-accessible visual icon picker, while category references throughout ledger and reporting views combine their saved icon and color with the name instead of exposing storage strings as separate columns. Native select options remain text-only because browsers do not reliably support SVG or other rich option content.

Category badge SVGs stay centered through the shared grid marker. Dashboard spending and budget summary styles target their direct text children so they do not override nested icon geometry. Category names may shrink and wrap beside the badge, keeping long labels inside narrow reporting cards.

## Navigation and responsive behavior

The interface has a grouped sidebar that can collapse to icons on wider screens and become a drawer on mobile. Users can hide feature menu items, but Settings and logout remain available so preferences can always be recovered.

Authenticated pages also expose an account control in the header. Users may keep up to two initials derived from their name or select one of five bundled Terminal Clerk pixel-art characters: Auditor, Archivist, Operator, Courier, or Custodian. The email local part is a defensive initials fallback. The control opens a native-details account panel containing the signed-in identity, Preferences, Security, and logout; lightweight browser behavior closes it on outside click or Escape. Avatar keys resolve only to registered local assets, and unknown stored values fall back safely to initials.

Forms use accessible labels and native controls. Dense tables gain mobile alternatives or constrained overflow behavior. The visual tone favors calm summaries, clear financial sign/color semantics, and fast transaction entry.

Date inputs are constrained to their field width, including iOS native controls. Settings tabs wrap onto additional rows on narrow screens.

Manual transaction entry offers localized Add category/Add tag controls backed by native dialogs. Opening and dismissing them keeps the draft, and saving selects the new record. Dialogs provide autofocus, keyboard dismissal, focus restoration, focused alert messages, success announcements, and responsive light/dark styling; optional category details reuse the approved icon picker. Dismissal is blocked while the bounded save request is pending. Controls stay hidden without JavaScript while normal transaction and taxonomy forms remain available. [Quick-entry browser checks](../operations/testing-and-performance.md#quick-entry-dialog-checks) exercise these states separately from the full-route accessibility sweep.

The category creation control is a quiet plus icon beside the category dropdown, with a localized Add category accessible name and tooltip. Its 44-pixel square target matches the dropdown height; a separate label row keeps Category aligned with Account, including the shared control font size. Keyboard focus has an explicit outline, and the dropdown fills the available width when the enhancement is hidden.

Duplicate creation responses offer a localized **Use existing** button for a compatible saved category or tag. A visible explanation says that existing details will be kept; choosing it announces selection and restores focus to the opener without navigating or clearing the draft. Incompatible categories show a focused error instead. Editing the dialog clears its previous recovery action. This also recovers creations whose successful response was interrupted.

Rules and Edit rule expose a transparent, unframed 44-pixel question-mark control backed by native `details`/`summary`, with an outline for keyboard focus. It opens localized matching and application guidance on tap, click, or keyboard activation, and remains usable without JavaScript. A small enhancement closes it on outside click or Escape and restores focus after Escape. The matching field also has permanent guidance connected with `aria-describedby`; field and help examples use Netflix, Spotify, and Amazon Prime. The rule list offers localized Enable/Disable buttons with rule-specific accessible names alongside its status badges, and works without JavaScript. Transaction creation feedback appears in a server-rendered `role="status"` notice, including applied rule/category and newly added tags when applicable; explicit category choices skip rules.

**Recurring help (issue #8):** Recurring, Edit recurring, and preview use the same question-mark/native-details interaction. English/Italian help explains daily, weekly, monthly, quarterly, and semiannual schedules, fixed and target-balance modes, fees on source or destination, balance examples, preview/confirmation/skipping, reporting, and linked deletion. Opening or dismissing help preserves the form draft. The panel scrolls on mobile, supports keyboard focus and no-JavaScript operation, and keeps short field hints visible. Browser checks also verify fee selectors contain exactly source and destination and that transfer badges meet text contrast requirements. See [recurring templates](automation.md#recurring-help-following-rules).

Recurring create/edit fields align at the top of each grid row, so multiline amount-mode guidance does not push adjacent Amount or Category controls below the selector. The same alignment covers fee fields; the Active checkbox and submit action retain their existing placement, and narrow screens retain the single-column form.

Both recurring account selectors prompt **Choose account** (Italian: **Scegli un conto**). The destination field remains labeled **Destination account** and appears for transfers with JavaScript; users must select the owned account receiving the money rather than leave the empty placeholder selected.

Recurring create/edit **Name** and **Description** labels have a subtle dotted underline and localized explanations on hover. The underline uses a one-pixel dotted border positioned at the bottom of the label, keeping its placement consistent across fonts and labels without shifting the controls. Name identifies the recurring operation in the list; Description is copied to its generated transaction, falling back to Name when blank. **Fee account** uses the same hint in create/edit and preview: a source fee adds to the transfer debit, while a destination fee is deducted from the money received. The same explanations appear when their controls receive keyboard focus or users tap the labels. Each control references its tooltip with `aria-describedby`, keeping the visible label as its accessible name; the Fee account selector also retains the shared fee guidance in create/edit. The popup stays readable while hovered, fits its field width, and follows the light/dark theme. JavaScript adds Escape and outside-click dismissal without changing the draft; hover and focus still work without JavaScript.

Buttons and links in shared row-action groups use the same height, padding, typography, and rounded border. This keeps Delete aligned with Edit, Preview, and other adjacent controls across lists, budget cards, user management, and confirmation pages. Delete retains the red expense/danger palette, including hover and keyboard focus.

The login form includes collapsed forgotten-password guidance. Members are directed to another application administrator for a temporary password; the only administrator is directed to the self-hosted console recovery command. The form does not collect an address or imply that Pennyworth can deliver recovery mail.

Administrators see a Users settings tab. It creates isolated member accounts, shows each generated temporary password only in the immediate response, and offers password reset and access activation controls. A member using a temporary password is restricted to Security until the password is replaced.

Administrators also see a quiet Application settings tab. When the optional server-side update check finds a newer eligible GitHub Release, the installed-version footer becomes a normal link with visible “Update available” text and a small dot; the same link appears in the mobile account menu. Members receive neither the indicator nor update details. The interface does not use a popup, live region, automatic navigation, or client-side GitHub request.

## Deletion confirmations

Every Delete action uses a shared server-rendered review page: accounts, transactions, categories, tags, budgets, rules, recurring templates, assets, asset prices, manual holdings, and investment activity. The page identifies the record, shows relevant dates, accounts, types, or money values, and explains affected records. English and Italian controls offer **Cancel** and **Confirm deletion**, using the existing action-control sizing and themes.

The first POST only reads the current user's record and renders the review. The destructive handler requires the explicit scalar `confirmDelete=yes` value submitted by the confirmation button. Missing, invalid, or repeated values return to review. Both requests retain authentication, ownership, and CSRF checks, and the flow remains usable with JavaScript disabled. Cancel is a normal link and changes no records.

Used accounts and assets retain their existing inactivation behavior after confirmation; unused ones are deleted. Deleting a recurring template or rule keeps existing transactions. Tag deletion removes its associations while keeping transactions and rules. Linked transfer/fee reviews preserve their specific deletion explanations. See [transactions](transactions.md#transaction-lifecycle) and [security](../architecture/security-and-privacy.md#ownership-and-database-integrity).

## Dashboard hierarchy

The default dashboard uses a small set of server-rendered widgets rather than presenting every available report at equal weight. Net worth and current-month cashflow form the primary overview. Recent transactions remain prominent, while category spending and account balances are intentionally limited previews that link to their detailed pages.

The conditional "Needs attention" widget appears only when a category budget is at least 80% used or an active recurring transaction is due within seven days. Over-budget items are prioritized. Investment value remains visible as part of the net-worth breakdown; detailed investment performance stays on the investment and statistics pages. Empty secondary states do not create additional panels.

The widget markup and CSS are separated by responsibility so persisted visibility and ordering can be added later. User dashboard customization is not implemented in the current version.

## Themes

Current appearances are `light` and `dark`. Theme values are CSS custom properties in `src/public/styles.css`; the allowed preference list lives in `src/lib/preferences.ts`. The selected theme and avatar key are stored on `User`. Theme selection is written before styles load to avoid a visible flash, while the avatar key is normalized server-side before rendering. Settings previews a theme choice immediately and persists the complete preference set on submit.

Migration `20260716001000_replace_legacy_themes` mapped former theme experiments to the two supported values.

## Localization

Current interface languages are English and Italian. English is the fallback. Static template text and translatable accessibility attributes are localized before EJS compilation through `src/lib/localizedEjs.ts`; user-authored and calculated values are left intact. Translation data and preference normalization live under `src/lib/`.

Translation placeholders are substituted once, with values inserted literally. Rule, category, and tag names in transaction notices retain dollar sequences and placeholder-shaped text; missing values leave their placeholders unchanged.

Dynamic account, category, transaction, asset, and investment activity types use the shared `createTypeLabelFormatter` in `src/lib/i18n.ts`. Labels are translated, start with a capital letter, replace storage underscores with spaces, and preserve `ETF` as an acronym. Select option values, badge classes, database enums, CSV values, and backup fields retain their original identifiers. User-authored names are displayed unchanged.

Add rule and Edit rule translate server-side validation errors into the selected interface language before HTML-escaped rendering, including malformed matching syntax and missing matching terms.

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
- [`issue-8-help`](../sources.md#sourceissue-8-help)
