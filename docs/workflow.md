# DISTOK — Trilha de Desenvolvimento (Workflow)

> **Autor:** River (Scrum Master — AIOX)
> **Consome:** [prd.md](./prd.md) · [architecture.md](./architecture.md) · [ux-design.md](./ux-design.md)
> **Versão:** 1.0 · **Data:** 2026-06-20
> **Stack:** GitHub · Node app na Hostinger · MySQL da Hostinger

Este documento é o **roadmap de execução** que segue a lógica do produto: cada épico habilita o próximo. As stories abaixo são as unidades de trabalho; as detalhadas serão expandidas em `docs/stories/` (ver template em [`stories/1.3-auth-multitenant.md`](./stories/1.3-auth-multitenant.md)).

---

## 1. Visão da Trilha (sequência e por quê)

```
Épico 1            Épico 2          Épico 3        Épico 4        Épico 5         Épico 6
FUNDAÇÃO    ──▶    WHITE-LABEL ──▶  CADASTROS ──▶  ESTOQUE  ──▶   RELATÓRIOS ──▶  DEPLOY +
+ AUTH +           (marca/termo)    (produtos/      (núcleo:       + DASHBOARD     1º CLIENTE
MULTI-TENANT                        funcionários)   movimentação)
   │                  │                │               │               │              │
   └─ tudo depende    └─ depende de    └─ depende de   └─ depende de   └─ depende de   └─ depende de
      de auth/tenant     tenants+plan     auth+plan       produtos        movimentações   tudo pronto
```

**Racional da ordem:**
1. **Fundação/Auth/Multi-tenant primeiro** — é o chão. Sem isolamento de tenant e RBAC confiáveis, qualquer feature acima fica insegura. Também valida cedo o **risco RT1** (Hostinger suporta Node app?).
2. **White-label antes dos cadastros** — o branding e a terminologia afetam *como* todas as telas seguintes renderizam (tokens, rótulos). Resolver cedo evita retrabalho de UI. Depende só de `tenants`/`plans`.
3. **Cadastros (produtos/funcionários)** — dados mestres. Estoque não existe sem produtos; auditoria por funcionário não existe sem usuários.
4. **Estoque (núcleo)** — o coração do produto. Depende de produtos cadastrados.
5. **Relatórios/Dashboard** — só fazem sentido com movimentações reais para agregar.
6. **Deploy + 1º cliente** — empacota tudo em produção na Hostinger e valida com uso real.

**Marco macro (Definition of Done do MVP):** cliente-âncora operando estoque em produção, com marca própria, relatórios branded e zero vazamento entre tenants.

---

## 2. Convenções

- **IDs de story:** `É.N` (ex: `1.3` = Épico 1, story 3).
- **Rastreabilidade:** cada AC referencia FR/NFR do PRD.
- **Estados de story:** `Draft → Ready → In Progress → In Review → Done`.
- **DoD global** (vale para toda story): código + testes passando + lint (inclui regra anti-bypass de tenant) + revisão + docs atualizadas + merge em `main` via PR verde.

---

## 3. Épicos e Stories

### ÉPICO 1 — Fundação, Multi-Tenant e Autenticação
**Meta:** sistema sobe localmente; login, isolamento por tenant, RBAC e Super Admin básico funcionando. **Valida RT1 (Hostinger/Node) cedo.**

