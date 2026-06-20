# DISTOK — Guia de Deploy na Hostinger

> Implementa o **Épico 6** (stories 6.1–6.4). Stack: GitHub → Node app (Passenger) + MySQL, ambos na Hostinger.
> ⚠️ Antes de tudo, **valide o risco RT1**: confirme que seu plano Hostinger permite **Setup Node.js App** (Node persistente) + acesso ao MySQL.

---

## 1. Pré-requisitos
- Plano Hostinger com **Node.js (Setup Node.js App)** e **MySQL**.
- Domínio `distok.com.br` (ou o seu) apontado para a Hostinger.
- Acesso SSH habilitado (hPanel → Avançado → SSH).
- Repositório no GitHub: `jotacraq/distok`.

---

## 2. Banco de dados (MySQL)
1. hPanel → **Bancos de dados MySQL** → criar banco `uXXXX_distok` + usuário + senha.
2. Anote `DB_HOST` (geralmente `localhost`), `DB_NAME`, `DB_USER`, `DB_PASS`.
3. (Opcional) criar `uXXXX_distok_test` para um ambiente de homologação.

---

## 3. Backend — Node app (Passenger)
1. hPanel → **Avançado → Node.js / Setup Node.js App** → **Create application**.
   - **Node version:** LTS suportada (≥ 18).
   - **Application root:** pasta do deploy (ex.: `domains/distok.com.br/repo/apps/api`).
   - **Application startup file:** `src/server.js`.
   - **Application URL:** subdomínio da API, ex.: `api.distok.com.br`.
2. Defina as **variáveis de ambiente** (no painel do Node app ou em `.env` fora do webroot):
   ```
   NODE_ENV=production
   PORT=3000
   APP_BASE_URL=https://app.distok.com.br
   ROOT_DOMAIN=distok.com.br
   JWT_SECRET=<gere um segredo forte>
   BCRYPT_ROUNDS=12
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=uXXXX_distok
   DB_USER=uXXXX_distok
   DB_PASS=<senha>
   MAIL_SMTP_HOST=...  MAIL_SMTP_PORT=587  MAIL_SMTP_USER=...  MAIL_SMTP_PASS=...
   MAIL_FROM="DISTOK <no-reply@distok.com.br>"
   UPLOADS_DIR=/home/uXXXX/distok-uploads
   UPLOADS_PUBLIC_URL=https://api.distok.com.br/uploads
   ```
3. **Deploy do código** (uma das opções):
   - **Git da Hostinger** (hPanel → Git): conectar `jotacraq/distok`, branch `main`, auto-deploy on push.
   - ou **SSH**: `git clone`/`git pull` na pasta do app.
4. Via **SSH**, na raiz do repo:
   ```bash
   npm ci
   npm run migrate          # cria/atualiza o schema no MySQL de produção
   npm run seed             # SOMENTE no primeiro deploy / ambiente demo (cria super admin)
   ```
5. No painel do Node app, clique em **Restart** (Passenger recarrega o `server.js`).
6. Teste: `https://api.distok.com.br/health` deve responder `{"status":"ok"}`.

> O `server.js` detecta o Passenger automaticamente; fora dele escuta em `PORT`.

---

## 4. Frontend — build estático
1. Build local ou via CI:
   ```bash
   npm run build            # gera apps/web/dist
   ```
2. Configure o frontend para apontar à API. Em produção, o front chama `/api/...`; aponte via:
   - subdomínio próprio + proxy, **ou**
   - ajuste o `baseURL` do axios para `https://api.distok.com.br/api/v1` (variável de build).
3. Publique o conteúdo de `apps/web/dist` em `public_html` (ou no subdomínio `app.distok.com.br`).
4. O arquivo `.htaccess` (já incluído em `apps/web/public/.htaccess`) faz o fallback SPA do React Router.

---

## 5. Domínios, subdomínios e SSL (multi-tenant)
- **Wildcard DNS:** `*.distok.com.br` → mesmo app do frontend, para que `cliente.distok.com.br` resolva e o `tenant-resolver` identifique o tenant pelo Host.
- **SSL:** hPanel → SSL (Let's Encrypt). Se o plano permitir **wildcard SSL**, ative para `*.distok.com.br`; senão, provisione SSL por subdomínio no onboarding de cada cliente.
- **Domínio próprio do cliente (plano Pro):** CNAME do domínio do cliente → app + registre em `tenants.custom_domain` + emita SSL.

---

## 6. CI/CD
- O `.github/workflows/ci.yml` roda lint + migrations + testes + build a cada PR/push.
- O deploy em si é disparado pela **integração Git da Hostinger** ao receber push em `main` (segredos ficam fora do GitHub).
- Pós-pull recomendado (hook/SSH): `npm ci && npm run migrate && npm run build`.

---

## 7. Checklist de Onboarding do 1º Cliente (Story 6.4)
- [ ] Logado como **Super Admin** (`super@distok.com.br` no seed), criar a distribuidora em **Distribuidoras → Nova** (nome, CNPJ, slug, plano, admin).
- [ ] Subdomínio `cliente.distok.com.br` provisionado + SSL.
- [ ] Admin recebe e-mail com senha temporária e faz 1º login → troca de senha.
- [ ] Admin aplica a **marca** (logo + cores) em **Marca**; contraste validado.
- [ ] (Pro) Ajusta **terminologia** e rodapé de relatório.
- [ ] Cadastra **produtos** (manual ou importação futura) e **funcionários** com as roles corretas.
- [ ] Lança o **saldo inicial** (entrada/ajuste) refletindo o estoque real.
- [ ] Gera o **relatório de estoque atual** e confere com o cliente.
- [ ] Treinamento online de 1h realizado.
- [ ] Monitoramento: `GET /health` + rotina de **backup** do MySQL ativa.

---

## 8. Operação
- **Health:** `GET /api/v1/.../health` (use um monitor externo gratuito, ex. UptimeRobot).
- **Backup:** rotina de backup do MySQL da Hostinger + `mysqldump` agendado off-site (RPO ≤ 24h).
- **Logs:** stdout do Node app (painel) — nível por `NODE_ENV`.
- **Rollback:** `git revert`/checkout da `main` + `npm run migrate` (migrations versionadas).

---

## 9. Credenciais demo (seed)
Após `npm run seed`:
- Super Admin: `super@distok.com.br` / `distok123`
- Admin (tenant Pro): `admin@bebidassul.com` / `distok123`
- Operador: `operador@bebidassul.com` / `distok123`

> Em produção real, **rode o seed só uma vez** (ou nunca, criando o super admin manualmente) e troque as senhas.
