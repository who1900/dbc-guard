import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readReport, validateAddress } from './reader.js';

try { process.loadEnvFile('.env'); } catch { /* Environment file is optional. */ }
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.set('json replacer', (_key: string, value: unknown) => typeof value === 'bigint' ? value.toString() : value);
app.use((_req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' }); next(); });
const windows = new Map<string, { start: number; count: number }>();
const cache = new Map<string, { at: number; report: Awaited<ReturnType<typeof readReport>> }>();
let active = 0;
app.get('/api/health', (_req, res) => res.json({ status: 'ok', sdk: '1.5.13' }));
app.get('/api/inspect', async (req, res) => {
  const key = req.ip || 'local'; const now = Date.now();
  if (windows.size > 10000) for (const [ip, w] of windows) if (now - w.start > 60000) windows.delete(ip);
  const window = windows.get(key) ?? { start: now, count: 0 }; if (now - window.start > 60000) { window.start = now; window.count = 0; } window.count++; windows.set(key, window);
  if (window.count > 20 || active >= 8) { res.set('Retry-After', '60').status(429).json({ error: 'Too many requests. Please retry in one minute.' }); return; }
  let address: string;
  try { address = validateAddress(req.query.address); } catch (e) { res.status(400).json({ error: (e as Error).message }); return; }
  if (req.query.network !== 'mainnet-beta' && req.query.network !== 'devnet') { res.status(400).json({ error: 'Select mainnet-beta or devnet.' }); return; }
  const network = req.query.network; const cacheKey = `${network}:${address}`; const cached = cache.get(cacheKey);
  if (cached && now - cached.at < 20000) { res.json(cached.report); return; }
  active++;
  try { const report = await readReport(address, network); if (cache.size > 200) cache.clear(); cache.set(cacheKey, { at: Date.now(), report }); res.json(report); }
  catch (e) { const message = (e as Error).message; const known = /Account is not|account does not|Malformed DBC|DBC configuration/.test(message); res.status(known ? 422 : 502).json({ error: known ? message : 'RPC could not complete the inspection. Retry shortly or configure a dedicated server RPC endpoint.' }); }
  finally { active--; }
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
const dist = path.resolve('dist');
if (existsSync(dist)) { app.use(express.static(dist)); app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html'))); }
const port = Number(process.env.PORT || 3001);
app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`DBC Guard http://${process.env.HOST || '127.0.0.1'}:${port}`));
