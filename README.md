# DISTOK

SaaS multi-tenant de gerenciamento de estoque para distribuidoras.

- **Backend:** Node.js (Fastify) + Knex + MySQL — `apps/api`
- **Frontend:** React + Vite + TypeScript — `apps/web`
- **Compartilhado:** enums/constantes — `packages/shared`
- **Deploy:** GitHub → Node app na Hostinger (Passenger) + MySQL da Hostinger

## Documentação
- [PRD](docs/prd.md) · [Arquitetura](docs/architecture.md) · [Design/UX](docs/ux-design.md) · [Trilha de dev](docs/workflow.md)
- **Deploy (handoff p/ o dev de deploy):** [Guia Hostinger](docs/deploy-hostinger.md) · [Banco de dados](docs/database.md) · [schema.sql](docs/schema.sql)

## Funcionalidades (MVP completo)
- **Multi-tenant** com isolamento na aplicação (sem RLS) + RBAC (super_admin/admin/operator)
- **White-label** por tenant (cores/logo/nome/terminologia, contraste WCAG AA, gating por plano)
- **Cadastros**: produtos (margem, inativação, busca) e funcionários (roles, senha temp)
- **Estoque**: entrada/saída/ajuste transacional, saldo materializado, concorrência segura, auditoria imutável, alerta de mínimo
- **Relatórios** PDF/CSV branded (estoque, movimentações, auditoria, abaixo do mínimo) + **dashboard**
- **Super Admin**: gestão de tenants, planos e métricas (MRR)

## Setup local
```bash
cp .env.example .env          # ajuste DB_* e JWT_SECRET
npm install                   # instala workspaces
npm run migrate               # cria o schema no MySQL
npm run seed                  # popula dados de demonstração
npm run dev                   # sobe api (:3000) e web (:5173)
```
> Requer um MySQL acessível (local ou Hostinger). Veja `.env.example`.

## Scripts
| Comando | O quê |
|---|---|
| `npm run dev` | api + web em paralelo |
| `npm run migrate` | aplica migrations |
| `npm run seed` | dados de demonstração (1 super admin, 2 tenants) |
| `npm test` | testes (isolamento, estoque, rbac) |
| `npm run lint` | ESLint (inclui regra anti-bypass de tenant) |

## Status
MVP completo (Épicos 1–6 implementados). Deploy na Hostinger: ver [docs/deploy-hostinger.md](docs/deploy-hostinger.md).
