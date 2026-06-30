'use strict';

const service = require('./catalog.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

module.exports = async function catalogRoutes(app) {
  const authed    = { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] };
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  // ── Categorias ──────────────────────────────────────────────────────────────
  app.get('/categories', authed, async (req) => service.listCategories(req.ctx));

  app.post('/categories', {
    ...adminOnly,
    schema: { body: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 100 } } } },
  }, async (req, reply) => {
    req.ctx.ip = req.ip;
    const out = await service.createCategory(req.ctx, req.body);
    return reply.status(201).send(out);
  });

  app.delete('/categories/:id', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.deleteCategory(req.ctx, req.params.id);
  });

  // ── Unidades ─────────────────────────────────────────────────────────────────
  app.get('/units', authed, async (req) => service.listUnits(req.ctx));

  app.post('/units', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object', required: ['name', 'symbol'],
        properties: { name: { type: 'string', minLength: 1, maxLength: 50 }, symbol: { type: 'string', minLength: 1, maxLength: 10 } },
      },
    },
  }, async (req, reply) => {
    req.ctx.ip = req.ip;
    const out = await service.createUnit(req.ctx, req.body);
    return reply.status(201).send(out);
  });

  app.delete('/units/:id', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.deleteUnit(req.ctx, req.params.id);
  });
};
