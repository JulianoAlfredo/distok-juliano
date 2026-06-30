'use strict';

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE financial_entries (
      id           CHAR(36)      NOT NULL,
      tenant_id    CHAR(36)      NOT NULL,
      user_id      CHAR(36)      NOT NULL,
      type         ENUM('receivable','payable') NOT NULL,
      status       ENUM('pending','paid','cancelled') NOT NULL DEFAULT 'pending',
      description  VARCHAR(255)  NOT NULL,
      amount       DECIMAL(12,2) NOT NULL,
      due_date     DATE          NOT NULL,
      paid_at      DATE          NULL,
      paid_amount  DECIMAL(12,2) NULL,
      category     VARCHAR(100)  NULL,
      supplier_id  CHAR(36)      NULL,
      customer_id  CHAR(36)      NULL,
      sale_id      CHAR(36)      NULL,
      purchase_id  CHAR(36)      NULL,
      notes        TEXT          NULL,
      created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ix_fin_tenant_type   (tenant_id, type),
      KEY ix_fin_tenant_status (tenant_id, status),
      KEY ix_fin_tenant_due    (tenant_id, due_date),
      CONSTRAINT fk_fin_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
      CONSTRAINT fk_fin_user     FOREIGN KEY (user_id)     REFERENCES users(id),
      CONSTRAINT fk_fin_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      CONSTRAINT fk_fin_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
      CONSTRAINT fk_fin_sale     FOREIGN KEY (sale_id)     REFERENCES sales(id),
      CONSTRAINT fk_fin_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS financial_entries');
};
