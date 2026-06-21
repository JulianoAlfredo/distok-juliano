'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const { Errors } = require('../../core/errors');
const { sign } = require('../../utils/jwt');
const password = require('../../utils/password');
const { sendMail } = require('../../utils/mailer');
const audit = require('../../utils/audit');
const env = require('../../config/env');
const { ROLES, TENANT_STATUS, USER_STATUS } = require('@distok/shared');

/**
 * Busca usuário por e-mail para login.
 *  - Com tenantSlug (subdomínio/domínio próprio): restringe ao tenant.
 *  - Sem tenantSlug (domínio único, sem subdomínio): busca global por e-mail.
 *    Super admin tem precedência; se houver exatamente um usuário, usa-o.
 *    E-mail repetido em múltiplos tenants => ambíguo (exige slug).
 */
async function findUserForLogin(email, tenantSlug) {
  if (tenantSlug) {
    const tenant = await knex('tenants').where({ slug: tenantSlug }).first();
    if (!tenant) return { user: null, tenant: null };
    const user = await knex('users').where({ email, tenant_id: tenant.id }).first();
    return { user, tenant };
  }
  // sem slug: login global por e-mail
  const matches = await knex('users').where({ email });
  if (matches.length === 0) return { user: null, tenant: null };
  const superAdmin = matches.find((u) => u.tenant_id === null);
  if (superAdmin) return { user: superAdmin, tenant: null };
  if (matches.length === 1) {
    const user = matches[0];
    const tenant = await knex('tenants').where({ id: user.tenant_id }).first();
    return { user, tenant };
  }
  // e-mail presente em mais de um tenant: não dá para decidir sem o slug
  return { user: null, tenant: null, ambiguous: true };
}

async function login({ email, password: plain, tenantSlug }) {
  const { user, tenant } = await findUserForLogin(email, tenantSlug);

  // resposta genérica (não revela existência) — AC3
  const invalid = () => Errors.unauthorized('E-mail ou senha inválidos');

  if (!user) {
    // custo de tempo simétrico para não vazar timing
    await password.compare(plain, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinv');
    throw invalid();
  }

  const ok = await password.compare(plain, user.password_hash);
  if (!ok) throw invalid();

  if (user.status !== USER_STATUS.ACTIVE) throw invalid();

  // tenant inativo => bloqueio (AC2, NFR4)
  if (user.role !== ROLES.SUPER_ADMIN) {
    const t = tenant || (await knex('tenants').where({ id: user.tenant_id }).first());
    if (!t || t.status !== TENANT_STATUS.ACTIVE) {
      throw Errors.tenantInactive();
    }
  }

  await knex('users').where({ id: user.id }).update({ last_login_at: knex.fn.now() });

  const token = sign(user);
  return {
    token,
    mustChangePassword: !!user.must_change_password,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id || null,
    },
  };
}

/** Dados do usuário logado (GET /auth/me). */
async function me(ctx) {
  const user = await knex('users').where({ id: ctx.userId }).first();
  if (!user) throw Errors.unauthorized();
  let tenant = null;
  if (user.tenant_id) {
    const t = await knex('tenants').where({ id: user.tenant_id }).first();
    if (t) tenant = { id: t.id, name: t.name, slug: t.slug, status: t.status };
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: !!user.must_change_password,
    tenant,
  };
}

/** Reemite token se o atual ainda é válido (ctx vem do middleware auth). */
async function refresh(ctx) {
  const user = await knex('users').where({ id: ctx.userId }).first();
  if (!user || user.status !== USER_STATUS.ACTIVE) throw Errors.unauthorized();
  return { token: sign(user) };
}

async function changePassword({ ctx, currentPassword, newPassword, ip }) {
  const user = await knex('users').where({ id: ctx.userId }).first();
  if (!user) throw Errors.unauthorized();
  const ok = await password.compare(currentPassword, user.password_hash);
  if (!ok) throw Errors.validation('Senha atual incorreta');
  if (!newPassword || newPassword.length < 8) {
    throw Errors.validation('A nova senha deve ter ao menos 8 caracteres');
  }
  const hash = await password.hash(newPassword);
  await knex('users').where({ id: user.id }).update({
    password_hash: hash,
    must_change_password: 0,
  });
  await audit.record({ ctx, action: 'auth.change_password', entityType: 'user', entityId: user.id, ip });
  return { ok: true };
}

/** Dispara e-mail de reset (resposta sempre neutra — AC9). */
async function forgot({ email, tenantSlug }) {
  const { user } = await findUserForLogin(email, tenantSlug);
  if (user) {
    const { token, tokenHash } = password.generateResetToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await knex('password_resets').insert({
      id: uuid(),
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expires,
    });
    const link = `${env.APP_BASE_URL}/redefinir-senha?token=${token}`;
    await sendMail({
      to: email,
      subject: 'Redefinição de senha — DISTOK',
      html: `<p>Recebemos um pedido para redefinir sua senha.</p>
             <p><a href="${link}">Clique aqui para criar uma nova senha</a> (válido por 1 hora).</p>
             <p>Se não foi você, ignore este e-mail.</p>`,
    });
  }
  return { ok: true };
}

async function reset({ token, newPassword }) {
  if (!newPassword || newPassword.length < 8) {
    throw Errors.validation('A nova senha deve ter ao menos 8 caracteres');
  }
  const tokenHash = password.hashResetToken(token);
  const row = await knex('password_resets')
    .where({ token_hash: tokenHash })
    .whereNull('used_at')
    .first();
  if (!row) throw Errors.validation('Token inválido');
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new (require('../../core/errors').AppError)(410, 'GONE', 'Token expirado');
  }
  const hash = await password.hash(newPassword);
  await knex.transaction(async (trx) => {
    await trx('users').where({ id: row.user_id }).update({ password_hash: hash, must_change_password: 0 });
    await trx('password_resets').where({ id: row.id }).update({ used_at: trx.fn.now() });
  });
  return { ok: true };
}

module.exports = { login, me, refresh, changePassword, forgot, reset };
