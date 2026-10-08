import { PublicKey, type AccountInfo } from '@solana/web3.js';
import { unpackMint, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ExtensionType } from '@solana/spl-token';
import { rpcCall, validateAddress, type ReaderOptions } from './reader.js';
import type { Report } from '../src/types.js';

export const METADATA_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
export interface TokenInfo { mint: string; network: Report['network']; name: string | null; symbol: string | null; source: 'metaplex' | 'token-2022' | 'unavailable' }
export const unavailableTokenInfo = (mint: string, network: Report['network']): TokenInfo => ({ mint, network, name: null, symbol: null, source: 'unavailable' });
export function metadataAddress(mint: PublicKey) { return PublicKey.findProgramAddressSync([Buffer.from('metadata'), METADATA_PROGRAM.toBuffer(), mint.toBuffer()], METADATA_PROGRAM)[0]; }
function text(value: string, max: number) { return Array.from(value.replace(/[\p{Cc}\p{Cf}]/gu, '').trim()).slice(0, max).join('') || null; }
function strings(data: Buffer, start: number, limits: number[]) {
  let cursor = start;
  const values = limits.map(limit => {
    if (cursor + 4 > data.length) throw new Error('Truncated metadata');
    const length = data.readUInt32LE(cursor); cursor += 4;
    if (length > limit || cursor + length > data.length) throw new Error('Invalid metadata length');
    const value = new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(cursor, cursor + length)); cursor += length;
    return value;
  });
  return { values, cursor };
}
function tokenExtension(tlv: Buffer): Buffer | null {
  let cursor = 0; let metadata: Buffer | null = null;
  while (cursor < tlv.length) {
    if (tlv.length - cursor < 4 && tlv.subarray(cursor).every(byte => byte === 0)) break;
    if (cursor + 4 > tlv.length) throw new Error('Truncated extension');
    const type = tlv.readUInt16LE(cursor); const size = tlv.readUInt16LE(cursor + 2); cursor += 4;
    if (type === 0 && size === 0) { if (tlv.subarray(cursor).some(byte => byte !== 0)) throw new Error('Invalid extension padding'); break; }
    if (type === 0) throw new Error('Invalid extension type');
    if (cursor + size > tlv.length) throw new Error('Truncated extension');
    if (type === ExtensionType.TokenMetadata) { if (metadata) throw new Error('Duplicate metadata'); metadata = tlv.subarray(cursor, cursor + size); }
    cursor += size;
  }
  return metadata;
}
export function decodeTokenInfo(mint: PublicKey, network: Report['network'], account: AccountInfo<Buffer> | null, metadata: AccountInfo<Buffer> | null): TokenInfo {
  const missing = unavailableTokenInfo(mint.toBase58(), network);
  try {
    if (!account || account.executable || account.data.length > 65536 || (!account.owner.equals(TOKEN_PROGRAM_ID) && !account.owner.equals(TOKEN_2022_PROGRAM_ID))) return missing;
    if (account.owner.equals(TOKEN_PROGRAM_ID) && account.data.length !== 82) return missing;
    if (account.data.length < 82 || account.data[45] !== 1 || account.data.readUInt32LE(0) > 1 || account.data.readUInt32LE(46) > 1) return missing;
    const decoded = unpackMint(mint, account, account.owner); if (!decoded.isInitialized) return missing;
    if (account.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      const data = tokenExtension(decoded.tlvData);
      if (data) {
        if (data.length < 64 || !data.subarray(32, 64).equals(mint.toBuffer())) return missing;
        const parsed = strings(data, 64, [1024, 256, 4096]);
        if (parsed.cursor + 4 > data.length) return missing;
        const count = data.readUInt32LE(parsed.cursor); let cursor = parsed.cursor + 4;
        if (count > 128) return missing;
        for (let i = 0; i < count; i++) cursor = strings(data, cursor, [4096, 4096]).cursor;
        if (cursor !== data.length) return missing;
        const name = text(parsed.values[0], 80); const symbol = text(parsed.values[1], 20);
        return name || symbol ? { ...missing, name, symbol, source: 'token-2022' } : missing;
      }
    }
    if (!metadata || metadata.executable || !metadata.owner.equals(METADATA_PROGRAM) || metadata.data.length > 4096 || metadata.data.length < 65 || metadata.data[0] !== 4 || !metadata.data.subarray(33, 65).equals(mint.toBuffer())) return missing;
    const parsed = strings(metadata.data, 65, [32, 10, 200]);
    if (parsed.cursor + 3 > metadata.data.length) return missing;
    if (metadata.data.readUInt16LE(parsed.cursor) > 10000) return missing;
    let cursor = parsed.cursor + 2;
    const creators = metadata.data[cursor++];
    if (creators > 1) return missing;
    if (creators) { if (cursor + 4 > metadata.data.length) return missing; const count = metadata.data.readUInt32LE(cursor); cursor += 4; if (count > 5 || cursor + count * 34 > metadata.data.length) return missing; cursor += count * 34; }
    if (cursor + 2 > metadata.data.length || metadata.data[cursor] > 1 || metadata.data[cursor + 1] > 1) return missing;
    const name = text(parsed.values[0], 80); const symbol = text(parsed.values[1], 20);
    return name || symbol ? { ...missing, name, symbol, source: 'metaplex' } : missing;
  } catch { return missing; }
}
interface RpcAccount { owner: string; executable: boolean; lamports: number; data: [string, string] }
function accountFromRpc(value: RpcAccount | null): AccountInfo<Buffer> | null {
  if (!value) return null;
  if (!Array.isArray(value.data) || value.data[1] !== 'base64' || typeof value.data[0] !== 'string' || value.data[0].length > 87384 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data[0]) || typeof value.executable !== 'boolean') throw new Error('Malformed account');
  return { owner: new PublicKey(value.owner), executable: value.executable, lamports: value.lamports, rentEpoch: 0, data: Buffer.from(value.data[0], 'base64') };
}
export async function readTokenInfo(address: string, network: Report['network'], options: ReaderOptions = {}): Promise<TokenInfo> {
  const mint = new PublicKey(validateAddress(address)); const missing = unavailableTokenInfo(mint.toBase58(), network);
  if (network !== 'mainnet-beta' && network !== 'devnet') return missing;
  try {
    const result = await rpcCall<{ value: (RpcAccount | null)[] }>('getMultipleAccounts', [[mint.toBase58(), metadataAddress(mint).toBase58()], { encoding: 'base64', commitment: 'confirmed' }], network, { ...options, totalTimeoutMs: 5000, timeoutMs: 4000 });
    if (!Array.isArray(result.value) || result.value.length !== 2) return missing;
    return decodeTokenInfo(mint, network, accountFromRpc(result.value[0]), accountFromRpc(result.value[1]));
  } catch { return missing; }
}
