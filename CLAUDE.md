# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DISTOK — multi-tenant SaaS inventory management for distributors. Node.js/Fastify API (`apps/api`), React/Vite/TS frontend (`apps/web`), shared enums (`packages/shared`), static marketing site (`apps/landing`, standalone single-file HTML — no build, no shared code, see `apps/landing/README.md`). MySQL (Hostinger-hosted) via Knex. Stack is locked: MySQL only (no Postgres/Supabase/RLS). The API is deployed as a Node app on Hostinger (Passenger); the frontend and landing page are static builds and can be hosted anywhere (Hostinger, Vercel, Netlify) — the frontend just needs `VITE_API_URL` pointed at wherever the API lives. See `docs/architecture.md` for the full spec and `docs/prd.md`/`docs/ux-design.md`/`docs/workflow.md` for product/design/process context.

## Commands

```bash
npm install                   # installs all workspaces
cp .env.example .env          # configure DB_*, JWT_SECRET (root .env, loaded by apps/api/src/config/env.js)
npm run migrate                # apply Knex migrations
npm run seed                   # demo data: 1 super admin, 2 tenants
npm run dev                    # api (:3000) + web (:5173) concurrently
npm run dev:api / npm run dev:web   # run one side only
npm run build                  # builds apps/web (vite build -> apps/web/dist, served by the API in prod)
npm run lint                    # ESLint flat config — includes the tenant anti-bypass rule
npm test                        # runs apps/api tests (node --test)
npm run migrate:test            # migrations against the test DB (NODE_ENV=test, DB_TEST_NAME)
```

Run a single API test file directly:
```bash
cd apps/api && cross-env NODE_ENV=test node --test tests/stock/stock.service.test.js
```

Frontend-only checks:
```bash
cd apps/web && npm run typecheck   # tsc --noEmit
```

There is no API typecheck (apps/api is plain CommonJS JS, no TS).

## Architecture

