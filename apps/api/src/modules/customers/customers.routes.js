'use strict';

const service = require('./customers.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

module.exports = async function customersRoutes(app) {
  const authed = { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] };
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  const customerBody = {
    type: 'object',
    properties: {
      name:    { type: 'string', minLength: 1, maxLength: 255 },
      email:   { type: 'string', maxLength: 255 },
      phone:   { type: 'string', maxLength: 20 },
      cpf:     { type: 'string', maxLength: 14 },
      cnpj:    { type: 'string', maxLength: 18 },
      address: { type: 'string', maxLength: 255 },
      city:    { type: 'string', maxLength: 100 },
      state:   { type: 'string', maxLength: 2 },
      notes:   { type: 'string' },
    },
  };

  app.get('/', authed, async (req) => {
    req.ctx.ip = req.ip;
    const { search, status, page } = req.query;
    return service.list(req.ctx, { search, status, page: page ? Number(page) : 1 });
  });

  app.get('/:id', authed, async (req) => {
    req.ctx.ip = req.ip;
    return service.get(req.ctx, req.params.id);
  });

  app.post('/', { ...adminOnly, schema: { body: { ...customerBody, required: ['name'] } } }, async (req, reply) => {
    req.ctx.ip = req.ip;
    const out = await service.create(req.ctx, req.body);
    return reply.status(201).send(out);
  });

  app.put('/:id', { ...adminOnly, schema: { body: customerBody } }, async (req) => {
    req.ctx.ip = req.ip;
    return service.update(req.ctx, req.params.id, req.body);
  });

  app.patch('/:id/inactivate', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.inactivate(req.ctx, req.params.id);
  });

  app.patch('/:id/activate', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.activate(req.ctx, req.params.id);
  });

  app.get('/:id/history', adminOnly, async (req) => {
    req.ctx.ip = req.ip;
    return service.history(req.ctx, req.params.id);
  });
};
