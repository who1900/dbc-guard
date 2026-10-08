import test from 'node:test';
import assert from 'node:assert/strict';
import BN from 'bn.js';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { createDbcProgram, deriveDbcPoolAuthority, deriveDbcPoolAddress, DYNAMIC_BONDING_CURVE_PROGRAM_ID } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { MintLayout, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { inspectInput, InputResolutionError, BASE_MINT_OFFSET } from '../server/resolve.js';

type FieldType = string | { defined?: { name: string }; array?: [FieldType, number] };
const { program } = createDbcProgram(new Connection('http://127.0.0.1:1'));
function blank(type: FieldType): unknown {
  if (typeof type === 'string') return type === 'pubkey' ? PublicKey.default : /^(u|i)(64|128|256)$/.test(type) ? new BN(0) : 0;
  if (type.array) return Array.from({ length: type.array[1] }, () => blank(type.array![0]));
  const definition = program.idl.types.find(item => item.name === type.defined?.name)!;
  return Object.fromEntries((definition.type as { fields: { name: string; type: FieldType }[] }).fields.map(field => [field.name, blank(field.type)]));
}
const layouts = (program.coder.accounts as unknown as { accountLayouts: Map<string, { discriminator: number[]; layout: { encode(value: unknown, buffer: Buffer): number } }> }).accountLayouts;
function encode(name: string, value: unknown) { const layout = layouts.get(name)!; const buffer = Buffer.alloc(65536); const size = layout.layout.encode(value, buffer); return Buffer.concat([Buffer.from(layout.discriminator), buffer.subarray(0, size)]); }
function fixture(hook = false, token2022 = false, count = 1) {
  const mint = Keypair.generate().publicKey; const quote = Keypair.generate().publicKey;
  const accounts = new Map<string, Record<string, unknown>>(); const pools: string[] = [];
  const account = (data: Buffer, owner = DYNAMIC_BONDING_CURVE_PROGRAM_ID) => ({ data: [data.toString('base64'), 'base64'], owner: owner.toBase58(), executable: false, lamports: 10000, rentEpoch: 0 });
  const mintData = Buffer.alloc(MintLayout.span); MintLayout.encode({ mintAuthorityOption: 0, mintAuthority: PublicKey.default, supply: 1000n, decimals: 9, isInitialized: true, freezeAuthorityOption: 0, freezeAuthority: PublicKey.default }, mintData);
  accounts.set(mint.toBase58(), account(mintData, token2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID)); accounts.set(quote.toBase58(), account(mintData, TOKEN_PROGRAM_ID));
  const family = hook ? 'transferHookPool' : 'virtualPool';
  for (let i = 0; i < count; i++) {
    const configKey = Keypair.generate().publicKey; const config = blank({ defined: { name: 'poolConfig' } }) as Record<string, unknown>;
    Object.assign(config, { quoteMint: quote, swapBaseAmount: new BN(900), migrationBaseThreshold: new BN(100), migrationQuoteThreshold: new BN(100), preMigrationTokenSupply: new BN(1000), postMigrationTokenSupply: new BN(1000), fixedTokenSupplyFlag: 1, partnerPermanentLockedLiquidityPercentage: 100, sqrtStartPrice: new BN(1), migrationSqrtPrice: new BN(2), migrationOption: 1 });
    Object.assign((config.curve as Record<string, unknown>[])[0], { sqrtPrice: new BN(2), liquidity: new BN(100) });
    const pool = blank({ defined: { name: 'poolState' } }) as Record<string, unknown>; Object.assign(pool, { config: configKey, baseMint: mint, quoteReserve: new BN(50) });
    const address = deriveDbcPoolAddress(quote, mint, configKey).toBase58(); pools.push(address);
    const poolData = encode(family, { poolState: pool }); assert.equal(poolData.subarray(BASE_MINT_OFFSET, BASE_MINT_OFFSET + 32).toString('hex'), mint.toBuffer().toString('hex'));
    accounts.set(address, account(poolData));
    accounts.set(configKey.toBase58(), account(encode(hook ? 'configWithTransferHook' : 'poolConfig', hook ? { ...(blank({ defined: { name: 'configWithTransferHook' } }) as object), config, transferHookProgram: Keypair.generate().publicKey } : config)));
  }
  const requests: { method: string; params: unknown[] }[] = [];
  let blockedSearch = false; let overrideMatches: string[] | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)); requests.push(body);
    let result: unknown;
    if (body.method === 'getAccountInfo') result = { context: { slot: 100 }, value: accounts.get(body.params[0]) ?? null };
    else if (body.method === 'getMultipleAccounts') result = { context: { slot: 101 }, value: body.params[0].map((key: string) => accounts.get(key) ?? null) };
    else if (body.method === 'getProgramAccounts') {
      if (blockedSearch) return Response.json({ jsonrpc: '2.0', id: body.id, error: { code: -32010, message: 'index excluded' } });
      const config = body.params[1]; assert.deepEqual(config.dataSlice, { offset: 0, length: 0 }); assert.equal(config.filters.length, 2); assert.equal(config.filters[1].memcmp.offset, 136); assert.equal(config.filters[1].memcmp.bytes, mint.toBase58());
      const matches = overrideMatches ?? (requests.filter(r => r.method === 'getProgramAccounts').length % 2 === (hook ? 0 : 1) ? pools : []);
      result = matches.map(pubkey => ({ pubkey, account: { owner: DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58(), data: ['', 'base64'] } }));
    } else throw new Error('Unexpected RPC method ' + body.method);
    return Response.json({ jsonrpc: '2.0', id: body.id, result });
  };
  return { mint, pools, accounts, requests, account, fetchImpl, blockSearch: () => { blockedSearch = true; }, override: (matches: string[]) => { overrideMatches = matches; } };
}
test('shared authority and program addresses are explained without RPC or retry', async () => {
  for (const [key, code] of [[deriveDbcPoolAuthority(), 'SHARED_AUTHORITY'], [DYNAMIC_BONDING_CURVE_PROGRAM_ID, 'PROGRAM_ADDRESS']] as const) {
    await assert.rejects(() => inspectInput(key.toBase58(), 'mainnet-beta', { fetchImpl: async () => { throw new Error('must not fetch'); } }), error => error instanceof InputResolutionError && error.code === code);
  }
});
test('wallet, missing account, config and malformed token input receive helpful typed errors', async () => {
  const f = fixture(); const wallet = Keypair.generate().publicKey.toBase58(); f.accounts.set(wallet, f.account(Buffer.alloc(0), SystemProgram.programId));
  await assert.rejects(() => inspectInput(wallet, 'mainnet-beta', f), error => error instanceof InputResolutionError && error.code === 'WALLET_ADDRESS');
  await assert.rejects(() => inspectInput(Keypair.generate().publicKey.toBase58(), 'mainnet-beta', f), error => error instanceof InputResolutionError && error.code === 'ACCOUNT_NOT_FOUND');
  const config = [...f.accounts.keys()].find(key => ![f.mint.toBase58(), ...f.pools].includes(key) && (f.accounts.get(key)!.owner === DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58()))!;
  await assert.rejects(() => inspectInput(config, 'mainnet-beta', f), error => error instanceof InputResolutionError && error.code === 'NOT_POOL');
  f.accounts.set(f.mint.toBase58(), f.account(Buffer.alloc(165), TOKEN_PROGRAM_ID));
  await assert.rejects(() => inspectInput(f.mint.toBase58(), 'mainnet-beta', f), error => error instanceof InputResolutionError && error.code === 'NOT_TOKEN_MINT');
});
for (const hook of [false, true]) for (const token2022 of [false, true]) {
  test(`token resolves through filtered RPC and real reader: hook=${hook}, Token2022=${token2022}`, async () => {
    const f = fixture(hook, token2022); const report = await inspectInput(f.mint.toBase58(), 'mainnet-beta', f);
    assert.equal(report.address, f.pools[0]); assert.equal(report.inputAddress, f.mint.toBase58()); assert.equal(report.mintAddress, f.mint.toBase58()); assert.equal(report.resolution?.kind, 'token'); assert.equal(report.synthetic, false); assert.equal(report.checks.length, 8);
    assert.equal(f.requests.filter(r => r.method === 'getProgramAccounts').length, 2);
  });
}
test('direct pool inspection bypasses token search and preserves requested input', async () => {
  const f = fixture(); const report = await inspectInput(f.pools[0], 'devnet', f); assert.equal(report.address, f.pools[0]); assert.equal(report.inputAddress, f.pools[0]); assert.equal(report.resolution?.kind, 'pool'); assert.equal(f.requests.some(r => r.method === 'getProgramAccounts'), false);
});
test('multiple verified pools require explicit choice instead of silently picking one', async () => {
  const f = fixture(false, false, 2);
  await assert.rejects(() => inspectInput(f.mint.toBase58(), 'mainnet-beta', f), error => error instanceof InputResolutionError && error.status === 409 && JSON.stringify(error.candidates) === JSON.stringify(f.pools));
});
test('empty, oversized and unavailable discovery produce actionable nonretryable input errors', async () => {
  const f = fixture(); f.override([]);
  await assert.rejects(() => inspectInput(f.mint.toBase58(), 'mainnet-beta', f), error => error instanceof InputResolutionError && error.code === 'NO_DBC_POOL');
  f.override(Array.from({ length: 9 }, () => Keypair.generate().publicKey.toBase58()));
  await assert.rejects(() => inspectInput(f.mint.toBase58(), 'mainnet-beta', f), error => error instanceof InputResolutionError && error.code === 'TOO_MANY_POOLS');
  f.blockSearch();
  await assert.rejects(() => inspectInput(f.mint.toBase58(), 'mainnet-beta', f), error => error instanceof InputResolutionError && error.code === 'DISCOVERY_UNAVAILABLE');
});
test('search results cannot substitute a different token or bypass real pool validation', async () => {
  const f = fixture(); const other = fixture(); f.override(other.pools); for (const [key, account] of other.accounts) f.accounts.set(key, account);
  await assert.rejects(() => inspectInput(f.mint.toBase58(), 'mainnet-beta', f), error => error instanceof InputResolutionError && error.code === 'NO_VALID_POOL');
});