### Layering
`routes -> services -> repositories (TenantScopedRepository)`, with middleware chain `tenant-resolver -> auth(JWT) -> rbac -> plan-guard -> handler -> audit`. Each business domain lives under `apps/api/src/modules/<name>/` as `<name>.routes.js` + `<name>.service.js` (+ `.admin.routes.js` where there's a separate admin surface, e.g. branding).

### Multi-tenant isolation — the most important invariant
MySQL on Hostinger has no RLS, so tenant isolation is enforced entirely in application code through **one chokepoint**:

- `apps/api/src/core/TenantContext.js` — built by the auth middleware strictly from the JWT (`tid`, `sub`, `role`). Never trust tenant info from request body/query/params.
- `apps/api/src/core/TenantScopedRepository.js` — the *only* sanctioned way for business modules to touch tenant-scoped tables. Every base query is auto-filtered by `tenant_id`; every insert injects `tenant_id` from the context (the client can never choose it). `super_admin` (tenantId `null`) deliberately bypasses the filter — any cross-tenant action it takes must be written to `audit_log` by the calling code.
- `apps/api/src/core/StockLedger.js` — the one other place allowed to touch tables directly (`products`, `stock_movements`, `stock_balance`), because it needs `SELECT ... FOR UPDATE` and multi-table transactional writes that the generic repository doesn't abstract.

**Enforced by lint, not just convention:** `eslint.config.js` has a `no-restricted-syntax` rule that fails the build if `knex(...)`/`trx(...)` is called directly on `products`, `stock_movements`, or `stock_balance` outside `apps/api/src/core/**` (migrations, seeds, tests, and `plan-guard.js` are explicitly exempted). If you add a new tenant-scoped table that needs this protection, add it to `TENANT_TABLES` in `eslint.config.js`.

When adding a new module that touches tenant data: instantiate `TenantScopedRepository` for that table inside the service, never call `knex('<table>')` from `modules/**`.

### Stock ledger semantics (`core/StockLedger.js`)
Stock movements are append-only (`stock_movements`); the app never UPDATEs/DELETEs rows there — corrections are new `adjustment` movements. `stock_balance` is a materialized balance kept in sync in the *same transaction* as the movement insert, using `SELECT ... FOR UPDATE` on the balance row to serialize concurrent writes per product. `quantity` semantics differ by type: `entry`/`exit` quantity is always positive (sign applied by type, exit blocks negative resulting balance), `adjustment` quantity is the absolute target balance and requires a `reason`.

### Auth & tenant resolution
- JWT (HS256, 8h expiry) payload: `{ sub: userId, tid: tenantId|null, role, jti }`. No server-side session store.
- `tenant-resolver` middleware determines the tenant *before* login (for themed login screens) via custom domain -> subdomain -> `:slug` path -> `GET /public/tenant-theme?slug=` (public, unauthenticated).
- RBAC roles: `super_admin` (tenantId null), `admin`, `operator` — see `packages/shared` for the `ROLES` enum.
- `plan-guard` middleware enforces plan limits (`max_users`, `max_products`, feature flags like `csv`/`customDomain`/`terminology`) and is one of the lint-exempted files since it legitimately counts rows by tenant.

### White-labeling
Tenant branding (`tenant_branding` table: colors, logo, display name, report footer) and per-tenant terminology overrides (`tenant_terminology`) are injected into the frontend as CSS custom properties at runtime (`apps/web/src/theme/ThemeProvider.tsx`) — no per-tenant rebuild. Color changes are validated server-side for WCAG AA contrast (`apps/api/src/utils/contrast.js` / `apps/web/src/theme/contrast.ts`) before being persisted.

### Frontend/backend served together in production
In production the API serves the built SPA directly: `apps/api/src/app.js` registers `apps/web/dist` as static root and falls back unmatched non-`/api`/`/uploads` GET routes to `index.html` (client-side routing). In dev, Vite (`:5173`) and the API (`:3000`) run separately via `npm run dev`.

### Error handling
`apps/api/src/core/errors.js` defines the `Errors` factory used by services to throw typed errors (validation, not found, insufficient stock, etc.); `middlewares/error-handler.js` maps them to the standardized API error shape `{ error: { code, message, details } }` and ensures internals/stack traces never leak to the client.

### Database
- IDs are `CHAR(36)` UUIDv4 generated in application code (no autoincrement, to avoid leaking per-tenant volume).
- Every business table has `tenant_id`; full DDL lives in `docs/schema.sql` and is mirrored in `docs/architecture.md` §3.
- Migrations: `apps/api/src/db/migrations/`, seeds: `apps/api/src/db/seeds/`, Knex config: `apps/api/src/db/knexfile.js`.

### Testing focus
Tests live under `apps/api/tests/<domain>/`. The highest-value suite is `tests/isolation/tenant-isolation.test.js`, which proves tenant A cannot read/write tenant B's data. When changing anything in `core/` or adding a new tenant-scoped module, run/extend this suite plus the relevant domain test (`stock`, `products`, `branding`, `tenants`, `reports`).

## Equipe de agentes (Claude Code)

Este repositório tem uma equipe própria de 8 subagentes definida em `.claude/agents/`, com pipeline de 5 etapas. Vale dentro deste projeto (a squad user-level de 5 agentes em `~/.claude/agents/` vale para outros projetos, não aqui).

| Badge | Agente | Modelo | Papel |
|---|---|---|---|
| 🎓 | `reitor` | Fable | Chefe. Levantamento de requisitos e veredito final vinculante. Não escreve código. |
| 🧭 | `gerente` | Opus | Transforma requisitos em plano executável; revisa o diff dos operários. |
| 🔎 | `mapeador` | Sonnet | Acha arquivo, mapeia fluxo, devolve fato com `arquivo:linha`. |
| ⚙️ | `construtor-api` | Sonnet | Backend em `apps/api`. |
| 🎨 | `construtor-ui` | Sonnet | Frontend em `apps/web`. |
| 🧪 | `testador` | Sonnet | Lint, suite, typecheck, build, smoke. Saída crua. |
| 📓 | `escriba` | Sonnet | Escreve no vault `~/distok-brain` (skill `distok-brain`). |
| 📣 | `marqueteiro` | Fable | Marketing e divulgação — calendário de conteúdo, ideias de perfil, tráfego pago (prioridade do Julio), material de lançamento. Nunca publica sozinho, só rascunha. |

Pipeline: **requisitos** (reitor) → **mapeamento e desenho** (mapeador → gerente) → **codificação em paralelo** (construtor-api ‖ construtor-ui) → **testes** (testador) → **veredito** (reitor, 5 critérios: segurança · escalabilidade · solidificação · UX · otimização — reprovar em um reprova tudo). Cross-review do `security-pentester` (squad user-level) é obrigatório quando o diff toca auth, RLS, PII, pagamento, upload, admin, webhook ou endpoint público novo. Aprovado e **voltado pro cliente** (feature visível, preço/plano, integração nova) → `reitor` aciona `marqueteiro` pra rascunhar conteúdo/campanha; fix interno e dívida técnica não disparam isso.

Quando não rodar o pipeline: pergunta conceitual, leitura de doc, config de harness, correção de uma linha, consulta ao banco.

### Hooks (`.claude/settings.json` + `.claude/hooks/`)

- **SessionStart** (`sessao-inicio.js`) injeta estado vivo no contexto: branch, se a árvore está suja e com quantos arquivos, últimos 5 commits, e as primeiras linhas de `~/distok-brain/01 - Projeto/Estado Atual.md`. Grava um marcador em `.claude/tmp/` com o timestamp de início.
- **Stop** (`sessao-fim.js`) é a trava de memória: se a sessão mexeu em código (árvore suja ou commit novo) e nada foi escrito em `~/distok-brain` desde o início, bloqueia o encerramento e manda delegar ao `escriba`. Sessão de leitura/pergunta não é bloqueada. Falha aberta (erro interno libera), no máximo 1 bloqueio por sessão, respeita `stop_hook_active` para não entrar em loop.

### Armadilhas conhecidas do ambiente

- `docs/` está desatualizado — descreve o MVP inicial (`docs/schema.sql` tem 10 tabelas, batendo só com a migration `20260620000001_init.js`) e não reflete os módulos adicionados depois (customers, suppliers, purchases, sales, cashier, financial, sale_payments). Verdade de schema: `apps/api/src/db/migrations/`.
- Não existe `.env.example` na raiz, apesar de o README mandar copiar.
- GSAP ainda não está instalado em `apps/web` — primeira tarefa de movimento roda `npm i gsap @gsap/react -w apps/web`.
