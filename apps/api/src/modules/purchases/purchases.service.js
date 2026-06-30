'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const StockLedger = require('../../core/StockLedger');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');

function repo(ctx)        { return new TenantScopedRepository(knex, 'purchases', ctx); }
function itemsRepo(ctx)   { return new TenantScopedRepository(knex, 'purchase_items', ctx); }
function productsRepo(ctx){ return new TenantScopedRepository(knex, 'products', ctx); }
function balanceRepo(ctx) { return new TenantScopedRepository(knex, 'stock_balance', ctx); }

/** Próximo número sequencial de pedido por tenant. */
async function nextNumber(ctx, trx) {
  const row = await repo(ctx).query(trx).max({ m: 'number' }).first();
  return (Number(row?.m) || 0) + 1;
}

async function list(ctx, { status, supplierId, page = 1, limit = 25 }) {
  const base = () => {
    const q = repo(ctx).query()
      .leftJoin('suppliers', 'suppliers.id', 'purchases.supplier_id')
      .leftJoin('users', 'users.id', 'purchases.user_id')
      .select(
        'purchases.id', 'purchases.number', 'purchases.status', 'purchases.total_cost',
        'purchases.purchased_at', 'purchases.notes',
        'suppliers.name as supplier_name',
        'users.name as user_name'
      );
    if (status)     q.where('purchases.status', status);
    if (supplierId) q.where('purchases.supplier_id', supplierId);
    return q;
  };
  const countRow = await base().count({ c: '*' }).first();
  const total    = Number(countRow?.c ?? 0);
  const items    = await base().orderBy('purchases.created_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function get(ctx, id) {
  const purchase = await repo(ctx).query()
    .leftJoin('suppliers', 'suppliers.id', 'purchases.supplier_id')
    .leftJoin('users', 'users.id', 'purchases.user_id')
    .select('purchases.*', 'suppliers.name as supplier_name', 'users.name as user_name')
    .where('purchases.id', id)
    .first();
  if (!purchase) throw Errors.notFound('Pedido de compra não encontrado');

  const items = await itemsRepo(ctx).query()
    .join('products', 'products.id', 'purchase_items.product_id')
    .select('purchase_items.*', 'products.name as product_name', 'products.unit')
    .where('purchase_items.purchase_id', id);

  return { ...purchase, items };
}

/**
 * Cria pedido em rascunho (sem movimentar estoque).
 * items: [{ productId, quantity, unitCost }]
 */
async function create(ctx, { supplierId, notes, purchasedAt, items }) {
  if (!items || items.length === 0) throw Errors.validation('Informe ao menos um item');

  for (const it of items) {
    const p = await productsRepo(ctx).findById(it.productId);
    if (!p) throw Errors.notFound(`Produto ${it.productId} não encontrado`);
    if (it.quantity <= 0) throw Errors.validation('Quantidade deve ser maior que zero');
    if (it.unitCost < 0)  throw Errors.validation('Custo unitário não pode ser negativo');
  }

  const id        = uuid();
  const totalCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  await knex.transaction(async (trx) => {
    const number = await nextNumber(ctx, trx);
    await repo(ctx).insert({
      id,
      user_id:      ctx.userId,
      supplier_id:  supplierId || null,
      number,
      status:       'draft',
      notes:        notes || null,
      total_cost:   totalCost,
      purchased_at: purchasedAt || knex.fn.now(),
    }, trx);

    for (const it of items) {
      await itemsRepo(ctx).insert({
        id:          uuid(),
        purchase_id: id,
        product_id:  it.productId,
        quantity:    it.quantity,
        unit_cost:   it.unitCost,
        total_cost:  it.quantity * it.unitCost,
      }, trx);
    }
  });

  await audit.record({ ctx, action: 'purchase.create', entityType: 'purchase', entityId: id, ip: ctx.ip });
  return get(ctx, id);
}

/**
 * Confirma pedido: marca como confirmado, lança entrada de estoque e atualiza custo médio.
 * StockLedger.createMovement gerencia sua própria transação interna.
 */
async function confirm(ctx, id) {
  const purchase = await get(ctx, id);
  if (purchase.status !== 'draft') throw Errors.validation('Só pedidos em rascunho podem ser confirmados');

  await repo(ctx).updateById(id, { status: 'confirmed' });

  for (const item of purchase.items) {
    const balBefore = await balanceRepo(ctx).query().where('stock_balance.product_id', item.product_id).first();
    const prevQty   = balBefore ? Number(balBefore.current_stock) : 0;
    const prodRow   = await productsRepo(ctx).findById(item.product_id);
    const prevCost  = prodRow ? Number(prodRow.cost_price) : 0;

    await StockLedger.createMovement(knex, ctx, {
      productId:  item.product_id,
      type:       'entry',
      quantity:   item.quantity,
      reason:     `Compra #${purchase.number}`,
      supplier:   purchase.supplier_name || undefined,
      invoiceRef: String(purchase.number),
      note:       purchase.notes || undefined,
    });

    const newCost = prevQty <= 0
      ? item.unit_cost
      : (prevQty * prevCost + item.quantity * item.unit_cost) / (prevQty + item.quantity);
    await productsRepo(ctx).updateById(item.product_id, { cost_price: Math.round(newCost * 100) / 100 });
  }

  await audit.record({ ctx, action: 'purchase.confirm', entityType: 'purchase', entityId: id, ip: ctx.ip });
  return get(ctx, id);
}

async function cancel(ctx, id) {
  const purchase = await repo(ctx).findById(id);
  if (!purchase) throw Errors.notFound('Pedido de compra não encontrado');
  if (purchase.status === 'confirmed') throw Errors.validation('Pedidos confirmados não podem ser cancelados');
  await repo(ctx).updateById(id, { status: 'cancelled' });
  await audit.record({ ctx, action: 'purchase.cancel', entityType: 'purchase', entityId: id, ip: ctx.ip });
  return get(ctx, id);
}

module.exports = { list, get, create, confirm, cancel };
