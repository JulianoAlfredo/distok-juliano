'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const { Errors } = require('../../core/errors');
const password = require('../../utils/password');
const audit = require('../../utils/audit');
const { sendMail } = require('../../utils/mailer');
const { htmlEscape } = require('../../utils/sanitize');
const env = require('../../config/env');
const {
  ROLES, TENANT_STATUS, USER_STATUS, DEFAULT_TERMINOLOGY,
} = require('@distok/shared');

/** Normaliza um texto em slug seguro para subdomínio. */
const slugify = (v) =>
  (v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);

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
  const plan = await knex('plans').where({ code: planCode }).first();
  if (!plan) throw Errors.validation('Plano inexistente');

  // normaliza o slug (gera a partir do nome se vier vazio)
  slug = slugify(slug || name);
  if (!slug) throw Errors.validation('Informe um nome válido para a empresa.');

  // validações de duplicidade — mensagem genérica (não revela o que existe) + log interno
  const dup =
    (await knex('tenants').where({ slug }).first()) ||
    (cnpj && (await knex('tenants').where({ cnpj }).first())) ||
    (await knex('users').where({ email: adminEmail }).first());
  if (dup) {
    console.warn('[tenants.create] cadastro duplicado (slug/cnpj/e-mail)');
    throw Errors.validation('Não foi possível concluir o cadastro. Verifique os dados e tente novamente.');
  }

  const tenantId = uuid();
  const tempPass = password.generateTempPassword();
  const hash = await password.hash(tempPass);

  await knex.transaction(async (trx) => {
    await trx('tenants').insert({
      id: tenantId, name, slug, cnpj, address: address || null,
      plan_id: plan.id, status: TENANT_STATUS.ACTIVE,
    });
    await trx('tenant_branding').insert({ tenant_id: tenantId, display_name: name });
    for (const [term_key, term_value] of Object.entries(DEFAULT_TERMINOLOGY)) {
      await trx('tenant_terminology').insert({ tenant_id: tenantId, term_key, term_value });
    }
    await trx('users').insert({
      id: uuid(), tenant_id: tenantId, name: adminName, email: adminEmail,
      password_hash: hash, role: ROLES.ADMIN, must_change_password: 1, status: USER_STATUS.ACTIVE,
    });
    await audit.record(
      { ctx, action: 'tenant.create', entityType: 'tenant', entityId: tenantId, after: { name, slug, plan: planCode }, ip },
      trx
    );
  });

  // e-mail de credenciais (FR7)
  await sendMail({
    to: adminEmail,
    subject: 'Bem-vindo ao DISTOK — suas credenciais de acesso',
    html: `<p>Olá, ${htmlEscape(adminName)}!</p>
           <p>Sua distribuidora <b>${htmlEscape(name)}</b> foi cadastrada no DISTOK.</p>
           <p>Acesse: <a href="https://${htmlEscape(slug)}.${env.ROOT_DOMAIN}">${htmlEscape(slug)}.${env.ROOT_DOMAIN}</a></p>
           <p>Login: <b>${htmlEscape(adminEmail)}</b><br/>Senha temporária: <b>${htmlEscape(tempPass)}</b></p>
           <p>No primeiro acesso você deverá criar uma nova senha.</p>`,
  });

  return { id: tenantId, name, slug, status: TENANT_STATUS.ACTIVE, planCode };
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
    html: `<p>Sua senha temporária: <b>${tempPass}</b>. Troque no próximo acesso.</p>`,
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

module.exports = { listTenants, createTenant, updateStatus, resetAdminPassword, metrics };
