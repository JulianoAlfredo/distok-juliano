'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const purchases = require('../../src/modules/purchases/purchases.service');
const StockLedger = require('../../src/core/StockLedger');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let userId; let productId; let supplierId; let ctx;

before(async () => {
  planId = uuid(); tenant = uuid(); userId = uuid(); productId = uuid(); supplierId = uuid();
  await knex('plans').insert({
    id: planId, code: 'pu-' + planId.slice(0, 5), name: 'P', price_cents: 0,
    max_users: null, max_products: null, features: JSON.stringify({}),
  });
  await knex('tenants').insert({ id: tenant, name: 'TP', slug: 'tp-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: userId, tenant_id: tenant, name: 'Adm', email: `adm-${tenant.slice(0, 5)}@tp.com`, password_hash: 'x', role: ROLES.ADMIN });
  await knex('suppliers').insert({ id: supplierId, tenant_id: tenant, name: 'Fornecedor X' });
  await knex('products').insert({ id: productId, tenant_id: tenant, name: 'Produto', cost_price: 5, sale_price: 10, min_stock: 0 });
  await knex('stock_balance').insert({ tenant_id: tenant, product_id: productId, current_stock: 0 });
  ctx = new TenantContext({ tenantId: tenant, userId, role: ROLES.ADMIN });
  ctx.ip = '127.0.0.1';
});

after(async () => {
  await knex('financial_entries').where({ tenant_id: tenant }).del();
  await knex('purchase_items').where({ tenant_id: tenant }).del();
  await knex('purchases').where({ tenant_id: tenant }).del();
  await knex('audit_log').where({ tenant_id: tenant }).del();
  await knex('stock_movements').where({ tenant_id: tenant }).del();
  await knex('stock_balance').where({ tenant_id: tenant }).del();
  await knex('products').where({ tenant_id: tenant }).del();
  await knex('suppliers').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

let purchaseId;

test('cria pedido em rascunho sem alterar estoque', async () => {
  const p = await purchases.create(ctx, { supplierId, items: [{ productId, quantity: 10, unitCost: 4 }] });
  purchaseId = p.id;
  assert.strictEqual(p.status, 'draft');
  const bal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(Number(bal.current_stock), 0);
});

test('confirmar dá entrada no estoque, recalcula custo médio e gera conta a pagar', async () => {
  const p = await purchases.confirm(ctx, purchaseId);
  assert.strictEqual(p.status, 'confirmed');
  const bal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(Number(bal.current_stock), 10);
  const prod = await knex('products').where({ id: productId }).first();
  assert.strictEqual(Number(prod.cost_price), 4); // saldo anterior era 0 → custo = custo da compra
  const entry = await knex('financial_entries').where({ tenant_id: tenant, purchase_id: purchaseId }).first();
  assert.ok(entry, 'deveria ter gerado conta a pagar');
  assert.strictEqual(entry.type, 'payable');
  assert.strictEqual(Number(entry.amount), 40);
});

test('pedido já confirmado não pode ser confirmado de novo', async () => {
  await assert.rejects(() => purchases.confirm(ctx, purchaseId), (e) => e.code === 'VALIDATION_ERROR');
});

test('estornar pedido confirmado reverte o estoque e cancela a conta a pagar', async () => {
  await purchases.cancel(ctx, purchaseId);
  const bal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(Number(bal.current_stock), 0);
  const entry = await knex('financial_entries').where({ tenant_id: tenant, purchase_id: purchaseId }).first();
  assert.strictEqual(entry.status, 'cancelled');
  const p = await purchases.get(ctx, purchaseId);
  assert.strictEqual(p.status, 'cancelled');
});

test('não estorna pedido cujo estoque já foi consumido em outro movimento', async () => {
  const p = await purchases.create(ctx, { supplierId, items: [{ productId, quantity: 5, unitCost: 4 }] });
  await purchases.confirm(ctx, p.id);
  await StockLedger.createMovement(knex, ctx, { productId, type: 'exit', quantity: 5, reason: 'venda' });
  await assert.rejects(() => purchases.cancel(ctx, p.id), (e) => e.code === 'VALIDATION_ERROR');
});

test('pedido em rascunho pode ser cancelado sem mexer no estoque', async () => {
  const p = await purchases.create(ctx, { supplierId, items: [{ productId, quantity: 3, unitCost: 4 }] });
  const balBefore = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  await purchases.cancel(ctx, p.id);
  const balAfter = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(Number(balAfter.current_stock), Number(balBefore.current_stock));
});

test('listagem pagina corretamente', async () => {
  const res = await purchases.list(ctx, { page: 1, limit: 2 });
  assert.ok(res.total >= 2);
  assert.ok(res.items.length <= 2);
});
