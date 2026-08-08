'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const service = require('../../src/modules/ze-delivery/ze-delivery.service');
const client = require('../../src/modules/ze-delivery/ze-delivery.client');
const cryptoUtil = require('../../src/utils/crypto');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let adminId; let ctx;

before(async () => {
  planId = uuid(); tenant = uuid(); adminId = uuid();
  await knex('plans').insert({ id: planId, code: 'ol-' + planId.slice(0, 5), name: 'P', price_cents: 0, max_users: null, max_products: null, features: JSON.stringify({}) });
  await knex('tenants').insert({ id: tenant, name: 'T-OrdersLog', slug: 'ol-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: adminId, tenant_id: tenant, name: 'Admin', email: `adm-${tenant.slice(0, 5)}@t.com`, password_hash: 'x', role: ROLES.ADMIN });
  await knex('ze_delivery_credentials').insert({
    tenant_id: tenant, environment: 'sandbox', client_id: 'cid', client_secret_enc: cryptoUtil.encrypt('secret'),
    merchant_ids: JSON.stringify(['m1']), status: 'active',
  });
  ctx = new TenantContext({ tenantId: tenant, userId: adminId, role: ROLES.ADMIN });
});

after(async () => {
  await knex('ze_delivery_orders').where({ tenant_id: tenant }).del();
  await knex('ze_delivery_credentials').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('upsert de ze_delivery_orders é idempotente por pedido através de vários eventos', async (t) => {
  t.mock.method(client, 'authenticate', async () => ({ accessToken: 'tok', expiresIn: 3600 }));
  t.mock.method(client, 'acknowledgeEvents', async () => {});

  const sequence = [
    { eventType: 'CREATED', status: undefined, total: null },
    { eventType: 'CONFIRMED', status: undefined, total: null },
    { eventType: 'CONCLUDED', status: undefined, total: 55.5 },
  ];
  for (const step of sequence) {
    t.mock.method(client, 'pollEvents', async () => ([{ eventId: `ev-${step.eventType}`, orderId: 'order-log-1', eventType: step.eventType }]));
    t.mock.method(client, 'getOrder', async () => ({ total: step.total, items: [] }));
    await service.pollAllTenants();
  }

  const rows = await knex('ze_delivery_orders').where({ tenant_id: tenant, order_number: 'order-log-1' });
  assert.strictEqual(rows.length, 1, 'deve existir uma única linha para o pedido, não uma por evento');
  assert.strictEqual(rows[0].status, 'CONCLUDED');
  assert.strictEqual(Number(rows[0].total_value), 55.5);
});

test('GET /orders: soma agregada bate com a soma manual dos pedidos concluídos', async (t) => {
  t.mock.method(client, 'authenticate', async () => ({ accessToken: 'tok', expiresIn: 3600 }));
  t.mock.method(client, 'acknowledgeEvents', async () => {});
  t.mock.method(client, 'pollEvents', async () => ([{ eventId: 'ev-x', orderId: 'order-log-2', eventType: 'CONCLUDED' }]));
  t.mock.method(client, 'getOrder', async () => ({ total: 20, items: [] }));
  await service.pollAllTenants();

  const result = await service.listOrders(ctx, {});
  const manualSum = result.items
    .filter((o) => o.status === 'CONCLUDED')
    .reduce((acc, o) => acc + Number(o.total_value || 0), 0);
  assert.strictEqual(result.totalValueConcluded, manualSum);
  assert.ok(result.totalValueConcluded >= 55.5 + 20 - 0.01);
});
