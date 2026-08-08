'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const StockLedger = require('../../src/core/StockLedger');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let userId; let productId; let ctx;

before(async () => {
  planId = uuid(); tenant = uuid(); userId = uuid(); productId = uuid();
  await knex('plans').insert({ id: planId, code: 'zi-' + planId.slice(0, 5), name: 'P', price_cents: 0, max_users: null, max_products: null, features: JSON.stringify({}) });
  await knex('tenants').insert({ id: tenant, name: 'T-ZI', slug: 'zi-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: userId, tenant_id: tenant, name: 'Sistema', email: `sys-${tenant.slice(0, 5)}@t.com`, password_hash: 'x', role: ROLES.OPERATOR, is_system: 1, status: 'inactive' });
  await knex('products').insert({ id: productId, tenant_id: tenant, name: 'Cerveja', cost_price: 4.5, sale_price: 7.9, min_stock: 0 });
  await knex('stock_balance').insert({ tenant_id: tenant, product_id: productId, current_stock: 100 });
  ctx = new TenantContext({ tenantId: tenant, userId, role: ROLES.OPERATOR });
  ctx.ip = '127.0.0.1';
});

after(async () => {
  await knex('ze_delivery_outbox').where({ tenant_id: tenant }).del();
  await knex('audit_log').where({ tenant_id: tenant }).del();
  await knex('stock_movements').where({ tenant_id: tenant }).del();
  await knex('stock_balance').where({ tenant_id: tenant }).del();
  await knex('products').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('chamadores existentes (source manual) continuam funcionando sem external_ref', async () => {
  const r = await StockLedger.createMovement(knex, ctx, { productId, type: 'entry', quantity: 5 });
  assert.strictEqual(r.balanceAfter, 105);
  assert.strictEqual(r.duplicate, undefined);
});

test('reentrega sequencial do mesmo evento externo é no-op (não duplica baixa)', async () => {
  const externalRef = `${uuid()}:${productId}`;
  const first = await StockLedger.createMovement(knex, ctx, {
    productId, type: 'exit', quantity: 10, reason: 'venda', source: 'ze_delivery_order', externalRef,
  });
  assert.strictEqual(first.balanceAfter, 95);
  assert.strictEqual(first.duplicate, undefined);

  const replay = await StockLedger.createMovement(knex, ctx, {
    productId, type: 'exit', quantity: 10, reason: 'venda', source: 'ze_delivery_order', externalRef,
  });
  assert.strictEqual(replay.duplicate, true);
  assert.strictEqual(replay.id, first.id);
  assert.strictEqual(replay.balanceAfter, 95);

  const bal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(Number(bal.current_stock), 95, 'saldo não pode ter sido decrementado duas vezes');

  const movs = await knex('stock_movements').where({ tenant_id: tenant, source: 'ze_delivery_order', external_ref: externalRef });
  assert.strictEqual(movs.length, 1, 'apenas uma movimentação deve existir pro mesmo (source, external_ref)');
});

test('reentrega concorrente do mesmo evento externo aplica o delta uma única vez', async () => {
  const externalRef = `${uuid()}:${productId}`;
  const before = (await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first()).current_stock;

  const results = await Promise.allSettled([
    StockLedger.createMovement(knex, ctx, { productId, type: 'exit', quantity: 3, reason: 'venda', source: 'ze_delivery_order', externalRef }),
    StockLedger.createMovement(knex, ctx, { productId, type: 'exit', quantity: 3, reason: 'venda', source: 'ze_delivery_order', externalRef }),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  assert.strictEqual(ok.length, 2, 'as duas chamadas devem retornar sucesso (uma nova, uma duplicada)');
  const duplicates = ok.filter((r) => r.value.duplicate === true);
  assert.strictEqual(duplicates.length, 1, 'exatamente uma das duas deve ser reconhecida como duplicada');

  const after = (await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first()).current_stock;
  assert.strictEqual(Number(before) - Number(after), 3, 'o delta deve ter sido aplicado uma única vez');

  const movs = await knex('stock_movements').where({ tenant_id: tenant, source: 'ze_delivery_order', external_ref: externalRef });
  assert.strictEqual(movs.length, 1);
});

test('outbox: enqueue só ocorre quando produto tem mapeamento e sync habilitado', async () => {
  await knex('products').where({ id: productId }).update({ ze_delivery_item_id: null, ze_delivery_sync_enabled: 0 });
  await StockLedger.createMovement(knex, ctx, { productId, type: 'entry', quantity: 1 });
  let outbox = await knex('ze_delivery_outbox').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(outbox, undefined, 'sem mapeamento não deve enfileirar');

  await knex('products').where({ id: productId }).update({ ze_delivery_item_id: 'ze-item-1', ze_delivery_sync_enabled: 0 });
  await StockLedger.createMovement(knex, ctx, { productId, type: 'entry', quantity: 1 });
  outbox = await knex('ze_delivery_outbox').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(outbox, undefined, 'com sync desabilitado não deve enfileirar mesmo tendo mapeamento');

  await knex('products').where({ id: productId }).update({ ze_delivery_sync_enabled: 1 });
  const mv = await StockLedger.createMovement(knex, ctx, { productId, type: 'entry', quantity: 1 });
  outbox = await knex('ze_delivery_outbox').where({ tenant_id: tenant, product_id: productId }).first();
  assert.ok(outbox, 'com mapeamento + sync habilitado deve enfileirar');
  assert.strictEqual(outbox.status, 'pending');
  assert.strictEqual(outbox.last_movement_id, mv.id);
});

test('outbox: múltiplas movimentações no mesmo produto colapsam numa única linha pendente', async () => {
  await StockLedger.createMovement(knex, ctx, { productId, type: 'entry', quantity: 2 });
  const mv = await StockLedger.createMovement(knex, ctx, { productId, type: 'entry', quantity: 3 });
  const rows = await knex('ze_delivery_outbox').where({ tenant_id: tenant, product_id: productId });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].last_movement_id, mv.id);
});
