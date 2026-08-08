'use strict';

const path = require('path');
const dotenv = require('dotenv');

// Carrega .env da raiz do monorepo (um nível acima de apps/api), com fallback local.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // fallback: .env em apps/api se existir

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
    }
  }
  return v;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isTest = NODE_ENV === 'test';

const env = {
  NODE_ENV,
  isProd: NODE_ENV === 'production',
  isTest,
  PORT: parseInt(process.env.PORT || '3000', 10),
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5173',
  ROOT_DOMAIN: process.env.ROOT_DOMAIN || 'distok.com.br',

  JWT_SECRET: required('JWT_SECRET', isTest ? 'test-secret' : undefined),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: isTest
      ? process.env.DB_TEST_NAME || 'distok_test'
      : process.env.DB_NAME || 'distok',
  },

  mail: {
    resendApiKey: required('RESEND_API_KEY', isTest ? '' : undefined),
    from: process.env.MAIL_FROM || 'SUPORTE DISTOK <suporte@distok.com.br>',
  },

  uploads: {
    dir: process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads'),
    publicUrl: process.env.UPLOADS_PUBLIC_URL || 'http://localhost:3000/uploads',
  },

  // Alerting de erro em produção (P1 #5). Sem DSN, o app roda normalmente sem enviar nada.
  SENTRY_DSN: process.env.SENTRY_DSN || '',

  security: {
    // Chave AES-256-GCM (base64 de 32 bytes) p/ credenciais de integrações em repouso (ex.: Zé Delivery).
    encryptionKey: required('ZE_DELIVERY_ENC_KEY', isTest ? '6ELR8j9Ab7YhIb+jtDb9Oe0fU2NpWnldlaxXjxo701o=' : undefined),
  },

  zeDelivery: {
    // Segredo compartilhado dos endpoints internos de cron (/internal/ze-delivery/*), não é JWT.
    cronSecret: required('ZE_DELIVERY_CRON_SECRET', isTest ? 'test-cron-secret' : undefined),
  },
};

module.exports = env;
