'use strict';

const service = require('./signup.service');

/** Rotas públicas de signup self-service (sem admin nenhum envolvido). */
module.exports = async function signupRoutes(app) {
  // limite apertado — alvo comum de abuso automatizado
  const signupRateLimit = { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } };

  app.post('/signup', {
    ...signupRateLimit,
    schema: {
      body: {
        type: 'object',
        required: ['companyName', 'cnpj', 'adminName', 'adminEmail', 'adminPassword'],
        properties: {
          companyName: { type: 'string', minLength: 2 },
          cnpj: { type: 'string' },
          slug: { type: 'string', pattern: '^[a-z0-9-]{0,63}$' },
          adminName: { type: 'string', minLength: 2 },
          adminEmail: { type: 'string', format: 'email' },
          adminPassword: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
    },
  }, async (req, reply) => {
    const result = await service.signup(req.body);
    return reply.status(201).send(result);
  });

  app.post('/signup/verify', {
    ...signupRateLimit,
    schema: {
      body: {
        type: 'object',
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', minLength: 6, maxLength: 6 },
        },
      },
    },
  }, async (req) => {
    return service.verify({ email: req.body.email, code: req.body.code });
  });

  app.post('/signup/resend-code', {
    ...signupRateLimit,
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
    },
  }, async (req, reply) => {
    await service.resendCode({ email: req.body.email });
    return reply.status(204).send();
  });
};
