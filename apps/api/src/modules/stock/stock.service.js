'use strict';

const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const StockLedger = require('../../core/StockLedger');
const { Errors } = require('../../core/errors');
const { applySearch } = require('../../utils/search');

/** Cria movimentação (delega ao ledger transacional do core). */
async function createMovement(ctx, input) {
  return StockLedger.createMovement(knex, ctx, input);
}

/** Saldo atual por produto (FR30/FR33), com flag de abaixo do mínimo. */
async function listBalance(ctx, { belowMin, category, search, page = 1, limit = 50 }) {
  const repo = new TenantScopedRepository(knex, 'stock_balance', ctx);
  const q = repo.query()
    .join('products', 'products.id', 'stock_balance.product_id')
    .select(
      'products.id as product_id',
      'products.name',
      'products.sku',
      'products.category',
      'products.unit',
      'products.min_stock',
      'products.status',
      'stock_balance.current_stock',
      'stock_balance.last_updated'
    )
    .where('products.status', 'active');
  if (category) q.where('products.category', category);
  if (search) {
    applySearch(q, search, ['products.name', 'products.sku']);
  }
  if (belowMin) q.whereRaw('stock_balance.current_stock < products.min_stock');
  const rows = await q.orderBy('products.name', 'asc').limit(limit).offset((page - 1) * limit);
  return rows.map((r) => ({ ...r, below_min: Number(r.current_stock) < Number(r.min_stock) }));
}

/** Extrato de um produto (FR34), cronológico decrescente. */
async function listMovements(ctx, productId, { page = 1, limit = 50 }) {
  const product = await new TenantScopedRepository(knex, 'products', ctx).findById(productId);
  if (!product) throw Errors.notFound('Produto não encontrado');

  const repo = new TenantScopedRepository(knex, 'stock_movements', ctx);
  const rows = await repo.query()
    .leftJoin('users', 'users.id', 'stock_movements.user_id')
    .select(
      'stock_movements.id',
      'stock_movements.type',
      'stock_movements.quantity',
      'stock_movements.balance_after',
      'stock_movements.reason',
      'stock_movements.note',
      'stock_movements.created_at',
      'users.name as user_name'
    )
    .where('stock_movements.product_id', productId)
    .orderBy('stock_movements.created_at', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);
  return { product: { id: product.id, name: product.name, sku: product.sku }, movements: rows };
}

/** Histórico geral de movimentações com filtros (expandido). */
async function listAllMovements(ctx, { type, productId, dateFrom, dateTo, page = 1, limit = 50 }) {
  const repo = new TenantScopedRepository(knex, 'stock_movements', ctx);
  const q = repo.query()
    .leftJoin('products', 'products.id', 'stock_movements.product_id')
    .leftJoin('users', 'users.id', 'stock_movements.user_id')
    .select(
      'stock_movements.id',
      'stock_movements.type',
      'stock_movements.quantity',
      'stock_movements.balance_after',
      'stock_movements.reason',
      'stock_movements.note',
      'stock_movements.created_at',
      'products.id as product_id',
      'products.name as product_name',
      'products.sku',
      'users.name as user_name'
    );
  if (type)      q.where('stock_movements.type', type);
  if (productId) q.where('stock_movements.product_id', productId);
  if (dateFrom)  q.where('stock_movements.created_at', '>=', dateFrom);
  if (dateTo)    q.where('stock_movements.created_at', '<=', dateTo + ' 23:59:59');

  const countQ = repo.query()
    .leftJoin('products', 'products.id', 'stock_movements.product_id');
  if (type)      countQ.where('stock_movements.type', type);
  if (productId) countQ.where('stock_movements.product_id', productId);
  if (dateFrom)  countQ.where('stock_movements.created_at', '>=', dateFrom);
  if (dateTo)    countQ.where('stock_movements.created_at', '<=', dateTo + ' 23:59:59');
  const countRow = await countQ.count({ c: '*' }).first();
  const total    = Number(countRow?.c ?? 0);

  const rows = await q.orderBy('stock_movements.created_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { createMovement, listBalance, listMovements, listAllMovements };
