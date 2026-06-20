'use strict';

const Fastify = require('fastify');
const env = require('./config/env');
const knex = require('./db/knex');
const { registerErrorHandler } = require('./middlewares/error-handler');

const path = require('path');
const fs = require('fs');
const authRoutes = require('./modules/auth/auth.routes');
const tenantsRoutes = require('./modules/tenants/tenants.routes');
const plansRoutes = require('./modules/plans/plans.routes');
const brandingPublicRoutes = require('./modules/branding/branding.routes');
const brandingAdminRoutes = require('./modules/branding/branding.admin.routes');

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

  // serve os uploads (logos/favicons) — white-label
  const uploadsRoot = path.resolve(env.uploads.dir);
  fs.mkdirSync(uploadsRoot, { recursive: true });
  await app.register(require('@fastify/static'), {
    root: uploadsRoot,
    prefix: '/uploads/',
    decorateReply: false,
  });

  registerErrorHandler(app);

  // Health check (arch §13)
  app.get('/health', async () => {
    await knex.raw('SELECT 1');
    return { status: 'ok', ts: new Date().toISOString() };
  });

  // Rotas v1
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(brandingPublicRoutes, { prefix: '/api/v1/public' });
  app.register(brandingAdminRoutes, { prefix: '/api/v1/branding' });
  app.register(tenantsRoutes, { prefix: '/api/v1/admin' });
  app.register(plansRoutes, { prefix: '/api/v1/admin' });

  return app;
}

module.exports = { buildApp };
