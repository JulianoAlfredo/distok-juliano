# DISTOK — Product Requirements Document (PRD)

> **Produto:** DISTOK — SaaS de Gerenciamento de Estoque Interno para Distribuidoras
> **Versão:** PRD v1.0 (greenfield)
> **Autor:** Morgan (Product Manager — AIOX)
> **Data:** 2026-06-20
> **Status:** Draft para aprovação
> **Confidencial — uso interno da equipe**

---

## 1. Visão Geral e Objetivos

### 1.1 Resumo executivo
DISTOK é um SaaS **multi-tenant** de gestão de estoque interno voltado para pequenas e médias distribuidoras (bebidas, alimentos, atacado em geral). O produto entrega controle rigoroso de movimentação de estoque com **auditoria imutável** e **rastreabilidade por funcionário**, somado a uma camada de **personalização/white-label por cliente** que faz cada distribuidora sentir que o sistema foi feito sob medida para ela.

O diferencial competitivo não é só o preço (posicionado abaixo do SmartPOS PDV) — é a combinação de **simplicidade focada** (sem o excesso de um ERP) + **experiência personalizada por tenant** + **rastreabilidade/auditoria de nível profissional**.

### 1.2 Objetivos de produto (Goals)
- **G1** — Entregar um MVP de controle de estoque que cubra entrada, saída, ajuste, saldo e alerta de estoque mínimo, com auditoria imutável.
- **G2** — Operar como SaaS multi-tenant com isolamento de dados confiável entre distribuidoras.
- **G3** — Oferecer personalização visual e terminológica por tenant (white-label leve), criando percepção de produto sob medida — **requisito impreterível**.
- **G4** — Suportar três perfis de acesso (Super Admin do SaaS, Admin do tenant, Operador) com RBAC consistente em toda a aplicação.
- **G5** — Viabilizar cobrança por planos (Básico/Pro) com limites técnicos aplicados (usuários, produtos, recursos).
- **G6** — Rodar em infraestrutura enxuta e barata: **GitHub** (versionamento) + **Node app na Hostinger** (deploy) + **MySQL da Hostinger** (banco).
- **G7** — Permitir onboarding rápido de novos clientes (importação de produtos via planilha, criação de usuários, aplicação de tema).

### 1.3 Background / contexto
O cliente-âncora (distribuidora de um amigo do fundador) já usava o SmartPOS PDV e achou caro e genérico. A oportunidade é capturar pequenas distribuidoras insatisfeitas com ERPs caros e complexos (Bling, Omie) ou PDVs genéricos, oferecendo algo enxuto, barato e que "parece feito para elas". O documento de planejamento MVP v1.0 já validou viabilidade econômica (com 5 clientes o custo operacional está coberto com folga).

### 1.4 Não-objetivos (Out of scope no MVP)
- Emissão de NF-e / integração SEFAZ (Fase 5).
- Integrações Zé Delivery / iFood (Fase 5).
- Cobrança automática via Stripe/Asaas (Fase 5 — no MVP a cobrança é manual/offline, o sistema apenas controla planos e status).
- App nativo mobile (web responsivo cobre o MVP).
- Gestão financeira completa (contas a pagar/receber, fluxo de caixa) — DISTOK foca em estoque, não em ERP financeiro.
- Multi-armazém/multi-filial por tenant (previsto como evolução pós-MVP; ver §11).

---

## 2. Personas e Perfis de Acesso

| Persona | Perfil técnico (role) | Quem é | Dores | Necessidades |
|---|---|---|---|---|
| **Dono do SaaS** | `super_admin` | O fundador/operador do DISTOK | Gerir contratos, inadimplência, onboarding | Painel global, criar/ativar/desativar tenants, métricas |
| **Gestor da distribuidora** | `admin` | Dono ou gerente da distribuidora-cliente | Saber o que tem em estoque, quem mexeu, margem | Cadastros, relatórios, auditoria, gestão de funcionários, configurar tema |
| **Funcionário operacional** | `operator` | Estoquista / repositor | Lançar entrada/saída rápido, sem errar | Telas simples, foco em movimentação e consulta de saldo |

