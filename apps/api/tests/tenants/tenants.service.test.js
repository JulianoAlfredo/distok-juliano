'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const tenants = require('../../src/modules/tenants/tenants.service');
const { ROLES, DEFAULT_PLANS } = require('@distok/shared');

let createdTenantId;
let basicPlanId;
const superCtx = new TenantContext({ tenantId: null, userId: uuid(), role: ROLES.SUPER_ADMIN });
superCtx.ip = '127.0.0.1';
const uniq = uuid().slice(0, 8);

before(async () => {
  basicPlanId = uuid();
  const basic = DEFAULT_PLANS.find((p) => p.code === 'basic');
  // garante um plano com code 'basic' (createTenant busca por code)
  const existing = await knex('plans').where({ code: 'basic' }).first();
  if (!existing) {
    await knex('plans').insert({ id: basicPlanId, code: 'basic', name: 'Básico', price_cents: 7990, max_users: 3, max_products: 200, features: JSON.stringify(basic.features) });
  } else {
    basicPlanId = existing.id;
  }
});

after(async () => {
  if (createdTenantId) {
    await knex('audit_log').where({ tenant_id: createdTenantId }).del();
    await knex('tenant_terminology').where({ tenant_id: createdTenantId }).del();
    await knex('tenant_branding').where({ tenant_id: createdTenantId }).del();
    await knex('users').where({ tenant_id: createdTenantId }).del();
    await knex('tenants').where({ id: createdTenantId }).del();
  }
  await knex.destroy();
});

test('FR1/FR7: createTenant cria tenant + admin + branding + terminologia', async () => {
  const res = await tenants.createTenant({
    ctx: superCtx,
    name: 'Distribuidora Teste',
    cnpj: `00.000.${uniq.slice(0, 3)}/0001-00`,
    slug: `teste-${uniq}`,
    planCode: 'basic',
    adminName: 'Admin Teste',
    adminEmail: `admin-${uniq}@teste.com`,
    ip: '127.0.0.1',
  });
  createdTenantId = res.id;
  assert.ok(res.id);

  const admin = await knex('users').where({ tenant_id: createdTenantId, role: ROLES.ADMIN }).first();
  assert.ok(admin, 'admin inicial criado');
  assert.strictEqual(admin.must_change_password, 1, 'admin deve trocar senha no 1º acesso');

  const branding = await knex('tenant_branding').where({ tenant_id: createdTenantId }).first();
  assert.ok(branding, 'branding criado');

  const terms = await knex('tenant_terminology').where({ tenant_id: createdTenantId });
  assert.ok(terms.length >= 1, 'terminologia padrão criada');
});

test('FR2: updateStatus suspende o tenant', async () => {
  const out = await tenants.updateStatus({ ctx: superCtx, tenantId: createdTenantId, status: 'suspended', ip: '127.0.0.1' });
  assert.strictEqual(out.status, 'suspended');
});

test('FR4: metrics retorna contagem e MRR', async () => {
  const m = await tenants.metrics();
  assert.ok(typeof m.tenants === 'number');
  assert.ok(typeof m.mrr === 'number');
  assert.ok(Array.isArray(m.byPlan));
});
