'use strict';

const service = require('./purchases.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

module.exports = async function purchasesRoutes(app) {
  const authed    = { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] };
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  app.get('/', authed, async (req) => {
    req.ctx.ip = req.ip;
    const { status, supplierId, page } = req.query;
    return service.list(req.ctx, { status, supplierId, page: page ? Number(page) : 1 });
  });

  app.get('/:id', authed, async (req) => {
    req.ctx.ip = req.ip;
    return service.get(req.ctx, req.params.id);
  });

  app.post('/', {
    ...authed,
    schema: {
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          supplierId:  { type: 'string' },
          notes:       { type: 'string' },
          purchasedAt: { type: 'string' },
          items: {
            type: 'array', minItems: 1,
            items: {
              type: 'object', required: ['productId', 'quantity', 'unitCost'],
              properties: {
                productId: { type: 'string' },
                quantity:  { type: 'number', minimum: 1 },
                unitCost:  { type: 'number', minimum: 0 },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    req.ctx.ip = req.ip;
    const out = await service.create(req.ctx, req.body);
    return reply.status(201).send(out);
  });

  app.patch('/:id/confirm', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.confirm(req.ctx, req.params.id);
  });

  app.patch('/:id/cancel', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.cancel(req.ctx, req.params.id);
  });
};
