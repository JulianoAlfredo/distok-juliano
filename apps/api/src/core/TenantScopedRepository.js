'use strict';

/**
 * Repositório com escopo de tenant — ÚNICO ponto de acesso a tabelas de negócio.
 *
 * Garantia de isolamento (arch §4, NFR2/NFR6): toda query base já vem filtrada
 * por tenant_id do TenantContext (JWT), e todo insert injeta tenant_id do contexto.
 * NENHUM módulo de negócio deve chamar knex('<tabela>') diretamente — a regra de
 * lint anti-bypass falha o build caso isso aconteça (ver eslint.config.js).
 *
 * Super admin (tenantId null) ignora o filtro de tenant deliberadamente; toda ação
 * cross-tenant dele deve ser auditada pela camada chamadora.
 */
class TenantScopedRepository {
  /**
   * @param {import('knex').Knex} knex
   * @param {string} table
   * @param {import('./TenantContext')} ctx
   */
  constructor(knex, table, ctx) {
    if (!ctx) throw new Error('TenantContext é obrigatório para acesso a dados');
    this.knex = knex;
    this.table = table;
    this.ctx = ctx;
  }

  /** Query base já escopada ao tenant (exceto super_admin). */
  query(trx) {
    const q = (trx || this.knex)(this.table);
    if (!this.ctx.isSuperAdmin) {
      if (!this.ctx.tenantId) {
        throw new Error('tenantId ausente em contexto não-super para tabela ' + this.table);
      }
      q.where(`${this.table}.tenant_id`, this.ctx.tenantId);
    }
    return q;
  }

  async findById(id, trx) {
    return this.query(trx).where(`${this.table}.id`, id).first();
  }

  async list({ limit = 25, offset = 0 } = {}, trx) {
    return this.query(trx).limit(limit).offset(offset);
  }

  async count(trx) {
    const row = await this.query(trx).count({ c: '*' }).first();
    return Number(row ? row.c : 0);
  }

  /** Insert com tenant_id sempre vindo do contexto (cliente não escolhe). */
  async insert(data, trx) {
    const payload = { ...data };
    if (!this.ctx.isSuperAdmin) {
      payload.tenant_id = this.ctx.tenantId;
    }
    return (trx || this.knex)(this.table).insert(payload);
  }

  /** Update escopado ao tenant. */
  async updateById(id, data, trx) {
    return this.query(trx).where(`${this.table}.id`, id).update(data);
  }
}

module.exports = TenantScopedRepository;
