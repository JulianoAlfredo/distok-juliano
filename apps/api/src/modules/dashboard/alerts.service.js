'use strict';

const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');

/** Retorna alertas operacionais do tenant (estoque, financeiro, caixa, compras). */
async function alerts(ctx) {
  const balance   = new TenantScopedRepository(knex, 'stock_balance', ctx);
  const financial = new TenantScopedRepository(knex, 'financial_entries', ctx);
  const cashier   = new TenantScopedRepository(knex, 'cashier_sessions', ctx);
  const purchases = new TenantScopedRepository(knex, 'purchases', ctx);

  const [
    criticalRow, lowRow,
    overdueRow,
    openCashierRow,
    pendingPurchasesRow,
  ] = await Promise.all([
    // sem estoque (current_stock <= 0)
    balance.query()
      .join('products', 'products.id', 'stock_balance.product_id')
      .where('products.status', 'active')
      .where('stock_balance.current_stock', '<=', 0)
      .count({ c: '*' }).first(),

    // abaixo do mínimo (0 < current_stock < min_stock)
    balance.query()
      .join('products', 'products.id', 'stock_balance.product_id')
      .where('products.status', 'active')
      .whereRaw('stock_balance.current_stock > 0 AND stock_balance.current_stock < products.min_stock')
      .count({ c: '*' }).first(),

    // contas a pagar vencidas (due_date < hoje, ainda pendentes)
    financial.query()
      .where('financial_entries.type', 'payable')
      .where('financial_entries.status', 'pending')
      .whereRaw('financial_entries.due_date < CURDATE()')
      .select(
        knex.raw('COUNT(*) as c'),
        knex.raw('COALESCE(SUM(financial_entries.amount), 0) as amount'),
      ).first(),

    // caixa(s) aberto(s)
    cashier.query()
      .where('cashier_sessions.status', 'open')
      .count({ c: '*' }).first(),

    // pedidos de compra em rascunho (draft = aguardando confirmação)
    purchases.query()
      .where('purchases.status', 'draft')
      .count({ c: '*' }).first(),
  ]);

  const criticalStock    = Number(criticalRow?.c        ?? 0);
  const lowStock         = Number(lowRow?.c             ?? 0);
  const overduePayables  = Number(overdueRow?.c         ?? 0);
  const overdueAmount    = Number(overdueRow?.amount    ?? 0);
  const openCashier      = Number(openCashierRow?.c     ?? 0);
  const pendingPurchases = Number(pendingPurchasesRow?.c ?? 0);

  // Badge = problemas que exigem ação imediata
  const total = criticalStock + overduePayables;

  return {
    criticalStock,
    lowStock,
    overduePayables,
    overdueAmount,
    openCashier,
    pendingPurchases,
    total,
  };
}

module.exports = { alerts };
