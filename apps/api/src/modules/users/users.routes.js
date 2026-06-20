'use strict';

const service = require('./users.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

/** Rotas de funcionários (arch §9.5) — somente Admin do tenant. */
module.exports = async function usersRoutes(app) {
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  app.get('/', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    const { status, page } = req.query;
    return service.list(req.ctx, { status, page: page ? Number(page) : 1 });
  });

  app.post('/', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'role'],
        properties: {
          name: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
          cpf: { type: 'string' },
          role_title: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'operator'] },
        },
      },
    },
  }, async (req, reply) => {
    req.ctx.ip = req.ip;
    const out = await service.create(req.ctx, req.body);
    return reply.status(201).send(out);
  });

  app.put('/:id', {
    ...adminOnly,
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cpf: { type: 'string' },
          role_title: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'operator'] },
        },
      },
    },
  }, async (req) => {
    req.ctx.ip = req.ip;
    return service.update(req.ctx, req.params.id, req.body);
  });

  app.patch('/:id/status', {
    ...adminOnly,
    schema: { body: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['active', 'inactive'] } } } },
  }, async (req) => {
    req.ctx.ip = req.ip;
    return service.setStatus(req.ctx, req.params.id, req.body.status);
  });
};
