'use strict';

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE sale_payments (
      id              CHAR(36)      NOT NULL,
      tenant_id       CHAR(36)      NOT NULL,
      sale_id         CHAR(36)      NOT NULL,
      method          VARCHAR(50)   NOT NULL,
      amount          DECIMAL(12,2) NOT NULL,
      received_amount DECIMAL(12,2) NULL,
      change_amount   DECIMAL(12,2) NULL,
      created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ix_spay_sale   (sale_id),
      KEY ix_spay_tenant (tenant_id),
      CONSTRAINT fk_spay_sale   FOREIGN KEY (sale_id)   REFERENCES sales(id) ON DELETE CASCADE,
      CONSTRAINT fk_spay_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS sale_payments');
};
