'use strict';

/**
 * Tabela genérica de códigos de confirmação por e-mail (6 dígitos), reutilizada por mais de
 * um fluxo (troca de e-mail, verificação de signup) em vez de duplicar o padrão de
 * password_resets pra cada um. Único ponto de acesso: apps/api/src/core/VerificationCodes.js.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE account_verification_codes (
      id            CHAR(36)     NOT NULL,
      user_id       CHAR(36)     NOT NULL,
      purpose       VARCHAR(30)  NOT NULL,
      target_email  VARCHAR(255) NOT NULL,
      code_hash     CHAR(64)     NOT NULL,
      attempts      INT UNSIGNED NOT NULL DEFAULT 0,
      expires_at    TIMESTAMP    NOT NULL,
      used_at       TIMESTAMP    NULL,
      created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ix_verif_user_purpose (user_id, purpose),
      CONSTRAINT fk_verif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS account_verification_codes');
};