**Princípio de design por persona:** o Operador vê uma interface enxuta (lançamento + consulta); o Admin vê gestão + relatórios + configuração; o Super Admin vê o plano de controle do SaaS (cross-tenant). Tudo isso modulado por RBAC (ver FR de segurança).

---

## 3. Escopo do MVP

### 3.1 Dentro do MVP
- Painel Super Admin (gestão de tenants e planos).
- Autenticação JWT + isolamento multi-tenant + RBAC.
- **Personalização/white-label por tenant** (tema, logo, nome, terminologia).
- Cadastro de produtos (com custo/revenda/margem).
- Cadastro de funcionários (usuários do tenant).
- Controle de estoque (entrada/saída/ajuste/saldo/alerta mínimo).
- Auditoria imutável.
- Relatórios (estoque atual, movimentações, auditoria, abaixo do mínimo) exportáveis em PDF/CSV.
- Dashboard do tenant.

### 3.2 Fora do MVP
Ver §1.4.

---

## 4. Requisitos Funcionais (FR)

> Numerados para rastreabilidade. Cada FR será referenciado na spec técnica e nas histórias.

### 4.1 Plataforma / Super Admin
- **FR1** — O Super Admin pode cadastrar uma nova distribuidora (tenant): nome, CNPJ, endereço, plano contratado, e-mail do admin inicial.
- **FR2** — O Super Admin pode ativar / desativar / suspender um tenant. Tenant não-ativo bloqueia o login de todos os usuários daquele tenant imediatamente.
- **FR3** — O Super Admin pode listar todos os tenants com filtro por status (ativo/inativo/suspenso) e plano.
- **FR4** — O Super Admin visualiza métricas globais: total de tenants, tenants ativos, MRR estimado, distribuição por plano.
- **FR5** — O Super Admin pode definir/editar os planos disponíveis (Básico, Pro) e seus limites (máx. usuários, máx. produtos, recursos habilitados).
- **FR6** — O Super Admin pode resetar a senha do Admin de qualquer tenant (gera senha temporária + força troca no próximo login).
- **FR7** — Ao criar um tenant, o sistema cria automaticamente o usuário `admin` inicial e dispara e-mail com credenciais temporárias.

### 4.2 Personalização / White-Label (impreterível)
- **FR8** — Cada tenant tem um conjunto de configurações de marca (branding): nome de exibição do sistema, logo (upload), favicon, cor primária, cor secundária, cor de destaque.
- **FR9** — O Admin do tenant pode editar o branding do próprio tenant em uma tela de configurações, com **pré-visualização ao vivo**.
- **FR10** — O frontend aplica o tema do tenant dinamicamente (CSS variables / theming) já na tela de login, identificando o tenant por **subdomínio** ou **slug na URL** (ex: `cliente.distok.com.br` ou `app.distok.com.br/cliente`).
- **FR11** — O tenant pode personalizar **terminologia** (rótulos): ex. trocar "Produto" por "Item", "Funcionário" por "Colaborador", "Distribuidora" por "Empresa". Um dicionário de termos sobrescrevíveis por tenant.
- **FR12** — O tenant pode definir e-mail remetente de notificações e texto de rodapé personalizado nos relatórios PDF (logo + nome no cabeçalho do PDF).
- **FR13** — Existe um tema padrão DISTOK (fallback) quando o tenant não personalizou nada — o sistema nunca fica "sem marca".
- **FR14** — O Super Admin pode bloquear/forçar branding (ex: plano Básico tem personalização limitada a cores+logo; Pro libera terminologia e domínio próprio). Limites de personalização são atributo do plano.

