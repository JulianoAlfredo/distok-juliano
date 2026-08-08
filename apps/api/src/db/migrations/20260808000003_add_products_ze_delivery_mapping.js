'use strict';

/**
 * Mapeamento produto <-> item do Zé Delivery + toggle explícito de participação na
 * integração. Nem todo produto do DISTOK existe no Zé (ou o tenant pode querer gerenciar
 * um produto só de um lado) — ze_delivery_sync_enabled controla as duas direções
 * (entrada e saída) e só faz sentido true quando há ze_delivery_item_id setado.
 * MySQL/MariaDB trata múltiplos NULLs como distintos em UNIQUE KEY, então produtos sem
 * mapeamento (a maioria) não colidem entre si.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE products
      ADD COLUMN ze_delivery_item_id VARCHAR(100) NULL,
      ADD COLUMN ze_delivery_sync_enabled TINYINT(1) NOT NULL DEFAULT 0,
      ADD UNIQUE KEY uq_products_tenant_ze_item (tenant_id, ze_delivery_item_id);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE products
      DROP KEY uq_products_tenant_ze_item,
      DROP COLUMN ze_delivery_item_id,
      DROP COLUMN ze_delivery_sync_enabled;
  `);
};
