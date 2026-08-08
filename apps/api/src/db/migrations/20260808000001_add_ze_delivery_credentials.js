'use strict';

/**
 * Credenciais do Zé Delivery são cadastradas pelo próprio admin do tenant (autoatendimento,
 * sem mediação de super_admin) — armazenadas aqui só para o backend fazer requisições em
 * nome do tenant. `system_user_id` aponta pro ator de sistema (users.is_system) usado nas
 * movimentações de estoque automáticas dessa integração (FK NOT NULL de stock_movements.user_id
 * exige um usuário real).
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE users
      ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0;
  `);
  await knex.raw(`
    CREATE TABLE ze_delivery_credentials (
      tenant_id                CHAR(36)      NOT NULL,
      environment               ENUM('production','sandbox') NOT NULL DEFAULT 'sandbox',
      client_id                 VARCHAR(255)  NOT NULL,
      client_secret_enc         TEXT          NOT NULL,
      merchant_ids               JSON          NULL,
      system_user_id            CHAR(36)      NULL,
      status                     ENUM('disconnected','active','error') NOT NULL DEFAULT 'disconnected',
      access_token_enc          TEXT          NULL,
      access_token_expires_at   TIMESTAMP     NULL,
      last_sync_inbound_at      TIMESTAMP     NULL,
      last_sync_outbound_at     TIMESTAMP     NULL,
      last_import_at            TIMESTAMP     NULL,
      last_error                TEXT          NULL,
      last_error_at             TIMESTAMP     NULL,
      created_at                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (tenant_id),
      CONSTRAINT fk_ze_cred_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      CONSTRAINT fk_ze_cred_user   FOREIGN KEY (system_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS ze_delivery_credentials');
  await knex.raw('ALTER TABLE users DROP COLUMN is_system');
};
