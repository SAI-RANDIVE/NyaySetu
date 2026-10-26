# NyaySetu — project context

The whole project on one page: what it is, why it exists, how it is built,
where everything lives, how it is deployed and tested, and what is left to do.
Read this first; every other document is linked from here.

---

## 1. In one paragraph

NyaySetu (न्यायसेतु, "bridge of justice") is an **integrity layer for the
criminal justice system**. Each piece of evidence is fingerprinted (SHA-256) on
the device that captures it, before upload, and the fingerprint is anchored on
a public blockchain. Physical exhibits are bound to the serial of their
tamper-evident seal. Every hand-over — malkhana, forensic laboratory,
prosecution, court — must match the fingerprint or the seal, and a mismatch is
refused and written to the ledger permanently. Anyone, including the accused,
can verify a file from a public page without an account and without paying.
Summons acknowledgement and bail check-ins are recorded the same way. Personal
data never goes on the ledger.

| | |
|---|---|
| Live system | https://nyaysetu-project.vercel.app |
| Public pages | `/` · `/verify` · `/case-study` · `/transparency` · `/handbook` · `/about` |
| API health | https://nyaysetu-project.vercel.app/api/health |
| Source | https://github.com/SAI-RANDIVE/NyaySetu |
| Developer | Sai Randive |
| Version | 2.1 (October 2026) |

---

## 2. The problem, and the case that shows it

Three facts in a criminal case are routinely settled by somebody's word:
whether the exhibit in court is the one collected, whether a summons was
served, and whether bail conditions are being kept.

**Pune, May 2024.** In a crash in Kalyani Nagar that killed two people, the
minor driver's blood sample was allegedly swapped inside Sassoon General
Hospital with another person's blood (DNA later matched it to his mother). It
came to light only because police, acting on information, drew a second sample
at the District Hospital, Aundh, and compared DNA days later. Two doctors and a
hospital staff member were arrested; nine people were held by August 2024; the
matter is before the court. NyaySetu's answer: the seal serial is bound to the
exhibit at collection, so the substitute vial — which must carry a different
seal — is refused at the first hand-over, the same day, without DNA. The
interactive replay is at `/case-study`
(`frontend/src/pages/CaseStudy.tsx`); it names nobody and labels the
NyaySetu-side times as illustrative.

**Why now.**
- **BNSS §105:** audio-video recording of search and seizure.
- **BNSS §176(3):** forensic attendance and recording at scenes of offences punishable with 7+ years.
- **BSA §63:** certificate stating the hash value of electronic records.
- **Pune Bar Association v. Union of India** (Supreme Court, 22 May 2026, 2026 SCC OnLine SC 1297): upheld §63(4). The Court called a hash value "synonymous with an electronic fingerprint".
- **Commentary on Madhya Pradesh's 2026 e-Sakshya rules** (LiveLaw, 11 Aug 2026): an accused who doubts a hash must pay to have it examined, on infrastructure the court does not control. NyaySetu's verification is public and free.
- **Pendency:** Maharashtra's district courts carry more than fifty lakh pending cases (NJDG).

Sources are listed on `/case-study` and in `docs/submission/01_PROJECT_CATALOGUE_REPORT.md` §20.

---

## 3. What it does

| Module | Contract | Does |
|---|---|---|
| SaakshyaSetu (evidence) | `EvidenceChain.sol` | Capture with fingerprint before upload, offline queue, seizure memos, digital malkhana, custody transfer with re-hash, laboratory intake, forensic reports with versioned corrections, integrity alerts |
| Physical exhibits (2.1) | via `EvidenceChain` document anchors | Seal serial bound once by the seizing officer (salted digest on chain); every receiving party reads the serial; mismatch → refused, anchored, `SEAL_MISMATCH` alert |
| SammansSetu (summons) | `SummonsChain.sol` | Issue with a 72-hour window; acknowledgement by one-time code with time, coordinates, device |
| JaminSetu (bail) | `BailChain.sol` | Conditions as code; geo-fenced check-ins decided by the contract; ranked compliance; map for the judge |
| Public services | — | Integrity Passport per item (QR, PDF); verify by file without a reference (`POST /api/public/lookup`); transparency page with live counts, transactions and measured gas; tamper lab; case replay; handbook |
| Documents | — | BSA §63 certificate (Parts A and B) and custody record with QR codes; seizure memo; final report |
| Inclusion | — | English, हिन्दी, मराठी; read-aloud; large text; light/dark; installable PWA |
| Governance | — | Invitation-only accounts, password + emailed code, revocable server-side sessions, per-case assignment, defence access requests, two-person approvals, full audit |

Seven roles: police, forensic laboratory, prosecutor, judge, defence lawyer,
accused, court registry (administrator).

---

## 4. Architecture

