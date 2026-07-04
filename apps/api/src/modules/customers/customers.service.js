'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');
const { applySearch } = require('../../utils/search');

function repo(ctx) {
  return new TenantScopedRepository(knex, 'customers', ctx);
}

async function list(ctx, { search, status, page = 1, limit = 25 }) {
  const q = repo(ctx).query();
  if (status) q.where('customers.status', status);
  const CUSTOMER_COLS = ['customers.name', 'customers.email', 'customers.phone', 'customers.cpf', 'customers.cnpj'];
  if (search) applySearch(q, search, CUSTOMER_COLS);

  const countQ = repo(ctx).query();
  if (status) countQ.where('customers.status', status);
  if (search) applySearch(countQ, search, CUSTOMER_COLS);
  const countRow = await countQ.count({ c: '*' }).first();
  const total = Number(countRow ? countRow.c : 0);

  const offset = (page - 1) * limit;
  const items = await q.orderBy('customers.name', 'asc').limit(limit).offset(offset);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function get(ctx, id) {
  const c = await repo(ctx).findById(id);
  if (!c) throw Errors.notFound('Cliente não encontrado');
  return c;
}

async function create(ctx, data) {
  const id = uuid();
  const row = {
    id,
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    cpf: data.cpf || null,
    cnpj: data.cnpj || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    notes: data.notes || null,
    status: 'active',
  };
  await repo(ctx).insert(row);
  await audit.record({ ctx, action: 'customer.create', entityType: 'customer', entityId: id, after: row, ip: ctx.ip });
  return get(ctx, id);
}

async function update(ctx, id, data) {
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Cliente não encontrado');
  const patch = {};
  for (const k of ['name', 'email', 'phone', 'cpf', 'cnpj', 'address', 'city', 'state', 'notes']) {
    if (data[k] !== undefined) patch[k] = data[k] || null;
  }
  if (data.name !== undefined) patch.name = data.name; // name must not be null
  await repo(ctx).updateById(id, patch);
  await audit.record({ ctx, action: 'customer.update', entityType: 'customer', entityId: id, before, after: patch, ip: ctx.ip });
  return get(ctx, id);
}

async function inactivate(ctx, id) {
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Cliente não encontrado');
  await repo(ctx).updateById(id, { status: 'inactive' });
  await audit.record({ ctx, action: 'customer.inactivate', entityType: 'customer', entityId: id, before, ip: ctx.ip });
  return get(ctx, id);
}

async function activate(ctx, id) {
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Cliente não encontrado');
  await repo(ctx).updateById(id, { status: 'active' });
  await audit.record({ ctx, action: 'customer.activate', entityType: 'customer', entityId: id, before, ip: ctx.ip });
  return get(ctx, id);
}

async function history(ctx, id) {
  const customer = await repo(ctx).findById(id);
  if (!customer) throw Errors.notFound('Cliente não encontrado');
  const rows = await knex('audit_log')
    .where({ entity_type: 'customer', entity_id: id, tenant_id: ctx.tenantId })
    .orderBy('created_at', 'desc')
    .limit(50)
    .leftJoin('users', 'users.id', 'audit_log.user_id')
    .select(
      'audit_log.id',
      'audit_log.action',
      'audit_log.before_json',
      'audit_log.after_json',
      'audit_log.created_at',
      'users.name as user_name'
    );
  return { customer: { id: customer.id, name: customer.name }, entries: rows };
}

module.exports = { list, get, create, update, inactivate, activate, history };