| Story | Título | Rastreio | DoD-chave |
|---|---|---|---|
| **1.1** | Setup do monorepo (Fastify + React/Vite) + lint/test + CI esqueleto | TA1–TA3, NFR18 | `npm run dev` sobe api+web; CI roda lint/test no PR |
| **1.2** | Migrations MySQL (plans, tenants, users, products, stock_movements, stock_balance, tenant_branding, tenant_terminology, audit_log, password_resets) | §3 architecture, NFR11, NFR17 | schema recriável via `knex migrate:latest`; índices criados |
| **1.3** | Autenticação JWT + middleware tenant-resolver + RBAC + TenantScopedRepository | FR42–FR45, NFR1–NFR6 | teste de isolamento passa (tenant A ≠ tenant B); ver template |
| **1.4** | Painel Super Admin — CRUD de tenants + planos + métricas | FR1–FR5 | super_admin cria/ativa/suspende tenant; métricas exibidas |
| **1.5** | Reset de senha de admin pelo Super Admin + criação de admin inicial + e-mail | FR6, FR7 | tenant novo gera admin + e-mail com senha temp |
| **1.6** | Resolução de tenant por subdomínio/slug + tema na tela de login | FR10, FR13 | `/public/tenant-theme` pinta login; fallback DISTOK |
| **1.7** | Seed de dados (1 super admin, 2 tenants, usuários, produtos) | — | ambiente demo reproduzível para testes de isolamento |

**Story 1.1 — descrição (exemplo de formato):**
> _As a_ desenvolvedor, _I want_ um monorepo com api (Fastify) e web (Vite) e CI mínimo, _so that_ toda contribuição já nasce padronizada e testável.
> **AC1 (Given/When/Then):** _Given_ o repo clonado, _When_ rodo `npm install && npm run dev`, _Then_ api sobe em `:3000` e web em `:5173`. **AC2:** _Given_ um PR aberto, _When_ o CI roda, _Then_ executa lint+test e bloqueia merge se falhar.

> ✅ **Pronto para Épico 2 quando:** 1.3 com teste de isolamento verde + 1.4 + 1.6 em `main`. **Gate de risco RT1:** antes da 1.2 finalizar, fazer um spike de 1 dia provando que a Hostinger roda o Node app + conecta no MySQL.

---

### ÉPICO 2 — Personalização / White-Label
**Meta:** cada tenant com identidade visual e terminológica próprias. **Depende de:** tenants/plans (Épico 1).

| Story | Título | Rastreio | DoD-chave |
|---|---|---|---|
| **2.1** | API + modelo de branding (cores, logo, favicon, nome, rodapé) | FR8, FR12 | `GET/PUT /branding`; upload validado (mime/tamanho) |
| **2.2** | Tela de configuração de marca com preview ao vivo + validação de contraste | FR9, NFR21 | salvar bloqueia contraste < AA com microcopy |
| **2.3** | Aplicação dinâmica do tema no front (CSS vars) pós-resolução de tenant | FR10, FR13 | trocar tenant troca tokens sem rebuild |
| **2.4** | Dicionário de terminologia por tenant | FR11, NFR20 | rótulos sobrescritos refletem na UI (`t('product')`) |
| **2.5** | Limites de personalização por plano (Básico vs Pro) | FR14 | recursos Pro travados com 🔒 no Básico (UI + backend) |

> ✅ **Pronto para Épico 3 quando:** um tenant consegue aplicar logo+cores e ver login e app tematizados; contraste validado; limites por plano aplicados no backend (não só UI).

---

### ÉPICO 3 — Cadastros (Produtos e Funcionários)
**Meta:** dados mestres com enforcement de plano. **Depende de:** auth/RBAC + plans.

| Story | Título | Rastreio | DoD-chave |
|---|---|---|---|
| **3.1** | API + tela de produtos: CRUD, margem ao vivo, inativação, busca/filtro | FR15–FR19 | margem calculada; inativar não deleta; SKU único/tenant |
| **3.2** | Enforcement de limite de produtos por plano | FR20 | 201º produto no Básico → 422 PLAN_LIMIT_EXCEEDED + banner |
| **3.3** | API + tela de funcionários: CRUD, roles, ativar/inativar, e-mail c/ senha temp | FR21–FR24 | operador/admin com acessos corretos; histórico preservado |
| **3.4** | Enforcement de limite de usuários por plano | FR25 | exceder limite → 422 + banner |

