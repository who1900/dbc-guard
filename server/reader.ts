import { Connection, PublicKey, type AccountInfo } from '@solana/web3.js';
import { createDbcProgram, deriveDbcPoolAddress, DYNAMIC_BONDING_CURVE_PROGRAM_ID, type ConfigWithTransferHook, type TransferHookPool, type PoolConfig, type VirtualPool } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import { unpackMint, getExtensionTypes, ExtensionType, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { inspect, summarize, type MintEvidence } from './engine.js';
import type { Report } from '../src/types.js';

export function validateAddress(value: unknown): string { if (typeof value !== 'string' || value.length > 44 || value.length < 32) throw new Error('Enter a valid Solana pool address.'); try { return new PublicKey(value).toBase58(); } catch { throw new Error('Enter a valid Solana pool address.'); } }
export class InvalidAccountError extends Error { readonly code = 'INVALID_ACCOUNT'; }
export function assertDbcAccount(account: AccountInfo<Buffer> | null) { if (!account) throw new InvalidAccountError('Pool or configuration account does not exist on this network.'); if (!account.owner.equals(DYNAMIC_BONDING_CURVE_PROGRAM_ID)) throw new InvalidAccountError('Account is not owned by the Meteora DBC program.'); if (account.executable || account.data.length < 8 || account.data.length > 65536) throw new InvalidAccountError('Malformed DBC account.'); }
export function normalize(value: unknown): unknown { if (BN.isBN(value)) return value.toString(10); if (value instanceof PublicKey) return value.toBase58(); if (Array.isArray(value)) return value.map(normalize); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)])); return value; }
export interface ReaderOptions { fetchImpl?: typeof fetch; timeoutMs?: number; signal?: AbortSignal }
export async function boundedFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: ReaderOptions = {}) {
  const signals = [AbortSignal.timeout(options.timeoutMs ?? 12000), options.signal, init?.signal].filter((signal): signal is AbortSignal => !!signal);
  const response = await (options.fetchImpl ?? fetch)(input, { ...init, signal: AbortSignal.any(signals) });
  if (Number(response.headers.get('content-length')) > 1_048_576) { await response.body?.cancel(); throw new Error('RPC response too large'); }
  const reader = response.body?.getReader(); if (!reader) return response;
  const chunks: Uint8Array[] = []; let bytes = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 1_048_576) { await reader.cancel(); throw new Error('RPC response too large'); } chunks.push(part.value); } }
  finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers: response.headers });
}
export async function readReport(address: string, network: Report['network'], options: ReaderOptions = {}): Promise<Report> {
  if (network !== 'mainnet-beta' && network !== 'devnet') throw new InvalidAccountError('Unsupported Solana network.');
  address = validateAddress(address);
  const endpoint = network === 'devnet' ? process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com' : process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(endpoint, { commitment: 'confirmed', disableRetryOnRateLimit: true, fetch: (input, init) => boundedFetch(input, init, options) });
  const { program } = createDbcProgram(connection);
  const poolResult = await connection.getAccountInfoAndContext(new PublicKey(address));
  assertDbcAccount(poolResult.value);
  const family = (data: Buffer, names: string[]) => names.find(name => { const account = program.idl.accounts.find(item => item.name === name); return account && data.subarray(0, 8).equals(Buffer.from(account.discriminator)); });
  const poolFamily = family(poolResult.value!.data, ['virtualPool', 'transferHookPool']);
  if (!poolFamily) throw new InvalidAccountError('Unsupported DBC pool discriminator; account may use a newer layout.');
  let pool: VirtualPool['poolState'];
  try { pool = (program.coder.accounts.decode(poolFamily, poolResult.value!.data) as VirtualPool | TransferHookPool).poolState; } catch { throw new InvalidAccountError('Malformed DBC pool account layout.'); }
  const configResult = await connection.getAccountInfoAndContext(pool.config, { minContextSlot: poolResult.context.slot });
  assertDbcAccount(configResult.value);
  const configFamily = family(configResult.value!.data, ['poolConfig', 'configWithTransferHook']);
  const expectedConfig = poolFamily === 'transferHookPool' ? 'configWithTransferHook' : 'poolConfig';
  if (!configFamily || configFamily !== expectedConfig) throw new InvalidAccountError('DBC configuration discriminator does not match the pool account family.');
  let config: PoolConfig; let transferHookProgram: string | null = null;
  try { if (configFamily === 'configWithTransferHook') { const decoded = program.coder.accounts.decode(configFamily, configResult.value!.data) as ConfigWithTransferHook; config = decoded.config; transferHookProgram = decoded.transferHookProgram.toBase58(); } else config = program.coder.accounts.decode(configFamily, configResult.value!.data); } catch { throw new InvalidAccountError('Malformed DBC configuration account layout.'); }
  if (!deriveDbcPoolAddress(config.quoteMint, pool.baseMint, pool.config).equals(new PublicKey(address))) throw new InvalidAccountError('Malformed DBC account: pool PDA does not match configuration and mints.');
  let mintResults: (AccountInfo<Buffer> | null)[] = [null, null];
  let mintSlot: number | null = null; let mintReadError: string | null = null;
  try { const result = await connection.getMultipleAccountsInfoAndContext([pool.baseMint, config.quoteMint], { minContextSlot: configResult.context.slot }); mintResults = result.value; mintSlot = result.context.slot; } catch { if (options.signal?.aborted) throw options.signal.reason; mintReadError = 'Mint RPC read failed; authority and extension checks are unknown.'; }
  let mint: MintEvidence | null = null;
  let quoteDecimals: number | null = null;
  function decodeMint(key: PublicKey, account: AccountInfo<Buffer> | null) { if (!account || account.executable || account.data.length > 65536 || (!account.owner.equals(TOKEN_PROGRAM_ID) && !account.owner.equals(TOKEN_2022_PROGRAM_ID))) throw new Error('Unsupported mint owner'); const mint = unpackMint(key, account, account.owner); if (!mint.isInitialized) throw new Error('Mint is not initialized'); return mint; }
  try { const decoded = decodeMint(pool.baseMint, mintResults[0]); let extensions: string[] = []; let extensionReadComplete = true; try { extensions = getExtensionTypes(decoded.tlvData).map(x => ExtensionType[x] ?? `Unknown(${x})`); let cursor = 0; while (cursor < decoded.tlvData.length) { if (decoded.tlvData.length - cursor < 4) { if (decoded.tlvData.subarray(cursor).some(x => x !== 0)) extensionReadComplete = false; break; } const type = decoded.tlvData.readUInt16LE(cursor); const length = decoded.tlvData.readUInt16LE(cursor + 2); if (type === 0 && length === 0 && decoded.tlvData.subarray(cursor).every(x => x === 0)) break; if (cursor + 4 + length > decoded.tlvData.length) { extensionReadComplete = false; break; } cursor += 4 + length; } } catch { extensionReadComplete = false; } mint = { supply: decoded.supply.toString(), decimals: decoded.decimals, mintAuthority: decoded.mintAuthority?.toBase58() ?? null, freezeAuthority: decoded.freezeAuthority?.toBase58() ?? null, extensions, extensionReadComplete }; } catch { mintReadError ??= 'Base mint is missing, uninitialized or malformed.'; }
  try { quoteDecimals = decodeMint(config.quoteMint, mintResults[1]).decimals; } catch { /* Raw units remain available. */ }
  const result = inspect(config, pool, mint, quoteDecimals);
  if (transferHookProgram) { const extensions = result.checks.find(check => check.id === 'extensions')!; extensions.evidence.configuredTransferHookProgram = transferHookProgram; extensions.evidence.hookProgramAudit = 'Not performed; executable status and transfer behaviour are not verified'; if (extensions.status === 'pass') extensions.status = 'caution'; extensions.summary += ' Transfer-hook account family delegates transfer behaviour to the configured program; inspect that program independently.'; }
  return { schemaVersion: 1, address, network, synthetic: false, inspectedAt: new Date().toISOString(), slot: poolResult.context.slot, configAddress: pool.config.toBase58(), mintAddress: pool.baseMint.toBase58(), quoteMint: config.quoteMint.toBase58(), creator: pool.creator.toBase58(), ...result, ...summarize(result.checks), raw: normalize({ pool, config, mint, quoteDecimals, quotePolicy: 'Not assessed', poolFamily, configFamily, transferHookProgram, configSlot: configResult.context.slot, mintSlot, mintReadError, consistency: 'Confirmed sequential reads; accounts may change between requests.' }) };
}
