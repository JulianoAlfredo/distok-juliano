'use strict';

const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { Errors } = require('../../core/errors');

function movementsRepo(ctx) { return new TenantScopedRepository(knex, 'stock_movements', ctx); }
function salesRepoOf(ctx) { return new TenantScopedRepository(knex, 'sales', ctx); }

function validateDays(days, fallback) {
  if (days === undefined || days === null || days === '') return fallback;
  const d = Number(days);
  if (!Number.isInteger(d) || d < 1 || d > 90) {
    throw Errors.validation('days deve ser um inteiro entre 1 e 90');
  }
  return d;
}

/** "hoje" segundo o relógio do MySQL/MariaDB — nunca o relógio/fuso do Node. */
async function dbToday() {
  const [rows] = await knex.raw('SELECT CURDATE() as today');
  return rows[0].today; // string YYYY-MM-DD (dateStrings: true no knexfile)
}

/** Desloca uma data YYYY-MM-DD por deltaDays dias, sem depender do fuso local do Node (âncora em UTC). */
function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** Lista de `days` datas YYYY-MM-DD terminando em `todayStr` (mais antiga primeiro). */
function buildDayList(todayStr, days) {
  const list = [];
  for (let i = days - 1; i >= 0; i--) list.push(shiftDate(todayStr, -i));
  return list;
}

// ---------------------------------------------------------------------------
// GET /dashboard/trends/movements
// ---------------------------------------------------------------------------
async function movements(ctx, { days } = {}) {
  const n = validateDays(days, 7);
  const todayStr = await dbToday();
  const from = shiftDate(todayStr, -(n - 1));

  const rows = await movementsRepo(ctx).query()
    .whereRaw('stock_movements.created_at >= (NOW() - INTERVAL ? DAY)', [n])
    .select(
      knex.raw('DATE(stock_movements.created_at) as day'),
      'stock_movements.type',
      knex.raw('SUM(stock_movements.quantity) as total')
    )
    .groupByRaw('DATE(stock_movements.created_at), stock_movements.type')
    .orderBy('day', 'asc');

  const byDay = {};
  for (const r of rows) {
    const d = r.day;
    if (!byDay[d]) byDay[d] = { entry: 0, exit: 0, adjustment: 0 };
    byDay[d][r.type] = Number(r.total);
  }

  const series = buildDayList(todayStr, n).map((d) => ({
    day: d,
    entry: byDay[d]?.entry ?? 0,
    exit: byDay[d]?.exit ?? 0,
    adjustment: byDay[d]?.adjustment ?? 0,
  }));

  return { days: n, from, to: todayStr, series };
}

// ---------------------------------------------------------------------------
// GET /dashboard/trends/revenue
// ---------------------------------------------------------------------------
async function revenue(ctx, { days } = {}) {
  const n = validateDays(days, 30);
  const todayStr = await dbToday();
  const from = shiftDate(todayStr, -(n - 1));

  const rows = await salesRepoOf(ctx).query()
    .where('sales.status', 'open')
    .whereRaw('sales.sold_at >= (CURDATE() - INTERVAL ? DAY)', [n])
    .select(
      knex.raw('DATE(sales.sold_at) as day'),
      knex.raw('SUM(sales.total) as total'),
      knex.raw('COUNT(*) as count')
    )
    .groupByRaw('DATE(sales.sold_at)')
    .orderBy('day', 'asc');

  const byDay = {};
  for (const r of rows) byDay[r.day] = { total: Number(r.total), count: Number(r.count) };

  const series = buildDayList(todayStr, n).map((d) => ({
    day: d,
    total: byDay[d]?.total ?? 0,
    count: byDay[d]?.count ?? 0,
  }));

  return { days: n, from, to: todayStr, series };
}

module.exports = { movements, revenue };
