'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');

function repo(ctx) { return new TenantScopedRepository(knex, 'financial_entries', ctx); }

async function list(ctx, { type, status, dateFrom, dateTo, page = 1, limit = 50 }) {
  const base = () => {
    const q = repo(ctx).query()
      .leftJoin('suppliers', 'suppliers.id', 'financial_entries.supplier_id')
      .leftJoin('customers', 'customers.id', 'financial_entries.customer_id')
      .select(
        'financial_entries.*',
        'suppliers.name as supplier_name',
        'customers.name as customer_name'
      );
    if (type)     q.where('financial_entries.type', type);
    if (status)   q.where('financial_entries.status', status);
    if (dateFrom) q.where('financial_entries.due_date', '>=', dateFrom);
    if (dateTo)   q.where('financial_entries.due_date', '<=', dateTo);
    return q;
  };
  const countRow = await base().count({ c: '*' }).first();
  const total    = Number(countRow?.c ?? 0);
  const items    = await base().orderBy('financial_entries.due_date', 'asc').limit(limit).offset((page - 1) * limit);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function get(ctx, id) {
  const row = await repo(ctx).query()
    .leftJoin('suppliers', 'suppliers.id', 'financial_entries.supplier_id')
    .leftJoin('customers', 'customers.id', 'financial_entries.customer_id')
    .select('financial_entries.*', 'suppliers.name as supplier_name', 'customers.name as customer_name')
    .where('financial_entries.id', id)
    .first();
  if (!row) throw Errors.notFound('Lançamento financeiro não encontrado');
  return row;
}

async function create(ctx, body) {
  const { type, description, amount, dueDate, category, supplierId, customerId, saleId, purchaseId, notes } = body;
  if (!['receivable', 'payable'].includes(type)) throw Errors.validation('Tipo inválido');
  if (!description?.trim()) throw Errors.validation('Descrição é obrigatória');
  if (!(amount > 0))        throw Errors.validation('Valor deve ser maior que zero');
  if (!dueDate)             throw Errors.validation('Data de vencimento é obrigatória');
  const id = uuid();
  await repo(ctx).insert({
    id, user_id: ctx.userId, type, description: description.trim(), amount, due_date: dueDate,
    category: category?.trim() || null,
    supplier_id: supplierId || null, customer_id: customerId || null,
    sale_id: saleId || null, purchase_id: purchaseId || null,
    notes: notes?.trim() || null,
  });
  await audit.record({ ctx, action: 'financial.create', entityType: 'financial_entry', entityId: id, ip: ctx.ip });
  return get(ctx, id);
}

async function markPaid(ctx, id, { paidAt, paidAmount }) {
  const entry = await repo(ctx).findById(id);
  if (!entry) throw Errors.notFound('Lançamento financeiro não encontrado');
  if (entry.status === 'paid')      throw Errors.conflict('Lançamento já foi marcado como pago');
  if (entry.status === 'cancelled') throw Errors.conflict('Lançamento está cancelado');
  const before = { ...entry };
  await repo(ctx).updateById(id, {
    status: 'paid',
    paid_at:     paidAt     || new Date().toISOString().slice(0, 10),
    paid_amount: paidAmount || entry.amount,
  });
  await audit.record({ ctx, action: 'financial.paid', entityType: 'financial_entry', entityId: id, before, ip: ctx.ip });
  return get(ctx, id);
}

async function cancel(ctx, id) {
  const entry = await repo(ctx).findById(id);
  if (!entry) throw Errors.notFound('Lançamento financeiro não encontrado');
  if (entry.status === 'cancelled') throw Errors.conflict('Lançamento já está cancelado');
  if (entry.status === 'paid')      throw Errors.conflict('Lançamentos pagos não podem ser cancelados');
  const before = { ...entry };
  await repo(ctx).updateById(id, { status: 'cancelled' });
  await audit.record({ ctx, action: 'financial.cancel', entityType: 'financial_entry', entityId: id, before, ip: ctx.ip });
  return get(ctx, id);
}

async function cashflow(ctx, { year, month }) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`;
  const rows = await repo(ctx).query()
    .select('financial_entries.type', 'financial_entries.status', 'financial_entries.due_date', 'financial_entries.amount', 'financial_entries.paid_amount')
    .where('financial_entries.due_date', '>=', startDate)
    .where('financial_entries.due_date', '<=', endDate)
    .orderBy('financial_entries.due_date', 'asc');

  const totalReceivable = rows.filter((r) => r.type === 'receivable' && r.status !== 'cancelled').reduce((s, r) => s + Number(r.amount), 0);
  const totalPayable    = rows.filter((r) => r.type === 'payable'    && r.status !== 'cancelled').reduce((s, r) => s + Number(r.amount), 0);
  const totalReceived   = rows.filter((r) => r.type === 'receivable' && r.status === 'paid').reduce((s, r) => s + Number(r.paid_amount || r.amount), 0);
  const totalPaid       = rows.filter((r) => r.type === 'payable'    && r.status === 'paid').reduce((s, r) => s + Number(r.paid_amount || r.amount), 0);
  const overdue = rows.filter((r) => r.status === 'pending' && new Date(r.due_date) < new Date());

  return { totalReceivable, totalPayable, totalReceived, totalPaid, balance: totalReceivable - totalPayable, entries: rows, overdue };
}

module.exports = { list, get, create, markPaid, cancel, cashflow };
