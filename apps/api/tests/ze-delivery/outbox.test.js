'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const StockLedger = require('../../src/core/StockLedger');
const service = require('../../src/modules/ze-delivery/ze-delivery.service');
const client = require('../../src/modules/ze-delivery/ze-delivery.client');
const cryptoUtil = require('../../src/utils/crypto');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let userId; let productId; let ctx;

before(async () => {
  planId = uuid(); tenant = uuid(); userId = uuid(); productId = uuid();
  await knex('plans').insert({ id: planId, code: 'ob-' + planId.slice(0, 5), name: 'P', price_cents: 0, max_users: null, max_products: null, features: JSON.stringify({}) });
  await knex('tenants').insert({ id: tenant, name: 'T-Outbox', slug: 'ob-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: userId, tenant_id: tenant, name: 'Op', email: `op-${tenant.slice(0, 5)}@t.com`, password_hash: 'x', role: ROLES.OPERATOR });
  await knex('products').insert({ id: productId, tenant_id: tenant, name: 'Suco', cost_price: 2, sale_price: 5, min_stock: 0, ze_delivery_item_id: 'zi-out-1', ze_delivery_sync_enabled: 1 });
  await knex('stock_balance').insert({ tenant_id: tenant, product_id: productId, current_stock: 20 });
  await knex('ze_delivery_credentials').insert({
    tenant_id: tenant, environment: 'sandbox', client_id: 'cid', client_secret_enc: cryptoUtil.encrypt('secret'),
    merchant_ids: JSON.stringify(['m1']), status: 'active',
  });
  ctx = new TenantContext({ tenantId: tenant, userId, role: ROLES.OPERATOR });
});

after(async () => {
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

test('drain: envia o saldo fresco e apaga a linha em caso de sucesso', async (t) => {
  await StockLedger.createMovement(knex, ctx, { productId, type: 'entry', quantity: 5 }); // saldo 20 -> 25, enfileira
  let sentQty = null;
  t.mock.method(client, 'authenticate', async () => ({ accessToken: 'tok', expiresIn: 3600 }));
  t.mock.method(client, 'updateAvailability', async ({ zeItemId, quantity }) => {
    assert.strictEqual(zeItemId, 'zi-out-1');
    sentQty = quantity;
    return {};
  });

  const summary = await service.drainOutbox();
  assert.strictEqual(summary.succeeded, 1);
  assert.strictEqual(sentQty, 25);

  const row = await knex('ze_delivery_outbox').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(row, undefined, 'linha deve ser removida após sucesso');
});

test('drain: falha mantém pending pra retry e soma attempts', async (t) => {
  await StockLedger.createMovement(knex, ctx, { productId, type: 'entry', quantity: 1 }); // reenfileira
  t.mock.method(client, 'authenticate', async () => ({ accessToken: 'tok', expiresIn: 3600 }));
  t.mock.method(client, 'updateAvailability', async () => { throw new Error('timeout simulado'); });

  const summary = await service.drainOutbox();
  assert.strictEqual(summary.failed, 1);

  const row = await knex('ze_delivery_outbox').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(row.status, 'pending');
  assert.strictEqual(row.attempts, 1);
  assert.match(row.last_error, /timeout simulado/);
});

test('drain: excede tentativas máximas e marca status=error', async (t) => {
  await knex('ze_delivery_outbox').where({ tenant_id: tenant, product_id: productId }).update({ attempts: 8 });
  t.mock.method(client, 'authenticate', async () => ({ accessToken: 'tok', expiresIn: 3600 }));
  t.mock.method(client, 'updateAvailability', async () => { throw new Error('falha persistente'); });

  await service.drainOutbox();
  const row = await knex('ze_delivery_outbox').where({ tenant_id: tenant, product_id: productId }).first();
  assert.strictEqual(row.status, 'error');
});
