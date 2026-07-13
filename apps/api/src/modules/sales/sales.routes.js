'use strict';

const service = require('./sales.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

module.exports = async function salesRoutes(app) {
  const authed    = { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] };
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  app.get('/', authed, async (req) => {
    req.ctx.ip = req.ip;
    const { status, customerId, page } = req.query;
    return service.list(req.ctx, { status, customerId, page: page ? Number(page) : 1 });
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
          customerId:    { type: 'string' },
          paymentMethod: { type: 'string' },
          payments: {
            type: 'array', minItems: 1,
            items: {
              type: 'object', required: ['method', 'amount'],
              properties: {
                method:         { type: 'string' },
                amount:         { type: 'number', minimum: 0 },
                receivedAmount: { type: 'number', minimum: 0 },
              },
            },
          },
          notes:         { type: 'string' },
          discount:      { type: 'number', minimum: 0 },
          items: {
            type: 'array', minItems: 1,
            items: {
              type: 'object', required: ['productId', 'quantity', 'unitPrice'],
              properties: {
                productId: { type: 'string' },
                quantity:  { type: 'number', minimum: 1 },
                unitPrice: { type: 'number', minimum: 0 },
                discount:  { type: 'number', minimum: 0 },
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

  app.patch('/:id/cancel', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.cancel(req.ctx, req.params.id);
  });
};
