'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');
const { applySearch } = require('../../utils/search');

function repo(ctx) {
  return new TenantScopedRepository(knex, 'suppliers', ctx);
}

async function list(ctx, { search, status, page = 1, limit = 25 }) {
  const base = () => {
    const q = repo(ctx).query();
    if (status) q.where('suppliers.status', status);
    if (search) applySearch(q, search, ['suppliers.name', 'suppliers.trade_name', 'suppliers.cnpj', 'suppliers.email']);
    return q;
  };

  const countRow = await base().count({ c: '*' }).first();
  const total = Number(countRow ? countRow.c : 0);
  const items = await base().orderBy('suppliers.name', 'asc').limit(limit).offset((page - 1) * limit);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function get(ctx, id) {
  const s = await repo(ctx).findById(id);
  if (!s) throw Errors.notFound('Fornecedor não encontrado');
  return s;
}

async function create(ctx, data) {
  const id = uuid();
  const row = {
    id,
    name:       data.name,
    trade_name: data.trade_name || null,
    cnpj:       data.cnpj || null,
    cpf:        data.cpf || null,
    email:      data.email || null,
    phone:      data.phone || null,
    address:    data.address || null,
    city:       data.city || null,
    state:      data.state || null,
    contact:    data.contact || null,
    notes:      data.notes || null,
    status: 'active',
  };
  await repo(ctx).insert(row);
  await audit.record({ ctx, action: 'supplier.create', entityType: 'supplier', entityId: id, after: row, ip: ctx.ip });
  return get(ctx, id);
}

async function update(ctx, id, data) {
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Fornecedor não encontrado');
  const patch = {};
  for (const k of ['name', 'trade_name', 'cnpj', 'cpf', 'email', 'phone', 'address', 'city', 'state', 'contact', 'notes']) {
    if (data[k] !== undefined) patch[k] = data[k] || null;
  }
  if (data.name !== undefined) patch.name = data.name;
  await repo(ctx).updateById(id, patch);
  await audit.record({ ctx, action: 'supplier.update', entityType: 'supplier', entityId: id, before, after: patch, ip: ctx.ip });
  return get(ctx, id);
}

async function inactivate(ctx, id) {
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Fornecedor não encontrado');
  await repo(ctx).updateById(id, { status: 'inactive' });
  await audit.record({ ctx, action: 'supplier.inactivate', entityType: 'supplier', entityId: id, before, ip: ctx.ip });
  return get(ctx, id);
}

async function activate(ctx, id) {
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Fornecedor não encontrado');
  await repo(ctx).updateById(id, { status: 'active' });
  await audit.record({ ctx, action: 'supplier.activate', entityType: 'supplier', entityId: id, before, ip: ctx.ip });
  return get(ctx, id);
}

async function history(ctx, id) {
  const supplier = await repo(ctx).findById(id);
  if (!supplier) throw Errors.notFound('Fornecedor não encontrado');
  const entries = await audit.history(ctx, 'supplier', id);
  return { supplier: { id: supplier.id, name: supplier.name }, entries };
}

module.exports = { list, get, create, update, inactivate, activate, history };
