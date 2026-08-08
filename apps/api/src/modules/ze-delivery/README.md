# Integração Zé Delivery

Sync bidirecional de estoque entre o DISTOK e o Zé Delivery, por tenant. Cada distribuidora
cadastra as próprias credenciais em `/integracoes/ze-delivery` (autoatendimento — o DISTOK só
guarda e usa essas credenciais para chamar a API em nome do tenant).

## Variáveis de ambiente

| Var | O que é | Como gerar |
|---|---|---|
| `ZE_DELIVERY_ENC_KEY` | Chave AES-256-GCM (base64 de 32 bytes) usada para criptografar `client_secret` e tokens em repouso (`utils/crypto.js`). | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ZE_DELIVERY_CRON_SECRET` | Segredo comparado em tempo constante nos endpoints internos abaixo (header `x-internal-secret`). Não é JWT — protege rotas chamadas por um cron externo, não por sessão de usuário. | `openssl rand -hex 32` |

⚠️ Trocar `ZE_DELIVERY_ENC_KEY` invalida as credenciais já salvas — todos os tenants precisam
recadastrar client_id/client_secret depois de uma rotação de chave.

## Endpoints internos (cron)

Fora de `/api/v1`, de propósito — não é superfície pública:

| Endpoint | Frequência sugerida | O que faz |
|---|---|---|
| `POST /internal/ze-delivery/poll` | ~5 min | Varre tenants com integração ativa, busca eventos de pedidos, atualiza o log (`ze_delivery_orders`) e dá baixa de estoque em pedidos `CONCLUDED`. |
| `POST /internal/ze-delivery/drain-outbox` | ~2–5 min (mais frequente — risco de overselling é sensível a tempo) | Envia pro Zé Delivery a disponibilidade atual dos produtos com movimentação pendente (`ze_delivery_outbox`). |

Ambos exigem o header `x-internal-secret: <ZE_DELIVERY_CRON_SECRET>` e retornam um resumo em
JSON (contagens processadas/sucesso/falha) — sem side effect em chamar de novo antes do
intervalo (idempotente).

## Configurando o cron externo

Hostinger/Passenger não sustenta um scheduler em processo (shared hosting, sem Redis — ver
`docs/architecture.md` RT5), então o agendamento é feito por um cron **externo** batendo nesses
dois endpoints via HTTP.

**Opção 1 — Cron da Hostinger (hPanel → Avançado → Cron Jobs):**
```bash
*/5 * * * * curl -s -X POST -H "x-internal-secret: $ZE_DELIVERY_CRON_SECRET" https://api.distok.com.br/internal/ze-delivery/poll
*/3 * * * * curl -s -X POST -H "x-internal-secret: $ZE_DELIVERY_CRON_SECRET" https://api.distok.com.br/internal/ze-delivery/drain-outbox
```

**Opção 2 — serviço externo gratuito (ex.: cron-job.org):** configurar duas tarefas HTTP POST
apontando pras mesmas URLs, com o header `x-internal-secret` e os intervalos acima.

## Riscos/suposições ainda não validados (sem credenciais reais no momento da implementação)

Ver a seção "Riscos" do plano em `/Users/Julio/.claude/plans/wise-inventing-manatee.md` para a
lista completa (scope OAuth, semântica de reentrega de evento, schema de linha de pedido/
catálogo, se o endpoint de disponibilidade é absolute-overwrite ou delta). Antes de apontar pra
produção, testar contra `https://seller-public-api.release.ze.delivery` (sandbox) assim que
houver credenciais.
