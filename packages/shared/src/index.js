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
  BASIC: 'basic',
  PRO: 'pro',
});

/** Catálogo de planos padrão (semente). features controla o que cada plano libera. */
const DEFAULT_PLANS = Object.freeze([
  {
    code: PLAN_CODES.BASIC,
    name: 'Básico',
    price_cents: 7990,
    max_users: 3,
    max_products: 200,
    features: {
      csv: false,
      customDomain: false,
      terminology: false,
      reportFooter: false,
    },
  },
  {
    code: PLAN_CODES.PRO,
    name: 'Pro',
    price_cents: 14990,
    max_users: 10,
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
  color_primary: '#2563EB',
  color_secondary: '#1E293B',
  color_accent: '#F59E0B',
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
