# DISTOK — Spec Técnica & Arquitetura

> **Autor:** Aria (Architect — AIOX)
> **Consome:** [prd.md](./prd.md)
> **Versão:** 1.0 · **Data:** 2026-06-20
> **Stack travado:** GitHub · Node.js app na **Hostinger** · **MySQL** da Hostinger
> **Proibido:** PostgreSQL, Supabase, Railway, Vercel, RLS nativa

---

## 1. Visão de Arquitetura (macro)

### 1.1 Estilo
Monólito modular em camadas, **API REST stateless** + **SPA**. Simplicidade primeiro (boring technology), preparado para evoluir. Nada de microserviços no MVP.

```
                    ┌─────────────────────────────────────────┐
   Navegador  ───▶  │  apps/web  (React + Vite, build estático) │
 (tenant tema)      │  Servido pela Hostinger (htdocs/subpasta) │
                    └───────────────────┬─────────────────────┘
                                        │ HTTPS / REST + JWT
                    ┌───────────────────▼─────────────────────┐
                    │  apps/api  (Node.js + Fastify)            │
                    │  Passenger (Setup Node.js App Hostinger) │
                    │  ┌─────────────────────────────────────┐ │
                    │  │ Middlewares: tenant-resolver, auth,  │ │
                    │  │ rbac, plan-guard, error, audit       │ │
                    │  ├─────────────────────────────────────┤ │
                    │  │ Camadas: routes → controllers →      │ │
                    │  │ services → repositories (TenantScope)│ │
                    │  └─────────────────────────────────────┘ │
                    └───────────────────┬─────────────────────┘
                                        │ pool MySQL (TLS)
                    ┌───────────────────▼─────────────────────┐
                    │  MySQL (Hostinger)  — shared DB / schema  │
                    │  isolamento por tenant_id na aplicação    │
                    └───────────────────────────────────────────┘

   E-mail transacional (SMTP/Resend) ◀── credenciais, reset, alertas
   Storage de logos/favicons ◀── filesystem do app (uploads/) + URL pública
```

### 1.2 Decisões-chave (ADR resumido)
| # | Decisão | Por quê | Alternativa descartada |
|---|---|---|---|
| ADR-1 | **Fastify** no backend | Mais rápido/leve que Express, schema-validation nativa (JSON Schema) que reforça contratos de API | Express (ok, mas validação manual) |
| ADR-2 | **Monorepo** `apps/api` + `apps/web` + `packages/shared` | Tipos/constantes compartilhados (roles, enums, termos), 1 PR cobre full-stack | Dois repos |
| ADR-3 | **Knex** (query builder + migrations) | Suporte MySQL sólido na Hostinger, migrations versionadas, SQL explícito e parametrizado; Prisma pode ter atrito com MySQL gerenciado/engine da Hostinger | Prisma (risco em shared hosting), Sequelize |
| ADR-4 | IDs `CHAR(36)` UUID v4 | Legível, sem expor sequência, portável; `BINARY(16)` foi considerado mas perde legibilidade no debug em shared hosting | AUTO_INCREMENT (vaza volume entre tenants) |
| ADR-5 | **Saldo materializado** (`stock_balance`) atualizado em transação | Leitura O(1) do saldo; ledger `stock_movements` permanece append-only | Recalcular SUM a cada leitura (lento) |
| ADR-6 | Isolamento na **camada de aplicação** via `TenantScopedRepository` | MySQL Hostinger não tem RLS; toda query passa por repo que injeta `tenant_id` | Confiar no controller (frágil) |
| ADR-7 | Theming via **CSS Custom Properties** injetadas em runtime | White-label sem rebuild por tenant | Build por tenant (inviável) |
| ADR-8 | JWT stateless 8h + refresh leve | Sem store de sessão server-side; escala em shared hosting | Sessão em DB/Redis (Redis indisponível) |

---

## 2. Estrutura do Monorepo

