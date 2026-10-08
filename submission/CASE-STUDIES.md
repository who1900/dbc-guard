# DBC Guard: two real launch-condition examples

These are point-in-time product demonstrations, not customer testimonials, investment recommendations or allegations against token creators. Both reports were fetched read-only from the public inspection API on 8 October 2026. `synthetic: false`; mainnet-beta. Account reads are confirmed sequential reads, not an atomic snapshot. Re-run the reports and download their JSON before using them in a live demonstration.

## 1. A migrated launch with liquid migration allocation

[Open report](https://dbc.whoim.space/?pool=8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW&network=mainnet-beta) · [Read live API](https://dbc.whoim.space/api/inspect?address=8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW&network=mainnet-beta)

- Pool: `8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW`
- Token mint: `931NgLkiECQFwWMPZXDaVsz8443qPkrG33Bt4uaBn4tP`
- Configuration: `3mDSxat7hMmhQ41wQEyJJdufhN7j2Kd6oeNWEn8jfZF2`
- Report timestamp: **2026-10-08T18:20:04.579Z**; pool slot **454623074**.
- State: **Migrated → DAMM v2**. Eight checks had available evidence; six pass, one risk, one caution under the rules in that build.

**What the user learns:** disabled minting and no freeze authority do not answer how launch liquidity was allocated. The liquidity evidence shows `permanentPercent: 0`, `vestingPercent: 11`, `configuredLiquidAllocationPercent: 89`. The SDK's migration-time estimate is `unlockedPercent: 89.01`. The creator-allocation check also exposes `configuredLeftoverEstimatePercent: 90` and explicitly states that this is not the actual claimable balance.

**Useful next question:** who received the migration positions, what vesting terms applied and what happened to those positions after migration? The report directs the reader to those questions instead of treating two green authority checks as a complete answer.

**What this does not establish:** that 89.01% can be withdrawn now, that a withdrawal occurred, that the leftover receiver currently owns 90% of circulating tokens, or that a creator acted dishonestly. Current DAMM positions, holders and actual leftover claims are not verified by these launch checks. The fee ceiling of 0.25% is historical DBC configuration, not a quote for a current DAMM trade.

Demo line: “Minting is disabled, but the launch terms still deserve review. This report surfaces a large liquid allocation at migration and tells us exactly what needs a separate current-state check.”

## 2. An active launch where token transfers need separate review

[Open report](https://dbc.whoim.space/?pool=BPsd85Aa4RZors38wanFbZauijj62Tfgx6VTtobzBqL8&network=mainnet-beta) · [Read live API](https://dbc.whoim.space/api/inspect?address=BPsd85Aa4RZors38wanFbZauijj62Tfgx6VTtobzBqL8&network=mainnet-beta)

- Pool: `BPsd85Aa4RZors38wanFbZauijj62Tfgx6VTtobzBqL8`
- Token mint: `Hn5frpDqoP3rnE22FLvs9DMnyGX2DKqyRm8zJq8oRkUo`
- Configuration: `4XT5BUnKaAkWQBGHk6S6BzAaMH86iXErDLGddaUHSz6s`
- Report timestamp: **2026-10-08T18:20:07.068Z**; pool slot **454623084**.
- State: **Bonding curve active → DAMM v2**; reserve progress **0.05%** at the sampled read. This is not a graduation forecast. Eight checks had available evidence; six pass and two cautions under the rules in that build.

**What the user learns:** the launch config assigns 100% permanent liquidity locking at migration, yet a separate question remains about token transfer behaviour. The extension evidence includes `TransferHook`, with configured program `GJNNiYN58Lr17Ta7xex3TfBB7vkbkvehpz4xEeXvHCLx`. DBC Guard explicitly reports that the hook program's executable status and behaviour have not been audited. The second caution is a nonzero configured leftover estimate below 0.01%, not a measured current holding.

**Useful next question:** what does the transfer-hook program actually permit or require? Review that program independently before relying on ordinary transfer assumptions. Configured liquidity locking and transfer behaviour answer different questions.

**What this does not establish:** that funds are already locked in a migrated pool, that the hook is malicious, that a buy/sell will succeed or fail, or that the quoted fee ceiling is the execution price of a trade. Current holder concentration, linked wallets and quote-token policy are outside these checks.

Demo line: “A launch can have a fully locked migration allocation and still need a transfer-behaviour review. This report makes those two questions visible instead of collapsing them into a safety score.”

## Evidence versus traction

These two cases show different useful interpretations of real reports. The separate 100-pool runtime sample described in [README](../README.md#release-120-verification) demonstrates sampled inspection compatibility. Neither is evidence of 100 customers, prevented losses, user retention or market demand. See [USER-VALIDATION.md](USER-VALIDATION.md) for the proposed research needed to test those claims.
