# DISTOK — Backlog de produção

> Gerado a partir da auditoria de negócio de 2026-07-13 (robustez de backend + completude de produto). Organizado por prioridade: **P0 bloqueia produção com uso diário real**, **P1 importante antes de escalar para vários tenants pagantes**, **P2 reduz fricção comercial**. Ver conversa da sessão para o racional completo de cada item.
>
> **Atualização 2026-07-13 (mesmo dia, sessão seguinte): P0 e P1 implementados.** Ver detalhe de cada item abaixo e `HANDOFF.md` para o que falta validar antes de produção (sem MySQL acessível no ambiente de desenvolvimento usado, nada disso rodou contra banco real — só lint, typecheck e um smoke test de build/registro de rotas do app inteiro).

## P0 — Bloqueadores para produção — ✅ todos implementados

| # | Item | Onde | Status |
|---|---|---|---|
| 1 | Paginação real em Produtos e Saldo de Estoque | `products.service.js#list`, `stock.service.js#listBalance`, `ProductsPage.tsx`, `StockPage.tsx` | ✅ Retornam `{items,total,page,pages}`; UI com paginação. Ajustados os outros consumidores de `/products` (busca rápida no PDV/Compras/Command Palette) que esperavam array plano. |
| 2 | Recibo de venda para impressão | `SalesPage.tsx`, `tokens.css` (`@media print`) | ✅ Botão "Imprimir recibo" no detalhe da venda; recibo com marca do tenant, itens, pagamentos e troco, via `window.print()` + CSS que isola só o recibo na impressão. |
| 3 | Suportar múltiplos caixas abertos simultâneos por tenant | `cashier.service.js`, migração `20260713000001_cashier_multi_session.js` | ✅ Redesenhado para 1 caixa aberto **por operador** (não por tenant), com coluna gerada + constraint única no banco (não só checagem em app). Operador só vê/mexe no próprio caixa; admin vê/fecha qualquer um. |
| 4 | Cobertura de testes em Vendas, Compras, Caixa, Financeiro, Auth | `apps/api/tests/{sales,purchases,cashier,financial,auth}/` | ✅ Suítes novas cobrindo os fluxos principais e as regras novas (troco, pagamento dividido, boleto→AR, estorno de compra, multi-caixa, lock, login). Não executadas contra banco real neste ambiente — ver nota no topo. |

## P1 — Antes de escalar para vários tenants pagantes — ✅ todos implementados

| # | Item | Onde | Status |
|---|---|---|---|
| 5 | Logging de erros de produção com alerting (Sentry ou equivalente) | `apps/api/src/utils/sentry.js`, `error-handler.js`, `app.js` | ✅ `@sentry/node` instalado; ativa só se `SENTRY_DSN` estiver no `.env` (senão no-op, comportamento igual a antes). Falta você criar o projeto em sentry.io e preencher a variável. |
| 6 | Automatizar backup do MySQL | `scripts/backup-db.sh`, `docs/deploy-hostinger.md` §8 | ✅ Script pronto (dump + compressão + rotação local). **Falta agendar de fato** no Cron Job do hPanel (instruções no doc) e definir `BACKUP_OFFSITE_CMD` — sem isso o backup fica só no mesmo servidor. |
| 7 | Lock/constraint em pontos de corrida: abertura de caixa e limites de plano | `cashier.service.js`, `plan-guard.js`, `products.service.js`, `users.service.js` | ✅ Caixa: constraint única no banco (item #3). Limite de plano: `SELECT ... FOR UPDATE` na linha do tenant dentro da mesma transação da checagem+insert, em `products.create` e `users.create`. |
| 8 | Permitir cancelar/estornar compra confirmada | `purchases.service.js#cancel` | ✅ Estorna a entrada de estoque (bloqueia se o produto já foi parcialmente consumido). Não tenta desfazer o recálculo de custo médio (não é seguro de reconstruir com precisão). |
| 9 | Integrar Financeiro com Vendas/Compras | `sales.service.js`, `purchases.service.js`, `financial.service.js` | ✅ Venda com pagamento em boleto/cheque gera conta a receber; confirmar compra gera conta a pagar (vencimento padrão de 30 dias). Cancelar/estornar cancela os lançamentos pendentes vinculados. |

## P2 — Reduz fricção comercial / onboarding

| # | Item | Onde | Por quê importa | Esforço |
|---|---|---|---|---|
| 10 | Importação de planilha (CSV) de produtos | novo endpoint em `products` + tela de import | Cadastrar catálogo de centenas de itens 100% manual hoje inviabiliza onboarding rápido de cliente novo | M |
| 11 | Wizard/checklist de onboarding in-app | frontend, novo | Hoje admin descobre tudo sozinho; só existe troca de senha obrigatória no 1º login | M |
| 12 | Validar/reforçar responsividade mobile | `apps/web/src/theme/tokens.css`, `AppShell.tsx` | Pouco testado (2 media queries no CSS todo); importante para uso em tablet de balcão | S/M |

## Antes de considerar P0+P1 prontos pra produção de verdade

Nada disso foi validado contra um banco MySQL real nesta sessão (ambiente sem MySQL acessível). Antes do primeiro cliente pagante:

1. Rodar `npm run migrate` (inclui a migração nova do caixa multi-sessão) e `npm test` de ponta a ponta contra um banco real.
2. Testar manualmente: paginação com >25 produtos, imprimir um recibo de verdade, dois operadores abrindo caixa ao mesmo tempo, estornar uma compra confirmada, venda em boleto virando conta a receber.
3. Configurar `SENTRY_DSN` e agendar `scripts/backup-db.sh` (com `BACKUP_OFFSITE_CMD`) no Cron Job do hPanel.

## Sequenciamento sugerido — P2 (não iniciado)

Conforme a demanda comercial for pedindo — import CSV (#10) tende a virar bloqueador de venda se o cliente-alvo tiver catálogo grande.
