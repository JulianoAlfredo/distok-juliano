'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { v4: uuid } = require('uuid');

const knex = require('../../src/db/knex');
const TenantContext = require('../../src/core/TenantContext');
const service = require('../../src/modules/customers/customers.service');
const { ROLES } = require('@distok/shared');

let planId; let tenantId; let userId; let ctx;

before(async () => {
  planId = uuid(); tenantId = uuid(); userId = uuid();
  await knex('plans').insert({ id: planId, code: 'cu-' + planId.slice(0, 5), name: 'P', price_cents: 0, max_users: null, max_products: null, features: JSON.stringify({}) });
  await knex('tenants').insert({ id: tenantId, name: 'T-CU', slug: 'tcu-' + tenantId.slice(0, 6), cnpj: 'D' + tenantId.slice(0, 12), plan_id: planId });
  await knex('users').insert({ id: userId, tenant_id: tenantId, name: 'Admin', email: `admin-${tenantId.slice(0, 5)}@cu.com`, password_hash: 'x', role: ROLES.ADMIN });
  ctx = new TenantContext({ tenantId, userId, role: ROLES.ADMIN });
  ctx.ip = '127.0.0.1';
});

after(async () => {
  await knex('audit_log').where({ tenant_id: tenantId }).del();
  await knex('customers').where({ tenant_id: tenantId }).del();
  await knex('users').where({ tenant_id: tenantId }).del();
  await knex('tenants').where({ id: tenantId }).del();
  await knex('plans').where({ id: planId }).del();
  await knex.destroy();
});

test('create: cria cliente com sucesso', async () => {
  const c = await service.create(ctx, { name: 'João da Silva', phone: '(11) 91234-5678', cpf: '123.456.789-00' });
  assert.strictEqual(c.name, 'João da Silva');
  assert.strictEqual(c.status, 'active');
  assert.ok(c.id);
});

test('create: name nulo é rejeitado pelo banco', async () => {
  // O schema do Fastify bloqueia name vazio em produção.
  // No service puro, name nulo falha na constraint NOT NULL do banco.
  await assert.rejects(() => service.create(ctx, { name: null }));
});

test('list: retorna itens do tenant com paginação', async () => {
  await service.create(ctx, { name: 'Maria Oliveira' });
  const result = await service.list(ctx, { page: 1 });
  assert.ok(result.items.length >= 2);
  assert.ok(result.total >= 2);
  assert.strictEqual(result.page, 1);
  assert.ok(result.pages >= 1);
});

test('list: busca por nome funciona', async () => {
  const result = await service.list(ctx, { search: 'João', page: 1 });
  assert.ok(result.items.every((c) => c.name.includes('João')));
});

test('list: filtro por status funciona', async () => {
  const result = await service.list(ctx, { status: 'active', page: 1 });
  assert.ok(result.items.every((c) => c.status === 'active'));
});

test('update: atualiza campos corretamente', async () => {
  const c = await service.create(ctx, { name: 'Edição Teste' });
  const updated = await service.update(ctx, c.id, { name: 'Edição Atualizada', city: 'São Paulo', state: 'SP' });
  assert.strictEqual(updated.name, 'Edição Atualizada');
  assert.strictEqual(updated.city, 'São Paulo');
  assert.strictEqual(updated.state, 'SP');
});

test('inactivate: inativa cliente', async () => {
  const c = await service.create(ctx, { name: 'Para Inativar' });
  const inactive = await service.inactivate(ctx, c.id);
  assert.strictEqual(inactive.status, 'inactive');
});

test('activate: reativa cliente inativo', async () => {
  const c = await service.create(ctx, { name: 'Para Reativar' });
  await service.inactivate(ctx, c.id);
  const active = await service.activate(ctx, c.id);
  assert.strictEqual(active.status, 'active');
});

test('get: lança NOT_FOUND para id inexistente', async () => {
  await assert.rejects(
    () => service.get(ctx, uuid()),
    (e) => e.code === 'NOT_FOUND'
  );
});

test('history: retorna entradas de auditoria', async () => {
  const c = await service.create(ctx, { name: 'Histórico Teste' });
  await service.update(ctx, c.id, { email: 'h@teste.com' });
  const h = await service.history(ctx, c.id);
  assert.strictEqual(h.customer.id, c.id);
  assert.ok(h.entries.length >= 2);
});

test('isolamento: tenant A não acessa cliente de tenant B', async () => {
  const planB = uuid(); const tenantB = uuid(); const userB = uuid();
  await knex('plans').insert({ id: planB, code: 'cu-b' + planB.slice(0, 4), name: 'PB', price_cents: 0, max_users: null, max_products: null, features: JSON.stringify({}) });
  await knex('tenants').insert({ id: tenantB, name: 'Tenant B', slug: 'tenb-' + tenantB.slice(0, 5), cnpj: 'B' + tenantB.slice(0, 12), plan_id: planB });
  await knex('users').insert({ id: userB, tenant_id: tenantB, name: 'B', email: `b-${tenantB.slice(0, 5)}@b.com`, password_hash: 'x', role: ROLES.ADMIN });
  const ctxB = new TenantContext({ tenantId: tenantB, userId: userB, role: ROLES.ADMIN });
  ctxB.ip = '127.0.0.1';

  const cB = await service.create(ctxB, { name: 'Cliente do Tenant B' });

  // Tenant A tenta acessar cliente de Tenant B
  await assert.rejects(
    () => service.get(ctx, cB.id),
    (e) => e.code === 'NOT_FOUND'
  );

  // limpa tenant B
  await knex('audit_log').where({ tenant_id: tenantB }).del();
  await knex('customers').where({ tenant_id: tenantB }).del();
  await knex('users').where({ id: userB }).del();
  await knex('tenants').where({ id: tenantB }).del();
  await knex('plans').where({ id: planB }).del();
});
