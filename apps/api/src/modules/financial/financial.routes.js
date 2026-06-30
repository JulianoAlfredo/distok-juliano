'use strict';

const service = require('./financial.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

module.exports = async function financialRoutes(app) {
  const authed    = { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] };
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  app.get('/', authed, async (req) => {
    req.ctx.ip = req.ip;
    const { type, status, dateFrom, dateTo, page } = req.query;
    return service.list(req.ctx, { type, status, dateFrom, dateTo, page: page ? Number(page) : 1 });
  });

  app.get('/cashflow', authed, async (req) => {
    req.ctx.ip = req.ip;
    const now = new Date();
    const year  = Number(req.query.year  || now.getFullYear());
    const month = Number(req.query.month || (now.getMonth() + 1));
    return service.cashflow(req.ctx, { year, month });
  });

  app.get('/:id', authed, async (req) => {
    req.ctx.ip = req.ip;
    return service.get(req.ctx, req.params.id);
  });

  app.post('/', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object', required: ['type', 'description', 'amount', 'dueDate'],
        properties: {
          type:        { type: 'string', enum: ['receivable', 'payable'] },
          description: { type: 'string', minLength: 1 },
          amount:      { type: 'number', minimum: 0.01 },
          dueDate:     { type: 'string', format: 'date' },
          category:    { type: 'string' },
          supplierId:  { type: 'string' },
          customerId:  { type: 'string' },
          notes:       { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    req.ctx.ip = req.ip;
    return reply.status(201).send(await service.create(req.ctx, req.body));
  });

  app.patch('/:id/pay', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object',
        properties: {
          paidAt:     { type: 'string', format: 'date' },
          paidAmount: { type: 'number', minimum: 0.01 },
        },
      },
    },
  }, async (req) => {
    req.ctx.ip = req.ip;
    return service.markPaid(req.ctx, req.params.id, req.body || {});
  });

  app.patch('/:id/cancel', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.cancel(req.ctx, req.params.id);
  });
};