### 4.3 Cadastro de Produtos
- **FR15** — Admin/Operador pode criar produto: nome, descrição, categoria, unidade (caixa/garrafa/litro/un), SKU/código de barras, valor de compra (custo), valor de revenda, estoque mínimo.
- **FR16** — O sistema calcula automaticamente a margem de lucro: `((revenda - custo) / custo) × 100`, exibida e recalculada ao editar.
- **FR17** — Produto pode ser editado e **inativado** (nunca deletado fisicamente — preserva histórico de movimentação).
- **FR18** — Busca e filtro de produtos por nome, categoria e SKU, com paginação.
- **FR19** — SKU é único por tenant (não global).
- **FR20** — O limite de produtos cadastrados respeita o plano do tenant (Básico: até 200; Pro: ilimitado). Ao atingir o limite, o cadastro é bloqueado com mensagem clara.

### 4.4 Cadastro de Funcionários (usuários do tenant)
- **FR21** — Admin do tenant pode criar funcionário: nome completo, e-mail, CPF, cargo, nível de acesso (`admin` ou `operator`).
- **FR22** — E-mail é único por tenant; o funcionário recebe login próprio e senha temporária por e-mail.
- **FR23** — Admin pode ativar/inativar funcionário (inativo não loga, mas seu histórico permanece).
- **FR24** — Toda ação relevante de um funcionário fica vinculada a ele na auditoria.
- **FR25** — O número de usuários ativos respeita o limite do plano (Básico: até 3; Pro: até 10). Bloqueio com mensagem ao exceder.

### 4.5 Controle de Estoque (núcleo)
- **FR26** — **Entrada de estoque:** produto, quantidade (>0), lote, data de validade, fornecedor, nota fiscal de referência, observação opcional.
- **FR27** — **Saída de estoque:** produto, quantidade (>0), motivo (venda / perda / devolução / transferência), observação opcional.
- **FR28** — **Ajuste de estoque:** correção manual do saldo com **justificativa obrigatória** (texto). Registra saldo anterior e novo saldo.
- **FR29** — O saldo de cada produto é calculado a partir das movimentações; saída não pode deixar saldo negativo (regra configurável: bloquear ou alertar).
- **FR30** — **Alerta de estoque mínimo** configurável por produto; o sistema sinaliza visualmente (dashboard + relatório) produtos abaixo do mínimo.
- **FR31** — Toda movimentação registra: funcionário responsável, data/hora exata (imutável), IP de origem, tipo, quantidade, motivo.
- **FR32** — Movimentações **não podem ser editadas nem deletadas** após criadas — correção só via novo lançamento de ajuste (ledger append-only).
- **FR33** — Visualização do saldo atual por produto, com filtro por categoria e status (abaixo do mínimo).
- **FR34** — Histórico de movimentações de um produto específico (extrato), em ordem cronológica.

### 4.6 Relatórios
- **FR35** — Relatório de **estoque atual**: todos os produtos com saldo, custo, revenda, margem e valor total em estoque (saldo × custo). Export PDF + CSV.
- **FR36** — Relatório de **movimentações**: filtros por período, produto, funcionário e tipo (entrada/saída/ajuste). Export PDF + CSV.
- **FR37** — Relatório de **auditoria**: quem mexeu no quê e quando — somente leitura, não editável. Export PDF + CSV.
- **FR38** — Relatório de **produtos abaixo do estoque mínimo**. Export PDF + CSV.
- **FR39** — Relatórios PDF aplicam o branding do tenant (logo, nome, cores no cabeçalho/rodapé).
- **FR40** — O plano controla o formato disponível (Básico: PDF; Pro: PDF + CSV).

### 4.7 Dashboard do Tenant
- **FR41** — Dashboard com resumo: total de produtos ativos, nº de itens abaixo do mínimo, valor total em estoque, últimas movimentações, gráfico simples de entradas vs. saídas no período.

### 4.8 Autenticação e Conta
- **FR42** — Login com e-mail + senha; sessão via JWT com expiração de 8h.
- **FR43** — Fluxo "esqueci minha senha" via e-mail (token de redefinição com expiração).
- **FR44** — Troca de senha obrigatória no primeiro login (usuários criados com senha temporária).
- **FR45** — Logout e invalidação de sessão.

---

## 5. Requisitos Não-Funcionais (NFR)

