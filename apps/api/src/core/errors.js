'use strict';

const { ERROR_CODES } = require('@distok/shared');

/** Erro de aplicação com código de negócio + status HTTP padronizados (arch §9). */
class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details || undefined;
  }
}

const Errors = {
  validation: (msg = 'Dados inválidos', details) => new AppError(400, ERROR_CODES.VALIDATION, msg, details),
  unauthorized: (msg = 'Não autenticado') => new AppError(401, ERROR_CODES.UNAUTHORIZED, msg),
  forbidden: (msg = 'Sem permissão') => new AppError(403, ERROR_CODES.FORBIDDEN, msg),
  notFound: (msg = 'Não encontrado') => new AppError(404, ERROR_CODES.NOT_FOUND, msg),
  conflict: (msg = 'Conflito') => new AppError(409, ERROR_CODES.CONFLICT, msg),
  planLimit: (msg = 'Limite do plano atingido', details) =>
    new AppError(422, ERROR_CODES.PLAN_LIMIT_EXCEEDED, msg, details),
  insufficientStock: (msg = 'Saldo insuficiente', details) =>
    new AppError(422, ERROR_CODES.INSUFFICIENT_STOCK, msg, details),
  tenantInactive: (msg = 'Acesso bloqueado: distribuidora inativa') =>
    new AppError(403, ERROR_CODES.TENANT_INACTIVE, msg),
};

module.exports = { AppError, Errors };
