'use strict';

const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const {
  ROLES,
  TENANT_STATUS,
  USER_STATUS,
  PRODUCT_STATUS,
  DEFAULT_PLANS,
  DEFAULT_TERMINOLOGY,
} = require('@distok/shared');

/**
 * Dados de demonstração (Story 1.7).
 * Cria: planos, 1 super admin, 2 tenants (com admin+operador) e produtos.
 * Senha de todos: "distok123" (apenas demo).
 */
exports.seed = async function seed(knex) {
  // limpa em ordem segura de FK
  await knex('stock_balance').del();
  await knex('stock_movements').del();
  await knex('products').del();
  await knex('tenant_terminology').del();
  await knex('tenant_branding').del();
  await knex('users').del();
  await knex('tenants').del();
  await knex('plans').del();

  const hash = await bcrypt.hash('distok123', 10);

  // ---- planos ----
  const planIds = {};
  for (const p of DEFAULT_PLANS) {
    const id = uuid();
    planIds[p.code] = id;
    await knex('plans').insert({
      id,
      code: p.code,
      name: p.name,
      price_cents: p.price_cents,
      max_users: p.max_users,
      max_products: p.max_products,
      features: JSON.stringify(p.features),
    });
  }

  // ---- super admin (sem tenant) ----
  await knex('users').insert({
    id: uuid(),
    tenant_id: null,
    name: 'Super Admin DISTOK',
    email: 'super@distok.com.br',
    password_hash: hash,
    role: ROLES.SUPER_ADMIN,
    status: USER_STATUS.ACTIVE,
  });

  // ---- helper p/ criar tenant completo ----
  async function createTenant({ name, slug, cnpj, planCode, primary }) {
    const tenantId = uuid();
    await knex('tenants').insert({
      id: tenantId,
      name,
      slug,
      cnpj,
      plan_id: planIds[planCode],
      status: TENANT_STATUS.ACTIVE,
    });
    await knex('tenant_branding').insert({
      tenant_id: tenantId,
      display_name: name,
      color_primary: primary,
    });
    for (const [term_key, term_value] of Object.entries(DEFAULT_TERMINOLOGY)) {
      await knex('tenant_terminology').insert({ tenant_id: tenantId, term_key, term_value });
    }
    await knex('users').insert([
      {
        id: uuid(),
        tenant_id: tenantId,
        name: `Admin ${name}`,
        email: `admin@${slug}.com`,
        password_hash: hash,
        role: ROLES.ADMIN,
        role_title: 'Gerente',
        status: USER_STATUS.ACTIVE,
      },
      {
        id: uuid(),
        tenant_id: tenantId,
        name: `Operador ${name}`,
        email: `operador@${slug}.com`,
        password_hash: hash,
        role: ROLES.OPERATOR,
        role_title: 'Estoquista',
        status: USER_STATUS.ACTIVE,
      },
    ]);
    // produtos demo
    const products = [
      { name: 'Cerveja Pilsen 600ml', sku: `${slug}-CRV600`, category: 'cerveja', cost: 4.5, sale: 7.9, min: 24 },
      { name: 'Água Mineral 500ml', sku: `${slug}-AGUA500`, category: 'água', cost: 0.8, sale: 2.0, min: 48 },
      { name: 'Refrigerante 2L', sku: `${slug}-REF2L`, category: 'refrigerante', cost: 5.2, sale: 9.5, min: 12 },
    ];
    for (const p of products) {
      const pid = uuid();
      await knex('products').insert({
        id: pid,
        tenant_id: tenantId,
        name: p.name,
        sku: p.sku,
        category: p.category,
        unit: 'un',
        cost_price: p.cost,
        sale_price: p.sale,
        min_stock: p.min,
        status: PRODUCT_STATUS.ACTIVE,
      });
      await knex('stock_balance').insert({ tenant_id: tenantId, product_id: pid, current_stock: 0 });
    }
    return tenantId;
  }

  await createTenant({ name: 'Distribuidora Bebidas Sul', slug: 'bebidassul', cnpj: '11.111.111/0001-11', planCode: 'pro', primary: '#1B7F3B' });
  await createTenant({ name: 'AtacadãoX', slug: 'atacadaox', cnpj: '22.222.222/0001-22', planCode: 'basic', primary: '#B91C1C' });

  console.log('Seed concluído. Login demo: super@distok.com.br / admin@bebidassul.com / senha: distok123');
};
