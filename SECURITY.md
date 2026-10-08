# Security and dependency review

Read-only service; no signing, wallet connection, key storage, arbitrary RPC URL inputs, user-uploaded JSON/TOML or token metadata HTML. Fixed configured RPC endpoints, address/network allowlist, bounded responses/accounts, timeouts, concurrency limit 8, 20 inspections/IP/minute and 20-second cache. React escapes evidence strings. RPC details are not returned on infrastructure failures. API secrets stay server-side. Unknown RPC routes return JSON404.

`npm audit --omit=dev` on 2026-10-08 reported **13 affected packages: 6 high, 7 moderate** (counts include dependency propagation). Outstanding roots: `bigint-buffer` buffer overflow (GHSA-3gc7-fjrx-p6mg) via SPL Token; `toml` recursion/prototype pollution via Anchor (GHSA-82x6-q7mm-w9cf, GHSA-v5mp-jgw5-2x6j); `stream-json` resource/prototype issues and `uuid` output-buffer bounds via web3.js/Jayson. npm proposes incompatible SDK-adjacent major changes; no force-upgrade was applied.

The service does not parse user TOML or use user-supplied UUID buffers. RPC JSON uses web3.js and bounded HTTP responses; bigint/token decoding remains an upstream attack surface despite data bounds and owner checks. This is **not a clean audit or proof of unreachability**. Use trusted RPC infrastructure, keep the process isolated/non-root, monitor upstream SDK fixes, and review compatible updates before public launch. No end-to-end cryptographic chain verification is performed; RPC trust remains.

Optional Google-hosted fonts are external network requests and may fall back to Arial/monospace. Self-host fonts if deployment policy requires no third-party requests.

## Release 1.1.0 follow-up — 2026-10-08

The original dependency findings above remain open: **13 affected packages, 6 high and 7 moderate**. Production now starts with `node --no-addons --import tsx server/index.ts`, disabling native addons without spawning an unprotected child Node process. This mitigates the native bigint-buffer binding path by using the JavaScript fallback. It does not establish that all affected packages are unreachable or provide a clean audit. Build tools run under normal Node settings; do not globally force `--no-addons` for the build.

The reader validates both SDK account families: `virtualPool` / `poolConfig` and `transferHookPool` / `configWithTransferHook`, including matching config family, pool derivation and account ownership. Transfer-hook metadata is disclosed; hook behavior and extension parameters are not audited. Standard and transfer-hook-family real mainnet examples were verified. Future account formats and every possible pool state are not guaranteed.

Recommendation exports now retain the complete report, including schema, network, timestamp, slot, raw read context and synthetic marker. Browser request cancellation and generation checks prevent a stale live response from replacing a later mode/input choice. PNG cards include all finding counts, and unknown-extension summaries consistently describe uncertainty.

API controls include a hard cap of 5,000 expiring IP buckets, 8 active reader jobs, shared pending reads, a 20-second bounded cache, a 50-second inspection deadline and propagation of client cancellation to upstream fetch. An unresolved underlying job retains its concurrency slot, preventing timeout from silently allowing unbounded work. CSP restricts scripts to the same origin; submission copy buttons use a separate static script.

Validation: **33 passing tests** across assessment math, encoded RPC fixtures, reader decoding/ownership/PDA/extension/fallback paths, timeouts/cancellation, API validation/cache/rate bounds and frontend export/request helpers. TypeScript and production build pass. These tests improve regression evidence; they do not replace a penetration test, independent chain verification or an asset audit.
