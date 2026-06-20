'use strict';

const knex = require('../../db/knex');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

function parseFeatures(row) {
  if (row && typeof row.features === 'string') {
    try { row.features = JSON.parse(row.features); } catch { row.features = {}; }
  }
  return row;
}

/** Rotas de planos (arch §9.2) — Super Admin. */
module.exports = async function plansRoutes(app) {
  const superOnly = { preHandler: [authenticate, requireRole(ROLES.SUPER_ADMIN)] };

  app.get('/plans', superOnly, async () => {
    const rows = await knex('plans').orderBy('price_cents', 'asc');
    return rows.map(parseFeatures);
  });

  app.patch('/plans/:id', {
    ...superOnly,
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price_cents: { type: 'integer', minimum: 0 },
          max_users: { type: ['integer', 'null'] },
          max_products: { type: ['integer', 'null'] },
          features: { type: 'object' },
        },
      },
    },
  }, async (req) => {
    const patch = { ...req.body };
    if (patch.features) patch.features = JSON.stringify(patch.features);
    await knex('plans').where({ id: req.params.id }).update(patch);
    const row = await knex('plans').where({ id: req.params.id }).first();
    return parseFeatures(row);
  });
};
