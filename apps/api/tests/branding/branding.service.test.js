'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const service = require('../../src/modules/branding/branding.service');
const { ROLES } = require('@distok/shared');

let basicPlan; let proPlan; let tBasic; let tPro;

// Features "desligadas" vs "ligadas" definidas aqui (não a partir de DEFAULT_PLANS) — o que
// este teste exercita é o gating do plan-guard, não o catálogo real de planos do produto
// (hoje só existe 1 plano, com tudo ligado).
before(async () => {
  basicPlan = uuid(); proPlan = uuid(); tBasic = uuid(); tPro = uuid();
  const basicFeatures = { csv: false, customDomain: false, terminology: false, reportFooter: false };
  const proFeatures = { csv: true, customDomain: true, terminology: true, reportFooter: true };
  await knex('plans').insert([
    { id: basicPlan, code: 'basic-t', name: 'Básico', price_cents: 7990, max_users: 3, max_products: 200, features: JSON.stringify(basicFeatures) },
    { id: proPlan, code: 'pro-t', name: 'Pro', price_cents: 14990, max_users: 10, max_products: null, features: JSON.stringify(proFeatures) },
  ]);
  await knex('tenants').insert([
    { id: tBasic, name: 'T Basic', slug: 'tb-' + tBasic.slice(0, 6), cnpj: 'B' + tBasic.slice(0, 12), plan_id: basicPlan },
    { id: tPro, name: 'T Pro', slug: 'tp-' + tPro.slice(0, 6), cnpj: 'P' + tPro.slice(0, 12), plan_id: proPlan },
  ]);
  await knex('tenant_branding').insert([
    { tenant_id: tBasic }, { tenant_id: tPro },
  ]);
});

after(async () => {
  await knex('tenant_terminology').whereIn('tenant_id', [tBasic, tPro]).del();
  await knex('tenant_branding').whereIn('tenant_id', [tBasic, tPro]).del();
  await knex('tenants').whereIn('id', [tBasic, tPro]).del();
  await knex('plans').whereIn('id', [basicPlan, proPlan]).del();
  await knex.destroy();
});

function ctxFor(tenantId) {
  return new TenantContext({ tenantId, userId: uuid(), role: ROLES.ADMIN });
}

test('updateBranding aplica cores válidas', async () => {
  const out = await service.updateBranding(ctxFor(tPro), { color_primary: '#1B7F3B', display_name: 'Verde Co' });
  assert.strictEqual(out.branding.color_primary, '#1B7F3B');
  assert.strictEqual(out.branding.display_name, 'Verde Co');
});

test('updateBranding rejeita cor de baixo contraste (NFR21)', async () => {
  await assert.rejects(
    () => service.updateBranding(ctxFor(tPro), { color_primary: '#777777' }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
});

test('updateBranding rejeita hex inválido', async () => {
  await assert.rejects(
    () => service.updateBranding(ctxFor(tPro), { color_primary: 'verde' }),
    (e) => e.code === 'VALIDATION_ERROR'
  );
});

test('terminologia: BLOQUEADA no plano Básico (FR14)', async () => {
  await assert.rejects(
    () => service.updateTerminology(ctxFor(tBasic), { product: 'Item' }),
    (e) => e.code === 'PLAN_LIMIT_EXCEEDED'
  );
});

test('terminologia: PERMITIDA no plano Pro', async () => {
  const out = await service.updateTerminology(ctxFor(tPro), { product: 'Item', employee: 'Colaborador' });
  assert.strictEqual(out.terminology.product, 'Item');
  assert.strictEqual(out.terminology.employee, 'Colaborador');
});

test('rodapé de relatório bloqueado no Básico, liberado no Pro', async () => {
  await assert.rejects(
    () => service.updateBranding(ctxFor(tBasic), { report_footer: 'Rodapé X' }),
    (e) => e.code === 'PLAN_LIMIT_EXCEEDED'
  );
  const out = await service.updateBranding(ctxFor(tPro), { report_footer: 'Rodapé X' });
  assert.strictEqual(out.branding.report_footer, 'Rodapé X');
});
