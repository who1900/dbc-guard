# Verification record — 2026-10-08

The initial record below is retained as historical evidence. Release 1.1.0 verification is appended at the end.

- `npm test`: 14/14 meaningful regression tests passed. Cases include fee denominator, dynamic fee cap, rate limiter, six LP buckets, exactly50% LP rounding regression, terminal curve sentinel, graduation vs migration flag, unknown extensions, leftovers, authority risks, malformed account/address input, decimal BN export and oversized RPC response.
- `npm run build`: TypeScript strict check and Vite production bundle succeeded.
- Independent API smoke: `/api/health` 200, malformed address400, system-owned account422, real mainnet DBC pool200.
- Independent browser smoke on installed Chrome: desktop1440 and mobile390 rendered eight synthetic-demo checks without horizontal overflow or page errors; PNG download successful. Live mainnet report, JSON download, evidence expansion, share clipboard and invalid-input error exercised.
- Live pool tested: `8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW`, config `3mDSxat7hMmhQ41wQEyJJdufhN7j2Kd6oeNWEn8jfZF2`. Actual account state can change. Observed creator LP allocation89% plus11%vesting, DBC configured fee25bps, threshold11.53SOL; pool migrated during development. This is evidence the tool reads real state, not a statement about that asset.
- `npm audit --omit=dev`: 13 affected production dependency packages,6high/7moderate; see SECURITY.md. No incompatible force upgrades.

Regression fixtures are synthetic; browser live check is separate real RPC evidence. Docker image runtime and public hosting are not claimed verified by this record. Dedicated RPC/HTTPS configuration and dependency risk review remain deployment operations.

## Release 1.1.0 follow-up

- Parent independently verified 33/33 tests and the normal TypeScript/Vite build.
- Local production startup with `node --no-addons --import tsx server/index.ts` successfully inspected six real mainnet pools: HTTP 200, 8 checks, 100% available-check coverage and synthetic=false. Cases included active/migrated pools, Token-2022 and transfer-hook-family pool `BPsd85Aa4RZors38wanFbZauijj62Tfgx6VTtobzBqL8`.
- Independent Chrome QA verified real-example onboarding, full report provenance in recommendation JSON, readable PNG risk/caution/unknown counts, separate synthetic demo and worksheet copy buttons under strict CSP. No JavaScript errors were observed.
- A deliberately delayed genuine live response did not replace a subsequently selected synthetic demo. Mobile viewport 390px showed no horizontal overflow.
- Remote staging passed production dependency installation, direct no-addons startup and a real transfer-hook pool inspection. Public cutover subsequently succeeded.
- Dependency advisories remain: 13 affected packages, 6 high and 7 moderate. Native addons are disabled only during direct production startup; this is a mitigation, not a clean audit.
- Public HTTPS health reports release 1.1.0. Six real mainnet pool inspections returned HTTP 200, 8 checks, 100% available-check coverage and synthetic=false, including active/migrated, Token-2022 and transfer-hook-family examples.
- The dedicated service is active and enabled, with NRestarts=0 and approximately 103 MB memory at verification; its command uses direct Node startup with --no-addons and --import tsx. Previous release files were preserved for rollback.
- Final public Chrome QA confirmed the transfer-hook report: 8/8 available checks, 2 cautions, 0 risks, 0 unknown, 100% coverage and a visible hook warning. Public worksheet copy worked with current support wording; the pitch PDF returned HTTP 200 (9,467 bytes). No JavaScript errors were observed.
- Public error routes returned 400 for invalid input, 422 for a wrong-owner account, 400 for an unsupported network and 404 for an unknown API route.
- All original Nginx configuration checksums matched. Five neighboring project responses retained their baseline: one 401 and four 200 responses. Global Node.js remained 20.20.1. These are point-in-time verification results, not an uptime guarantee.
