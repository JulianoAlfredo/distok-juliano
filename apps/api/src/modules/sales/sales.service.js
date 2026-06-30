'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const StockLedger = require('../../core/StockLedger');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');

function repo(ctx)      { return new TenantScopedRepository(knex, 'sales', ctx); }
function itemsRepo(ctx) { return new TenantScopedRepository(knex, 'sale_items', ctx); }

async function nextNumber(ctx, trx) {
  const row = await repo(ctx).query(trx).max({ m: 'number' }).first();
  return (Number(row?.m) || 0) + 1;
}

async function list(ctx, { status, customerId, page = 1, limit = 25 }) {
  const base = () => {
    const q = repo(ctx).query()
      .leftJoin('customers', 'customers.id', 'sales.customer_id')
      .leftJoin('users', 'users.id', 'sales.user_id')
      .select(
        'sales.id', 'sales.number', 'sales.status', 'sales.total', 'sales.subtotal', 'sales.discount',
        'sales.payment_method', 'sales.sold_at', 'sales.notes',
        'customers.name as customer_name',
        'users.name as user_name'
      );
    if (status)     q.where('sales.status', status);
    if (customerId) q.where('sales.customer_id', customerId);
    return q;
  };
  const countRow = await base().count({ c: '*' }).first();
  const total    = Number(countRow?.c ?? 0);
  const items    = await base().orderBy('sales.sold_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function get(ctx, id) {
  const sale = await repo(ctx).query()
    .leftJoin('customers', 'customers.id', 'sales.customer_id')
    .leftJoin('users', 'users.id', 'sales.user_id')
    .select('sales.*', 'customers.name as customer_name', 'users.name as user_name')
    .where('sales.id', id)
    .first();
  if (!sale) throw Errors.notFound('Venda não encontrada');

  const items = await itemsRepo(ctx).query()
    .join('products', 'products.id', 'sale_items.product_id')
    .select('sale_items.*', 'products.name as product_name', 'products.unit')
    .where('sale_items.sale_id', id);

  return { ...sale, items };
}

/**
 * Cria venda e baixa o estoque imediatamente.
 * items: [{ productId, quantity, unitPrice, discount }]
 */
async function create(ctx, { customerId, paymentMethod, notes, discount: globalDiscount = 0, items }) {
  if (!items || items.length === 0) throw Errors.validation('Informe ao menos um item');

  const productRepo = new TenantScopedRepository(knex, 'products', ctx);
  for (const it of items) {
    const p = await productRepo.findById(it.productId);
    if (!p) throw Errors.notFound(`Produto ${it.productId} não encontrado`);
    if (it.quantity <= 0) throw Errors.validation('Quantidade deve ser maior que zero');
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice - (i.discount || 0), 0);
  const total    = Math.max(0, subtotal - (globalDiscount || 0));
  const id       = uuid();
  let   number;

  await knex.transaction(async (trx) => {
    number = await nextNumber(ctx, trx);
    await repo(ctx).insert({
      id,
      customer_id:    customerId || null,
      user_id:        ctx.userId,
      number,
      status:         'open',
      subtotal,
      discount:       globalDiscount || 0,
      total,
      payment_method: paymentMethod || 'dinheiro',
      notes:          notes || null,
    }, trx);

    for (const it of items) {
      const itTotal = it.quantity * it.unitPrice - (it.discount || 0);
      await itemsRepo(ctx).insert({
        id:         uuid(),
        sale_id:    id,
        product_id: it.productId,
        quantity:   it.quantity,
        unit_price: it.unitPrice,
        discount:   it.discount || 0,
        total:      itTotal,
      }, trx);
    }
  });

  // Baixa de estoque (cada chamada tem sua própria transação no StockLedger)
  for (const it of items) {
    await StockLedger.createMovement(knex, ctx, {
      productId: it.productId,
      type:      'exit',
      quantity:  it.quantity,
      reason:    'venda',
      note:      `Venda #${number}`,
    });
  }

  await audit.record({ ctx, action: 'sale.create', entityType: 'sale', entityId: id, ip: ctx.ip });
  return get(ctx, id);
}

async function cancel(ctx, id) {
  const sale = await get(ctx, id);
  if (sale.status === 'cancelled') throw Errors.validation('Venda já está cancelada');

  for (const it of sale.items) {
    await StockLedger.createMovement(knex, ctx, {
      productId: it.product_id,
      type:      'entry',
      quantity:  it.quantity,
      reason:    `Estorno venda #${sale.number}`,
    });
  }

  await repo(ctx).updateById(id, { status: 'cancelled' });
  await audit.record({ ctx, action: 'sale.cancel', entityType: 'sale', entityId: id, ip: ctx.ip });
  return get(ctx, id);
}

module.exports = { list, get, create, cancel };
