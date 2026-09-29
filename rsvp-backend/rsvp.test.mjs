import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from './functions/rsvp.mjs';

const endpoint = 'https://wedding-test.netlify.app/.netlify/functions/rsvp';
const origin = 'https://rachelwilliam.com';
const receiptHtml = '<!doctype html><html><head><meta name="rsvp-receipt" content="accepted"></head><body>Thank you.</body></html>';

function request(fields = {}, options = {}) {
  const method = options.method ?? 'POST';
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (options.origin !== null) headers.Origin = options.origin ?? origin;
  return new Request(endpoint, {
    method,
    headers,
    ...(method === 'POST' ? {
      body: options.body ?? new URLSearchParams({
        name: 'Guest Name', response: "Yes! I'm in", _honey: '', ...fields,
      }).toString(),
    } : {}),
  });
}

test('forwards valid responses and returns the same correlation ID stored with the form', async t => {
  for (const response of ["Yes! I'm in", "I can't :(", 'I need more time']) {
    await t.test(response, async t => {
      const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
        new Response(receiptHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }));
      const result = await handler(request({ name: '  Guest & Partner  ', response }));
      const json = await result.json();
      assert.equal(result.status, 200);
      assert.equal(json.success, true);
      assert.match(json.submissionId, /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i);
      assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal(result.headers.get('Cache-Control'), 'no-store');
      assert.equal(fetchMock.mock.callCount(), 1);
      const [url, init] = fetchMock.mock.calls[0].arguments;
      assert.equal(String(url), 'https://wedding-test.netlify.app/received.html');
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'manual');
      assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded');
      assert.deepEqual(Object.fromEntries(new URLSearchParams(init.body)), {
        'form-name': 'wedding-response', name: 'Guest & Partner', response,
        _honey: '', 'submission-id': json.submissionId,
      });
    });
  }
});

test('does not confirm failed or unrelated provider responses', async t => {
  for (const [label, status, body, location] of [
    ['provider error', 500, receiptHtml, null],
    ['HTML without receipt marker', 200, '<html><body>Unrelated page</body></html>', null],
    ['empty response', 200, '', null],
    ['wrong receipt marker', 200, '<meta name="rsvp-receipt" content="rejected">', null],
    ['redirect to receipt page', 303, receiptHtml, '/received.html'],
    ['unrelated redirect', 303, '', '/unrelated'],
    ['external receipt redirect', 303, '', 'https://attacker.example/received.html'],
  ]) {
    await t.test(label, async t => {
      t.mock.method(globalThis, 'fetch', async () => new Response(body, {
        status, headers: location ? { Location: location } : {},
      }));
      const result = await handler(request());
      assert.equal(result.status, 502);
      assert.deepEqual(await result.json(), { success: false });
    });
  }
  await t.test('provider network failure', async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network failure'); });
    const result = await handler(request());
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { success: false });
  });
});

test('rejects invalid requests without contacting the provider', async t => {
  for (const [label, req, expected] of [
    ['disallowed origin', request({}, { origin: 'https://attacker.example' }), 403],
    ['missing origin', request({}, { origin: null }), 403],
    ['unsupported method', request({}, { method: 'GET' }), 405],
    ['empty name', request({ name: '   ' }), 400],
    ['long name', request({ name: 'a'.repeat(201) }), 400],
    ['invalid choice', request({ response: 'unexpected choice' }), 400],
    ['filled honeypot', request({ _honey: 'robot' }), 400],
    ['oversized request', request({}, { body: 'x'.repeat(4097) }), 413],
  ]) {
    await t.test(label, async t => {
      const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('Invalid requests must never reach the provider');
      });
      const result = await handler(req);
      assert.equal(result.status, expected);
      assert.deepEqual(await result.json(), { success: false });
      assert.equal(fetchMock.mock.callCount(), 0);
      if (expected === 403) assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
    });
  }
});

test('allows preflight from the wedding site without contacting the provider', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Preflight must never reach the provider');
  });
  const result = await handler(request({}, { method: 'OPTIONS' }));
  assert.equal(result.status, 204);
  assert.equal(await result.text(), '');
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(result.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.equal(result.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  assert.equal(result.headers.get('Vary'), 'Origin');
  assert.equal(fetchMock.mock.callCount(), 0);
});
