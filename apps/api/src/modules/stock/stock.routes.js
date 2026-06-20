'use strict';

const service = require('./stock.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

/** Rotas de estoque (arch §9.6). */
module.exports = async function stockRoutes(app) {
  const authed = { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] };

  app.post('/movements', {
    ...authed,
    schema: {
      body: {
        type: 'object',
        required: ['productId', 'type', 'quantity'],
        properties: {
          productId: { type: 'string' },
          type: { type: 'string', enum: ['entry', 'exit', 'adjustment'] },
          quantity: { type: 'number', minimum: 0 },
          reason: { type: 'string' },
          batch: { type: 'string' },
          expiresAt: { type: 'string' },
          supplier: { type: 'string' },
          invoiceRef: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    req.ctx.ip = req.ip;
    // ajuste exige admin
    if (req.body.type === 'adjustment' && req.ctx.role !== ROLES.ADMIN) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Apenas Admin pode ajustar estoque' } });
    }
    const out = await service.createMovement(req.ctx, req.body);
    return reply.status(201).send(out);
  });

  app.get('/balance', authed, async (req) => {
    req.ctx.ip = req.ip;
    const { belowMin, category, search, page } = req.query;
    return service.listBalance(req.ctx, {
      belowMin: belowMin === 'true' || belowMin === '1',
      category, search, page: page ? Number(page) : 1,
    });
  });

  app.get('/products/:id/movements', authed, async (req) => {
    req.ctx.ip = req.ip;
    const { page } = req.query;
    return service.listMovements(req.ctx, req.params.id, { page: page ? Number(page) : 1 });
  });
};
