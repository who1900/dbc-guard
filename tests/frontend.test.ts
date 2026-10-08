import test from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/demo.js';
import { InspectionRequest, inspectionFailure, matchesInspection, recommendations, statusCounts } from '../src/report-tools.js';
import { completedChecks, keyFindings, launchHeadline, parseInspectionInput, readRecent, rememberScan, reportScope, sortedChecks } from '../src/report-presentation.js';

const mint = 'So11111111111111111111111111111111111111112';
test('supported links extract only explicit addresses and respect network', () => {
  assert.deepEqual(parseInspectionInput(` ${mint} `, 'devnet'), { address: mint, network: 'devnet' });
  for (const link of [`https://explorer.solana.com/address/${mint}?cluster=devnet`, `https://solscan.io/token/${mint}?cluster=devnet`, `https://dbc.whoim.space/?pool=${mint}&network=devnet`]) assert.deepEqual(parseInspectionInput(link, 'mainnet-beta'), { address: mint, network: 'devnet' });
  assert.equal(parseInspectionInput(`https://rugcheck.xyz/tokens/${mint}`, 'devnet').network, 'mainnet-beta');
  assert.equal(parseInspectionInput(`https://solscan.io/account/${mint}`, 'devnet').network, 'mainnet-beta');
});
test('input parser rejects unsafe, ambiguous and malformed links without fetching', () => {
  for (const input of ['', 'invalid-address', `http://solscan.io/token/${mint}`, `https://solscan.io.evil.test/token/${mint}`, `https://evil.test/?pool=${mint}`, `https://user@solscan.io/token/${mint}`, `https://solscan.io/token/${mint}?cluster=testnet`, `https://solscan.io/token/${mint}?cluster=devnet&cluster=mainnet-beta`, `https://dbc.whoim.space/?pool=${mint}&pool=${mint}`, `https://solscan.io/token/${mint}/extra`, `https://solscan.io:8080/token/${mint}`, `https://solscan.io/token/${mint}#anything`, 'a'.repeat(2049)]) assert.throws(() => parseInspectionInput(input, 'mainnet-beta'));
  assert.throws(() => parseInspectionInput(`https://dexscreener.com/solana/${mint}`, 'mainnet-beta'), /trading pairs/);
});
test('priority and top findings preserve original evidence and order', () => {
  const original = demo.checks.map(c => c.id);
  assert.equal(sortedChecks(demo)[0].id, 'liquidity');
  assert.equal(keyFindings(demo)[0].title, 'How was migration liquidity allocated?');
  assert.match(keyFindings(demo)[0].summary, /70.00%.*configured.*migration/);
  assert.match(keyFindings(demo)[1].summary, /anti-sniper.*not the fee/);
  assert.deepEqual(demo.checks.map(c => c.id), original);
  assert.equal(launchHeadline(demo), 'Launch conditions need review');
  const pass = { ...demo, checks: demo.checks.map(c => ({ ...c, status: 'pass' as const })) };
  assert.equal(launchHeadline(pass), 'No launch flags found');
  assert.equal(completedChecks(pass), '8/8 checks completed');
  const unknown = { ...pass, checks: [{ ...pass.checks[0], status: 'unknown' as const }, ...pass.checks.slice(1)] };
  assert.equal(launchHeadline(unknown), 'Launch assessment incomplete');
  assert.equal(completedChecks(unknown), '7/8 checks completed');
  assert.equal(launchHeadline({ ...unknown, checks: [...unknown.checks, { ...demo.checks[0], status: 'caution' }] }), 'Review launch cautions');
});
test('migrated settings never imply current fees or current DAMM positions', () => {
  const migrated = { ...demo, checks: demo.checks.map(c => c.id === 'migration' ? { ...c, evidence: { migrated: true } } : c) };
  assert.match(reportScope(migrated), /Historical.*Current DAMM.*not checked/);
  assert.match(keyFindings(migrated)[0].summary, /Current DAMM positions are not verified/);
  assert.match(keyFindings(migrated)[1].summary, /historical.*not the fee you would pay now/);
  assert.match(reportScope(demo), /Holders, linked wallets and quote-token safety are not checked/);
});
test('creator findings disclose configured leftovers and do not round tiny allocations to zero', () => {
  const check = { ...demo.checks.find(c => c.id === 'allocation')!, evidence: { creatorVestingRaw: '1', configuredSupplyRaw: '1000000', configuredLeftoverEstimatePercent: 90 } };
  const report = { ...demo, checks: [check] };
  assert.match(keyFindings(report)[0].summary, /<0.01%.*further 90.00%.*configured leftovers.*not current wallet holdings/);
  const tinyLeftover = { ...check, evidence: { creatorVestingRaw: '0', configuredSupplyRaw: '1000000000000', configuredLeftoverEstimatePercent: 0, configuredLeftoverEstimateRaw: '1' } };
  assert.match(keyFindings({ ...demo, checks: [tinyLeftover] })[0].summary, /further <0.01%.*configured leftovers/);
  const locked = { ...demo, checks: [{ ...demo.checks.find(c => c.id === 'liquidity')!, evidence: { unlockedPercent: 0 } }] };
  assert.match(keyFindings(locked)[0].summary, /All migration liquidity was configured to be locked or vested/);
});
test('recent history is bounded, deduplicated, sanitized and excludes synthetic scans', () => {
  assert.deepEqual(readRecent('{broken'), []); assert.deepEqual(readRecent('{}'), []);
  assert.deepEqual(readRecent(JSON.stringify([{ address: mint, network: 'testnet', inspectedAt: 'yesterday' }, { address: '<script>', network: 'devnet', inspectedAt: demo.inspectedAt }])), []);
  const live = { ...demo, synthetic: false, address: mint };
  let recent = rememberScan([], live); assert.equal(recent.length, 1);
  recent = rememberScan(recent, live); assert.equal(recent.length, 1);
  assert.equal(rememberScan(recent, demo), recent);
  assert.deepEqual(Object.keys(recent[0]).sort(), ['address', 'inspectedAt', 'network']);
  const entries = Array.from({ length: 8 }, (_, i) => ({ address: `${'1'.repeat(32)}${i + 1}`, network: 'devnet', inspectedAt: demo.inspectedAt }));
  assert.equal(readRecent(JSON.stringify(entries)).length, 5);
});

