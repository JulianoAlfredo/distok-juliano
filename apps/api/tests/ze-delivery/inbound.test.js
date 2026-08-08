'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const service = require('../../src/modules/ze-delivery/ze-delivery.service');
const client = require('../../src/modules/ze-delivery/ze-delivery.client');
const cryptoUtil = require('../../src/utils/crypto');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let adminId; let productMapped;

before(async () => {
  planId = uuid(); tenant = uuid(); adminId = uuid(); productMapped = uuid();
  await knex('plans').insert({ id: planId, code: 'inb-' + planId.slice(0, 5), name: 'P', price_cents: 0, max_users: null, max_products: null, features: JSON.stringify({}) });
  await knex('tenants').insert({ id: tenant, name: 'T-Inbound', slug: 'inb-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: adminId, tenant_id: tenant, name: 'Admin', email: `adm-${tenant.slice(0, 5)}@t.com`, password_hash: 'x', role: ROLES.ADMIN });
  await knex('products').insert({ id: productMapped, tenant_id: tenant, name: 'Cerveja', cost_price: 4, sale_price: 8, min_stock: 0, ze_delivery_item_id: 'zi-1', ze_delivery_sync_enabled: 1 });
  await knex('stock_balance').insert({ tenant_id: tenant, product_id: productMapped, current_stock: 50 });
  await knex('ze_delivery_credentials').insert({
    tenant_id: tenant, environment: 'sandbox', client_id: 'cid', client_secret_enc: cryptoUtil.encrypt('secret'),
    merchant_ids: JSON.stringify(['m1']), status: 'active',
  });
});

after(async () => {
  await knex('ze_delivery_orders').where({ tenant_id: tenant }).del();
  await knex('ze_delivery_outbox').where({ tenant_id: tenant }).del();
  await knex('ze_delivery_credentials').where({ tenant_id: tenant }).del();
  await knex('audit_log').where({ tenant_id: tenant }).del();
  await knex('stock_movements').where({ tenant_id: tenant }).del();
  await knex('stock_balance').where({ tenant_id: tenant }).del();
  await knex('products').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('CONCLUDED com linha mapeada dá baixa de estoque e loga o pedido (com valor)', async (t) => {
  t.mock.method(client, 'authenticate', async () => ({ accessToken: 'tok', expiresIn: 3600 }));
  t.mock.method(client, 'pollEvents', async () => ([{ eventId: 'ev-1', orderId: 'order-1', eventType: 'CONCLUDED' }]));
  t.mock.method(client, 'getOrder', async ({ orderNumber }) => {
    assert.strictEqual(orderNumber, 'order-1');
    return { status: 'CONCLUDED', total: 30, items: [{ itemId: 'zi-1', quantity: 5, unitPrice: 6 }] };
  });
  let acked = null;
  t.mock.method(client, 'acknowledgeEvents', async ({ events }) => { acked = events; });

  const summary = await service.pollAllTenants();
  assert.strictEqual(summary.tenantsFailed, 0);
  assert.ok(acked && acked.length === 1 && acked[0].id === 'ev-1');

  const bal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productMapped }).first();
  assert.strictEqual(Number(bal.current_stock), 45, 'saldo deve baixar 5 (venda concluída)');

  const order = await knex('ze_delivery_orders').where({ tenant_id: tenant, order_number: 'order-1' }).first();
  assert.ok(order, 'pedido deve ser logado');
  assert.strictEqual(order.status, 'CONCLUDED');
  assert.strictEqual(Number(order.total_value), 30);

  const mov = await knex('stock_movements').where({ tenant_id: tenant, source: 'ze_delivery_order' }).first();
  assert.ok(mov);
  assert.strictEqual(mov.external_ref, 'ev-1:' + productMapped);
});

test('reentrega do mesmo evento (retry de polling) não duplica a baixa', async (t) => {
  t.mock.method(client, 'authenticate', async () => ({ accessToken: 'tok', expiresIn: 3600 }));
  t.mock.method(client, 'pollEvents', async () => ([{ eventId: 'ev-1', orderId: 'order-1', eventType: 'CONCLUDED' }]));
  t.mock.method(client, 'getOrder', async () => ({ status: 'CONCLUDED', total: 30, items: [{ itemId: 'zi-1', quantity: 5, unitPrice: 6 }] }));
  t.mock.method(client, 'acknowledgeEvents', async () => {});

  await service.pollAllTenants();
  const bal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productMapped }).first();
  assert.strictEqual(Number(bal.current_stock), 45, 'saldo não pode cair de novo pro mesmo evento');
  const movs = await knex('stock_movements').where({ tenant_id: tenant, source: 'ze_delivery_order', external_ref: 'ev-1:' + productMapped });
  assert.strictEqual(movs.length, 1);
});

test('linha sem produto vinculado é pulada sem derrubar o evento', async (t) => {
  t.mock.method(client, 'authenticate', async () => ({ accessToken: 'tok', expiresIn: 3600 }));
  t.mock.method(client, 'pollEvents', async () => ([{ eventId: 'ev-2', orderId: 'order-2', eventType: 'CONCLUDED' }]));
  t.mock.method(client, 'getOrder', async () => ({ status: 'CONCLUDED', total: 12, items: [{ itemId: 'zi-unknown', quantity: 2, unitPrice: 6 }] }));
  let acked = null;
  t.mock.method(client, 'acknowledgeEvents', async ({ events }) => { acked = events; });

  const before = await knex('stock_balance').where({ tenant_id: tenant, product_id: productMapped }).first();
  await service.pollAllTenants();
  const afterBal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productMapped }).first();
  assert.strictEqual(Number(before.current_stock), Number(afterBal.current_stock), 'saldo do produto mapeado não deve mudar');
  assert.ok(acked && acked.length === 1, 'evento deve ser confirmado mesmo com linha sem mapeamento');

  const cred = await knex('ze_delivery_credentials').where({ tenant_id: tenant }).first();
  assert.match(cred.last_error, /zi-unknown/);
});

test('evento CANCELLED não gera baixa mas é logado e confirmado', async (t) => {
  t.mock.method(client, 'authenticate', async () => ({ accessToken: 'tok', expiresIn: 3600 }));
  t.mock.method(client, 'pollEvents', async () => ([{ eventId: 'ev-3', orderId: 'order-3', eventType: 'CANCELLED' }]));
  t.mock.method(client, 'getOrder', async () => ({}));
  let acked = null;
  t.mock.method(client, 'acknowledgeEvents', async ({ events }) => { acked = events; });

  const before = await knex('stock_balance').where({ tenant_id: tenant, product_id: productMapped }).first();
  await service.pollAllTenants();
  const afterBal = await knex('stock_balance').where({ tenant_id: tenant, product_id: productMapped }).first();
  assert.strictEqual(Number(before.current_stock), Number(afterBal.current_stock));
  assert.ok(acked && acked.length === 1);

  const order = await knex('ze_delivery_orders').where({ tenant_id: tenant, order_number: 'order-3' }).first();
  assert.ok(order);
  assert.strictEqual(order.status, 'CANCELLED');
});
