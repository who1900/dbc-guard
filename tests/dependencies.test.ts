import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { toBigIntLE, toBigIntBE, toBufferLE, toBufferBE } from 'bigint-buffer';
import { u64, u128, u192, u256, u64be, u128be, u192be, u256be } from '@solana/buffer-layout-utils';
import { Connection, PublicKey } from '@solana/web3.js';

const require = createRequire(import.meta.url);

test('all Solana layout consumers resolve the independent pure-JS codec', () => {
  const consumerRequire = createRequire(require.resolve('@solana/buffer-layout-utils'));
  assert.equal(consumerRequire.resolve('bigint-buffer'), require.resolve('bigint-buffer'));
  assert.equal(require('bigint-buffer/package.json').name, '@dbc-guard/bigint-buffer-purejs');
  assert.equal(require('jayson/package.json').version, '5.0.0');
  const anchorRequire = createRequire(require.resolve('@coral-xyz/anchor'));
  assert.equal(anchorRequire('toml/package.json').version, '4.2.0');
});

test('pure-JS codec exact byte vectors, empty values and non-mutating decode', () => {
  assert.deepEqual(toBufferLE(0x0102030405060708n, 8), Buffer.from('0807060504030201', 'hex'));
  assert.deepEqual(toBufferBE(0x0102030405060708n, 8), Buffer.from('0102030405060708', 'hex'));
  assert.deepEqual(toBufferLE(0n, 0), Buffer.alloc(0));
  assert.deepEqual(toBufferBE(0n, 0), Buffer.alloc(0));
  assert.equal(toBigIntLE(Buffer.alloc(0)), 0n);
  assert.equal(toBigIntBE(Buffer.alloc(0)), 0n);
  const source = Buffer.from('0102030405060708', 'hex');
  const original = Buffer.from(source);
  assert.equal(toBigIntLE(source), 0x0807060504030201n);
  assert.equal(toBigIntBE(source), 0x0102030405060708n);
  assert.deepEqual(source, original);
});

test('pure-JS codec matches unsigned SPL widths and endian layouts at boundaries', () => {
  const little = [u64, u128, u192, u256];
  const big = [u64be, u128be, u192be, u256be];
  for (const [index, width] of [8, 16, 24, 32].entries()) {
    const maximum = (1n << BigInt(width * 8)) - 1n;
    let deterministic = 0x12345678n;
    const values = [0n, 1n, 255n, 256n, maximum - 1n, maximum];
    for (let sample = 0; sample < 50; sample++) {
      deterministic = (deterministic * 6364136223846793005n + 1442695040888963407n) & maximum;
      values.push(deterministic);
    }
    for (const value of values) {
      const expected = value.toString(16).padStart(width * 2, '0');
      const be = toBufferBE(value, width);
      const le = toBufferLE(value, width);
      assert.equal(be.toString('hex'), expected);
      assert.deepEqual(le, Buffer.from(be).reverse());
      assert.equal(toBigIntBE(be), value);
      assert.equal(toBigIntLE(le), value);
      for (const [layout, encoded] of [[little[index](), le], [big[index](), be]] as const) {
        const output = Buffer.alloc(width + 4, 0xaa);
        assert.equal(layout.encode(value, output, 2), width);
        assert.deepEqual(output.subarray(2, width + 2), encoded);
        assert.equal(layout.decode(output, 2), value);
        assert.deepEqual(output.subarray(0, 2), Buffer.from([0xaa, 0xaa]));
        assert.deepEqual(output.subarray(width + 2), Buffer.from([0xaa, 0xaa]));
      }
    }
  }
});

test('pure-JS codec rejects overflow, negative values, invalid widths and invalid types', () => {
  for (const encode of [toBufferLE, toBufferBE]) {
    for (const width of [0, 1, 8, 16, 24, 32]) {
      assert.throws(() => encode(1n << BigInt(width * 8), width), RangeError);
      assert.throws(() => encode(-1n, width), RangeError);
    }
    for (const width of [-1, 1.5, NaN, Infinity, 1025, Number.MAX_SAFE_INTEGER]) assert.throws(() => encode(0n, width), RangeError);
    assert.throws(() => encode(1 as unknown as bigint, 8), TypeError);
    assert.equal(encode(1n, 1024).length, 1024);
  }
  for (const decode of [toBigIntLE, toBigIntBE]) assert.throws(() => decode(new Uint8Array(8) as Buffer), TypeError);
});

test('patched TOML preserves Anchor Buffer parser contract without prototype pollution', () => {
  const anchorRequire = createRequire(require.resolve('@coral-xyz/anchor'));
  const toml = anchorRequire('toml');
  const parsed = toml.parse(Buffer.from('[provider]\ncluster = "devnet"\n[programs.devnet]\ndbc = "11111111111111111111111111111111"\n'));
  assert.equal(parsed.provider.cluster, 'devnet');
  assert.equal(parsed.programs.devnet.dbc, PublicKey.default.toBase58());
  for (const input of ['[__proto__]\npolluted = true', '[constructor.prototype]\npolluted = true']) {
    try { toml.parse(input); } catch { /* Rejection and own-key parsing are both safe. */ }
    assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  }
  assert.throws(() => toml.parse('value = ' + '['.repeat(600) + '0' + ']'.repeat(600)), /Maximum nesting depth/);
});

test('overridden Jayson browser client preserves actual web3 RPC request/response behavior', async () => {
  const ids: unknown[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.jsonrpc, '2.0');
    assert.equal(request.method, 'getSlot');
    assert.deepEqual(request.params, [{ commitment: 'confirmed' }]);
    assert.equal(typeof request.id, 'string');
    ids.push(request.id);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: 123 }), { headers: { 'content-type': 'application/json' } });
  };
  const connection = new Connection('http://127.0.0.1:1', { commitment: 'confirmed', fetch: fetchImpl });
  assert.equal(await connection.getSlot(), 123);
  assert.equal(await connection.getSlot(), 123);
  assert.notEqual(ids[0], ids[1]);
  const failing = new Connection('http://127.0.0.1:1', { fetch: async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32000, message: 'fixture RPC rejection' } }));
  } });
  await assert.rejects(() => failing.getSlot(), /fixture RPC rejection/);
});
