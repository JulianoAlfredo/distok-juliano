'use strict';

const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado pro GCM

function getKey() {
  const raw = env.security.encryptionKey;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ZE_DELIVERY_ENC_KEY inválida: precisa decodificar em 32 bytes (base64 de 32 bytes aleatórios)');
  }
  return key;
}

/** Criptografa um texto (ex.: client_secret) para armazenar em repouso. Retorna 'iv:tag:ciphertext' (base64). */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Descriptografa um valor gerado por encrypt(). */
function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Payload criptografado inválido');
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };
