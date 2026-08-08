'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const TenantScopedRepository = require('../../src/core/TenantScopedRepository');
const drilldown = require('../../src/modules/dashboard/drilldown.service');
const trends = require('../../src/modules/dashboard/trends.service');
const { ROLES } = require('@distok/shared');

let planId; let tenantA; let tenantB; let productA; let productB;
let userA; let userB; let saleA; let saleB; let finA; let finB;
let ctxA; let ctxB;

before(async () => {
  planId = uuid(); tenantA = uuid(); tenantB = uuid(); productA = uuid(); productB = uuid();
  userA = uuid(); userB = uuid(); saleA = uuid(); saleB = uuid(); finA = uuid(); finB = uuid();

  await knex('plans').insert({
    id: planId, code: 'iso-' + planId.slice(0, 8), name: 'Básico', price_cents: 7990,
    max_users: 3, max_products: 200, features: JSON.stringify({ csv: false }),
  });
  await knex('tenants').insert([
    { id: tenantA, name: 'Tenant A', slug: 'tenant-a-' + tenantA.slice(0, 6), cnpj: 'A' + tenantA.slice(0, 12), plan_id: planId },
    { id: tenantB, name: 'Tenant B', slug: 'tenant-b-' + tenantB.slice(0, 6), cnpj: 'B' + tenantB.slice(0, 12), plan_id: planId },
  ]);
  await knex('users').insert([
    { id: userA, tenant_id: tenantA, name: 'User A', email: `ua-${tenantA.slice(0, 5)}@iso.com`, password_hash: 'x', role: ROLES.ADMIN },
    { id: userB, tenant_id: tenantB, name: 'User B', email: `ub-${tenantB.slice(0, 5)}@iso.com`, password_hash: 'x', role: ROLES.ADMIN },
  ]);
  await knex('products').insert([
    { id: productA, tenant_id: tenantA, name: 'Produto A', cost_price: 1, sale_price: 2, min_stock: 10, status: 'active' },
    { id: productB, tenant_id: tenantB, name: 'Produto B', cost_price: 1, sale_price: 2, min_stock: 10, status: 'active' },
  ]);
  // saldo zerado e abaixo do mínimo pros dois tenants (alimenta out-of-stock/below-min/stock-value)
  await knex('stock_balance').insert([
    { tenant_id: tenantA, product_id: productA, current_stock: 0 },
    { tenant_id: tenantB, product_id: productB, current_stock: 0 },
  ]);
  // um movimento de estoque hoje pra cada tenant (alimenta trends/movements)
  await knex('stock_movements').insert([
    { id: uuid(), tenant_id: tenantA, product_id: productA, user_id: userA, type: 'entry', quantity: 10, balance_after: 10 },
    { id: uuid(), tenant_id: tenantB, product_id: productB, user_id: userB, type: 'entry', quantity: 999, balance_after: 999 },
  ]);
  // venda hoje pra cada tenant (alimenta drilldown/sales e trends/revenue)
  await knex('sales').insert([
    { id: saleA, tenant_id: tenantA, customer_id: null, user_id: userA, number: 1, status: 'open', subtotal: 10, total: 10, payment_method: 'dinheiro' },
    { id: saleB, tenant_id: tenantB, customer_id: null, user_id: userB, number: 1, status: 'open', subtotal: 9999, total: 9999, payment_method: 'dinheiro' },
  ]);
  await knex('sale_items').insert([
    { id: uuid(), tenant_id: tenantA, sale_id: saleA, product_id: productA, quantity: 1, unit_price: 10, total: 10 },
    { id: uuid(), tenant_id: tenantB, sale_id: saleB, product_id: productB, quantity: 1, unit_price: 9999, total: 9999 },
  ]);
  // lançamento financeiro pendente (receivable) pra cada tenant (alimenta drilldown/financial)
  await knex('financial_entries').insert([
    { id: finA, tenant_id: tenantA, user_id: userA, type: 'receivable', status: 'pending', description: 'Receber A', amount: 10, due_date: new Date().toISOString().slice(0, 10) },
    { id: finB, tenant_id: tenantB, user_id: userB, type: 'receivable', status: 'pending', description: 'Receber B', amount: 9999, due_date: new Date().toISOString().slice(0, 10) },
  ]);

  ctxA = new TenantContext({ tenantId: tenantA, userId: userA, role: ROLES.ADMIN });
  ctxB = new TenantContext({ tenantId: tenantB, userId: userB, role: ROLES.ADMIN });
});

