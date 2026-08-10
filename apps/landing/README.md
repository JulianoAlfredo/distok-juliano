# DISTOK — Landing Page

Site comercial estático (uma página só, `index.html`). Sem build, sem dependências, sem framework — HTML + CSS puro, com as fontes (Manrope + Plex Mono) já embutidas no arquivo como `data:` URI, então funciona igual em qualquer lugar que sirva arquivo estático.

Independente do resto do monorepo (`apps/api`, `apps/web`) — não compartilha código, não faz build, não precisa de variável de ambiente. Pode ser hospedado separadamente do app.

## Rodar localmente

Abra `index.html` direto no navegador, ou sirva com qualquer servidor estático:

```bash
npx serve apps/landing
```

## Deploy (Vercel/Netlify — recomendado)

Como é 100% estático, não precisa de build command nem output directory além da raiz:

- **Vercel**: novo projeto → "Root Directory" = `apps/landing` → Framework Preset = "Other" → Build Command vazio → Output Directory = `.`.
- **Netlify**: "Base directory" = `apps/landing`, sem build command, "Publish directory" = `apps/landing` (ou `.` se a base já for essa pasta).

## Editar

Um arquivo só, `index.html`. Todo o conteúdo está direto no HTML — sem CMS. Se o preço mudar (hoje: R$ 39,90/mês, plano único, 7 dias grátis, sem taxa de instalação), busque por `price-nums` no arquivo. Todos os CTAs apontam para o cadastro self-service (`https://painel.distok.com.br/cadastro`).

A página **não tem depoimentos** de propósito: ainda não há clientes reais pra citar, e depoimento inventado é propaganda enganosa. Quando houver clientes de verdade dispostos a dar depoimento, aí sim adiciona a seção.

## Logo (`logo/`)

- `distok-mark.svg` — só o símbolo (caixa isométrica com check), vetor, escala pra qualquer tamanho.
- `distok-logo.png` — símbolo + wordmark, fundo transparente, pra fundos claros.
- `distok-logo-branco.png` — versão com texto branco, pra fundos escuros.
