'use strict';

/**
 * Constantes e enums compartilhados entre apps/api e apps/web.
 * Fonte única de verdade — evita divergência de strings mágicas.
 */

const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
});

const TENANT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

const MOVEMENT_TYPES = Object.freeze({
  ENTRY: 'entry',
  EXIT: 'exit',
  ADJUSTMENT: 'adjustment',
});

const EXIT_REASONS = Object.freeze(['venda', 'perda', 'devolucao', 'transferencia']);

const PLAN_CODES = Object.freeze({
  STANDARD: 'standard',
});

/**
 * Catálogo de planos padrão (semente). Plano único — R$39,90/mês, cobre tudo que o DISTOK
 * oferece hoje. Cobrança real (Stripe) e diferenciação de tiers ficam pra depois.
 */
const DEFAULT_PLANS = Object.freeze([
  {
    code: PLAN_CODES.STANDARD,
    name: 'DISTOK',
    price_cents: 3990,
    max_users: null, // ilimitado
    max_products: null, // ilimitado
    features: {
      csv: true,
      customDomain: true,
      terminology: true,
      reportFooter: true,
    },
  },
]);

/** Chaves de terminologia sobrescrevíveis por tenant (FR11) + rótulos padrão DISTOK. */
const DEFAULT_TERMINOLOGY = Object.freeze({
  product: 'Produto',
  employee: 'Funcionário',
  company: 'Distribuidora',
  stock: 'Estoque',
});

/** Tema padrão DISTOK (fallback de branding — FR13). */
const DEFAULT_BRANDING = Object.freeze({
  display_name: 'DISTOK',
  logo_url: null,
  favicon_url: null,
  color_primary: '#1856F6',
  color_secondary: '#142145',
  color_accent: '#F2A63D',
});

/** Códigos de erro de negócio padronizados (alinhados à arquitetura §9). */
const ERROR_CODES = Object.freeze({
  VALIDATION: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  RATE_LIMITED: 'RATE_LIMITED',
  TENANT_INACTIVE: 'TENANT_INACTIVE',
});

module.exports = {
  ROLES,
  TENANT_STATUS,
  USER_STATUS,
  PRODUCT_STATUS,
  MOVEMENT_TYPES,
  EXIT_REASONS,
  PLAN_CODES,
  DEFAULT_PLANS,
  DEFAULT_TERMINOLOGY,
  DEFAULT_BRANDING,
  ERROR_CODES,
};
