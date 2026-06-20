# DISTOK — Design / UX Spec

> **Autora:** Uma (UX/UI & Design System — AIOX)
> **Consome:** [prd.md](./prd.md) · [architecture.md](./architecture.md)
> **Versão:** 1.0 · **Data:** 2026-06-20
> **Metodologia:** Atomic Design (átomos → moléculas → organismos → templates → páginas)
> **Idioma da UI:** pt-BR · **Acessibilidade alvo:** WCAG 2.1 AA

---

## 1. Princípios de UX

1. **Sob medida desde o primeiro pixel** — o branding do tenant aparece já na tela de login (UX1). Nada genérico.
2. **A persona define a densidade** — Operador = enxuto e rápido; Admin = gestão; Super Admin = controle de plataforma.
3. **Tokens, não cores fixas** — todo componente consome `var(--token)`. Personalização = trocar tokens, sem rebuild.
4. **Mobile-first onde dói** — o estoquista usa o celular no depósito; a tela de lançamento é desenhada para o polegar.
5. **Feedback honesto** — ações sensíveis (ajuste, inativar, exceder plano) sempre confirmam e explicam.
6. **Acessível por padrão** — contraste validado mesmo com cores do cliente; foco visível; navegação por teclado.

---

## 2. Personas → necessidades de interface

| Persona | Tela inicial | Densidade | Prioridade de UX |
|---|---|---|---|
| **Super Admin** (`super_admin`) | Lista de tenants + métricas | Alta (tabelas, filtros) | Controle, visão macro, rapidez de gestão |
| **Admin do tenant** (`admin`) | Dashboard do estoque | Média | Clareza gerencial, relatórios, configuração de marca |
| **Operador** (`operator`) | Lançar movimentação | Baixa (foco numa tarefa) | Velocidade, menos campos, leitura de código de barras |

---

## 3. Design System Tokenizado (base do white-label)

### 3.1 Camadas de token
```
Tier 1 — PRIMITIVOS (fixos, DISTOK)      Tier 2 — SEMÂNTICOS (sobrescrevíveis/tenant)   Tier 3 — COMPONENTE
--gray-50..900, --blue-500, etc.   →     --color-primary, --color-surface, etc.    →    --btn-bg, --table-header-bg
```
- **Tier 1** nunca muda (paleta neutra, escalas). **Tier 2** é o que o tenant personaliza. **Tier 3** referencia Tier 2.

### 3.2 Tokens semânticos (CSS vars) — contrato
```css
:root {
  /* MARCA (sobrescritos por tenant_branding) */
  --color-primary:   #2563EB;   /* botões, links, destaque */
  --color-secondary: #1E293B;   /* topo, sidebar */
  --color-accent:    #F59E0B;   /* alertas/realces */

  /* SUPERFÍCIE / TEXTO (derivados, fallback DISTOK) */
  --color-bg:        #F8FAFC;
  --color-surface:   #FFFFFF;
  --color-border:    #E2E8F0;
  --color-text:      #0F172A;
  --color-text-mut:  #64748B;

  /* SEMÂNTICOS DE ESTADO (fixos — não personalizáveis, garantem leitura universal) */
  --color-success:#16A34A; --color-warning:#D97706; --color-danger:#DC2626; --color-info:#0284C7;

  /* TIPOGRAFIA */
  --font-sans: 'Inter', system-ui, sans-serif;
  --fs-xs:12px; --fs-sm:14px; --fs-md:16px; --fs-lg:20px; --fs-xl:28px;
  --fw-regular:400; --fw-medium:500; --fw-bold:700;

  /* ESPAÇAMENTO (escala 4px) */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px; --sp-8:32px;

  /* RAIO / ELEVAÇÃO */
  --radius-sm:6px; --radius-md:10px; --radius-lg:16px;
  --shadow-sm:0 1px 2px rgba(0,0,0,.06); --shadow-md:0 4px 12px rgba(0,0,0,.08);
}
```
> O `ThemeProvider` (ver architecture §7) sobrescreve **apenas** `--color-primary/secondary/accent` (e nome/logo) com os valores de `tenant_branding`. Cores de estado (success/warning/danger) **não** são personalizáveis — garantem que "estoque baixo" seja sempre legível.

### 3.3 Regra de contraste (WCAG AA)
- Ao salvar branding, o backend valida `contrast(textoSobrePrimary) ≥ 4.5:1`. Se falhar, sugere automaticamente texto branco/preto sobre a cor escolhida e bloqueia o save com microcopy explicativa (NFR21).
- Tokens derivados (`--on-primary`) calculados: se primária escura → texto branco; se clara → texto escuro.

---

## 4. Componentes (Atomic Design)

