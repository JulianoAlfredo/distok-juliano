'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const service = require('./branding.service');
const { authenticate } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { Errors } = require('../../core/errors');
const env = require('../../config/env');
const { ROLES } = require('@distok/shared');

const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

/** Rotas autenticadas de branding/white-label (arch §9.3). */
module.exports = async function brandingAdminRoutes(app) {
  // leitura: admin e operator podem ver o tema; edição só admin
  app.get('/', { preHandler: [authenticate] }, async (req) => {
    req.ctx.ip = req.ip;
    return service.getBranding(req.ctx);
  });

  app.put('/', {
    preHandler: [authenticate, requireRole(ROLES.ADMIN)],
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          display_name: { type: 'string', maxLength: 120 },
          color_primary: { type: 'string' },
          color_secondary: { type: 'string' },
          color_accent: { type: 'string' },
          email_from: { type: 'string' },
          report_footer: { type: 'string', maxLength: 255 },
        },
      },
    },
  }, async (req) => {
    req.ctx.ip = req.ip;
    return service.updateBranding(req.ctx, req.body);
  });

  app.put('/terminology', {
    preHandler: [authenticate, requireRole(ROLES.ADMIN)],
    schema: {
      body: {
        type: 'object',
        required: ['terms'],
        properties: { terms: { type: 'object' } },
      },
    },
  }, async (req) => {
    req.ctx.ip = req.ip;
    return service.updateTerminology(req.ctx, req.body.terms);
  });

  // upload de logo/favicon (multipart). field = 'logo' | 'favicon'
  app.post('/asset', { preHandler: [authenticate, requireRole(ROLES.ADMIN)] }, async (req) => {
    req.ctx.ip = req.ip;
    const data = await req.file(); // @fastify/multipart
    if (!data) throw Errors.validation('Arquivo ausente');

    const ext = MIME_EXT[data.mimetype];
    if (!ext) {
      // descarta o stream para não vazar
      await data.toBuffer().catch(() => {});
      throw Errors.validation('Formato inválido. Use PNG, JPG, WEBP, SVG ou ICO.');
    }

    const fieldName = (data.fields && data.fields.field && data.fields.field.value) || 'logo';
    const dbField = fieldName === 'favicon' ? 'favicon_url' : 'logo_url';

    const buffer = await data.toBuffer(); // respeita limite de 512KB do multipart
    if (buffer.length > 512 * 1024) throw Errors.validation('Arquivo acima de 512KB');

    const dir = path.join(env.uploads.dir, req.ctx.tenantId);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${dbField}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const url = `${env.uploads.publicUrl}/${req.ctx.tenantId}/${filename}`;
    await service.setAsset(req.ctx, dbField, url);
    return { [dbField]: url };
  });
};
