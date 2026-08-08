'use strict';

/**
 * trial_ends_at só é setado no signup público (self-service) — tenants criados via
 * POST /admin/tenants (super_admin) continuam sem trial. Nenhuma enforcement de expiração
 * nesta leva, é só o campo pra sustentar a ideia de cobrança futura (Stripe).
 */
exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE tenants ADD COLUMN trial_ends_at TIMESTAMP NULL');
};

exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE tenants DROP COLUMN trial_ends_at');
};