### 4.1 Átomos
- **Button**: variantes `primary` (bg `--color-primary`), `secondary` (outline), `ghost`, `danger`. Tamanhos `sm|md|lg`. Estados: default/hover/active/disabled/loading (spinner inline).
- **Input / Select / Textarea / DatePicker**: label sempre visível, helper text, estado de erro (borda `--color-danger` + mensagem), required marcado.
- **Badge de status**: `active` (verde), `inactive` (cinza), `suspended` (âmbar), `below-min` (vermelho pulsante leve).
- **Tag/Chip**, **Avatar/Logo**, **Icon** (lucide), **Tooltip**, **Spinner**, **Skeleton**.

### 4.2 Moléculas
- **FormField** = label + input + helper/erro.
- **SearchBar** (busca produtos por nome/SKU/código de barras, com debounce).
- **StatCard** (KPI do dashboard: rótulo + valor + delta).
- **TableRow** com ações (ver/editar/inativar).
- **QuantityStepper** (− valor + ) para lançamento rápido.
- **PlanLimitBanner** (aviso de limite de plano).

### 4.3 Organismos
- **AppShell**: Topbar (logo do tenant + nome + usuário) + Sidebar (itens por role) + área de conteúdo.
- **DataTable** (paginada, ordenável, filtros, empty state, loading skeleton).
- **MovementForm** (formulário de movimentação, adapta campos por tipo).
- **ReportFilters** (período, produto, funcionário, tipo, formato PDF/CSV).
- **BrandingEditor** (form + preview ao vivo).

### 4.4 Templates / Páginas
Login · Painel Super Admin · Dashboard · Produtos (lista/form) · Funcionários · Estoque (lançar/saldo/extrato) · Relatórios · Configurações de Marca.

---

## 5. Inventário de Telas (wireframes ASCII)

### 5.1 Login (tematizado por tenant)
```
┌───────────────────────────────────────────────┐
│                                                 │
│            [ LOGO DO TENANT ]                   │  ← --color-primary / logo_url
│          Bem-vindo à {display_name}             │  ← nome personalizado (fallback "DISTOK")
│                                                 │
│   E-mail    [______________________]           │
│   Senha     [______________________] 👁         │
│                                                 │
│            [   Entrar   ]  (primary)            │
│                                                 │
│            Esqueci minha senha →                │
└───────────────────────────────────────────────┘
  Estado tenant inativo → "Acesso suspenso. Fale com o administrador."
```

### 5.2 Painel Super Admin — Tenants
```
┌ DISTOK ADMIN ───────────────────────────── [Super Admin ▾] ┐
│ ┌Métricas──────────────────────────────────────────────┐  │
│ │ Tenants: 12   Ativos: 10   MRR: R$1.099   Pro: 4      │  │
│ └───────────────────────────────────────────────────────┘  │
│ Buscar [____]  Status[Todos▾] Plano[Todos▾]  [+ Novo Tenant]│
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Distribuidora    CNPJ          Plano  Status   Ações   │  │
│ │ Bebidas Sul      ..-../0001-.. Pro    🟢ativo  ⋮       │  │
│ │ AtacadãoX        ..-../0001-.. Básico 🟠susp.  ⋮       │  │
│ └───────────────────────────────────────────────────────┘  │
│  ⋮ → Ativar/Desativar · Resetar senha admin · Ver detalhes  │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Dashboard do Tenant (Admin)
```
┌ [logo] Distribuidora Bebidas Sul ───────── [Maria ▾] ┐
│ Sidebar        │  ┌Stat┐ ┌Stat┐ ┌Stat┐ ┌Stat┐        │
│ ▸ Dashboard    │  │Prod│ │Abx │ │Valor│ │Mov │        │
│ ▸ Produtos     │  │ 184│ │ 7⚠ │ │R$..│ │ 23 │        │
│ ▸ Estoque      │  └────┘ └────┘ └────┘ └────┘        │
│ ▸ Funcionários │  ┌Entradas vs Saídas (7d)─────────┐  │
│ ▸ Relatórios   │  │ ▁▂▅▃▇▂▁  (mini gráfico)         │  │
│ ▸ Marca        │  └────────────────────────────────┘  │
│                │  Últimas movimentações [tabela]       │
└────────────────┴───────────────────────────────────────┘
  ⚠ "7 produtos abaixo do mínimo" → clica → lista filtrada
```

### 5.4 Estoque — Lançar movimentação (OPERADOR, mobile-first) ⭐
```
 MOBILE (≤3 cliques: tipo → produto → qtd → salvar)