### 5.1 Segurança e isolamento
- **NFR1** — Senhas armazenadas com **bcrypt** (custo ≥ 10), nunca em texto puro.
- **NFR2** — **Isolamento multi-tenant**: toda query de dados de negócio DEVE filtrar por `tenant_id` derivado do JWT do usuário — nunca de parâmetro do cliente.
- **NFR3** — Middleware de autenticação injeta `tenant_id` e `role` em cada requisição; rotas protegidas por verificação de role (RBAC).
- **NFR4** — Tenant `inactive`/`suspended` ⇒ acesso bloqueado automaticamente (verificado a cada requisição, não só no login).
- **NFR5** — Super Admin tem role especial sem `tenant_id`, com acesso cross-tenant **explícito e auditado**.
- **NFR6** — Como o MySQL da Hostinger não oferece RLS nativa (Row-Level Security do Postgres), o isolamento é garantido na **camada de aplicação** com uma estratégia obrigatória de repositório (todo acesso passa por um data-access layer que injeta `tenant_id`). Ver spec técnica.
- **NFR7** — Proteção contra OWASP Top 10 básicos: SQL injection (queries parametrizadas/ORM), XSS (sanitização/escape), CSRF (tokens onde aplicável), rate limit no login.
- **NFR8** — Uploads (logo/favicon) validados por tipo e tamanho; servidos de forma segura.

### 5.2 Performance e escala
- **NFR9** — Operações de listagem paginadas (default 25/página).
- **NFR10** — Saldo de estoque consultável em O(1) de leitura — manter tabela/coluna de saldo materializado atualizado por transação (não recalcular o ledger inteiro a cada leitura).
- **NFR11** — Índices compostos em `(tenant_id, created_at)` nas tabelas de movimentação e em `(tenant_id, sku)` em produtos.
- **NFR12** — Alvo: resposta de API < 500ms p95 para operações comuns com volume típico (até dezenas de milhares de movimentações por tenant).

### 5.3 Confiabilidade e dados
- **NFR12.1** — Movimentações de estoque são append-only (imutáveis); ajuste de saldo é transacional (atualiza ledger + saldo materializado na mesma transação).
- **NFR13** — Backup do banco MySQL (rotina da Hostinger + export periódico); definir RPO/RTO na spec.
- **NFR14** — Log de auditoria imutável (sem UPDATE/DELETE permitido pela aplicação).

### 5.4 Operação / Deploy
- **NFR15** — Versionamento em **GitHub**; deploy do app **Node na Hostinger**; banco **MySQL da Hostinger**.
- **NFR16** — Configuração por variáveis de ambiente (sem segredos no repositório).
- **NFR17** — Migrations versionadas e reproduzíveis (o schema deve ser recriável a partir do repositório — evitar drift).
- **NFR18** — Pipeline mínimo de qualidade (lint + testes) antes de merge/deploy.

### 5.5 Usabilidade / Acessibilidade
- **NFR19** — Web responsivo (mobile-friendly), funcional em navegador de celular sem app nativo.
- **NFR20** — Português (pt-BR) como idioma padrão; textos centralizados para futura i18n e para suportar o dicionário de terminologia por tenant (FR11).
- **NFR21** — Contraste e legibilidade preservados mesmo com cores customizadas do tenant (validar contraste mínimo ao salvar o tema).

---

## 6. Modelo Multi-Tenant e RBAC (macro)

### 6.1 Estratégia
**Shared database, shared schema com `tenant_id`** em todas as tabelas de negócio. Mais simples e barato; permite migrar para schemas separados no futuro. Isolamento garantido na camada de aplicação (NFR6).

### 6.2 Identificação do tenant
- Por **subdomínio** (`cliente.distok.com.br`) — preferencial para reforçar percepção white-label — **ou** por slug (`app.distok.com.br/c/cliente`) como fallback quando domínio próprio não estiver configurado.
- O tenant é resolvido **antes do login** para aplicar o tema correto na tela de login.

