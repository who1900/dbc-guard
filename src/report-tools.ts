import type { Report } from './types';

export const REAL_POOL = '8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW';
export const HOOK_POOL = 'BPsd85Aa4RZors38wanFbZauijj62Tfgx6VTtobzBqL8';
export function inspectionFailure(body: { error?: string; retryable?: boolean; candidates?: string[] }, status: number) {
  return { message: body.error || 'Inspection failed.', retryable: body.retryable ?? (status === 429 || status >= 500), candidates: Array.isArray(body.candidates) ? body.candidates.filter(address => typeof address === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)).slice(0, 8) : [] };
}
export function matchesInspection(report: Report, input: string, network: Report['network']) {
  return (report.inputAddress ?? report.address) === input && report.network === network && report.synthetic === false;
}
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
