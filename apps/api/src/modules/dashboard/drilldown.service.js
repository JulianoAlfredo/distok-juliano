'use strict';

const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { Errors } = require('../../core/errors');
const { applySearch } = require('../../utils/search');

/**
 * Drill-downs do dashboard (FR41 — modais de detalhe por card). 100% leitura:
 * nenhum insert/update/delete, nenhum audit.record.
 *
 * Cada função aqui espelha LITERALMENTE o predicado do card correspondente em
 * dashboard.service.js (mesmas funções de data do MySQL — CURDATE()/NOW() —
 * nunca data calculada em JS) para que a modal nunca divirja do número do card.
 */

function balanceRepo(ctx) { return new TenantScopedRepository(knex, 'stock_balance', ctx); }
function salesRepo(ctx) { return new TenantScopedRepository(knex, 'sales', ctx); }
function saleItemsRepo(ctx) { return new TenantScopedRepository(knex, 'sale_items', ctx); }
function financialRepo(ctx) { return new TenantScopedRepository(knex, 'financial_entries', ctx); }

function normPage(page) {
  const p = Number(page);
  return Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1;
}

/** limit: 1..100, default 20. Acima de 100 => clamp (não erro). */
function normLimit(limit) {
  const l = Number(limit);
  if (!Number.isFinite(l) || l < 1) return 20;
  return Math.min(Math.floor(l), 100);
}

/** search: trim; string vazia após trim é tratada como ausente. */
function normSearch(search) {
  const s = (search || '').toString().trim();
  return s || undefined;
}

function normBool(v, def = false) {
  if (v === undefined || v === null || v === '') return def;
  return v === true || v === 'true' || v === '1' || v === 1;
}

/** join products com defesa de tenant coluna-a-coluna, além do filtro do repositório. */
function joinProducts(q, productTable = 'products') {
  return q.join(productTable, function () {
    this.on(`${productTable}.id`, 'stock_balance.product_id').andOn(`${productTable}.tenant_id`, 'stock_balance.tenant_id');
  });
}