```
Browser / phone (React, Vite, PWA · Expo app)  — SHA-256 before upload
        │ HTTPS, session cookie + CSRF
API (Node 22, Express 5, TypeScript strict, Zod)
  ├─ PostgreSQL on Supabase — 14 migrations, RLS on every table, audit triggers
  ├─ IPFS via Pinata — AES-256-GCM ciphertext only
  ├─ Flask + scikit-learn — anomaly screening, bail risk, delay (advisory)
  └─ Ethereum Sepolia — EvidenceChain, SummonsChain, BailChain (verified)
Background worker (indexer + scheduler) — Vercel daemon
```

The ledger holds only what must be impossible to revise; everything readable
is in PostgreSQL; an indexer reconciles them, and where they disagree the
ledger wins and the disagreement is shown.

### Repository map

| Path | What |
|---|---|
| `contracts/` | Solidity contracts, Hardhat tests (53), `scripts/deploy.ts`, `scripts/gasReport.ts` (`npm run gas`) |
| `backend/src/routes/` | HTTP routes (`public.ts` has stats, lookup, passport; `evidence.ts` has seal routes) |
| `backend/src/services/` | Business logic: `evidence`, `capture`, `lab`, `seal`, `police`, `court`, `bail`, `transparency`, `certificate`, `passport/` |
| `backend/src/lib/` | Chain bridge (`chain.ts`), Supabase client and schema probes, PDF templates (`pdf/`), crypto, chunk store |
| `backend/test/` | 121 API tests over real HTTP against an in-memory database and a fake chain |
| `backend/src/scripts/` | `bootstrapAdmin`, `flowCheck` (`npm run flow:check`, `npm run demo:data` with `--keep`), checks |
| `database/migrations/` | `001`–`014`; `upgrade_2_0.sql` bundles 008–014 for one-paste upgrades |
| `frontend/src/pages/` | Public pages (`Landing`, `CaseStudy`, `Transparency`, `Verify`, `Handbook`, `About`, `Login`) and role portals |
| `frontend/src/components/` | `SiteChrome` (public header/footer, dark variant), `PortalShell`, `cinematic` (hash rain, live fingerprint), `workflowPanels` (seal card, intake), `BailMap` |
| `frontend/scripts/` | `uiSmoke.mjs` (44 pages, axe), `exportDocs.mjs` (PDFs), bundle-secret and animation checks |
| `ai-service/` | Flask models, trained at build |
| `mobile/` | Expo field app with offline queue |
| `docs/` | Guides (below) and `docs/submission/` |

---

## 5. Data model highlights

- `cases`, `evidence_items` (`file_hash`, `anchored_digest`, `public_ref`, `current_stage` SCENE → FORENSIC_LAB → PROSECUTOR → COURT)
- `anchors` with six verification states (`docs/VERIFICATION_STATES.md`), `chain_tx` with `gas_used`
- `custody_events`, `integrity_checks`, `lab_intakes`, `seizures`, `seizure_items`, `malkhana_movements`, `forensic_reports`
- `exhibit_seals`, `seal_checks` (migration 014)
- `summons`, `bail_orders`, `checkins`, `violations`, `discrepancy_alerts`, `action_log`, `users`, `sessions`

---

## 6. Deployment

- **Vercel, one project, Services** (`vercel.json`): `frontend` public at `/`,
  `backend` public at `/api/*`, `ai-service` internal via a binding
  (`AI_SERVICE_URL`), and a `worker` daemon (`backend/Dockerfile.worker`) for the
  indexer and scheduler. Region `sin1`. Pushing to `main` deploys.
- **Supabase** project `cikkrrxhtlaollyqpwyi` (ap-southeast-1): PostgreSQL and the
  private `upload-staging` bucket.
- **Contracts on Sepolia**, deployed from `0xD6A04b94261841302960A9a8A049339351FC496F`:
  - EvidenceChain `0x383d996De8cd2a19aCC8d66CdEa2F4A3b1E7F6D4`
  - SummonsChain `0x18f8D239653A5542d0cBfA8d13c30E46F3c18232`
  - BailChain `0x90e8B17CB82848ad0fE64Eb217c495cb91E8F946`

  The deployment is mirrored into `backend/src/deployed/sepolia.json` (`npm run deployment:sync`).
- **Email:** Brevo SMTP.
- **Env files:** `backend/.env`, `frontend/.env`, `contracts/.env`,
  `ai-service/.env` and `.env.hosting` (all-in-one, for hosts). All are
  git-ignored; only `*.example` files are committed. Key guide:
  `docs/api-keys.md`. Hosting guide: `docs/hosting.md`. Production checklist:
  `docs/production.md`.

---

## 7. Running and checking

