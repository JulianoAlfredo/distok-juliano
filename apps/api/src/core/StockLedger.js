'use strict';

const { v4: uuid } = require('uuid');
const { MOVEMENT_TYPES } = require('@distok/shared');
const { Errors } = require('./errors');

/**
 * Ledger de estoque — núcleo transacional (arch §8, NFR10/NFR12.1).
 *
 * Mora em core/ porque opera diretamente nas tabelas de negócio
 * (stock_movements/stock_balance) com SELECT ... FOR UPDATE e upsert — algo
 * que o TenantScopedRepository não abstrai. É o único lugar autorizado a isso.
 *
 * Garantias:
 *  - serialização por produto via lock pessimista (FOR UPDATE) → sem corrida de saldo
 *  - movimentação append-only com balance_after (snapshot) e ip
 *  - saldo materializado atualizado na MESMA transação
 *  - auditoria na mesma transação
 *
 * Semântica de quantity:
 *  - entry:      delta = +quantity         (quantity > 0)
 *  - exit:       delta = -quantity         (quantity > 0; bloqueia saldo negativo)
 *  - adjustment: novoSaldo = quantity      (quantity = saldo absoluto alvo; reason obrigatório)
 */
async function createMovement(knex, ctx, input) {
  const { productId, type } = input;
  const quantity = Number(input.quantity);

  if (!Object.values(MOVEMENT_TYPES).includes(type)) {
    throw Errors.validation('Tipo de movimentação inválido');
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw Errors.validation('Quantidade inválida');
  }
  if (type !== MOVEMENT_TYPES.ADJUSTMENT && quantity <= 0) {
    throw Errors.validation('Quantidade deve ser maior que zero');
  }
  if (type === MOVEMENT_TYPES.ADJUSTMENT && !input.reason) {
    throw Errors.validation('Ajuste exige justificativa');
  }

  return knex.transaction(async (trx) => {
    // produto precisa existir e pertencer ao tenant
    const product = await trx('products')
      .where({ id: productId, tenant_id: ctx.tenantId })
      .first();
    if (!product) throw Errors.notFound('Produto não encontrado');

    // lock pessimista do saldo (serializa concorrência por produto)
    const balRow = await trx('stock_balance')
      .where({ tenant_id: ctx.tenantId, product_id: productId })
      .forUpdate()
      .first();
    const current = balRow ? Number(balRow.current_stock) : 0;

    let newBalance;
    if (type === MOVEMENT_TYPES.ENTRY) newBalance = current + quantity;
    else if (type === MOVEMENT_TYPES.EXIT) newBalance = current - quantity;
    else newBalance = quantity; // adjustment: saldo absoluto

    if (type === MOVEMENT_TYPES.EXIT && newBalance < 0) {
      throw Errors.insufficientStock(
        `Saldo insuficiente (${current}). Use Ajuste para corrigir o estoque.`,
        { current, requested: quantity }
      );
    }

    const movementId = uuid();
    await trx('stock_movements').insert({
      id: movementId,
      tenant_id: ctx.tenantId,
      product_id: productId,
      user_id: ctx.userId,
      type,
      quantity: type === MOVEMENT_TYPES.ADJUSTMENT ? newBalance : quantity,
      balance_after: newBalance,
      reason: input.reason || null,
      batch: input.batch || null,
      expires_at: input.expiresAt || null,
      supplier: input.supplier || null,
      invoice_ref: input.invoiceRef || null,
      note: input.note || null,
      ip_address: ctx.ip || null,
    });

    if (balRow) {
      await trx('stock_balance')
        .where({ tenant_id: ctx.tenantId, product_id: productId })
        .update({ current_stock: newBalance, last_movement_id: movementId });
    } else {
      await trx('stock_balance').insert({
        tenant_id: ctx.tenantId,
        product_id: productId,
        current_stock: newBalance,
        last_movement_id: movementId,
      });
    }

    await trx('audit_log').insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      action: `stock.${type}`,
      entity_type: 'stock_movement',
      entity_id: movementId,
      before_json: JSON.stringify({ balance: current }),
      after_json: JSON.stringify({ balance: newBalance, quantity }),
      ip_address: ctx.ip || null,
    });

    return {
      id: movementId,
      productId,
      type,
      quantity,
      balanceBefore: current,
      balanceAfter: newBalance,
      belowMin: newBalance < Number(product.min_stock),
    };
  });
}

module.exports = { createMovement };
