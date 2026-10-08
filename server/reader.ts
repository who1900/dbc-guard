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
export interface ReaderOptions { fetchImpl?: typeof fetch; timeoutMs?: number; signal?: AbortSignal; totalTimeoutMs?: number; scheduler?: RpcScheduler; retryDelayMs?: number }
export class RpcTransportError extends Error { constructor(message: string, readonly retryable: boolean, readonly status?: number, readonly retryAfter?: number) { super(message); } }
interface QueueItem { signal: AbortSignal; resolve: () => void; reject: (reason: unknown) => void; abort: () => void }
export class RpcScheduler {
  private queue: QueueItem[] = [];
  private nextStart = 0;
  private blockedUntil = 0;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(readonly requestsPerSecond = 2, readonly maxQueue = 64) { if (!Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0 || requestsPerSecond > 100 || !Number.isInteger(maxQueue) || maxQueue < 1) throw new Error('Invalid RPC scheduler configuration.'); }
  get pending() { return this.queue.length; }
  acquire(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.queue.length >= this.maxQueue) return Promise.reject(new RpcTransportError('RPC request queue is busy.', true, 429, 1));
    return new Promise((resolve, reject) => { const item: QueueItem = { signal, resolve, reject, abort: () => { this.queue = this.queue.filter(entry => entry !== item); reject(signal.reason); this.pump(); } }; signal.addEventListener('abort', item.abort, { once: true }); this.queue.push(item); this.pump(); });
  }
  cooldown(milliseconds: number) { this.blockedUntil = Math.max(this.blockedUntil, Date.now() + Math.min(10000, Math.max(0, milliseconds))); this.pump(); }
  private pump() {
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    if (!this.queue.length) return;
    const delay = Math.max(this.nextStart, this.blockedUntil) - Date.now();
    if (delay > 0) { this.timer = setTimeout(() => { this.timer = undefined; this.pump(); }, delay); return; }
    const item = this.queue.shift()!; item.signal.removeEventListener('abort', item.abort);
    if (item.signal.aborted) item.reject(item.signal.reason);
    else { this.nextStart = Date.now() + Math.ceil(1000 / this.requestsPerSecond); item.resolve(); }
    this.pump();
  }
}
const schedulers = new Map<string, RpcScheduler>();
function transportScheduler(input: Parameters<typeof fetch>[0], options: ReaderOptions) {
  if (options.scheduler) return options.scheduler;
  if (options.fetchImpl) return undefined;
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const official = ['api.mainnet-beta.solana.com', 'api.devnet.solana.com'].includes(url.hostname);
  const configured = Number(process.env.RPC_REQUESTS_PER_SECOND);
  const rate = Number.isFinite(configured) && configured > 0 && configured <= 100 ? configured : official ? 2 : 0;
  if (!rate) return undefined;
  const key = `${official ? 'solana-public' : url.origin}:${rate}`;
  if (!schedulers.has(key)) { if (schedulers.size >= 8) schedulers.delete(schedulers.keys().next().value!); schedulers.set(key, new RpcScheduler(rate)); }
  return schedulers.get(key);
}
export function retryAfterSeconds(value: string | null) { const seconds = value === null ? 1 : /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : (Date.parse(value) - Date.now()) / 1000; return Math.max(1, Math.min(10, Number.isFinite(seconds) ? Math.ceil(seconds) : 1)); }
function pause(milliseconds: number, signal: AbortSignal) { signal.throwIfAborted(); return new Promise<void>((resolve, reject) => { const onAbort = () => { clearTimeout(timer); reject(signal.reason); }; const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, milliseconds); signal.addEventListener('abort', onAbort, { once: true }); }); }
function deadline(milliseconds: number | undefined, parents: AbortSignal[]) {
  const controller = new AbortController();
  const links = parents.map(signal => { const abort = () => controller.abort(signal.reason); if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); return { signal, abort }; });
  const timer = milliseconds === undefined ? undefined : setTimeout(() => controller.abort(new DOMException('RPC deadline timed out.', 'TimeoutError')), milliseconds);
  return { signal: controller.signal, cleanup() { if (timer) clearTimeout(timer); for (const link of links) link.signal.removeEventListener('abort', link.abort); } };
}
const transientFailure = (error: unknown) => error instanceof RpcTransportError ? error.retryable : /429|50[0-9]|unhealthy|timeout|timed out|fetch failed|ECONNRESET|ETIMEDOUT|minimum context slot/i.test((error as Error).message);
export async function boundedFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: ReaderOptions = {}) {
  const queued = deadline(options.signal ? undefined : options.totalTimeoutMs ?? 45000, [options.signal, init?.signal].filter((signal): signal is AbortSignal => !!signal));
  let request: ReturnType<typeof deadline> | undefined;
  try {
  const scheduler = transportScheduler(input, options);
  await scheduler?.acquire(queued.signal);
  queued.signal.throwIfAborted();
  request = deadline(options.timeoutMs ?? 12000, [queued.signal]);
  let response: Response;
  try { response = await (options.fetchImpl ?? fetch)(input, { ...init, signal: request.signal }); }
  catch (error) { if (options.signal?.aborted) throw options.signal.reason; throw new RpcTransportError((error as Error).name === 'TimeoutError' ? 'RPC request timed out.' : 'RPC transport failed.', true); }
  if (!response.ok) { const retryAfter = retryAfterSeconds(response.headers.get('retry-after')); if (response.status === 429 || response.status === 503) scheduler?.cooldown(retryAfter * 1000); await response.body?.cancel(); throw new RpcTransportError(`RPC HTTP ${response.status}`, response.status === 429 || response.status >= 500, response.status, retryAfter); }
  if (Number(response.headers.get('content-length')) > 1_048_576) { await response.body?.cancel(); throw new RpcTransportError('RPC response too large', false); }
  const reader = response.body?.getReader(); if (!reader) return response;
  const chunks: Uint8Array[] = []; let bytes = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 1_048_576) { await reader.cancel(); throw new RpcTransportError('RPC response too large', false); } chunks.push(part.value); } }
  catch (error) { if (options.signal?.aborted) throw options.signal.reason; if (error instanceof RpcTransportError) throw error; throw new RpcTransportError('RPC response body transport failed or timed out.', true); }
  finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally { request?.cleanup(); queued.cleanup(); }
}
export async function readReport(address: string, network: Report['network'], options: ReaderOptions = {}): Promise<Report> {
  if (network !== 'mainnet-beta' && network !== 'devnet') throw new InvalidAccountError('Unsupported Solana network.');
  address = validateAddress(address);
  let partial: Report | null = null;
  try { return await withRpcRetries(network, options, async (endpoint, attemptOptions, provenance) => { const report = await readAttempt(address, network, endpoint, attemptOptions); report.raw = { ...(report.raw as Record<string, unknown>), ...provenance }; if ((report.raw as Record<string, unknown>).mintRpcRetryable) { partial = report; throw new RpcTransportError('Mint RPC transport failed; retrying complete account snapshot.', true); } return report; }); }
  catch (error) { if (options.signal?.aborted || error instanceof InvalidAccountError || !partial) throw error; return partial; }
}
export function rpcEndpoints(network: Report['network']): string[] {
  if (network !== 'mainnet-beta' && network !== 'devnet') throw new InvalidAccountError('Unsupported Solana network.');
  const defaults = network === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com';
  const list = network === 'devnet' ? process.env.DEVNET_RPC_URLS : process.env.MAINNET_RPC_URLS;
  const single = network === 'devnet' ? process.env.DEVNET_RPC_URL : process.env.MAINNET_RPC_URL;
  const endpoints = [...new Set((list || single || defaults).split(/[,\n]/).map(item => item.trim()).filter(Boolean))].slice(0, 4);
  if (!endpoints.length || endpoints.some(endpoint => { try { return !['https:', 'http:'].includes(new URL(endpoint).protocol); } catch { return true; } })) throw new RpcTransportError('Invalid operator RPC configuration.', false);
  return endpoints;
}
export async function withRpcRetries<T>(network: Report['network'], options: ReaderOptions, operation: (endpoint: string, options: ReaderOptions, provenance: { rpcEndpointIndex: number; rpcAttempt: number; configuredRpcEndpointCount: number }) => Promise<T>): Promise<T> {
  const endpoints = rpcEndpoints(network);
  const source = deadline(options.totalTimeoutMs ?? 45000, options.signal ? [options.signal] : []);
  const signal = source.signal;
  try {
  const attemptOptions = { ...options, signal };
  let lastError: unknown;
  for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
    for (let retry = 0; retry < 2; retry++) {
      signal.throwIfAborted();
      try { const result = await operation(endpoints[endpointIndex], attemptOptions, { rpcEndpointIndex: endpointIndex, rpcAttempt: retry + 1, configuredRpcEndpointCount: endpoints.length }); signal.throwIfAborted(); return result; }
      catch (error) { lastError = error; signal.throwIfAborted(); if (error instanceof InvalidAccountError || !transientFailure(error)) throw error; if (retry === 0 || endpointIndex + 1 < endpoints.length) { const delay = options.retryDelayMs ?? Math.max(250 * (retry + 1), error instanceof RpcTransportError && error.retryAfter ? error.retryAfter * 1000 : 0); await pause(Math.max(0, Math.min(10000, delay)), signal); } }
    }
  }
  throw lastError;
  } finally { source.cleanup(); }
}
export async function rpcCall<T = unknown>(method: string, params: unknown[], network: Report['network'], options: ReaderOptions = {}): Promise<T> {
  return withRpcRetries(network, options, async (endpoint, attemptOptions) => { const response = await boundedFetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }, attemptOptions); const payload = await response.json() as { result?: T; error?: { code: number; message: string } }; if (payload.error) throw new RpcTransportError(`RPC error ${payload.error.code}`, payload.error.code === -32005 || payload.error.code === -32016); if (!('result' in payload)) throw new RpcTransportError('Invalid RPC response.', false); return payload.result as T; });
}
async function readAttempt(address: string, network: Report['network'], endpoint: string, options: ReaderOptions): Promise<Report> {
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
  let mintSlot: number | null = null; let mintReadError: string | null = null; let mintRpcRetryable = false;
  try { const result = await connection.getMultipleAccountsInfoAndContext([pool.baseMint, config.quoteMint], { minContextSlot: configResult.context.slot }); mintResults = result.value; mintSlot = result.context.slot; } catch (error) { if (options.signal?.aborted) throw options.signal.reason; mintReadError = 'Mint RPC read failed; authority and extension checks are unknown.'; mintRpcRetryable = transientFailure(error); }
  let mint: MintEvidence | null = null;
  let quoteDecimals: number | null = null;
  function decodeMint(key: PublicKey, account: AccountInfo<Buffer> | null) { if (!account || account.executable || account.data.length > 65536 || (!account.owner.equals(TOKEN_PROGRAM_ID) && !account.owner.equals(TOKEN_2022_PROGRAM_ID))) throw new Error('Unsupported mint owner'); const mint = unpackMint(key, account, account.owner); if (!mint.isInitialized) throw new Error('Mint is not initialized'); return mint; }
  try { const decoded = decodeMint(pool.baseMint, mintResults[0]); let extensions: string[] = []; let extensionReadComplete = true; try { extensions = getExtensionTypes(decoded.tlvData).map(x => ExtensionType[x] ?? `Unknown(${x})`); let cursor = 0; while (cursor < decoded.tlvData.length) { if (decoded.tlvData.length - cursor < 4) { if (decoded.tlvData.subarray(cursor).some(x => x !== 0)) extensionReadComplete = false; break; } const type = decoded.tlvData.readUInt16LE(cursor); const length = decoded.tlvData.readUInt16LE(cursor + 2); if (type === 0 && length === 0 && decoded.tlvData.subarray(cursor).every(x => x === 0)) break; if (cursor + 4 + length > decoded.tlvData.length) { extensionReadComplete = false; break; } cursor += 4 + length; } } catch { extensionReadComplete = false; } mint = { supply: decoded.supply.toString(), decimals: decoded.decimals, mintAuthority: decoded.mintAuthority?.toBase58() ?? null, freezeAuthority: decoded.freezeAuthority?.toBase58() ?? null, extensions, extensionReadComplete }; } catch { mintReadError ??= 'Base mint is missing, uninitialized or malformed.'; }
  try { quoteDecimals = decodeMint(config.quoteMint, mintResults[1]).decimals; } catch { /* Raw units remain available. */ }
  const result = inspect(config, pool, mint, quoteDecimals);
  if (transferHookProgram) { const extensions = result.checks.find(check => check.id === 'extensions')!; extensions.evidence.configuredTransferHookProgram = transferHookProgram; extensions.evidence.hookProgramAudit = 'Not performed; executable status and transfer behaviour are not verified'; if (extensions.status === 'pass') extensions.status = 'caution'; extensions.summary += ' Transfer-hook account family delegates transfer behaviour to the configured program; inspect that program independently.'; }
  return { schemaVersion: 1, address, network, synthetic: false, inspectedAt: new Date().toISOString(), slot: poolResult.context.slot, configAddress: pool.config.toBase58(), mintAddress: pool.baseMint.toBase58(), quoteMint: config.quoteMint.toBase58(), creator: pool.creator.toBase58(), ...result, ...summarize(result.checks), raw: normalize({ pool, config, mint, quoteDecimals, quotePolicy: 'Not assessed', poolFamily, configFamily, transferHookProgram, configSlot: configResult.context.slot, mintSlot, mintReadError, mintRpcRetryable, consistency: 'Confirmed sequential reads; accounts may change between requests.' }) };
}
