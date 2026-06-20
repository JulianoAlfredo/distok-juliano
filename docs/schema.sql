-- ============================================================
-- DISTOK — schema MySQL completo (espelho de apps/api/src/db/migrations)
-- ------------------------------------------------------------
-- DUAS formas de criar o banco:
--   1) RECOMENDADO: via app  ->  `npm run migrate`  (usa estas mesmas definições,
--      versionadas, e registra o controle em knex_migrations).
--   2) MANUAL: importe este arquivo no phpMyAdmin (Hostinger) DENTRO do banco já criado.
--      Use esta opção se preferir não rodar Node para criar as tabelas.
--
-- IMPORTANTE: se você importar este .sql manualmente, rode depois, no app:
--      `npx knex migrate:latest --knexfile apps/api/src/db/knexfile.js`
--   ele detecta as tabelas e mantém o controle de versão para migrations futuras
--   (ou, se der conflito, marque a migration inicial como aplicada).
--
-- Engine InnoDB + utf8mb4. IDs são CHAR(36) (UUID gerado pela aplicação).
-- Isolamento multi-tenant é por tenant_id NA APLICAÇÃO (MySQL não tem RLS).
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- plans ----------
CREATE TABLE IF NOT EXISTS plans (
  id            CHAR(36)      NOT NULL,
  code          VARCHAR(20)   NOT NULL,
  name          VARCHAR(60)   NOT NULL,
  price_cents   INT UNSIGNED  NOT NULL DEFAULT 0,
  max_users     INT UNSIGNED  NULL,
  max_products  INT UNSIGNED  NULL,
  features      JSON          NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- tenants ----------
CREATE TABLE IF NOT EXISTS tenants (
  id            CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(63)  NOT NULL,
  custom_domain VARCHAR(255) NULL,
  cnpj          VARCHAR(18)  NOT NULL,
  address       VARCHAR(255) NULL,
  plan_id       CHAR(36)     NOT NULL,
  status        ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_slug (slug),
  UNIQUE KEY uq_tenants_cnpj (cnpj),
  UNIQUE KEY uq_tenants_domain (custom_domain),
  KEY ix_tenants_status (status),
  CONSTRAINT fk_tenants_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
  id             CHAR(36)     NOT NULL,
  tenant_id      CHAR(36)     NULL,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  cpf            VARCHAR(14)  NULL,
  role_title     VARCHAR(100) NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('super_admin','admin','operator') NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_login_at  TIMESTAMP    NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  KEY ix_users_tenant_status (tenant_id, status),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- tenant_branding ----------
CREATE TABLE IF NOT EXISTS tenant_branding (
  tenant_id       CHAR(36)    NOT NULL,
  display_name    VARCHAR(120) NULL,
  logo_url        VARCHAR(255) NULL,
  favicon_url     VARCHAR(255) NULL,
  color_primary   CHAR(7)     NULL DEFAULT '#2563EB',
  color_secondary CHAR(7)     NULL DEFAULT '#1E293B',
  color_accent    CHAR(7)     NULL DEFAULT '#F59E0B',
  email_from      VARCHAR(255) NULL,
  report_footer   VARCHAR(255) NULL,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id),
  CONSTRAINT fk_branding_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- tenant_terminology ----------
CREATE TABLE IF NOT EXISTS tenant_terminology (
  tenant_id   CHAR(36)    NOT NULL,
  term_key    VARCHAR(60) NOT NULL,
  term_value  VARCHAR(120) NOT NULL,
  PRIMARY KEY (tenant_id, term_key),
  CONSTRAINT fk_term_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- products ----------
CREATE TABLE IF NOT EXISTS products (
  id          CHAR(36)      NOT NULL,
  tenant_id   CHAR(36)      NOT NULL,
  name        VARCHAR(255)  NOT NULL,
  description TEXT          NULL,
  category    VARCHAR(100)  NULL,
  unit        VARCHAR(50)   NOT NULL DEFAULT 'un',
  sku         VARCHAR(100)  NULL,
  cost_price  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sale_price  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  min_stock   INT           NOT NULL DEFAULT 0,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_tenant_sku (tenant_id, sku),
  KEY ix_products_tenant_status (tenant_id, status),
  KEY ix_products_tenant_cat (tenant_id, category),
  CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- stock_movements (ledger append-only) ----------
CREATE TABLE IF NOT EXISTS stock_movements (
  id            CHAR(36)     NOT NULL,
  tenant_id     CHAR(36)     NOT NULL,
  product_id    CHAR(36)     NOT NULL,
  user_id       CHAR(36)     NOT NULL,
  type          ENUM('entry','exit','adjustment') NOT NULL,
  quantity      INT          NOT NULL,
  balance_after INT          NOT NULL,
  reason        VARCHAR(255) NULL,
  batch         VARCHAR(100) NULL,
  expires_at    DATE         NULL,
  supplier      VARCHAR(255) NULL,
  invoice_ref   VARCHAR(100) NULL,
  note          TEXT         NULL,
  ip_address    VARCHAR(45)  NULL,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_mov_tenant_created (tenant_id, created_at),
  KEY ix_mov_tenant_product (tenant_id, product_id, created_at),
  KEY ix_mov_tenant_user (tenant_id, user_id, created_at),
  KEY ix_mov_tenant_type (tenant_id, type, created_at),
  CONSTRAINT fk_mov_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  CONSTRAINT fk_mov_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_mov_user    FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- stock_balance (saldo materializado) ----------
CREATE TABLE IF NOT EXISTS stock_balance (
  tenant_id        CHAR(36)   NOT NULL,
  product_id       CHAR(36)   NOT NULL,
  current_stock    INT        NOT NULL DEFAULT 0,
  last_movement_id CHAR(36)   NULL,
  last_updated     TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, product_id),
  KEY ix_balance_low (tenant_id, current_stock),
  CONSTRAINT fk_balance_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  CONSTRAINT fk_balance_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- audit_log (append-only) ----------
CREATE TABLE IF NOT EXISTS audit_log (
  id          CHAR(36)     NOT NULL,
  tenant_id   CHAR(36)     NULL,
  user_id     CHAR(36)     NULL,
  action      VARCHAR(80)  NOT NULL,
  entity_type VARCHAR(60)  NULL,
  entity_id   CHAR(36)     NULL,
  before_json JSON         NULL,
  after_json  JSON         NULL,
  ip_address  VARCHAR(45)  NULL,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_audit_tenant_created (tenant_id, created_at),
  KEY ix_audit_tenant_action (tenant_id, action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- password_resets ----------
CREATE TABLE IF NOT EXISTS password_resets (
  id         CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  token_hash CHAR(64)    NOT NULL,
  expires_at TIMESTAMP   NOT NULL,
  used_at    TIMESTAMP   NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
