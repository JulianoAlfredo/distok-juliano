# DISTOK — Banco de Dados (para o dev de deploy)

Banco: **MySQL** (InnoDB, utf8mb4). 10 tabelas. IDs são `CHAR(36)` (UUID gerado pela aplicação).
O isolamento entre distribuidoras (tenants) é feito **na aplicação** por `tenant_id` — o MySQL não usa RLS.

## Tabelas
| Tabela | Para que serve |
|---|---|
| `plans` | Planos (Básico/Pro): limites de usuários/produtos e features (csv, terminologia, etc.) |
| `tenants` | Distribuidoras (cada uma é um tenant), com slug/subdomínio, CNPJ, plano e status |
| `users` | Usuários: super_admin (sem tenant), admin e operator (por tenant) |
| `tenant_branding` | White-label: cores, logo, nome, rodapé por tenant |
| `tenant_terminology` | Rótulos personalizados por tenant (ex.: "Produto" → "Item") |
| `products` | Produtos (custo, revenda, estoque mínimo, SKU) |
| `stock_movements` | Movimentações (entrada/saída/ajuste) — **append-only**, com saldo após e IP |
| `stock_balance` | Saldo atual por produto (materializado, atualizado em transação) |
| `audit_log` | Auditoria imutável (quem fez o quê, quando) |
| `password_resets` | Tokens de redefinição de senha |

## Como criar o schema — escolha UMA via

### Via 1 — pelo app (recomendado, versionado)
As migrations ficam em `apps/api/src/db/migrations/` e são aplicadas por:
```bash
npm run migrate     # cria/atualiza todas as tabelas no banco do .env
```
Vantagem: controle de versão (tabela `knex_migrations`), idempotente, e migrations futuras aplicam só o que falta.

### Via 2 — manual pelo phpMyAdmin (sem Node)
1. Crie o banco vazio no hPanel.
2. phpMyAdmin → selecione o banco → aba **Importar** → envie [`docs/schema.sql`](./schema.sql).
3. Depois, quando for rodar o app, registre o controle de migration para o futuro:
   ```bash
   npx knex migrate:latest --knexfile apps/api/src/db/knexfile.js
   ```
   (se acusar que as tabelas já existem, marque a migration inicial como aplicada).

## Dados iniciais (seed)
Cria o super admin + 2 tenants demo (senhas hash bcrypt — por isso é feito pelo app, não por SQL):
```bash
npm run seed        # rode SOMENTE no primeiro deploy
```
Credenciais demo: `super@distok.com.br` / `distok123` (troque em produção).

## Conexão (o que o app espera no .env)
```
DB_HOST=localhost      # ou host indicado pela Hostinger
DB_PORT=3306
DB_NAME=u123456_distok # nome completo com prefixo
DB_USER=u123456_distok
DB_PASS=********        # nunca versionar
```
Detalhes e demais variáveis: [`.env.production.example`](../.env.production.example) e [`deploy-hostinger.md`](./deploy-hostinger.md).

## Observações importantes
- `stock_movements` e `audit_log` são **append-only** por design (a aplicação nunca faz UPDATE/DELETE neles). Correção de estoque = novo lançamento de **ajuste**.
- `stock_balance` é atualizado na **mesma transação** da movimentação (com `SELECT ... FOR UPDATE`) — não edite manualmente.
- Crie sempre o banco com **utf8mb4** (já garantido pelo schema/migrations).
