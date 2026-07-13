'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const cashier = require('../../src/modules/cashier/cashier.service');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let user1; let user2; let admin; let ctx1; let ctx2; let ctxAdmin;

before(async () => {
  planId = uuid(); tenant = uuid(); user1 = uuid(); user2 = uuid(); admin = uuid();
  await knex('plans').insert({
    id: planId, code: 'cx-' + planId.slice(0, 5), name: 'P', price_cents: 0,
    max_users: null, max_products: null, features: JSON.stringify({}),
  });
  await knex('tenants').insert({ id: tenant, name: 'TC', slug: 'tc-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert([
    { id: user1, tenant_id: tenant, name: 'Op1', email: `op1-${tenant.slice(0, 5)}@tc.com`, password_hash: 'x', role: ROLES.OPERATOR },
    { id: user2, tenant_id: tenant, name: 'Op2', email: `op2-${tenant.slice(0, 5)}@tc.com`, password_hash: 'x', role: ROLES.OPERATOR },
    { id: admin, tenant_id: tenant, name: 'Adm', email: `adm-${tenant.slice(0, 5)}@tc.com`, password_hash: 'x', role: ROLES.ADMIN },
  ]);
  ctx1 = new TenantContext({ tenantId: tenant, userId: user1, role: ROLES.OPERATOR });
  ctx1.ip = '127.0.0.1';
  ctx2 = new TenantContext({ tenantId: tenant, userId: user2, role: ROLES.OPERATOR });
  ctx2.ip = '127.0.0.1';
  ctxAdmin = new TenantContext({ tenantId: tenant, userId: admin, role: ROLES.ADMIN });
  ctxAdmin.ip = '127.0.0.1';
});

after(async () => {
  await knex('cashier_entries').where({ tenant_id: tenant }).del();
  await knex('cashier_sessions').where({ tenant_id: tenant }).del();
  await knex('audit_log').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('dois operadores podem ter caixa aberto ao mesmo tempo (P0 #3)', async () => {
  const s1 = await cashier.openSession(ctx1, { openingBalance: 100 });
  const s2 = await cashier.openSession(ctx2, { openingBalance: 50 });
  assert.notStrictEqual(s1.id, s2.id);
  const c1 = await cashier.currentSession(ctx1);
  const c2 = await cashier.currentSession(ctx2);
  assert.strictEqual(c1.id, s1.id);
  assert.strictEqual(c2.id, s2.id);
});

test('o mesmo operador não pode abrir um segundo caixa (constraint no banco)', async () => {
  await assert.rejects(() => cashier.openSession(ctx1, { openingBalance: 10 }), (e) => e.code === 'CONFLICT');
});

test('operador não vê nem lança no caixa de outro operador', async () => {
  const mine = await cashier.currentSession(ctx1);
  await assert.rejects(() => cashier.getSession(ctx2, mine.id), (e) => e.code === 'NOT_FOUND');
  await assert.rejects(
    () => cashier.addEntry(ctx2, mine.id, { type: 'in', amount: 10, description: 'tentativa indevida' }),
    (e) => e.code === 'NOT_FOUND'
  );
});

test('lançamento soma corretamente no saldo do caixa', async () => {
  const mine = await cashier.currentSession(ctx1);
  const updated = await cashier.addEntry(ctx1, mine.id, { type: 'in', amount: 25, description: 'venda avulsa' });
  assert.strictEqual(updated.current_balance, 125); // 100 + 25
});

test('admin enxerga e fecha o caixa de qualquer operador', async () => {
  const mine = await cashier.currentSession(ctx1);
  const seen = await cashier.getSession(ctxAdmin, mine.id);
  assert.strictEqual(seen.id, mine.id);
  const closed = await cashier.closeSession(ctxAdmin, mine.id, {});
  assert.strictEqual(closed.status, 'closed');
});

test('depois de fechado, o operador pode abrir um novo caixa', async () => {
  const s = await cashier.openSession(ctx1, { openingBalance: 0 });
  assert.strictEqual(s.status, 'open');
});