after(async () => {
  await knex('financial_entries').whereIn('tenant_id', [tenantA, tenantB]).del();
  await knex('sale_items').whereIn('tenant_id', [tenantA, tenantB]).del();
  await knex('sales').whereIn('tenant_id', [tenantA, tenantB]).del();
  await knex('stock_movements').whereIn('tenant_id', [tenantA, tenantB]).del();
  await knex('stock_balance').whereIn('tenant_id', [tenantA, tenantB]).del();
  await knex('products').whereIn('tenant_id', [tenantA, tenantB]).del();
  await knex('users').whereIn('tenant_id', [tenantA, tenantB]).del();
  await knex('tenants').whereIn('id', [tenantA, tenantB]).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('AC4: tenant A só enxerga os próprios produtos', async () => {
  const ctx = new TenantContext({ tenantId: tenantA, userId: uuid(), role: ROLES.ADMIN });
  const repo = new TenantScopedRepository(knex, 'products', ctx);
  const list = await repo.list();
  assert.ok(list.every((p) => p.tenant_id === tenantA), 'lista deve conter só produtos do tenant A');
  assert.strictEqual(list.length, 1);
});

test('AC4: tenant A NÃO acessa produto do tenant B por id (retorna vazio)', async () => {
  const ctx = new TenantContext({ tenantId: tenantA, userId: uuid(), role: ROLES.ADMIN });
  const repo = new TenantScopedRepository(knex, 'products', ctx);
  const found = await repo.findById(productB);
  assert.strictEqual(found, undefined, 'produto de outro tenant deve ser invisível (=> 404 na rota)');
});

test('AC5: insert ignora tenant_id do cliente e usa o do contexto', async () => {
  const ctx = new TenantContext({ tenantId: tenantA, userId: uuid(), role: ROLES.ADMIN });
  const repo = new TenantScopedRepository(knex, 'products', ctx);
  const id = uuid();
  await repo.insert({ id, tenant_id: tenantB, name: 'Tentativa de invasão', cost_price: 1, sale_price: 2 });
  const row = await knex('products').where({ id }).first();
  assert.strictEqual(row.tenant_id, tenantA, 'tenant_id deve ser o do contexto, não o enviado pelo cliente');
  await knex('products').where({ id }).del();
});

test('contexto não-super sem tenantId é rejeitado', async () => {
  const badCtx = new TenantContext({ tenantId: null, userId: uuid(), role: ROLES.ADMIN });
  const repo = new TenantScopedRepository(knex, 'products', badCtx);
  await assert.rejects(async () => repo.query(), /tenantId ausente/);
});

// ---------------------------------------------------------------------------
// Drill-downs do dashboard: tenant A não pode ver nem contabilizar dados do
// tenant B (produtos, vendas, financeiro), mesmo sem filtro nenhum.
// ---------------------------------------------------------------------------

test('drilldown/out-of-stock: A não vê nem contabiliza produto de B', async () => {
  const resA = await drilldown.outOfStock(ctxA, {});
  assert.strictEqual(resA.total, 1);
  assert.ok(resA.items.every((i) => i.id !== productB));
  assert.strictEqual(resA.items[0].id, productA);
});

test('drilldown/below-min: A não vê nem contabiliza produto de B', async () => {
  const resA = await drilldown.belowMin(ctxA, {});
  assert.strictEqual(resA.total, 1);
  assert.ok(resA.items.every((i) => i.id !== productB));
});

test('drilldown/stock-value: summary de A não soma valor de B', async () => {
  // saldo 0 não conta valor mas prova que o item de B não aparece nem some ao total
  await knex('stock_balance').where({ tenant_id: tenantA, product_id: productA }).update({ current_stock: 5 });
  await knex('stock_balance').where({ tenant_id: tenantB, product_id: productB }).update({ current_stock: 5000 });
  const resA = await drilldown.stockValue(ctxA, {});
  assert.ok(resA.items.every((i) => i.id !== productB));
  assert.strictEqual(resA.summary.totalValue, 5 * 1); // productA: current_stock 5 * cost_price 1
  // restaura pro resto da suíte
  await knex('stock_balance').where({ tenant_id: tenantA, product_id: productA }).update({ current_stock: 0 });
  await knex('stock_balance').where({ tenant_id: tenantB, product_id: productB }).update({ current_stock: 0 });
});

test('drilldown/sales: A não vê nem soma venda de B', async () => {
  const resA = await drilldown.sales(ctxA, { period: 'today' });
  assert.ok(resA.items.every((i) => i.id !== saleB));
  assert.strictEqual(resA.summary.totalAmount, 10);
  assert.strictEqual(resA.summary.count, 1);
});

test('drilldown/financial: A não vê nem soma lançamento de B', async () => {
  const resA = await drilldown.financial(ctxA, { type: 'receivable' });
  assert.ok(resA.items.every((i) => i.id !== finB));
  assert.strictEqual(resA.summary.totalAmount, 10);
  assert.strictEqual(resA.summary.count, 1);
});

test('drilldown: na direção oposta, B também não vê nem soma dados de A', async () => {
  const outB = await drilldown.outOfStock(ctxB, {});
  assert.ok(outB.items.every((i) => i.id !== productA));

  const salesB = await drilldown.sales(ctxB, { period: 'today' });
  assert.ok(salesB.items.every((i) => i.id !== saleA));
  assert.strictEqual(salesB.summary.totalAmount, 9999);

  const finB_ = await drilldown.financial(ctxB, { type: 'receivable' });
  assert.ok(finB_.items.every((i) => i.id !== finA));
  assert.strictEqual(finB_.summary.totalAmount, 9999);
});

// ---------------------------------------------------------------------------
// Tendências: série de A não pode incluir movimento/receita de B.
// ---------------------------------------------------------------------------

test('trends/movements: série de A não soma movimento de B', async () => {
  const resA = await trends.movements(ctxA, { days: 7 });
  const total = resA.series.reduce((s, p) => s + p.entry + p.exit + p.adjustment, 0);
  assert.strictEqual(total, 10); // só o movimento do tenant A (quantity 10), não os 999 de B
});

test('trends/revenue: série de A não soma receita de B', async () => {
  const resA = await trends.revenue(ctxA, { days: 30 });
  const total = resA.series.reduce((s, p) => s + p.total, 0);
  const count = resA.series.reduce((s, p) => s + p.count, 0);
  assert.strictEqual(total, 10); // só a venda do tenant A, não os 9999 de B
  assert.strictEqual(count, 1);
});