> ✅ **Pronto para Épico 4 quando:** produtos podem ser criados/buscados e funcionários têm login e role; limites aplicados.

---

### ÉPICO 4 — Núcleo de Estoque
**Meta:** movimentação rastreável e saldo confiável (coração do produto). **Depende de:** produtos + usuários.

| Story | Título | Rastreio | DoD-chave |
|---|---|---|---|
| **4.1** | API de movimentações (entrada/saída/ajuste) transacional + saldo materializado | FR26–FR29, FR31–FR32, NFR10, NFR12.1 | transação com `SELECT ... FOR UPDATE`; `balance_after` gravado |
| **4.2** | Regra de saldo negativo (bloquear/alertar) configurável | FR29 | saída > saldo → 422 com orientação |
| **4.3** | Alerta de estoque mínimo | FR30 | produtos abaixo do mínimo sinalizados |
| **4.4** | Telas: lançamento (operador, ≤3 cliques, mobile) + consulta de saldo + extrato | FR33–FR34, UX2, UX6 | fluxo de 3 cliques; extrato sem editar/excluir |
| **4.5** | Auditoria imutável de todas as ações sensíveis | FR24, FR31, NFR14 | toda ação gera `audit_log`; sem rota de edição |

> ✅ **Pronto para Épico 5 quando:** dá pra lançar entrada/saída/ajuste, ver saldo correto sob concorrência e o extrato/auditoria registram tudo. **Gate de risco RT2/RT3:** teste de concorrência de saldo + teste de isolamento verdes.

---

### ÉPICO 5 — Relatórios, Auditoria e Dashboard
**Meta:** visibilidade gerencial e exportação branded. **Depende de:** movimentações.

| Story | Título | Rastreio | DoD-chave |
|---|---|---|---|
| **5.1** | Relatório de estoque atual (PDF+CSV, branded) | FR35, FR39, FR40 | PDF com logo/cores do tenant; CSV gated por plano |
| **5.2** | Relatório de movimentações com filtros (período/produto/func/tipo) | FR36 | filtros combináveis; export PDF/CSV |
| **5.3** | Relatório de auditoria (read-only) | FR37 | não editável; export |
| **5.4** | Relatório de produtos abaixo do mínimo | FR38 | lista correta |
| **5.5** | Dashboard do tenant (KPIs + últimas movimentações + gráfico) | FR41 | tela inicial do admin |

> ✅ **Pronto para Épico 6 quando:** os 4 relatórios geram PDF/CSV branded e o dashboard mostra os KPIs reais.

---

### ÉPICO 6 — Deploy e Primeiro Cliente
**Meta:** produção na Hostinger + onboarding do cliente-âncora. **Depende de:** tudo acima.

| Story | Título | Rastreio | DoD-chave |
|---|---|---|---|
| **6.1** | Deploy do backend (Node app) na Hostinger + env vars + SSL | NFR15–NFR16, arch §10.1 | API responde em produção; `GET /health` ok |
| **6.2** | Deploy do frontend (build estático) + `.htaccess` SPA | arch §10.2 | app acessível por domínio |
| **6.3** | Domínios/subdomínios por tenant + wildcard/SSL | FR10, arch §10.3 | `cliente.distok.com.br` resolve e tematiza |
| **6.4** | Onboarding do cliente-âncora (importar produtos, criar usuários, aplicar tema) | M1 | checklist §6 cumprido |
| **6.5** | Documentação de uso + correção de bugs em uso real | — | doc entregue; bugs P0/P1 corrigidos |

---

## 4. Estratégia de Branches, PR e Gates de Qualidade (GitHub)

### 4.1 Branching
- `main` = sempre deployável (a integração Git da Hostinger puxa daqui).
- Feature branch por story: `feature/1.3-auth-multitenant`.
- Fix: `fix/<descrição>`. Sem commits diretos em `main`.

