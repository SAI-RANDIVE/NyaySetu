# Evaluation metrics

Measured 2026-10-29 with `npm run metrics` (backend), 200 items for tamper detection and 100 for sync, against the in-memory database and the simulated chain. Re-run to reproduce; the numbers below are copied from `metrics.csv`.

| Metric | Value | Unit |
|---|---|---|
| items registered | 200 | count |
| tampered files detected (one byte changed) | 100.00 | % |
| genuine files confirmed (false alarms = 100 - this) | 100.00 | % |
| public check latency p50 (in process) | 1.7 | ms |
| public check latency p95 (in process) | 3.5 | ms |
| unauthorized read attempts | 258 | count |
| unauthorized read attempts blocked | 100.00 | % |
| sync items | 100 | count |
| sends failed by injection (RPC down) | 28 | count |
| confirmed on first attempt | 72.00 | % |
| confirmed after one retry pass | 100.00 | % |
| items lost | 0 | count |
| SHA-256 throughput, 1 MB file | 775 | MB/s |
| SHA-256 throughput, 10 MB file | 762 | MB/s |
| SHA-256 throughput, 50 MB file | 790 | MB/s |
| verify by file, no reference (in process) p50 | 1.5 | ms |
| verify by file, no reference (in process) p95 | 5.1 | ms |
| custody record PDF generation p50 | 90.8 | ms |
| custody record PDF generation p95 | 208.3 | ms |
| public passport PDF generation p50 | 71.2 | ms |
| public passport PDF generation p95 | 88.0 | ms |
| final report draft PDF generation p50 | 850.3 | ms |
| final report draft PDF generation p95 | 1003.1 | ms |
| document readiness check (whole case) p50 | 8.4 | ms |
| document readiness check (whole case) p95 | 17.3 | ms |
| custody transfer with re-check (simulated chain) p50 | 4.0 | ms |
| custody transfer with re-check (simulated chain) p95 | 7.8 | ms |
| custody transfers failed | 0 | count |
| environment: CPU | Intel(R) Core(TM) Ultra 5 125U × 14 |  |
| environment: memory | 15.4 | GB |
| environment: runtime | Node v24.8.0 on win32 x64 |  |

## How each is measured

- **Tamper detection:** every registered file is checked on the public verification endpoint twice: as registered, and with one random byte changed. A changed file must not match; the original must.
- **Latency:** wall time of the public check inside one process. It excludes network, database and RPC latency, so it measures the application's own cost only. Against a local Hardhat node the full round trip measured 161–325 ms; a public testnet adds its RPC provider's latency.
- **Unauthorized access:** users of six roles, none assigned to the case, request the case, its FIR and up to ten items' detail, manifest, passport and download. Blocked means 401, 403 or 404. (The court registry sees every case by design and is excluded.)
- **Performance:** in-process wall time of each operation, repeated, reported as median (p50) and 95th percentile; SHA-256 throughput is Node's native implementation on the machine listed. Document generation includes the API round trip inside one process. Custody transfers run against the simulated chain, so they exclude block confirmation time; on Sepolia, confirmation adds roughly one to two block times (12 to 24 seconds).
- **Sync:** 30% of sends fail at random with an RPC outage. Items are never lost; failed ones are retried once, as the officer's retry button or the tracker would.

## Limits

- The chain is simulated, so these numbers say whether the application logic is right, not how a public network behaves under load.
- SHA-256 detecting a one-byte change is expected; the measurement confirms the system compares the right values end to end, not the strength of the hash.
- No user study has been run yet; the pilot plan is in `docs/submission/01_PROJECT_CATALOGUE_REPORT.md`.