┌─────────────────────────┐
│ ← Lançar movimentação    │
│ ( Entrada )( Saída )(Aj.)│  ← toggle grande (clique 1)
│                          │
│ Produto                  │
│ [🔎 buscar / 📷 código ] │  ← busca SKU/scanner (clique 2)
│ → Heineken 600ml  (#A12) │
│   saldo atual: 48        │
│                          │
│ Quantidade               │
│   [ −]   12   [ +]       │  ← stepper (clique 3 ajusta)
│                          │
│ Motivo [Venda ▾] (saída) │
│ Obs    [__________]      │
│                          │
│ [   Confirmar entrada   ]│  (primary, full-width)
└─────────────────────────┘
  Sucesso → toast "✓ Entrada registrada. Saldo: 60" + limpa form
  Saída > saldo → bloqueio 422: "Saldo insuficiente (48). Use Ajuste."
```

### 5.5 Estoque — Consulta de saldo
```
┌ Estoque › Saldo atual ───────────────────────────────┐
│ [🔎 buscar] Categoria[▾] [☑ Só abaixo do mínimo]      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Produto        SKU   Saldo  Mín  Status           │ │
│ │ Heineken 600   A12    60    24   🟢               │ │
│ │ Água 500ml     C04     5    20   🔴 abaixo        │ │
│ │ Vinho Tinto    V09     0    10   🔴 zerado        │ │
│ └──────────────────────────────────────────────────┘ │
│ Linha → abre EXTRATO do produto                        │
└────────────────────────────────────────────────────────┘
```

### 5.6 Extrato do produto (append-only)
```
┌ Heineken 600ml — Extrato ─────────────────────────────┐
│ Data/hora        Tipo     Qtd  Saldo  Quem     Motivo │
│ 20/06 14:02      entrada  +24   60     João    NF 881 │
│ 20/06 11:30      saída    -12   36     Ana     venda  │
│ 19/06 09:10      ajuste   →48   48     Maria   correção contagem │
└────────────────────────────────────────────────────────┘
  (sem botão editar/excluir — imutável por design)
```

### 5.7 Produtos — Form (com margem ao vivo)
```
┌ Novo produto ─────────────────────────────────────────┐
│ Nome*        [_______________]  Categoria [_________]  │
│ SKU/código   [_______________]  Unidade   [caixa ▾]   │
│ Custo  R$ [ 4,50 ]   Revenda R$ [ 7,90 ]              │
│ ┌ Margem: 75,6% ┐  (calculada ao vivo)                │
│ Estoque mínimo  [ 24 ]                                 │
│ Descrição [__________________________________]         │
│                         [Cancelar] [Salvar produto]    │
└────────────────────────────────────────────────────────┘
  Limite atingido → PlanLimitBanner (ver 6.4)
```

### 5.8 Configurações de Marca (white-label) ⭐
```
┌ Marca & Personalização ───────────────────────────────────────┐
│ EDITOR                          │  PREVIEW AO VIVO              │
│ Nome do sistema [Bebidas Sul ]  │ ┌──────────────────────────┐ │
│ Logo  [⬆ enviar] (png/svg≤512K) │ │ [logo] Bebidas Sul   👤  │ │
│ Cor primária   [#1B7F3B] 🟩     │ │ ▸ menu  ┌Botão primary┐  │ │
│ Cor secundária [#0F2A1A] 🟫     │ │         └─────────────┘  │ │
│ Cor destaque   [#E8A93B] 🟨     │ │ Badge 🟢 ativo           │ │
│ Rodapé relatório [____] (Pro)   │ └──────────────────────────┘ │
│ ─ Terminologia (Pro) ─          │  Contraste: ✓ AA (5.1:1)     │
│ "Produto"   → [Item        ]    │                              │
│ "Funcionário"→[Colaborador ]    │  [Restaurar padrão DISTOK]   │
│ "Empresa"   → [Distribuidora]   │  [   Salvar alterações   ]   │
└─────────────────────────────────┴──────────────────────────────┘
  Contraste insuficiente → "Esta combinação fica difícil de ler.
  Sugerimos texto branco sobre esta cor." (bloqueia salvar)
  Recursos travados no Básico aparecem com 🔒 + "Disponível no Pro"
```

### 5.9 Funcionários
```
┌ Funcionários ──────────────────────── [+ Novo] (2/3 usados) ┐
│ Nome           E-mail            Cargo      Acesso   Status  │
│ Maria Souza    maria@..          Gerente    Admin    🟢      │
│ João Lima      joao@..           Estoquista Operador 🟢      │
│ (limite Básico: 3 usuários — Banner ao tentar o 4º)          │
└──────────────────────────────────────────────────────────────┘
```

### 5.10 Relatórios
```
┌ Relatórios ───────────────────────────────────────────┐
│ Tipo: (Estoque atual)(Movimentações)(Auditoria)(Abx.mín)│
│ Período [01/06] a [20/06]  Produto[▾] Func.[▾] Tipo[▾] │
│ Formato: (PDF) (CSV🔒Básico)        [ Gerar relatório ] │
│ → PDF gerado com logo + cores do tenant no cabeçalho    │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Fluxos de Usuário

### 6.1 Onboarding de tenant (Super Admin + Admin)
```
Super Admin cria tenant ──▶ sistema gera admin + senha temp ──▶ e-mail enviado
   │                                                              │
   └─ define plano/limites                                        ▼
                                          Admin faz 1º login (5.x) ──▶ troca senha
                                                  │
                                                  ├─▶ importa/cadastra produtos
                                                  ├─▶ cria funcionários
                                                  └─▶ personaliza marca (5.8)  ✅ pronto
```

### 6.2 Primeiro login + troca de senha obrigatória
`login` → JWT com `mustChangePassword=true` → **rota travada** na tela "Defina sua senha" → valida força → libera app. Microcopy: *"Por segurança, crie uma senha nova para o seu primeiro acesso."*

### 6.3 Lançar movimentação em ≤3 cliques (operador) — ver 5.4
Tipo (1) → produto via busca/scanner (2) → quantidade no stepper (3) → confirmar. Foco automático, Enter avança, toast confirma e reseta para o próximo lançamento.

### 6.4 Exceder limite de plano
Backend retorna `422 PLAN_LIMIT_EXCEEDED` → UI mostra **PlanLimitBanner**:
> *"Você atingiu o limite de 200 produtos do plano Básico. Faça upgrade para o Pro (ilimitado) ou inative produtos sem uso."* `[Falar com suporte]`

---

## 7. Responsividade

| Breakpoint | Layout |
|---|---|
| `< 640px` (mobile) | Sidebar vira drawer/bottom-nav; tela do operador em foco único; tabelas viram cards empilhados |
| `640–1024px` (tablet) | Sidebar colapsável; tabelas com scroll horizontal controlado |
| `> 1024px` (desktop) | Shell completo (sidebar fixa + conteúdo) — uso do Admin/Super Admin |

**Tela do estoquista (5.4)** é projetada mobile-first: alvos de toque ≥ 44px, stepper grande, botão confirmar full-width fixo no rodapé, suporte a leitor de código de barras (input que captura scanner como teclado).

---

## 8. Estados de Interface (sempre projetados)

| Estado | Tratamento |
|---|---|
| **Loading** | Skeleton em tabelas/cards; spinner inline em botões; nunca tela branca |
| **Vazio** | Empty state com ícone + frase + CTA. Ex.: *"Nenhum produto ainda. Cadastre o primeiro."* `[+ Produto]` |
| **Erro** | Mensagem amigável + ação de retry; erros de campo inline; toast para falha de rede |
| **Sem permissão** | Item de menu oculto por role; acesso direto → "Você não tem acesso a esta área." |
| **Limite de plano** | PlanLimitBanner (6.4) |
| **Saldo insuficiente** | Bloqueio inline na saída com orientação para usar Ajuste |
| **Tenant suspenso** | Tela de bloqueio pós-login |

---

## 9. Microcopy (pt-BR) — amostra
- Sucesso entrada: *"✓ Entrada registrada. Saldo atual: {n}."*
- Confirmar inativação: *"Inativar este produto? Ele some das listas, mas o histórico é mantido."*
- Ajuste de estoque: *"Ajuste exige justificativa. Por quê o saldo está sendo corrigido?"* (campo obrigatório)
- Reset de senha enviado: *"Se o e-mail existir, enviamos um link para redefinir a senha."* (não revela existência)
- Contraste ruim: *"Essa combinação de cores fica difícil de ler. Ajuste para manter a legibilidade."*

---

## 10. Acessibilidade (checklist WCAG AA)
- Contraste texto/fundo ≥ 4.5:1 — **validado inclusive sobre cores do tenant**.
- Foco visível em todos os interativos; navegação completa por teclado (operador rápido).
- Labels associados a inputs; mensagens de erro vinculadas (`aria-describedby`).
- Toques ≥ 44px no mobile; alvos espaçados.
- Estados não dependem só de cor (ícone + texto em "abaixo do mínimo").
- `lang="pt-BR"`; títulos de página por rota; ordem de cabeçalhos coerente.

---

## 11. Handoff para implementação
- Tokens (§3) → `apps/web/src/theme/tokens.css` + `ThemeProvider`.
- Componentes (§4) construídos como átomos/moléculas/organismos reutilizáveis (sem cor hard-coded — só `var(--token)`).
- Terminologia (§5.8) → `i18n/terminology.ts` (FR11).
- Telas (§5) mapeadas 1:1 com as rotas/contratos da arquitetura (§9 da architecture.md).

_Handoff → **@sm (River)**: transformar PRD + esta spec de design + arquitetura na **trilha de desenvolvimento** (`docs/workflow.md`) com épicos → stories → ACs, sequência e dependências._

— Uma, desenhando com empatia 💝
