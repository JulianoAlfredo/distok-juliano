'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const financial = require('../../src/modules/financial/financial.service');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let userId; let ctx;

before(async () => {
  planId = uuid(); tenant = uuid(); userId = uuid();
  await knex('plans').insert({
    id: planId, code: 'fi-' + planId.slice(0, 5), name: 'P', price_cents: 0,
    max_users: null, max_products: null, features: JSON.stringify({}),
  });
  await knex('tenants').insert({ id: tenant, name: 'TF', slug: 'tf-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: userId, tenant_id: tenant, name: 'Adm', email: `adm-${tenant.slice(0, 5)}@tf.com`, password_hash: 'x', role: ROLES.ADMIN });
  ctx = new TenantContext({ tenantId: tenant, userId, role: ROLES.ADMIN });
  ctx.ip = '127.0.0.1';
});

after(async () => {
  await knex('financial_entries').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

let entryId;

test('cria conta a pagar pendente', async () => {
  const e = await financial.create(ctx, { type: 'payable', description: 'Aluguel', amount: 1200, dueDate: '2026-08-05' });
  entryId = e.id;
  assert.strictEqual(e.status, 'pending');
  assert.strictEqual(Number(e.amount), 1200);
});

test('valida campos obrigatórios', async () => {
  await assert.rejects(
    () => financial.create(ctx, { type: 'payable', description: '', amount: 10, dueDate: '2026-08-05' }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
  await assert.rejects(
    () => financial.create(ctx, { type: 'x', description: 'a', amount: 10, dueDate: '2026-08-05' }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
  await assert.rejects(
    () => financial.create(ctx, { type: 'payable', description: 'a', amount: -1, dueDate: '2026-08-05' }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
});

test('marca como pago', async () => {
  const e = await financial.markPaid(ctx, entryId, {});
  assert.strictEqual(e.status, 'paid');
  assert.strictEqual(Number(e.paid_amount), 1200);
});

test('não marca como pago de novo', async () => {
  await assert.rejects(() => financial.markPaid(ctx, entryId, {}), (e) => e.code === 'CONFLICT');
});

test('lançamento pago não pode ser cancelado', async () => {
  await assert.rejects(() => financial.cancel(ctx, entryId), (e) => e.code === 'CONFLICT');
});

test('lançamento pendente pode ser cancelado, e cancelado não pode de novo', async () => {
  const e = await financial.create(ctx, { type: 'payable', description: 'Assinatura', amount: 50, dueDate: '2026-08-05' });
  const cancelled = await financial.cancel(ctx, e.id);
  assert.strictEqual(cancelled.status, 'cancelled');
  await assert.rejects(() => financial.cancel(ctx, e.id), (e2) => e2.code === 'CONFLICT');
});

test('cashflow do mês agrega pagáveis/recebíveis, pagos e saldo', async () => {
  const e2 = await financial.create(ctx, { type: 'receivable', description: 'Venda X', amount: 500, dueDate: '2026-08-10' });
  await financial.markPaid(ctx, e2.id, {});
  const flow = await financial.cashflow(ctx, { year: 2026, month: 8 });
  assert.ok(flow.totalPayable >= 1200);
  assert.ok(flow.totalReceived >= 500);
  assert.strictEqual(flow.balance, flow.totalReceivable - flow.totalPayable);
});
