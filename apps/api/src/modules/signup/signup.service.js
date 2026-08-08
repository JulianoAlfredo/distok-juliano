'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const { Errors } = require('../../core/errors');
const password = require('../../utils/password');
const { sendMail } = require('../../utils/mailer');
const emailTemplates = require('../../utils/email-templates');
const VerificationCodes = require('../../core/VerificationCodes');
const audit = require('../../utils/audit');
const { sign } = require('../../utils/jwt');
const tenants = require('../tenants/tenants.service');
const { ROLES, USER_STATUS, PLAN_CODES } = require('@distok/shared');

const TRIAL_DAYS = 7;

/**
 * Signup público self-service ("criar conta" sem admin nenhum envolvido). Cria tenant +
 * admin imediatamente, mas o admin começa `status='inactive'` até confirmar o código — o
 * login (`auth.service.login`) já bloqueia `status != active`, reaproveitado aqui em vez de
 * inventar um estado "pendente" separado. Diferente do convite de funcionário: quem se
 * cadastra define a própria senha (não é senha temporária).
 */
async function signup({ companyName, cnpj, slug, adminName, adminEmail, adminPassword }) {
  if (!adminPassword || adminPassword.length < 8) {
    throw Errors.validation('A senha deve ter ao menos 8 caracteres');
  }
  if (await knex('users').where({ email: adminEmail }).first()) {
    throw Errors.validation('Este e-mail já possui uma conta. Faça login ou recupere sua senha.');
  }

  const hash = await password.hash(adminPassword);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  let userId; let tenantId; let finalSlug; let code;

  await knex.transaction(async (trx) => {
    const provisioned = await tenants.provisionTenant(trx, {
      name: companyName, cnpj, slug, planCode: PLAN_CODES.STANDARD, trialEndsAt,
    });
    tenantId = provisioned.tenantId;
    finalSlug = provisioned.slug;

    userId = uuid();
    await trx('users').insert({
      id: userId, tenant_id: tenantId, name: adminName, email: adminEmail,
      password_hash: hash, role: ROLES.ADMIN, must_change_password: 0, status: USER_STATUS.INACTIVE,
    });
    await audit.record(
      { ctx: { tenantId, userId }, action: 'tenant.signup', entityType: 'tenant', entityId: tenantId, after: { name: companyName, slug: finalSlug } },
      trx
    );
    code = await VerificationCodes.create(trx, { userId, purpose: 'signup_verify', targetEmail: adminEmail });
  });

  await sendMail({
    to: adminEmail,
    subject: 'Confirme seu cadastro — DISTOK',
    html: emailTemplates.verificationCodeEmail({
      name: adminName,
      code,
      context: `Falta pouco! Use o código abaixo pra confirmar o cadastro da ${companyName} no DISTOK.`,
    }),
  });

  return { tenantId, slug: finalSlug };
}

/** Confirma o código e já devolve um token logado (evita mais uma volta pelo login). */
async function verify({ email, code }) {
  const user = await knex('users').where({ email }).first();
  if (!user) throw Errors.validation('Código inválido ou expirado');

  await knex.transaction(async (trx) => {
    await VerificationCodes.verify(trx, { userId: user.id, purpose: 'signup_verify', code });
    await trx('users').where({ id: user.id }).update({ status: USER_STATUS.ACTIVE });
  });

  const fresh = await knex('users').where({ id: user.id }).first();
  const token = sign(fresh);
  return {
    token,
    user: { id: fresh.id, name: fresh.name, email: fresh.email, role: fresh.role, tenantId: fresh.tenant_id || null },
  };
}

/** Resposta sempre neutra — não revela se o e-mail existe (mesmo padrão de auth.forgot). */
async function resendCode({ email }) {
  const user = await knex('users').where({ email, status: USER_STATUS.INACTIVE }).first();
  if (user) {
    const code = await knex.transaction((trx) =>
      VerificationCodes.create(trx, { userId: user.id, purpose: 'signup_verify', targetEmail: email })
    );
    await sendMail({
      to: email,
      subject: 'Seu novo código — DISTOK',
      html: emailTemplates.verificationCodeEmail({ name: user.name, code, context: 'Aqui está seu novo código de confirmação de cadastro.' }),
    });
  }
  return { ok: true };
}

module.exports = { signup, verify, resendCode };
