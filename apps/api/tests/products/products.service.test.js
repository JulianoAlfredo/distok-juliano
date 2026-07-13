'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const products = require('../../src/modules/products/products.service');
const users = require('../../src/modules/users/users.service');
const { ROLES } = require('@distok/shared');

let planTiny; let tenant; let ctx;

before(async () => {
  planTiny = uuid(); tenant = uuid();
  // plano minúsculo: 1 produto, 1 usuário — para testar limites rápido
  await knex('plans').insert({
    id: planTiny, code: 'tiny-' + planTiny.slice(0, 5), name: 'Tiny',
    price_cents: 0, max_users: 1, max_products: 1, features: JSON.stringify({ csv: false }),
  });
  await knex('tenants').insert({ id: tenant, name: 'T3', slug: 't3-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planTiny });
  ctx = new TenantContext({ tenantId: tenant, userId: uuid(), role: ROLES.ADMIN });
});

after(async () => {
  await knex('audit_log').where({ tenant_id: tenant }).del();
  await knex('stock_balance').where({ tenant_id: tenant }).del();
  await knex('products').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planTiny }).del();
  await knex.destroy();
});

test('FR16: cria produto e calcula margem', async () => {
  const p = await products.create(ctx, { name: 'Cerveja', cost_price: 4.5, sale_price: 7.9, min_stock: 24 });
  assert.ok(p.id);
  assert.strictEqual(p.margin, 75.56); // ((7.9-4.5)/4.5)*100
});

test('FR20: limite de produtos do plano bloqueia o 2º', async () => {
  await assert.rejects(
    () => products.create(ctx, { name: 'Água', cost_price: 1, sale_price: 2 }),
    (e) => e.code === 'PLAN_LIMIT_EXCEEDED'
  );
});

test('FR17: inativar produto não deleta (mantém histórico)', async () => {
  const list = await products.list(ctx, {});
  const id = list.items[0].id;
  const out = await products.inactivate(ctx, id);
  assert.strictEqual(out.status, 'inactive');
  const still = await knex('products').where({ id }).first();
  assert.ok(still, 'produto continua na base');
});

test('FR18: busca por nome', async () => {
  // após inativar acima, ainda lista por nome (sem filtro de status)
  const res = await products.list(ctx, { search: 'Cerv' });
  assert.ok(res.items.some((p) => p.name.includes('Cerveja')));
});

test('paginação: retorna total e páginas', async () => {
  const res = await products.list(ctx, { page: 1, limit: 1 });
  assert.strictEqual(res.page, 1);
  assert.ok(res.total >= 1);
  assert.ok(res.pages >= 1);
  assert.ok(res.items.length <= 1);
});

test('FR25: limite de usuários do plano bloqueia o 2º (admin do tenant conta)', async () => {
  // cria 1 usuário ativo (atinge o limite de 1)
  await users.create(ctx, { name: 'Op 1', email: `op1-${tenant.slice(0, 5)}@t3.com`, role: ROLES.OPERATOR });
  await assert.rejects(
    () => users.create(ctx, { name: 'Op 2', email: `op2-${tenant.slice(0, 5)}@t3.com`, role: ROLES.OPERATOR }),
    (e) => e.code === 'PLAN_LIMIT_EXCEEDED'
  );
});
