# DISTOK — Handoff de sessão

> Cole este arquivo (ou aponte para ele) ao iniciar uma nova sessão do Claude Code em outra máquina/pasta, junto com o `CLAUDE.md` do repo, para retomar o contexto sem precisar reexplicar tudo.

## ⚠️ Estado do git no momento deste handoff (atualizado — sessão 2026-07-13, tarde)

Branch: `UPDT-Juliano`. Ver `git status`/`git log` para confirmar o que já foi commitado vs. o que ainda está pendente desta sessão (backlog P0+P1 completo, ver seção própria abaixo).

**⚠️ Duas migrações novas pendentes de aplicar:**
- `apps/api/src/db/migrations/20260712000001_add_sale_payments.js` (tabela `sale_payments`) — de sessão anterior.
- `apps/api/src/db/migrations/20260713000001_cashier_multi_session.js` (coluna gerada + constraint única em `cashier_sessions`, ver detalhe do P0 #3 abaixo).

**⚠️ Nada foi validado contra banco real nesta sessão** — sem MySQL acessível no ambiente (`DB_HOST=localhost`, `ECONNREFUSED`). Validado com: `npm run lint`, `npm run typecheck` (web), e um smoke test que sobe o app Fastify inteiro e registra todas as rotas (`buildApp()` sem `listen()`/DB) — pega erro de import/schema/registro de rota, mas não substitui rodar de verdade. **Rode `npm run migrate` + `npm test` contra um banco real antes de considerar isso pronto pra produção.**

**Gotcha de ambiente resolvido nesta sessão:** se `require('@distok/shared')` (ou qualquer workspace `@distok/*`) der `MODULE_NOT_FOUND` mesmo com o pacote existindo em `packages/shared`, rode `npm install` na raiz — os symlinks/junctions do npm workspaces para `node_modules/@distok/*` podem ficar vazios/quebrados nesse ambiente Windows sem motivo aparente (não é erro de código).

## O que é o projeto

DISTOK — SaaS multi-tenant de gestão de estoque para distribuidoras. Node/Fastify (`apps/api`, JS puro) + React/Vite/TS (`apps/web`) + MySQL via Knex (Hostinger). Detalhes completos de arquitetura, convenções e o invariante de isolamento multi-tenant estão em `CLAUDE.md` (raiz do repo) — leia-o primeiro em qualquer sessão nova.

## Como rodar localmente

```bash
npm install
cp .env.example .env        # configurar DB_*, JWT_SECRET
npm run migrate
npm run seed                 # 1 super admin + 2 tenants demo
npm run dev                  # api :3000 + web :5173
```

Credenciais seed (todas com senha `distok123`):
- Super admin: `super@distok.com.br`
- Tenant `bebidassul`: `admin@bebidassul.com` / `operador@bebidassul.com`
- Tenant `atacadaox`: `admin@atacadaox.com` / `operador@atacadaox.com`

## Progresso — módulos de melhoria ERP/PDV (sessão jul/2026)

| # | Módulo | Status |
|---|---|---|
| 10 | Command Palette (Ctrl+K) | ✅ Completo |
| 11 | Alertas inteligentes (bell header + dashboard banner) | ✅ Completo |
| 12 | PDV aprimorado (barcode, troco, múltiplos pagamentos) | ✅ Implementado — falta validar contra banco real (ver seção do topo) |
| 13 | Lazy loading de rotas | ✅ Completo |
| 14 | Busca inteligente backend (accent-insensitive) | ✅ Completo |
| 15 | Preferências do usuário (densidade, toggle AppShell) | ✅ Completo |
| 16 | Validação inline de formulário + prevenção de perda | ✅ Completo |
| 17 | Ações em lote em tabelas (checkbox multi-select) | ✅ Completo e commitado |
| 18 | Histórico de auditoria UI (expandir além de clientes) | ✅ Completo |
| 19 | Acessibilidade (focus-visible, ARIA, skip-nav) | ✅ Completo |

### Detalhe do #18 (sessão 2026-07-12)

- `apps/api/src/utils/audit.js` ganhou `history(ctx, entityType, entityId)` compartilhado (antes só existia inline em `customers.service.js`).
- `products.service.js` e `suppliers.service.js` ganharam `history()` + rota `GET /:id/history` (adminOnly, mesmo padrão de clientes).
- `apps/web/src/components/ui/HistoryModal.tsx` — modal genérico extraído do que existia só em `CustomersPage`; reaplicado em `ProductsPage` e `SuppliersPage` (ícone de histórico por linha).
- **Estoque não recebeu esse recurso** — decisão deliberada: `stock.service.js` já tem `listMovements`/`listAllMovements`, um ledger completo e mais rico que o audit_log genérico, então adicionar histórico de auditoria ali seria redundante.

### Detalhe do #12 (sessão 2026-07-12)

- Escopo implementado inteiramente dentro de `SalesPage.tsx` (`SaleFormModal`), que é o fluxo de "Nova venda" (o PDV de fato — `CashierPage.tsx`/Caixa continua sendo só abertura/fechamento de caixa e lançamentos avulsos, não foi tocado).
- **Leitor de código de barras**: campo de busca de produto agora trata Enter como leitura de scanner — busca por SKU exato e adiciona direto ao carrinho sem precisar clicar (`handleScanEnter`). Não precisou de endpoint novo.
- **Múltiplos meios de pagamento**: nova tabela `sale_payments` (migração `20260712000001_add_sale_payments.js`) — cada venda agora tem 1+ linhas de pagamento (`method`, `amount`, `received_amount`, `change_amount`). `sales.service.js#create` valida que a soma dos pagamentos bate com o total da venda (tolerância de 1 centavo). `sales.payment_method` continua existindo (agora grava `'multiplo'` quando há mais de uma forma) para não quebrar quem só lê esse campo.
- **Cálculo de troco**: quando a forma é `dinheiro`, a UI mostra "valor recebido" e calcula o troco (`received_amount - amount`), persistido em `change_amount` por linha de pagamento.
- Rota `POST /sales` aceita `payments: [{ method, amount, receivedAmount? }]` — mantém `paymentMethod` (string única) como fallback caso algum outro caller antigo ainda mande só isso.
- **NÃO validado contra banco real** nesta sessão (sem MySQL acessível no ambiente) — só `npm run lint`, `npm run typecheck` (apps/web) e `node -c` nos arquivos backend. **Antes de dar como pronto**: rodar `npm run migrate`, abrir o app, registrar uma venda com (a) pagamento único em dinheiro com troco, (b) pagamento dividido em duas formas, (c) tentar escanear/"Enter" num SKU existente.

## Backlog de produção P0+P1 (sessão 2026-07-13, tarde) — todos implementados

Ver `BACKLOG.md` para a lista completa com racional de cada item; resumo do que mudou:

- **P0 #1 (paginação)**: `products.service.js#list` e `stock.service.js#listBalance` agora retornam `{items,total,page,pages}` como `customers`/`suppliers` já faziam. Isso quebrava os outros lugares que chamam `GET /products` esperando array plano (busca rápida no PDV, Compras, Command Palette) — todos ajustados para ler `data.items ?? data` defensivamente.
- **P0 #2 (recibo)**: impressão via `window.print()` + `@media print` isolando um `#receipt-print` (padrão "esconde tudo, mostra só isso"), botão no detalhe da venda em `SalesPage.tsx`.
- **P0 #3 (multi-caixa)**: `cashier_sessions` agora tem 1 sessão aberta **por operador**, não por tenant — via coluna gerada `open_lock` + `UNIQUE KEY` (migração `20260713000001_cashier_multi_session.js`), não só checagem em código. Operador só vê/mexe no próprio caixa (`getSession`/`addEntry` checam `ctx.isAdmin || session.user_id === ctx.userId`); admin continua vendo/fechando qualquer um.
- **P0 #4 + P1 #7 parcial (testes + locks)**: suítes novas em `tests/{sales,purchases,cashier,financial,auth}/`. Ao escrever os testes de produtos/estoque existentes, achei que eu mesmo tinha quebrado `products.service.test.js` e `stock.service.test.js` com a mudança de paginação (P0 #1) — corrigido.
- **P1 #5 (Sentry)**: `apps/api/src/utils/sentry.js`, ativa só com `SENTRY_DSN` no `.env` (senão no-op). Falta criar o projeto em sentry.io e preencher a variável — não fiz isso, não tenho como.
- **P1 #6 (backup)**: `scripts/backup-db.sh` (mysqldump + gzip + rotação local). Falta agendar no Cron Job do hPanel e definir `BACKUP_OFFSITE_CMD` — sem isso o backup não sai do mesmo servidor. Instruções em `docs/deploy-hostinger.md` §8.
- **P1 #7 (locks)**: caixa coberto acima; limite de plano (`assertCanAddUser`/`assertCanAddProduct`) agora trava a linha do tenant (`FOR UPDATE`) dentro da mesma transação da checagem+insert, em vez de checar antes e inserir depois separadamente.
- **P1 #8 (estorno de compra)**: `purchases.service.js#cancel` agora reverte a entrada de estoque de um pedido confirmado (bloqueia se o produto já foi parcialmente consumido). Não tenta refazer o custo médio ponderado — não dá pra reconstruir com precisão se houve outra compra/venda do mesmo produto no meio tempo.
- **P1 #9 (financeiro integrado)**: venda em boleto/cheque → conta a receber automática; compra confirmada → conta a pagar automática (vencimento padrão 30 dias, sem campo de prazo no pedido). Cancelar venda/estornar compra cancela os lançamentos pendentes vinculados.

## Próximos passos sugeridos

1. Rodar `npm run migrate` + `npm test` contra um MySQL real e validar manualmente o checklist da seção "Antes de considerar P0+P1 prontos" em `BACKLOG.md`.
2. Configurar `SENTRY_DSN` e agendar `scripts/backup-db.sh` no hPanel.
3. Seguir para o P2 do `BACKLOG.md` (import CSV de produtos, onboarding, mobile) ou revisitar `docs/prd.md` para o próximo conjunto de melhorias.

## Padrões de implementação (resumo — ver memória/CLAUDE.md para mais)

- Backend: `modules/<nome>/<nome>.routes.js` + `.service.js`, sempre via `TenantScopedRepository`, sempre `audit.record(...)` em mutations.
- Frontend: `features/<modulo>/<Modulo>Page.tsx`, `useState` simples (sem Redux), classes de `tokens.css`, ícones em `components/ui/icons.tsx`.
- Checklist de novo módulo, rotas, nav, etc.: ver `CLAUDE.md`.
