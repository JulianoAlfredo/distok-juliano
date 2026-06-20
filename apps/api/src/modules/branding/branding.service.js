'use strict';

const knex = require('../../db/knex');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');
const contrast = require('../../utils/contrast');
const { getTenantPlan } = require('../../middlewares/plan-guard');
const { DEFAULT_BRANDING, DEFAULT_TERMINOLOGY } = require('@distok/shared');

/** Retorna branding + terminologia + features do plano (para a UI saber o que é gated). */
async function getBranding(ctx) {
  const branding = await knex('tenant_branding').where({ tenant_id: ctx.tenantId }).first();
  const termRows = await knex('tenant_terminology').where({ tenant_id: ctx.tenantId });
  const terminology = { ...DEFAULT_TERMINOLOGY };
  for (const r of termRows) terminology[r.term_key] = r.term_value;
  const plan = await getTenantPlan(ctx.tenantId);
  return {
    branding: { ...DEFAULT_BRANDING, ...(branding || {}) },
    terminology,
    plan: plan ? { code: plan.code, name: plan.name, features: plan.features || {} } : null,
  };
}

/** Atualiza cores/nome/rodapé com validação de hex e contraste (NFR21) + gating por plano. */
async function updateBranding(ctx, data) {
  const patch = {};

  // cores: validar hex + legibilidade da primária
  for (const key of ['color_primary', 'color_secondary', 'color_accent']) {
    if (data[key] !== undefined && data[key] !== null) {
      if (!contrast.isHex(data[key])) {
        throw Errors.validation(`Cor inválida em ${key} (use #RRGGBB)`);
      }
      patch[key] = data[key];
    }
  }
  if (patch.color_primary && !contrast.isPrimaryLegible(patch.color_primary)) {
    throw Errors.validation(
      'Essa cor primária deixa o texto difícil de ler. Escolha um tom com mais contraste.',
      { field: 'color_primary', reason: 'low_contrast' }
    );
  }

  if (data.display_name !== undefined) patch.display_name = data.display_name;
  if (data.email_from !== undefined) patch.email_from = data.email_from;

  // rodapé de relatório: feature do plano Pro (FR14)
  if (data.report_footer !== undefined) {
    const plan = await getTenantPlan(ctx.tenantId);
    if (!plan || !plan.features || !plan.features.reportFooter) {
      throw Errors.planLimit('Rodapé personalizado em relatórios está disponível no plano Pro.', {
        feature: 'reportFooter',
      });
    }
    patch.report_footer = data.report_footer;
  }

  if (Object.keys(patch).length === 0) {
    throw Errors.validation('Nada para atualizar');
  }

  const before = await knex('tenant_branding').where({ tenant_id: ctx.tenantId }).first();
  // upsert (caso o tenant não tenha linha de branding ainda)
  if (before) {
    await knex('tenant_branding').where({ tenant_id: ctx.tenantId }).update(patch);
  } else {
    await knex('tenant_branding').insert({ tenant_id: ctx.tenantId, ...patch });
  }
  await audit.record({
    ctx, action: 'branding.update', entityType: 'tenant_branding', entityId: ctx.tenantId,
    before: before || null, after: patch, ip: ctx.ip,
  });

  return getBranding(ctx);
}

/** Atualiza o dicionário de terminologia — gated pela feature 'terminology' (FR11/FR14). */
async function updateTerminology(ctx, terms) {
  const plan = await getTenantPlan(ctx.tenantId);
  if (!plan || !plan.features || !plan.features.terminology) {
    throw Errors.planLimit('Personalização de terminologia está disponível no plano Pro.', {
      feature: 'terminology',
    });
  }
  const allowed = Object.keys(DEFAULT_TERMINOLOGY);
  const entries = Object.entries(terms || {}).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) throw Errors.validation('Nenhum termo válido informado');

  await knex.transaction(async (trx) => {
    for (const [term_key, term_value] of entries) {
      const value = String(term_value).slice(0, 120);
      const exists = await trx('tenant_terminology')
        .where({ tenant_id: ctx.tenantId, term_key })
        .first();
      if (exists) {
        await trx('tenant_terminology').where({ tenant_id: ctx.tenantId, term_key }).update({ term_value: value });
      } else {
        await trx('tenant_terminology').insert({ tenant_id: ctx.tenantId, term_key, term_value: value });
      }
    }
    await audit.record(
      { ctx, action: 'branding.terminology_update', entityType: 'tenant', entityId: ctx.tenantId, after: terms, ip: ctx.ip },
      trx
    );
  });

  return getBranding(ctx);
}

/** Persiste a URL do logo/favicon após upload (chamado pela rota de upload). */
async function setAsset(ctx, field, url) {
  const before = await knex('tenant_branding').where({ tenant_id: ctx.tenantId }).first();
  if (before) {
    await knex('tenant_branding').where({ tenant_id: ctx.tenantId }).update({ [field]: url });
  } else {
    await knex('tenant_branding').insert({ tenant_id: ctx.tenantId, [field]: url });
  }
  await audit.record({ ctx, action: 'branding.asset_update', entityType: 'tenant_branding', entityId: ctx.tenantId, after: { [field]: url }, ip: ctx.ip });
}

module.exports = { getBranding, updateBranding, updateTerminology, setAsset };
