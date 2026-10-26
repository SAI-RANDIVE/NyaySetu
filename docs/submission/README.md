# Project documents

The documents that describe NyaySetu as a whole: what problem it addresses, how
it works, how it is deployed, and the evidence that it works. Each is written to
be read on its own. PDF copies are in [`pdf/`](pdf/).

| # | Document | What it is for |
|---|---|---|
| 01 | [Project catalogue report](01_PROJECT_CATALOGUE_REPORT.md) | The complete description: problem, existing systems and the gap, solution, novelty, architecture, modules, workflow, legal alignment, security, AI, inclusion, quality, deployment, feasibility and measured cost, impact, roadmap, limitations, references |
| 02 | [Problem statement](02_PROBLEM_STATEMENT.md) | The state-specific problem on one page |
| 03 | [Presentation](03_PRESENTATION_DECK.md) | Seven slides with speaker notes |
| 04 | [Demonstration video script](04_DEMO_VIDEO_SCRIPT.md) | A shot list of about four and a half minutes on the live system |
| 05 | [Evaluation questions](05_EVALUATION_QUESTIONS.md) | Thirty likely questions, each with a short answer and what to show on the live system |

## Supporting material elsewhere in the repository

| Material | Location |
|---|---|
| Sample generated PDFs (§63 certificate, seizure memo, custody record, passport, final report) | [`docs/samples/`](../samples/) |
| Two images that differ in one pixel, for demonstrating tamper detection | [`docs/demo-kit/`](../demo-kit/README.md) |
| Measured results and how they were measured | [`docs/metrics/METRICS.md`](../metrics/METRICS.md) |
| Security review | [`docs/SECURITY.md`](../SECURITY.md) |
| Integration design for CCTNS, ICJS and e-Courts | [`docs/INTEGRATION.md`](../INTEGRATION.md) |
| Hosting and deployment | [`docs/hosting.md`](../hosting.md), [`docs/production.md`](../production.md) |
| Testing guide | [`docs/TESTING.md`](../TESTING.md) |

## Reproducing the figures

```bash
npm run contracts:test                  # 53 contract tests
npm --prefix contracts run gas          # gas used per operation (the cost table)
npm --prefix backend test               # 121 API tests
npm --prefix backend run metrics        # tamper detection, access control, sync
npm --prefix frontend run docs:pdf      # regenerate the PDFs in pdf/
```
