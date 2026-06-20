'use strict';

const service = require('./reports.service');
const { toCSV } = require('../../utils/csv');
const { toPDF } = require('../../utils/pdf');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { hasFeature } = require('../../middlewares/plan-guard');
const { Errors } = require('../../core/errors');
const { ROLES } = require('@distok/shared');

const DIACRITICS = new RegExp('[̀-ͯ]', 'g');
const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(DIACRITICS, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Rotas de relatórios (arch §9.7) — Admin do tenant. */
module.exports = async function reportsRoutes(app) {
  const adminOnly = { preHandler: [authenticate, requireRole(ROLES.ADMIN)] };

  async function deliver(req, reply, dataset) {
    const format = (req.query.format || 'pdf').toLowerCase();
    const branding = await service.getBranding(req.ctx);
    const filename = `${slug(dataset.title)}-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      // CSV é feature do plano (FR40)
      const allowed = await hasFeature(req.ctx.tenantId, 'csv');
      if (!allowed) throw Errors.forbidden('Exportação CSV disponível no plano Pro.');
      const csv = toCSV(dataset.columns, dataset.rows);
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return reply.send(csv);
    }

    const pdf = await toPDF({ title: dataset.title, columns: dataset.columns, rows: dataset.rows, branding });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    return reply.send(pdf);
  }

  app.get('/stock-current', adminOnly, async (req, reply) => {
    req.ctx.ip = req.ip;
    return deliver(req, reply, await service.stockCurrent(req.ctx));
  });

  app.get('/movements', adminOnly, async (req, reply) => {
    req.ctx.ip = req.ip;
    const { from, to, productId, userId, type } = req.query;
    return deliver(req, reply, await service.movements(req.ctx, { from, to, productId, userId, type }));
  });

  app.get('/audit', adminOnly, async (req, reply) => {
    req.ctx.ip = req.ip;
    const { from, to } = req.query;
    return deliver(req, reply, await service.audit(req.ctx, { from, to }));
  });

  app.get('/below-min', adminOnly, async (req, reply) => {
    req.ctx.ip = req.ip;
    return deliver(req, reply, await service.belowMin(req.ctx));
  });
};
