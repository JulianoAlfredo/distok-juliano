'use strict';

const { v4: uuid } = require('uuid');
const crypto = require('crypto');
const { Errors } = require('./errors');

const MAX_ATTEMPTS = 5;

/**
 * Códigos de confirmação por e-mail (6 dígitos) — mora em core/ pelo mesmo motivo do
 * StockLedger: é o único lugar autorizado a tocar account_verification_codes diretamente,
 * reaproveitado por mais de um fluxo (troca de e-mail, verificação de signup) em vez de
 * duplicar a tabela/lógica pra cada um.
 */

function generateCode() {
  // 6 dígitos, sempre com zero à esquerda se precisar (000000-999999)
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

/**
 * Gera um código novo pro (userId, purpose), invalidando qualquer código anterior não usado
 * da mesma combinação (evita múltiplos códigos válidos simultâneos pro mesmo fluxo).
 */
async function create(trx, { userId, purpose, targetEmail }, ttlMinutes = 15) {
  await trx('account_verification_codes')
    .where({ user_id: userId, purpose })
    .whereNull('used_at')
    .update({ used_at: trx.fn.now() }); // invalida os antigos (não "usados" de verdade, mas fecha a janela)

  const code = generateCode();
  await trx('account_verification_codes').insert({
    id: uuid(),
    user_id: userId,
    purpose,
    target_email: targetEmail,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + ttlMinutes * 60 * 1000),
  });
  return code;
}

/**
 * Confirma um código. Lança VALIDATION_ERROR em qualquer caso de falha (código errado,
 * expirado, já usado, ou limite de tentativas estourado) — mensagem propositalmente genérica.
 * Em caso de sucesso, marca used_at e retorna a linha (com target_email, útil pro caller).
 */
async function verify(trx, { userId, purpose, code }) {
  const row = await trx('account_verification_codes')
    .where({ user_id: userId, purpose })
    .whereNull('used_at')
    .orderBy('created_at', 'desc')
    .first();

  if (!row) throw Errors.validation('Código inválido ou expirado');
  if (row.attempts >= MAX_ATTEMPTS) throw Errors.validation('Muitas tentativas — solicite um novo código');
  if (new Date(row.expires_at).getTime() < Date.now()) throw Errors.validation('Código expirado — solicite um novo');

  if (hashCode(code) !== row.code_hash) {
    await trx('account_verification_codes').where({ id: row.id }).increment('attempts', 1);
    throw Errors.validation('Código inválido');
  }

  await trx('account_verification_codes').where({ id: row.id }).update({ used_at: trx.fn.now() });
  return row;
}

module.exports = { create, verify, generateCode, hashCode };