```
distok/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ server.js              # bootstrap Fastify + Passenger entry
│  │  │  ├─ app.js                 # registro de plugins/rotas
│  │  │  ├─ config/env.js          # leitura/validação de env vars
│  │  │  ├─ db/
│  │  │  │  ├─ knex.js             # pool MySQL
│  │  │  │  ├─ migrations/         # *.js versionadas
│  │  │  │  └─ seeds/
│  │  │  ├─ middlewares/
│  │  │  │  ├─ tenant-resolver.js  # resolve tenant (subdomínio/slug/header)
│  │  │  │  ├─ auth.js             # valida JWT, injeta req.user
│  │  │  │  ├─ rbac.js             # requireRole(...)
│  │  │  │  ├─ plan-guard.js       # enforcement de limites de plano
│  │  │  │  ├─ audit.js            # registra ações sensíveis
│  │  │  │  └─ error-handler.js
│  │  │  ├─ core/
│  │  │  │  ├─ TenantContext.js
│  │  │  │  └─ TenantScopedRepository.js
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/               # login, reset, troca senha
│  │  │  │  ├─ tenants/            # super admin
│  │  │  │  ├─ plans/
│  │  │  │  ├─ branding/           # white-label + terminologia
│  │  │  │  ├─ products/
│  │  │  │  ├─ users/              # funcionários
│  │  │  │  ├─ stock/              # movimentações + saldo
│  │  │  │  ├─ reports/            # PDF/CSV
│  │  │  │  └─ dashboard/
│  │  │  └─ utils/ (pdf.js, csv.js, mailer.js, password.js, contrast.js)
│  │  └─ tests/ (isolation/, stock/, rbac/)
│  └─ web/
│     ├─ src/
│     │  ├─ main.tsx
│     │  ├─ theme/ThemeProvider.tsx     # aplica CSS vars do tenant
│     │  ├─ i18n/terminology.ts         # dicionário por tenant
│     │  ├─ api/client.ts               # axios + interceptors JWT
│     │  ├─ routes/ (guards por role)
│     │  ├─ features/ (auth, superadmin, products, users, stock, reports, branding, dashboard)
│     │  └─ components/ui/ (design system tokenizado)
│     └─ vite.config.ts
├─ packages/
│  └─ shared/   # enums (roles, movement types), constantes de plano, schema de termos
├─ .github/workflows/ci.yml
├─ .env.example
└─ package.json (workspaces)
```

---

## 3. Modelo de Dados — DDL MySQL (micro)

> Engine **InnoDB** (transações + FK), charset `utf8mb4`. IDs `CHAR(36)` UUID v4 gerados na aplicação. Toda tabela de negócio tem `tenant_id`. Timestamps em UTC.

