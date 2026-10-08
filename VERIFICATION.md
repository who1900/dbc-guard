# Verification record — 2026-10-08

- `npm test`: 14/14 meaningful regression tests passed. Cases include fee denominator, dynamic fee cap, rate limiter, six LP buckets, exactly50% LP rounding regression, terminal curve sentinel, graduation vs migration flag, unknown extensions, leftovers, authority risks, malformed account/address input, decimal BN export and oversized RPC response.
- `npm run build`: TypeScript strict check and Vite production bundle succeeded.
- Independent API smoke: `/api/health` 200, malformed address400, system-owned account422, real mainnet DBC pool200.
- Independent browser smoke on installed Chrome: desktop1440 and mobile390 rendered eight synthetic-demo checks without horizontal overflow or page errors; PNG download successful. Live mainnet report, JSON download, evidence expansion, share clipboard and invalid-input error exercised.
- Live pool tested: `8f6Zje37mKD3q1F46RqSo3thrPsScRQ9XLGNcsxzNSQW`, config `3mDSxat7hMmhQ41wQEyJJdufhN7j2Kd6oeNWEn8jfZF2`. Actual account state can change. Observed creator LP allocation89% plus11%vesting, DBC configured fee25bps, threshold11.53SOL; pool migrated during development. This is evidence the tool reads real state, not a statement about that asset.
- `npm audit --omit=dev`: 13 affected production dependency packages,6high/7moderate; see SECURITY.md. No incompatible force upgrades.

Regression fixtures are synthetic; browser live check is separate real RPC evidence. Docker image runtime and public hosting are not claimed verified by this record. Dedicated RPC/HTTPS configuration and dependency risk review remain deployment operations.
