# DBC Guard

Live: [dbc.whoim.space](https://dbc.whoim.space). Deployment instructions: [deploy/README.md](deploy/README.md).

Independent, read-only Meteora Dynamic Bonding Curve inspection tool. Paste a pool or token mint address on Solana mainnet or devnet; inspect eight deterministic checks with on-chain evidence. No wallet, transactions, API key in the browser, or existing project code.

Release 1.2.0 also accepts a token mint address and resolves its DBC pool through bounded, filtered on-chain lookup. Shared DBC authority, program, wallet, configuration and token-holding addresses receive specific guidance instead of a generic retry. If multiple validated pools match, choose one explicitly. Release verification is recorded in [VERIFICATION.md](VERIFICATION.md).

## Run

Node.js 22.12+ and npm are required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Optional `.env` based on `.env.example` configures dedicated server RPCs. Public RPCs can rate-limit requests.

`MAINNET_RPC_URLS` and `DEVNET_RPC_URLS` optionally define ordered comma/newline-separated fallback lists, deduplicated and capped at four endpoints. A nonempty list replaces that network's single `*_RPC_URL`. Transient transport failures receive one retry per endpoint before fallback; invalid accounts are not retried. Individual fetches include a 12-second body timeout and 1 MiB response bound; retry operations share a 45-second deadline and caller cancellation. The HTTP inspection has an outer 50-second deadline.

Official Solana public endpoints share a process-wide 2-requests/second queue, bounded to 64 waiting requests, with cancellation and bounded Retry-After cooldown. Private endpoints are not paced by default. Operators may set `RPC_REQUESTS_PER_SECOND` to a positive value up to 100. Upstream quota exhaustion returns HTTP 429 with Retry-After and a retry action; it is not reported as invalid pool data.

```sh
npm test
npm run build
npm start
```

Production serves frontend and API at http://127.0.0.1:3001. `HOST=0.0.0.0` permits container/reverse-proxy binding. Inspect API: `GET /api/inspect?address=POOL&network=mainnet-beta` (or `devnet`). Health: `/api/health`.

Try the independently tested mainnet pool `8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW`: [live inspection](https://dbc.whoim.space/?pool=8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW&network=mainnet-beta). Click **Inspect pool** to read current state. This address is a reference example, not an endorsement; its account state may change.

Transfer-hook-family example: [BPsd85Aa4RZors38wanFbZauijj62Tfgx6VTtobzBqL8](https://dbc.whoim.space/?pool=BPsd85Aa4RZors38wanFbZauijj62Tfgx6VTtobzBqL8&network=mainnet-beta), also verified against real mainnet data. Both SDK account families are supported; this does not guarantee support for future layouts or every pool state.

## Product

Eight checks cover base-token mint/freeze authorities, extension types, DBC configured fee ceiling, migration LP distribution and vesting, creator vesting and configured leftovers, curve structure/amplification and graduation state. Report includes account links, expandable evidence, decimal raw data, downloadable JSON, review recommendations and PNG card. Share URLs preserve input/network and require a fresh inspection. Synthetic demo is labelled and never substituted for failed live reads.

Release 1.1.0 cancels stale inspections on address/network/mode changes, includes risk/caution/unknown counts in PNG cards, and preserves full report provenance in recommendation exports. The API deduplicates pending reads, bounds IP-rate buckets and cancels inspection work when the last client disconnects. Validation: 33 tests pass, including encoded-account RPC reader fixtures and API integration tests; TypeScript and production build pass.

Verdicts are **Known risk detected**, **Review cautions**, **Assessment incomplete**, or **No flagged issues**. None certifies safety. Coverage is available-check count, not percentage of security audited. See [METHODOLOGY.md](METHODOLOGY.md).

## Deployment preparation

Dedicated server configuration for `dbc.whoim.space` (isolated Node runtime, systemd service, Nginx HTTP/HTTPS and Certbot renewal hook): [deploy/README.md](deploy/README.md).

```sh
docker build -t dbc-guard .
docker run --rm -p 127.0.0.1:3001:3001 --env-file .env dbc-guard
```

Use HTTPS reverse proxy with a dedicated RPC before public launch. Keep `.env` out of Git/images; configure environment variables through hosting secrets. App defaults to loopback and rejects arbitrary user RPC URLs. Express trusts only loopback proxy hops; the supplied Nginx site replaces `X-Forwarded-For` with the actual client address for per-client rate limiting. Any other proxy topology requires an explicit trust policy. Set ingress request/time limits and protect `/api/inspect` with platform rate limiting for larger traffic. A domain can be added later without changing pool logic.

Production is deployed with HTTPS and a dedicated non-root systemd service. Public UI, live mainnet inspection and certificate renewal dry-run were verified on 2026-10-08. Docker commands are supplied but require a Docker engine to verify runtime. Hackathon submission remains a user action.

Initial public release 1.1.0 was verified over HTTPS; six real mainnet pools returned HTTP 200 with 8 checks, 100% available-check coverage and `synthetic: false`, including active/migrated, Token-2022 and transfer-hook-family examples. Subsequent release verification is recorded separately. These are point-in-time checks, not an uptime or universal pool-support guarantee.

## Hackathon submission

Pitch: **Inspect a Meteora launch before your first trade.** DBC Guard makes launch configuration legible with transparent on-chain checks and shareable evidence. Meteora SDK 1.5.13 is central: account decoding, pool PDA derivation, fee math and liquidity vesting math.

Copy-ready fields, presentation and recording script: [submission/SUBMISSION.md](submission/SUBMISSION.md). Program: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`.

[Pitch PDF](https://dbc.whoim.space/submission/dbc-guard-pitch.pdf) · [Known audit findings](audit/AUDIT-2026-10-08.md).

## Limitations

Supported account families: `virtualPool` / `poolConfig` and `transferHookPool` / `configWithTransferHook`, validated with the pinned SDK layouts. Quote-token policy, extension parameter values, holder/creator identity, linked wallets and live post-migration DAMM positions/fees are not audited. Account reads are sequential confirmed snapshots. Missing mint reads reduce coverage. Configs cannot be repaired in place; recommendation export is **not** executable SDK config.

`npm start` uses Node's `--no-addons` with direct `--import tsx`, disabling native addons as defense in depth during production inspection. The vulnerable native bigint-buffer implementation has been replaced by the independent local pure-JavaScript codec; current full and production audit report zero known advisories, as detailed below. Build with the normal Node runtime; globally disabling addons can prevent build tools from loading.

Review [SECURITY.md](SECURITY.md) for current dependency remediation, compatibility boundaries and historical findings.

## Release 1.2.0 verification

The final local suite passed 76 tests and the production build. Additional release checks are tracked in [VERIFICATION.md](VERIFICATION.md). Discovery reads the input account, then searches both supported DBC discriminators with a base-mint filter at the verified SDK offset 136 and a zero-byte account-data slice. At most eight candidate pools are considered, and each is decoded and validated by the normal reader, including matching its base mint. An indexer result is never treated as a completed assessment. If filtered lookup is temporarily unavailable, the user can retry or enter the individual pool address.

A preliminary decode sample covered 100 pool accounts, 66 configurations and eight configuration variants. The final runtime then fully inspected a separate sample of 100 unique real mainnet pools: all returned 8 checks and 100% available-check coverage, with zero errors. That sample included 99 standard and 1 transfer-hook pool, 93 DAMM v2 and 7 legacy DAMM v1 destinations. This demonstrates the sampled paths, not universal pool support. The dependency graph uses an independent pure-JavaScript bigint codec plus targeted TOML/Jayson upgrades. Independent clean installation reproduced the setup; full and production npm audit report zero known advisories. None of these checks certifies security or the inspected tokens.

- Public release 1.2.0 is verified: HTTPS health confirms the version; real SPL, Token-2022 and transfer-hook mint inputs resolve to validated reports with 8 checks and 100% available-check coverage. Shared authority/program input receives correct guidance without Retry.
- Public Chrome verified provenance JSON, PNG download, canonical pool sharing, mobile 390px, worksheet copy and the unchanged pitch PDF, with zero JavaScript errors. Original Nginx checksums and neighboring project responses remained unchanged.