### 6.3 Matriz de permissões (RBAC) — resumo
| Recurso / Ação | super_admin | admin (tenant) | operator |
|---|:--:|:--:|:--:|
| Gerir tenants/planos | ✅ | ❌ | ❌ |
| Métricas globais | ✅ | ❌ | ❌ |
| Configurar branding do tenant | ❌¹ | ✅ | ❌ |
| Gerir funcionários | ❌¹ | ✅ | ❌ |
| Criar/editar produto | ❌¹ | ✅ | ✅ |
| Inativar produto | ❌¹ | ✅ | ❌ |
| Lançar entrada/saída | ❌¹ | ✅ | ✅ |
| Ajuste de estoque | ❌¹ | ✅ | ❌ (config.) |
| Ver relatórios | ❌¹ | ✅ | ✅ (limitado) |
| Ver auditoria | ❌¹ | ✅ | ❌ |

> ¹ Super Admin não opera dentro do tenant por padrão; acesso cross-tenant é excepcional, explícito e auditado (suporte/diagnóstico).

---

## 7. Metas de UX (UI Goals — alto nível)

> Detalhamento completo no documento de Design (Uma/UX). Aqui ficam as diretrizes que o PRD impõe.

- **UX1** — Sensação de produto sob medida: a marca do tenant é a primeira coisa visível (login já tematizado).
- **UX2** — Operador: fluxo de lançamento de movimentação em ≤ 3 cliques, otimizado para uso rápido e repetitivo (teclado, busca de produto por SKU/código de barras).
- **UX3** — Admin: visão de gestão clara, com dashboard como tela inicial.
- **UX4** — Consistência de design system parametrizável por tema (tokens de cor por tenant).
- **UX5** — Feedback explícito em ações sensíveis (ajuste de estoque, inativação, exceder limite de plano).
- **UX6** — Responsivo first: telas de movimentação usáveis no celular do estoquista.

---

## 8. Premissas Técnicas (Technical Assumptions)

> Decisões macro de arquitetura; detalhamento na spec técnica (Aria).

- **TA1 — Repositório:** monorepo no **GitHub** (backend + frontend), ou dois repos — decidir na spec. Default sugerido: monorepo com `apps/api` e `apps/web`.
- **TA2 — Backend:** **Node.js** (Express ou Fastify) expondo REST API com JWT. Roda como **Node app na Hostinger** (hPanel → Node.js app / Setup Node.js App, Passenger).
- **TA3 — Frontend:** **React + Vite**, build estático servido pela Hostinger; consome a API REST.
- **TA4 — Banco:** **MySQL da Hostinger**. Implicações: sem RLS nativa, sem tipo UUID nativo (usar `CHAR(36)` ou `BINARY(16)`), ENUMs do MySQL ou tabelas de domínio, JSON via tipo `JSON`. Isolamento na aplicação (NFR6).
- **TA5 — Acesso a dados:** usar um ORM/query-builder com queries parametrizadas (ex: Prisma — verificar suporte MySQL na Hostinger — ou Knex/Sequelize). Camada de repositório que injeta `tenant_id` obrigatoriamente.
- **TA6 — Migrations:** ferramenta de migration versionada no repo (NFR17).
- **TA7 — E-mail transacional:** provedor SMTP/API (ex: o já disponível no ecossistema do fundador — Resend) para credenciais, reset de senha e alertas.
- **TA8 — Geração de PDF/CSV:** biblioteca server-side (ex: PDFKit/Puppeteer para PDF; CSV nativo) aplicando branding do tenant.
- **TA9 — Theming:** CSS custom properties (variáveis) injetadas por tenant; tokens carregados após resolução do tenant.
- **TA10 — Testes:** unitários no backend (regras de estoque/RBAC/isolamento) + e2e mínimos nos fluxos críticos.
- **TA11 — CI/CD:** GitHub Actions para lint/test; deploy para Hostinger via Git deploy/SSH/FTP (definir na spec; Hostinger suporta deploy via Git).

> ⚠️ **Risco a validar na spec:** confirmar versão do Node suportada pela Hostinger e se o plano de hospedagem permite Node app persistente + acesso ao MySQL remoto. Isso condiciona TA2/TA4.

---

## 9. Épicos e Histórias (com critérios de aceite)

