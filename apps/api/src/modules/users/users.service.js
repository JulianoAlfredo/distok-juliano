'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');
const password = require('../../utils/password');
const { sendMail } = require('../../utils/mailer');
const emailTemplates = require('../../utils/email-templates');
const env = require('../../config/env');
const { assertCanAddUser } = require('../../middlewares/plan-guard');
const { ROLES, USER_STATUS } = require('@distok/shared');

function repo(ctx) {
  return new TenantScopedRepository(knex, 'users', ctx);
}

const PUBLIC_COLS = ['id', 'name', 'email', 'cpf', 'role_title', 'role', 'status', 'last_login_at', 'created_at'];

async function list(ctx, { status, page = 1, limit = 25 }) {
  // Ator de sistema de integrações (ex.: Zé Delivery) nunca aparece na tela de Funcionários.
  const q = repo(ctx).query().select(PUBLIC_COLS).where('users.is_system', false);
  if (status) q.where('users.status', status);
  return q.orderBy('users.name', 'asc').limit(limit).offset((page - 1) * limit);
}

async function create(ctx, data) {
  if (![ROLES.ADMIN, ROLES.OPERATOR].includes(data.role)) {
    throw Errors.validation('Nível de acesso inválido');
  }

  // e-mail único — mensagem genérica (não revela existência da conta) + log interno
  if (await knex('users').where({ email: data.email }).first()) {
    console.warn(`[users.create] e-mail já cadastrado (tenant ${ctx.tenantId})`);
    throw Errors.validation('Não foi possível concluir o cadastro. Verifique os dados e tente novamente.');
  }

  const id = uuid();
  const tempPass = password.generateTempPassword();
  const hash = await password.hash(tempPass);
  const row = {
    id,
    name: data.name,
    email: data.email,
    cpf: data.cpf || null,
    role_title: data.role_title || null,
    role: data.role,
    password_hash: hash,
    must_change_password: 1,
    status: USER_STATUS.ACTIVE,
  };
  await knex.transaction(async (trx) => {
    await assertCanAddUser(ctx.tenantId, trx); // FR25, com lock contra corrida
    await repo(ctx).insert(row, trx);
  });
  await audit.record({ ctx, action: 'user.create', entityType: 'user', entityId: id, after: { email: data.email, role: data.role }, ip: ctx.ip });

  await sendMail({
    to: data.email,
    subject: 'Seu acesso ao DISTOK',
    html: emailTemplates.tempPasswordEmail({ name: data.name, email: data.email, tempPassword: tempPass, loginUrl: env.APP_BASE_URL }),
  });

  const created = await repo(ctx).query().select(PUBLIC_COLS).where('users.id', id).first();
  return created;
}

async function update(ctx, id, data) {
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Funcionário não encontrado');
  const patch = {};
  for (const k of ['name', 'cpf', 'role_title']) if (data[k] !== undefined) patch[k] = data[k];
  if (data.role !== undefined) {
    if (![ROLES.ADMIN, ROLES.OPERATOR].includes(data.role)) throw Errors.validation('Nível de acesso inválido');
    patch.role = data.role;
  }
  await repo(ctx).updateById(id, patch);
  await audit.record({ ctx, action: 'user.update', entityType: 'user', entityId: id, before, after: patch, ip: ctx.ip });
  return repo(ctx).query().select(PUBLIC_COLS).where('users.id', id).first();
}

async function setStatus(ctx, id, status) {
  if (!Object.values(USER_STATUS).includes(status)) throw Errors.validation('Status inválido');
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Funcionário não encontrado');
  if (before.id === ctx.userId && status === USER_STATUS.INACTIVE) {
    throw Errors.validation('Você não pode inativar a si mesmo');
  }
  await repo(ctx).updateById(id, { status });
  await audit.record({ ctx, action: 'user.set_status', entityType: 'user', entityId: id, before: { status: before.status }, after: { status }, ip: ctx.ip });
  return repo(ctx).query().select(PUBLIC_COLS).where('users.id', id).first();
}

module.exports = { list, create, update, setStatus };
