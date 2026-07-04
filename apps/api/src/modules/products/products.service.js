'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');
const { applySearch } = require('../../utils/search');
const { assertCanAddProduct } = require('../../middlewares/plan-guard');
const { PRODUCT_STATUS } = require('@distok/shared');

function repo(ctx) {
  return new TenantScopedRepository(knex, 'products', ctx);
}

/** Margem de lucro (FR16): ((revenda - custo) / custo) * 100. */
function margin(cost, sale) {
  const c = Number(cost);
  const s = Number(sale);
  if (!c || c <= 0) return null;
  return Math.round(((s - c) / c) * 10000) / 100;
}

function decorate(p) {
  if (!p) return p;
  return { ...p, margin: margin(p.cost_price, p.sale_price) };
}

async function list(ctx, { search, category, status, page = 1, limit = 25 }) {
  const q = repo(ctx).query();
  if (status) q.where('products.status', status);
  if (category) q.where('products.category', category);
  if (search) applySearch(q, search, ['products.name', 'products.sku']);
  const offset = (page - 1) * limit;
  const rows = await q.orderBy('products.name', 'asc').limit(limit).offset(offset);
  return rows.map(decorate);
}

async function get(ctx, id) {
  const p = await repo(ctx).findById(id);
  if (!p) throw Errors.notFound('Produto não encontrado');
  return decorate(p);
}

async function create(ctx, data) {
  await assertCanAddProduct(ctx.tenantId); // FR20
  const id = uuid();
  const row = {
    id,
    name: data.name,
    description: data.description || null,
    category: data.category || null,
    unit: data.unit || 'un',
    sku: data.sku || null,
    cost_price: data.cost_price ?? 0,
    sale_price: data.sale_price ?? 0,
    min_stock: data.min_stock ?? 0,
    status: PRODUCT_STATUS.ACTIVE,
  };
  await repo(ctx).insert(row);
  // saldo inicial zerado (via repositório escopado — injeta tenant_id)
  await new TenantScopedRepository(knex, 'stock_balance', ctx).insert({ product_id: id, current_stock: 0 });
  await audit.record({ ctx, action: 'product.create', entityType: 'product', entityId: id, after: row, ip: ctx.ip });
  return get(ctx, id);
}

async function update(ctx, id, data) {
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Produto não encontrado');
  const patch = {};
  for (const k of ['name', 'description', 'category', 'unit', 'sku', 'cost_price', 'sale_price', 'min_stock']) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  await repo(ctx).updateById(id, patch);
  await audit.record({ ctx, action: 'product.update', entityType: 'product', entityId: id, before, after: patch, ip: ctx.ip });
  return get(ctx, id);
}

async function inactivate(ctx, id) {
  const before = await repo(ctx).findById(id);
  if (!before) throw Errors.notFound('Produto não encontrado');
  await repo(ctx).updateById(id, { status: PRODUCT_STATUS.INACTIVE });
  await audit.record({ ctx, action: 'product.inactivate', entityType: 'product', entityId: id, before, ip: ctx.ip });
  return get(ctx, id);
}

module.exports = { list, get, create, update, inactivate, margin };
