import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import axe from "axe-core";
import ejs from "ejs";
import { createMoneyFormatter } from "../src/finance/money.js";
import { createTranslator, createTypeLabelFormatter } from "../src/lib/i18n.js";
import { renderCategoryLabel, renderIcon } from "../src/lib/icons.js";
import { localizeEjsTemplate } from "../src/lib/localizedEjs.js";

const templates = new Map(["index", "edit", "preview"].map((name) => {
  const filename = path.resolve(`src/views/recurring/${name}.ejs`);
  return [name, ejs.compile(localizeEjsTemplate(readFileSync(filename, "utf8")), { filename })];
}));
const recurring = {
  id: "wallet-top-up", name: "Wallet top-up", type: "transfer", frequency: "weekly", amountMode: "target_balance",
  amountMinor: null, targetBalanceMinor: 10000, feeAmountMinor: 50, feeAccount: "destination", feeCategoryId: "fees",
  sourceAccountId: "bank", destinationAccountId: "wallet", categoryId: null,
  sourceAccount: { name: "Bank" }, destinationAccount: { name: "Wallet" }, category: null,
  nextDate: new Date("2026-10-05T00:00:00Z"), updatedAt: new Date("2026-10-05T10:00:00Z"), isActive: true
};
let posts = 0;
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "POST") posts += 1;
  if (["/public/app.js", "/public/styles.css"].includes(url.pathname)) {
    response.setHeader("Content-Type", url.pathname.endsWith("css") ? "text/css" : "application/javascript");
    response.end(readFileSync(path.resolve(`src${url.pathname}`)));
    return;
  }
  const language = url.searchParams.get("language") === "it" ? "it" : "en";
  const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
  const name = url.pathname.endsWith("preview") ? "preview" : url.pathname.endsWith("edit") ? "edit" : "index";
  const html = templates.get(name)!({
    csrfToken: "fixture-token", error: null, t: createTranslator(language), typeLabel: createTypeLabelFormatter(language),
    formatMoney: createMoneyFormatter("EUR"), icon: renderIcon, categoryLabel: renderCategoryLabel,
    recurring, recurringTransactions: [recurring], transactionTypes: ["income", "expense", "transfer"],
    recurringFrequencies: ["monthly", "weekly"], accounts: [{ id: "bank", name: "Bank" }, { id: "wallet", name: "Wallet" }],
    categories: [{ id: "fees", name: "Fees", type: "expense" }, { id: "salary", name: "Salary", type: "income" }],
    form: { ...recurring, amount: "65.00", targetBalance: "100.00", feeAmount: "0.50", nextDate: "2026-10-05", description: "", notes: "" },
    preview: { recurring, transferAmountMinor: 6550, feeAmountMinor: 50, requestedFeeAmountMinor: 50, feeAccount: "destination",
      sourceDebitMinor: 6550, destinationCreditMinor: 6500, destinationBalanceMinor: 3500, destinationAfterMinor: 10000,
      nextDate: new Date("2026-10-12T00:00:00Z"), signature: "a".repeat(64) }
  });
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang="${language}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Recurring</title><link rel="stylesheet" href="/public/styles.css"><script src="/public/app.js" defer></script></head><body><main>${html}</main></body></html>`);
});

