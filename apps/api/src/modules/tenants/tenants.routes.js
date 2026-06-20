'use strict';

const service = require('./tenants.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

/** Rotas do Super Admin para gestão de tenants (arch §9.2). */
module.exports = async function tenantsRoutes(app) {
  const superOnly = { preHandler: [authenticate, requireRole(ROLES.SUPER_ADMIN)] };

  app.get('/tenants', superOnly, async (req) => {
    const { status, plan, page } = req.query;
    return service.listTenants({ status, plan, page: page ? Number(page) : 1 });
  });

  app.post('/tenants', {
    ...superOnly,
    schema: {
      body: {
        type: 'object',
        required: ['name', 'cnpj', 'slug', 'planCode', 'adminName', 'adminEmail'],
        properties: {
          name: { type: 'string', minLength: 2 },
          cnpj: { type: 'string' },
          slug: { type: 'string', pattern: '^[a-z0-9-]{2,63}$' },
          address: { type: 'string' },
          planCode: { type: 'string', enum: ['basic', 'pro'] },
          adminName: { type: 'string', minLength: 2 },
          adminEmail: { type: 'string', format: 'email' },
        },
      },
    },
  }, async (req, reply) => {
    const result = await service.createTenant({ ctx: req.ctx, ip: req.ip, ...req.body });
    return reply.status(201).send(result);
  });

  app.patch('/tenants/:id/status', {
    ...superOnly,
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['active', 'inactive', 'suspended'] } },
      },
    },
  }, async (req) => {
    return service.updateStatus({ ctx: req.ctx, tenantId: req.params.id, status: req.body.status, ip: req.ip });
  });

  app.post('/tenants/:id/reset-admin-password', superOnly, async (req, reply) => {
    await service.resetAdminPassword({ ctx: req.ctx, tenantId: req.params.id, ip: req.ip });
    return reply.status(204).send();
  });

  app.get('/metrics', superOnly, async () => {
    return service.metrics();
  });
};
