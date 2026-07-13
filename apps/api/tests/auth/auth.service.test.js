'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const auth = require('../../src/modules/auth/auth.service');
const passwordUtil = require('../../src/utils/password');
const { ROLES, TENANT_STATUS, USER_STATUS } = require('@distok/shared');

let planId; let tenant; let userId; let ctx;
const EMAIL = () => `login-${tenant.slice(0, 5)}@ta.com`;
const PLAIN_PASSWORD = 'SenhaForte123';

before(async () => {
  planId = uuid(); tenant = uuid(); userId = uuid();
  await knex('plans').insert({
    id: planId, code: 'au-' + planId.slice(0, 5), name: 'P', price_cents: 0,
    max_users: null, max_products: null, features: JSON.stringify({}),
  });
  await knex('tenants').insert({ id: tenant, name: 'TA', slug: 'ta-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId, status: TENANT_STATUS.ACTIVE });
  const hash = await passwordUtil.hash(PLAIN_PASSWORD);
  await knex('users').insert({
    id: userId, tenant_id: tenant, name: 'Fulano', email: EMAIL(),
    password_hash: hash, role: ROLES.ADMIN, status: USER_STATUS.ACTIVE, must_change_password: 0,
  });
  ctx = new TenantContext({ tenantId: tenant, userId, role: ROLES.ADMIN });
});

after(async () => {
  await knex('audit_log').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('login com credenciais corretas retorna token e não expõe a senha', async () => {
  const res = await auth.login({ email: EMAIL(), password: PLAIN_PASSWORD });
  assert.ok(res.token);
  assert.strictEqual(res.user.email, EMAIL());
  assert.strictEqual(res.mustChangePassword, false);
  assert.strictEqual(res.user.password_hash, undefined);
});

test('senha errada é rejeitada com mensagem genérica (não revela qual campo está errado)', async () => {
  await assert.rejects(
    () => auth.login({ email: EMAIL(), password: 'errada' }),
    (e) => e.code === 'UNAUTHORIZED' && e.message === 'E-mail ou senha inválidos'
  );
});

test('e-mail inexistente é rejeitado com a MESMA mensagem (não revela se a conta existe)', async () => {
  await assert.rejects(
    () => auth.login({ email: 'ninguem@nada.com', password: 'qualquer' }),
    (e) => e.code === 'UNAUTHORIZED' && e.message === 'E-mail ou senha inválidos'
  );
});

test('tenant inativo bloqueia login mesmo com senha correta (NFR4)', async () => {
  await knex('tenants').where({ id: tenant }).update({ status: TENANT_STATUS.SUSPENDED });
  await assert.rejects(
    () => auth.login({ email: EMAIL(), password: PLAIN_PASSWORD }),
    (e) => e.code === 'TENANT_INACTIVE'
  );
  await knex('tenants').where({ id: tenant }).update({ status: TENANT_STATUS.ACTIVE });
});

test('troca de senha exige a senha atual correta', async () => {
  await assert.rejects(
    () => auth.changePassword({ ctx, currentPassword: 'errada', newPassword: 'NovaSenha123', ip: '127.0.0.1' }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
});

test('nova senha precisa ter ao menos 8 caracteres', async () => {
  await assert.rejects(
    () => auth.changePassword({ ctx, currentPassword: PLAIN_PASSWORD, newPassword: 'curta', ip: '127.0.0.1' }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
});

test('troca de senha funciona e permite login com a nova senha', async () => {
  await auth.changePassword({ ctx, currentPassword: PLAIN_PASSWORD, newPassword: 'NovaSenha123', ip: '127.0.0.1' });
  const res = await auth.login({ email: EMAIL(), password: 'NovaSenha123' });
  assert.ok(res.token);
  await assert.rejects(() => auth.login({ email: EMAIL(), password: PLAIN_PASSWORD }), (e) => e.code === 'UNAUTHORIZED');
});