// ---------------------------------------------------------------------------
// GET /dashboard/drilldown/out-of-stock
// ---------------------------------------------------------------------------
async function outOfStock(ctx, { search, category, page, limit } = {}) {
  page = normPage(page);
  limit = normLimit(limit);
  search = normSearch(search);

  const base = () => {
    const q = joinProducts(balanceRepo(ctx).query())
      .where('products.status', 'active')
      .where('stock_balance.current_stock', '<=', 0);
    if (category) q.where('products.category', category);
    if (search) applySearch(q, search, ['products.name', 'products.sku']);
    return q;
  };

  const countRow = await base().count({ c: '*' }).first();
  const total = Number(countRow?.c ?? 0);

  const rows = await base()
    .select('products.id', 'products.name', 'products.sku', 'products.category',
      'stock_balance.current_stock', 'products.min_stock')
    .orderBy('products.name', 'asc')
    .limit(limit).offset((page - 1) * limit);

  const items = rows.map((r) => ({
    id: r.id, name: r.name, sku: r.sku, category: r.category,
    current_stock: Number(r.current_stock), min_stock: Number(r.min_stock),
  }));

  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

// ---------------------------------------------------------------------------
// GET /dashboard/drilldown/below-min
// ---------------------------------------------------------------------------
async function belowMin(ctx, { search, category, page, limit } = {}) {
  page = normPage(page);
  limit = normLimit(limit);
  search = normSearch(search);

  const base = () => {
    const q = joinProducts(balanceRepo(ctx).query())
      .where('products.status', 'active')
      .whereRaw('stock_balance.current_stock < products.min_stock');
    if (category) q.where('products.category', category);
    if (search) applySearch(q, search, ['products.name', 'products.sku']);
    return q;
  };

  const countRow = await base().count({ c: '*' }).first();
  const total = Number(countRow?.c ?? 0);

  const rows = await base()
    .select(
      'products.id', 'products.name', 'products.sku', 'products.category',
      'stock_balance.current_stock', 'products.min_stock',
      knex.raw('(products.min_stock - stock_balance.current_stock) as missing')
    )
    .orderByRaw('missing DESC, products.name ASC')
    .limit(limit).offset((page - 1) * limit);

  const items = rows.map((r) => ({
    id: r.id, name: r.name, sku: r.sku, category: r.category,
    current_stock: Number(r.current_stock), min_stock: Number(r.min_stock),
    missing: Number(r.missing),
  }));

  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

// ---------------------------------------------------------------------------
// GET /dashboard/drilldown/sales
// ---------------------------------------------------------------------------
async function sales(ctx, { period, dateFrom, dateTo, search, paymentMethod, includeCancelled, page, limit } = {}) {
  page = normPage(page);
  limit = normLimit(limit);
  search = normSearch(search);
  period = period || 'today';
  const cancelled = normBool(includeCancelled, false);

  if (!['today', 'month', 'custom'].includes(period)) {
    throw Errors.validation('period inválido');
  }
  if (period === 'custom' && (!dateFrom || !dateTo)) {
    throw Errors.validation('dateFrom e dateTo são obrigatórios para period=custom');
  }

  const base = () => {
    const q = salesRepo(ctx).query()
      .leftJoin('customers', function () {
        this.on('customers.id', 'sales.customer_id').andOn('customers.tenant_id', 'sales.tenant_id');
      });

    if (period === 'today') {
      q.whereRaw('DATE(sales.sold_at) = CURDATE()');
    } else if (period === 'month') {
      q.whereRaw('YEAR(sales.sold_at) = YEAR(NOW()) AND MONTH(sales.sold_at) = MONTH(NOW())');
    } else {
      q.whereRaw('DATE(sales.sold_at) BETWEEN ? AND ?', [dateFrom, dateTo]);
    }

    if (!cancelled) q.where('sales.status', 'open');
    if (paymentMethod) q.where('sales.payment_method', paymentMethod);

    if (search) {
      q.where((b) => {
        applySearch(b, search, ['customers.name']);
        if (/^\d+$/.test(search)) b.orWhere('sales.number', Number(search));
      });
    }
    return q;
  };

  const aggRow = await base()
    .select(knex.raw('COALESCE(SUM(sales.total), 0) as totalAmount'), knex.raw('COUNT(*) as cnt'))
    .first();
  const total = Number(aggRow?.cnt ?? 0);
  const summary = { totalAmount: Number(aggRow?.totalAmount ?? 0), count: total };

  const rows = await base()
    .select(
      'sales.id', 'sales.number', 'sales.sold_at', 'sales.customer_id',
      'customers.name as customer_name', 'sales.payment_method', 'sales.total', 'sales.status'
    )
    .orderBy('sales.sold_at', 'desc')
    .limit(limit).offset((page - 1) * limit);

  const ids = rows.map((r) => r.id);
  const countsBySale = {};
  if (ids.length) {
    const itemRows = await saleItemsRepo(ctx).query()
      .whereIn('sale_items.sale_id', ids)
      .select('sale_items.sale_id')
      .count({ lines: '*' })
      .sum({ units: 'sale_items.quantity' })
      .groupBy('sale_items.sale_id');
    for (const r of itemRows) {
      countsBySale[r.sale_id] = { lines: Number(r.lines), units: Number(r.units || 0) };
    }
  }

  const items = rows.map((r) => {
    const c = countsBySale[r.id] || { lines: 0, units: 0 };
    return {
      id: r.id,
      number: r.number,
      sold_at: r.sold_at,
      customer_name: r.customer_name ?? null,
      customer_id: r.customer_id ?? null,
      items_count: c.lines,
      units_count: c.units,
      payment_method: r.payment_method,
      total: Number(r.total),
      status: r.status,
    };
  });

  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit, summary };
}

// ---------------------------------------------------------------------------
// GET /dashboard/drilldown/financial
// ---------------------------------------------------------------------------
const FINANCIAL_SITUATIONS = ['pending', 'overdue', 'upcoming', 'paid', 'all'];

async function financial(ctx, { type, situation, search, dateFrom, dateTo, includeCancelled, page, limit } = {}) {
  page = normPage(page);
  limit = normLimit(limit);
  search = normSearch(search);
  situation = situation || 'pending';
  const cancelled = normBool(includeCancelled, false);

  if (!['receivable', 'payable'].includes(type)) {
    throw Errors.validation('type é obrigatório e deve ser "receivable" ou "payable"');
  }
  if (!FINANCIAL_SITUATIONS.includes(situation)) {
    throw Errors.validation('situation inválida');
  }

  const base = () => {
    const q = financialRepo(ctx).query()
      .leftJoin('suppliers', function () {
        this.on('suppliers.id', 'financial_entries.supplier_id').andOn('suppliers.tenant_id', 'financial_entries.tenant_id');
      })
      .leftJoin('customers', function () {
        this.on('customers.id', 'financial_entries.customer_id').andOn('customers.tenant_id', 'financial_entries.tenant_id');
      })
      .where('financial_entries.type', type);

    if (situation === 'pending') {
      q.where('financial_entries.status', 'pending');
    } else if (situation === 'overdue') {
      q.where('financial_entries.status', 'pending').whereRaw('financial_entries.due_date < CURDATE()');
    } else if (situation === 'upcoming') {
      q.where('financial_entries.status', 'pending').whereRaw('financial_entries.due_date >= CURDATE()');
    } else if (situation === 'paid') {
      q.where('financial_entries.status', 'paid');
    } else if (situation === 'all' && !cancelled) {
      q.whereNot('financial_entries.status', 'cancelled');
    }

    if (dateFrom) q.where('financial_entries.due_date', '>=', dateFrom);
    if (dateTo)   q.where('financial_entries.due_date', '<=', dateTo);
    if (search)   applySearch(q, search, ['financial_entries.description', 'customers.name', 'suppliers.name']);
    return q;
  };

  const aggRow = await base()
    .select(
      knex.raw('COALESCE(SUM(financial_entries.amount), 0) as totalAmount'),
      knex.raw('COUNT(*) as cnt'),
      knex.raw("COALESCE(SUM(CASE WHEN financial_entries.status='pending' AND financial_entries.due_date < CURDATE() THEN financial_entries.amount ELSE 0 END), 0) as overdueAmount"),
      knex.raw("COALESCE(SUM(CASE WHEN financial_entries.status='pending' AND financial_entries.due_date < CURDATE() THEN 1 ELSE 0 END), 0) as overdueCount")
    ).first();
  const total = Number(aggRow?.cnt ?? 0);
  const summary = {
    totalAmount: Number(aggRow?.totalAmount ?? 0),
    count: total,
    overdueAmount: Number(aggRow?.overdueAmount ?? 0),
    overdueCount: Number(aggRow?.overdueCount ?? 0),
  };

  const rows = await base()
    .select(
      'financial_entries.id', 'financial_entries.description',
      'financial_entries.supplier_id', 'financial_entries.customer_id',
      'suppliers.name as supplier_name', 'customers.name as customer_name',
      'financial_entries.due_date', 'financial_entries.amount', 'financial_entries.status',
      knex.raw("CASE WHEN financial_entries.status='pending' AND financial_entries.due_date < CURDATE() THEN 1 ELSE 0 END as is_overdue"),
      knex.raw("CASE WHEN financial_entries.status='pending' AND financial_entries.due_date < CURDATE() THEN DATEDIFF(CURDATE(), financial_entries.due_date) ELSE NULL END as days_overdue")
    )
    .orderBy('financial_entries.due_date', 'asc')
    .limit(limit).offset((page - 1) * limit);

  const items = rows.map((r) => {
    const isOverdue = Number(r.is_overdue) === 1;
    let situationVal;
    if (r.status === 'cancelled') situationVal = 'cancelled';
    else if (r.status === 'paid') situationVal = 'paid';
    else if (isOverdue) situationVal = 'overdue';
    else situationVal = 'upcoming';

    const partyType = r.supplier_id ? 'supplier' : (r.customer_id ? 'customer' : null);
    const partyName = r.supplier_name ?? r.customer_name ?? null;

    return {
      id: r.id,
      description: r.description,
      party_name: partyName,
      party_type: partyType,
      customer_name: r.customer_name ?? null,
      supplier_name: r.supplier_name ?? null,
      due_date: r.due_date,
      amount: Number(r.amount),
      status: r.status,
      is_overdue: isOverdue,
      days_overdue: r.days_overdue === null || r.days_overdue === undefined ? null : Number(r.days_overdue),
      situation: situationVal,
    };
  });

  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit, summary };
}

