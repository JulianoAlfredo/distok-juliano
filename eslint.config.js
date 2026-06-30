'use strict';

/**
 * ESLint flat config (v9).
 *
 * GATE DE QUALIDADE CRÍTICO (workflow §4.3, arch §4.2):
 * a regra anti-bypass de tenant proíbe acessar tabelas de negócio sensíveis
 * (products, stock_movements, stock_balance) via knex()/trx() diretamente —
 * elas DEVEM passar pelo TenantScopedRepository, que injeta tenant_id.
 * Exceção: arquivos em apps/api/src/core/** (onde o repositório é implementado).
 */

const TENANT_TABLES = '^(products|stock_movements|stock_balance|customers|suppliers|product_categories|product_units|purchases|purchase_items|sales|sale_items|cashier_sessions|cashier_entries|financial_entries)$';

const antiBypassRule = {
  'no-restricted-syntax': [
    'error',
    {
      selector: `CallExpression[callee.name=/^(knex|trx)$/][arguments.0.value=/${TENANT_TABLES}/]`,
      message:
        'Acesso direto a tabela de negócio via knex()/trx() é proibido fora de core/. ' +
        'Use TenantScopedRepository para garantir o isolamento por tenant (NFR2/NFR6).',
    },
  ],
};

module.exports = [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'apps/web/**'],
  },
  {
    files: ['apps/api/**/*.js', 'packages/shared/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        console: 'readonly',
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      ...antiBypassRule,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // o núcleo PODE acessar as tabelas diretamente — é onde mora o escopo de tenant
    files: ['apps/api/src/core/**/*.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // migrations/seeds operam o schema inteiro — isentos
    files: ['apps/api/src/db/migrations/**/*.js', 'apps/api/src/db/seeds/**/*.js', 'apps/api/tests/**/*.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // plan-guard é a camada de enforcement de limites: conta registros por tenant
    // e SEMPRE filtra explicitamente por tenant_id recebido. Exceção consciente.
    files: ['apps/api/src/middlewares/plan-guard.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
