'use strict';

const knex = require('../db/knex');
const { Errors } = require('../core/errors');
const { USER_STATUS, PRODUCT_STATUS } = require('@distok/shared');

/**
 * Enforcement de limites de plano NO BACKEND (FR20, FR25) — não só na UI.
 * Lê o plano do tenant e compara com a contagem atual.
 */
async function getTenantPlan(tenantId) {
  const row = await knex('tenants')
    .join('plans', 'plans.id', 'tenants.plan_id')
    .where('tenants.id', tenantId)
    .select('plans.*')
    .first();
  if (row && typeof row.features === 'string') {
    try { row.features = JSON.parse(row.features); } catch { row.features = {}; }
  }
  return row;
}

/**
 * @param {string} tenantId
 * @param {import('knex').Knex.Transaction} [trx] Quando informado, trava a linha do
 *   tenant (FOR UPDATE) antes de contar — serializa checagens concorrentes do mesmo
 *   tenant. O insert que decorre da checagem PRECISA acontecer dentro dessa mesma trx,
 *   senão o lock não fecha a corrida (dois clientes podem passar na contagem antes de
 *   qualquer um commitar). Sem trx, mantém o comportamento antigo (checagem otimista).
 */
async function assertCanAddUser(tenantId, trx) {
  const plan = await getTenantPlan(tenantId);
  if (!plan || plan.max_users == null) return; // ilimitado
  const db = trx || knex;
  if (trx) await trx('tenants').where({ id: tenantId }).forUpdate().first();
  const { c } = await db('users')
    .where({ tenant_id: tenantId, status: USER_STATUS.ACTIVE })
    .count({ c: '*' })
    .first();
  if (Number(c) >= plan.max_users) {
    throw Errors.planLimit(
      `Limite de ${plan.max_users} usuários do plano ${plan.name} atingido.`,
      { limit: plan.max_users, resource: 'users' }
    );
  }
}

async function assertCanAddProduct(tenantId, trx) {
  const plan = await getTenantPlan(tenantId);
  if (!plan || plan.max_products == null) return; // ilimitado
  const db = trx || knex;
  if (trx) await trx('tenants').where({ id: tenantId }).forUpdate().first();
  const { c } = await db('products')
    .where({ tenant_id: tenantId, status: PRODUCT_STATUS.ACTIVE })
    .count({ c: '*' })
    .first();
  if (Number(c) >= plan.max_products) {
    throw Errors.planLimit(
      `Limite de ${plan.max_products} produtos do plano ${plan.name} atingido.`,
      { limit: plan.max_products, resource: 'products' }
    );
  }
}

/** Verifica se uma feature está habilitada no plano (ex.: 'csv', 'terminology'). */
async function hasFeature(tenantId, feature) {
  const plan = await getTenantPlan(tenantId);
  return !!(plan && plan.features && plan.features[feature]);
}

module.exports = { getTenantPlan, assertCanAddUser, assertCanAddProduct, hasFeature };
