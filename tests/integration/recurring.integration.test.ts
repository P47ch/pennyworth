import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/lib/db.js";
import { buildApp } from "../../src/server.js";
import { hashPassword } from "../../src/lib/passwords.js";
import { createRecurringTransaction, updateRecurringTransaction, generateRecurringTransaction, previewRecurringTransaction,
  skipRecurringOccurrence, type RecurringPreview } from "../../src/services/recurring.js";
import * as transactionService from "../../src/services/transactions.js";
import { getAccountBalanceMap } from "../../src/queries/accountBalances.js";
import { getMonthlyCashflowTotals } from "../../src/queries/reporting.js";
import { buildUserBackup, previewBackupJson, restoreUserBackup } from "../../src/services/backup.js";

const ids: string[] = [];
let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); });
afterAll(async () => { await app.close(); });
afterEach(async () => {
  vi.restoreAllMocks();
  if (ids.some(id => !id.startsWith('integration-test-recurring-'))) throw new Error('Unsafe cleanup namespace');
  await prisma.user.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
async function fixture() {
  const id = `integration-test-recurring-${randomUUID()}`;
  const user = await prisma.user.create({ data: { id, email: `${id}@pennyworth.local`, name: 'Recurring test', passwordHash: await hashPassword('recurring-test-2026'), language: 'it' } });
  ids.push(id);
  const source = await prisma.account.create({ data: { userId: id, name: 'Bank', type: 'bank', currency: 'EUR', openingBalanceMinor: 100_000 } });
  const destination = await prisma.account.create({ data: { userId: id, name: 'Wallet', type: 'other', currency: 'EUR', openingBalanceMinor: 3_500 } });
  const category = await prisma.category.create({ data: { userId: id, name: 'Fees', type: 'expense' } });
  const input = { userId: id, name: 'Wallet top-up', type: 'transfer' as const, amountMode: 'target_balance' as const,
    amountMinor: null, targetBalanceMinor: 10_000, sourceAccountId: source.id, destinationAccountId: destination.id,
    feeAmountMinor: 50, feeAccount: 'source' as const, feeCategoryId: category.id,
    frequency: 'weekly' as const, nextDate: new Date('2026-10-05'), isActive: true };
  return { user, source, destination, category, input };
}
function confirm(preview: RecurringPreview) {
  return { expectedDate: preview.recurring.nextDate, expectedRevision: preview.recurring.updatedAt.toISOString(),
    signature: preview.signature, feeAmountMinor: preview.requestedFeeAmountMinor, feeAccount: preview.feeAccount };
}
async function login(user: Awaited<ReturnType<typeof fixture>>['user']) {
  const page = await app.inject({ method: 'GET', url: '/login' });
  const headers = page.headers['set-cookie'];
  const csrfCookie = (Array.isArray(headers) ? headers : [String(headers)]).find(value => value.startsWith('pennyworth_csrf='))!.split(';')[0];
  const csrfToken = page.body.match(/name="csrfToken" value="([^"]+)"/)![1];
  const response = await app.inject({ method: 'POST', url: '/login', remoteAddress: '127.8.0.2',
    headers: { cookie: csrfCookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ csrfToken, email: user.email, password: 'recurring-test-2026' }).toString() });
  expect(response.statusCode).toBe(302);
  const sessionHeaders = response.headers['set-cookie'];
  const sessionCookie = (Array.isArray(sessionHeaders) ? sessionHeaders : [String(sessionHeaders)]).find(value => value.startsWith('pennyworth_session='))!.split(';')[0];
  return `${csrfCookie}; ${sessionCookie}`;
}
function confirmationFields(html: string) {
  const form = html.match(/<form method="post" action="\/recurring\/[^\"]+\/(?:generate|skip)"[^>]*>([\s\S]*?)<\/form>/)![1];
  return new URLSearchParams([...form.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/g)]
    .map(match => [match[1], match[2]]));
}
describe('recurring transfers with fees', () => {
  it.each(['generate', 'skip'] as const)('confirms an imported intraday occurrence through the rendered %s form', async (action) => {
    const f = await fixture();
    const template = await createRecurringTransaction(f.input);
    const backup = await buildUserBackup(f.user.id);
    backup.recurringTransactions[0].nextDate = new Date('2026-10-05T12:34:56.789Z');
    if (action === 'skip') backup.accounts.find(account => account.id === f.destination.id)!.openingBalanceMinor = 10_000;
    expect(previewBackupJson(JSON.stringify(backup)).recurringCount).toBe(1);
    await restoreUserBackup(f.user.id, JSON.stringify(backup));
    const cookie = await login(f.user);
    const page = await app.inject({ method: 'GET', url: `/recurring/${template.id}/preview`, headers: { cookie } });
    expect(page.statusCode).toBe(200);
    const fields = confirmationFields(page.body);
    const post = () => app.inject({ method: 'POST', url: `/recurring/${template.id}/${action}`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, payload: fields.toString() });
    expect((await post()).statusCode).toBe(302);
    expect(fields.get('expectedDate')).toBe('2026-10-05T12:34:56.789Z');
    expect((await post()).statusCode).toBe(409);
    expect((await prisma.recurringTransaction.findUniqueOrThrow({ where: { id: template.id } })).nextDate)
      .toEqual(new Date('2026-10-12T12:34:56.789Z'));
    const entries = await prisma.transaction.findMany({ where: { userId: f.user.id } });
    expect(entries).toHaveLength(action === 'generate' ? 2 : 0);
    for (const entry of entries) expect(entry.date).toEqual(new Date('2026-10-05T12:34:56.789Z'));
  });
  it.each([10, 11])('keeps a restored long-name version %s template usable without accepting new long names', async (version) => {
    const f = await fixture();
    const input = { ...f.input, amountMode: 'fixed' as const, amountMinor: 500, targetBalanceMinor: null,
      feeAmountMinor: 0, frequency: 'monthly' as const };
    const template = await createRecurringTransaction(input);
    const name = 'N'.repeat(101);
    const backup = await buildUserBackup(f.user.id);
    backup.schemaVersion = version;
    backup.recurringTransactions[0].name = name;
    expect(previewBackupJson(JSON.stringify(backup)).recurringCount).toBe(1);
    await restoreUserBackup(f.user.id, JSON.stringify(backup));
    const cookie = await login(f.user);
    const previewPage = await app.inject({ method: 'GET', url: `/recurring/${template.id}/preview`, headers: { cookie } });
    expect(previewPage.statusCode).toBe(200);
    const edit = await app.inject({ method: 'GET', url: `/recurring/${template.id}/edit`, headers: { cookie } });
    expect(edit.statusCode).toBe(200);
    expect(edit.body).toContain('maxlength="101"');
    await updateRecurringTransaction({ ...input, recurringId: template.id, name, notes: 'Preserved legacy name' });
    await expect(createRecurringTransaction({ ...input, name: 'X'.repeat(101) })).rejects.toThrow('100 characters');
    await expect(updateRecurringTransaction({ ...input, recurringId: template.id, name: 'X'.repeat(101) })).rejects.toThrow('100 characters');
    const refreshedPreview = await app.inject({ method: 'GET', url: `/recurring/${template.id}/preview`, headers: { cookie } });
    expect(refreshedPreview.statusCode).toBe(200);
    const generated = await app.inject({ method: 'POST', url: `/recurring/${template.id}/generate`,
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, payload: confirmationFields(refreshedPreview.body).toString() });
    expect(generated.statusCode).toBe(302);
    expect(await prisma.transaction.count({ where: { userId: f.user.id } })).toBe(1);
    expect((await prisma.recurringTransaction.findUniqueOrThrow({ where: { id: template.id } })).name).toBe(name);
    expect((await buildUserBackup(f.user.id)).recurringTransactions[0].name).toBe(name);
  });
  it('validates 100 rows within a bounded budget in a 51,000-row ledger', async () => {
    const f = await fixture();
    const prefix = `integration-test-trigger-${randomUUID()}`;
    const rollback = new Error('Rollback trigger-performance fixture');
    await expect(prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('ALTER TABLE "Transaction" DISABLE TRIGGER "Transaction_transfer_fee_check"');
      await tx.$executeRaw`INSERT INTO "Transaction" ("id", "userId", "type", "date", "amountMinor", "sourceAccountId", "createdAt", "updatedAt")
        SELECT concat(${prefix}, '-', n::text), ${f.user.id}, 'income'::"TransactionType", '2026-10-05'::timestamp, 1, ${f.source.id}, now(), now()
        FROM generate_series(1, 51000) n`;
      await tx.$executeRawUnsafe('ANALYZE "Transaction"');
      await tx.$executeRawUnsafe('ALTER TABLE "Transaction" ENABLE TRIGGER "Transaction_transfer_fee_check"');
      await tx.$executeRawUnsafe('SET CONSTRAINTS "Transaction_transfer_fee_check" IMMEDIATE');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '2s'");
      const start = performance.now();
      expect(await tx.$executeRaw`UPDATE "Transaction" SET "notes" = 'trigger budget check'
        WHERE "id" IN (SELECT concat(${prefix}, '-', n::text) FROM generate_series(1, 100) n)`).toBe(100);
      console.log(`Transfer-fee trigger: 100 checks in ${(performance.now() - start).toFixed(1)} ms with 51,000 fixture rows`);
      throw rollback;
    }, { timeout: 20_000 })).rejects.toBe(rollback);
  });
  it.each(['source', 'destination'] as const)('debits the selected %s account and reaches the post-fee target', async (feeAccount) => {
    const f = await fixture();
    const template = await createRecurringTransaction({ ...f.input, feeAccount });
    const preview = await previewRecurringTransaction(f.user.id, template.id);
    const principal = await generateRecurringTransaction(f.user.id, template.id, confirm(preview));
    const fee = await prisma.transaction.findFirstOrThrow({ where: { feeForTransactionId: principal.id } });
    expect(principal.amountMinor).toBe(feeAccount === 'source' ? 6_500 : 6_550);
    expect(fee).toMatchObject({ type: 'expense', amountMinor: 50, sourceAccountId: feeAccount === 'source' ? f.source.id : f.destination.id, categoryId: f.category.id });
    expect((await getAccountBalanceMap(f.user.id)).get(f.destination.id)).toBe(10_000);
    expect((await getAccountBalanceMap(f.user.id)).get(f.source.id)).toBe(93_450);
    expect(await getMonthlyCashflowTotals(f.user.id, new Date('2026-10-01'), new Date('2026-11-01')))
      .toMatchObject([{ incomeMinor: 0, expensesMinor: 50, netCashflowMinor: -50 }]);
    expect((await prisma.recurringTransaction.findUniqueOrThrow({ where: { id: template.id } })).nextDate).toEqual(new Date('2026-10-12'));
  });
  it('uses the accounting-day cutoff, including refunds while excluding later transactions', async () => {
    const f = await fixture();
    await transactionService.createTransaction({ userId: f.user.id, type: 'income', date: new Date('2026-10-05T12:00:00Z'), amountMinor: 2_000, sourceAccountId: f.destination.id, tagIds: [] });
    await transactionService.createTransaction({ userId: f.user.id, type: 'expense', date: new Date('2026-10-06'), amountMinor: 4_000, sourceAccountId: f.destination.id, tagIds: [] });
    const template = await createRecurringTransaction(f.input);
    expect(await previewRecurringTransaction(f.user.id, template.id)).toMatchObject({ destinationBalanceMinor: 5_500, transferAmountMinor: 4_500 });
  });
  it('rejects duplicate confirmation and concurrent requests for the same occurrence', async () => {
    const f = await fixture();
    const template = await createRecurringTransaction(f.input);
    const preview = await previewRecurringTransaction(f.user.id, template.id);
    const results = await Promise.allSettled([generateRecurringTransaction(f.user.id, template.id, confirm(preview)), generateRecurringTransaction(f.user.id, template.id, confirm(preview))]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    await expect(generateRecurringTransaction(f.user.id, template.id, confirm(preview))).rejects.toThrow('already processed');
    expect(await prisma.transaction.count({ where: { userId: f.user.id } })).toBe(2);
  });
  it('requires a new preview after a ledger or template change, including a tampered fee', async () => {
    const f = await fixture(); const template = await createRecurringTransaction(f.input);
    const preview = await previewRecurringTransaction(f.user.id, template.id);
    await transactionService.createTransaction({ userId: f.user.id, type: 'expense', date: f.input.nextDate, amountMinor: 100, sourceAccountId: f.destination.id, tagIds: [] });
    await expect(generateRecurringTransaction(f.user.id, template.id, confirm(preview))).rejects.toThrow('preview changed');
    const updated = await previewRecurringTransaction(f.user.id, template.id);
    await expect(generateRecurringTransaction(f.user.id, template.id, { ...confirm(updated), feeAmountMinor: 0 })).rejects.toThrow('preview changed');
    await updateRecurringTransaction({ ...f.input, recurringId: template.id, name: 'Changed' });
    await expect(generateRecurringTransaction(f.user.id, template.id, confirm(updated))).rejects.toThrow('preview changed');
    expect(await prisma.transaction.count({ where: { userId: f.user.id, type: 'transfer' } })).toBe(0);
  });
  it('can override a preset to zero, then skip the next zero-value occurrence without fees', async () => {
    const f = await fixture(); const template = await createRecurringTransaction(f.input);
    const preview = await previewRecurringTransaction(f.user.id, template.id, { feeAmountMinor: 0, feeAccount: 'destination' });
    await generateRecurringTransaction(f.user.id, template.id, confirm(preview));
    expect(await prisma.transaction.count({ where: { userId: f.user.id } })).toBe(1);
    const next = await previewRecurringTransaction(f.user.id, template.id);
    expect(next).toMatchObject({ transferAmountMinor: 0, feeAmountMinor: 0 });
    await skipRecurringOccurrence(f.user.id, template.id, confirm(next));
    await expect(skipRecurringOccurrence(f.user.id, template.id, confirm(next))).rejects.toThrow('already processed');
    expect((await prisma.recurringTransaction.findUniqueOrThrow({ where: { id: template.id } })).nextDate).toEqual(new Date('2026-10-19'));
    expect(await prisma.transaction.count({ where: { userId: f.user.id } })).toBe(1);
  });
  it('rolls back the transfer and date advancement if fee creation fails', async () => {
    const f = await fixture(); const template = await createRecurringTransaction(f.input);
    const preview = await previewRecurringTransaction(f.user.id, template.id);
    const realCreate = transactionService.createTransaction;
    vi.spyOn(transactionService, 'createTransaction').mockImplementation((input, tx) => {
      if (input.feeForTransactionId) throw new Error('Injected fee failure');
      return realCreate(input, tx);
    });
    await expect(generateRecurringTransaction(f.user.id, template.id, confirm(preview))).rejects.toThrow('Injected fee failure');
    expect(await prisma.transaction.count({ where: { userId: f.user.id } })).toBe(0);
    expect((await prisma.recurringTransaction.findUniqueOrThrow({ where: { id: template.id } })).nextDate).toEqual(f.input.nextDate);
  });
  it('round-trips weekly target templates and linked fees, regardless of transaction order', async () => {
    const f = await fixture(); const template = await createRecurringTransaction({ ...f.input, feeAccount: 'destination' });
    const preview = await previewRecurringTransaction(f.user.id, template.id);
    await generateRecurringTransaction(f.user.id, template.id, confirm(preview));
    const backup = await buildUserBackup(f.user.id);
    backup.transactions.reverse();
    expect(previewBackupJson(JSON.stringify(backup)).transactionCount).toBe(2);
    await restoreUserBackup(f.user.id, JSON.stringify(backup));
    expect(await prisma.recurringTransaction.findUniqueOrThrow({ where: { id: template.id } }))
      .toMatchObject({ amountMinor: null, amountMode: 'target_balance', frequency: 'weekly', feeAccount: 'destination', feeAmountMinor: 50 });
    expect(await prisma.transaction.count({ where: { userId: f.user.id, feeForTransactionId: { not: null } } })).toBe(1);
    expect((await getAccountBalanceMap(f.user.id)).get(f.destination.id)).toBe(10_000);
  });
  it('requires a fresh preview when competing templates replenish the same destination', async () => {
    const f = await fixture();
    const first = await createRecurringTransaction(f.input);
    const second = await createRecurringTransaction({ ...f.input, name: 'Second replenishment' });
    const previews = await Promise.all([first, second].map(template => previewRecurringTransaction(f.user.id, template.id)));
    const results = await Promise.allSettled(previews.map(preview => generateRecurringTransaction(f.user.id, preview.recurring.id, confirm(preview))));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await getAccountBalanceMap(f.user.id)).get(f.destination.id)).toBe(10_000);
    expect(await prisma.transaction.count({ where: { userId: f.user.id } })).toBe(2);
  });
  it('keeps linked structural fields together and cascades an explicitly deleted transfer', async () => {
    const f = await fixture(); const template = await createRecurringTransaction(f.input);
    const preview = await previewRecurringTransaction(f.user.id, template.id);
    const principal = await generateRecurringTransaction(f.user.id, template.id, confirm(preview));
    await expect(transactionService.updateTransaction({ userId: f.user.id, transactionId: principal.id, type: 'transfer', date: new Date('2026-10-06'),
      amountMinor: principal.amountMinor, sourceAccountId: f.source.id, destinationAccountId: f.destination.id, tagIds: [] })).rejects.toThrow('must keep their type');
    await expect(prisma.transaction.update({ where: { id: principal.id }, data: { date: new Date('2026-10-06') } })).rejects.toThrow();
    await transactionService.deleteTransaction(f.user.id, principal.id);
    expect(await prisma.transaction.count({ where: { userId: f.user.id } })).toBe(0);
  });
  it('enforces ownership, categories, fee roles and conditional database constraints', async () => {
    const f = await fixture(); const other = await fixture();
    await expect(createRecurringTransaction({ ...f.input, destinationAccountId: other.destination.id })).rejects.toThrow('valid accounts');
    await expect(createRecurringTransaction({ ...f.input, feeAccount: 'other' as 'source' })).rejects.toThrow('source or destination');
    await expect(createRecurringTransaction({ ...f.input, feeCategoryId: other.category.id })).rejects.toThrow('valid category');
    await expect(prisma.recurringTransaction.create({ data: { ...f.input, amountMode: 'fixed', amountMinor: null } })).rejects.toThrow();
    const template = await createRecurringTransaction(f.input);
    await expect(previewRecurringTransaction(other.user.id, template.id)).rejects.toThrow('not found');
    await prisma.recurringTransaction.update({ where: { id: template.id }, data: { isActive: false } });
    await expect(previewRecurringTransaction(f.user.id, template.id)).rejects.toThrow('inactive');
  });
  it('serves localized help and protects preview/confirmation with sessions and CSRF', async () => {
    const f = await fixture(); const template = await createRecurringTransaction(f.input);
    const loginPage = await app.inject({ method: 'GET', url: '/login' });
    const csrfHeader = loginPage.headers['set-cookie'];
    const csrfCookie = (Array.isArray(csrfHeader) ? csrfHeader : [String(csrfHeader)]).find(value => value.startsWith('pennyworth_csrf='))!.split(';')[0];
    const csrfToken = loginPage.body.match(/name="csrfToken" value="([^"]+)"/)![1];
    const login = await app.inject({ method: 'POST', url: '/login', remoteAddress: '127.8.0.1', headers: { cookie: csrfCookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ csrfToken, email: f.user.email, password: 'recurring-test-2026' }).toString() });
    const sessionHeader = login.headers['set-cookie'];
    const sessionCookie = (Array.isArray(sessionHeader) ? sessionHeader : [String(sessionHeader)]).find(value => value.startsWith('pennyworth_session='))!.split(';')[0];
    const cookie = `${csrfCookie}; ${sessionCookie}`;
    const recurringPage = await app.inject({ method: 'GET', url: '/recurring', headers: { cookie } });
    expect(recurringPage.statusCode).toBe(200);
    expect(recurringPage.body).toContain('Come funzionano le transazioni ricorrenti');
    expect(recurringPage.body).toContain('Modalità importo');
    expect((await app.inject({ method: 'GET', url: `/recurring/${template.id}/preview` })).headers.location).toBe('/login');
    expect((await app.inject({ method: 'POST', url: `/recurring/${template.id}/generate`, headers: { cookie }, payload: {} })).statusCode).toBe(403);
    const preview = await previewRecurringTransaction(f.user.id, template.id);
    const values = { csrfToken, expectedDate: '2026-10-05', expectedRevision: preview.recurring.updatedAt.toISOString(), signature: preview.signature, feeAmount: '0.50', feeAccount: preview.feeAccount };
    const post = () => app.inject({ method: 'POST', url: `/recurring/${template.id}/generate`, headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams(values).toString() });
    expect((await post()).statusCode).toBe(302);
    expect((await post()).statusCode).toBe(409);
    expect(await prisma.transaction.count({ where: { userId: f.user.id } })).toBe(2);
  });
});