async function assertAccessible(page: Page) {
  const result = await page.evaluate(axe.source + "; axe.run()") as { violations: Array<{ id: string; nodes: unknown[] }> };
  assert.deepEqual(result.violations, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Horizontal overflow");
}
async function draft(page: Page) {
  return page.locator("[data-recurring-form]").evaluate((form) => Array.from(new FormData(form as HTMLFormElement).entries()));
}

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let checked = 0;
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 320]) for (const language of ["en", "it"] as const) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const t = createTranslator(language);
    for (const name of ["index", "edit"]) {
      await page.goto(`${baseUrl}/${name}?language=${language}&theme=${theme}`);
      if (name === "index" && language === "en" && theme === "dark" && width === 1440) {
        await page.locator(".panel").last().screenshot({ path: path.join(tmpdir(), "pennyworth-recurring-actions.png") });
      }
      const form = page.locator("[data-recurring-form]");
      await form.locator('[name="name"]').fill("Keep <literal> $& draft");
      await form.locator('[name="notes"]').fill("Notes\nSecond line");
      const initialDraft = await draft(page);
      assert.equal(await form.locator('[data-source-account-text]').textContent(), t("Source account"));
      assert.deepEqual(await form.locator('[name="feeAccount"] option').evaluateAll((options) => options.map((item) => (item as HTMLOptionElement).value)), ["source", "destination"]);
      assert(await form.locator('[name="amount"]').isDisabled());
      assert(await form.locator('[name="targetBalance"]').isVisible());
      const help = page.locator("[data-page-help]");
      const summary = help.locator("summary");
      assert.equal(await summary.getAttribute("aria-label"), t("How recurring transactions work"));
      await summary.focus();
      await page.keyboard.press("Enter");
      assert(await help.evaluate((item) => (item as HTMLDetailsElement).open));
      await assertAccessible(page);
      const region = help.locator('[role="region"]');
      assert((await region.textContent())?.includes(t("Example: a target of EUR 100 and a balance of EUR 35 require a EUR 65 top-up.")));
      assert(await region.evaluate((element) => element.scrollHeight >= element.clientHeight));
      await page.keyboard.press("Escape");
      assert.equal(await help.evaluate((item) => (item as HTMLDetailsElement).open), false);
      assert(await summary.evaluate((item) => item === document.activeElement));
      assert.deepEqual(await draft(page), initialDraft);
      await summary.click();
      await page.locator('h1').click();
      assert.equal(await help.evaluate((item) => (item as HTMLDetailsElement).open), false);
      assert.deepEqual(await draft(page), initialDraft);
      await form.locator('[name="amountMode"]').selectOption("fixed");
      assert(await form.locator('[name="targetBalance"]').isDisabled());
      assert(await form.locator('[name="amount"]').isVisible());
      await form.locator('[name="type"]').selectOption("expense");
      assert(await form.locator('[name="amountMode"]').isDisabled());
      assert(await form.locator('[name="feeAmount"]').isDisabled());
      assert(await form.locator('[data-recurring-fees]').isHidden());
      if (name === "index" && language === "en" && theme === "dark" && width === 1440) {
        await page.locator("main").evaluate((element) => { element.style.maxWidth = "790px"; });
        await page.locator(".panel").first().screenshot({ path: path.join(tmpdir(), "pennyworth-recurring-grid.png") });
        await page.locator("main").evaluate((element) => { element.style.maxWidth = ""; });
      }
      await form.locator('[name="type"]').selectOption("transfer");
      await form.locator('[name="amountMode"]').selectOption("target_balance");
      await assertAccessible(page);
      if (name === "edit" && language === "it" && theme === "dark" && width === 320) {
        await page.screenshot({ path: path.join(tmpdir(), "pennyworth-issue8-mobile.png"), fullPage: true });
        await summary.click();
        await page.screenshot({ path: path.join(tmpdir(), "pennyworth-issue8-help.png") });
      }
      checked += 1;
    }
    await page.goto(`${baseUrl}/preview?language=${language}&theme=${theme}`);
    assert((await page.locator("dl").textContent())?.includes(t("Destination net credit")));
    assert.equal(await page.locator('button[type="submit"]').last().textContent(), t("Confirm and generate"));
    await page.locator('[data-page-help] summary').click();
    await assertAccessible(page);
    assert.deepEqual(errors, []);
    await context.close();
    checked += 1;
  }
  for (const language of ["en", "it"] as const) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
    const page = await context.newPage();
    for (const name of ["index", "edit", "preview"]) {
      await page.goto(`${baseUrl}/${name}?language=${language}`);
      await page.locator('[data-page-help] summary').click();
      assert(await page.locator('[data-page-help] h2').isVisible());
      await page.locator('[data-page-help] summary').click();
      assert(await page.locator('[data-page-help] h2').isHidden());
      if (name !== "preview") {
        await page.locator('[name="amountMode"]').selectOption("fixed");
        await page.locator('[name="feeAccount"]').selectOption("source");
        assert.equal(await page.locator('[name="amount"]').inputValue(), "65.00");
      }
      checked += 1;
    }
    await context.close();
  }
  assert.equal(posts, 0, "Help and form controls must not mutate ledger or schedule");
  console.log(`Recurring browser checks passed: ${checked} page configurations, including English/Italian, mobile, both themes, keyboard, accessibility and no JavaScript.`);
  console.log(`Screenshots: ${path.join(tmpdir(), "pennyworth-issue8-mobile.png")}, ${path.join(tmpdir(), "pennyworth-issue8-help.png")}`);
} finally {
  await browser?.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
