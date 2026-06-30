'use strict';

const service = require('./cashier.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

module.exports = async function cashierRoutes(app) {
  const authed    = { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] };
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  app.get('/current', authed, async (req) => {
    req.ctx.ip = req.ip;
    return service.currentSession(req.ctx) || null;
  });

  app.get('/sessions', authed, async (req) => {
    req.ctx.ip = req.ip;
    const { page } = req.query;
    return service.listSessions(req.ctx, { page: page ? Number(page) : 1 });
  });

  app.get('/sessions/:id', authed, async (req) => {
    req.ctx.ip = req.ip;
    return service.getSession(req.ctx, req.params.id);
  });

  app.post('/sessions', {
    ...authed,
    schema: {
      body: {
        type: 'object',
        properties: { openingBalance: { type: 'number', minimum: 0 }, notes: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    req.ctx.ip = req.ip;
    const out = await service.openSession(req.ctx, req.body);
    return reply.status(201).send(out);
  });

  app.patch('/sessions/:id/close', {
    ...adminOnly,
    schema: { body: { type: 'object', properties: { notes: { type: 'string' } } } },
  }, async (req) => {
    req.ctx.ip = req.ip;
    return service.closeSession(req.ctx, req.params.id, req.body || {});
  });

  app.post('/sessions/:id/entries', {
    ...authed,
    schema: {
      body: {
        type: 'object', required: ['type', 'amount', 'description'],
        properties: {
          type:        { type: 'string', enum: ['in', 'out'] },
          amount:      { type: 'number', minimum: 0.01 },
          description: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    req.ctx.ip = req.ip;
    const out = await service.addEntry(req.ctx, req.params.id, req.body);
    return reply.status(201).send(out);
  });
};
