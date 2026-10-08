import { Connection, PublicKey, SystemProgram, type AccountInfo } from '@solana/web3.js';
import { createDbcProgram, deriveDbcPoolAuthority, DYNAMIC_BONDING_CURVE_PROGRAM_ID } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, unpackMint } from '@solana/spl-token';
import { readReport, rpcCall, InvalidAccountError, RpcTransportError, type ReaderOptions } from './reader.js';
import type { Report } from '../src/types.js';

const { program } = createDbcProgram(new Connection('http://127.0.0.1:1'));
export const BASE_MINT_OFFSET = 136;
export const POOL_FAMILIES = ['virtualPool', 'transferHookPool'] as const;
const MAX_CANDIDATES = 8;
function base58(bytes: Buffer) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let number = BigInt('0x' + bytes.toString('hex')); let encoded = '';
  while (number) { encoded = alphabet[Number(number % 58n)] + encoded; number /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; encoded = '1' + encoded; }
  return encoded;
}
export class InputResolutionError extends Error {
  constructor(message: string, readonly code: string, readonly status = 422, readonly candidates?: string[]) { super(message); }
}
interface RpcAccount { data: [string, string]; owner: string; executable: boolean; lamports: number; rentEpoch: number }
interface RpcResult { context: { slot: number }; value: RpcAccount | null }
interface ResolveOptions extends ReaderOptions { rpc?: typeof rpcCall; reader?: typeof readReport }
function accountInfo(account: RpcAccount): AccountInfo<Buffer> {
  if (!Array.isArray(account.data) || account.data[1] !== 'base64' || typeof account.data[0] !== 'string' || account.data[0].length > 90_000) throw new InvalidAccountError('Account data is malformed or exceeds the supported size.');
  const data = Buffer.from(account.data[0], 'base64');
  if (data.length > 65536) throw new InvalidAccountError('Account data exceeds the supported size.');
  return { ...account, owner: new PublicKey(account.owner), data };
}
export async function inspectInput(address: string, network: Report['network'], options: ResolveOptions = {}): Promise<Report> {
  const key = new PublicKey(address); const inputAddress = key.toBase58();
  if (key.equals(deriveDbcPoolAuthority())) throw new InputResolutionError('This is Meteora’s shared DBC pool authority, not an individual pool. Paste a DBC pool or token mint address, or inspect the real example.', 'SHARED_AUTHORITY');
  if (key.equals(DYNAMIC_BONDING_CURVE_PROGRAM_ID)) throw new InputResolutionError('This is the Meteora DBC program address, not an individual pool. Paste a DBC pool or token mint address, or inspect the real example.', 'PROGRAM_ADDRESS');
  const rpc = options.rpc ?? rpcCall; const reader = options.reader ?? readReport;
  const initial = await rpc<RpcResult>('getAccountInfo', [inputAddress, { commitment: 'confirmed', encoding: 'base64' }], network, options);
  if (!initial.value) throw new InputResolutionError('No account exists at this address on the selected network. Check the address and network, then use a DBC pool or token mint.', 'ACCOUNT_NOT_FOUND');
  const account = accountInfo(initial.value);
  if (account.owner.equals(DYNAMIC_BONDING_CURVE_PROGRAM_ID)) {
    const family = POOL_FAMILIES.find(name => { const definition = program.idl.accounts.find(item => item.name === name)!; return account.data.subarray(0, 8).equals(Buffer.from(definition.discriminator)); });
    if (!family) throw new InputResolutionError('This is a DBC configuration or another program account, not a supported pool. Paste the individual DBC pool or its token mint address.', 'NOT_POOL');
    const report = await reader(inputAddress, network, options);
    return { ...report, inputAddress, resolution: { kind: 'pool', source: 'on-chain', inputSlot: initial.context.slot, candidateCount: 1 } };
  }
  if (account.owner.equals(SystemProgram.programId)) throw new InputResolutionError('This is a wallet or system account, not a DBC pool or token mint. Paste the pool address or the token’s mint address, or inspect the real example.', 'WALLET_ADDRESS');
  if (account.executable) throw new InputResolutionError('This is an executable program, not a DBC pool or token mint. Paste an individual pool or token mint address.', 'PROGRAM_ADDRESS');
  if (!account.owner.equals(TOKEN_PROGRAM_ID) && !account.owner.equals(TOKEN_2022_PROGRAM_ID)) throw new InputResolutionError('This account is not a Meteora DBC pool or token mint. Other Meteora products use different pool accounts. Paste a DBC pool or its token mint address.', 'OTHER_ACCOUNT');
  try { if (!unpackMint(key, account, account.owner).isInitialized) throw new Error('uninitialized'); }
  catch { throw new InputResolutionError('This is not an initialized token mint. Token holding accounts are different from mint addresses; paste the token mint or its DBC pool.', 'NOT_TOKEN_MINT'); }
  const candidates = new Set<string>();
  for (const family of POOL_FAMILIES) {
    const definition = program.idl.accounts.find(item => item.name === family)!;
    let matches: { pubkey: string; account: { owner: string } }[];
    try {
      matches = await rpc('getProgramAccounts', [DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58(), {
        commitment: 'confirmed', encoding: 'base64', dataSlice: { offset: 0, length: 0 },
        filters: [{ memcmp: { offset: 0, bytes: base58(Buffer.from(definition.discriminator)) } }, { memcmp: { offset: BASE_MINT_OFFSET, bytes: inputAddress } }],
      }], network, options);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (error instanceof RpcTransportError && error.status === 429) throw error;
      throw new InputResolutionError('The RPC provider could not search DBC pools for this token. Paste the individual DBC pool address to inspect it directly.', 'DISCOVERY_UNAVAILABLE', 503);
    }
    if (!Array.isArray(matches) || matches.length > MAX_CANDIDATES) throw new InputResolutionError('This token returned too many pools to select automatically. Paste the individual DBC pool address.', 'TOO_MANY_POOLS');
    for (const match of matches) {
      if (match.account?.owner !== DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58()) throw new InputResolutionError('The pool search returned inconsistent ownership. Use a verified DBC pool address.', 'INVALID_DISCOVERY');
      try { candidates.add(new PublicKey(match.pubkey).toBase58()); } catch { throw new InputResolutionError('The pool search returned an invalid address. Use a verified DBC pool address.', 'INVALID_DISCOVERY'); }
      if (candidates.size > MAX_CANDIDATES) throw new InputResolutionError('This token returned too many pools to select automatically. Paste the individual DBC pool address.', 'TOO_MANY_POOLS');
    }
  }
  if (!candidates.size) throw new InputResolutionError('No Meteora DBC pool was found for this token on the selected network. The token may use a different launch venue. Paste a DBC pool address if you have one.', 'NO_DBC_POOL');
  const verified: Report[] = [];
  for (const candidate of candidates) {
    try { const report = await reader(candidate, network, options); if (report.mintAddress === inputAddress) verified.push(report); }
    catch (error) { if (!(error instanceof InvalidAccountError)) throw error; }
  }
  if (!verified.length) throw new InputResolutionError('The matching addresses did not pass DBC pool validation for this token. Paste a verified individual pool address.', 'NO_VALID_POOL');
  if (verified.length > 1) throw new InputResolutionError('Multiple DBC pools match this token. Choose the pool you want to inspect.', 'MULTIPLE_POOLS', 409, verified.map(report => report.address));
  return { ...verified[0], inputAddress, resolution: { kind: 'token', source: 'on-chain-filtered-rpc', inputSlot: initial.context.slot, candidateCount: candidates.size } };
}