```sql
-- ============ PLANOS ============
CREATE TABLE plans (
  id            CHAR(36)      NOT NULL,
  code          VARCHAR(20)   NOT NULL,           -- 'basic' | 'pro'
  name          VARCHAR(60)   NOT NULL,
  price_cents   INT UNSIGNED  NOT NULL DEFAULT 0,
  max_users     INT UNSIGNED  NULL,               -- NULL = ilimitado
  max_products  INT UNSIGNED  NULL,               -- NULL = ilimitado
  features      JSON          NOT NULL,           -- {"csv":true,"customDomain":true,"terminology":true,"reportsAdvanced":true}
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ TENANTS ============
CREATE TABLE tenants (
  id          CHAR(36)     NOT NULL,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(63)  NOT NULL,              -- subdomínio: cliente.distok.com.br
  custom_domain VARCHAR(255) NULL,                -- domínio próprio (plano Pro)
  cnpj        VARCHAR(18)  NOT NULL,
  address     VARCHAR(255) NULL,
  plan_id     CHAR(36)     NOT NULL,
  status      ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_slug (slug),
  UNIQUE KEY uq_tenants_cnpj (cnpj),
  UNIQUE KEY uq_tenants_domain (custom_domain),
  KEY ix_tenants_status (status),
  CONSTRAINT fk_tenants_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ USERS (super admin + funcionários) ============
CREATE TABLE users (
  id             CHAR(36)     NOT NULL,
  tenant_id      CHAR(36)     NULL,               -- NULL = super_admin
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  cpf            VARCHAR(14)  NULL,
  role_title     VARCHAR(100) NULL,               -- cargo livre (ex: "Estoquista")
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('super_admin','admin','operator') NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_login_at  TIMESTAMP    NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- e-mail único POR tenant (super_admin com tenant_id NULL tratado à parte)
  UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  KEY ix_users_tenant_status (tenant_id, status),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- NOTA: super_admins (tenant_id NULL) — unicidade global de e-mail garantida na aplicação
--       (a UNIQUE acima não cobre NULLs do mesmo modo). Validar no service.

-- ============ BRANDING / WHITE-LABEL ============
CREATE TABLE tenant_branding (
  tenant_id       CHAR(36)    NOT NULL,
  display_name    VARCHAR(120) NULL,              -- nome do sistema p/ o tenant
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

-- ============ TERMINOLOGIA (rótulos sobrescrevíveis) ============
CREATE TABLE tenant_terminology (
  tenant_id   CHAR(36)    NOT NULL,
  term_key    VARCHAR(60) NOT NULL,               -- ex: 'product', 'employee', 'company'
  term_value  VARCHAR(120) NOT NULL,              -- ex: 'Item', 'Colaborador', 'Empresa'
  PRIMARY KEY (tenant_id, term_key),
  CONSTRAINT fk_term_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ PRODUTOS ============
CREATE TABLE products (
  id          CHAR(36)      NOT NULL,
  tenant_id   CHAR(36)      NOT NULL,
  name        VARCHAR(255)  NOT NULL,
  description TEXT          NULL,
  category    VARCHAR(100)  NULL,
  unit        VARCHAR(50)   NOT NULL DEFAULT 'un', -- caixa|garrafa|litro|un
  sku         VARCHAR(100)  NULL,
  cost_price  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sale_price  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  min_stock   INT           NOT NULL DEFAULT 0,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_tenant_sku (tenant_id, sku),   -- SKU único por tenant (NULLs permitidos)
  KEY ix_products_tenant_status (tenant_id, status),
  KEY ix_products_tenant_cat (tenant_id, category),
  CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- margem NÃO é coluna: calculada (sale-cost)/cost*100 na aplicação (evita drift).

-- ============ MOVIMENTAÇÕES (ledger append-only) ============
CREATE TABLE stock_movements (
  id          CHAR(36)     NOT NULL,
  tenant_id   CHAR(36)     NOT NULL,
  product_id  CHAR(36)     NOT NULL,
  user_id     CHAR(36)     NOT NULL,              -- responsável
  type        ENUM('entry','exit','adjustment') NOT NULL,
  quantity    INT          NOT NULL,              -- sempre informado positivo; sinal aplicado por 'type'
  balance_after INT        NOT NULL,              -- saldo resultante (snapshot p/ extrato/auditoria)
  reason      VARCHAR(255) NULL,                  -- venda|perda|devolução|transferência|...
  -- campos de entrada:
  batch       VARCHAR(100) NULL,                  -- lote
  expires_at  DATE         NULL,                  -- validade
  supplier    VARCHAR(255) NULL,
  invoice_ref VARCHAR(100) NULL,                  -- nota fiscal
  note        TEXT         NULL,
  ip_address  VARCHAR(45)  NULL,                  -- IPv4/IPv6
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), -- imutável
  PRIMARY KEY (id),
  KEY ix_mov_tenant_created (tenant_id, created_at),
  KEY ix_mov_tenant_product (tenant_id, product_id, created_at),
  KEY ix_mov_tenant_user (tenant_id, user_id, created_at),
  KEY ix_mov_tenant_type (tenant_id, type, created_at),
  CONSTRAINT fk_mov_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  CONSTRAINT fk_mov_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_mov_user    FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- A aplicação NUNCA emite UPDATE/DELETE nesta tabela (append-only). Correção = novo 'adjustment'.

-- ============ SALDO MATERIALIZADO ============
CREATE TABLE stock_balance (
  tenant_id     CHAR(36)   NOT NULL,
  product_id    CHAR(36)   NOT NULL,
  current_stock INT        NOT NULL DEFAULT 0,
  last_movement_id CHAR(36) NULL,
  last_updated  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, product_id),
  KEY ix_balance_low (tenant_id, current_stock),
  CONSTRAINT fk_balance_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  CONSTRAINT fk_balance_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ AUDITORIA (append-only) ============
CREATE TABLE audit_log (
  id          CHAR(36)     NOT NULL,
  tenant_id   CHAR(36)     NULL,                  -- NULL = ações do super_admin
  user_id     CHAR(36)     NULL,
  action      VARCHAR(80)  NOT NULL,              -- 'product.create','stock.adjust','tenant.suspend'...
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

-- ============ TOKENS DE RESET DE SENHA ============
CREATE TABLE password_resets (
  id         CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  token_hash CHAR(64)    NOT NULL,                -- SHA-256 do token enviado
  expires_at TIMESTAMP   NOT NULL,
  used_at    TIMESTAMP   NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.1 Notas de modelagem
- **Sem RLS:** isolamento 100% na aplicação (§4). FKs ajudam integridade, não isolamento.
- **`balance_after`** no ledger dá extrato auditável sem recomputar e detecta divergência vs. `stock_balance`.
- **Margem** nunca persistida (evita inconsistência) — derivada.
- **ENUM vs tabela de domínio:** ENUM para conjuntos estáveis e pequenos (status, role, type). Se precisar evoluir muito, migrar para tabela.
- **`TIMESTAMP(3)`** em movimentações/auditoria para ordenação fina sob concorrência.

---

## 4. Isolamento Multi-Tenant (camada de aplicação)

### 4.1 Princípio
MySQL da Hostinger **não tem RLS**. Logo, o isolamento é um **invariante de código**, garantido por um único ponto: o repositório.

### 4.2 `TenantContext` + `TenantScopedRepository`
```js
// core/TenantContext.js — criado pelo middleware auth a partir do JWT
class TenantContext {
  constructor({ tenantId, userId, role }) {
    this.tenantId = tenantId;   // null somente p/ super_admin
    this.userId = userId;
    this.role = role;
  }
  get isSuperAdmin() { return this.role === 'super_admin'; }
}

