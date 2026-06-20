'use strict';

const service = require('./products.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

/** Rotas de produtos (arch §9.4). Admin e Operator podem criar/editar; só Admin inativa. */
module.exports = async function productsRoutes(app) {
  const authed = { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] };
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  const productBody = {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string' },
      category: { type: 'string', maxLength: 100 },
      unit: { type: 'string', maxLength: 50 },
      sku: { type: 'string', maxLength: 100 },
      cost_price: { type: 'number', minimum: 0 },
      sale_price: { type: 'number', minimum: 0 },
      min_stock: { type: 'integer', minimum: 0 },
    },
  };

  app.get('/', authed, async (req) => {
    req.ctx.ip = req.ip;
    const { search, category, status, page } = req.query;
    return service.list(req.ctx, { search, category, status, page: page ? Number(page) : 1 });
  });

  app.get('/:id', authed, async (req) => {
    req.ctx.ip = req.ip;
    return service.get(req.ctx, req.params.id);
  });

  app.post('/', { ...authed, schema: { body: { ...productBody, required: ['name'] } } }, async (req, reply) => {
    req.ctx.ip = req.ip;
    const out = await service.create(req.ctx, req.body);
    return reply.status(201).send(out);
  });

  app.put('/:id', { ...authed, schema: { body: productBody } }, async (req) => {
    req.ctx.ip = req.ip;
    return service.update(req.ctx, req.params.id, req.body);
  });

  app.patch('/:id/inactivate', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.inactivate(req.ctx, req.params.id);
  });
};
