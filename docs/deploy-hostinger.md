# DISTOK — Guia de Deploy & Configuração (handoff para o dev de deploy)

> **Para quem vai fazer o deploy:** este documento é autossuficiente. Você **não precisa** ter participado do desenvolvimento. Siga as fases em ordem. Ao final, o DISTOK estará no ar na Hostinger com o banco configurado.
> Stack: **GitHub → API Node.js (Fastify, via Passenger) + Frontend React estático + MySQL**, tudo na Hostinger.

---

## ⭐ TL;DR — Resumo rápido (leia isto primeiro)

| Pergunta | Resposta |
|---|---|
| **É Next ou Express?** | **Nenhum dos dois no sentido de SSR.** Backend é **app Node persistente (Fastify)** — você deploya como deployaria um Express, via **Setup Node.js App / Passenger**. Frontend é **React (Vite) estático** — só arquivos, sem Node. **NÃO é Next.js, não tem SSR.** |
| **Tipo de deploy** | 2 partes: (1) **Node app** para `apps/api` (Passenger); (2) **arquivos estáticos** de `apps/web/dist` numa pasta pública. |
| **Versão do Node** | **LTS ≥ 18** (recomendado **Node 20**). Definida no painel "Setup Node.js App". |
| **Startup file da API** | `src/server.js` · **Application root** = `.../apps/api` |
| **Banco** | **MySQL** (utf8mb4). Crie banco + usuário no hPanel; rode `npm run migrate` (ou importe `docs/schema.sql` no phpMyAdmin). NÃO precisa criar tabela manualmente. |
| **Envs OBRIGATÓRIAS (API)** | `NODE_ENV=production`, `PORT=3000`, `APP_BASE_URL` (URL do front), `ROOT_DOMAIN`, `JWT_SECRET` (forte), `DB_HOST`, `DB_PORT=3306`, `DB_NAME`, `DB_USER`, `DB_PASS`. Modelo completo: `.env.production.example`. |
| **Envs do FRONT** | `VITE_API_URL` no build (ex.: `https://api.distok.com.br/api/v1`) — ou vazio se a API ficar no mesmo domínio via proxy. Modelo: `apps/web/.env.example`. |
| **E-mail (opcional)** | `MAIL_SMTP_*` e `MAIL_FROM`. Sem isso, o sistema só loga os e-mails (não envia senha temp/reset), mas funciona. |
| **Ordem prática** | criar banco → criar Node app → preencher `.env` → `npm ci` → `npm run migrate` → (1ª vez) `npm run seed` → `npm run build` → publicar `dist/` → **Restart** → testar `/health`. |
| **Atalho** | `bash scripts/deploy.sh` faz install+migrate+build+publish de uma vez. |

> Detalhes de cada item nas seções abaixo.

---

## 0. Entenda a arquitetura em 1 minuto

O DISTOK tem **duas aplicações** + **um banco**:

| Componente | O que é | Onde roda |
|---|---|---|
| **API** (`apps/api`) | Servidor Node.js (Fastify) — REST API. Fica **rodando** (processo persistente). | **Setup Node.js App** da Hostinger (Passenger) |
| **Frontend** (`apps/web`) | React + Vite → vira **HTML/CSS/JS estático** (pasta `dist/`). | Pasta pública do domínio (estático, sem Node) |
| **Banco** | **MySQL** | MySQL da Hostinger |

> ⚠️ **Não é Next.js.** Não há SSR. O front é um SPA estático e fala com a API por HTTP. Por isso há um detalhe importante de configuração de URL da API — ver **Fase 5**.

**Isolamento multi-tenant:** cada distribuidora é um tenant; o sistema separa os dados por `tenant_id` na aplicação (o MySQL não tem RLS). Cada tenant acessa por **subdomínio** (`cliente.distok.com.br`).

---

## 1. Pré-requisitos (confirme antes de começar — risco crítico)

No **hPanel** da Hostinger, confirme que o plano tem:
1. **Avançado → Node.js** (também chamado "Setup Node.js App"). **Se não existir, o backend não roda** — seria necessário VPS. Cheque isto **primeiro**.
2. **Avançado → Acesso SSH** (para rodar `npm`/migrations).
3. **Bancos de dados → MySQL**.
4. Um domínio (ex.: `distok.com.br`) apontando para a Hostinger.

Você também vai precisar de acesso ao repositório GitHub `jotacraq/distok`.

---

## 2. Criar o banco MySQL

hPanel → **Bancos de dados → Gerenciamento de bancos MySQL** → **Criar**:
- Banco: ex. `distok` → a Hostinger gera o nome completo `u123456_distok`.
- Usuário: crie um (vira `u123456_distok`) e **dê todos os privilégios** a ele nesse banco.
- Senha: gere uma forte e **guarde** (vai no `.env`, nunca no Git).

Anote: `DB_NAME`, `DB_USER`, `DB_HOST` (geralmente `localhost`; se o painel indicar outro host/IP, use-o).

> **As tabelas** são criadas depois (Fase 4.3) por `npm run migrate`. Se preferir criar o schema **sem Node** (direto no phpMyAdmin), importe [`docs/schema.sql`](./schema.sql). Tudo sobre o banco está em [`docs/database.md`](./database.md).

