'use strict';

/**
 * Permite múltiplos caixas simultâneos por tenant (um por operador). A coluna gerada
 * `open_lock` só é não-nula quando status='open'; a constraint única em
 * (tenant_id, open_lock) impede — no próprio banco, sem lock de aplicação — que o
 * mesmo usuário abra dois caixas ao mesmo tempo, mesmo sob concorrência (duplo clique,
 * duas abas). Sessões fechadas não colidem (MySQL trata múltiplos NULLs como distintos
 * em índice único).
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE cashier_sessions
      ADD COLUMN open_lock CHAR(36)
        GENERATED ALWAYS AS (CASE WHEN status = 'open' THEN user_id ELSE NULL END) STORED,
      ADD UNIQUE KEY uq_cashier_open_per_user (tenant_id, open_lock);
  `);
};

exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE cashier_sessions DROP KEY uq_cashier_open_per_user, DROP COLUMN open_lock');
};
