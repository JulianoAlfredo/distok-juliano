'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const TenantScopedRepository = require('../../src/core/TenantScopedRepository');
const { ROLES } = require('@distok/shared');

let planId; let tenantA; let tenantB; let productA; let productB;

before(async () => {
  planId = uuid(); tenantA = uuid(); tenantB = uuid(); productA = uuid(); productB = uuid();

  await knex('plans').insert({
    id: planId, code: 'basic', name: 'Básico', price_cents: 7990,
    max_users: 3, max_products: 200, features: JSON.stringify({ csv: false }),
  });
  await knex('tenants').insert([
    { id: tenantA, name: 'Tenant A', slug: 'tenant-a-' + tenantA.slice(0, 6), cnpj: 'A' + tenantA.slice(0, 12), plan_id: planId },
    { id: tenantB, name: 'Tenant B', slug: 'tenant-b-' + tenantB.slice(0, 6), cnpj: 'B' + tenantB.slice(0, 12), plan_id: planId },
  ]);
  await knex('products').insert([
    { id: productA, tenant_id: tenantA, name: 'Produto A', cost_price: 1, sale_price: 2 },
    { id: productB, tenant_id: tenantB, name: 'Produto B', cost_price: 1, sale_price: 2 },
  ]);
});

after(async () => {
  await knex('products').whereIn('tenant_id', [tenantA, tenantB]).del();
  await knex('tenants').whereIn('id', [tenantA, tenantB]).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('AC4: tenant A só enxerga os próprios produtos', async () => {
  const ctxA = new TenantContext({ tenantId: tenantA, userId: uuid(), role: ROLES.ADMIN });
  const repo = new TenantScopedRepository(knex, 'products', ctxA);
  const list = await repo.list();
  assert.ok(list.every((p) => p.tenant_id === tenantA), 'lista deve conter só produtos do tenant A');
  assert.strictEqual(list.length, 1);
});

test('AC4: tenant A NÃO acessa produto do tenant B por id (retorna vazio)', async () => {
  const ctxA = new TenantContext({ tenantId: tenantA, userId: uuid(), role: ROLES.ADMIN });
  const repo = new TenantScopedRepository(knex, 'products', ctxA);
  const found = await repo.findById(productB);
  assert.strictEqual(found, undefined, 'produto de outro tenant deve ser invisível (=> 404 na rota)');
});

test('AC5: insert ignora tenant_id do cliente e usa o do contexto', async () => {
  const ctxA = new TenantContext({ tenantId: tenantA, userId: uuid(), role: ROLES.ADMIN });
  const repo = new TenantScopedRepository(knex, 'products', ctxA);
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