> Estrutura de épicos sequenciada para entrega incremental. As histórias detalhadas (com ACs completos) serão expandidas pelo Scrum Master (River) em `docs/stories/`. Aqui ficam os épicos, suas histórias-cabeçalho e ACs essenciais.

### Épico 1 — Fundação, Multi-Tenant e Autenticação
**Objetivo:** sistema rodando com login, isolamento por tenant e painel Super Admin básico.
- **1.1** Setup do monorepo (Node + React/Vite), padrões de lint/test, esqueleto de CI. _AC:_ repo no GitHub, `npm run dev` sobe api+web, CI roda lint/test.
- **1.2** Modelagem e migrations MySQL (tenants, users, products, stock_movements, stock_balance, tenant_branding, audit_log). _AC:_ schema recriável via migration; índices NFR11 criados.
- **1.3** Autenticação JWT + middleware de tenant + RBAC. _AC:_ FR42–FR45, NFR2–NFR5; teste prova que usuário de um tenant não lê dado de outro.
- **1.4** Painel Super Admin — CRUD de tenants + planos. _AC:_ FR1–FR7.
- **1.5** Resolução de tenant por subdomínio/slug + tema na tela de login. _AC:_ FR10, FR13.
- **1.6** Seed de dados para testes (1 super admin, 2 tenants, usuários, produtos). _AC:_ ambiente demo reproduzível.

### Épico 2 — Personalização / White-Label
**Objetivo:** cada tenant com identidade visual e terminológica próprias.
- **2.1** Modelo + API de branding por tenant (cores, logo, favicon, nome). _AC:_ FR8, FR12.
- **2.2** Tela de configuração de tema (Admin) com preview ao vivo. _AC:_ FR9, NFR21 (validação de contraste).
- **2.3** Aplicação dinâmica do tema no frontend (CSS vars) pós-resolução de tenant. _AC:_ FR10, FR13.
- **2.4** Dicionário de terminologia por tenant. _AC:_ FR11, NFR20.
- **2.5** Limites de personalização por plano. _AC:_ FR14.

### Épico 3 — Cadastros (Produtos e Funcionários)
**Objetivo:** dados mestres com regras de plano.
- **3.1** API + tela de produtos (CRUD, margem, inativação, busca). _AC:_ FR15–FR19.
- **3.2** Enforcement de limite de produtos por plano. _AC:_ FR20.
- **3.3** API + tela de funcionários (CRUD, roles, ativar/inativar). _AC:_ FR21–FR24.
- **3.4** Enforcement de limite de usuários por plano. _AC:_ FR25.

### Épico 4 — Núcleo de Estoque
**Objetivo:** movimentação rastreável e saldo confiável.
- **4.1** API de movimentações (entrada/saída/ajuste) transacional + saldo materializado. _AC:_ FR26–FR29, FR31–FR32, NFR10, NFR12.1.
- **4.2** Regra de saldo negativo (bloquear/alertar) configurável. _AC:_ FR29.
- **4.3** Alerta de estoque mínimo. _AC:_ FR30.
- **4.4** Telas de lançamento (otimizada p/ operador) + consulta de saldo + extrato por produto. _AC:_ FR33–FR34, UX2, UX6.
- **4.5** Auditoria imutável de todas as ações. _AC:_ FR24, FR31, NFR14.

### Épico 5 — Relatórios, Auditoria e Dashboard
**Objetivo:** visibilidade gerencial e exportação branded.
- **5.1** Relatório de estoque atual (PDF+CSV, branded). _AC:_ FR35, FR39, FR40.
- **5.2** Relatório de movimentações com filtros. _AC:_ FR36.
- **5.3** Relatório de auditoria (read-only). _AC:_ FR37.
- **5.4** Relatório de produtos abaixo do mínimo. _AC:_ FR38.
- **5.5** Dashboard do tenant. _AC:_ FR41.

