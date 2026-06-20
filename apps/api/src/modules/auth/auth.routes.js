'use strict';

const service = require('./auth.service');
const { authenticate } = require('../../middlewares/auth');

/**
 * Rotas de autenticação (arch §9.1). Plugin Fastify.
 */
module.exports = async function authRoutes(app) {
  // Rate limit específico para /auth/* (NFR7)
  const authRateLimit = {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  };

  app.post('/login', {
    ...authRateLimit,
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
          tenantSlug: { type: 'string' },
        },
      },
    },
  }, async (req) => {
    return service.login({
      email: req.body.email,
      password: req.body.password,
      tenantSlug: req.body.tenantSlug,
      ip: req.ip,
    });
  });

  app.post('/refresh', { preHandler: [authenticate] }, async (req) => {
    return service.refresh(req.ctx);
  });

  app.post('/change-password', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (req, reply) => {
    await service.changePassword({
      ctx: req.ctx,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      ip: req.ip,
    });
    return reply.status(204).send();
  });

  app.post('/forgot', {
    ...authRateLimit,
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          tenantSlug: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    await service.forgot({ email: req.body.email, tenantSlug: req.body.tenantSlug });
    return reply.status(204).send();
  });

  app.post('/reset', {
    ...authRateLimit,
    schema: {
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (req, reply) => {
    await service.reset({ token: req.body.token, newPassword: req.body.newPassword });
    return reply.status(204).send();
  });
};
