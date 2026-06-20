'use strict';

const { AppError } = require('../core/errors');
const { ERROR_CODES } = require('@distok/shared');

/**
 * Handler central de erros (arch §13/§14): resposta padronizada, sem vazar stack.
 */
function registerErrorHandler(app) {
  app.setErrorHandler((err, req, reply) => {
    // Erros de validação do Fastify (JSON Schema)
    if (err.validation) {
      return reply.status(400).send({
        error: { code: ERROR_CODES.VALIDATION, message: 'Dados inválidos', details: err.validation },
      });
    }

    // Rate limit do @fastify/rate-limit
    if (err.statusCode === 429) {
      return reply.status(429).send({
        error: { code: ERROR_CODES.RATE_LIMITED, message: 'Muitas tentativas. Tente novamente em instantes.' },
      });
    }

    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }

    // Conflito de unicidade do MySQL (ex.: SKU/e-mail duplicado)
    if (err.code === 'ER_DUP_ENTRY') {
      return reply.status(409).send({
        error: { code: ERROR_CODES.CONFLICT, message: 'Registro duplicado' },
      });
    }

    req.log.error(err);
    return reply.status(500).send({
      error: { code: 'INTERNAL', message: 'Erro interno' },
    });
  });
}

module.exports = { registerErrorHandler };
