import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Page, type Route } from "@playwright/test";
import axe from "axe-core";
import ejs from "ejs";
import { createTranslator, createTypeLabelFormatter } from "../src/lib/i18n.js";
import { categoryIconOptions, renderCategoryIcon, renderCategoryLabel, renderColorSwatch, renderIcon } from "../src/lib/icons.js";
import { localizeEjsTemplate } from "../src/lib/localizedEjs.js";

const filename = path.resolve("src/views/transactions/index.ejs");
const render = ejs.compile(localizeEjsTemplate(readFileSync(filename, "utf8")), { filename });
const token = "fixture-csrf-token";
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'");
  if (["/public/app.js", "/public/quick-taxonomy.js", "/public/styles.css"].includes(url.pathname)) {
    response.setHeader("Content-Type", url.pathname.endsWith(".css") ? "text/css" : "application/javascript");
    response.end(readFileSync(path.resolve(`src${url.pathname}`)));
    return;
  }
  const language = url.searchParams.get("language") === "it" ? "it" : "en";
  const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
  const empty = url.searchParams.get("empty") === "true";
  const html = render({
    csrfToken: token, error: null, notice: null, t: createTranslator(language), typeLabel: createTypeLabelFormatter(language),
    icon: renderIcon, categoryIcon: renderCategoryIcon, categoryLabel: renderCategoryLabel, colorSwatch: renderColorSwatch,
    categoryTypes: ["income", "expense", "both"], categoryIconOptions,
    transactionTypes: ["income", "expense", "transfer"],
    accounts: [{ id: "bank", name: "Bank" }, { id: "cash", name: "Cash" }],
    categories: empty ? [] : [{ id: "food", name: "Food", type: "expense" }, { id: "salary", name: "Salary", type: "income" }],
    tags: empty ? [] : [{ id: "existing-tag", name: "Existing" }],
    form: { type: "expense", date: "2026-10-05", amount: "", sourceAccountId: "", destinationAccountId: "", categoryId: "", description: "", notes: "", tagIds: [] },
    filters: { typeValue: "", accountIdValue: "", categoryIdValue: "", tagIdValue: "", fromValue: "", toValue: "", searchValue: "" },
    pagination: { totalCount: 0 }, transactions: [], primaryCurrency: "EUR"
  });
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang="${language}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Quick entry</title><link rel="stylesheet" href="/public/styles.css"><script src="/public/app.js" defer></script></head><body><main>${html}</main></body></html>`);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
let checked = 0;

async function draft(page: Page) {
  return page.locator("[data-transaction-form]").evaluate((form) => {
    const data = new FormData(form as HTMLFormElement);
    return {
      type: data.get("type"), date: data.get("date"), amount: data.get("amount"), account: data.get("sourceAccountId"),
      description: data.get("description"), notes: data.get("notes"), category: data.get("categoryId"), tags: data.getAll("tagIds")
    };
  });
}

async function assertAccessible(page: Page) {
  const results = await page.evaluate(axe.source + "; axe.run()") as { violations: Array<{ id: string; nodes: unknown[] }> };
  assert.deepEqual(results.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes })), []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Horizontal overflow");
}

