# DBC Guard

Live: [dbc.whoim.space](https://dbc.whoim.space). Deployment instructions: [deploy/README.md](deploy/README.md).

Independent, read-only Meteora Dynamic Bonding Curve inspection tool. Paste a pool address on Solana mainnet or devnet; inspect eight deterministic checks with on-chain evidence. No wallet, transactions, API key in the browser, or existing project code.

## Run

Node.js 22.12+ and npm are required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Optional `.env` based on `.env.example` configures dedicated server RPCs. Public RPCs can rate-limit requests.

```sh
npm test
npm run build
npm start
```

Production serves frontend and API at http://127.0.0.1:3001. `HOST=0.0.0.0` permits container/reverse-proxy binding. Inspect API: `GET /api/inspect?address=POOL&network=mainnet-beta` (or `devnet`). Health: `/api/health`.

Try the independently tested mainnet pool `8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW`: [live inspection](https://dbc.whoim.space/?pool=8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW&network=mainnet-beta). Click **Inspect pool** to read current state. This address is a reference example, not an endorsement; its account state may change.

## Product

Eight checks cover base-token mint/freeze authorities, extension types, DBC configured fee ceiling, migration LP distribution and vesting, creator vesting and configured leftovers, curve structure/amplification and graduation state. Report includes account links, expandable evidence, decimal raw data, downloadable JSON, review recommendations and PNG card. Share URLs preserve input/network and require a fresh inspection. Synthetic demo is labelled and never substituted for failed live reads.

Verdicts are **Known risk detected**, **Review cautions**, **Assessment incomplete**, or **No flagged issues**. None certifies safety. Coverage is available-check count, not percentage of security audited. See [METHODOLOGY.md](METHODOLOGY.md).

## Deployment preparation

Dedicated server configuration for `dbc.whoim.space` (isolated Node runtime, systemd service, Nginx HTTP/HTTPS and Certbot renewal hook): [deploy/README.md](deploy/README.md).

```sh
docker build -t dbc-guard .
docker run --rm -p 127.0.0.1:3001:3001 --env-file .env dbc-guard
```

Use HTTPS reverse proxy with a dedicated RPC before public launch. Keep `.env` out of Git/images; configure environment variables through hosting secrets. App defaults to loopback and rejects arbitrary user RPC URLs. Express trusts only loopback proxy hops; the supplied Nginx site replaces `X-Forwarded-For` with the actual client address for per-client rate limiting. Any other proxy topology requires an explicit trust policy. Set ingress request/time limits and protect `/api/inspect` with platform rate limiting for larger traffic. A domain can be added later without changing pool logic.

Production is deployed with HTTPS and a dedicated non-root systemd service. Public UI, live mainnet inspection and certificate renewal dry-run were verified on 2026-10-08. Docker commands are supplied but require a Docker engine to verify runtime. Hackathon submission remains a user action.

## Hackathon submission

Pitch: **Inspect a Meteora launch before your first trade.** DBC Guard makes launch configuration legible with transparent on-chain checks and shareable evidence. Meteora SDK 1.5.13 is central: account decoding, pool PDA derivation, fee math and liquidity vesting math.

Copy-ready fields, presentation and recording script: [submission/SUBMISSION.md](submission/SUBMISSION.md). Program: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`.

[Pitch PDF](https://dbc.whoim.space/submission/dbc-guard-pitch.pdf) · [Known audit findings](audit/AUDIT-2026-10-08.md).

## Limitations

Standard `virtualPool` / `poolConfig` layouts supported; transfer-hook-specific pool/config discriminators are rejected explicitly rather than misdecoded. Quote-token policy, extension parameter values, holder/creator identity, linked wallets and live post-migration DAMM positions/fees are not audited. Account reads are sequential confirmed snapshots. Missing mint reads reduce coverage. Configs cannot be repaired in place; recommendation export is **not** executable SDK config.

Review [SECURITY.md](SECURITY.md) before public launch, including outstanding transitive npm advisories.
