'use strict';

const service = require('./ze-delivery.service');
const { requireInternalSecret } = require('../../middlewares/internal-auth');

/**
 * Endpoints cron-triggered (chamados por um cron externo, ex.: cron do Hostinger ou um
 * serviço tipo cron-job.org — ver §10 do plano). Fora de /api/v1 de propósito: não é
 * superfície pública, não usa JWT. Protegido por segredo compartilhado (internal-auth).
 */
module.exports = async function zeDeliveryInternalRoutes(app) {
  app.post('/poll', { preHandler: [requireInternalSecret] }, async () => {
    return service.pollAllTenants();
  });

  app.post('/drain-outbox', { preHandler: [requireInternalSecret] }, async () => {
    return service.drainOutbox();
  });
};