test('mode changes cancel live requests and prevent stale reports', () => {
  const gate = new InspectionRequest(); const live = gate.start();
  gate.cancel(); assert.equal(live.signal.aborted, true); assert.equal(live.isCurrent(), false);
  const newer = gate.start(); assert.equal(newer.isCurrent(), true);
  const latest = gate.start(); assert.equal(newer.signal.aborted, true); assert.equal(newer.isCurrent(), false); assert.equal(latest.isCurrent(), true);
});
test('input failures never recommend retry; transient errors can retry and choices are bounded', () => {
  assert.equal(inspectionFailure({ error: 'wallet' }, 422).retryable, false);
  assert.equal(inspectionFailure({ error: 'invalid' }, 400).retryable, false);
  assert.equal(inspectionFailure({ error: 'RPC' }, 502).retryable, true);
  assert.equal(inspectionFailure({ error: 'use pool', retryable: false }, 503).retryable, false);
  assert.equal(inspectionFailure({ candidates: ['javascript:bad', 'x', demo.address] }, 409).candidates.length, 0);
});
test('token resolution must match requested input/network and cannot masquerade as a live demo', () => {
  const report = { ...demo, address: 'resolved-pool', inputAddress: 'requested-token', synthetic: false };
  assert.equal(matchesInspection(report, 'requested-token', report.network), true);
  assert.equal(matchesInspection(report, 'different-token', report.network), false);
  assert.equal(matchesInspection({ ...report, synthetic: true }, 'requested-token', report.network), false);
});
test('temporary discovery failure retains the server retry action', () => {
  const result = inspectionFailure({ error: 'Lookup temporarily unavailable; retry or use a pool address.', retryable: true }, 503);
  assert.equal(result.retryable, true); assert.equal(result.candidates.length, 0);
});
test('recommendation exports retain full report provenance and count all finding types', () => {
  const exported = recommendations(demo);
  assert.equal(exported.network, demo.network); assert.equal(exported.slot, demo.slot);
  assert.equal(exported.schemaVersion, demo.schemaVersion); assert.equal(exported.inspectedAt, demo.inspectedAt);
  assert.deepEqual(exported.raw, demo.raw); assert.equal(exported.synthetic, true);
  assert.equal(exported.recommendations.length, demo.checks.filter(c => c.status !== 'pass').length);
  const counts = statusCounts(demo); assert.equal(counts.risk + counts.caution + counts.unknown, exported.recommendations.length);
});
