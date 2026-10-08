# DBC Guard: user validation protocol

Status: prepared, not conducted. No interview, repeat-user or pilot results are claimed. The existing 100-pool inspection sample validates sampled execution paths, not demand.

## Questions to answer

- Does a buyer discover an important launch condition they would otherwise miss?
- Can a creator use the report to explain launch terms without implying certification?
- Would a launchpad put this explanation where users already discover tokens?

Anyone can use the product; recruit by task rather than treating everyone as one persona. Proposed first cohort: six token buyers, two launch creators and two launchpad/community operators. Include five mobile sessions. These are recruitment targets, not existing users.

## Five-minute unassisted session

Ask permission to take anonymous notes. Do not request wallet connections, holdings, personal information or trades. Use a participant code, role and device. Never ask participants to buy a token.

1. **0:00–0:30 — Context.** “Think of the last Solana token launch you looked at. What did you check before deciding what to do? Where did you look?” Do not introduce our feature list.
2. **0:30–2:00 — Task.** Open https://dbc.whoim.space. Give the first case-study address and say: “Find one launch condition you would investigate before making a decision. Explain what it means and show the evidence.” Do not coach. Record completion time, errors and assistance separately.
3. **2:00–3:00 — Comprehension.** “What does 8/8 checks completed mean? Does it mean the token is safe? Is this report showing the original launch conditions or the current liquidity position? What is still unknown?” If an older build shows 100% coverage, ask the same question about that label.
4. **3:00–4:00 — Transfer.** Give the second case-study address. “What changes your next question here? Share the report with me.” Record whether the participant notices the transfer hook and avoids equating configured liquidity locks with complete safety.
5. **4:00–5:00 — Value.** “What would you do next? What would you use instead? When would you use this again?” Only then ask whether they want a voluntary follow-up. Do not count a polite yes as repeat use.

After the unassisted portion, explain any misinterpretations. A migrated pool's liquidity allocation describes launch/migration terms, not verified current DAMM ownership or withdrawals. A transfer hook is a reason for further review, not proof of abuse.

## Scorecard and decision rules

| Metric | Record | Proposed threshold, not a result |
| --- | --- | --- |
| First meaningful finding | Seconds to finding + correct explanation + evidence | At least 8/10 within 90 seconds without help |
| Coverage comprehension | Correctly says completed checks are not a safety percentage | At least 9/10 |
| Historical/current distinction | Correctly identifies what is and is not checked after migration | At least 9/10 |
| Share task | Recipient can reach the intended report; record extra clicks | At least 8/10 without help |
| Repeat use | Voluntary second distinct real inspection within seven days, reported with consent | Target 5/10; intention does not count |
| Integration demand | Operator identifies a concrete placement and agrees to a scoped test | Target one pilot; a discussion does not count |

Ten sessions can reveal usability failures; they do not establish market size or statistically prove demand. Any repeated “safe token” interpretation triggers a copy/layout fix before expansion. If findings are understood but users do not return, test launchpad/community distribution rather than adding unrelated checks.

Copyable session log (blank):

```text
Participant code / role / device / consent:
Task date UTC / app version:
First-finding seconds / completed unassisted? / errors:
Finding explained / evidence opened:
Coverage answer / historical-vs-current answer:
Second-case interpretation / share task:
What they use today / next intended action:
Anonymous quote (permission granted?):
Voluntary follow-up permission / actual repeat date:
```

Store consented research notes privately, not in this public repository. Do not publish identifying quotes or addresses provided by participants without permission. No automatic analytics is installed or implied by this protocol.

## Recruitment draft — not sent

For relevant Telegram/Discord communities, subject to moderator permission:

> I’m testing DBC Guard, a free tool that explains Meteora token-launch conditions without connecting a wallet. I’m looking for people who inspect Solana launches, create launches or run launchpad communities. Could you try two five-minute tasks and tell me what is confusing or useful? This is usability research, not a trading recommendation or token promotion. No funds, wallet connection or personal information are needed. Product: https://dbc.whoim.space

No X account is required. Contacting communities, recruiting people or sending messages requires the owner's separate approval; nothing has been sent.

## Launchpad pilot proposal — not an existing integration

Offer a two-week, opt-in experiment: place an “Understand this launch” link beside one Meteora DBC token listing, opening its report in DBC Guard. Start with a plain link, not an unbuilt widget. Agree on wording, supported addresses, a removal option and consented aggregate measurement before rollout. Do not describe the link as “certified safe.”

Pilot questions: do visitors open it, can five volunteers explain a finding, does it reduce repeated launch-terms questions, and does the operator want to keep it? Compare with a prior period only if comparable records actually exist. A future embedded widget/API package is a follow-on proposal, not a shipped integration. One operator must agree before any pilot/adoption claim can be made.
