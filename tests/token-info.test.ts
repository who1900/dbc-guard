import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { PublicKey, type AccountInfo } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ExtensionType } from '@solana/spl-token';
import { decodeTokenInfo, readTokenInfo, METADATA_PROGRAM, unavailableTokenInfo } from '../server/token-info.js';
import { createApp } from '../server/index.js';
import { demo } from '../src/demo.js';

const mint = new PublicKey('So11111111111111111111111111111111111111112');
const other = PublicKey.default;
const network = 'mainnet-beta';
function account(data: Buffer, owner = TOKEN_PROGRAM_ID): AccountInfo<Buffer> { return { data, owner, executable: false, lamports: 1, rentEpoch: 0 }; }
function mintAccount(owner = TOKEN_PROGRAM_ID) { const data = Buffer.alloc(82); data[45] = 1; return account(data, owner); }
function borsh(value: string) { const data = Buffer.from(value); const size = Buffer.alloc(4); size.writeUInt32LE(data.length); return Buffer.concat([size, data]); }
function metadata(name = 'Wrapped SOL\0', symbol = 'SOL\0') {
  return account(Buffer.concat([Buffer.from([4]), Buffer.alloc(32), mint.toBuffer(), borsh(name), borsh(symbol), borsh('https://untrusted.example/metadata.json'), Buffer.alloc(2), Buffer.from([0, 0, 1])]), METADATA_PROGRAM);
}
function extended(binding = mint, name = 'Token 2022') {
  const payload = Buffer.concat([Buffer.alloc(32), binding.toBuffer(), borsh(name), borsh('T22'), borsh('http://127.0.0.1/private'), Buffer.alloc(4)]);
  const header = Buffer.alloc(4); header.writeUInt16LE(ExtensionType.TokenMetadata); header.writeUInt16LE(payload.length, 2);
  const data = Buffer.alloc(166); data[45] = 1; data[165] = 1;
  return account(Buffer.concat([data, header, payload]), TOKEN_2022_PROGRAM_ID);
}
test('canonical metadata exposes sanitized issuer-supplied name and symbol', () => {
  assert.deepEqual(decodeTokenInfo(mint, network, mintAccount(), metadata()), { mint: mint.toBase58(), network, name: 'Wrapped SOL', symbol: 'SOL', source: 'metaplex' });
  assert.equal(decodeTokenInfo(mint, network, mintAccount(), metadata('A\u202eB\u0001', 'X')).name, 'AB');
});
test('metadata rejects wrong owner, mint binding, key, executable, overlong and truncated accounts', () => {
  const variants = [metadata(), metadata(), metadata(), metadata(), metadata(), metadata(), metadata()];
  variants[0].owner = TOKEN_PROGRAM_ID; other.toBuffer().copy(variants[1].data, 33); variants[2].data[0] = 1; variants[3].executable = true;
  variants[4].data = variants[4].data.subarray(0, -2); variants[5].data.writeUInt32LE(0xffffffff, 65); variants[6].data = Buffer.alloc(4097);
  for (const value of variants) assert.equal(decodeTokenInfo(mint, network, mintAccount(), value).source, 'unavailable');
  assert.equal(decodeTokenInfo(mint, network, mintAccount(), metadata('A'.repeat(33))).source, 'unavailable');
  assert.equal(decodeTokenInfo(mint, network, mintAccount(), metadata('A', 'A'.repeat(11))).source, 'unavailable');
});
test('mint owner, initialized state and executable validation cannot be bypassed by metadata', () => {
  const variants = [mintAccount(), mintAccount(), mintAccount()]; variants[0].owner = METADATA_PROGRAM; variants[1].data[45] = 0; variants[2].executable = true;
  for (const value of [...variants, null]) assert.equal(decodeTokenInfo(mint, network, value, metadata()).source, 'unavailable');
});
test('token-2022 embedded metadata checks mint binding and complete bounded TLV', () => {
  assert.equal(decodeTokenInfo(mint, network, extended(), null).source, 'token-2022');
  assert.equal(decodeTokenInfo(mint, network, extended(other), metadata()).source, 'unavailable');
  const truncated = extended(); truncated.data = truncated.data.subarray(0, -1);
  assert.equal(decodeTokenInfo(mint, network, truncated, null).source, 'unavailable');
  const badPadding = extended(); badPadding.data = Buffer.concat([badPadding.data, Buffer.alloc(4), Buffer.from([1])]);
  assert.equal(decodeTokenInfo(mint, network, badPadding, null).source, 'unavailable');
  const duplicate = extended(); duplicate.data = Buffer.concat([duplicate.data, duplicate.data.subarray(166)]);
  assert.equal(decodeTokenInfo(mint, network, duplicate, null).source, 'unavailable');
  assert.equal(decodeTokenInfo(mint, network, extended(mint, 'A'.repeat(81)), null).name?.length, 80);
});
test('one batched RPC reads canonical account addresses without fetching issuer URI', async () => {
  const calls: unknown[] = [];
  const response = await readTokenInfo(mint.toBase58(), network, { fetchImpl: async (_url, init) => {
    const request = JSON.parse(String(init?.body)); calls.push(request);
    assert.equal(request.method, 'getMultipleAccounts'); assert.equal(request.params[0][0], mint.toBase58()); assert.equal(request.params[0].length, 2);
    return Response.json({ result: { value: [mintAccount(), metadata()].map(value => ({ ...value, owner: value.owner.toBase58(), data: [value.data.toString('base64'), 'base64'] })) } });
  } });
  assert.equal(response.name, 'Wrapped SOL'); assert.equal(calls.length, 1);
});
test('RPC failure, oversized account, invalid response and cancellation return unavailable', async () => {
  for (const value of [{ value: [] }, { value: [{ owner: TOKEN_PROGRAM_ID.toBase58(), executable: false, data: ['A'.repeat(90000), 'base64'] }, null] }]) {
    assert.equal((await readTokenInfo(mint.toBase58(), network, { fetchImpl: async () => Response.json({ result: value }) })).source, 'unavailable');
  }
  const controller = new AbortController(); controller.abort(); let calls = 0;
  assert.equal((await readTokenInfo(mint.toBase58(), network, { signal: controller.signal, fetchImpl: async () => { calls++; throw new Error('private'); } })).source, 'unavailable'); assert.equal(calls, 0);
});
async function serve(options: Parameters<typeof createApp>[0], run: (base: string) => Promise<void>) {
  const server = createApp(options).listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
const route = `/api/token-info?address=${mint.toBase58()}&network=${network}`;
test('metadata endpoint validates inputs, hides errors, caches bounded identity and leaves inspection independent', async () => {
  let calls = 0; let now = 1000;
  await serve({ now: () => now, readReport: async () => demo, readTokenInfo: async (address, chain) => { calls++; return { ...unavailableTokenInfo(address, chain), name: 'SOL', source: 'metaplex' }; } }, async base => {
    assert.equal((await fetch(base + '/api/token-info?address=bad&network=mainnet-beta')).status, 400);
    assert.equal((await fetch(base + route.replace('mainnet-beta', 'other'))).status, 400);
    const result = await fetch(base + route); assert.equal(result.headers.get('cache-control'), 'no-store'); assert.equal((await result.json()).name, 'SOL');
    await fetch(base + route); assert.equal(calls, 1); now += 60000; await fetch(base + route); assert.equal(calls, 2);
    assert.equal((await fetch(base + `/api/inspect?address=${mint.toBase58()}&network=${network}`)).status, 200);
  });
  await serve({ readTokenInfo: async () => { throw new Error('private-rpc-key'); } }, async base => { const result = await fetch(base + route); assert.equal(result.status, 200); assert.deepEqual(await result.json(), unavailableTokenInfo(mint.toBase58(), network)); });
});
test('metadata endpoint has per-IP rate and bucket limits', async () => {
  await serve({ rateLimit: 1, maxBuckets: 1, readTokenInfo: async (address, chain) => unavailableTokenInfo(address, chain) }, async base => {
    assert.equal((await fetch(base + route)).status, 200); assert.equal((await fetch(base + route)).status, 429);
    assert.equal((await fetch(base + route, { headers: { 'X-Forwarded-For': '198.51.100.1' } })).status, 429);
  });
});
test('deadline aborts metadata without blocking core inspection or releasing unsettled slots', async () => {
  let calls = 0; let aborts = 0; const releases: (() => void)[] = [];
  await serve({ tokenInfoDeadlineMs: 15, readReport: async () => demo, readTokenInfo: async (address, chain, options) => {
    calls++; options?.signal?.addEventListener('abort', () => { aborts++; }); await new Promise<void>(resolve => releases.push(resolve)); return unavailableTokenInfo(address, chain);
  } }, async base => {
    for (let i = 0; i < 5; i++) assert.equal((await fetch(base + route)).status, 200);
    assert.equal(calls, 4); assert.equal(aborts, 4);
    assert.equal((await fetch(base + `/api/inspect?address=${mint.toBase58()}&network=${network}`)).status, 200);
    releases.forEach(resolve => resolve());
  });
});
test('disconnect aborts the metadata RPC signal', async () => {
  let started!: () => void; let aborted!: () => void;
  const start = new Promise<void>(resolve => { started = resolve; }); const abort = new Promise<void>(resolve => { aborted = resolve; });
  await serve({ readTokenInfo: async (_address, _chain, options) => {
    started(); return new Promise((_resolve, reject) => { options?.signal?.addEventListener('abort', () => { aborted(); reject(new Error('cancelled')); }, { once: true }); });
  } }, async base => {
    const controller = new AbortController(); const response = fetch(base + route, { signal: controller.signal }).catch(() => null);
    await start; controller.abort(); await response;
    await Promise.race([abort, new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('work not aborted')), 1000))]);
  });
});
test('metadata cache retains no more than 200 identities', async () => {
  let calls = 0;
  await serve({ rateLimit: 500, readTokenInfo: async (address, chain) => { calls++; return unavailableTokenInfo(address, chain); } }, async base => {
    const first = new PublicKey(Buffer.alloc(32, 1)).toBase58();
    for (let i = 1; i <= 201; i++) { const address = new PublicKey(Buffer.alloc(32, i)).toBase58(); assert.equal((await fetch(base + `/api/token-info?address=${address}&network=${network}`)).status, 200); }
    assert.equal(calls, 201); await fetch(base + `/api/token-info?address=${first}&network=${network}`); assert.equal(calls, 202);
  });
});
