'use strict';

/**
 * Fila de saída (DISTOK -> Zé Delivery): PK composta (tenant_id, product_id) faz o enqueue
 * ser um upsert natural — várias movimentações no mesmo produto antes do drain colapsam
 * numa única linha pendente. Sem status "sent": sucesso = DELETE (histórico já vive em
 * stock_movements/audit_log).
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE ze_delivery_outbox (
      tenant_id         CHAR(36)     NOT NULL,
      product_id        CHAR(36)     NOT NULL,
      ze_item_id        VARCHAR(100) NOT NULL,
      status             ENUM('pending','processing','error') NOT NULL DEFAULT 'pending',
      attempts           INT UNSIGNED NOT NULL DEFAULT 0,
      last_error         TEXT NULL,
      last_attempt_at    TIMESTAMP NULL,
      last_movement_id   CHAR(36) NULL,
      created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (tenant_id, product_id),
      KEY ix_outbox_status (status, last_attempt_at),
      CONSTRAINT fk_outbox_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)  ON DELETE CASCADE,
      CONSTRAINT fk_outbox_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS ze_delivery_outbox');
};
