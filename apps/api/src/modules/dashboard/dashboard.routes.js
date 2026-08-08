'use strict';

const service       = require('./dashboard.service');
const alertsService = require('./alerts.service');
const drilldown     = require('./drilldown.service');
const trends        = require('./trends.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

// Propriedades de paginação comuns a todo endpoint de lista de drill-down.
// limit não tem `maximum` no schema de propósito: acima de 100 é clamp no
// service (não erro) — ver drilldown.service.js normLimit().
const pageQS  = { type: 'integer', minimum: 1 };
const limitQS = { type: 'integer', minimum: 1 };

/** Dashboard do tenant (arch §9.8). */
module.exports = async function dashboardRoutes(app) {
  const authed = { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] };

  app.get('/summary', { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] }, async (req) => {
    req.ctx.ip = req.ip;
    return service.summary(req.ctx);
  });

  app.get('/alerts', { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] }, async (req) => {
    return alertsService.alerts(req.ctx);
  });

  // -------------------------------------------------------------------
  // Drill-downs (FR41 — modais de detalhe por card do dashboard).
  // 100% leitura: nenhum insert/update/delete, nenhum audit.record.
  // -------------------------------------------------------------------

  app.get('/drilldown/out-of-stock', {
    ...authed,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          category: { type: 'string' },
          page: pageQS,
          limit: limitQS,
        },
      },
    },
  }, async (req) => drilldown.outOfStock(req.ctx, req.query));

  app.get('/drilldown/below-min', {
    ...authed,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          category: { type: 'string' },
          page: pageQS,
          limit: limitQS,
        },
      },
    },
  }, async (req) => drilldown.belowMin(req.ctx, req.query));

  app.get('/drilldown/sales', {
    ...authed,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'month', 'custom'], default: 'today' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          search: { type: 'string' },
          paymentMethod: { type: 'string' },
          includeCancelled: { type: 'boolean', default: false },
          page: pageQS,
          limit: limitQS,
        },
      },
    },
  }, async (req) => drilldown.sales(req.ctx, req.query));

  app.get('/drilldown/financial', {
    ...authed,
    schema: {
      querystring: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['receivable', 'payable'] },
          situation: { type: 'string', enum: ['pending', 'overdue', 'upcoming', 'paid', 'all'], default: 'pending' },
          search: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          includeCancelled: { type: 'boolean', default: false },
          page: pageQS,
          limit: limitQS,
        },
      },
    },
  }, async (req) => drilldown.financial(req.ctx, req.query));

  app.get('/drilldown/stock-value', {
    ...authed,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          category: { type: 'string' },
          sort: { type: 'string', enum: ['value', 'name', 'qty'], default: 'value' },
          dir: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          page: pageQS,
          limit: limitQS,
        },
      },
    },
  }, async (req) => drilldown.stockValue(req.ctx, req.query));

  // -------------------------------------------------------------------
  // Tendências (séries temporais para gráficos do dashboard).
  // -------------------------------------------------------------------

  app.get('/trends/movements', {
    ...authed,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 90, default: 7 },
        },
      },
    },
  }, async (req) => trends.movements(req.ctx, req.query));

  app.get('/trends/revenue', {
    ...authed,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 90, default: 30 },
        },
      },
    },
  }, async (req) => trends.revenue(req.ctx, req.query));
};
