'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const sales = require('../../src/modules/sales/sales.service');
const stock = require('../../src/modules/stock/stock.service');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let userId; let productId; let ctx;

before(async () => {
  planId = uuid(); tenant = uuid(); userId = uuid(); productId = uuid();
  await knex('plans').insert({
    id: planId, code: 'sl-' + planId.slice(0, 5), name: 'P', price_cents: 0,
    max_users: null, max_products: null, features: JSON.stringify({}),
  });
  await knex('tenants').insert({ id: tenant, name: 'TS', slug: 'ts-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: userId, tenant_id: tenant, name: 'Op', email: `op-${tenant.slice(0, 5)}@ts.com`, password_hash: 'x', role: ROLES.OPERATOR });
  await knex('products').insert({ id: productId, tenant_id: tenant, name: 'Produto', cost_price: 5, sale_price: 10, min_stock: 0 });
  await knex('stock_balance').insert({ tenant_id: tenant, product_id: productId, current_stock: 0 });
  ctx = new TenantContext({ tenantId: tenant, userId, role: ROLES.ADMIN });
  ctx.ip = '127.0.0.1';
  await stock.createMovement(ctx, { productId, type: 'entry', quantity: 100 });
});

after(async () => {
  await knex('financial_entries').where({ tenant_id: tenant }).del();
  await knex('sale_payments').where({ tenant_id: tenant }).del();
  await knex('sale_items').where({ tenant_id: tenant }).del();
  await knex('sales').where({ tenant_id: tenant }).del();
  await knex('audit_log').where({ tenant_id: tenant }).del();
  await knex('stock_movements').where({ tenant_id: tenant }).del();
  await knex('stock_balance').where({ tenant_id: tenant }).del();
  await knex('products').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('cria venda com pagamento único e baixa o estoque', async () => {
  const sale = await sales.create(ctx, {
    items: [{ productId, quantity: 5, unitPrice: 10 }],
    payments: [{ method: 'dinheiro', amount: 50, receivedAmount: 50 }],
  });
  assert.strictEqual(Number(sale.total), 50);
  assert.strictEqual(sale.payments.length, 1);
  assert.strictEqual(sale.payments[0].method, 'dinheiro');
  const bal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(Number(bal.current_stock), 95);
});

test('calcula troco quando o valor recebido é maior que o pago', async () => {
  const sale = await sales.create(ctx, {
    items: [{ productId, quantity: 1, unitPrice: 10 }],
    payments: [{ method: 'dinheiro', amount: 10, receivedAmount: 20 }],
  });
  assert.strictEqual(Number(sale.payments[0].change_amount), 10);
});

test('pagamento dividido: a soma precisa bater com o total', async () => {
  await assert.rejects(
    () => sales.create(ctx, {
      items: [{ productId, quantity: 1, unitPrice: 10 }],
      payments: [{ method: 'dinheiro', amount: 5 }, { method: 'pix', amount: 4 }],
    }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
});

test('pagamento dividido válido grava as linhas e marca payment_method como multiplo', async () => {
  const sale = await sales.create(ctx, {
    items: [{ productId, quantity: 1, unitPrice: 10 }],
    payments: [{ method: 'dinheiro', amount: 4 }, { method: 'pix', amount: 6 }],
  });
  assert.strictEqual(sale.payment_method, 'multiplo');
  assert.strictEqual(sale.payments.length, 2);
});

test('boleto gera conta a receber vinculada à venda', async () => {
  const sale = await sales.create(ctx, {
    items: [{ productId, quantity: 1, unitPrice: 10 }],
    payments: [{ method: 'boleto', amount: 10 }],
  });
  const entry = await knex('financial_entries').where({ tenant_id: tenant, sale_id: sale.id }).first();
  assert.ok(entry, 'deveria ter criado conta a receber');
  assert.strictEqual(entry.type, 'receivable');
  assert.strictEqual(Number(entry.amount), 10);
});

test('pagamento em dinheiro não gera conta a receber', async () => {
  const sale = await sales.create(ctx, {
    items: [{ productId, quantity: 1, unitPrice: 10 }],
    payments: [{ method: 'dinheiro', amount: 10 }],
  });
  const entry = await knex('financial_entries').where({ tenant_id: tenant, sale_id: sale.id }).first();
  assert.strictEqual(entry, undefined);
});

test('cancelar venda estorna o estoque e cancela a conta a receber pendente', async () => {
  const sale = await sales.create(ctx, {
    items: [{ productId, quantity: 2, unitPrice: 10 }],
    payments: [{ method: 'boleto', amount: 20 }],
  });
  const balBefore = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  await sales.cancel(ctx, sale.id);
  const balAfter = await knex('stock_balance').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(Number(balAfter.current_stock), Number(balBefore.current_stock) + 2);
  const entry = await knex('financial_entries').where({ tenant_id: tenant, sale_id: sale.id }).first();
  assert.strictEqual(entry.status, 'cancelled');
  const updated = await sales.get(ctx, sale.id);
  assert.strictEqual(updated.status, 'cancelled');
});

test('venda cancelada não pode ser cancelada de novo', async () => {
  const sale = await sales.create(ctx, {
    items: [{ productId, quantity: 1, unitPrice: 10 }],
    payments: [{ method: 'dinheiro', amount: 10 }],
  });
  await sales.cancel(ctx, sale.id);
  await assert.rejects(() => sales.cancel(ctx, sale.id), (e) => e.code === 'VALIDATION_ERROR');
});

test('listagem pagina corretamente', async () => {
  const res = await sales.list(ctx, { page: 1, limit: 2 });
  assert.ok(res.total >= 2);
  assert.ok(res.items.length <= 2);
  assert.strictEqual(res.page, 1);
});
