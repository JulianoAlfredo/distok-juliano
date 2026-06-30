'use strict';

const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');

/** Resumo do dashboard do tenant (FR41). */
async function summary(ctx) {
  const products  = new TenantScopedRepository(knex, 'products', ctx);
  const balance   = new TenantScopedRepository(knex, 'stock_balance', ctx);
  const movements = new TenantScopedRepository(knex, 'stock_movements', ctx);
  const salesRepo = new TenantScopedRepository(knex, 'sales', ctx);
  const saleItemsRepo = new TenantScopedRepository(knex, 'sale_items', ctx);
  const financialRepo = new TenantScopedRepository(knex, 'financial_entries', ctx);

  const [
    activeRow, belowRow, valueRow, zeroStockRow,
    todaySalesRow, monthSalesRow,
    pendingReceivableRow, pendingPayableRow,
    lastSalesRows, bestSellersRows,
  ] = await Promise.all([
    // produtos ativos
    products.query().where('products.status', 'active').count({ c: '*' }).first(),
    // abaixo do mínimo
    balance.query()
      .join('products', 'products.id', 'stock_balance.product_id')
      .where('products.status', 'active')
      .whereRaw('stock_balance.current_stock < products.min_stock')
      .count({ c: '*' }).first(),
    // valor total em estoque
    balance.query()
      .join('products', 'products.id', 'stock_balance.product_id')
      .where('products.status', 'active')
      .select(knex.raw('COALESCE(SUM(stock_balance.current_stock * products.cost_price), 0) as v')).first(),
    // sem estoque
    balance.query()
      .join('products', 'products.id', 'stock_balance.product_id')
      .where('products.status', 'active')
      .where('stock_balance.current_stock', '<=', 0)
      .count({ c: '*' }).first(),
    // vendas de hoje
    salesRepo.query()
      .whereRaw('DATE(sales.sold_at) = CURDATE()')
      .where('sales.status', 'open')
      .select(knex.raw('COALESCE(SUM(sales.total), 0) as total'), knex.raw('COUNT(*) as count')).first(),
    // vendas do mês
    salesRepo.query()
      .whereRaw('YEAR(sales.sold_at) = YEAR(NOW()) AND MONTH(sales.sold_at) = MONTH(NOW())')
      .where('sales.status', 'open')
      .select(knex.raw('COALESCE(SUM(sales.total), 0) as total'), knex.raw('COUNT(*) as count')).first(),
    // a receber (pendente)
    financialRepo.query()
      .where('financial_entries.type', 'receivable')
      .where('financial_entries.status', 'pending')
      .select(knex.raw('COALESCE(SUM(financial_entries.amount), 0) as total')).first(),
    // a pagar (pendente)
    financialRepo.query()
      .where('financial_entries.type', 'payable')
      .where('financial_entries.status', 'pending')
      .select(knex.raw('COALESCE(SUM(financial_entries.amount), 0) as total')).first(),
    // últimas 8 vendas
    salesRepo.query()
      .leftJoin('customers', 'customers.id', 'sales.customer_id')
      .select('sales.id', 'sales.number', 'sales.total', 'sales.sold_at', 'sales.payment_method', 'customers.name as customer_name')
      .where('sales.status', 'open')
      .orderBy('sales.sold_at', 'desc')
      .limit(8),
    // top 5 mais vendidos (30 dias)
    saleItemsRepo.query()
      .join('sales', 'sales.id', 'sale_items.sale_id')
      .join('products', 'products.id', 'sale_items.product_id')
      .where('sales.status', 'open')
      .whereRaw('sales.sold_at >= (NOW() - INTERVAL 30 DAY)')
      .select('products.id', 'products.name', knex.raw('SUM(sale_items.quantity) as qty_sold'), knex.raw('SUM(sale_items.total) as revenue'))
      .groupBy('products.id', 'products.name')
      .orderBy('qty_sold', 'desc')
      .limit(5),
  ]);

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
    productsActive:      Number(activeRow?.c    ?? 0),
    belowMin:            Number(belowRow?.c     ?? 0),
    zeroStock:           Number(zeroStockRow?.c ?? 0),
    stockValue:          Number(valueRow?.v     ?? 0),
    todaySalesTotal:     Number(todaySalesRow?.total  ?? 0),
    todaySalesCount:     Number(todaySalesRow?.count  ?? 0),
    monthSalesTotal:     Number(monthSalesRow?.total  ?? 0),
    monthSalesCount:     Number(monthSalesRow?.count  ?? 0),
    pendingReceivable:   Number(pendingReceivableRow?.total ?? 0),
    pendingPayable:      Number(pendingPayableRow?.total    ?? 0),
    lastSales:           lastSalesRows,
    bestSellers:         bestSellersRows.map((b) => ({ ...b, qty_sold: Number(b.qty_sold), revenue: Number(b.revenue) })),
    lastMovements:       last,
    entriesVsExits:      trend.map((t) => ({ day: t.day, type: t.type, total: Number(t.total) })),
  };
}

module.exports = { summary };
