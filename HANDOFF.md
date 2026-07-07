# DISTOK — Handoff de sessão

> Cole este arquivo (ou aponte para ele) ao iniciar uma nova sessão do Claude Code em outra máquina/pasta, junto com o `CLAUDE.md` do repo, para retomar o contexto sem precisar reexplicar tudo.

## ⚠️ Estado do git no momento deste handoff

Branch: `UPDT-Juliano` (1 commit à frente de `origin/main`, commit `4a8f3be`).

**Havia mudanças NÃO commitadas** na working tree no momento em que este arquivo foi gerado:
```
 M apps/web/src/features/customers/CustomersPage.tsx
 M apps/web/src/features/products/ProductsPage.tsx
 M apps/web/src/features/suppliers/SuppliersPage.tsx
 M apps/web/src/theme/tokens.css
?? apps/web/src/components/ui/BulkActionsBar.tsx
?? apps/web/src/hooks/useBulkSelection.ts
```
Se você for abrir o projeto em **outra máquina/clone**, essas mudanças só existirão lá se tiverem sido commitadas (e, se for outro clone, também dadas `push`). Se ainda estiverem como "unstaged" aqui, rode `git status` para confirmar antes de continuar em outro lugar.

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
| 12 | PDV aprimorado (barcode, troco, múltiplos pagamentos) | ⏳ Pendente — escopo grande |
| 13 | Lazy loading de rotas | ✅ Completo |
| 14 | Busca inteligente backend (accent-insensitive) | ✅ Completo |
| 15 | Preferências do usuário (densidade, toggle AppShell) | ✅ Completo |
| 16 | Validação inline de formulário + prevenção de perda | ✅ Completo |
| 17 | Ações em lote em tabelas (checkbox multi-select) | ✅ Completo (não commitado ainda — ver seção acima) |
| 18 | Histórico de auditoria UI (expandir além de clientes) | ⏳ Pendente |
| 19 | Acessibilidade (focus-visible, ARIA, skip-nav) | ✅ Completo |

### Detalhe do #17 (última sessão, ainda não commitado)

- `apps/web/src/hooks/useBulkSelection.ts` — hook genérico de seleção múltipla por id (toggle/toggleAll/clear/isSelected).
- `apps/web/src/components/ui/BulkActionsBar.tsx` — barra "N selecionados" + ações + botão cancelar.
- CSS `.bulk-bar` / `.bulk-col` em `apps/web/src/theme/tokens.css`.
- Aplicado em `ProductsPage`, `CustomersPage`, `SuppliersPage`: checkbox no header (seleciona tudo) + por linha. As ações em lote (inativar/reativar) chamam os endpoints singulares já existentes via `Promise.all` — **não foi criado endpoint bulk no backend**, propositalmente (menor escopo, reaproveita audit log já existente em cada rota).
- Validado com `npm run lint`, `npm run typecheck` (apps/web) e um teste funcional via API (login → PATCH inactivate em lote → confirmação no MySQL → reversão). Não foi validado clique-a-clique num browser real (sem chromium-cli/Playwright disponível no ambiente Windows usado).

## Próximos passos sugeridos

1. **Revisar e commitar o #17** (arquivos listados acima) antes de seguir.
2. **#12 — PDV aprimorado**: escopo grande — leitor de código de barras, cálculo de troco, múltiplos meios de pagamento. Ver `apps/web/src/features/sales` e `apps/web/src/features/cashier` como ponto de partida.
3. **#18 — Auditoria UI**: hoje só `CustomersPage` tem modal de histórico (`GET /customers/:id/history`). Expandir para outros módulos (produtos, fornecedores, estoque) — provavelmente generalizar num componente `HistoryModal` reutilizável + endpoints `.../:id/history` equivalentes nos services.

## Padrões de implementação (resumo — ver memória/CLAUDE.md para mais)

- Backend: `modules/<nome>/<nome>.routes.js` + `.service.js`, sempre via `TenantScopedRepository`, sempre `audit.record(...)` em mutations.
- Frontend: `features/<modulo>/<Modulo>Page.tsx`, `useState` simples (sem Redux), classes de `tokens.css`, ícones em `components/ui/icons.tsx`.
- Checklist de novo módulo, rotas, nav, etc.: ver `CLAUDE.md`.
