'use strict';

const service       = require('./dashboard.service');
const alertsService = require('./alerts.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { ROLES } = require('@distok/shared');

/** Dashboard do tenant (arch §9.8). */
module.exports = async function dashboardRoutes(app) {
  app.get('/summary', { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] }, async (req) => {
    req.ctx.ip = req.ip;
    return service.summary(req.ctx);
  });

  app.get('/alerts', { preHandler: [authenticate, requireRole(ROLES.ADMIN, ROLES.OPERATOR)] }, async (req) => {
    return alertsService.alerts(req.ctx);
  });
};