---

## 3. Obter o código no servidor

Opção recomendada — **Git da Hostinger** (hPanel → Avançado → **Git**):
- Repositório: `https://github.com/jotacraq/distok` · Branch: `main`.
- Defina o diretório de deploy (ex.: `domains/distok.com.br/distok`).
- (Opcional) ative auto-deploy no push.

Alternativa — **SSH**:
```bash
cd ~/domains/distok.com.br
git clone https://github.com/jotacraq/distok.git
```

---

## 4. Configurar e subir a API (Node app)

### 4.1 Criar o Node app
hPanel → **Avançado → Node.js → Create application**:
- **Node version:** LTS (≥ 18).
- **Application root:** a pasta do repo + `/apps/api` (ex.: `domains/distok.com.br/distok/apps/api`).
- **Application startup file:** `src/server.js`.
- **Application URL:** um subdomínio para a API, ex.: `api.distok.com.br`.

### 4.2 Variáveis de ambiente
Crie o arquivo **`.env` na raiz do repo** (NÃO em apps/api) a partir do modelo:
```bash
cp .env.production.example .env
# edite .env e preencha JWT_SECRET, DB_*, MAIL_*, UPLOADS_*, APP_BASE_URL, ROOT_DOMAIN
```
> Todas as variáveis estão explicadas dentro do `.env.production.example`. O `JWT_SECRET` pode ser gerado com `openssl rand -hex 32`.
> Alternativamente, dá para cadastrar as variáveis direto no painel do Node app — mas o `.env` na raiz é mais simples e o código já o lê.

### 4.3 Instalar, migrar e (1ª vez) semear
Via **SSH**, na raiz do repo. Você pode usar o script pronto:
```bash
# primeiro deploy (cria super admin + dados demo):
RUN_SEED=yes PUBLISH_DIR=~/public_html bash scripts/deploy.sh

# deploys seguintes (sem recriar dados):
PUBLISH_DIR=~/public_html bash scripts/deploy.sh
```
Ou manualmente:
```bash
npm ci
npm run migrate     # cria/atualiza TODAS as tabelas no seu banco
npm run seed        # SOMENTE no primeiro deploy
```

### 4.4 Iniciar
No painel do Node app, clique em **Restart**. Teste:
```bash
curl https://api.distok.com.br/health      # deve responder {"status":"ok", ...}
```

---

## 5. Configurar e publicar o Frontend (estático) — ATENÇÃO à URL da API

O front precisa saber **onde está a API**. Há duas formas (escolha UMA):

**Opção A — API em subdomínio próprio (recomendada):**
Antes do build, defina a URL da API:
```bash
cp apps/web/.env.example apps/web/.env
# edite e coloque:
#   VITE_API_URL=https://api.distok.com.br/api/v1
```
Garanta que `APP_BASE_URL` no `.env` da API = URL do front (para o CORS liberar).

**Opção B — API no mesmo domínio do front (via proxy):**
Deixe `VITE_API_URL` em branco (o front usa `/api/v1` relativo) e configure um proxy reverso no `.htaccess` do front (há uma regra comentada em `apps/web/public/.htaccess`) encaminhando `/api` para a porta do Node app.

### Build e publicação
```bash
npm run build                 # gera apps/web/dist
# publique o conteúdo de apps/web/dist na pasta pública do domínio do front
# (o script deploy.sh já faz a cópia para PUBLISH_DIR)
```
O `apps/web/public/.htaccess` (incluído no build) faz o **fallback de SPA** do React Router — necessário para as rotas funcionarem ao recarregar a página.

---

## 6. Domínios, subdomínios e SSL (multi-tenant)