// core/TenantScopedRepository.js
class TenantScopedRepository {
  constructor(knex, table, ctx) {
    if (!ctx) throw new Error('TenantContext obrigatório');
    this.knex = knex; this.table = table; this.ctx = ctx;
  }
  // TODA query base já vem filtrada
  query() {
    const q = this.knex(this.table);
    if (!this.ctx.isSuperAdmin) {
      if (!this.ctx.tenantId) throw new Error('tenantId ausente em contexto não-super');
      q.where(`${this.table}.tenant_id`, this.ctx.tenantId);
    }
    return q;
  }
  async insert(data) {
    return this.query().insert({ ...data, tenant_id: this.ctx.tenantId }); // tenant_id sempre do contexto
  }
}
```
**Regra dura (lint/review):** nenhum módulo de negócio chama `knex(table)` diretamente — sempre via repositório escopado. CI tem um teste/regra que falha se `knex('products'|'stock_movements'|...)` aparecer fora de `core/`.

### 4.3 Garantias
- `tenant_id` **nunca** vem do body/query do cliente (NFR2) — sempre do `TenantContext` (JWT).
- Super Admin é a única role que ignora o filtro, e **toda** ação cross-tenant dele é gravada em `audit_log`.
- Teste automatizado de isolamento (§11) prova que usuário do tenant A recebe 404/empty para recursos do tenant B.

---

## 5. Autenticação, Sessão e Senhas

### 5.1 JWT
- Algoritmo HS256, segredo em env (`JWT_SECRET`), exp **8h** (NFR/FR42).
- Payload: `{ sub: userId, tid: tenantId|null, role, jti }`.
- Sem store server-side. Logout = descarte client-side (token curto). Opcional: blacklist de `jti` em tabela para revogação fina (pós-MVP).
- **Refresh leve:** endpoint `/auth/refresh` reemite token se o atual ainda válido e o tenant ativo.

### 5.2 Fluxos
- **Login** → valida credenciais (bcrypt compare) → checa `user.status=active` **e** `tenant.status=active` → emite JWT. Rate-limit por IP+email (NFR7).
- **Primeiro acesso** → `must_change_password=1` força tela de troca antes de qualquer rota.
- **Reset** → gera token aleatório (32 bytes), guarda `SHA-256` em `password_resets`, envia link por e-mail; consumo invalida (`used_at`).
- **Senhas:** bcrypt custo 12 (NFR1).

### 5.3 Middlewares (ordem)
```
tenant-resolver → auth(JWT) → rbac(role) → plan-guard(quando aplicável) → handler → audit
```

---

## 6. Resolução de Tenant (subdomínio / slug / domínio próprio)

`tenant-resolver` determina o tenant **antes** do login (para tematizar a tela de login):
1. **Host header**: se `custom_domain` casa → tenant. (plano Pro)
2. **Subdomínio**: `cliente.distok.com.br` → `slug = "cliente"`.
3. **Slug na URL**: `app.distok.com.br/c/:slug` (fallback quando sem subdomínio).
4. Endpoint público **`GET /public/tenant-theme?slug=…`** retorna branding mínimo (cores, logo, nome) **sem autenticação** para pintar o login.

> Em produção na Hostinger: wildcard DNS `*.distok.com.br` → mesmo app; o app lê `req.headers.host`. Domínios próprios apontam CNAME para o app e entram em `tenants.custom_domain`.

---

## 7. White-Label / Theming (técnico)

### 7.1 Backend
- `GET /branding` (autenticado) e `GET /public/tenant-theme` (público) retornam o registro de `tenant_branding` + dicionário de `tenant_terminology`.
- `PUT /branding` (admin) valida cores (hex), **valida contraste** (`utils/contrast.js`, WCAG AA ≥ 4.5:1 texto sobre primária) — rejeita combinações ilegíveis (NFR21).
- Upload de logo/favicon: `POST /branding/logo` (multipart) → valida mime (`png/jpg/svg/webp`) e tamanho (≤ 512KB) → salva em `uploads/{tenantId}/` → retorna URL pública.

### 7.2 Frontend
- `ThemeProvider` busca o tema na inicialização (após resolver tenant) e injeta **CSS custom properties** no `:root`:
```css
:root{
  --color-primary: #2563EB; --color-secondary:#1E293B; --color-accent:#F59E0B;
}
```
- Componentes do design system consomem só os tokens (`var(--color-primary)`), nunca cores hard-coded → troca de tenant = troca de variáveis, sem rebuild (ADR-7).
- **Terminologia:** `i18n/terminology.ts` mescla dicionário base + overrides do tenant; componentes usam `t('product')` em vez de string fixa.
- **Fallback** para tema DISTOK padrão se o tenant não personalizou (FR13).

### 7.3 Limites por plano
`plan.features` controla o que o front expõe: Básico = cores + logo; Pro = + terminologia + domínio próprio + rodapé de relatório (FR14). `plan-guard` bloqueia no backend também.

---

## 8. Núcleo de Estoque — Transações e Concorrência

### 8.1 Lançamento de movimentação (algoritmo)
```
BEGIN;                                   -- transação InnoDB
  SELECT current_stock FROM stock_balance
    WHERE tenant_id=? AND product_id=? FOR UPDATE;   -- lock pessimista da linha de saldo
  -- calcular delta: entry => +q ; exit => -q ; adjustment => (novoSaldo - atual)
  -- regra saldo negativo (config tenant): se exit deixaria <0 => bloquear (erro 422) ou alertar
  novoSaldo = atual + delta;
  INSERT INTO stock_movements (... balance_after=novoSaldo, ip, user_id ...);
  INSERT INTO stock_balance (...) VALUES (...) 
    ON DUPLICATE KEY UPDATE current_stock=novoSaldo, last_movement_id=?, last_updated=NOW();
  INSERT INTO audit_log (...);
