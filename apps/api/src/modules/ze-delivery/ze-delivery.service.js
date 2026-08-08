'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../../db/knex');
const { Errors } = require('../../core/errors');
const audit = require('../../utils/audit');
const password = require('../../utils/password');
const cryptoUtil = require('../../utils/crypto');
const client = require('./ze-delivery.client');
const mapper = require('./ze-delivery.mapper');
const TenantScopedRepository = require('../../core/TenantScopedRepository');
const TenantContext = require('../../core/TenantContext');
const StockLedger = require('../../core/StockLedger');
const productsService = require('../products/products.service');
const { ROLES, USER_STATUS } = require('@distok/shared');

function parseMerchantIdList(cred) {
  if (Array.isArray(cred.merchant_ids)) return cred.merchant_ids;
  if (typeof cred.merchant_ids === 'string') {
    try { return JSON.parse(cred.merchant_ids) || []; } catch { return []; }
  }
  return [];
}

const PUBLIC_FIELDS = [
  'tenant_id', 'environment', 'client_id', 'merchant_ids', 'status',
  'last_sync_inbound_at', 'last_sync_outbound_at', 'last_import_at', 'last_error', 'last_error_at',
  'created_at', 'updated_at',
];

function parseMerchantIds(row) {
  if (!row) return row;
  let merchantIds = row.merchant_ids;
  if (typeof merchantIds === 'string') {
    try { merchantIds = JSON.parse(merchantIds); } catch { merchantIds = []; }
  }
  return { ...row, merchant_ids: merchantIds || [] };
}

/** Credenciais sem o segredo — client_secret nunca volta pro cliente depois de salvo. */
async function getCredentials(ctx) {
  const row = await knex('ze_delivery_credentials').where({ tenant_id: ctx.tenantId }).first();
  if (!row) return null;
  const pick = {};
  for (const f of PUBLIC_FIELDS) pick[f] = row[f];
  return parseMerchantIds(pick);
}

/**
 * Garante 1 usuário-sistema por tenant (lazy, idempotente) — ator das movimentações
 * automáticas desta integração (stock_movements.user_id é NOT NULL/FK, não há conceito de
 * "sem usuário"). status='inactive' + is_system=1 excluem esse usuário da contagem de seats
 * do plano (assertCanAddUser filtra por status=active) e da tela de Funcionários.
 */
async function ensureSystemUser(ctx, trx) {
  const db = trx || knex;
  const cred = await db('ze_delivery_credentials').where({ tenant_id: ctx.tenantId }).first();
  if (cred && cred.system_user_id) return cred.system_user_id;

  const existing = await db('users').where({ tenant_id: ctx.tenantId, is_system: 1 }).first();
  let userId = existing ? existing.id : null;
  if (!userId) {
    userId = uuid();
    const unusablePasswordHash = await password.hash(uuid()); // nunca divulgada, login sempre bloqueado por status
    await db('users').insert({
      id: userId,
      tenant_id: ctx.tenantId,
      name: 'Integração Zé Delivery',
      email: `ze-delivery+${ctx.tenantId}@system.distok.local`,
      role: ROLES.OPERATOR,
      password_hash: unusablePasswordHash,
      status: USER_STATUS.INACTIVE,
      is_system: 1,
    });
  }
  if (cred) {
    await db('ze_delivery_credentials').where({ tenant_id: ctx.tenantId }).update({ system_user_id: userId });
  }
  return userId;
}

/** Autoatendimento: o próprio admin do tenant cadastra/atualiza as credenciais do seu Zé Delivery. */
async function upsertCredentials(ctx, data) {
  const before = await knex('ze_delivery_credentials').where({ tenant_id: ctx.tenantId }).first();

  const patch = {};
  if (data.environment !== undefined) {
    if (!['production', 'sandbox'].includes(data.environment)) throw Errors.validation('Ambiente inválido');
    patch.environment = data.environment;
  }
  if (data.client_id !== undefined) patch.client_id = data.client_id;
  // client_secret só é regravado se o admin realmente digitou um novo valor (a UI nunca pré-preenche o atual).
  if (data.client_secret) patch.client_secret_enc = cryptoUtil.encrypt(data.client_secret);
  if (data.merchant_ids !== undefined) patch.merchant_ids = JSON.stringify(data.merchant_ids || []);

  if (!before && (!patch.client_id || !patch.client_secret_enc)) {
    throw Errors.validation('client_id e client_secret são obrigatórios no primeiro cadastro');
  }

  await knex.transaction(async (trx) => {
    if (before) {
      await trx('ze_delivery_credentials').where({ tenant_id: ctx.tenantId }).update(patch);
    } else {
      await trx('ze_delivery_credentials').insert({ tenant_id: ctx.tenantId, ...patch });
    }
    await ensureSystemUser(ctx, trx);
  });

  await audit.record({
    ctx,
    action: 'ze_delivery.credentials_update',
    entityType: 'ze_delivery_credentials',
    entityId: ctx.tenantId,
    before: before ? { environment: before.environment, client_id: before.client_id } : null,
    after: { environment: patch.environment, client_id: patch.client_id },
    ip: ctx.ip,
  });

  return getCredentials(ctx);
}

