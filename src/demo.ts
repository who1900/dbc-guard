import type { Report } from './types';
export const demo: Report = {
  schemaVersion: 1, address: 'SYNTHETIC-DEMO-NOT-AN-ONCHAIN-POOL', network: 'devnet', synthetic: true, inspectedAt: new Date().toISOString(), slot: null, configAddress: 'Synthetic configuration', mintAddress: 'Synthetic mint', quoteMint: 'SOL (illustrative)', creator: 'Synthetic creator', verdict: 'Known risk detected', coverage: 100,
  migration: { percent: 63, reserve: '63', threshold: '100', destination: 'DAMM v2', status: 'Bonding curve active' }, raw: null,
  checks: [
    { id: 'mint', title: 'Mint authority', status: 'pass', summary: 'Additional minting is disabled in this synthetic example.', evidence: { authority: 'None' } },
    { id: 'freeze', title: 'Freeze authority', status: 'pass', summary: 'No freeze authority is present.', evidence: { authority: 'None' } },
    { id: 'extensions', title: 'Token extensions', status: 'pass', summary: 'No policy-sensitive extensions detected.', evidence: { extensions: ['MetadataPointer', 'TokenMetadata'] } },
    { id: 'fees', title: 'Maximum configured trading fee', status: 'caution', summary: 'Configured upper bound 5.00%. This is not a quote for your trade.', evidence: { maxBps: 500, baseMode: 'Linear scheduler', dynamicFeeEnabled: false }, recommendation: 'Compare the upper bound with the live swap quote.' },
    { id: 'liquidity', title: 'Migration liquidity allocation', status: 'risk', summary: '20% permanently locked · 10% vested · 70% unlocked at migration.', evidence: { permanentPercent: 20, vestingPercent: 10, unlockedPercent: 70 }, recommendation: 'Review recipients: unlocked LP can be withdrawn.' },
    { id: 'allocation', title: 'Creator token allocation & leftovers', status: 'caution', summary: '25% of configured supply reserved for creator vesting. This is not a holdings analysis.', evidence: { creatorVestingRaw: '250000000000', configuredSupplyRaw: '1000000000000', leftoverReceiver: 'Synthetic receiver' } },
    { id: 'curve', title: 'Curve structure & price amplification', status: 'pass', summary: '3 active segments; graduation/start price ratio 12.00×.', evidence: { activeSegments: 3, monotonic: true, amplification: '12.00' } },
    { id: 'migration', title: 'Graduation & migration', status: 'pass', summary: 'Bonding curve active → DAMM v2.', evidence: { thresholdRaw: '100000000000', quoteReserveRaw: '63000000000', migrated: false } },
  ],
};
