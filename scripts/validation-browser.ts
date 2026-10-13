import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, type Page } from "@playwright/test";
import { requireTestDatabaseUrl } from "./integration-environment.js";
import { formContracts } from "../src/lib/formValidation.js";

// This script writes only uniquely named fixtures to the explicitly guarded test DB.
process.env.DATABASE_URL = requireTestDatabaseUrl();
process.env.UPDATE_CHECK_ENABLED = "false";
const { prisma } = await import("../src/lib/db.js");
const { buildApp } = await import("../src/server.js");
const { hashPassword } = await import("../src/lib/passwords.js");
const id = `integration-test-validation-${randomUUID()}`;
const password = "validation-browser-password-2026";
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let checked = 0;
async function invalid(page: Page, field: string, input: string, formSelector = "form[data-validation]:not([data-validation=action])") {
  const form = page.locator(formSelector).first();
  const control = form.locator(`[name="${field}"]`);
  if (await control.evaluate(element => element.tagName === "SELECT")) await control.selectOption(input);
  else await control.fill(input);
  assert.equal(await form.evaluate(element => (element as HTMLFormElement).checkValidity()), false, `${page.url()} ${field}`);
  assert(await control.evaluate(element => !!(element as HTMLInputElement).validationMessage), `Missing ${field} message`);
  let posts = 0;
  const count = (request: { method(): string }) => { if (request.method() === "POST") posts++; };
  page.on("request", count);
  await form.locator('button[type="submit"]').first().click();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  page.off("request", count);
  assert.equal(posts, 0, "Invalid draft was posted");
  checked++;
}
try {
  const user = await prisma.user.create({ data: { id, name: "Validation fixture", email: `${id}@pennyworth.local`, passwordHash: await hashPassword(password), role: "admin" } });
  const bank = await prisma.account.create({ data: { userId: id, name: "Bank", type: "bank", currency: "EUR", openingBalanceMinor: 0 } });
  const wallet = await prisma.account.create({ data: { userId: id, name: "Wallet", type: "bank", currency: "EUR", openingBalanceMinor: 0 } });
  const investment = await prisma.account.create({ data: { userId: id, name: "Investment", type: "investment", currency: "EUR", openingBalanceMinor: 0 } });
  const category = await prisma.category.create({ data: { userId: id, name: "Food", type: "expense" } });
  const incomeCategory = await prisma.category.create({ data: { userId: id, name: "Salary", type: "income" } });
  const childCategory = await prisma.category.create({ data: { userId: id, name: "Groceries", type: "expense", parentId: category.id } });
  const tag = await prisma.tag.create({ data: { userId: id, name: "Travel" } });
  const asset = await prisma.asset.create({ data: { userId: id, symbol: "TEST", name: "Test asset", type: "etf", currency: "EUR" } });
  const price = await prisma.assetPrice.create({ data: { userId: id, assetId: asset.id, date: new Date("2026-10-13"), priceMinor: 100 } });
  const holding = await prisma.holding.create({ data: { userId: id, accountId: investment.id, assetId: asset.id, quantity: "2", averageCostMinor: 100 } });
  const budget = await prisma.budget.create({ data: { userId: id, categoryId: category.id, month: new Date("2026-10-01"), amountMinor: 10000 } });
  const rule = await prisma.rule.create({ data: { userId: id, name: "Food rule", matchText: "shop", categoryId: category.id } });
  const transaction = await prisma.transaction.create({ data: { userId: id, type: "expense", sourceAccountId: bank.id, date: new Date("2026-10-13"), amountMinor: 100 } });
  const recurring = await prisma.recurringTransaction.create({ data: { userId: id, name: "Top-up", type: "transfer", sourceAccountId: bank.id, destinationAccountId: wallet.id, amountMinor: 1000, frequency: "monthly", nextDate: new Date("2026-10-13") } });
  const activity = await prisma.investmentTransaction.create({ data: { userId: id, accountId: investment.id, assetId: asset.id, type: "buy", date: new Date("2026-10-13"), quantity: "1", priceMinor: 100, amountMinor: 100, cashAmountMinor: 100 } });
  app = await buildApp();
  const base = await app.listen({ port: 0, host: "127.0.0.1" });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/login`);
  await page.locator('[name="email"]').fill(user.email);
  await page.locator('[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${base}/`);
  const paths = ["accounts", "assets", "categories", "tags", "transactions", "recurring", "holdings", "asset-prices", "investment-transactions", "budgets", "rules", "settings/preferences", "settings/security", "settings/users", "transactions/import",
    `accounts/${bank.id}/edit`, `assets/${asset.id}/edit`, `categories/${category.id}/edit`, `tags/${tag.id}/edit`, `transactions/${transaction.id}/edit`, `recurring/${recurring.id}/edit`, `holdings/${holding.id}/edit`, `asset-prices/${price.id}/edit`, `investment-transactions/${activity.id}/edit`, `budgets/${budget.id}/edit`, `rules/${rule.id}/edit`, `recurring/${recurring.id}/preview`];
  for (const path of paths) {
    const response = await page.goto(`${base}/${path}`);
    assert.equal(response?.status(), 200, path);
    await page.waitForFunction(() => document.querySelector("form[data-validation]")?.getAttribute("data-validation-ready") === "true");
    const forms = await page.locator("form").evaluateAll(elements => elements.map(form => ({ kind: (form as HTMLFormElement).dataset.validation, fields: Array.from((form as HTMLFormElement).elements).filter(element => ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) && (element as HTMLInputElement).type !== "hidden" && (element as HTMLInputElement).name !== "csrfToken").map(element => (element as HTMLInputElement).name).filter(Boolean) })));
    for (const form of forms) {
      assert(form.kind && form.kind in formContracts, `${path}: missing contract`);
      for (const field of form.fields) assert(field in formContracts[form.kind as keyof typeof formContracts], `${path}: undeclared ${field}`);
    }
    checked++;
  }
  for (const width of [1440, 390]) for (const language of ["en", "it"]) {
    await prisma.user.update({ where: { id }, data: { language } });
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["recurring", `recurring/${recurring.id}/edit`]) {
      await page.goto(`${base}/${path}`);
      const form = page.locator('[data-validation="recurring"]');
      await form.locator('[name="name"]').fill("Top-up draft");
      await form.locator('[name="type"]').selectOption("transfer");
      await form.locator('[name="sourceAccountId"]').selectOption(bank.id);
      await form.locator('[name="amount"]').fill("10");
      await invalid(page, "destinationAccountId", "");
      await invalid(page, "destinationAccountId", bank.id);
      await form.locator('[name="destinationAccountId"]').selectOption(wallet.id);
      for (const amount of ["0", "-1", "1.234", "bad", "21474836.48"]) await invalid(page, "amount", amount);
      await form.locator('[name="amount"]').fill("10,50");
      await invalid(page, "feeAmount", "-0.01");
      await form.locator('[name="feeAmount"]').fill("0");
      assert(await form.evaluate(element => (element as HTMLFormElement).checkValidity()));
      await form.locator('[name="amountMode"]').selectOption("target_balance");
      await invalid(page, "targetBalance", "-1");
      await form.locator('[name="targetBalance"]').fill("0");
      assert(await form.evaluate(element => (element as HTMLFormElement).checkValidity()));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
  }
  await page.goto(`${base}/categories/${category.id}/edit`);
  await invalid(page, "parentId", childCategory.id, '[data-validation="category"]');
  await page.goto(`${base}/investment-transactions`);
  const trade = page.locator('[data-validation="investment"]');
  await trade.locator('[name="accountId"]').selectOption(investment.id);
  await trade.locator('[name="assetId"]').selectOption(asset.id);
  await trade.locator('[name="amount"]').fill("5");
  await invalid(page, "quantity", "");
  await trade.locator('[name="quantity"]').fill("1");
  await invalid(page, "price", "");
  await trade.locator('[name="type"]').selectOption("dividend");
  assert(await trade.evaluate(element => (element as HTMLFormElement).checkValidity()));
  await page.goto(`${base}/settings/security`);
  const passwordForm = '[data-validation="password"]';
  await page.locator(`${passwordForm} [name="currentPassword"]`).fill(password);
  await page.locator(`${passwordForm} [name="newPassword"]`).fill("valid-new-password");
  await invalid(page, "confirmPassword", "different-password", passwordForm);
  await page.locator(`${passwordForm} [name="confirmPassword"]`).fill("é".repeat(37));
  await invalid(page, "newPassword", "é".repeat(37), passwordForm);
  await invalid(page, "backupJson", "not json", '[data-validation="backupRestore"]');
  const restoreForm = page.locator('[data-validation="backupRestore"]');
  await restoreForm.locator('[name="backupJson"]').fill("");
  await restoreForm.locator('[name="backupFile"]').setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("bad json") });
  await page.waitForFunction(() => !!document.querySelector('[data-validation="backupRestore"]')?.getAttribute('data-backup-file-error'));
  assert.equal(await restoreForm.evaluate(form => (form as HTMLFormElement).checkValidity()), false);
  await restoreForm.locator('[name="backupFile"]').setInputFiles({ name: "encrypted.pwb", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "pennyworth-encrypted-backup" })) });
  await page.waitForFunction(() => document.querySelector('[data-validation="backupRestore"]')?.getAttribute('data-encrypted-backup') === 'true');
  assert(await restoreForm.locator('[name="backupPassphrase"]').evaluate(input => !!(input as HTMLInputElement).validationMessage));
  await restoreForm.locator('[name="backupFile"]').setInputFiles([]);
  await page.locator('[data-validation="backupExport"] [name="backupPassphrase"]').fill("valid-backup-passphrase");
  await invalid(page, "backupPassphraseConfirmation", "different-passphrase", '[data-validation="backupExport"]');
  await page.goto(`${base}/transactions/import`);
  const uploadedCsv = "Date,Amount,Description\n2026-10-13,1.25,Test import";
  await page.locator('[data-csv-file-input]').setInputFiles({ name: "transactions.csv", mimeType: "text/csv", buffer: Buffer.from(uploadedCsv) });
  await page.waitForFunction(csv => document.querySelector<HTMLTextAreaElement>('[name="csvText"]')?.value === csv, uploadedCsv);
  assert(await page.locator('[data-validation="csv"]').evaluate(form => (form as HTMLFormElement).checkValidity()), "A loaded CSV must clear the empty-textarea error");
  await page.locator('[data-validation="csv"] button[type="submit"]').click();
  await page.waitForURL(`${base}/transactions/import/map`);
  const mapping = page.locator('[data-validation="importMapping"]');
  await mapping.locator('[name="dateColumn"]').selectOption("Date");
  await mapping.locator('[name="amountColumn"]').selectOption("Amount");
  await invalid(page, "defaultType", "", '[data-validation="importMapping"]');
  await mapping.locator('[name="defaultType"]').selectOption("expense");
  await invalid(page, "defaultAccountId", "", '[data-validation="importMapping"]');
  await mapping.locator('[name="defaultAccountId"]').selectOption(bank.id);
  assert(await mapping.evaluate(form => (form as HTMLFormElement).checkValidity()));
  await page.goto(`${base}/transactions`);
  const categoryDialog = page.locator('#quick-category-dialog');
  const categoryName = "Quick parent <literal> $&";
  await page.locator('[data-quick-taxonomy-open="category"]').click();
  await categoryDialog.locator('[name="name"]').fill(categoryName);
  await categoryDialog.locator('button[type="submit"]').click();
  await categoryDialog.waitFor({ state: "hidden" });
  const quickParent = await prisma.category.findUniqueOrThrow({ where: { userId_name: { userId: id, name: categoryName } } });
  await page.locator('[data-quick-taxonomy-open="category"]').click();
  await categoryDialog.locator('[name="name"]').fill("Quick child");
  await categoryDialog.locator('summary').click();
  await categoryDialog.locator('[name="parentId"]').selectOption(quickParent.id);
  assert(await categoryDialog.locator('form').evaluate(form => (form as HTMLFormElement).checkValidity()), "A newly created category must be a valid parent without a reload");
  await categoryDialog.locator('button[type="submit"]').click();
  await categoryDialog.waitFor({ state: "hidden" });
  const quickChild = await prisma.category.findUniqueOrThrow({ where: { userId_name: { userId: id, name: "Quick child" } } });
  assert.equal(quickChild.parentId, quickParent.id);
  assert.equal(await categoryDialog.locator(`[name="parentId"] option[value="${quickChild.id}"]`).getAttribute('data-parent-id'), quickParent.id);
  checked += 3;
  await page.locator('[data-quick-taxonomy-open="tag"]').click();
  await invalid(page, "name", "   ", '#quick-tag-dialog form');
  await page.keyboard.press("Escape");
  const compatible = page.locator('[data-validation="transaction"]');
  await compatible.locator('[name="amount"]').fill("10");
  await compatible.locator('[name="sourceAccountId"]').selectOption(bank.id);
  assert(await compatible.locator(`[name="categoryId"] option[value="${incomeCategory.id}"]`).evaluate(option => (option as HTMLOptionElement).disabled));
  // Deliberately tamper with the disabled choice to exercise the shared cross-field check.
  await compatible.locator(`[name="categoryId"] option[value="${incomeCategory.id}"]`).evaluate(option => { (option as HTMLOptionElement).disabled = false; });
  await invalid(page, "categoryId", incomeCategory.id, '[data-validation="transaction"]');
  const backup = await context.request.get(`${base}/settings/backup.json`);
  await page.goto(`${base}/settings/security`);
  await page.locator('[data-validation="backupRestore"] [name="backupJson"]').fill(await backup.text());
  await page.locator('[data-validation="backupRestore"] button[type="submit"]').click();
  await page.waitForURL(`${base}/settings/restore/preview`);
  await invalid(page, "confirmation", "restore", '[data-validation="restoreConfirm"]');
  await page.goto(`${base}/settings/security`);
  // Direct requests bypass browser validation and must still fail before writing.
  const csrfToken = await page.locator('[name="csrfToken"]').first().inputValue();
  const cases: Array<[string, Record<string, string>]> = [
    ["accounts", { name: " ", type: "bank", currency: "EUR", openingBalance: "0" }],
    ["assets", { name: "Test", symbol: "T", type: "etf", currency: "BAD" }],
    ["categories", { name: "Test", type: "wrong" }], ["tags", { name: " " }],
    [`categories/${category.id}`, { name: "Food", type: "expense", parentId: childCategory.id }],
    ["transactions", { type: "transfer", date: "2026-10-13", sourceAccountId: bank.id, amount: "10" }],
    [`transactions/${transaction.id}`, { type: "expense", date: "2026-10-13", sourceAccountId: bank.id, amount: "0" }],
    ["recurring", { name: "Bad", type: "transfer", sourceAccountId: bank.id, amount: "10", nextDate: "2026-10-13", frequency: "monthly" }],
    [`recurring/${recurring.id}`, { name: "Bad", type: "transfer", sourceAccountId: bank.id, destinationAccountId: wallet.id, amount: "1.234", nextDate: "2026-10-13", frequency: "monthly" }],
    ["holdings", { accountId: investment.id, assetId: asset.id, quantity: "10000000000000000", averageCost: "0" }],
    ["asset-prices", { assetId: asset.id, date: "2026-02-30", price: "5" }],
    ["investment-transactions", { accountId: investment.id, assetId: asset.id, type: "buy", date: "2026-10-13", amount: "5" }],
    ["budgets", { month: "2026-13", categoryId: category.id, amount: "10" }],
    ["rules", { name: "Bad rule", categoryId: category.id, matchText: '"unclosed' }],
    ["settings/users", { name: "Bad user", email: "bad-email" }],
    ["settings/security/password", { currentPassword: password, newPassword: "valid-new-password", confirmPassword: "different" }]
  ];
  const before = await prisma.transaction.count({ where: { userId: id } });
  for (const [path, data] of cases) {
    const response = await context.request.post(`${base}/${path}`, { form: { csrfToken, ...data }, maxRedirects: 0 });
    assert.equal(response.status(), 400, `${path}: ${await response.text()}`);
    checked++;
  }
  assert.equal(await prisma.transaction.count({ where: { userId: id } }), before);
  assert.equal((await prisma.recurringTransaction.findUniqueOrThrow({ where: { id: recurring.id } })).name, "Top-up");
  assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: transaction.id } })).amountMinor, 100);
  const draftResponse = await context.request.post(`${base}/accounts/${bank.id}`, { form: { csrfToken, name: 'Keep <literal> $& draft', type: 'bank', currency: 'EUR', institution: 'Test institution', openingBalance: 'bad amount' } });
  assert.equal(draftResponse.status(), 400);
  assert((await draftResponse.text()).includes('value="Keep &lt;literal&gt; $&amp; draft"'));
  assert((await draftResponse.text()).includes('value="bad amount"'));
  assert.equal((await prisma.account.findUniqueOrThrow({ where: { id: bank.id } })).name, "Bank");
  const repeated = await context.request.post(`${base}/tags`, { headers: { "content-type": "application/x-www-form-urlencoded" }, data: new URLSearchParams([['csrfToken', csrfToken], ['name', 'One'], ['name', 'Two']]).toString() });
  assert.equal(repeated.status(), 400);
  const malformed = await context.request.post(`${base}/tags`, { data: { csrfToken, name: 42 } });
  assert.equal(malformed.status(), 400);
  const invalidMapping = await context.request.post(`${base}/transactions/import/preview`, { form: { csrfToken, csvText: "Date,Amount\n2026-10-13,1", dateColumn: "Date", amountColumn: "Amount" } });
  assert.equal(invalidMapping.status(), 400);
  const invalidMappingHtml = await invalidMapping.text();
  assert(invalidMappingHtml.includes('data-validation="importMapping"'), "Invalid mappings must return the correction form");
  assert(invalidMappingHtml.includes("2026-10-13,1"), "Rejected mappings must retain their CSV source");
  // JavaScript-disabled users retain browser basics and independent server rejection.
  const noScript = await browser.newContext({ javaScriptEnabled: false, storageState: await context.storageState() });
  const fallbackPage = await noScript.newPage();
  await fallbackPage.goto(`${base}/transactions/import`);
  await fallbackPage.locator('[name="csvText"]').fill(uploadedCsv);
  await fallbackPage.locator('[data-validation="csv"] button[type="submit"]').click();
  const fallbackMapping = fallbackPage.locator('[data-validation="importMapping"]');
  await fallbackMapping.locator('[name="amountColumn"]').selectOption("");
  await fallbackMapping.locator('[name="descriptionColumn"]').selectOption("Description");
  await fallbackMapping.locator('[name="defaultType"]').selectOption("expense");
  await fallbackMapping.locator('[name="defaultAccountId"]').selectOption(bank.id);
  const rejectedMapping = await Promise.all([
    fallbackPage.waitForResponse(response => response.request().method() === 'POST'),
    fallbackMapping.locator('button[type="submit"]').click()
  ]);
  assert.equal(rejectedMapping[0].status(), 400);
  assert(await fallbackPage.locator('.error').isVisible());
  assert.equal(await fallbackMapping.locator('[name="csvText"]').inputValue(), uploadedCsv);
  assert.equal(await fallbackMapping.locator('[name="amountColumn"]').inputValue(), "");
  assert.equal(await fallbackMapping.locator('[name="descriptionColumn"]').inputValue(), "Description");
  assert.equal(await fallbackMapping.locator('[name="defaultType"]').inputValue(), "expense");
  assert.equal(await fallbackMapping.locator('[name="defaultAccountId"]').inputValue(), bank.id);
  await fallbackMapping.locator('[name="amountColumn"]').selectOption("Amount");
  await fallbackMapping.locator('button[type="submit"]').click();
  await fallbackPage.waitForURL(`${base}/transactions/import/preview`);
  assert(await fallbackPage.locator('[data-validation="importConfirm"]').isVisible());
  assert.equal(await prisma.transaction.count({ where: { userId: id } }), before);
  await fallbackPage.goto(`${base}/recurring`);
  const fallbackForm = fallbackPage.locator('[data-validation="recurring"]');
  await fallbackForm.locator('[name="name"]').fill("No script invalid transfer");
  await fallbackForm.locator('[name="type"]').selectOption("transfer");
  await fallbackForm.locator('[name="sourceAccountId"]').selectOption(bank.id);
  await fallbackForm.locator('[name="amount"]').fill("10");
  await Promise.all([fallbackPage.waitForResponse(response => response.request().method() === 'POST'), fallbackForm.locator('button[type="submit"]').click()]);
  assert(await fallbackPage.locator('.error').isVisible());
  assert.equal(await fallbackForm.locator('[name="name"]').inputValue(), "No script invalid transfer");
  await noScript.close();
  checked += 7;
  // A normal valid submit reaches the server once and accepts comma decimals.
  await page.goto(`${base}/transactions`);
  const entry = page.locator('[data-validation="transaction"]');
  await entry.locator('[name="amount"]').fill("1,25");
  await entry.locator('[name="sourceAccountId"]').selectOption(bank.id);
  await Promise.all([page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith('/transactions')), entry.locator('button[type="submit"]').click()]);
  assert.equal(await prisma.transaction.count({ where: { userId: id } }), before + 1);
  assert.deepEqual(errors, []);
  console.log(`Validation passed: ${checked} browser/page/server scenarios; valid submission and request-bypass checks.`);
} finally {
  await browser?.close();
  await app?.close();
  if (!id.startsWith("integration-test-validation-")) throw new Error("Unsafe fixture cleanup");
  await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
}