### Épico 6 — Deploy e Primeiro Cliente
**Objetivo:** produção na Hostinger e onboarding do cliente-âncora.
- **6.1** Deploy do backend (Node app) na Hostinger + variáveis de ambiente + SSL. _AC:_ NFR15–NFR16.
- **6.2** Deploy do frontend (build estático) na Hostinger. _AC:_ app acessível por domínio.
- **6.3** Configuração de domínio/subdomínio por tenant. _AC:_ FR10 em produção.
- **6.4** Onboarding do cliente-âncora (importar produtos, criar usuários, aplicar tema). _AC:_ checklist de onboarding cumprido.
- **6.5** Documentação básica de uso + correções de bugs em uso real.

---

## 10. Métricas de Sucesso (Success Metrics)

- **M1 (ativação)** — Tempo de onboarding de um novo tenant < 1 dia útil.
- **M2 (núcleo)** — 100% das movimentações com responsável + timestamp + IP registrados (auditabilidade total).
- **M3 (negócio)** — ≥ 5 clientes pagantes em 6 meses (cobre custos com folga); ≥ 20 para "pagar bem os dois devs".
- **M4 (retenção)** — Churn < 10% ao trimestre (taxa de instalação atua como filtro anti-churn).
- **M5 (percepção white-label)** — ≥ 80% dos tenants ativos com branding personalizado aplicado (logo+cores).
- **M6 (confiabilidade)** — Zero incidentes de vazamento de dados entre tenants (isolamento).

---

## 11. Riscos e Mitigações

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| R1 | Hostinger não suportar Node app persistente / versão Node exigida | Média | Alto | Validar no início do Épico 1; plano B: VPS Hostinger ou Railway |
| R2 | Isolamento multi-tenant falho (sem RLS no MySQL) | Média | Crítico | Data-access layer obrigatório + testes automatizados de isolamento (NFR2/NFR6) |
| R3 | Saldo de estoque inconsistente sob concorrência | Média | Alto | Transações + saldo materializado + locking otimista/pessimista (spec) |
| R4 | Personalização quebrar legibilidade/UX | Média | Médio | Validação de contraste ao salvar tema (NFR21); tokens com fallback |
| R5 | Escopo inflar (virar ERP) | Alta | Alto | Não-objetivos explícitos (§1.4); ruthless prioritization |
| R6 | Limites de plano mal aplicados (cliente excede) | Baixa | Médio | Enforcement no backend, não só na UI (FR20/FR25) |
| R7 | Auditoria mutável por brecha | Baixa | Crítico | Append-only por design; sem rotas de UPDATE/DELETE em audit/movimentações (NFR14) |

---

## 12. Roadmap (fases macro)

- **Fase 1 — Fundação + Auth + Super Admin** (Épico 1)
- **Fase 2 — White-label + Cadastros** (Épicos 2–3)
- **Fase 3 — Núcleo de estoque** (Épico 4)
- **Fase 4 — Relatórios + Dashboard** (Épico 5)
- **Fase 5 — Deploy + 1º cliente** (Épico 6)
- **Fase 6 (pós-MVP)** — Integrações (Zé Delivery, iFood, NF-e, WhatsApp), cobrança automática, multi-armazém, app mobile. _Só após ≥ 3 clientes pagantes._

---

## 13. Rastreabilidade (índice FR/NFR → Épico)

| Épico | FRs | NFRs |
|---|---|---|
| 1 | FR1–FR7, FR10, FR13, FR42–FR45 | NFR1–NFR6, NFR11, NFR15–NFR18 |
| 2 | FR8–FR14 | NFR8, NFR20, NFR21 |
| 3 | FR15–FR25 | NFR9 |
| 4 | FR26–FR34 | NFR10, NFR12, NFR12.1, NFR14 |
| 5 | FR35–FR41 | NFR9 |
| 6 | — | NFR13, NFR15–NFR16 |

---

_Próximo passo no fluxo AIOX: **@architect (Aria)** consome este PRD para produzir a **Spec Técnica / Arquitetura** (`docs/architecture.md`), depois **@ux (Uma)** o **Design** (`docs/ux-design.md`), e **@sm (River)** a **trilha de desenvolvimento / stories** (`docs/workflow.md`)._

— Morgan, planejando o futuro 📊
