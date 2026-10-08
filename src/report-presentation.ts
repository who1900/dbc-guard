import type { Check, Report } from './types';

export const isAddress = (value: unknown): value is string => typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
export function parseInspectionInput(value: string, selected: Report['network']) {
  const input = value.trim();
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) return { address: input, network: selected };
  const fail = () => { throw new Error('Paste a Solana pool or token address, or a supported Explorer, Solscan, Rugcheck or DBC Guard link.'); };
  if (input.length > 2048) return fail();
  let url: URL;
  try { url = new URL(input); } catch { return fail(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return fail();
  const host = url.hostname.toLowerCase();
  if (host === 'dexscreener.com' || host === 'www.dexscreener.com') throw new Error('DEX Screener links identify trading pairs, which may not be DBC pools. Copy the token mint address from that page instead.');
  let address: string | undefined;
  let cluster: string | null = null;
  if (host === 'dbc.whoim.space' && url.pathname === '/' && url.searchParams.getAll('pool').length === 1 && url.searchParams.getAll('network').length <= 1) {
    address = url.searchParams.get('pool') || undefined; cluster = url.searchParams.get('network');
  } else if (host === 'explorer.solana.com' || host === 'solscan.io') {
    const match = url.pathname.match(host === 'explorer.solana.com' ? /^\/address\/([^/]+)\/?$/ : /^\/(?:token|account)\/([^/]+)\/?$/);
    if (!match || url.searchParams.getAll('cluster').length > 1) return fail();
    address = match[1]; cluster = url.searchParams.get('cluster');
  } else if (host === 'rugcheck.xyz') {
    address = url.pathname.match(/^\/tokens\/([^/]+)\/?$/)?.[1];
    cluster = 'mainnet-beta';
  } else return fail();
  if (!isAddress(address) || (cluster && cluster !== 'devnet' && cluster !== 'mainnet-beta')) return fail();
  return { address, network: (cluster || 'mainnet-beta') as Report['network'] };
}

const priority = { risk: 0, caution: 1, unknown: 2, pass: 3 };
export const sortedChecks = (report: Report) => report.checks.slice().sort((a, b) => priority[a.status] - priority[b.status]);
export function launchHeadline(report: Report) {
  if (report.checks.some(c => c.status === 'risk')) return 'Launch conditions need review';
  if (report.checks.some(c => c.status === 'caution')) return 'Review launch cautions';
  if (report.checks.some(c => c.status === 'unknown')) return 'Launch assessment incomplete';
  return 'No launch flags found';
}
export const completedChecks = (report: Report) => `${report.checks.filter(c => c.status !== 'unknown').length}/${report.checks.length} checks completed`;
export const isMigrated = (report: Report) => report.checks.find(c => c.id === 'migration')?.evidence.migrated === true;
export const reportScope = (report: Report) => isMigrated(report)
  ? 'Historical DBC launch settings. Current DAMM fees, liquidity positions and holders are not checked.'
  : 'Launch configuration snapshot. Not a live trade quote or complete token safety check. Holders, linked wallets and quote-token safety are not checked.';
const findingTitles: Record<string, string> = { mint: 'Can more tokens be created?', freeze: 'Can token accounts be frozen?', extensions: 'Do tokens have special transfer rules?', fees: 'What fees were configured?', liquidity: 'How was migration liquidity allocated?', allocation: 'What was reserved for the creator?', curve: 'How does the launch price change?', migration: 'Where is the launch now?' };
function findingSummary(check: Check, report: Report) {
  if (check.status === 'unknown') return check.summary;
  if (check.id === 'liquidity' && typeof check.evidence.unlockedPercent === 'number' && Number.isFinite(check.evidence.unlockedPercent)) {
    const unlocked = check.evidence.unlockedPercent.toFixed(2);
    return `${check.evidence.unlockedPercent === 0 ? 'All migration liquidity was configured to be locked or vested.' : `${unlocked}% of liquidity was configured to be unlocked at migration, rather than protected by a lock.`} ${isMigrated(report) ? 'Current DAMM positions are not verified.' : 'Check who receives it and their vesting terms.'}`;
  }
  if (check.id === 'fees' && typeof check.evidence.maxBps === 'number' && Number.isFinite(check.evidence.maxBps)) return `The ${isMigrated(report) ? 'historical ' : ''}launch fee ceiling is ${(check.evidence.maxBps / 100).toFixed(2)}%. It may include anti-sniper fees that decrease over time; it is not the fee you would pay now.`;
  if (check.id === 'allocation') {
    try {
      const vesting = BigInt(String(check.evidence.creatorVestingRaw)); const supply = BigInt(String(check.evidence.configuredSupplyRaw));
      if (supply > 0n && vesting >= 0n && vesting <= supply) {
        const percent = Number(vesting * 10000n / supply) / 100;
        const display = vesting > 0n && percent === 0 ? '<0.01%' : `${percent.toFixed(2)}%`;
        const leftover = check.evidence.configuredLeftoverEstimatePercent;
        let leftoverDisplay = typeof leftover === 'number' && Number.isFinite(leftover) && leftover > 0 ? `${leftover < 0.01 ? '<0.01' : leftover.toFixed(2)}%` : null;
        try {
          const rawLeftover = BigInt(String(check.evidence.configuredLeftoverEstimateRaw));
          if (rawLeftover > 0n && !leftoverDisplay) {
            const leftoverPercent = Number(rawLeftover * 10000n / supply) / 100;
            leftoverDisplay = leftoverPercent === 0 ? '<0.01%' : `${leftoverPercent.toFixed(2)}%`;
          }
        } catch { /* Missing raw evidence must not imply zero leftovers. */ }
        const leftoverText = leftoverDisplay ? ` A further ${leftoverDisplay} is estimated as configured leftovers assigned to a receiver.` : '';
        return `${display} of configured supply is reserved for creator vesting.${leftoverText} These are launch allocations, not current wallet holdings or verified claimable balances.`;
      }
    } catch { /* Preserve the original finding if evidence cannot be interpreted. */ }
  }
  return check.summary;
}
export const keyFindings = (report: Report) => sortedChecks(report).slice(0, 3).map((check: Check) => ({ ...check, title: findingTitles[check.id] || check.title, summary: findingSummary(check, report) }));
export const statusLabel = (status: Check['status']) => status === 'risk' ? 'Launch risk flag' : status === 'pass' ? 'No launch flag' : status === 'unknown' ? 'Not verified' : 'Launch caution';

export interface RecentScan { address: string; network: Report['network']; inspectedAt: string }
export const RECENT_KEY = 'dbc-guard-recent-v1';
export function readRecent(value: string | null): RecentScan[] {
  if (!value || value.length > 10000) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const entries: RecentScan[] = [];
    for (const entry of parsed.slice(0, 100)) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      if (!isAddress(row.address) || (row.network !== 'devnet' && row.network !== 'mainnet-beta') || typeof row.inspectedAt !== 'string' || !Number.isFinite(Date.parse(row.inspectedAt))) continue;
      if (entries.some(e => e.address === row.address && e.network === row.network)) continue;
      entries.push({ address: row.address, network: row.network, inspectedAt: new Date(row.inspectedAt).toISOString() });
      if (entries.length === 5) break;
    }
    return entries;
  } catch { return []; }
}
export function rememberScan(recent: RecentScan[], report: Report): RecentScan[] {
  if (report.synthetic || !isAddress(report.address)) return recent;
  return readRecent(JSON.stringify([{ address: report.address, network: report.network, inspectedAt: report.inspectedAt }, ...recent]));
}
