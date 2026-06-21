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
const productsRoutes = require('./modules/products/products.routes');
const usersRoutes = require('./modules/users/users.routes');
const stockRoutes = require('./modules/stock/stock.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

/** Monta a instância Fastify com plugins, middlewares e rotas. */
async function buildApp() {
  const app = Fastify({
    logger: env.isTest ? false : { level: env.isProd ? 'info' : 'debug' },
    trustProxy: true, // Hostinger/Passenger atrás de proxy => req.ip correto
  });

  // Headers de segurança + CSP (permite Google Fonts e estilos inline do app).
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(require('@fastify/cors'), {
    origin: env.isProd ? [env.APP_BASE_URL] : true,
    credentials: true,
  });
  // Rate limit global (anti brute-force/DoS). Rotas sensíveis (/auth) reforçam por rota.
  await app.register(require('@fastify/rate-limit'), { global: true, max: 300, timeWindow: '1 minute' });
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
  app.register(productsRoutes, { prefix: '/api/v1/products' });
  app.register(usersRoutes, { prefix: '/api/v1/users' });
  app.register(stockRoutes, { prefix: '/api/v1/stock' });
  app.register(reportsRoutes, { prefix: '/api/v1/reports' });
  app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  app.register(tenantsRoutes, { prefix: '/api/v1/admin' });
  app.register(plansRoutes, { prefix: '/api/v1/admin' });

  // ---------- Frontend (SPA) servido pelo mesmo app ----------
  // Em produção a API e o front compartilham origem: o build do React
  // (apps/web/dist) é servido na raiz; /api/v1 e /uploads continuam acima.
  // Rotas de navegação do React Router caem no index.html (SPA fallback).
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    await app.register(require('@fastify/static'), {
      root: webDist,
      prefix: '/',
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } });
    });
  }

  return app;
}

module.exports = { buildApp };
