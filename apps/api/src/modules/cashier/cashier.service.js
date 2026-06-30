'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');

function sessRepo(ctx)  { return new TenantScopedRepository(knex, 'cashier_sessions', ctx); }
function entRepo(ctx)   { return new TenantScopedRepository(knex, 'cashier_entries', ctx); }

async function currentSession(ctx) {
  return sessRepo(ctx).query().where('cashier_sessions.status', 'open').orderBy('cashier_sessions.opened_at', 'desc').first();
}

async function openSession(ctx, { openingBalance = 0, notes }) {
  const existing = await currentSession(ctx);
  if (existing) throw Errors.conflict('Já existe um caixa aberto. Feche-o antes de abrir um novo.');
  const id = uuid();
  await sessRepo(ctx).insert({ id, user_id: ctx.userId, opening_balance: openingBalance, notes: notes || null });
  await audit.record({ ctx, action: 'cashier.open', entityType: 'cashier_session', entityId: id, ip: ctx.ip });
  return getSession(ctx, id);
}

async function getSession(ctx, id) {
  const session = await sessRepo(ctx).query()
    .leftJoin('users', 'users.id', 'cashier_sessions.user_id')
    .select('cashier_sessions.*', 'users.name as user_name')
    .where('cashier_sessions.id', id)
    .first();
  if (!session) throw Errors.notFound('Sessão de caixa não encontrada');
  const entries = await entRepo(ctx).query()
    .leftJoin('users', 'users.id', 'cashier_entries.user_id')
    .select('cashier_entries.*', 'users.name as user_name')
    .where('cashier_entries.session_id', id)
    .orderBy('cashier_entries.created_at', 'asc');
  const totalIn  = entries.filter((e) => e.type === 'in') .reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = entries.filter((e) => e.type === 'out').reduce((s, e) => s + Number(e.amount), 0);
  const balance  = Number(session.opening_balance) + totalIn - totalOut;
  return { ...session, entries, total_in: totalIn, total_out: totalOut, current_balance: balance };
}

async function closeSession(ctx, id, { notes }) {
  const session = await sessRepo(ctx).findById(id);
  if (!session) throw Errors.notFound('Sessão de caixa não encontrada');
  if (session.status === 'closed') throw Errors.conflict('Este caixa já foi fechado');
  const detail = await getSession(ctx, id);
  await sessRepo(ctx).updateById(id, {
    status: 'closed',
    closed_at: knex.fn.now(),
    closing_balance: detail.current_balance,
    notes: notes || session.notes,
  });
  await audit.record({ ctx, action: 'cashier.close', entityType: 'cashier_session', entityId: id, ip: ctx.ip });
  return getSession(ctx, id);
}

async function addEntry(ctx, sessionId, { type, amount, description }) {
  if (!['in', 'out'].includes(type)) throw Errors.validation('Tipo inválido');
  if (Number(amount) <= 0)           throw Errors.validation('Valor deve ser maior que zero');
  if (!description || !description.trim()) throw Errors.validation('Informe uma descrição');
  const session = await sessRepo(ctx).findById(sessionId);
  if (!session) throw Errors.notFound('Sessão de caixa não encontrada');
  if (session.status === 'closed') throw Errors.conflict('O caixa está fechado');
  const id = uuid();
  await entRepo(ctx).insert({ id, session_id: sessionId, user_id: ctx.userId, type, amount, description: description.trim() });
  await audit.record({ ctx, action: `cashier.${type}`, entityType: 'cashier_entry', entityId: id, ip: ctx.ip });
  return getSession(ctx, sessionId);
}

async function listSessions(ctx, { page = 1, limit = 20 }) {
  const base = () => sessRepo(ctx).query()
    .leftJoin('users', 'users.id', 'cashier_sessions.user_id')
    .select('cashier_sessions.*', 'users.name as user_name');
  const countRow = await base().count({ c: '*' }).first();
  const total    = Number(countRow?.c ?? 0);
  const items    = await base().orderBy('cashier_sessions.opened_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { currentSession, openSession, getSession, closeSession, addEntry, listSessions };
