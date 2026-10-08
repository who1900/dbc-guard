import test from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/demo.js';
import { InspectionRequest, inspectionFailure, matchesInspection, recommendations, statusCounts } from '../src/report-tools.js';

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
