'use strict';

const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');

/** Resumo do dashboard do tenant (FR41). */
async function summary(ctx) {
  const products = new TenantScopedRepository(knex, 'products', ctx);
  const balance = new TenantScopedRepository(knex, 'stock_balance', ctx);
  const movements = new TenantScopedRepository(knex, 'stock_movements', ctx);

  const activeRow = await products.query().where('products.status', 'active').count({ c: '*' }).first();

  const belowRow = await balance.query()
    .join('products', 'products.id', 'stock_balance.product_id')
    .where('products.status', 'active')
    .whereRaw('stock_balance.current_stock < products.min_stock')
    .count({ c: '*' })
    .first();

  const valueRow = await balance.query()
    .join('products', 'products.id', 'stock_balance.product_id')
    .where('products.status', 'active')
    .select(knex.raw('COALESCE(SUM(stock_balance.current_stock * products.cost_price), 0) as v'))
    .first();

  const last = await movements.query()
    .leftJoin('products', 'products.id', 'stock_movements.product_id')
    .leftJoin('users', 'users.id', 'stock_movements.user_id')
    .select('stock_movements.created_at', 'products.name as product', 'stock_movements.type', 'stock_movements.quantity', 'stock_movements.balance_after', 'users.name as user_name')
    .orderBy('stock_movements.created_at', 'desc')
    .limit(10);

  const trend = await movements.query()
    .whereRaw('stock_movements.created_at >= (NOW() - INTERVAL 7 DAY)')
    .select(
      knex.raw('DATE(stock_movements.created_at) as day'),
      'stock_movements.type',
      knex.raw('SUM(stock_movements.quantity) as total')
    )
    .groupByRaw('DATE(stock_movements.created_at), stock_movements.type')
    .orderBy('day', 'asc');

  return {
    productsActive: Number(activeRow ? activeRow.c : 0),
    belowMin: Number(belowRow ? belowRow.c : 0),
    stockValue: Number(valueRow ? valueRow.v : 0),
    lastMovements: last,
    entriesVsExits: trend.map((t) => ({ day: t.day, type: t.type, total: Number(t.total) })),
  };
}

module.exports = { summary };
