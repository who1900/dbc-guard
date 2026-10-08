import test from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/demo.js';
import { InspectionRequest, recommendations, statusCounts } from '../src/report-tools.js';

test('mode changes cancel live requests and prevent stale reports', () => {
  const gate = new InspectionRequest(); const live = gate.start();
  gate.cancel(); assert.equal(live.signal.aborted, true); assert.equal(live.isCurrent(), false);
  const newer = gate.start(); assert.equal(newer.isCurrent(), true);
  const latest = gate.start(); assert.equal(newer.signal.aborted, true); assert.equal(newer.isCurrent(), false); assert.equal(latest.isCurrent(), true);
});
test('recommendation exports retain full report provenance and count all finding types', () => {
  const exported = recommendations(demo);
  assert.equal(exported.network, demo.network); assert.equal(exported.slot, demo.slot);
  assert.equal(exported.schemaVersion, demo.schemaVersion); assert.equal(exported.inspectedAt, demo.inspectedAt);
  assert.deepEqual(exported.raw, demo.raw); assert.equal(exported.synthetic, true);
  assert.equal(exported.recommendations.length, demo.checks.filter(c => c.status !== 'pass').length);
  const counts = statusCounts(demo); assert.equal(counts.risk + counts.caution + counts.unknown, exported.recommendations.length);
});
