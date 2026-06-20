'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const stock = require('../../src/modules/stock/stock.service');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let userId; let productId; let ctx;

before(async () => {
  planId = uuid(); tenant = uuid(); userId = uuid(); productId = uuid();
  await knex('plans').insert({ id: planId, code: 'st-' + planId.slice(0, 5), name: 'P', price_cents: 0, max_users: null, max_products: null, features: JSON.stringify({}) });
  await knex('tenants').insert({ id: tenant, name: 'T4', slug: 't4-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: userId, tenant_id: tenant, name: 'Op', email: `op-${tenant.slice(0, 5)}@t4.com`, password_hash: 'x', role: ROLES.OPERATOR });
  await knex('products').insert({ id: productId, tenant_id: tenant, name: 'Cerveja', cost_price: 4.5, sale_price: 7.9, min_stock: 24 });
  await knex('stock_balance').insert({ tenant_id: tenant, product_id: productId, current_stock: 0 });
  ctx = new TenantContext({ tenantId: tenant, userId, role: ROLES.ADMIN });
  ctx.ip = '127.0.0.1';
});

after(async () => {
  await knex('audit_log').where({ tenant_id: tenant }).del();
  await knex('stock_movements').where({ tenant_id: tenant }).del();
  await knex('stock_balance').where({ tenant_id: tenant }).del();
  await knex('products').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('FR26: entrada aumenta saldo', async () => {
  const r = await stock.createMovement(ctx, { productId, type: 'entry', quantity: 60 });
  assert.strictEqual(r.balanceAfter, 60);
  const bal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(Number(bal.current_stock), 60);
});

test('FR27: saída diminui saldo', async () => {
  const r = await stock.createMovement(ctx, { productId, type: 'exit', quantity: 12, reason: 'venda' });
  assert.strictEqual(r.balanceAfter, 48);
});

test('FR29: saída além do saldo é bloqueada (INSUFFICIENT_STOCK)', async () => {
  await assert.rejects(
    () => stock.createMovement(ctx, { productId, type: 'exit', quantity: 1000, reason: 'venda' }),
    (e) => e.code === 'INSUFFICIENT_STOCK'
  );
});

test('FR28: ajuste define saldo absoluto e exige justificativa', async () => {
  await assert.rejects(
    () => stock.createMovement(ctx, { productId, type: 'adjustment', quantity: 50 }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
  const r = await stock.createMovement(ctx, { productId, type: 'adjustment', quantity: 50, reason: 'contagem física' });
  assert.strictEqual(r.balanceAfter, 50);
});

test('balance_after é gravado no ledger (snapshot imutável)', async () => {
  const movs = await knex('stock_movements').where({ tenant_id: tenant, product_id: productId }).orderBy('created_at', 'asc');
  assert.ok(movs.length >= 3);
  assert.strictEqual(Number(movs[0].balance_after), 60);
});

test('FR30: extrato traz flag de abaixo do mínimo no saldo', async () => {
  // saldo atual 50 < min 24? não. Vamos baixar para 10
  await stock.createMovement(ctx, { productId, type: 'adjustment', quantity: 10, reason: 'ajuste teste' });
  const bal = await stock.listBalance(ctx, { belowMin: true });
  const item = bal.find((b) => b.product_id === productId);
  assert.ok(item, 'produto deve aparecer no filtro abaixo do mínimo');
  assert.strictEqual(item.below_min, true);
});

test('NFR14: toda movimentação gera auditoria', async () => {
  const { c } = await knex('audit_log').where({ tenant_id: tenant }).count({ c: '*' }).first();
  assert.ok(Number(c) >= 4);
});

test('concorrência: duas saídas simultâneas não geram saldo negativo', async () => {
  // saldo atual 10. Duas saídas de 8 em paralelo: uma deve falhar.
  const results = await Promise.allSettled([
    stock.createMovement(ctx, { productId, type: 'exit', quantity: 8, reason: 'venda' }),
    stock.createMovement(ctx, { productId, type: 'exit', quantity: 8, reason: 'venda' }),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const fail = results.filter((r) => r.status === 'rejected');
  assert.strictEqual(ok.length, 1, 'apenas uma saída deve passar');
  assert.strictEqual(fail.length, 1, 'a outra deve falhar por saldo insuficiente');
  const bal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  assert.ok(Number(bal.current_stock) >= 0, 'saldo nunca negativo');
});
