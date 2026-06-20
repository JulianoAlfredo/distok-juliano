'use strict';

const knex = require('../../db/knex');
const { resolveTenant } = require('../../middlewares/tenant-resolver');
const { DEFAULT_BRANDING, DEFAULT_TERMINOLOGY } = require('@distok/shared');

/**
 * Tema público para a tela de login (arch §6/§7, FR10/FR13).
 * Sem autenticação — retorna branding mínimo + terminologia, com fallback DISTOK.
 */
module.exports = async function brandingPublicRoutes(app) {
  app.get('/tenant-theme', {
    schema: {
      querystring: {
        type: 'object',
        properties: { slug: { type: 'string' }, tenant: { type: 'string' } },
      },
    },
  }, async (req) => {
    const tenant = await resolveTenant(req);
    if (!tenant) {
      // fallback marca DISTOK
      return { tenant: null, branding: DEFAULT_BRANDING, terminology: DEFAULT_TERMINOLOGY };
    }
    const branding = await knex('tenant_branding').where({ tenant_id: tenant.id }).first();
    const termsRows = await knex('tenant_terminology').where({ tenant_id: tenant.id });
    const terminology = { ...DEFAULT_TERMINOLOGY };
    for (const r of termsRows) terminology[r.term_key] = r.term_value;

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status },
      branding: { ...DEFAULT_BRANDING, ...(branding || {}) },
      terminology,
    };
  });
};
