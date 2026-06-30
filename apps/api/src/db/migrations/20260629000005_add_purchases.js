'use strict';

exports.up = async function up(knex) {
  // Cabeçalho do pedido de compra
  await knex.raw(`
    CREATE TABLE purchases (
      id           CHAR(36)      NOT NULL,
      tenant_id    CHAR(36)      NOT NULL,
      supplier_id  CHAR(36)      NULL,
      user_id      CHAR(36)      NOT NULL,
      number       INT UNSIGNED  NOT NULL,
      status       ENUM('draft','confirmed','cancelled') NOT NULL DEFAULT 'draft',
      notes        TEXT          NULL,
      total_cost   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      purchased_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_purchases_tenant_number (tenant_id, number),
      KEY ix_purchases_tenant_status  (tenant_id, status),
      KEY ix_purchases_tenant_created (tenant_id, created_at),
      CONSTRAINT fk_purchases_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
      CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      CONSTRAINT fk_purchases_user     FOREIGN KEY (user_id)     REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Itens do pedido
  await knex.raw(`
    CREATE TABLE purchase_items (
      id          CHAR(36)      NOT NULL,
      tenant_id   CHAR(36)      NOT NULL,
      purchase_id CHAR(36)      NOT NULL,
      product_id  CHAR(36)      NOT NULL,
      quantity    INT           NOT NULL,
      unit_cost   DECIMAL(12,2) NOT NULL,
      total_cost  DECIMAL(12,2) NOT NULL,
      PRIMARY KEY (id),
      KEY ix_pitems_purchase (purchase_id),
      KEY ix_pitems_tenant   (tenant_id),
      CONSTRAINT fk_pitems_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      CONSTRAINT fk_pitems_product  FOREIGN KEY (product_id)  REFERENCES products(id),
      CONSTRAINT fk_pitems_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS purchase_items');
  await knex.raw('DROP TABLE IF EXISTS purchases');
};
