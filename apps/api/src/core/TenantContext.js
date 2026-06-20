'use strict';

const { ROLES } = require('@distok/shared');

/**
 * Contexto do tenant/usuário da requisição, derivado EXCLUSIVAMENTE do JWT
 * (nunca de parâmetros do cliente). Criado pelo middleware de auth.
 */
class TenantContext {
  constructor({ tenantId = null, userId, role }) {
    this.tenantId = tenantId; // null somente para super_admin
    this.userId = userId;
    this.role = role;
  }

  get isSuperAdmin() {
    return this.role === ROLES.SUPER_ADMIN;
  }

  get isAdmin() {
    return this.role === ROLES.ADMIN;
  }

  get isOperator() {
    return this.role === ROLES.OPERATOR;
  }
}

module.exports = TenantContext;
