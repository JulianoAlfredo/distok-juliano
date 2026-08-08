'use strict';

/**
 * Idempotência do ledger: source identifica quem gerou a movimentação ('manual' é o default
 * e cobre TODOS os chamadores existentes sem qualquer mudança de comportamento) e external_ref
 * é a chave de deduplicação de eventos externos (ex.: `${eventId}:${productId}` do polling do
 * Zé Delivery). A UNIQUE KEY é o que garante que reentrega/retry nunca duplica uma baixa —
 * StockLedger.createMovement faz pre-check + fallback em ER_DUP_ENTRY sobre ela.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE stock_movements
      ADD COLUMN source VARCHAR(30) NOT NULL DEFAULT 'manual',
      ADD COLUMN external_ref VARCHAR(150) NULL,
      ADD UNIQUE KEY uq_mov_tenant_source_ref (tenant_id, source, external_ref);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE stock_movements
      DROP KEY uq_mov_tenant_source_ref,
      DROP COLUMN source,
      DROP COLUMN external_ref;
  `);
};
