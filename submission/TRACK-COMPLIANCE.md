# Meteora DBC track fit

Source: [official listing](https://superteam.fun/earn/listing/meteora-dbc/), reviewed 2026-10-08. Deadline: 2026-10-13 06:59 UTC (11:59 UTC+5). The listing includes developer tooling among its suggested directions and evaluates integration depth, execution, originality, potential impact and traction. Eligibility without Colosseum participation remains unconfirmed by the sponsor.

The [public submission validator](https://github.com/SuperteamDAO/earn/blob/main/src/features/listings/utils/submissionFormSchema.ts) accepts an empty Tweet URL; final live submission has not been tested. Project X and extra links are optional. The [hackathon page source](https://github.com/SuperteamDAO/earn/blob/main/src/pages/earn/hackathon/crypto-worlds-fair.tsx) describes side tracks as having separate processes and criteria; it does not state mandatory Colosseum participation. Answering “No” is consistent with explicit public rules, but does not prove sponsor eligibility.

| Criterion | DBC Guard evidence | Honest boundary |
| --- | --- | --- |
| Developer tooling | Read-only DBC configuration review, evidence links, JSON report, PNG card, share URL | No launchpad or transaction builder |
| Integration depth | Meteora SDK 1.5.13 decodes pool/config, derives PDA and calculates fee/vesting values; owner/layout checks precede interpretation | Standard DBC layouts only; no current DAMM position audit |
| Execution | Public HTTPS UI, mainnet/devnet selector, verified real mainnet report, mobile view, 14 automated tests and production build | Public RPC rate limits may affect availability |
| Originality | Evidence-first review combining transparent policy thresholds, coverage and historical migration context | No claim of being the first or only comparable tool |
| Potential impact | Makes launch parameters easier to review for launchpad developers and token users | A product hypothesis, not measured adoption |
| Traction | Working public deployment and verified mainnet reads | No active-user, revenue or protocol-write metrics claimed |
| Security | Non-root isolated service, bounded RPC data, fixed RPC endpoints, no wallets/signatures; public methodology and SECURITY.md | 13 affected dependency packages remain: 6 high, 7 moderate; no clean-audit claim |

The public repository exists at https://github.com/who1900/dbc-guard; no open-source license is asserted without the user's explicit license choice. Submission remains a user-reviewed action; no Tweet or video exists merely because this package exists.
