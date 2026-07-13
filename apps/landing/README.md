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

Um arquivo só, `index.html`. Preço, depoimentos e o resto do conteúdo estão direto no HTML — sem CMS. Se o preço mudar (hoje: taxa de instalação R$ 450 + mensalidade R$ 130), busque por `price-nums` no arquivo.
