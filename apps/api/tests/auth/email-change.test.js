'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const VerificationCodes = require('../../src/core/VerificationCodes');
const password = require('../../src/utils/password');
const auth = require('../../src/modules/auth/auth.service');
const { ROLES } = require('@distok/shared');

let planId; let tenant; let userId; let ctx;
const uniq = uuid().slice(0, 8);
const originalEmail = `ec-${uniq}@teste.com`;
const newEmail = `ec-new-${uniq}@teste.com`;
const PLAIN_PASSWORD = 'senhaAtual123';

before(async () => {
  planId = uuid(); tenant = uuid(); userId = uuid();
  const hash = await password.hash(PLAIN_PASSWORD);
  await knex('plans').insert({ id: planId, code: 'ec-' + planId.slice(0, 5), name: 'P', price_cents: 0, max_users: null, max_products: null, features: JSON.stringify({}) });
  await knex('tenants').insert({ id: tenant, name: 'T-EmailChange', slug: 'ec-' + tenant.slice(0, 6), cnpj: 'C' + tenant.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: userId, tenant_id: tenant, name: 'Usuário Teste', email: originalEmail, password_hash: hash, role: ROLES.OPERATOR, status: 'active' });
  ctx = new TenantContext({ tenantId: tenant, userId, role: ROLES.OPERATOR });
  ctx.ip = '127.0.0.1';
});

after(async () => {
  await knex('account_verification_codes').where({ user_id: userId }).del();
  await knex('audit_log').where({ tenant_id: tenant }).del();
  await knex('users').where({ tenant_id: tenant }).del();
  await knex('tenants').where({ id: tenant }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('requestEmailChange exige a senha atual correta', async () => {
  await assert.rejects(
    () => auth.requestEmailChange({ ctx, newEmail, currentPassword: 'senha-errada', ip: '127.0.0.1' }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
});

test('requestEmailChange cria um código pendente pro e-mail novo', async () => {
  await auth.requestEmailChange({ ctx, newEmail, currentPassword: PLAIN_PASSWORD, ip: '127.0.0.1' });
  const row = await knex('account_verification_codes')
    .where({ user_id: userId, purpose: 'email_change' }).whereNull('used_at').first();
  assert.ok(row);
  assert.strictEqual(row.target_email, newEmail);
});

test('código errado não troca o e-mail', async () => {
  await assert.rejects(() => auth.confirmEmailChange({ ctx, code: '000000', ip: '127.0.0.1' }));
  const user = await knex('users').where({ id: userId }).first();
  assert.strictEqual(user.email, originalEmail);
});

test('código correto troca o e-mail e audita a ação', async () => {
  // gera um código novo e conhecido (invalida o da requisição anterior, já com tentativa errada)
  const code = await knex.transaction((trx) =>
    VerificationCodes.create(trx, { userId, purpose: 'email_change', targetEmail: newEmail })
  );
  const result = await auth.confirmEmailChange({ ctx, code, ip: '127.0.0.1' });
  assert.strictEqual(result.email, newEmail);

  const user = await knex('users').where({ id: userId }).first();
  assert.strictEqual(user.email, newEmail);

  const auditRow = await knex('audit_log').where({ tenant_id: tenant, action: 'auth.email_change' }).first();
  assert.ok(auditRow);
});

test('unicidade de e-mail por tenant é respeitada', async () => {
  const otherUserId = uuid();
  const otherEmail = `ec-other-${uniq}@teste.com`;
  await knex('users').insert({ id: otherUserId, tenant_id: tenant, name: 'Outro', email: otherEmail, password_hash: await password.hash('x'), role: ROLES.OPERATOR, status: 'active' });
  try {
    await assert.rejects(
      () => auth.requestEmailChange({ ctx, newEmail: otherEmail, currentPassword: PLAIN_PASSWORD, ip: '127.0.0.1' }),
      (e) => e.code === 'VALIDATION_ERROR'
    );
  } finally {
    await knex('users').where({ id: otherUserId }).del();
  }
});

test('código expirado é rejeitado', async () => {
  const expiredEmail = `ec-expired-${uniq}@teste.com`;
  await knex.transaction(async (trx) => {
    const code = await VerificationCodes.create(trx, { userId, purpose: 'email_change', targetEmail: expiredEmail }, -1);
    await assert.rejects(
      () => VerificationCodes.verify(trx, { userId, purpose: 'email_change', code }),
      (e) => /expirado/i.test(e.message)
    );
  });
});
