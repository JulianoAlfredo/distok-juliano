'use strict';

/**
 * Parsing puro de payloads do Zé Delivery — sem knex, sem side effects. Isolado aqui porque
 * os schemas reais de resposta (catálogo, pedido) ainda não foram confirmados contra a API
 * real (sem credenciais no momento desta implementação, só a doc pública). Ajustar os nomes
 * de campo abaixo quando confirmado contra https://seller-public-api.release.ze.delivery —
 * ver plano em /Users/Julio/.claude/plans/wise-inventing-manatee.md, seção "Riscos".
 */

function firstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return null;
}

/** Item de catálogo do Zé -> campos de produto do DISTOK. */
function mapCatalogItem(raw) {
  const externalId = firstDefined(raw.id, raw.itemId, raw.externalId);
  return {
    externalId: externalId !== null ? String(externalId) : null,
    sku: firstDefined(raw.sku, raw.externalCode) !== null ? String(firstDefined(raw.sku, raw.externalCode)) : null,
    name: firstDefined(raw.name, raw.title) !== null ? String(firstDefined(raw.name, raw.title)) : 'Item Zé Delivery',
    price: Number(firstDefined(raw.price, raw.salePrice, raw.value)) || 0,
    availableQuantity: Number(firstDefined(raw.availableQuantity, raw.quantity, raw.stock)) || 0,
  };
}

/** Linhas de um pedido do Zé -> {externalItemId, quantity, unitPrice}. */
function mapOrderLines(order) {
  const items = order?.items || order?.lines || order?.products || [];
  return items.map((it) => ({
    externalItemId: firstDefined(it.itemId, it.id, it.sku) !== null ? String(firstDefined(it.itemId, it.id, it.sku)) : null,
    quantity: Number(firstDefined(it.quantity, it.qty)) || 0,
    unitPrice: Number(firstDefined(it.unitPrice, it.price)) || 0,
  }));
}

/** Resumo de um pedido do Zé -> status conhecido + valor total, p/ ze_delivery_orders. */
function mapOrderSummary(order, fallbackStatus) {
  return {
    status: firstDefined(order?.status, fallbackStatus) || 'UNKNOWN',
    totalValue: order ? (Number(firstDefined(order.total, order.totalValue, order.value)) || null) : null,
  };
}

module.exports = { mapCatalogItem, mapOrderLines, mapOrderSummary };
