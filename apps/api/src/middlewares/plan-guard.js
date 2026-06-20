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

async function assertCanAddUser(tenantId) {
  const plan = await getTenantPlan(tenantId);
  if (!plan || plan.max_users == null) return; // ilimitado
  const { c } = await knex('users')
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

async function assertCanAddProduct(tenantId) {
  const plan = await getTenantPlan(tenantId);
  if (!plan || plan.max_products == null) return; // ilimitado
  const { c } = await knex('products')
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