- **Frontend:** publique no domínio/subdomínio escolhido (ex.: `app.distok.com.br`).
- **Wildcard DNS:** crie `*.distok.com.br` apontando para o mesmo front, para que `cliente.distok.com.br` resolva (o sistema identifica o tenant pelo subdomínio).
- **SSL (Let's Encrypt no hPanel):** ative para `distok.com.br`, `app.`, `api.`. Se o plano permitir **wildcard SSL** (`*.distok.com.br`), ative; senão, emita SSL por subdomínio conforme cadastra cada cliente.
- **Domínio próprio do cliente (plano Pro):** CNAME do domínio dele → front + registre em `tenants.custom_domain`.

---

## 7. Verificação pós-deploy (smoke test)

1. `GET https://api.distok.com.br/health` → `{"status":"ok"}`.
2. Acesse o front. Faça login como **Super Admin** (do seed): `super@distok.com.br` / `distok123`.
3. Em **Distribuidoras**, crie um tenant de teste → confira se o e-mail de credenciais chega (se SMTP configurado).
4. Acesse `https://<slug>.distok.com.br` → a tela de login deve aparecer **com o tema** daquele tenant.
5. Logue como admin do tenant, troque a senha, cadastre um produto e lance uma movimentação.

> **Troque/!remova as senhas do seed em produção.** Idealmente rode o seed só uma vez (ou crie o super admin manualmente e não rode o seed).

---

## 8. Operação contínua

- **Atualizações:** `git pull` na pasta do repo → `bash scripts/deploy.sh` → **Restart** do Node app.
- **Migrations:** sempre versionadas; `npm run migrate` é idempotente (só aplica o que falta).
- **Backup:** `scripts/backup-db.sh` faz o `mysqldump` (consistente, comprimido, com rotação local). Agende no hPanel:
  1. **hPanel → Avançado → Cron Job** → novo job diário (ex.: 3h da manhã).
  2. Comando: `bash /caminho/do/repo/scripts/backup-db.sh >> /caminho/do/repo/backup.log 2>&1`.
  3. Por padrão o backup fica só local em `~/distok-backups` (retenção de 14 dias, `BACKUP_RETENTION_DAYS` no `.env` pra mudar). Para RPO ≤ 24h de verdade, isso **não é suficiente sozinho** — defina `BACKUP_OFFSITE_CMD` no `.env` com um comando que copie o arquivo pra fora do servidor (ex.: `rclone copy` pra um storage externo, `scp` pra outra máquina). Sem isso, um problema no próprio servidor Hostinger derruba backup e app juntos.
  4. Também ative o backup nativo do MySQL no hPanel como camada extra (não substitui o passo acima — é gerenciado pela Hostinger, sem controle de retenção/versionamento seu).
- **Alerting de erro:** defina `SENTRY_DSN` no `.env` (crie um projeto Node em sentry.io) para receber alerta em erro 500 de produção. Sem essa variável, o app roda normal e só loga localmente, como antes.
- **Logs:** stdout do Node app (painel do Node.js).
- **Monitoramento:** aponte um monitor externo (ex.: UptimeRobot) para `/health`.
- **CI:** o `.github/workflows/ci.yml` roda lint + migrations + testes + build a cada PR/push em `main` — não faz o deploy (isso é manual/Git da Hostinger), mas garante que o que está em `main` é íntegro.

---

## 9. Troubleshooting (problemas comuns)

| Sintoma | Causa provável | Solução |
|---|---|---|
| `/health` não responde | Node app não iniciou | Veja logs no painel Node.js; confirme `startup file = src/server.js` e Node ≥ 18 |
| API sobe mas `/health` dá erro de DB | `DB_*` errados ou usuário sem privilégio | Revise `.env`; teste credenciais; confirme `DB_HOST` |
| Front carrega mas toda chamada dá erro de CORS | `APP_BASE_URL` ≠ URL real do front | Ajuste `APP_BASE_URL` no `.env` da API e reinicie |
| Front carrega mas não fala com a API | `VITE_API_URL` não setado no build (Opção A) ou proxy ausente (Opção B) | Veja a **Fase 5** |
| Recarregar uma rota (ex.: /produtos) dá 404 | `.htaccess` de SPA ausente | Confirme que `apps/web/dist/.htaccess` foi publicado |
| Subdomínio do tenant não tematiza | DNS wildcard ausente ou slug errado | Configure `*.distok.com.br`; confira o `slug` do tenant |
| E-mails não chegam | SMTP não configurado | Preencha `MAIL_*` no `.env` (sem isso o sistema só loga e segue) |

---

## 10. Checklist de Onboarding do 1º Cliente

- [ ] Logado como Super Admin, criar a distribuidora (**Distribuidoras → Nova**: nome, CNPJ, slug, plano, admin).
- [ ] Subdomínio `cliente.distok.com.br` provisionado + SSL.
- [ ] Admin recebe e-mail com senha temporária → 1º login → troca de senha.
- [ ] Admin aplica a **marca** (logo + cores) em **Marca**; contraste validado.
- [ ] (Pro) ajusta **terminologia** e rodapé de relatório.
- [ ] Cadastra **produtos** e **funcionários** com as roles corretas.
- [ ] Lança o **saldo inicial** (entrada/ajuste) refletindo o estoque real.
- [ ] Gera o **relatório de estoque atual** e confere com o cliente.
- [ ] Treinamento de 1h realizado.
- [ ] Backup do MySQL ativo + monitor em `/health`.

---

## 11. Referência rápida de credenciais demo (após `npm run seed`)
- Super Admin: `super@distok.com.br` / `distok123`
- Admin (tenant Pro "Bebidas Sul"): `admin@bebidassul.com` / `distok123`
- Operador: `operador@bebidassul.com` / `distok123`

> Demo apenas. Em produção, troque tudo.

---

## 12. Onde está cada coisa no repo
- `.env.production.example` — modelo das variáveis da API (explicadas).
- `apps/web/.env.example` — modelo da variável do front (`VITE_API_URL`).
- `scripts/deploy.sh` — instala, migra, builda e publica (rodar via SSH).
- `apps/api/src/db/migrations/` — schema (aplicado por `npm run migrate`).
- `apps/api/src/db/seeds/` — dados iniciais (`npm run seed`).
- `apps/web/public/.htaccess` — fallback de SPA (+ regra de proxy comentada).
- `docs/` — PRD, arquitetura, UX, workflow (contexto do produto, se precisar).
