# Security and dependency review

Read-only service; no signing, wallet connection, key storage, arbitrary RPC URL inputs, user-uploaded JSON/TOML or token metadata HTML. Fixed configured RPC endpoints, address/network allowlist, bounded responses/accounts, timeouts, concurrency limit 8, 20 inspections/IP/minute and 20-second cache. React escapes evidence strings. RPC details are not returned on infrastructure failures. API secrets stay server-side. Unknown RPC routes return JSON404.

`npm audit --omit=dev` on 2026-10-08 reported **13 affected packages: 6 high, 7 moderate** (counts include dependency propagation). Outstanding roots: `bigint-buffer` buffer overflow (GHSA-3gc7-fjrx-p6mg) via SPL Token; `toml` recursion/prototype pollution via Anchor (GHSA-82x6-q7mm-w9cf, GHSA-v5mp-jgw5-2x6j); `stream-json` resource/prototype issues and `uuid` output-buffer bounds via web3.js/Jayson. npm proposes incompatible SDK-adjacent major changes; no force-upgrade was applied.

The service does not parse user TOML or use user-supplied UUID buffers. RPC JSON uses web3.js and bounded HTTP responses; bigint/token decoding remains an upstream attack surface despite data bounds and owner checks. This is **not a clean audit or proof of unreachability**. Use trusted RPC infrastructure, keep the process isolated/non-root, monitor upstream SDK fixes, and review compatible updates before public launch. No end-to-end cryptographic chain verification is performed; RPC trust remains.

Optional Google-hosted fonts are external network requests and may fall back to Arial/monospace. Self-host fonts if deployment policy requires no third-party requests.
