'use strict';

exports.up = async function up(knex) {
  // Categorias de produtos
  await knex.raw(`
    CREATE TABLE product_categories (
      id         CHAR(36)     NOT NULL,
      tenant_id  CHAR(36)     NOT NULL,
      name       VARCHAR(100) NOT NULL,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_cat_tenant_name (tenant_id, name),
      CONSTRAINT fk_cat_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Unidades de medida
  await knex.raw(`
    CREATE TABLE product_units (
      id         CHAR(36)     NOT NULL,
      tenant_id  CHAR(36)     NOT NULL,
      name       VARCHAR(50)  NOT NULL,
      symbol     VARCHAR(10)  NOT NULL,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_unit_tenant_symbol (tenant_id, symbol),
      CONSTRAINT fk_unit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS product_units');
  await knex.raw('DROP TABLE IF EXISTS product_categories');
};
