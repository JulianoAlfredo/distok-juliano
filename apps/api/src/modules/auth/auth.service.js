'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const { Errors, AppError } = require('../../core/errors');
const { sign } = require('../../utils/jwt');
const password = require('../../utils/password');
const { sendMail } = require('../../utils/mailer');
const emailTemplates = require('../../utils/email-templates');
const VerificationCodes = require('../../core/VerificationCodes');
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
      html: emailTemplates.passwordResetLinkEmail({ name: user.name, link }),
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
    throw new AppError(410, 'GONE', 'Token expirado');
  }
  const hash = await password.hash(newPassword);
  await knex.transaction(async (trx) => {
    await trx('users').where({ id: row.user_id }).update({ password_hash: hash, must_change_password: 0 });
    await trx('password_resets').where({ id: row.id }).update({ used_at: trx.fn.now() });
  });
  return { ok: true };
}

/** Checa unicidade de e-mail respeitando o mesmo escopo do `UNIQUE KEY uq_users_tenant_email`. */
async function emailTakenInScope(email, tenantId, trx) {
  const db = trx || knex;
  const q = db('users').where({ email });
  if (tenantId) q.where('tenant_id', tenantId);
  else q.whereNull('tenant_id');
  return !!(await q.first());
}

/**
 * Passo 1 da troca de e-mail self-service: exige a senha atual (evita que uma sessão
 * vazada troque o e-mail sem saber a senha) e manda o código pro e-mail NOVO — prova posse
 * da caixa de entrada antes de qualquer mudança.
 */
async function requestEmailChange({ ctx, newEmail, currentPassword, ip }) {
  const user = await knex('users').where({ id: ctx.userId }).first();
  if (!user) throw Errors.unauthorized();
  const ok = await password.compare(currentPassword, user.password_hash);
  if (!ok) throw Errors.validation('Senha atual incorreta');
  if (newEmail === user.email) throw Errors.validation('Esse já é o seu e-mail atual');
  if (await emailTakenInScope(newEmail, user.tenant_id)) {
    throw Errors.validation('Não foi possível concluir a solicitação. Verifique os dados e tente novamente.');
  }

  const code = await knex.transaction(async (trx) => {
    const c = await VerificationCodes.create(trx, { userId: user.id, purpose: 'email_change', targetEmail: newEmail });
    await audit.record({ ctx, action: 'auth.email_change_requested', entityType: 'user', entityId: user.id, after: { newEmail }, ip }, trx);
    return c;
  });
  await sendMail({
    to: newEmail,
    subject: 'Confirme seu novo e-mail — DISTOK',
    html: emailTemplates.verificationCodeEmail({
      name: user.name,
      code,
      context: 'Use o código abaixo para confirmar este e-mail como o novo login da sua conta DISTOK.',
    }),
  });
  return { ok: true };
}

/** Passo 2: confirma o código e efetiva a troca. */
async function confirmEmailChange({ ctx, code, ip }) {
  const user = await knex('users').where({ id: ctx.userId }).first();
  if (!user) throw Errors.unauthorized();

  let newEmail;
  await knex.transaction(async (trx) => {
    const row = await VerificationCodes.verify(trx, { userId: user.id, purpose: 'email_change', code });
    newEmail = row.target_email;
    if (await emailTakenInScope(newEmail, user.tenant_id, trx)) {
      throw Errors.validation('Esse e-mail passou a estar em uso — solicite a troca novamente.');
    }
    await trx('users').where({ id: user.id }).update({ email: newEmail });
    await audit.record(
      { ctx, action: 'auth.email_change', entityType: 'user', entityId: user.id, before: { email: user.email }, after: { email: newEmail }, ip },
      trx
    );
  });
  return { email: newEmail };
}

module.exports = { login, me, refresh, changePassword, forgot, reset, requestEmailChange, confirmEmailChange };
