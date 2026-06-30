'use strict';

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE sales (
      id            CHAR(36)      NOT NULL,
      tenant_id     CHAR(36)      NOT NULL,
      customer_id   CHAR(36)      NULL,
      user_id       CHAR(36)      NOT NULL,
      number        INT UNSIGNED  NOT NULL,
      status        ENUM('open','cancelled') NOT NULL DEFAULT 'open',
      subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      discount      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      total         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      payment_method VARCHAR(50)  NOT NULL DEFAULT 'dinheiro',
      notes         TEXT          NULL,
      sold_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sales_tenant_number (tenant_id, number),
      KEY ix_sales_tenant_status  (tenant_id, status),
      KEY ix_sales_tenant_created (tenant_id, created_at),
      CONSTRAINT fk_sales_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
      CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
      CONSTRAINT fk_sales_user     FOREIGN KEY (user_id)     REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await knex.raw(`
    CREATE TABLE sale_items (
      id         CHAR(36)      NOT NULL,
      tenant_id  CHAR(36)      NOT NULL,
      sale_id    CHAR(36)      NOT NULL,
      product_id CHAR(36)      NOT NULL,
      quantity   INT           NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      discount   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      total      DECIMAL(12,2) NOT NULL,
      PRIMARY KEY (id),
      KEY ix_sitems_sale   (sale_id),
      KEY ix_sitems_tenant (tenant_id),
      CONSTRAINT fk_sitems_sale    FOREIGN KEY (sale_id)    REFERENCES sales(id) ON DELETE CASCADE,
      CONSTRAINT fk_sitems_product FOREIGN KEY (product_id) REFERENCES products(id),
      CONSTRAINT fk_sitems_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS sale_items');
  await knex.raw('DROP TABLE IF EXISTS sales');
};
