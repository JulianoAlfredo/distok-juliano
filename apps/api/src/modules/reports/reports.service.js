'use strict';

const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { margin } = require('../products/products.service');
const { DEFAULT_BRANDING } = require('@distok/shared');

async function getBranding(ctx) {
  const b = await knex('tenant_branding').where({ tenant_id: ctx.tenantId }).first();
  return { ...DEFAULT_BRANDING, ...(b || {}) };
}

const money = (v) => `R$ ${Number(v || 0).toFixed(2)}`;
const dt = (v) => new Date(v).toLocaleString('pt-BR');

/** Relatório de estoque atual (FR35). */
async function stockCurrent(ctx) {
  const repo = new TenantScopedRepository(knex, 'stock_balance', ctx);
  const rows = await repo.query()
    .join('products', 'products.id', 'stock_balance.product_id')
    .where('products.status', 'active')
    .select('products.name', 'products.sku', 'products.cost_price', 'products.sale_price', 'stock_balance.current_stock')
    .orderBy('products.name', 'asc');
  return {
    title: 'Estoque atual',
    columns: [
      { label: 'Produto', value: (r) => r.name },
      { label: 'SKU', value: (r) => r.sku || '—' },
      { label: 'Saldo', value: (r) => r.current_stock },
      { label: 'Custo', value: (r) => money(r.cost_price) },
      { label: 'Revenda', value: (r) => money(r.sale_price) },
      { label: 'Margem', value: (r) => { const m = margin(r.cost_price, r.sale_price); return m == null ? '—' : `${m}%`; } },
      { label: 'Total (custo)', value: (r) => money(Number(r.current_stock) * Number(r.cost_price)) },
    ],
    rows,
  };
}

/** Relatório de movimentações com filtros (FR36). */
async function movements(ctx, { from, to, productId, userId, type }) {
  const repo = new TenantScopedRepository(knex, 'stock_movements', ctx);
  const q = repo.query()
    .leftJoin('products', 'products.id', 'stock_movements.product_id')
    .leftJoin('users', 'users.id', 'stock_movements.user_id')
    .select(
      'stock_movements.created_at', 'products.name as product', 'stock_movements.type',
      'stock_movements.quantity', 'stock_movements.balance_after', 'users.name as user_name', 'stock_movements.reason'
    )
    .orderBy('stock_movements.created_at', 'desc');
  if (from) q.where('stock_movements.created_at', '>=', from);
  if (to) q.where('stock_movements.created_at', '<=', `${to} 23:59:59`);
  if (productId) q.where('stock_movements.product_id', productId);
  if (userId) q.where('stock_movements.user_id', userId);
  if (type) q.where('stock_movements.type', type);
  const rows = await q.limit(5000);
  return {
    title: 'Movimentações de estoque',
    columns: [
      { label: 'Data', value: (r) => dt(r.created_at) },
      { label: 'Produto', value: (r) => r.product || '—' },
      { label: 'Tipo', value: (r) => ({ entry: 'entrada', exit: 'saída', adjustment: 'ajuste' }[r.type] || r.type) },
      { label: 'Qtd', value: (r) => r.quantity },
      { label: 'Saldo após', value: (r) => r.balance_after },
      { label: 'Responsável', value: (r) => r.user_name || '—' },
      { label: 'Motivo', value: (r) => r.reason || '—' },
    ],
    rows,
  };
}

/** Relatório de auditoria (FR37) — somente leitura. */
async function audit(ctx, { from, to }) {
  const q = knex('audit_log')
    .leftJoin('users', 'users.id', 'audit_log.user_id')
    .where('audit_log.tenant_id', ctx.tenantId)
    .select('audit_log.created_at', 'audit_log.action', 'audit_log.entity_type', 'users.name as user_name', 'audit_log.ip_address')
    .orderBy('audit_log.created_at', 'desc');
  if (from) q.where('audit_log.created_at', '>=', from);
  if (to) q.where('audit_log.created_at', '<=', `${to} 23:59:59`);
  const rows = await q.limit(5000);
  return {
    title: 'Auditoria',
    columns: [
      { label: 'Data', value: (r) => dt(r.created_at) },
      { label: 'Ação', value: (r) => r.action },
      { label: 'Entidade', value: (r) => r.entity_type || '—' },
      { label: 'Responsável', value: (r) => r.user_name || '—' },
      { label: 'IP', value: (r) => r.ip_address || '—' },
    ],
    rows,
  };
}

/** Relatório de produtos abaixo do mínimo (FR38). */
async function belowMin(ctx) {
  const repo = new TenantScopedRepository(knex, 'stock_balance', ctx);
  const rows = await repo.query()
    .join('products', 'products.id', 'stock_balance.product_id')
    .where('products.status', 'active')
    .whereRaw('stock_balance.current_stock < products.min_stock')
    .select('products.name', 'products.sku', 'stock_balance.current_stock', 'products.min_stock')
    .orderBy('products.name', 'asc');
  return {
    title: 'Produtos abaixo do estoque mínimo',
    columns: [
      { label: 'Produto', value: (r) => r.name },
      { label: 'SKU', value: (r) => r.sku || '—' },
      { label: 'Saldo', value: (r) => r.current_stock },
      { label: 'Mínimo', value: (r) => r.min_stock },
      { label: 'Faltam', value: (r) => Number(r.min_stock) - Number(r.current_stock) },
    ],
    rows,
  };
}

module.exports = { getBranding, stockCurrent, movements, audit, belowMin };
