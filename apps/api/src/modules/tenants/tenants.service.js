'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const { Errors } = require('../../core/errors');
const password = require('../../utils/password');
const audit = require('../../utils/audit');
const { sendMail } = require('../../utils/mailer');
const emailTemplates = require('../../utils/email-templates');
const env = require('../../config/env');
const {
  ROLES, TENANT_STATUS, USER_STATUS, PLAN_CODES, DEFAULT_TERMINOLOGY,
} = require('@distok/shared');

/** Normaliza um texto em slug seguro para subdomínio. */
const slugify = (v) =>
  (v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);

/**
 * Provisiona o "esqueleto" de um tenant (tenant + branding padrão + terminologia padrão)
 * dentro de uma transação já aberta — reaproveitado tanto pelo cadastro admin-driven
 * (`createTenant`, super_admin) quanto pelo signup público self-service
 * (`modules/signup/signup.service.js`). Não cria usuário — cada chamador decide como (senha
 * temporária vs senha própria, status active vs inactive-até-verificar).
 */
async function provisionTenant(trx, { name, cnpj, slug, address, planCode = PLAN_CODES.STANDARD, trialEndsAt = null }) {
  const plan = await trx('plans').where({ code: planCode }).first();
  if (!plan) throw Errors.validation('Plano inexistente');

  const finalSlug = slugify(slug || name);
  if (!finalSlug) throw Errors.validation('Informe um nome válido para a empresa.');

  const dup =
    (await trx('tenants').where({ slug: finalSlug }).first()) ||
    (cnpj && (await trx('tenants').where({ cnpj }).first()));
  if (dup) {
    console.warn('[tenants.provision] cadastro duplicado (slug/cnpj)');
    throw Errors.validation('Não foi possível concluir o cadastro. Verifique os dados e tente novamente.');
  }

  const tenantId = uuid();
  await trx('tenants').insert({
    id: tenantId, name, slug: finalSlug, cnpj, address: address || null,
    plan_id: plan.id, status: TENANT_STATUS.ACTIVE, trial_ends_at: trialEndsAt,
  });
  await trx('tenant_branding').insert({ tenant_id: tenantId, display_name: name });
  for (const [term_key, term_value] of Object.entries(DEFAULT_TERMINOLOGY)) {
    await trx('tenant_terminology').insert({ tenant_id: tenantId, term_key, term_value });
  }
  return { tenantId, slug: finalSlug, plan };
}

async function listTenants({ status, plan, page = 1, limit = 25 }) {
  const q = knex('tenants')
    .join('plans', 'plans.id', 'tenants.plan_id')
    .select(
      'tenants.id', 'tenants.name', 'tenants.slug', 'tenants.cnpj',
      'tenants.status', 'tenants.created_at', 'plans.code as plan_code', 'plans.name as plan_name'
    )
    .orderBy('tenants.created_at', 'desc');
  if (status) q.where('tenants.status', status);
  if (plan) q.where('plans.code', plan);
  const offset = (page - 1) * limit;
  return q.limit(limit).offset(offset);
}

async function createTenant({ ctx, name, cnpj, slug, address, planCode, adminName, adminEmail, ip }) {
  // e-mail do admin é checado aqui (fora de provisionTenant, que só sabe de slug/cnpj) —
  // mesma mensagem genérica pra não revelar o que já existe.
  if (await knex('users').where({ email: adminEmail }).first()) {
    console.warn('[tenants.create] e-mail de admin já cadastrado');
    throw Errors.validation('Não foi possível concluir o cadastro. Verifique os dados e tente novamente.');
  }

  const tempPass = password.generateTempPassword();
  const hash = await password.hash(tempPass);
  let tenantId; let finalSlug;

  await knex.transaction(async (trx) => {
    const provisioned = await provisionTenant(trx, { name, cnpj, slug, address, planCode });
    tenantId = provisioned.tenantId;
    finalSlug = provisioned.slug;
    await trx('users').insert({
      id: uuid(), tenant_id: tenantId, name: adminName, email: adminEmail,
      password_hash: hash, role: ROLES.ADMIN, must_change_password: 1, status: USER_STATUS.ACTIVE,
    });
    await audit.record(
      { ctx, action: 'tenant.create', entityType: 'tenant', entityId: tenantId, after: { name, slug: finalSlug, plan: planCode }, ip },
      trx
    );
  });

  // e-mail de credenciais (FR7)
  await sendMail({
    to: adminEmail,
    subject: 'Bem-vindo ao DISTOK — suas credenciais de acesso',
    html: emailTemplates.tempPasswordEmail({
      name: adminName, email: adminEmail, tempPassword: tempPass,
      loginUrl: `https://${finalSlug}.${env.ROOT_DOMAIN}`,
    }),
  });

  return { id: tenantId, name, slug: finalSlug, status: TENANT_STATUS.ACTIVE, planCode };
}

async function updateStatus({ ctx, tenantId, status, ip }) {
  if (!Object.values(TENANT_STATUS).includes(status)) throw Errors.validation('Status inválido');
  const tenant = await knex('tenants').where({ id: tenantId }).first();
  if (!tenant) throw Errors.notFound('Tenant não encontrado');
  await knex('tenants').where({ id: tenantId }).update({ status });
  await audit.record({
    ctx, action: 'tenant.update_status', entityType: 'tenant', entityId: tenantId,
    before: { status: tenant.status }, after: { status }, ip,
  });
  return { id: tenantId, status };
}

async function resetAdminPassword({ ctx, tenantId, ip }) {
  const admin = await knex('users')
    .where({ tenant_id: tenantId, role: ROLES.ADMIN })
    .orderBy('created_at', 'asc')
    .first();
  if (!admin) throw Errors.notFound('Admin do tenant não encontrado');
  const tempPass = password.generateTempPassword();
  const hash = await password.hash(tempPass);
  await knex('users').where({ id: admin.id }).update({ password_hash: hash, must_change_password: 1 });
  await audit.record({ ctx, action: 'tenant.reset_admin_password', entityType: 'user', entityId: admin.id, ip });
  await sendMail({
    to: admin.email,
    subject: 'DISTOK — sua senha foi redefinida',
    html: emailTemplates.tempPasswordEmail({ name: admin.name, email: admin.email, tempPassword: tempPass }),
  });
  return { ok: true };
}

async function metrics() {
  const [{ total }] = await knex('tenants').count({ total: '*' });
  const [{ active }] = await knex('tenants').where({ status: TENANT_STATUS.ACTIVE }).count({ active: '*' });
  const byPlan = await knex('tenants')
    .join('plans', 'plans.id', 'tenants.plan_id')
    .where('tenants.status', TENANT_STATUS.ACTIVE)
    .groupBy('plans.code', 'plans.price_cents')
    .select('plans.code', 'plans.price_cents')
    .count({ count: '*' });
  const mrrCents = byPlan.reduce((sum, r) => sum + Number(r.count) * Number(r.price_cents), 0);
  return {
    tenants: Number(total),
    active: Number(active),
    mrr: mrrCents / 100,
    byPlan: byPlan.map((r) => ({ plan: r.code, count: Number(r.count) })),
  };
}

module.exports = { listTenants, createTenant, updateStatus, resetAdminPassword, metrics, provisionTenant, slugify };
