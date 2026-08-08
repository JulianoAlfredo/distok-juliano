'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const VerificationCodes = require('../../src/core/VerificationCodes');
const signup = require('../../src/modules/signup/signup.service');
const auth = require('../../src/modules/auth/auth.service');
const { DEFAULT_PLANS } = require('@distok/shared');

let insertedPlanId = null;
let createdTenantId;
let createdUserId;
const uniq = uuid().slice(0, 8);
const adminEmail = `signup-${uniq}@teste.com`;
const cnpj = `10.000.${uniq.slice(0, 3)}/0001-00`;
const slug = `signup-${uniq}`;

before(async () => {
  const existing = await knex('plans').where({ code: 'standard' }).first();
  if (!existing) {
    const standard = DEFAULT_PLANS.find((p) => p.code === 'standard');
    insertedPlanId = uuid();
    await knex('plans').insert({
      id: insertedPlanId, code: 'standard', name: standard.name, price_cents: standard.price_cents,
      max_users: standard.max_users, max_products: standard.max_products, features: JSON.stringify(standard.features),
    });
  }
});

after(async () => {
  if (createdTenantId) {
    await knex('account_verification_codes').where({ user_id: createdUserId }).del();
    await knex('audit_log').where({ tenant_id: createdTenantId }).del();
    await knex('tenant_terminology').where({ tenant_id: createdTenantId }).del();
    await knex('tenant_branding').where({ tenant_id: createdTenantId }).del();
    await knex('users').where({ tenant_id: createdTenantId }).del();
    await knex('tenants').where({ id: createdTenantId }).del();
  }
  if (insertedPlanId) await knex('plans').where({ id: insertedPlanId }).del();
  await knex.destroy();
});

test('signup: cria tenant + admin inactive, com trial de 7 dias', async () => {
  const res = await signup.signup({
    companyName: 'Distribuidora Signup Teste', cnpj, slug,
    adminName: 'Fulano', adminEmail, adminPassword: 'senha1234',
  });
  createdTenantId = res.tenantId;
  assert.ok(res.tenantId);
  assert.strictEqual(res.slug, slug);

  const tenant = await knex('tenants').where({ id: res.tenantId }).first();
  assert.ok(tenant.trial_ends_at, 'trial_ends_at deve estar setado');
  const daysAhead = (new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000;
  assert.ok(daysAhead > 6.9 && daysAhead < 7.1, 'trial deve ser de ~7 dias');

  const user = await knex('users').where({ tenant_id: res.tenantId }).first();
  createdUserId = user.id;
  assert.strictEqual(user.status, 'inactive');
});

test('login é bloqueado antes de confirmar o código', async () => {
  await assert.rejects(
    () => auth.login({ email: adminEmail, password: 'senha1234' }),
    (e) => e.code === 'UNAUTHORIZED'
  );
});

test('código errado não ativa e respeita limite de tentativas', async () => {
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => signup.verify({ email: adminEmail, code: '000000' }));
  }
  await assert.rejects(
    () => signup.verify({ email: adminEmail, code: '111111' }),
    (e) => /tentativas/i.test(e.message)
  );
  const user = await knex('users').where({ id: createdUserId }).first();
  assert.strictEqual(user.status, 'inactive', 'usuário continua inativo após tentativas erradas');
});

test('código correto ativa a conta e devolve token logado', async () => {
  // gera um código novo (invalida o anterior, que já bateu o limite de tentativas)
  const code = await knex.transaction((trx) =>
    VerificationCodes.create(trx, { userId: createdUserId, purpose: 'signup_verify', targetEmail: adminEmail })
  );
  const result = await signup.verify({ email: adminEmail, code });
  assert.ok(result.token);
  assert.strictEqual(result.user.email, adminEmail);

  const user = await knex('users').where({ id: createdUserId }).first();
  assert.strictEqual(user.status, 'active');
});

test('login funciona normalmente depois de confirmado', async () => {
  const res = await auth.login({ email: adminEmail, password: 'senha1234' });
  assert.ok(res.token);
});

test('duplicidade de e-mail/slug/cnpj continua rejeitada', async () => {
  await assert.rejects(() => signup.signup({
    companyName: 'Outra Empresa', cnpj: `99.999.${uniq.slice(0, 3)}/0001-99`, slug: `outro-${uniq}`,
    adminName: 'Ciclano', adminEmail, adminPassword: 'senha1234', // e-mail repetido
  }));
  await assert.rejects(() => signup.signup({
    companyName: 'Distribuidora Signup Teste', cnpj: `88.888.${uniq.slice(0, 3)}/0001-88`, slug, // slug repetido
    adminName: 'Ciclano', adminEmail: `outro-${uniq}@teste.com`, adminPassword: 'senha1234',
  }));
  await assert.rejects(() => signup.signup({
    companyName: 'Distribuidora Signup Teste 2', cnpj, slug: `outroslug-${uniq}`, // cnpj repetido
    adminName: 'Ciclano', adminEmail: `outro2-${uniq}@teste.com`, adminPassword: 'senha1234',
  }));
});

test('senha curta é rejeitada', async () => {
  await assert.rejects(
    () => signup.signup({
      companyName: 'Empresa Senha Curta', cnpj: `77.777.${uniq.slice(0, 3)}/0001-77`, slug: `curta-${uniq}`,
      adminName: 'Fulano', adminEmail: `curta-${uniq}@teste.com`, adminPassword: '123',
    }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
});