// ---------------------------------------------------------------------------
// GET /dashboard/drilldown/stock-value
// ---------------------------------------------------------------------------
const STOCK_VALUE_SORT_COLUMNS = {
  value: 'total_value',
  name: 'products.name',
  qty: 'stock_balance.current_stock',
};

async function stockValue(ctx, { search, category, sort, dir, page, limit } = {}) {
  page = normPage(page);
  limit = normLimit(limit);
  search = normSearch(search);

  const sortCol = STOCK_VALUE_SORT_COLUMNS[sort] || STOCK_VALUE_SORT_COLUMNS.value;
  const sortDir = dir === 'asc' ? 'asc' : 'desc';

  const base = () => {
    const q = joinProducts(balanceRepo(ctx).query())
      .where('products.status', 'active')
      .whereRaw('stock_balance.current_stock <> 0'); // saldo negativo também entra (ver nota de reconciliação)
    if (category) q.where('products.category', category);
    if (search) applySearch(q, search, ['products.name', 'products.sku']);
    return q;
  };

  const countRow = await base().count({ c: '*' }).first();
  const total = Number(countRow?.c ?? 0);

  const sumRow = await base()
    .select(knex.raw('COALESCE(SUM(stock_balance.current_stock * products.cost_price), 0) as totalValue'))
    .first();
  const summary = { totalValue: Number(sumRow?.totalValue ?? 0) };

  const rows = await base()
    .select(
      'products.id', 'products.name', 'products.sku', 'products.category',
      'stock_balance.current_stock', 'products.cost_price',
      knex.raw('stock_balance.current_stock * products.cost_price as total_value')
    )
    .orderByRaw(`${sortCol} ${sortDir}`)
    .limit(limit).offset((page - 1) * limit);

  const items = rows.map((r) => ({
    id: r.id, name: r.name, sku: r.sku, category: r.category,
    current_stock: Number(r.current_stock), cost_price: Number(r.cost_price),
    total_value: Number(r.total_value),
  }));

  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit, summary };
}

module.exports = { outOfStock, belowMin, sales, financial, stockValue };