/**
 * Garante um access token válido (cache com margem de 60s antes de expirar), reautenticando
 * quando necessário. Usado pelos fluxos de sync (poll/drain) e pelo teste de conexão.
 */
async function ensureAccessToken(cred) {
  const now = Date.now();
  const cachedExpiry = cred.access_token_expires_at ? new Date(cred.access_token_expires_at).getTime() : 0;
  if (cred.access_token_enc && cachedExpiry - 60_000 > now) {
    return cryptoUtil.decrypt(cred.access_token_enc);
  }
  const clientSecret = cryptoUtil.decrypt(cred.client_secret_enc);
  const { accessToken, expiresIn } = await client.authenticate({
    environment: cred.environment,
    clientId: cred.client_id,
    clientSecret,
  });
  const expiresAt = new Date(now + expiresIn * 1000);
  await knex('ze_delivery_credentials').where({ tenant_id: cred.tenant_id }).update({
    access_token_enc: cryptoUtil.encrypt(accessToken),
    access_token_expires_at: expiresAt,
  });
  return accessToken;
}

/**
 * Testa a conexão sem persistir nada além de status/last_error. Aceita credenciais "soltas"
 * no body (testar antes de salvar) ou usa as já cadastradas.
 */
async function testConnection(ctx, overrides = {}) {
  const cred = await knex('ze_delivery_credentials').where({ tenant_id: ctx.tenantId }).first();
  const environment = overrides.environment || cred?.environment || 'sandbox';
  const clientId = overrides.client_id || cred?.client_id;
  const clientSecret = overrides.client_secret || (cred ? cryptoUtil.decrypt(cred.client_secret_enc) : undefined);
  if (!clientId || !clientSecret) {
    throw Errors.validation('Informe client_id e client_secret (ou cadastre-os antes de testar)');
  }

  try {
    await client.authenticate({ environment, clientId, clientSecret });
    if (cred) {
      await knex('ze_delivery_credentials').where({ tenant_id: ctx.tenantId })
        .update({ status: 'active', last_error: null, last_error_at: null });
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof client.ZeDeliveryApiError ? err.message : 'Falha ao conectar com o Zé Delivery';
    if (cred) {
      await knex('ze_delivery_credentials').where({ tenant_id: ctx.tenantId })
        .update({ status: 'error', last_error: message, last_error_at: new Date() });
    }
    return { ok: false, message };
  }
}

/**
 * Importa o catálogo do Zé Delivery como base inicial de produtos: casa por SKU quando
 * possível (linka, sem sobrescrever se já vinculado a outro item), senão cria produto novo.
 * Idempotente: item já vinculado (ze_delivery_item_id já presente em algum produto do tenant)
 * não é reprocessado — reimportar não sobrescreve contagem manual corrigida depois. Estoque
 * inicial é semeado via StockLedger (source='ze_delivery_import'), então também é idempotente
 * por (tenant, source, external_ref=itemId).
 */
async function importCatalog(ctx) {
  const cred = await knex('ze_delivery_credentials').where({ tenant_id: ctx.tenantId }).first();
  if (!cred) throw Errors.validation('Cadastre as credenciais do Zé Delivery antes de importar o catálogo');

  const accessToken = await ensureAccessToken(cred);
  const merchantIds = parseMerchantIdList(cred);
  const productsRepo = new TenantScopedRepository(knex, 'products', ctx);

  const rawItems = [];
  for (const merchantId of (merchantIds.length ? merchantIds : [undefined])) {
    const items = await client.getCatalog({ environment: cred.environment, accessToken, merchantId });
    rawItems.push(...items);
  }

  const result = { imported: 0, linked: 0, skipped: [], stoppedEarly: false, planLimitHit: false };

  for (const raw of rawItems) {
    const item = mapper.mapCatalogItem(raw);
    if (!item.externalId) {
      result.skipped.push({ itemId: null, reason: 'item sem identificador' });
      continue;
    }

    const alreadyLinked = await productsRepo.query().where('ze_delivery_item_id', item.externalId).first();
    if (alreadyLinked) continue; // já importado antes — não reprocessa

    let match = item.sku ? await productsRepo.query().where('sku', item.sku).first() : null;

    try {
      let productId;
      if (match) {
        if (match.ze_delivery_item_id && match.ze_delivery_item_id !== item.externalId) {
          result.skipped.push({ itemId: item.externalId, reason: `SKU ${item.sku} já vinculado a outro item do Zé Delivery` });
          continue;
        }
        await productsRepo.updateById(match.id, { ze_delivery_item_id: item.externalId });
        productId = match.id;
        result.linked++;
      } else {
        const created = await productsService.create(ctx, {
          name: item.name, sku: item.sku || null, sale_price: item.price, ze_delivery_item_id: item.externalId,
        });
        productId = created.id;
        result.imported++;
      }
      await StockLedger.createMovement(knex, ctx, {
        productId, type: 'entry', quantity: item.availableQuantity,
        source: 'ze_delivery_import', externalRef: item.externalId, reason: 'Importação catálogo Zé Delivery',
      });
    } catch (err) {
      if (err.code === 'PLAN_LIMIT_EXCEEDED') {
        result.stoppedEarly = true;
        result.planLimitHit = true;
        break;
      }
      result.skipped.push({ itemId: item.externalId, reason: err.message });
    }
  }

  await knex('ze_delivery_credentials').where({ tenant_id: ctx.tenantId }).update({ last_import_at: new Date() });
  await audit.record({
    ctx, action: 'ze_delivery.import', entityType: 'ze_delivery_credentials', entityId: ctx.tenantId,
    after: { imported: result.imported, linked: result.linked, skipped: result.skipped.length }, ip: ctx.ip,
  });
  return result;
}

/** Upsert em ze_delivery_orders — roda pra TODO evento (não só CONCLUDED), log completo do ciclo de vida. */
async function upsertOrderLog(ctx, { orderNumber, eventId, order, summary }) {
  const existing = await knex('ze_delivery_orders').where({ tenant_id: ctx.tenantId, order_number: orderNumber }).first();
  const patch = {
    status: summary.status,
    total_value: summary.totalValue,
    items_json: JSON.stringify(mapper.mapOrderLines(order)),
    raw_payload_json: JSON.stringify(order || {}),
    last_event_id: eventId,
  };
  if (summary.status === 'CONCLUDED') patch.concluded_at = new Date();
  if (summary.status === 'CANCELLED') patch.cancelled_at = new Date();

  if (existing) {
    await knex('ze_delivery_orders').where({ tenant_id: ctx.tenantId, order_number: orderNumber }).update(patch);
  } else {
    await knex('ze_delivery_orders').insert({ id: uuid(), tenant_id: ctx.tenantId, order_number: orderNumber, ...patch });
  }
}

/**
 * Processa um evento: sempre atualiza o log do pedido; em CONCLUDED, dá baixa de estoque por
 * linha mapeada (source='ze_delivery_order', externalRef=`${eventId}:${productId}` —
 * idempotente via StockLedger). Linha sem produto vinculado ou com sync desligado é pulada
 * sem derrubar o evento inteiro.
 */
async function processEvent(ctx, cred, accessToken, evt) {
  const orderNumber = evt.orderId; // suposição: orderId do evento == orderNumber do GET /orders/{orderNumber}
  const order = await client.getOrder({ environment: cred.environment, accessToken, orderNumber });
  const summary = mapper.mapOrderSummary(order, evt.eventType);
  await upsertOrderLog(ctx, { orderNumber, eventId: evt.eventId, order, summary });

  if (evt.eventType !== 'CONCLUDED') return;

  const lines = mapper.mapOrderLines(order);
  const productsRepo = new TenantScopedRepository(knex, 'products', ctx);
  const unmapped = [];
  for (const line of lines) {
    if (!line.externalItemId) continue;
    const product = await productsRepo.query().where('ze_delivery_item_id', line.externalItemId).first();
    if (!product) { unmapped.push(line.externalItemId); continue; }
    if (!product.ze_delivery_sync_enabled) continue; // sync desligado nesse produto — intencional, sem aviso

    await StockLedger.createMovement(knex, ctx, {
      productId: product.id, type: 'exit', quantity: line.quantity, reason: 'venda',
      source: 'ze_delivery_order', externalRef: `${evt.eventId}:${product.id}`,
    });
  }
  if (unmapped.length) {
    await knex('ze_delivery_credentials').where({ tenant_id: ctx.tenantId }).update({
      last_error: `Pedido ${orderNumber}: item(ns) sem produto vinculado no DISTOK: ${unmapped.join(', ')}`,
      last_error_at: new Date(),
    });
  }
}

/** Poll de um tenant: busca eventos pendentes, processa cada um, confirma o lote no final. */
async function pollTenant(cred) {
  const accessToken = await ensureAccessToken(cred);
  const merchantIds = parseMerchantIdList(cred);
  const events = await client.pollEvents({ environment: cred.environment, accessToken, merchantIds });

  if (events.length > 0) {
    const systemUserId = cred.system_user_id || await ensureSystemUser({ tenantId: cred.tenant_id });
    const ctx = new TenantContext({ tenantId: cred.tenant_id, userId: systemUserId, role: ROLES.OPERATOR });

    const toAck = [];
    for (const evt of events) {
      try {
        await processEvent(ctx, cred, accessToken, evt);
        toAck.push({ id: evt.eventId, orderId: evt.orderId, eventType: evt.eventType });
      } catch (err) {
        // não confirma esse evento — reaparece no próximo poll (idempotente do lado do StockLedger)
        await knex('ze_delivery_credentials').where({ tenant_id: cred.tenant_id })
          .update({ last_error: `Evento ${evt.eventId}: ${err.message}`, last_error_at: new Date() });
      }
    }
    if (toAck.length) {
      try {
        await client.acknowledgeEvents({ environment: cred.environment, accessToken, events: toAck });
      } catch {
        // falha no ack não é fatal — idempotência cobre a reentrega no próximo ciclo
      }
    }
  }

  await knex('ze_delivery_credentials').where({ tenant_id: cred.tenant_id }).update({ last_sync_inbound_at: new Date() });
  return events.length;
}

/**
 * Endpoint cron-triggered (/internal/ze-delivery/poll): varre todos os tenants com
 * integração ativa. Falha de um tenant (token inválido, rede) não trava os demais.
 */
async function pollAllTenants() {
  const creds = await knex('ze_delivery_credentials').where({ status: 'active' });
  const summary = { tenantsProcessed: 0, tenantsFailed: 0, eventsProcessed: 0 };
  for (const cred of creds) {
    try {
      summary.eventsProcessed += await pollTenant(cred);
      summary.tenantsProcessed++;
    } catch (err) {
      summary.tenantsFailed++;
      await knex('ze_delivery_credentials').where({ tenant_id: cred.tenant_id })
        .update({ last_error: err.message, last_error_at: new Date() });
    }
  }
  return summary;
}

const OUTBOX_MAX_ATTEMPTS = 8;
const OUTBOX_STALE_MINUTES = 5;

/**
 * Endpoint cron-triggered (/internal/ze-delivery/drain-outbox): envia pra Zé a disponibilidade
 * mais recente de cada produto com movimentação pendente. Claim otimista (status='processing')
 * evita duplo processamento entre execuções sobrepostas; linhas 'processing' há mais de
 * OUTBOX_STALE_MINUTES são tratadas como travadas (o worker anterior pode ter morrido no meio
 * da chamada HTTP) e voltam a ser candidatas.
 */
async function drainOutbox({ batchSize = 200 } = {}) {
  const candidates = await knex('ze_delivery_outbox')
    .where((qb) => {
      qb.where('status', 'pending').orWhere((qb2) => {
        qb2.where('status', 'processing').andWhere('last_attempt_at', '<', knex.raw(`NOW() - INTERVAL ${OUTBOX_STALE_MINUTES} MINUTE`));
      });
    })
    .orderBy('updated_at', 'asc')
    .limit(batchSize);

  const summary = { processed: 0, succeeded: 0, failed: 0 };

  for (const row of candidates) {
    summary.processed++;
    await knex('ze_delivery_outbox')
      .where({ tenant_id: row.tenant_id, product_id: row.product_id })
      .update({ status: 'processing', last_attempt_at: new Date(), attempts: row.attempts + 1 });
    // relê pra pegar o updated_at que o banco de fato gravou (guarda contra apagar um upsert mais novo)
    const claimed = await knex('ze_delivery_outbox')
      .where({ tenant_id: row.tenant_id, product_id: row.product_id }).first();

    try {
      const cred = await knex('ze_delivery_credentials').where({ tenant_id: row.tenant_id }).first();
      if (!cred) throw new Error('Credenciais não encontradas para o tenant');
      const accessToken = await ensureAccessToken(cred);

      const ctx = new TenantContext({ tenantId: row.tenant_id, userId: cred.system_user_id, role: ROLES.OPERATOR });
      const balance = await new TenantScopedRepository(knex, 'stock_balance', ctx)
        .query().where('product_id', row.product_id).first();
      const quantity = balance ? Number(balance.current_stock) : 0;

      await client.updateAvailability({ environment: cred.environment, accessToken, zeItemId: row.ze_item_id, quantity });

      // se um upsert mais novo chegou entre o claim e agora, updated_at não bate — não apaga (fica pro próximo ciclo)
      await knex('ze_delivery_outbox')
        .where({ tenant_id: row.tenant_id, product_id: row.product_id, updated_at: claimed.updated_at })
        .del();
      await knex('ze_delivery_credentials').where({ tenant_id: row.tenant_id }).update({ last_sync_outbound_at: new Date() });
      summary.succeeded++;
    } catch (err) {
      summary.failed++;
      const patch = { last_error: String(err.message || err) };
      patch.status = claimed.attempts >= OUTBOX_MAX_ATTEMPTS ? 'error' : 'pending';
      await knex('ze_delivery_outbox').where({ tenant_id: row.tenant_id, product_id: row.product_id }).update(patch);
    }
  }

  return summary;
}

function safeParseJson(v) {
  if (v == null || typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
}

/**
 * Log de pedidos do Zé Delivery — base do faturamento e da tela de conferência (requisito
 * explícito do usuário). Uma linha por pedido, sempre o último estado conhecido.
 */
async function listOrders(ctx, { status, dateFrom, dateTo, page = 1, limit = 50 } = {}) {
  const base = () => {
    const q = knex('ze_delivery_orders').where('tenant_id', ctx.tenantId);
    if (status) q.andWhere('status', status);
    if (dateFrom) q.andWhere('created_at', '>=', dateFrom);
    if (dateTo) q.andWhere('created_at', '<=', `${dateTo} 23:59:59`);
    return q;
  };

  const countRow = await base().count({ c: '*' }).first();
  const total = Number(countRow ? countRow.c : 0);
  const rows = await base()
    .select('id', 'order_number', 'status', 'total_value', 'items_json', 'concluded_at', 'cancelled_at', 'created_at', 'updated_at')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);

  const totalsRow = await knex('ze_delivery_orders')
    .where('tenant_id', ctx.tenantId)
    .andWhere('status', 'CONCLUDED')
    .modify((qb) => {
      if (dateFrom) qb.andWhere('created_at', '>=', dateFrom);
      if (dateTo) qb.andWhere('created_at', '<=', `${dateTo} 23:59:59`);
    })
    .sum({ total: 'total_value' })
    .first();

  return {
    items: rows.map((r) => ({ ...r, items_json: safeParseJson(r.items_json) })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totalValueConcluded: Number(totalsRow?.total) || 0,
  };
}

/**
 * Painel de status: credenciais + últimos movimentos de estoque originados desta integração
 * + quantos itens da fila de saída estão travados em erro. Consumido pela tela de config.
 */
async function getStatus(ctx) {
  const [credentials, recentMovements, outboxErrorRow] = await Promise.all([
    getCredentials(ctx),
    new TenantScopedRepository(knex, 'stock_movements', ctx)
      .query()
      .whereIn('stock_movements.source', ['ze_delivery_order', 'ze_delivery_import'])
      .join('products', 'products.id', 'stock_movements.product_id')
      .select(
        'stock_movements.id', 'stock_movements.type', 'stock_movements.quantity',
        'stock_movements.source', 'stock_movements.created_at', 'products.name as product_name'
      )
      .orderBy('stock_movements.created_at', 'desc')
      .limit(20),
    knex('ze_delivery_outbox').where({ tenant_id: ctx.tenantId, status: 'error' }).count({ c: '*' }).first(),
  ]);

  return {
    credentials,
    recentMovements,
    outboxErrorCount: Number(outboxErrorRow?.c || 0),
  };
}

module.exports = {
  getCredentials, upsertCredentials, ensureSystemUser, ensureAccessToken, testConnection, importCatalog,
  pollAllTenants, drainOutbox, listOrders, getStatus,
};
