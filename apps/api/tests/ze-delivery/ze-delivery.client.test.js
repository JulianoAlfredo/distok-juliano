'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const client = require('../../src/modules/ze-delivery/ze-delivery.client');

function mockFetch({ status = 200, jsonBody = null, textBody = '' } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const text = jsonBody !== null ? JSON.stringify(jsonBody) : textBody;
    return { ok: status >= 200 && status < 300, status, text: async () => text };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test('authenticate: monta form-urlencoded e parseia access_token/expires_in', async () => {
  const fetchImpl = mockFetch({ jsonBody: { access_token: 'abc123', expires_in: 3600 } });
  const result = await client.authenticate({
    environment: 'sandbox', clientId: 'cid', clientSecret: 'secret', fetchImpl,
  });
  assert.strictEqual(result.accessToken, 'abc123');
  assert.strictEqual(result.expiresIn, 3600);
  const call = fetchImpl.calls[0];
  assert.ok(call.url.includes('seller-public-api.release.ze.delivery/auth'));
  assert.strictEqual(call.options.method, 'POST');
  assert.strictEqual(call.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.ok(call.options.body.includes('grant_type=client_credentials'));
  assert.ok(call.options.body.includes('client_id=cid'));
});

test('pollEvents: envia x-polling-merchants e filtros de eventType', async () => {
  const fetchImpl = mockFetch({ jsonBody: [{ eventId: 'e1', eventType: 'CONCLUDED' }] });
  const events = await client.pollEvents({
    environment: 'sandbox', accessToken: 'tok', merchantIds: ['111', '222'], eventType: ['CONCLUDED', 'CANCELLED'], fetchImpl,
  });
  assert.strictEqual(events.length, 1);
  const call = fetchImpl.calls[0];
  assert.strictEqual(call.options.headers['x-polling-merchants'], '111,222');
  assert.strictEqual(call.options.headers.Authorization, 'Bearer tok');
  assert.ok(call.url.includes('eventType=CONCLUDED'));
  assert.ok(call.url.includes('eventType=CANCELLED'));
});

test('pollEvents: sem eventType não filtra (poll de todos os tipos)', async () => {
  const fetchImpl = mockFetch({ jsonBody: [] });
  await client.pollEvents({ environment: 'sandbox', accessToken: 'tok', merchantIds: ['1'], fetchImpl });
  assert.ok(!fetchImpl.calls[0].url.includes('eventType'));
});

test('acknowledgeEvents: envia lote como JSON', async () => {
  const fetchImpl = mockFetch({ status: 202, textBody: '' });
  await client.acknowledgeEvents({
    environment: 'sandbox', accessToken: 'tok', events: [{ id: 'e1', orderId: 'o1', eventType: 'CONCLUDED' }], fetchImpl,
  });
  const call = fetchImpl.calls[0];
  assert.strictEqual(JSON.parse(call.options.body)[0].id, 'e1');
});

test('erro 4xx/5xx vira ZeDeliveryApiError com statusCode e body', async () => {
  const fetchImpl = mockFetch({ status: 401, jsonBody: { message: 'invalid credentials' } });
  await assert.rejects(
    () => client.authenticate({ environment: 'sandbox', clientId: 'x', clientSecret: 'y', fetchImpl }),
    (err) => {
      assert.ok(err instanceof client.ZeDeliveryApiError);
      assert.strictEqual(err.statusCode, 401);
      assert.strictEqual(err.body.message, 'invalid credentials');
      return true;
    }
  );
});

test('falha de rede (fetch rejeita) também vira ZeDeliveryApiError', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  await assert.rejects(
    () => client.getOrder({ environment: 'sandbox', accessToken: 'tok', orderNumber: '123', fetchImpl }),
    (err) => err instanceof client.ZeDeliveryApiError
  );
});

test('getBaseUrl: production vs sandbox', () => {
  assert.strictEqual(client.getBaseUrl('production'), 'https://seller-public-api.ze.delivery');
  assert.strictEqual(client.getBaseUrl('sandbox'), 'https://seller-public-api.release.ze.delivery');
  assert.strictEqual(client.getBaseUrl('bogus'), 'https://seller-public-api.release.ze.delivery');
});