```bash
npm run local                         # chain + in-memory DB + API + web, no accounts needed
npm --prefix backend test             # 121 API tests
npm run contracts:test                # 53 contract tests
npm --prefix mobile test              # 9 offline-queue tests
npm --prefix backend run db:validate  # applies all migrations to a scratch Postgres
npm run db:bundle:check               # upgrade bundle matches migrations
npm run deployment:check              # backend copy of contract addresses matches
npm --prefix frontend run build
node frontend/scripts/uiSmoke.mjs --base=http://localhost:5173   # 44 pages, add --mobile / --lang=mr
npm --prefix contracts run gas        # measured gas per operation
npm --prefix backend run metrics      # tamper detection, access control, sync under faults
npm --prefix frontend run docs:pdf    # regenerate docs/submission/pdf
npm run demo:data -- <admin-email> <admin-password>   # full lifecycle, left in place (needs the API's own database)
```

Measured: 100% of one-byte changes detected (200 files); 100% of 258
unauthorised reads blocked; 0 items lost with 35% of chain writes failing.
Gas: register 3,60,093; custody transfer 1,56,407; summons 2,40,107;
acknowledgement 1,31,376; bail conditions 2,76,884; check-in 2,35,892.

---

## 8. Critiques, and the answers built into the product

| Critique | Answer |
|---|---|
| Hashes only work for files; most evidence is physical | Seal serial binding (migration 014, `seal.service.ts`) |
| Why blockchain, not an audited database? | The database owner is the party whose conduct may be questioned; the ledger is controlled by no party in the case |
| e-Sakshya already exists | Complementary: anchor e-Sakshya recordings and follow them through malkhana, lab, court; plus summons and bail |
| Verifying a hash costs the accused money | Public `/verify` page and lookup API, free |
| Privacy on a public chain | Only salted fingerprints; files encrypted off chain; DPDP-compatible split; bail coordinates are the stated exception |
| Tampering before capture | Cannot be proven by any system; capture at the scene with GPS accuracy, device time, mocked-location flags and a collection clip narrows it |
| Admissibility | §63 certificate generated from the record with QR; ledger supports, does not replace it |
| Scale and cost | Measured gas; permissioned EVM ledger run by State institutions has no gas fees |

The full list is in `docs/submission/05_EVALUATION_QUESTIONS.md` and on the
home page ("Hard questions").

---

## 9. Documents

| Document | For |
|---|---|
| `README.md` | Setup, run, architecture in depth |
| `docs/submission/` | Catalogue report, problem statement, presentation, demo script, evaluation questions; PDFs in `pdf/` |
| `docs/DEMO.md`, `docs/demo-kit/` | Running a demonstration; two images that differ in one pixel |
| `docs/TESTING.md` | Every check and a walkthrough per role |
| `docs/SECURITY.md`, `docs/DECISIONS.md`, `docs/VERIFICATION_STATES.md` | Security model, design decisions (D-01…), anchor states |
| `docs/INTEGRATION.md` | CCTNS / ICJS / e-Courts design (not connected) |
| `docs/JAN_SAHAYAK.md` | Plain-language help and translation review |
| `docs/hosting.md`, `docs/production.md`, `docs/api-keys.md` | Deploying, hardening, credentials |
| `docs/metrics/METRICS.md`, `docs/samples/` | Measured results; sample PDFs |

---

## 10. Status

**Done:** everything in §3, deployed on Vercel. Health: database, chain, IPFS and AI are all reachable.

**Needs the owner's action:**
1. **Apply migration 014 to production.** Paste `database/migrations/014_exhibit_seals.sql` into the Supabase SQL Editor, or run `database/upgrade_2_0.sql`. It is additive and idempotent. Until then laboratory intake works exactly as before, and binding a seal answers `SCHEMA_OUT_OF_DATE`.
2. **Fix login-code email.** Brevo accepts the mail but codes don't arrive: verify the sender address in Brevo and turn off IP blocking.
3. **Rotate the secrets** that were shared in plain text during development: wallet key, database password, SMTP and API keys.
4. **Delete the unused Render deployment.**
5. **Decide on the name.** The Department of Justice runs a "Nyaya Setu" WhatsApp chatbot (different purpose).
6. **Optionally fill production with a full record:** `FLOW_BASE_URL=https://nyaysetu-project.vercel.app npm run demo:data -- …`. This writes to production and spends test ETH.

**Known limits:** citizen one-time codes use a sandbox provider; Hindi and
Marathi need native review; the ledger is a testnet; bail check-in coordinates
are on chain; no user study has been run yet.

---

## 11. Conventions

- Commits carry no co-author or tool attribution, and project files do not
  describe how they were produced.
- Project files describe the project only: no event- or audience-specific
  wording.
- Secrets live only in git-ignored `.env` files and the host's environment;
  staged changes are scanned before every commit.
- Every claim in the interface and the documents must be true of the code or
  cited to a source; limits are stated, not hidden.
