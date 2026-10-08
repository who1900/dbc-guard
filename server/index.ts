import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readReport, validateAddress, InvalidAccountError, RpcTransportError } from './reader.js';
import { inspectInput, InputResolutionError } from './resolve.js';

interface Options { readReport?: typeof readReport; inspectInput?: typeof inspectInput; now?: () => number; deadlineMs?: number; rateLimit?: number; maxBuckets?: number; maxActive?: number }
export function createApp(options: Options = {}) {
const reader = options.inspectInput ?? (options.readReport ? options.readReport : inspectInput);
const clock = options.now ?? Date.now;
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.set('json replacer', (_key: string, value: unknown) => typeof value === 'bigint' ? value.toString() : value);
app.use((_req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" }); next(); });
const windows = new Map<string, { start: number; count: number }>();
const cache = new Map<string, { at: number; report: Awaited<ReturnType<typeof readReport>> }>();
const pending = new Map<string, { promise: Promise<Awaited<ReturnType<typeof readReport>>>; controller: AbortController; subscribers: number }>();
let active = 0;
app.get('/api/health', (_req, res) => res.json({ status: 'ok', release: '1.2.0', sdk: '1.5.13' }));
app.get('/api/inspect', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const key = req.ip || 'local'; const now = clock();
  for (const [ip, w] of windows) if (now - w.start >= 60000) windows.delete(ip);
  if (!windows.has(key) && windows.size >= (options.maxBuckets ?? 5000)) { res.set('Retry-After', '60').status(429).json({ error: 'Inspection capacity reached. Please retry in one minute.' }); return; }
  const window = windows.get(key) ?? { start: now, count: 0 }; if (now - window.start > 60000) { window.start = now; window.count = 0; } window.count++; windows.set(key, window);
  if (window.count > (options.rateLimit ?? 20)) { res.set('Retry-After', '60').status(429).json({ error: 'Too many requests. Please retry in one minute.' }); return; }
  let address: string;
  try { address = validateAddress(req.query.address); } catch { res.status(400).json({ error: 'Enter a valid Solana DBC pool or token mint address.', code: 'INVALID_ADDRESS', retryable: false }); return; }
  if (req.query.network !== 'mainnet-beta' && req.query.network !== 'devnet') { res.status(400).json({ error: 'Select mainnet-beta or devnet.', code: 'INVALID_NETWORK', retryable: false }); return; }
  const network = req.query.network; const cacheKey = `${network}:${address}`; const cached = cache.get(cacheKey);
  if (cached && now - cached.at < 20000) { res.json(cached.report); return; }
  let job = pending.get(cacheKey);
  if (job?.controller.signal.aborted) { res.set('Retry-After', '1').status(503).json({ error: 'Previous inspection is cancelling. Retry shortly.' }); return; }
  if (!job) {
    if (active >= (options.maxActive ?? 8)) { res.set('Retry-After', '5').status(429).json({ error: 'Inspection capacity reached. Retry shortly.' }); return; }
    active++;
    const controller = new AbortController();
    const work = Promise.resolve().then(() => reader(address, network, { signal: controller.signal }));
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Inspection deadline exceeded')); }, options.deadlineMs ?? 50000); timer.unref(); });
    job = { promise: Promise.race([work, timeout]), controller, subscribers: 0 };
    pending.set(cacheKey, job);
    const settled = () => { clearTimeout(timer); active--; pending.delete(cacheKey); };
    void work.then(report => { if (!controller.signal.aborted) { if (cache.size >= 200) cache.delete(cache.keys().next().value!); cache.set(cacheKey, { at: clock(), report }); } settled(); }, settled);
  }
  const subscription = job; subscription.subscribers++;
  let released = false;
  const release = () => { if (released) return; released = true; subscription.subscribers--; if (subscription.subscribers === 0 && pending.get(cacheKey) === subscription) subscription.controller.abort(); };
  res.once('close', release);
  try { const report = await subscription.promise; if (!res.destroyed) res.json(report); }
  catch (e) { if (!res.destroyed) {
    const known = e instanceof InvalidAccountError; const input = e instanceof InputResolutionError;
    const busy = e instanceof RpcTransportError && e.status === 429;
    if (busy) res.set('Retry-After', String(Math.max(1, Math.min(120, Math.ceil(e.retryAfter ?? 5)))));
    res.status(busy ? 429 : input ? e.status : known ? 422 : 502).json({ error: busy ? 'Solana RPC is busy. Retry shortly.' : input || known ? e.message : 'RPC could not complete the inspection. Retry shortly or configure a dedicated server RPC endpoint.', code: busy ? 'RPC_BUSY' : input ? e.code : known ? 'INVALID_ACCOUNT' : 'RPC_UNAVAILABLE', retryable: input ? e.status >= 500 : !known, ...(input && e.candidates ? { candidates: e.candidates } : {}) });
  } }
  finally { res.off('close', release); release(); }
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
const dist = path.resolve('dist');
if (existsSync(dist)) { app.use(express.static(dist)); app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html'))); }
return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
try { process.loadEnvFile('.env'); } catch { /* Environment file is optional. */ }
const app = createApp();
const port = Number(process.env.PORT || 3001);
app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`DBC Guard http://${process.env.HOST || '127.0.0.1'}:${port}`));
}
