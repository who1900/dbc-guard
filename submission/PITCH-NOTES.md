# DBC Guard — presentation notes

English speaking notes for the nine-slide product deck. Suggested duration: three minutes.

## 1. Understand a Meteora launch before you trade

DBC Guard helps people understand a Meteora token launch before their first trade. Give it a token or pool address, and it brings fees, token controls and liquidity arrangements into one clear review.

## 2. You found the token. Now understand the launch

Finding a token is only the beginning. People also want to know who controls it, which fees apply and what happens to liquidity. Those are the questions DBC Guard is built to answer.

## 3. One address. A clearer picture

This is the working product. Paste an address, open the report and explore eight checks. The findings stay close to their evidence, so people can understand what they are looking at and share the report with others.

## 4. Understand what shapes the launch

The review brings together the choices that shape a launch: token controls, trading fees, creator allocations, liquidity commitments and launch progress. Instead of working through separate records, people get a readable starting point for their research.

## 5. Why Meteora

Meteora gives creators flexibility in how they launch tokens. That flexibility is useful to participants when they can understand the choices behind it. DBC Guard makes those choices more accessible to people exploring the Meteora ecosystem.

## 6. A focused view of the launch

People already use tools for token risk, market charts and blockchain records. DBC Guard adds a focused view of Meteora launch settings and what those choices mean. It fits alongside the tools people already use for research.

## 7. Live. Tested. Ready to explore

DBC Guard is available today on desktop and mobile, without an account or connected wallet. The product has been validated across 100 real Meteora DBC pools. That is working-product validation, rather than a count of customers.

## 8. Daniyar Gabdullin

I am Daniyar Gabdullin, a product builder working across blockchain and AI. I have been building in crypto since 2019 and created Seeker Vault and X-Booster. My background combines information-security education at Kazakh National Technical University with technical leadership experience.

## 9. Know the launch. Share the findings

Try DBC Guard at dbc.whoim.space. Paste a token, review the launch and share the findings. The product is live, and the project is open on GitHub.

## Navigation and rebuilding

- Editable PowerPoint: `output/presentation/dbc-guard-pitch.pptx` and `public/submission/dbc-guard-pitch.pptx`.
- PDF exported from that actual PowerPoint file: `output/presentation/dbc-guard-pitch.pdf`, `output/pdf/dbc-guard-pitch.pdf` and `public/submission/dbc-guard-pitch.pdf`.
- Both formats have nine uniform 16:9 pages. PowerPoint text and shapes are native and editable; genuine product screenshots are embedded images. Speaker notes are embedded per slide.
- Rebuild both formats: `python scripts/build-pitch.py` on Windows with native Microsoft PowerPoint installed.
- Generate only editable PowerPoint: `python scripts/build-pitch.py --pptx-only`.
- Export native Office slide previews too: `python scripts/build-pitch.py --render-slides`.
- Requirements: Python, Node.js, preinstalled `pptxgenjs` and `sharp`; optional environment overrides `PITCH_NODE` and `PITCH_MODULES` (directory containing those modules). No application dependencies are changed.
- Native PowerPoint uses Arial and Courier New for dependable editing and rendering on Office installations.
- Edit `scripts/build-pitch-pptx.cjs`, then rebuild. The canonical build no longer produces HTML or prints a webpage to PDF. Previous HTML files are legacy artifacts, not the presentation deliverable.
