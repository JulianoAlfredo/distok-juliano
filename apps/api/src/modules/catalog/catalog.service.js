'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { Errors } = require('../../core/errors');

// ─── Categorias ───────────────────────────────────────────────────────────────

function catRepo(ctx) { return new TenantScopedRepository(knex, 'product_categories', ctx); }
function unitRepo(ctx) { return new TenantScopedRepository(knex, 'product_units', ctx); }

async function listCategories(ctx) {
  return catRepo(ctx).query().orderBy('product_categories.name', 'asc');
}

async function createCategory(ctx, { name }) {
  if (!name || !name.trim()) throw Errors.validation('O nome da categoria é obrigatório');
  const exists = await catRepo(ctx).query().where('product_categories.name', name.trim()).first();
  if (exists) throw Errors.conflict('Já existe uma categoria com este nome');
  const id = uuid();
  await catRepo(ctx).insert({ id, name: name.trim() });
  return catRepo(ctx).findById(id);
}

async function deleteCategory(ctx, id) {
  const cat = await catRepo(ctx).findById(id);
  if (!cat) throw Errors.notFound('Categoria não encontrada');
  const inUse = await new TenantScopedRepository(knex, 'products', ctx)
    .query().where('products.category', cat.name).first();
  if (inUse) throw Errors.conflict('Esta categoria está em uso por produtos e não pode ser removida');
  await catRepo(ctx).query().where('product_categories.id', id).del();
  return { ok: true };
}

// ─── Unidades ─────────────────────────────────────────────────────────────────

async function listUnits(ctx) {
  return unitRepo(ctx).query().orderBy('product_units.name', 'asc');
}

async function createUnit(ctx, { name, symbol }) {
  if (!name || !name.trim()) throw Errors.validation('O nome da unidade é obrigatório');
  if (!symbol || !symbol.trim()) throw Errors.validation('O símbolo é obrigatório');
  const exists = await unitRepo(ctx).query().where('product_units.symbol', symbol.trim()).first();
  if (exists) throw Errors.conflict('Já existe uma unidade com este símbolo');
  const id = uuid();
  await unitRepo(ctx).insert({ id, name: name.trim(), symbol: symbol.trim() });
  return unitRepo(ctx).findById(id);
}

async function deleteUnit(ctx, id) {
  const unit = await unitRepo(ctx).findById(id);
  if (!unit) throw Errors.notFound('Unidade não encontrada');
  const inUse = await new TenantScopedRepository(knex, 'products', ctx)
    .query().where('products.unit', unit.symbol).first();
  if (inUse) throw Errors.conflict('Esta unidade está em uso por produtos e não pode ser removida');
  await unitRepo(ctx).query().where('product_units.id', id).del();
  return { ok: true };
}

module.exports = { listCategories, createCategory, deleteCategory, listUnits, createUnit, deleteUnit };
