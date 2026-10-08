import { Connection, PublicKey, type AccountInfo } from '@solana/web3.js';
import { createDbcProgram, deriveDbcPoolAddress, DYNAMIC_BONDING_CURVE_PROGRAM_ID, type PoolConfig, type VirtualPool } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import { unpackMint, getExtensionTypes, ExtensionType, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { inspect, summarize, type MintEvidence } from './engine.js';
import type { Report } from '../src/types.js';

export function validateAddress(value: unknown): string { if (typeof value !== 'string' || value.length > 44 || value.length < 32) throw new Error('Enter a valid Solana pool address.'); try { return new PublicKey(value).toBase58(); } catch { throw new Error('Enter a valid Solana pool address.'); } }
export function assertDbcAccount(account: AccountInfo<Buffer> | null) { if (!account) throw new Error('Pool or configuration account does not exist on this network.'); if (!account.owner.equals(DYNAMIC_BONDING_CURVE_PROGRAM_ID)) throw new Error('Account is not owned by the Meteora DBC program.'); if (account.executable || account.data.length < 8 || account.data.length > 65536) throw new Error('Malformed DBC account.'); }
export function normalize(value: unknown): unknown { if (BN.isBN(value)) return value.toString(10); if (value instanceof PublicKey) return value.toBase58(); if (Array.isArray(value)) return value.map(normalize); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)])); return value; }
export async function boundedFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  const response = await fetch(input, { ...init, signal: AbortSignal.timeout(12000) });
  if (Number(response.headers.get('content-length')) > 1_048_576) throw new Error('RPC response too large');
  const reader = response.body?.getReader(); if (!reader) return response;
  const chunks: Uint8Array[] = []; let bytes = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 1_048_576) { await reader.cancel(); throw new Error('RPC response too large'); } chunks.push(part.value); } }
  finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers: response.headers });
}
export async function readReport(address: string, network: Report['network']): Promise<Report> {
  const endpoint = network === 'devnet' ? process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com' : process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(endpoint, { commitment: 'confirmed', disableRetryOnRateLimit: true, fetch: boundedFetch });
  const { program } = createDbcProgram(connection);
  const poolResult = await connection.getAccountInfoAndContext(new PublicKey(address));
  assertDbcAccount(poolResult.value);
  let pool: VirtualPool['poolState'];
  try { pool = (program.coder.accounts.decode('virtualPool', poolResult.value!.data) as VirtualPool).poolState; } catch { throw new Error('Account is not a supported DBC virtual pool (invalid discriminator or layout).'); }
  const configResult = await connection.getAccountInfoAndContext(pool.config, { minContextSlot: poolResult.context.slot });
  assertDbcAccount(configResult.value);
  let config: PoolConfig;
  try { config = program.coder.accounts.decode('poolConfig', configResult.value!.data); } catch { throw new Error('DBC configuration has an unsupported discriminator or layout.'); }
  if (!deriveDbcPoolAddress(config.quoteMint, pool.baseMint, pool.config).equals(new PublicKey(address))) throw new Error('Malformed DBC account: pool PDA does not match configuration and mints.');
  let mintResults: (AccountInfo<Buffer> | null)[] = [null, null];
  try { mintResults = await connection.getMultipleAccountsInfo([pool.baseMint, config.quoteMint], { minContextSlot: configResult.context.slot }); } catch { /* Preserve partial assessment with explicit unknown mint checks. */ }
  let mint: MintEvidence | null = null;
  let quoteDecimals: number | null = null;
  function decodeMint(key: PublicKey, account: AccountInfo<Buffer> | null) { if (!account || account.executable || account.data.length > 65536 || (!account.owner.equals(TOKEN_PROGRAM_ID) && !account.owner.equals(TOKEN_2022_PROGRAM_ID))) throw new Error('Unsupported mint owner'); const mint = unpackMint(key, account, account.owner); if (!mint.isInitialized) throw new Error('Mint is not initialized'); return mint; }
  try { const decoded = decodeMint(pool.baseMint, mintResults[0]); mint = { supply: decoded.supply.toString(), decimals: decoded.decimals, mintAuthority: decoded.mintAuthority?.toBase58() ?? null, freezeAuthority: decoded.freezeAuthority?.toBase58() ?? null, extensions: getExtensionTypes(decoded.tlvData).map(x => ExtensionType[x] ?? `Unknown(${x})`), extensionReadComplete: true }; } catch { /* Unknown coverage is surfaced by the assessment. */ }
  try { quoteDecimals = decodeMint(config.quoteMint, mintResults[1]).decimals; } catch { /* Raw units remain available. */ }
  const result = inspect(config, pool, mint, quoteDecimals);
  return { schemaVersion: 1, address, network, synthetic: false, inspectedAt: new Date().toISOString(), slot: poolResult.context.slot, configAddress: pool.config.toBase58(), mintAddress: pool.baseMint.toBase58(), quoteMint: config.quoteMint.toBase58(), creator: pool.creator.toBase58(), ...result, ...summarize(result.checks), raw: normalize({ pool, config, mint, quoteDecimals, quotePolicy: 'Not assessed', configSlot: configResult.context.slot, consistency: 'Confirmed sequential reads; accounts may change between requests.' }) };
}
