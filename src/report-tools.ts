import type { Report } from './types';

export const REAL_POOL = '8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW';
export function statusCounts(report: Report) {
  return { risk: report.checks.filter(c => c.status === 'risk').length, caution: report.checks.filter(c => c.status === 'caution').length, unknown: report.checks.filter(c => c.status === 'unknown').length };
}
export function recommendations(report: Report) {
  return {
    ...report,
    exportType: 'dbc-guard-review-recommendations', exportedAt: new Date().toISOString(),
    notice: 'Review recommendations only. Not an executable SDK configuration. Deployed config is immutable.',
    recommendations: report.checks.filter(c => c.status !== 'pass').map(c => ({ check: c.id, status: c.status, finding: c.summary, evidence: c.evidence, action: c.recommendation || 'Review on-chain evidence and protocol documentation.' })),
  };
}

export class InspectionRequest {
  private generation = 0;
  private controller?: AbortController;
  cancel() { this.generation++; this.controller?.abort(); this.controller = undefined; }
  start() {
    this.cancel();
    const generation = this.generation;
    this.controller = new AbortController();
    return { signal: this.controller.signal, isCurrent: () => generation === this.generation };
  }
}
