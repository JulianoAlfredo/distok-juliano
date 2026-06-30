'use strict';

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE suppliers (
      id          CHAR(36)      NOT NULL,
      tenant_id   CHAR(36)      NOT NULL,
      name        VARCHAR(255)  NOT NULL,
      trade_name  VARCHAR(255)  NULL,
      cnpj        VARCHAR(18)   NULL,
      cpf         VARCHAR(14)   NULL,
      email       VARCHAR(255)  NULL,
      phone       VARCHAR(20)   NULL,
      address     VARCHAR(255)  NULL,
      city        VARCHAR(100)  NULL,
      state       CHAR(2)       NULL,
      contact     VARCHAR(255)  NULL,
      notes       TEXT          NULL,
      status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ix_suppliers_tenant_status (tenant_id, status),
      KEY ix_suppliers_tenant_name   (tenant_id, name),
      CONSTRAINT fk_suppliers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS suppliers');
};
