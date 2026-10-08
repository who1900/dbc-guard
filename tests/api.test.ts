import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/index.js';
import { InvalidAccountError, RpcTransportError } from '../server/reader.js';
import { InputResolutionError } from '../server/resolve.js';
import { demo } from '../src/demo.js';

const address = '8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW';
const route = `/api/inspect?address=${address}&network=mainnet-beta`;
test('API input guidance and multiple-pool selection preserve typed error semantics', async () => {
  await serve({ inspectInput: async () => { throw new InputResolutionError('Shared authority; paste a pool or token.', 'SHARED_AUTHORITY'); } }, async base => { const result = await fetch(base + route); assert.equal(result.status, 422); const body = await result.json(); assert.equal(body.code, 'SHARED_AUTHORITY'); assert.equal(body.retryable, false); });
  await serve({ inspectInput: async () => { throw new InputResolutionError('Choose a pool.', 'MULTIPLE_POOLS', 409, [address]); } }, async base => { const result = await fetch(base + route); assert.equal(result.status, 409); const body = await result.json(); assert.deepEqual(body.candidates, [address]); assert.equal(body.retryable, false); });
});
test('temporary discovery provider failure offers retry without treating invalid input as transient', async () => {
  await serve({ inspectInput: async () => { throw new InputResolutionError('Lookup temporarily unavailable; retry or paste the pool.', 'DISCOVERY_UNAVAILABLE', 503); } }, async base => {
    const response = await fetch(base + route); assert.equal(response.status, 503);
    const body = await response.json(); assert.equal(body.code, 'DISCOVERY_UNAVAILABLE'); assert.equal(body.retryable, true);
  });
});
test('upstream rate limit preserves429, bounded Retry-After and provider-safe guidance', async () => {
  await serve({ inspectInput: async () => { throw new RpcTransportError('private-provider-token', true, 429, 7); } }, async base => {
    const response = await fetch(base + route); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '7');
    const body = await response.json(); assert.equal(body.code, 'RPC_BUSY'); assert.equal(body.retryable, true); assert.equal(body.error, 'Solana RPC is busy. Retry shortly.'); assert.ok(!JSON.stringify(body).includes('private-provider-token'));
  });
});
async function serve(options: Parameters<typeof createApp>[0], run: (base: string) => Promise<void>) {
  const server = createApp(options).listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
test('API validates input/network, exposes health/security headers and JSON404', async () => {
  await serve({ readReport: async () => demo }, async base => {
    const health = await fetch(base + '/api/health'); assert.equal(health.status, 200); assert.ok(health.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    assert.equal((await fetch(base + '/api/inspect?address=invalid&network=mainnet-beta')).status, 400);
    assert.equal((await fetch(base + `/api/inspect?address=${address}&network=other`)).status, 400);
    const missing = await fetch(base + '/api/unknown'); assert.equal(missing.status, 404); assert.equal((await missing.json()).error, 'API route not found.');
  });
});
test('API maps only validated account errors to422 and hides upstream details', async () => {
  await serve({ readReport: async () => { throw new InvalidAccountError('Not a DBC pool'); } }, async base => { const response = await fetch(base + route); assert.equal(response.status, 422); assert.equal((await response.json()).error, 'Not a DBC pool'); });
  await serve({ readReport: async () => { throw new Error('private-rpc-token'); } }, async base => { const response = await fetch(base + route); assert.equal(response.status, 502); assert.ok(!JSON.stringify(await response.json()).includes('private-rpc-token')); });
});
test('API deduplicates in-flight work and caches for20seconds', async () => {
  let calls = 0; let now = 1000;
  await serve({ now: () => now, readReport: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 20)); return demo; } }, async base => {
    const results = await Promise.all([fetch(base + route), fetch(base + route)]); assert.ok(results.every(r => r.status === 200)); assert.equal(calls, 1); assert.equal(results[0].headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(base + route)).status, 200); assert.equal(calls, 1);
    now += 20001; assert.equal((await fetch(base + route)).status, 200); assert.equal(calls, 2);
  });
});
test('IP buckets are capped and expire; per-IP rate limit returns429', async () => {
  let now = 1000;
  await serve({ now: () => now, maxBuckets: 1, rateLimit: 1, readReport: async () => demo }, async base => {
    assert.equal((await fetch(base + route, { headers: { 'X-Forwarded-For': '198.51.100.1' } })).status, 200);
    const limited = await fetch(base + route, { headers: { 'X-Forwarded-For': '198.51.100.1' } }); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
    assert.equal((await fetch(base + route, { headers: { 'X-Forwarded-For': '198.51.100.2' } })).status, 429);
    now += 60000; assert.equal((await fetch(base + route, { headers: { 'X-Forwarded-For': '198.51.100.2' } })).status, 200);
  });
});
test('deadline aborts work without freeing an unsettled concurrency slot', async () => {
  let abortObserved = false; let release!: () => void;
  await serve({ deadlineMs: 15, maxActive: 1, readReport: async (_a, _n, options) => { options?.signal?.addEventListener('abort', () => { abortObserved = true; }); await new Promise<void>(resolve => { release = resolve; }); return demo; } }, async base => {
    assert.equal((await fetch(base + route)).status, 502); assert.equal(abortObserved, true);
    assert.equal((await fetch(base + route.replace('mainnet-beta', 'devnet'))).status, 429);
    release();
  });
});
test('disconnecting the last client aborts the actual inspection', async () => {
  let started!: () => void; let aborted!: () => void;
  const start = new Promise<void>(resolve => { started = resolve; });
  const abort = new Promise<void>(resolve => { aborted = resolve; });
  await serve({ readReport: async (_a, _n, options) => {
    started();
    return new Promise((_resolve, reject) => { options?.signal?.addEventListener('abort', () => { aborted(); reject(new Error('aborted')); }, { once: true }); });
  } }, async base => {
    const controller = new AbortController(); const response = fetch(base + route, { signal: controller.signal }).catch(() => null);
    await start; controller.abort(); await response;
    await Promise.race([abort, new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('work not aborted')), 1000))]);
  });
});
