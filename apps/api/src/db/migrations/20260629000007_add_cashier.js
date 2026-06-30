'use strict';

exports.up = async function up(knex) {
  // Sessão de caixa (abertura/fechamento)
  await knex.raw(`
    CREATE TABLE cashier_sessions (
      id              CHAR(36)      NOT NULL,
      tenant_id       CHAR(36)      NOT NULL,
      user_id         CHAR(36)      NOT NULL,
      opened_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at       TIMESTAMP     NULL,
      opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      closing_balance DECIMAL(12,2) NULL,
      notes           TEXT          NULL,
      status          ENUM('open','closed') NOT NULL DEFAULT 'open',
      PRIMARY KEY (id),
      KEY ix_cashier_tenant_status  (tenant_id, status),
      KEY ix_cashier_tenant_opened  (tenant_id, opened_at),
      CONSTRAINT fk_cashier_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      CONSTRAINT fk_cashier_user   FOREIGN KEY (user_id)   REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Lançamentos de caixa
  await knex.raw(`
    CREATE TABLE cashier_entries (
      id          CHAR(36)      NOT NULL,
      tenant_id   CHAR(36)      NOT NULL,
      session_id  CHAR(36)      NOT NULL,
      user_id     CHAR(36)      NOT NULL,
      type        ENUM('in','out') NOT NULL,
      amount      DECIMAL(12,2) NOT NULL,
      description VARCHAR(255)  NOT NULL,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ix_centry_session (session_id),
      KEY ix_centry_tenant  (tenant_id),
      CONSTRAINT fk_centry_session FOREIGN KEY (session_id) REFERENCES cashier_sessions(id),
      CONSTRAINT fk_centry_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
      CONSTRAINT fk_centry_user    FOREIGN KEY (user_id)    REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS cashier_entries');
  await knex.raw('DROP TABLE IF EXISTS cashier_sessions');
};
