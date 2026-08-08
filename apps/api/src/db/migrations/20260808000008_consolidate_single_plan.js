'use strict';

const { v4: uuid } = require('uuid');

/**
 * Consolida o modelo de planos em 1 único plano (R$39,90/mês, tudo que o DISTOK oferece hoje
 * — sem limite de usuários/produtos, todas as features ligadas). Repontua os tenants
 * existentes pra ele e remove os planos antigos (básico/pro) — pré-lançamento, sem clientes
 * pagantes reais ainda, então não há histórico de cobrança a preservar.
 *
 * down() não reconstrói a atribuição original de plano por tenant (informação perdida por
 * design desta migration) — recria basic/pro só pra manter a FK de tenants.plan_id válida e
 * repontua tudo pra 'basic' como fallback seguro, não uma restauração fiel.
 */
exports.up = async function up(knex) {
  const existingStandard = await knex('plans').where({ code: 'standard' }).first();
  const standardId = existingStandard ? existingStandard.id : uuid();

  if (!existingStandard) {
    await knex('plans').insert({
      id: standardId,
      code: 'standard',
      name: 'DISTOK',
      price_cents: 3990,
      max_users: null,
      max_products: null,
      features: JSON.stringify({ csv: true, customDomain: true, terminology: true, reportFooter: true }),
    });
  }

  await knex('tenants').update({ plan_id: standardId });
  await knex('plans').whereIn('code', ['basic', 'pro']).del();
};

exports.down = async function down(knex) {
  const basicId = uuid();
  await knex('plans').insert({
    id: basicId,
    code: 'basic',
    name: 'Básico',
    price_cents: 7990,
    max_users: 3,
    max_products: 200,
    features: JSON.stringify({ csv: false, customDomain: false, terminology: false, reportFooter: false }),
  });
  await knex('tenants').update({ plan_id: basicId });
  await knex('plans').where({ code: 'standard' }).del();
};
