'use strict';

/**
 * Log de pedidos do Zé Delivery — base do faturamento e da tela de conferência pedida pelo
 * usuário. Upsert a cada evento recebido (não só CONCLUDED), então uma linha reflete o
 * último estado conhecido do pedido, não só o resultado final. raw_payload_json guarda a
 * resposta bruta de getOrder para permitir recalcular/ajustar valor depois sem perder dado,
 * já que o schema real da API ainda não foi confirmado (sem credenciais reais no momento
 * desta migration).
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE ze_delivery_orders (
      id                CHAR(36)      NOT NULL,
      tenant_id         CHAR(36)      NOT NULL,
      order_number      VARCHAR(100)  NOT NULL,
      status             VARCHAR(30)   NOT NULL,
      total_value        DECIMAL(12,2) NULL,
      items_json         JSON          NULL,
      raw_payload_json   JSON          NULL,
      concluded_at       TIMESTAMP     NULL,
      cancelled_at       TIMESTAMP     NULL,
      last_event_id      CHAR(36)      NULL,
      created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ze_orders_tenant_number (tenant_id, order_number),
      KEY ix_ze_orders_tenant_status (tenant_id, status, created_at),
      CONSTRAINT fk_ze_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS ze_delivery_orders');
};