COMMIT;
```
- **`SELECT ... FOR UPDATE`** serializa concorrência por produto → sem corrida de saldo (NFR/R3).
- Ajuste exige `reason`/justificativa obrigatória (FR28) e grava `before/after` na auditoria.
- Append-only garantido por convenção + revisão (a app não tem código de UPDATE/DELETE no ledger).

### 8.2 Reconciliação
Job opcional (cron leve) compara `SUM(movements)` vs `stock_balance` por tenant e alerta divergência — detecta bugs sem confiar cegamente no materializado.

---

## 9. Contratos de API REST (micro)

> Base: `/api/v1`. Auth: `Authorization: Bearer <jwt>` salvo rotas `/public/*` e `/auth/login`. Respostas de erro padronizadas:
> ```json
> { "error": { "code": "PLAN_LIMIT_EXCEEDED", "message": "Limite de produtos do plano atingido", "details": {} } }
> ```
> Códigos HTTP: 200/201 ok · 400 validação · 401 não autenticado · 403 sem permissão/role · 404 inexistente/fora do tenant · 409 conflito (ex: SKU duplicado) · 422 regra de negócio (ex: saldo negativo) · 429 rate limit.

### 9.1 Auth
| Método | Rota | Body | Resp | Erros |
|---|---|---|---|---|
| POST | `/auth/login` | `{email,password,tenantSlug?}` | `{token, user, mustChangePassword}` | 401, 403 (tenant inativo), 429 |
| POST | `/auth/refresh` | — (Bearer) | `{token}` | 401 |
| POST | `/auth/forgot` | `{email, tenantSlug}` | `204` | 429 |
| POST | `/auth/reset` | `{token, newPassword}` | `204` | 400, 410 (expirado) |
| POST | `/auth/change-password` | `{currentPassword,newPassword}` | `204` | 400, 401 |

### 9.2 Super Admin — Tenants & Planos
| Método | Rota | Resp | Notas |
|---|---|---|---|
| GET | `/admin/tenants?status=&plan=&page=` | lista paginada | role super_admin |
| POST | `/admin/tenants` | `201 {tenant}` | cria tenant + admin inicial + e-mail (FR1/FR7) |
| PATCH | `/admin/tenants/:id/status` | `{tenant}` | active/inactive/suspended (FR2) |
| POST | `/admin/tenants/:id/reset-admin-password` | `204` | gera temp + força troca (FR6) |
| GET | `/admin/metrics` | `{tenants,active,mrr,byPlan}` | FR4 |
| GET | `/admin/plans` / POST / PATCH `/admin/plans/:id` | — | FR5 |

### 9.3 Branding
| Método | Rota | Notas |
|---|---|---|
| GET | `/public/tenant-theme?slug=` | público, p/ login |
| GET | `/branding` | tema + terminologia do tenant |
| PUT | `/branding` | cores/nome/rodapé + valida contraste (FR9/FR12/NFR21) |
| POST | `/branding/logo` | upload (FR8) |
| PUT | `/branding/terminology` | `{terms:{product:"Item",...}}` (FR11), gated por plano |

### 9.4 Produtos
| Método | Rota | Notas |
|---|---|---|
| GET | `/products?search=&category=&status=&page=` | busca/filtro (FR18) |
| POST | `/products` | cria; `plan-guard` checa max_products (FR15/FR20) → 422 `PLAN_LIMIT_EXCEEDED` |
| GET | `/products/:id` | inclui margem calculada |
| PUT | `/products/:id` | edita (FR16) |
| PATCH | `/products/:id/inactivate` | inativa (FR17) |

### 9.5 Funcionários (users do tenant)
| Método | Rota | Notas |
|---|---|---|
| GET | `/users?status=&page=` | role admin |
| POST | `/users` | cria + senha temp por e-mail; `plan-guard` max_users (FR21/FR25) |
| PUT | `/users/:id` | edita cargo/role |
| PATCH | `/users/:id/status` | ativar/inativar (FR23) |

### 9.6 Estoque
| Método | Rota | Body | Notas |
|---|---|---|---|
| POST | `/stock/movements` | `{productId,type,quantity,reason?,batch?,expiresAt?,supplier?,invoiceRef?,note?}` | entrada/saída/ajuste (FR26–28); ajuste exige `reason` |
| GET | `/stock/balance?belowMin=&category=&page=` | saldo atual + flag abaixo do mínimo (FR30/FR33) |
| GET | `/stock/products/:id/movements?page=` | extrato cronológico (FR34) |

### 9.7 Relatórios
| Método | Rota | Query | Saída |
|---|---|---|---|
| GET | `/reports/stock-current?format=pdf\|csv` | — | branded (FR35/FR39) |
| GET | `/reports/movements?from=&to=&productId=&userId=&type=&format=` | filtros (FR36) | PDF/CSV |
| GET | `/reports/audit?from=&to=&format=` | read-only (FR37) | PDF/CSV |
| GET | `/reports/below-min?format=` | — | (FR38) |
> `format=csv` gated por `plan.features.csv` (FR40) → 403 se Básico.

### 9.8 Dashboard
| GET | `/dashboard/summary` → `{productsActive, belowMin, stockValue, lastMovements[], entriesVsExits[]}` (FR41) |

---

## 10. Deploy na Hostinger

### 10.1 Backend (Node app)
- **hPanel → Avançado → Node.js (Setup Node.js App)**: criar app, escolher versão Node LTS suportada, apontar **Application root** para `apps/api`, **Application startup file** = `src/server.js`. Passenger gerencia o processo.
- `server.js` exporta o app de modo compatível com Passenger (escutar em `process.env.PORT` quando rodando standalone; sob Passenger, exportar o handler).
- **Variáveis de ambiente** (hPanel ou `.env` fora do webroot):
```
NODE_ENV=production
PORT=3000
JWT_SECRET=...
DB_HOST=localhost            # MySQL da Hostinger (host interno)
DB_PORT=3306
DB_NAME=uXXXX_distok
DB_USER=uXXXX_distok
DB_PASS=...
MAIL_SMTP_HOST=...  MAIL_SMTP_USER=...  MAIL_SMTP_PASS=...  MAIL_FROM="no-reply@distok.com.br"
APP_BASE_URL=https://app.distok.com.br
UPLOADS_DIR=/home/uXXXX/uploads
```
- **Migrations** rodadas via SSH (`npx knex migrate:latest`) no deploy.

### 10.2 Frontend (build estático)
- `vite build` → `apps/web/dist` → publicado em `public_html` (ou subdomínio `app.`). `.htaccess` com fallback SPA:
```apacheconf
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```
- API consumida via `https://api.distok.com.br` (subdomínio do Node app) ou path `/api` (proxy). CORS liberado só para domínios DISTOK.

### 10.3 Domínios/SSL
- Domínio `distok.com.br` + **wildcard** `*.distok.com.br` para subdomínios de tenant.
- SSL via **Let's Encrypt** (Hostinger free SSL); wildcard se o plano permitir, senão subdomínios individuais provisionados no onboarding.
- Domínio próprio do tenant (Pro): CNAME → app + entrada em `custom_domain` + emissão de SSL.

### 10.4 Git deploy
- Hostinger **Git** (hPanel → Git): conectar repositório GitHub, branch `main`, auto-deploy on push (ou deploy manual). Pós-pull: `npm ci && npm run build` (web) + `knex migrate:latest` (api) via hook/SSH.

---

## 11. CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml (resumo)
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      mysql: { image: mysql:8, env: { MYSQL_ROOT_PASSWORD: root, MYSQL_DATABASE: distok_test }, ports: ['3306:3306'] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4 (node lts)
      - run: npm ci
      - run: npm run lint                 # inclui regra anti-bypass de tenant (§4.2)
      - run: npm run migrate:test         # knex migrate:latest no MySQL de teste
      - run: npm test                     # isolamento + estoque + rbac
      - run: npm run build --workspace=apps/web
```
Deploy é disparado pela integração Git da Hostinger após merge em `main` (não pelo Actions), mantendo segredos fora do GitHub.

---

## 12. Testes (foco em risco)

- **Isolamento (crítico):** com 2 tenants seedados, toda rota de negócio retorna apenas dados do tenant do JWT; tentativa de acessar `:id` de outro tenant → 404. Teste parametrizado por módulo.
- **Estoque:** entrada/saída/ajuste atualizam saldo corretamente; saída além do saldo respeita config (422 ou alerta); concorrência (duas saídas simultâneas) não gera saldo inconsistente (testar `FOR UPDATE`).
- **RBAC:** matriz §6.3 — operator não acessa rotas de admin (403); super_admin não opera dentro de tenant sem trilha de auditoria.
- **Plan-guard:** criar usuário/produto além do limite → 422 `PLAN_LIMIT_EXCEEDED`.
- **Branding:** contraste insuficiente rejeitado; upload de tipo inválido rejeitado.
- **Auditoria:** ações sensíveis geram registro; ledger/auditoria sem rota de edição.

---

## 13. Observabilidade & Operação
- **Logs** estruturados (pino — nativo do Fastify) para stdout/arquivo; nível por env.
- **Health check** `GET /health` (db ping) para monitor externo (UptimeRobot grátis).
- **Backup:** rotina de backup MySQL da Hostinger + `mysqldump` agendado (export off-site). RPO alvo ≤ 24h, RTO ≤ algumas horas (restore manual).
- **Erros:** handler central padroniza resposta e loga stacktrace (sem vazar ao cliente).

---

## 14. Segurança (defesa em profundidade)
- Queries **sempre** parametrizadas (Knex bindings) → anti SQL-injection (NFR7).
- Validação de input por **JSON Schema** (Fastify) em todas as rotas.
- Escape/sanitização de saída no front (React já escapa; cuidado com `dangerouslySetInnerHTML` — proibido salvo branding controlado).
- Rate-limit (`@fastify/rate-limit`) em `/auth/*`.
- Headers de segurança (`@fastify/helmet`), CORS restrito.
- Uploads validados e servidos fora do escopo de execução.
- Segredos só em env (NFR16); `.env` no `.gitignore`; `.env.example` versionado.

---

## 15. Riscos Técnicos

| # | Risco | Mitigação |
|---|---|---|
| RT1 | Hostinger não suportar Node app persistente / versão Node | Validar no Épico 1 antes de codar muito; plano B: VPS Hostinger |
| RT2 | Sem RLS → vazamento entre tenants | `TenantScopedRepository` único ponto + lint anti-bypass + testes de isolamento |
| RT3 | Concorrência de saldo | `SELECT ... FOR UPDATE` + saldo materializado transacional |
| RT4 | Wildcard SSL/subdomínio limitado no plano shared | Provisionar subdomínios por tenant no onboarding; domínio próprio só Pro |
| RT5 | Limites de processo/memória do shared hosting | Fastify leve, sem Redis; paginação obrigatória; pool MySQL pequeno |
| RT6 | PDF pesado (Puppeteer) em shared hosting | Preferir PDFKit (sem headless Chrome) p/ relatórios; Puppeteer só se necessário |
| RT7 | Drift de schema | Migrations versionadas + CI roda migrate no MySQL de teste |

---

_Handoff → **@ux (Uma)**: produzir `docs/ux-design.md` (design system tokenizado, fluxos por persona, especificação do white-label visual e telas). Depois **@sm (River)**: `docs/workflow.md` (trilha de stories)._

— Aria, arquitetando o futuro 🏗️
