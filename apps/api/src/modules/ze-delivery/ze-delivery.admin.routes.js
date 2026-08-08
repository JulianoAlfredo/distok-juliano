'use strict';

const service = require('./ze-delivery.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

/** Rotas de configuração da integração Zé Delivery — autoatendimento do admin do tenant. */
module.exports = async function zeDeliveryAdminRoutes(app) {
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  app.get('/', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.getCredentials(req.ctx);
  });

  app.put('/', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          environment: { type: 'string', enum: ['production', 'sandbox'] },
          client_id: { type: 'string', minLength: 1 },
          client_secret: { type: 'string', minLength: 1 },
          merchant_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req) => {
    req.ctx.ip = req.ip;
    return service.upsertCredentials(req.ctx, req.body);
  });

  app.post('/test-connection', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          environment: { type: 'string', enum: ['production', 'sandbox'] },
          client_id: { type: 'string' },
          client_secret: { type: 'string' },
        },
      },
    },
  }, async (req) => {
    req.ctx.ip = req.ip;
    return service.testConnection(req.ctx, req.body || {});
  });

  app.post('/import', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.importCatalog(req.ctx);
  });

  app.get('/orders', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    const { status, dateFrom, dateTo, page } = req.query;
    return service.listOrders(req.ctx, { status, dateFrom, dateTo, page: page ? Number(page) : 1 });
  });

  app.get('/status', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.getStatus(req.ctx);
  });
};
