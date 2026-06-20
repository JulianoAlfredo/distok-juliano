'use strict';

const Fastify = require('fastify');
const env = require('./config/env');
const knex = require('./db/knex');
const { registerErrorHandler } = require('./middlewares/error-handler');

const authRoutes = require('./modules/auth/auth.routes');
const tenantsRoutes = require('./modules/tenants/tenants.routes');
const plansRoutes = require('./modules/plans/plans.routes');
const brandingPublicRoutes = require('./modules/branding/branding.routes');

/** Monta a instância Fastify com plugins, middlewares e rotas. */
async function buildApp() {
  const app = Fastify({
    logger: env.isTest ? false : { level: env.isProd ? 'info' : 'debug' },
    trustProxy: true, // Hostinger/Passenger atrás de proxy => req.ip correto
  });

  await app.register(require('@fastify/helmet'), { contentSecurityPolicy: false });
  await app.register(require('@fastify/cors'), {
    origin: env.isProd ? [env.APP_BASE_URL] : true,
    credentials: true,
  });
  await app.register(require('@fastify/rate-limit'), { global: false, max: 100, timeWindow: '1 minute' });
  await app.register(require('@fastify/multipart'), { limits: { fileSize: 512 * 1024 } });

  registerErrorHandler(app);

  // Health check (arch §13)
  app.get('/health', async () => {
    await knex.raw('SELECT 1');
    return { status: 'ok', ts: new Date().toISOString() };
  });

  // Rotas v1
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(brandingPublicRoutes, { prefix: '/api/v1/public' });
  app.register(tenantsRoutes, { prefix: '/api/v1/admin' });
  app.register(plansRoutes, { prefix: '/api/v1/admin' });

  return app;
}

module.exports = { buildApp };
