'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const dashboard = require('../../src/modules/dashboard/dashboard.service');
const drilldown = require('../../src/modules/dashboard/drilldown.service');
const trends = require('../../src/modules/dashboard/trends.service');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let userId; let ctx;
let customer1; let customer2; let supplier1;
let productA; let productB; let productC; let productE; // A/E: zero-ou-negativo, B: abaixo do mínimo, C: ok
let saleToday1; let saleToday2; let saleCancelled;
let finReceivablePending; let finReceivableOverdue; let finReceivablePaid; let finReceivableCancelled; let finPayablePending;

function ymd(d) { return d.toISOString().slice(0, 10); }
const today = new Date();
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

before(async () => {
  planId = uuid(); tenant = uuid(); userId = uuid();
  customer1 = uuid(); customer2 = uuid(); supplier1 = uuid();
  productA = uuid(); productB = uuid(); productC = uuid(); productE = uuid();
  saleToday1 = uuid(); saleToday2 = uuid(); saleCancelled = uuid();
  finReceivablePending = uuid(); finReceivableOverdue = uuid(); finReceivablePaid = uuid();
  finReceivableCancelled = uuid(); finPayablePending = uuid();

  await knex('plans').insert({
    id: planId, code: 'dd-' + planId.slice(0, 5), name: 'P', price_cents: 0,
    max_users: null, max_products: null, features: JSON.stringify({}),
  });
  await knex('tenants').insert({ id: tenant, name: 'TDD', slug: 'tdd-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: userId, tenant_id: tenant, name: 'Adm', email: `adm-${tenant.slice(0, 5)}@tdd.com`, password_hash: 'x', role: ROLES.ADMIN });
  ctx = new TenantContext({ tenantId: tenant, userId, role: ROLES.ADMIN });
  ctx.ip = '127.0.0.1';

  await knex('customers').insert([
    { id: customer1, tenant_id: tenant, name: 'Cliente Um' },
    { id: customer2, tenant_id: tenant, name: 'Cliente Dois' },
  ]);
  await knex('suppliers').insert({ id: supplier1, tenant_id: tenant, name: 'Fornecedor Um' });

  // produtos + saldo
  await knex('products').insert([
    { id: productA, tenant_id: tenant, name: 'Produto A - zerado', sku: 'A1', category: 'bebidas', cost_price: 5, sale_price: 10, min_stock: 10, status: 'active' },
    { id: productB, tenant_id: tenant, name: 'Produto B - abaixo do minimo', sku: 'B1', category: 'bebidas', cost_price: 3, sale_price: 6, min_stock: 5, status: 'active' },
    { id: productC, tenant_id: tenant, name: 'Produto C - ok', sku: 'C1', category: 'mercearia', cost_price: 2, sale_price: 4, min_stock: 0, status: 'active' },
    { id: productE, tenant_id: tenant, name: 'Produto E - negativo', sku: 'E1', category: 'mercearia', cost_price: 10, sale_price: 20, min_stock: 1, status: 'active' },
  ]);
  await knex('stock_balance').insert([
    { tenant_id: tenant, product_id: productA, current_stock: 0 },
    { tenant_id: tenant, product_id: productB, current_stock: 3 },
    { tenant_id: tenant, product_id: productC, current_stock: 20 },
    { tenant_id: tenant, product_id: productE, current_stock: -2 },
  ]);

  // um movimento hoje, pra série de trends (gap-fill deve preencher os outros dias com 0)
  await knex('stock_movements').insert({
    id: uuid(), tenant_id: tenant, product_id: productC, user_id: userId,
    type: 'entry', quantity: 20, balance_after: 20,
  });

  // vendas de hoje (sold_at usa o default CURRENT_TIMESTAMP)
  await knex('sales').insert([
    { id: saleToday1, tenant_id: tenant, customer_id: customer1, user_id: userId, number: 1, status: 'open', subtotal: 100, total: 100, payment_method: 'dinheiro' },
    { id: saleToday2, tenant_id: tenant, customer_id: null, user_id: userId, number: 2, status: 'open', subtotal: 50, total: 50, payment_method: 'pix' },
    { id: saleCancelled, tenant_id: tenant, customer_id: customer2, user_id: userId, number: 3, status: 'cancelled', subtotal: 999, total: 999, payment_method: 'dinheiro' },
  ]);
  await knex('sale_items').insert([
    { id: uuid(), tenant_id: tenant, sale_id: saleToday1, product_id: productC, quantity: 3, unit_price: 20, total: 60 },
    { id: uuid(), tenant_id: tenant, sale_id: saleToday1, product_id: productB, quantity: 2, unit_price: 20, total: 40 },
    { id: uuid(), tenant_id: tenant, sale_id: saleToday2, product_id: productC, quantity: 4, unit_price: 12.5, total: 50 },
  ]);

  // financeiro
  await knex('financial_entries').insert([
    { id: finReceivablePending, tenant_id: tenant, user_id: userId, type: 'receivable', status: 'pending', description: 'Receber Cliente Um', amount: 200, due_date: ymd(tomorrow), customer_id: customer1 },
    { id: finReceivableOverdue, tenant_id: tenant, user_id: userId, type: 'receivable', status: 'pending', description: 'Receber Cliente Dois', amount: 300, due_date: ymd(yesterday), customer_id: customer2 },
    { id: finReceivablePaid, tenant_id: tenant, user_id: userId, type: 'receivable', status: 'paid', description: 'Recebido', amount: 150, due_date: ymd(yesterday), paid_at: ymd(today), paid_amount: 150, customer_id: customer1 },
    { id: finReceivableCancelled, tenant_id: tenant, user_id: userId, type: 'receivable', status: 'cancelled', description: 'Cancelado', amount: 999, due_date: ymd(tomorrow), customer_id: customer1 },
    { id: finPayablePending, tenant_id: tenant, user_id: userId, type: 'payable', status: 'pending', description: 'Pagar Fornecedor Um', amount: 400, due_date: ymd(tomorrow), supplier_id: supplier1 },
  ]);
});

after(async () => {
  await knex('financial_entries').where({ tenant_id: tenant }).del();
  await knex('sale_items').where({ tenant_id: tenant }).del();
  await knex('sales').where({ tenant_id: tenant }).del();
  await knex('stock_movements').where({ tenant_id: tenant }).del();
  await knex('stock_balance').where({ tenant_id: tenant }).del();
  await knex('products').where({ tenant_id: tenant }).del();
  await knex('customers').where({ tenant_id: tenant }).del();
  await knex('suppliers').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('reconciliação: cada drill-down sem filtro bate com o card correspondente de summary()', async () => {
  const summary = await dashboard.summary(ctx);

  const zero = await drilldown.outOfStock(ctx, {});
  assert.strictEqual(zero.total, summary.zeroStock);

  const below = await drilldown.belowMin(ctx, {});
  assert.strictEqual(below.total, summary.belowMin);

  const value = await drilldown.stockValue(ctx, {});
  assert.strictEqual(value.summary.totalValue, summary.stockValue);

  const salesToday = await drilldown.sales(ctx, { period: 'today' });
  assert.strictEqual(salesToday.summary.totalAmount, summary.todaySalesTotal);
  assert.strictEqual(salesToday.summary.count, summary.todaySalesCount);

  const receivable = await drilldown.financial(ctx, { type: 'receivable' });
  assert.strictEqual(receivable.summary.totalAmount, summary.pendingReceivable);

  const payable = await drilldown.financial(ctx, { type: 'payable' });
  assert.strictEqual(payable.summary.totalAmount, summary.pendingPayable);
});

test('out-of-stock: só produtos ativos com saldo <= 0', async () => {
  const res = await drilldown.outOfStock(ctx, {});
  assert.strictEqual(res.total, 2); // productA (0) e productE (-2)
  const ids = res.items.map((i) => i.id);
  assert.ok(ids.includes(productA));
  assert.ok(ids.includes(productE));
  assert.ok(!ids.includes(productC));
});

test('below-min: missing calculado em SQL e ordenado desc', async () => {
  const res = await drilldown.belowMin(ctx, {});
  assert.strictEqual(res.total, 3); // A(0<10), B(3<5), E(-2<1)
  for (let i = 1; i < res.items.length; i++) {
    assert.ok(res.items[i - 1].missing >= res.items[i].missing, 'deve estar ordenado por missing desc');
  }
  const a = res.items.find((i) => i.id === productA);
  assert.strictEqual(a.missing, 10);
});

test('stock-value: filtro <> 0 exclui saldo zerado, inclui saldo negativo', async () => {
  const res = await drilldown.stockValue(ctx, {});
  const ids = res.items.map((i) => i.id);
  assert.ok(!ids.includes(productA), 'saldo zerado não deve aparecer na listagem (mas soma ao total 0)');
  assert.ok(ids.includes(productE), 'saldo negativo deve aparecer');
  const e = res.items.find((i) => i.id === productE);
  assert.strictEqual(e.total_value, -20);
});

test('sales: venda cancelada fica fora por default, aparece com includeCancelled=true', async () => {
  const withoutCancelled = await drilldown.sales(ctx, { period: 'today' });
  assert.strictEqual(withoutCancelled.items.some((i) => i.id === saleCancelled), false);
  assert.strictEqual(withoutCancelled.summary.count, 2);

  const withCancelled = await drilldown.sales(ctx, { period: 'today', includeCancelled: true });
  assert.strictEqual(withCancelled.items.some((i) => i.id === saleCancelled), true);
  assert.strictEqual(withCancelled.summary.count, 3);
  const cancelledItem = withCancelled.items.find((i) => i.id === saleCancelled);
  assert.strictEqual(cancelledItem.status, 'cancelled');
});

test('sales: items_count/units_count batem com sale_items', async () => {
  const res = await drilldown.sales(ctx, { period: 'today' });
  const s1 = res.items.find((i) => i.id === saleToday1);
  assert.strictEqual(s1.items_count, 2);
  assert.strictEqual(s1.units_count, 5);
  const s2 = res.items.find((i) => i.id === saleToday2);
  assert.strictEqual(s2.items_count, 1);
  assert.strictEqual(s2.units_count, 4);
  assert.strictEqual(s1.customer_name, 'Cliente Um');
  assert.strictEqual(s2.customer_name, null);
});

test('sales: busca por número da venda não vaza pro resto do filtro (período/status)', async () => {
  const res = await drilldown.sales(ctx, { period: 'today', search: '2' });
  assert.strictEqual(res.items.length, 1);
  assert.strictEqual(res.items[0].id, saleToday2);
});

test('financial: lançamento cancelado fica fora por default, aparece com includeCancelled=true em situation=all', async () => {
  const withoutCancelled = await drilldown.financial(ctx, { type: 'receivable', situation: 'all' });
  assert.strictEqual(withoutCancelled.items.some((i) => i.id === finReceivableCancelled), false);

  const withCancelled = await drilldown.financial(ctx, { type: 'receivable', situation: 'all', includeCancelled: true });
  assert.strictEqual(withCancelled.items.some((i) => i.id === finReceivableCancelled), true);
  const cancelledItem = withCancelled.items.find((i) => i.id === finReceivableCancelled);
  assert.strictEqual(cancelledItem.situation, 'cancelled');
});

test('financial: is_overdue/situation calculados corretamente', async () => {
  const res = await drilldown.financial(ctx, { type: 'receivable', situation: 'pending' });
  const overdue = res.items.find((i) => i.id === finReceivableOverdue);
  const upcoming = res.items.find((i) => i.id === finReceivablePending);
  assert.strictEqual(overdue.is_overdue, true);
  assert.strictEqual(overdue.situation, 'overdue');
  assert.ok(Number.isInteger(overdue.days_overdue) && overdue.days_overdue >= 1);
  assert.strictEqual(upcoming.is_overdue, false);
  assert.strictEqual(upcoming.situation, 'upcoming');
  assert.strictEqual(upcoming.days_overdue, null);
});

test('financial: party_name/party_type resolvidos a partir de supplier/customer', async () => {
  const res = await drilldown.financial(ctx, { type: 'payable', situation: 'pending' });
  const p = res.items.find((i) => i.id === finPayablePending);
  assert.strictEqual(p.party_type, 'supplier');
  assert.strictEqual(p.party_name, 'Fornecedor Um');
  assert.strictEqual(p.supplier_name, 'Fornecedor Um');
  assert.strictEqual(p.customer_name, null);
});

test('paginação: limit=1 devolve 1 item e pages===total; limit=999 faz clamp em 100', async () => {
  const res = await drilldown.belowMin(ctx, { limit: 1 });
  assert.strictEqual(res.items.length, 1);
  assert.strictEqual(res.pages, res.total);
  assert.strictEqual(res.limit, 1);

  const clamped = await drilldown.belowMin(ctx, { limit: 999 });
  assert.strictEqual(clamped.limit, 100);
});

test('trends/movements: gap-fill garante exatamente `days` pontos', async () => {
  const res = await trends.movements(ctx, { days: 7 });
  assert.strictEqual(res.series.length, 7);
  assert.strictEqual(res.days, 7);
  const todayPoint = res.series[res.series.length - 1];
  assert.strictEqual(todayPoint.entry, 20);
  const zeroDays = res.series.filter((p) => p.entry === 0 && p.exit === 0 && p.adjustment === 0);
  assert.strictEqual(zeroDays.length, 6);
});

test('trends/revenue: gap-fill garante exatamente `days` pontos', async () => {
  const res = await trends.revenue(ctx, { days: 30 });
  assert.strictEqual(res.series.length, 30);
  const todayPoint = res.series[res.series.length - 1];
  assert.strictEqual(todayPoint.total, 150);
  assert.strictEqual(todayPoint.count, 2);
});

test('trends: days fora do intervalo 1..90 é rejeitado', async () => {
  await assert.rejects(() => trends.movements(ctx, { days: 0 }), (e) => e.code === 'VALIDATION_ERROR');
  await assert.rejects(() => trends.movements(ctx, { days: 91 }), (e) => e.code === 'VALIDATION_ERROR');
  await assert.rejects(() => trends.revenue(ctx, { days: 0 }), (e) => e.code === 'VALIDATION_ERROR');
  await assert.rejects(() => trends.revenue(ctx, { days: 91 }), (e) => e.code === 'VALIDATION_ERROR');
});

test('financial: type ausente ou inválido é rejeitado', async () => {
  await assert.rejects(() => drilldown.financial(ctx, {}), (e) => e.code === 'VALIDATION_ERROR');
  await assert.rejects(() => drilldown.financial(ctx, { type: 'x' }), (e) => e.code === 'VALIDATION_ERROR');
});
