'use strict';

/**
 * Cliente HTTP puro pra API pública de sellers do Zé Delivery. Sem knex, sem TenantContext —
 * recebe tudo por parâmetro (inclusive `fetchImpl`, injetável nos testes) pra ficar
 * testável sem credenciais reais e sem acoplar a nenhuma camada de persistência.
 *
 * ⚠️ Vários caminhos/campos abaixo vêm da doc pública (sem credenciais reais disponíveis no
 * momento desta implementação) e estão marcados como suposição a confirmar em
 * https://seller-public-api.release.ze.delivery assim que houver acesso de sandbox — ver
 * plano em /Users/Julio/.claude/plans/wise-inventing-manatee.md, seção "Riscos".
 */

const BASE_URLS = {
  production: 'https://seller-public-api.ze.delivery',
  sandbox: 'https://seller-public-api.release.ze.delivery',
};

const PATHS = {
  auth: '/auth',
  pollEvents: '/events/polling',
  acknowledgeEvents: '/events/acknowledgment',
  order: (orderNumber) => `/orders/${encodeURIComponent(orderNumber)}`,
  // "Get merchant items" — path exato não confirmado na doc (só o nome do endpoint).
  catalog: '/products/merchant-items',
  // "Update product availability" — path exato não confirmado; há também uma variante
  // "external catalog" cujo caso de uso é incerto. Implementado contra o endpoint simples
  // por padrão (único ponto de chamada, fácil de trocar depois).
  updateAvailability: '/products/availability',
};

class ZeDeliveryApiError extends Error {
  constructor(message, { statusCode = null, body = null } = {}) {
    super(message);
    this.name = 'ZeDeliveryApiError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

function getBaseUrl(environment) {
  return BASE_URLS[environment] || BASE_URLS.sandbox;
}

async function request(fetchImpl, url, options, errorContext) {
  let res;
  try {
    res = await fetchImpl(url, options);
  } catch (err) {
    throw new ZeDeliveryApiError(`Falha de rede ao chamar Zé Delivery (${errorContext})`, { body: err.message });
  }
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    throw new ZeDeliveryApiError(`Zé Delivery retornou ${res.status} em ${errorContext}`, { statusCode: res.status, body });
  }
  return body;
}

/**
 * OAuth2 client_credentials. `scope` é opcional (a doc só confirmou 'orders/read' — se
 * escrita em Products exigir outro escopo, ajustar aqui quando confirmado).
 */
async function authenticate({ environment, clientId, clientSecret, scope, fetchImpl = fetch }) {
  const base = getBaseUrl(environment);
  const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  if (scope) params.set('scope', scope);
  const body = await request(fetchImpl, `${base}${PATHS.auth}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  }, 'authenticate');
  return { accessToken: body?.access_token, expiresIn: Number(body?.expires_in) || 3600 };
}

/** Poll de eventos pendentes. Sem eventType = todos os tipos (uso pretendido no sync). */
async function pollEvents({ environment, accessToken, merchantIds, eventType, fetchImpl = fetch }) {
  const base = getBaseUrl(environment);
  const qs = new URLSearchParams();
  if (Array.isArray(eventType)) for (const t of eventType) qs.append('eventType', t);
  const query = qs.toString();
  const body = await request(fetchImpl, `${base}${PATHS.pollEvents}${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-polling-merchants': (merchantIds || []).join(','),
    },
  }, 'pollEvents');
  return Array.isArray(body) ? body : (body?.items || []);
}

/** Confirma processamento de eventos — [{id, orderId, eventType}]. Espera 202. */
async function acknowledgeEvents({ environment, accessToken, events, fetchImpl = fetch }) {
  const base = getBaseUrl(environment);
  await request(fetchImpl, `${base}${PATHS.acknowledgeEvents}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(events),
  }, 'acknowledgeEvents');
}

async function getOrder({ environment, accessToken, orderNumber, fetchImpl = fetch }) {
  const base = getBaseUrl(environment);
  return request(fetchImpl, `${base}${PATHS.order(orderNumber)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 'getOrder');
}

async function getCatalog({ environment, accessToken, merchantId, fetchImpl = fetch }) {
  const base = getBaseUrl(environment);
  const qs = new URLSearchParams({ merchantId: merchantId || '' });
  const body = await request(fetchImpl, `${base}${PATHS.catalog}?${qs}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 'getCatalog');
  return Array.isArray(body) ? body : (body?.items || []);
}

async function updateAvailability({ environment, accessToken, zeItemId, quantity, fetchImpl = fetch }) {
  const base = getBaseUrl(environment);
  return request(fetchImpl, `${base}${PATHS.updateAvailability}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: zeItemId, quantity }),
  }, 'updateAvailability');
}

module.exports = {
  ZeDeliveryApiError,
  getBaseUrl,
  authenticate,
  pollEvents,
  acknowledgeEvents,
  getOrder,
  getCatalog,
  updateAvailability,
};