### 4.2 Fluxo de PR
```
story Ready → branch feature/É.N-slug → commits locais → PR para main
   → CI verde (lint + migrate test + testes) → revisão → merge (squash)
   → Hostinger auto-deploy puxa main
```

### 4.3 Gates de qualidade (CI — bloqueiam merge)
1. **Lint anti-bypass de tenant** — regra falha o build se `knex('<tabela_de_negócio>')` for chamado fora de `core/` (força uso do `TenantScopedRepository`). _Crítico para RT2._
2. **Testes de isolamento multi-tenant** — tenant A não acessa dados de B (404/empty).
3. **Testes de regras de estoque** — saldo, saída negativa, concorrência (`FOR UPDATE`).
4. **Testes de RBAC + plan-guard** — matriz de permissões e limites de plano.
5. **Migrate no MySQL de teste** — schema recriável (NFR17).
6. **Build do front** — `vite build` sem erro.

> Repo solo/dupla: branch protection opcional, mas CI verde é pré-condição de merge por convenção.

---

## 5. Trilha de Deploy Incremental (Hostinger)

| Momento | O que sobe | Verificação |
|---|---|---|
| Fim Épico 1 (spike) | Node app "hello" + conexão MySQL | `GET /health` responde; query simples ok → **valida RT1** |
| Fim Épico 2 | App tematizado em staging (subdomínio de teste) | login tematizado em produção |
| Fim Épico 4 | Núcleo de estoque em staging | lançar movimentação real em ambiente Hostinger |
| Épico 6 | Produção + domínio + 1º cliente | onboarding completo |

Cada deploy: `git pull` (Hostinger) → `npm ci` → `knex migrate:latest` (api) → `vite build` (web) → restart do Node app (Passenger).

---

## 6. Checklist de Onboarding do 1º Cliente (Story 6.4)

- [ ] Tenant criado no painel Super Admin (nome, CNPJ, plano).
- [ ] Subdomínio `cliente.distok.com.br` provisionado + SSL.
- [ ] Admin inicial criado + e-mail de credenciais entregue.
- [ ] 1º login do cliente → troca de senha concluída.
- [ ] Marca aplicada (logo + cores) + contraste validado.
- [ ] Terminologia ajustada (se Pro).
- [ ] Produtos importados/cadastrados (planilha ou manual).
- [ ] Funcionários cadastrados com roles corretas.
- [ ] Treinamento online de 1h realizado.
- [ ] Saldo inicial lançado (entrada/ajuste) para refletir estoque real.
- [ ] Relatório de estoque atual gerado e conferido com o cliente.
- [ ] Backup/health check monitorando.

---

## 7. Riscos por Fase e Critérios de "Pronto para o Próximo Épico"

| Fase | Risco-chave | Gate antes de avançar |
|---|---|---|
| Épico 1 | RT1 (Hostinger/Node), RT2 (isolamento) | spike de deploy ok + teste de isolamento verde |
| Épico 2 | RT4 (SSL/subdomínio), contraste quebrar UI | tema aplicado em produção + contraste validado |
| Épico 3 | Limites de plano só na UI | enforcement provado no backend (422) |
| Épico 4 | RT2/RT3 (isolamento + concorrência de saldo) | testes de concorrência + isolamento verdes |
| Épico 5 | RT6 (PDF pesado em shared hosting) | relatórios gerando com PDFKit dentro dos limites |
| Épico 6 | bugs em uso real | P0/P1 corrigidos; cliente operando |

---

## 8. Próximos passos
1. **@dev (Dex)** pega `docs/stories/` a partir da story 1.1 e implementa em ordem.
2. Cada story concluída → PR → CI → merge → deploy incremental.
3. Course corrections → escalar para `@aiox-master`.

_Story de exemplo detalhada (template para as demais): [`stories/1.3-auth-multitenant.md`](./stories/1.3-auth-multitenant.md)._

— River, removendo obstáculos 🌊
