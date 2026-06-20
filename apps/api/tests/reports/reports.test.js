'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const reports = require('../../src/modules/reports/reports.service');
const dashboard = require('../../src/modules/dashboard/dashboard.service');
const { toCSV } = require('../../src/utils/csv');
const { toPDF } = require('../../src/utils/pdf');
const { hasFeature } = require('../../src/middlewares/plan-guard');
const { ROLES } = require('@distok/shared');

let basicPlan; let proPlan; let tenant; let ctx; let productId;

before(async () => {
  basicPlan = uuid(); proPlan = uuid(); tenant = uuid(); productId = uuid();
  await knex('plans').insert([
    { id: basicPlan, code: 'rb-' + basicPlan.slice(0, 5), name: 'Básico', price_cents: 7990, max_users: 3, max_products: 200, features: JSON.stringify({ csv: false }) },
    { id: proPlan, code: 'rp-' + proPlan.slice(0, 5), name: 'Pro', price_cents: 14990, max_users: 10, max_products: null, features: JSON.stringify({ csv: true }) },
  ]);
  await knex('tenants').insert({ id: tenant, name: 'T5', slug: 't5-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: proPlan });
  await knex('tenant_branding').insert({ tenant_id: tenant, display_name: 'T5 Co', color_primary: '#1B7F3B' });
  await knex('products').insert({ id: productId, tenant_id: tenant, name: 'Cerveja', sku: 'CRV', cost_price: 4.5, sale_price: 7.9, min_stock: 24 });
  await knex('stock_balance').insert({ tenant_id: tenant, product_id: productId, current_stock: 10 });
  ctx = new TenantContext({ tenantId: tenant, userId: uuid(), role: ROLES.ADMIN });
});

after(async () => {
  await knex('stock_balance').where({ tenant_id: tenant }).del();
  await knex('products').where({ tenant_id: tenant }).del();
  await knex('tenant_branding').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').whereIn('id', [basicPlan, proPlan]).del();
  await knex.destroy();
});

test('FR35: dataset de estoque atual tem colunas e linhas', async () => {
  const ds = await reports.stockCurrent(ctx);
  assert.strictEqual(ds.title, 'Estoque atual');
  assert.ok(ds.rows.length >= 1);
  assert.ok(ds.columns.some((c) => c.label === 'Total (custo)'));
});

test('FR38: dataset de abaixo do mínimo (saldo 10 < min 24)', async () => {
  const ds = await reports.belowMin(ctx);
  assert.ok(ds.rows.some((r) => r.name === 'Cerveja'));
});

test('CSV é gerado com cabeçalho e separador ;', async () => {
  const ds = await reports.stockCurrent(ctx);
  const csv = toCSV(ds.columns, ds.rows);
  assert.ok(csv.includes('Produto;SKU;Saldo'));
  assert.ok(csv.includes('Cerveja'));
});

test('PDF é gerado como Buffer com assinatura %PDF', async () => {
  const ds = await reports.stockCurrent(ctx);
  const branding = await reports.getBranding(ctx);
  const buf = await toPDF({ title: ds.title, columns: ds.columns, rows: ds.rows, branding });
  assert.ok(Buffer.isBuffer(buf));
  assert.strictEqual(buf.subarray(0, 4).toString(), '%PDF');
});

test('FR40: feature csv habilitada no Pro, bloqueada no Básico', async () => {
  assert.strictEqual(await hasFeature(tenant, 'csv'), true);
  // troca tenant para plano básico e revalida
  await knex('tenants').where({ id: tenant }).update({ plan_id: basicPlan });
  assert.strictEqual(await hasFeature(tenant, 'csv'), false);
  await knex('tenants').where({ id: tenant }).update({ plan_id: proPlan });
});

test('FR41: dashboard summary agrega KPIs', async () => {
  const s = await dashboard.summary(ctx);
  assert.strictEqual(s.productsActive, 1);
  assert.strictEqual(s.belowMin, 1);
  assert.ok(s.stockValue >= 45); // 10 * 4.5
  assert.ok(Array.isArray(s.lastMovements));
});
