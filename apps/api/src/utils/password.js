'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const env = require('../config/env');

async function hash(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

async function compare(plain, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(plain, passwordHash);
}

/** Gera senha temporária legível para onboarding/reset. */
function generateTempPassword() {
  return crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) + '1!';
}

/** Token de reset (claro p/ e-mail) + hash (p/ armazenar). */
function generateResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { hash, compare, generateTempPassword, generateResetToken, hashResetToken };