try {
  for (const width of [1440, 320]) {
    for (const language of ["en", "it"] as const) {
      for (const theme of ["light", "dark"]) {
        const empty = theme === "dark";
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        const t = createTranslator(language);
        let mode = "success";
        let requests = 0;
        const persisted = new Map<string, { id: string; name: string; type?: string }>();
        let creations = 0;
        let releaseRequest: (() => void) | undefined;
        await page.route("**/*/quick", async (route: Route) => {
          requests += 1;
          const values = new URLSearchParams(route.request().postData() ?? "");
          assert.equal(values.get("csrfToken"), token);
          const kind = route.request().url().includes("/categories/") ? "category" : "tag";
          if (mode === "lost-response" || mode === "retry-lost-response") {
            const name = values.get("name")!.trim();
            const key = `${kind}:${name}`;
            const existing = persisted.get(key);
            if (existing) return route.fulfill({ status: 409, json: {
              error: t(kind === "category" ? "A category with that name already exists." : "A tag with that name already exists."), existing
            } });
            const record = { id: `recovered-${kind}`, name, ...(kind === "category" ? { type: values.get("type")! } : {}) };
            persisted.set(key, record);
            creations += 1;
            // Persist, then lose the network response or truncate its JSON body.
            if (kind === "category") return route.abort("failed");
            return route.fulfill({ status: 201, contentType: "application/json", body: "{" });
          }
          if (mode === "incompatible") return route.fulfill({ status: 409, json: {
            error: t("A category with that name already exists."), existing: { id: "existing-income", name: values.get("name"), type: "income" }
          } });
          if (mode === "network") return route.abort("failed");
          if (mode === "session") return route.fulfill({ status: 302, headers: { location: "/login" } });
          if (mode === "csrf") return route.fulfill({ status: 403, contentType: "text/plain", body: "Invalid CSRF token." });
          if (mode === "html") return route.fulfill({ status: 500, contentType: "text/html", body: "Unexpected error" });
          if (mode === "malformed") return route.fulfill({ status: 200, contentType: "application/json", body: "{" });
          if (mode === "duplicate") return route.fulfill({ status: 409, json: { error: t("A tag with that name already exists.") } });
          if (mode === "busy") await new Promise<void>((resolve) => { releaseRequest = resolve; });
          return route.fulfill({ status: 201, json: { [kind]: { id: `created-${kind}-${requests}`, name: values.get("name"), ...(kind === "category" ? { type: values.get("type") } : {}) } } });
        });
        await page.goto(`${baseUrl}/transactions?language=${language}&theme=${theme}&empty=${empty}`);
        const form = page.locator("[data-transaction-form]");
        await form.locator('[name="amount"]').fill("12.34");
        await form.locator('[name="sourceAccountId"]').selectOption("bank");
        await form.locator('[name="description"]').fill("Keep <literal> $& description");
        await form.locator('[name="notes"]').fill("Keep all notes\nSecond line");
        if (!empty) await form.locator('[name="tagIds"]').check();
        const initialDraft = await draft(page);

        if (width === 1440 && language === "en" && theme === "dark") {
          const screenshot = path.join(tmpdir(), "pennyworth-issue6-quick-entry.png");
          await page.locator(".panel").first().screenshot({ path: screenshot });
          console.log(`Quick-entry screenshot: ${screenshot}`);
        }

        const categoryButton = page.locator('[data-quick-taxonomy-open="category"]');
        const categoryDialog = page.locator('#quick-category-dialog');
        await categoryButton.click();
        assert.equal(await categoryDialog.locator('[name="type"]').inputValue(), "expense");
        assert(await categoryDialog.locator('[name="type"] option[value="income"]').evaluate((option) => (option as HTMLOptionElement).disabled), "Income must be unavailable for expenses");
        assert(await categoryDialog.locator('[name="name"]').evaluate((input) => input === document.activeElement));
        await categoryDialog.locator("summary").click();
        await assertAccessible(page);
        if (width === 320 && language === "it" && theme === "dark") {
          const screenshot = path.join(tmpdir(), "pennyworth-issue6-mobile-dialog.png");
          await page.screenshot({ path: screenshot });
          console.log(`Dialog screenshot: ${screenshot}`);
        }
        await page.keyboard.press("Escape");
        assert(await categoryButton.evaluate((button) => button === document.activeElement));
        assert.deepEqual(await draft(page), initialDraft);
        await categoryButton.click();
        const literalName = '<img src=x onerror="alert(1)"> Food $&';
        await categoryDialog.locator('[name="name"]').fill(literalName);
        await categoryDialog.locator('button[type="submit"]').click();
        await categoryDialog.waitFor({ state: "hidden" });
        const categoryDraft = await draft(page);
        assert.deepEqual({ ...categoryDraft, category: initialDraft.category }, initialDraft);
        assert.equal(await form.locator('[name="categoryId"] option:checked').textContent(), literalName);
        assert.equal(await form.locator("img").count(), 0);
        assert.equal(await categoryDialog.locator('[name="parentId"] option').last().textContent(), literalName);

        const tagButton = page.locator('[data-quick-taxonomy-open="tag"]');
        const tagDialog = page.locator('#quick-tag-dialog');
        await tagButton.click();
        await assertAccessible(page);
        await tagDialog.locator('[name="name"]').fill("Travel <literal> $&");
        await tagDialog.locator('button[type="submit"]').click();
        await tagDialog.waitFor({ state: "hidden" });
        let taggedDraft = await draft(page);
        assert.deepEqual({ ...taggedDraft, tags: categoryDraft.tags }, categoryDraft);
        assert.equal(taggedDraft.tags.length, categoryDraft.tags.length + 1);
        assert(taggedDraft.tags.includes("created-tag-2"));

        for (const kind of ["category", "tag"] as const) {
          const button = kind === "category" ? categoryButton : tagButton;
          const dialog = kind === "category" ? categoryDialog : tagDialog;
          const beforeDraft = await draft(page);
          const beforeCreations = creations;
          const name = `Lost ${kind} <literal> $&`;
          const useExisting = dialog.locator("[data-use-existing]");
          mode = "lost-response";
          await button.click();
          await dialog.locator('[name="name"]').fill(name);
          if (kind === "category") await dialog.locator('[name="type"]').selectOption("both");
          await dialog.locator('button[type="submit"]').click();
          await dialog.locator("[data-quick-taxonomy-error]").waitFor({ state: "visible" });
          assert.equal(creations, beforeCreations + 1);
          assert(await useExisting.isHidden());
          assert.deepEqual(await draft(page), beforeDraft);

          mode = "retry-lost-response";
          if (kind === "category") await dialog.locator('[name="type"]').selectOption("expense");
          await dialog.locator('button[type="submit"]').click();
          await useExisting.waitFor({ state: "visible" });
          assert.equal(await useExisting.textContent(), t("Use existing"));
          assert((await dialog.locator("[data-quick-taxonomy-existing]").textContent())?.includes(t("Use the saved item with this name. Its existing details will be kept.")));
          assert.deepEqual(await draft(page), beforeDraft, "A duplicate must not silently select or change the draft");
          assert.equal(await form.locator(`[value="recovered-${kind}"]`).count(), 0);
          await assertAccessible(page);

          // Editing a failed request must not leave an action for the previous name.
          await dialog.locator('[name="name"]').fill("Different name");
          assert(await useExisting.isHidden());
          await dialog.locator('[name="name"]').fill(name);
          await dialog.locator('button[type="submit"]').click();
          await useExisting.waitFor({ state: "visible" });
          const beforeUse = requests;
          await useExisting.click();
          await dialog.waitFor({ state: "hidden" });
          assert.equal(requests, beforeUse, "Use existing must reuse the returned record");
          assert.equal(creations, beforeCreations + 1, "A lost response retry must persist exactly one record");
          const recoveredDraft = await draft(page);
          assert.deepEqual(recoveredDraft, kind === "category" ?
            { ...beforeDraft, category: "recovered-category" } : { ...beforeDraft, tags: [...beforeDraft.tags, "recovered-tag"] });
          assert.equal(await form.locator("[data-quick-taxonomy-status]").textContent(), t(kind === "category" ? "Existing category selected." : "Existing tag selected."));
          assert(await button.evaluate((element) => element === document.activeElement));
          await button.click();
          assert(await useExisting.isHidden(), "A reopened dialog must clear its recovery candidate");
          await dialog.locator("[data-dialog-cancel]").click();
        }
        assert.equal(persisted.size, 2);
        taggedDraft = await draft(page);
        mode = "incompatible";
        await categoryButton.click();
        await categoryDialog.locator('[name="name"]').fill("Conflicting category");
        await categoryDialog.locator('button[type="submit"]').click();
        await categoryDialog.locator("[data-quick-taxonomy-error]").waitFor({ state: "visible" });
        const conflictMessage = await categoryDialog.locator("[data-quick-taxonomy-error]").textContent();
        assert(conflictMessage?.includes(t("This category cannot be used for this transaction type. Choose a different name.")), JSON.stringify({ width, language, theme, conflictMessage }));
        assert(await categoryDialog.locator("[data-use-existing]").isHidden());
        assert.equal(await form.locator('[value="existing-income"]').count(), 0);
        assert.deepEqual(await draft(page), taggedDraft);
        await assertAccessible(page);
        await categoryDialog.locator("[data-dialog-cancel]").click();
        mode = "success";

        if (width === 1440 && language === "en" && theme === "light") {
          for (const failure of ["duplicate", "network", "session", "csrf", "html", "malformed"]) {
            mode = failure;
            await tagButton.click();
            await tagDialog.locator('[name="name"]').fill("Failure retains draft");
            await tagDialog.locator('button[type="submit"]').click();
            await tagDialog.locator('[data-quick-taxonomy-error]').waitFor({ state: "visible" });
            assert.deepEqual(await draft(page), taggedDraft);
            assert.equal(await tagDialog.locator('[name="name"]').inputValue(), "Failure retains draft");
            assert.equal(page.url().includes("/transactions"), true);
            assert(await tagDialog.locator('[data-quick-taxonomy-error]').evaluate((error) => error === document.activeElement));
            await assertAccessible(page);
            await tagDialog.locator('[data-dialog-cancel]').click();
          }
          mode = "busy";
          await tagButton.click();
          await tagDialog.locator('[name="name"]').fill("One request");
          const before = requests;
          await tagDialog.locator("form").evaluate((element) => {
            element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          });
          await tagDialog.locator('button[type="submit"]:disabled').waitFor();
          await page.keyboard.press("Escape");
          assert(await tagDialog.isVisible());
          await page.waitForFunction(() => document.querySelector('#quick-tag-dialog form')?.getAttribute("aria-busy") === "true");
          // Wait until the intercepted request is available before releasing it.
          const deadline = Date.now() + 10_000;
          while (!releaseRequest && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
          assert(releaseRequest, "Pending request was not intercepted");
          assert.equal(requests, before + 1);
          releaseRequest();
          await tagDialog.waitFor({ state: "hidden" });
          mode = "success";
        }

        await form.locator('[name="type"]').selectOption("income");
        assert.equal(await form.locator('[name="categoryId"]').inputValue(), "recovered-category", "A recovered both-type category remains compatible");
        await form.locator('[name="type"]').selectOption("expense");
        await form.locator('[name="categoryId"]').selectOption("created-category-1");
        await form.locator('[name="type"]').selectOption("income");
        assert.equal(await form.locator('[name="categoryId"]').inputValue(), "");
        await categoryButton.click();
        assert.equal(await categoryDialog.locator('[name="type"]').inputValue(), "income");
        assert(await categoryDialog.locator('[name="type"] option[value="expense"]').evaluate((option) => (option as HTMLOptionElement).disabled), "Expense must be unavailable for income");
        await categoryDialog.locator('[data-dialog-cancel]').click();
        await form.locator('[name="type"]').selectOption("transfer");
        assert(await categoryButton.isHidden());
        assert(await form.locator('[name="categoryId"]').isDisabled());
        assert(await tagButton.isVisible());
        assert.deepEqual(pageErrors, []);
        await context.close();
        checked += 1;
      }
    }
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/transactions`);
  assert(await page.locator('[data-quick-taxonomy-open="category"]').isHidden());
  assert(await page.locator('[data-quick-taxonomy-open="tag"]').isHidden());
  assert(await page.locator('[data-transaction-form] button[type="submit"]').isVisible());
  await context.close();
  console.log(`Quick taxonomy browser checks passed: ${checked} English/Italian desktop/mobile light/dark fixtures, empty/populated lists, lost-response recovery, incompatible conflicts, error recovery, repeated submission, and no-JavaScript fallback.`);
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
