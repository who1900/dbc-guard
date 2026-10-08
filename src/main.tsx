import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Report } from './types';
import { demo } from './demo';
import { InspectionRequest, REAL_POOL, HOOK_POOL, inspectionFailure, matchesInspection, recommendations, statusCounts } from './report-tools';
import './style.css';
import { completedChecks, isMigrated, keyFindings, launchHeadline, parseInspectionInput, readRecent, RECENT_KEY, rememberScan, reportScope, sortedChecks, statusLabel } from './report-presentation';

const params = new URLSearchParams(location.search);
const short = (value: string) => value.length > 24 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
function download(name: string, data: Blob) { const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function App() {
  const [address, setAddress] = useState(params.get('pool') || '');
  const [network, setNetwork] = useState<Report['network']>(params.get('network') === 'devnet' ? 'devnet' : 'mainnet-beta');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [retryable, setRetryable] = useState(false); const [candidates, setCandidates] = useState<string[]>([]);
  const request = useRef(new InspectionRequest());
  const reportHeading = useRef<HTMLHeadingElement>(null);
  const [tokenInfo, setTokenInfo] = useState<{ name: string | null; symbol: string | null } | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [recent, setRecent] = useState(() => { try { return readRecent(localStorage.getItem(RECENT_KEY)); } catch { return []; } });
  useEffect(() => () => request.current.cancel(), []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active && params.has('pool')) void inspect(params.get('pool') || '', params.get('network') === 'devnet' ? 'devnet' : 'mainnet-beta'); });
    return () => { active = false; request.current.cancel(); };
  }, []);
  useEffect(() => {
    setTokenInfo(null);
    if (!report) { setMetadataLoading(false); return; }
    reportHeading.current?.focus({ preventScroll: true });
    reportHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (report.synthetic) { setMetadataLoading(false); return; }
    const controller = new AbortController(); let active = true;
    setMetadataLoading(true);
    void fetch(`/api/token-info?address=${encodeURIComponent(report.mintAddress)}&network=${report.network}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
      .then(async response => { if (!response.ok) return; const data = await response.json(); if (active && data.mint === report.mintAddress && data.network === report.network && ['metaplex', 'token-2022', 'unavailable'].includes(data.source) && (data.name === null || typeof data.name === 'string') && (data.symbol === null || typeof data.symbol === 'string')) setTokenInfo({ name: data.name?.slice(0, 100) || null, symbol: data.symbol?.slice(0, 32) || null }); })
      .catch(() => {}).finally(() => { if (active) setMetadataLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [report]);
  function reset() { request.current.cancel(); setLoading(false); setReport(null); setError(''); setNotice(''); setRetryable(false); setCandidates([]); }
  function example(pool = REAL_POOL) { reset(); setAddress(pool); setNetwork('mainnet-beta'); void inspect(pool, 'mainnet-beta'); }
  async function inspect(pool = address.trim(), cluster = network) {
    try { const parsed = parseInspectionInput(pool, cluster); pool = parsed.address; cluster = parsed.network; setAddress(pool); setNetwork(cluster); }
    catch (e) { reset(); setError((e as Error).message); document.getElementById('address')?.focus(); return; }
    const current = request.current.start(); setLoading(true); setError(''); setReport(null); setNotice(''); setRetryable(false); setCandidates([]);
    try {
      const response = await fetch(`/api/inspect?address=${encodeURIComponent(pool)}&network=${cluster}`, { signal: AbortSignal.any([current.signal, AbortSignal.timeout(55000)]) });
      const body = await response.json();
      if (!current.isCurrent()) return;
      if (!response.ok) { const failure = inspectionFailure(body, response.status); setError(failure.message); setRetryable(failure.retryable); setCandidates(failure.candidates); return; }
      if (!matchesInspection(body, pool, cluster)) throw new Error('Unexpected inspection response. Please retry.');
      setReport(body); setRecent(previous => { const next = rememberScan(previous, body); try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ } return next; }); if (body.resolution?.kind === 'token') setNotice(`Token ${short(pool)} resolved to DBC pool ${short(body.address)}. This pool was validated on-chain.`);
      history.replaceState(null, '', `?pool=${encodeURIComponent(body.address)}&network=${cluster}`);
    } catch (e) { if (current.isCurrent() && !current.signal.aborted) { setRetryable(true); setError((e as Error).name === 'TimeoutError' ? 'Inspection timed out. Please retry shortly.' : (e as Error).message); } }
    finally { if (current.isCurrent()) setLoading(false); }
  }
  function run(event: React.FormEvent) { event.preventDefault(); void inspect(); }
  async function share() { if (!report || report.synthetic) return; const link = `${location.origin}${location.pathname}?pool=${report.address}&network=${report.network}`; try { await navigator.clipboard.writeText(link); setNotice('Inspection link copied. Opening it starts a fresh inspection.'); } catch { setNotice(link); } }
  function card() {
    if (!report) return;
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const counts = statusCounts(report); const headline = launchHeadline(report);
    ctx.fillStyle = '#fafaf3'; ctx.fillRect(0, 0, 1200, 630); ctx.fillStyle = '#1a1a1a';
    ctx.font = '24px monospace'; ctx.fillText(`DBC GUARD / ${report.synthetic ? 'SYNTHETIC DEMO' : report.network.toUpperCase()}`, 64, 80);
    let size = 56; do { ctx.font = `bold ${size}px sans-serif`; size--; } while (ctx.measureText(headline).width > 1072 && size > 24);
    ctx.fillText(headline, 64, 190); ctx.font = '24px monospace'; ctx.fillText(completedChecks(report), 64, 250);
    ctx.fillText(`${counts.risk} launch risk flags · ${counts.caution} cautions · ${counts.unknown} unknown`, 64, 290);
    ctx.font = '22px monospace'; ctx.fillText(report.address, 64, 350); ctx.fillText(`Inspected ${new Date(report.inspectedAt).toISOString()}`, 64, 400); ctx.fillText(`Slot ${report.slot ?? 'N/A — synthetic'}`, 64, 440);
    ctx.font = '20px sans-serif'; ctx.fillText(isMigrated(report) ? 'Historical launch settings. Current DAMM positions are not checked.' : 'Launch snapshot. Not a live quote or complete token safety check.', 64, 535);
    ctx.fillText('No launch flags does not establish token safety.', 64, 575); canvas.toBlob(blob => blob && download('dbc-guard-card.png', blob));
  }
  return <><header><a className="brand" href="/">DBC<span>GUARD</span><i>↗</i></a><span className="meta">METEORA / INDEPENDENT TOOL</span><a href="#methodology">Methodology ↘</a></header><main>
    <section className="hero"><div className="eyebrow"><span className="dot"/> READ-ONLY ON-CHAIN INSPECTION</div><h1>Understand a Meteora token launch <span>before you trade.</span></h1><p className="intro">Review trading fees, token controls and liquidity arrangements.<br/>Eight evidence-backed launch checks. No wallet required.</p>
      <form onSubmit={run} aria-busy={loading}><label htmlFor="address">DBC POOL, TOKEN ADDRESS OR SUPPORTED LINK (REQUIRED)</label><div className="inputRow"><input id="address" value={address} onChange={e => { reset(); setAddress(e.target.value); }} placeholder="Solana address or Explorer / Solscan link" required maxLength={2048} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={error ? true : undefined} aria-describedby={error ? 'input-help inspection-error' : 'input-help'}/><select aria-label="Solana network" value={network} onChange={e => { reset(); setNetwork(e.target.value as Report['network']); }}><option value="mainnet-beta">Mainnet</option><option value="devnet">Devnet (test network)</option></select><button disabled={loading}>{loading ? 'Inspecting…' : 'Inspect launch ↗'}</button></div><p id="input-help" className="inputHelp">Links supported: Solana Explorer, Solscan, Rugcheck and DBC Guard. Explicit network links select their network.</p></form>
      {network === 'devnet' && <p className="networkNotice">DEVNET — test tokens and pools, not mainnet assets.</p>}
      <div className="helper"><span>Confirmed chain reads · No transactions</span><button className="textButton" onClick={() => example()}>Inspect real mainnet example →</button><button className="textButton" onClick={() => { reset(); setAddress(demo.address); setNetwork(demo.network); setReport({ ...demo, inspectedAt: new Date().toISOString() }); }}>Explore synthetic demo →</button></div>
      {recent.length > 0 && <div className="recent"><div className="recentHeading"><span className="eyebrow">RECENT INSPECTIONS</span><button className="textButton" onClick={() => { setRecent([]); try { localStorage.removeItem(RECENT_KEY); } catch { /* Storage is optional. */ } }}>Clear history</button></div><p>Last five pool addresses saved on this device only. Opening one runs a fresh inspection.</p><div className="recentList">{recent.map(item => <button className="textButton" key={`${item.network}:${item.address}`} onClick={() => void inspect(item.address, item.network)}>{short(item.address)} · {item.network === 'devnet' ? 'Devnet' : 'Mainnet'} ↗</button>)}</div></div>}
      {loading && <div className="message loading" role="status"><div className="loadingBars" aria-hidden="true"><span/><span/></div>Finding the pool and reading its configuration and token mints. This may take up to 50 seconds. <button className="textButton" onClick={reset}>Cancel inspection</button></div>}{error && <div id="inspection-error" className="message error" role="alert"><p>{error}</p>{retryable && <button className="textButton" onClick={() => void inspect()}>Retry inspection</button>}{candidates.length > 0 && <div aria-label="Matching DBC pools">{candidates.map(pool => <p key={pool}><button className="textButton" onClick={() => { setAddress(pool); void inspect(pool); }}>Inspect pool {short(pool)} ↗</button></p>)}</div>}{!retryable && candidates.length === 0 && <div><p>Try a real pool:</p><button className="textButton" onClick={() => example()}>Inspect mainnet example →</button><p><button className="textButton" onClick={() => example(HOOK_POOL)}>Inspect transfer-hook example →</button></p></div>}</div>}
    </section>
    {report && <section className="results" aria-label="Inspection report"><div className="reportHeading"><div><div className="eyebrow">{report.synthetic ? 'SYNTHETIC DEMO / NOT CHAIN DATA' : `${report.network.toUpperCase()} / SLOT ${report.slot}`}</div><h2 ref={reportHeading} tabIndex={-1}>{launchHeadline(report)}</h2><p>{statusCounts(report).risk} launch risk flags · {statusCounts(report).caution} cautions · {statusCounts(report).unknown} unknown</p><p>{completedChecks(report)}. This is not a safety score.</p></div></div>
      <div className="tokenIdentity"><h3>{report.synthetic ? 'Synthetic token example' : tokenInfo?.name || `Token ${short(report.mintAddress)}`}{tokenInfo?.symbol && <span className="tokenSymbol">{tokenInfo.symbol}</span>}</h3><p>{report.synthetic ? 'Illustrative data only.' : metadataLoading ? 'Loading token metadata…' : tokenInfo?.name || tokenInfo?.symbol ? 'Issuer-provided metadata. Name and ticker do not prove token identity.' : 'Metadata unavailable. Confirm the mint address below.'}</p>{!report.synthetic && <div className="tokenActions"><span title={report.mintAddress} className="mintAddress">MINT {short(report.mintAddress)}</span><button className="textButton" onClick={async () => { try { await navigator.clipboard.writeText(report.mintAddress); setNotice('Mint address copied.'); } catch { setNotice(`Mint address: ${report.mintAddress}`); } }}>Copy mint address</button><a href={`https://explorer.solana.com/address/${report.mintAddress}?cluster=${report.network}`} target="_blank" rel="noreferrer">View token ↗</a></div>}</div>
      <div className="scopeBanner"><span className="eyebrow">{isMigrated(report) ? 'MIGRATED / HISTORICAL LAUNCH CONFIGURATION' : 'WHAT THIS REPORT COVERS'}</span><p>{reportScope(report)}</p><p>No launch flags does not establish token safety.</p></div>
      <div className="keyFindings"><h3>Three things to understand first</h3><div className="findingsGrid">{keyFindings(report).map(check => <article className={`finding ${check.status}`} key={check.id}><span className="badge">{statusLabel(check.status)}</span><h4>{check.title}</h4><p>{check.summary}</p></article>)}</div></div>
      <div className="reportMeta"><span title={report.address}>POOL {short(report.address)}</span><span>{new Date(report.inspectedAt).toLocaleString()}</span><div className="actions"><button className="textButton" onClick={() => download('dbc-guard-report.json', new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))}>JSON ↓</button><button className="textButton" onClick={card}>Card PNG ↓</button>{!report.synthetic && <button className="textButton" onClick={share}>Share ↗</button>}</div></div>{notice && <p role="status" className="notice">{notice}</p>}
      <div className="migration"><div><span className="eyebrow">GRADUATION PROGRESS</span><h3>{report.migration.percent.toFixed(2)}<small>%</small></h3></div><div className="migrationTrack"><progress aria-label="Graduation progress" max="100" value={report.migration.percent}/><p>{report.migration.reserve} / {report.migration.threshold} quote tokens</p><span>{report.migration.status} → {report.migration.destination}</span></div></div>
      <h3 className="detailsHeading">All eight launch checks · highest priority first</h3><div className="checks">{sortedChecks(report).map((check, i) => <article className={`check ${check.status}`} key={check.id}><div className="checkTop"><span className="meta">0{i + 1}</span><span className="badge">{statusLabel(check.status)}</span></div><h3>{check.title}</h3>{check.id === 'fees' && isMigrated(report) && <p className="historicalLabel">HISTORICAL DBC FEE SETTINGS</p>}<p>{check.summary}</p>{check.id === 'fees' && <p className="feeContext">Configured fee ceilings may include legitimate anti-sniper fees that decrease over time. This is not the current trading fee or a swap quote.</p>}{check.recommendation && <p className="recommendation">↗ {check.recommendation}</p>}<details><summary>View evidence</summary><dl>{Object.entries(check.evidence).map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{Array.isArray(value) ? value.join(', ') || 'None' : String(value)}</dd></React.Fragment>)}</dl></details></article>)}</div>
      {!report.synthetic && <div className="accountLinks">{[['Pool', report.address], ['Config', report.configAddress], ['Base mint', report.mintAddress], ['Quote mint', report.quoteMint], ['Creator', report.creator]].map(([label, key]) => <a key={label} href={`https://explorer.solana.com/address/${key}?cluster=${report.network}`} target="_blank" rel="noreferrer">{label} ↗</a>)}</div>}
      <button className="secondary" onClick={() => download('dbc-guard-recommendations.json', new Blob([JSON.stringify(recommendations(report), null, 2)], { type: 'application/json' }))}>Export review recommendations ↓</button>
    </section>}
    <section className="methodology" id="methodology"><span className="eyebrow">HOW TO READ THE REPORT</span><h2>Evidence first.<br/>Certainty never assumed.</h2><div className="methodGrid"><div><h3>01 / What we read</h3><p>Pool and config account ownership and SDK discriminators, token mint authorities and extension types, configured fees, LP allocation, creator vesting, curve boundaries and migration state.</p></div><div><h3>02 / How we flag</h3><p>Mint or freeze capability and majority unlocked LP receive risk flags. Fee ceilings above 3% receive caution; above 10% receive risk. Creator allocation above 20% and graduation price amplification above 100× are review heuristics.</p></div><div><h3>03 / What stays unknown</h3><p>Holder distribution, creator identity, linked wallets, code exploits, extension parameters, quote-token safety and post-migration liquidity positions are not audited. Reads are confirmed snapshots, not one atomic state.</p></div></div><p className="fineprint">Coverage counts available checks, not percentage of security audited. Configured locks describe migration allocation, not verified current DAMM positions. Reports do not certify safety or predict price. DBC Guard cannot change deployed pool configurations.</p></section>
  </main><footer><span>DBC GUARD</span><span>BUILT FOR METEORA DBC · SDK 1.5.13</span><a href="https://docs.meteora.ag/developer-guides/dbc" target="_blank" rel="noreferrer">Protocol documentation ↗</a></footer></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
