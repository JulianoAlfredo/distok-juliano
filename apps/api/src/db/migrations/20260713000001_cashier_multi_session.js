'use strict';

/**
 * Permite múltiplos caixas simultâneos por tenant (um por operador). `open_lock` só é
 * não-nula quando status='open'; a constraint única em (tenant_id, open_lock) impede —
 * no próprio banco, sem lock de aplicação — que o mesmo usuário abra dois caixas ao
 * mesmo tempo, mesmo sob concorrência (duplo clique, duas abas). Sessões fechadas não
 * colidem (MySQL/MariaDB tratam múltiplos NULLs como distintos em índice único).
 *
 * `open_lock` é uma coluna comum (não GENERATED): o MariaDB da Hostinger (11.8.8)
 * rejeita qualquer função/expressão (CASE, IF, CONCAT...) aplicada a colunas CHAR(36)
 * dentro de GENERATED ALWAYS AS. O valor é mantido pela aplicação em
 * cashier.service.js (openSession/closeSession).
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE cashier_sessions
      ADD COLUMN open_lock CHAR(36) NULL,
      ADD UNIQUE KEY uq_cashier_open_per_user (tenant_id, open_lock);
  `);
  await knex.raw(`
    UPDATE cashier_sessions SET open_lock = CASE WHEN status = 'open' THEN user_id ELSE NULL END
  `);
};

exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE cashier_sessions DROP KEY uq_cashier_open_per_user, DROP COLUMN open_lock');
};
