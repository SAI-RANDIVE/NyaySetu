# NyaySetu — Project Catalogue Report

**Tamper-evident evidence, summons and bail records for the criminal justice system of Maharashtra**

| Item | Detail |
|---|---|
| **Project** | NyaySetu (न्यायसेतु, "bridge of justice") |
| **Domain** | Governance and civic technology · emerging technology (blockchain, AI, GIS) · digital inclusion |
| **State focus** | Maharashtra (pilot design: Pune — Shivajinagar Police Station, Regional Forensic Science Laboratory, Sessions Court) |
| **UN Sustainable Development Goal** | SDG 16 — Peace, justice and strong institutions (targets 16.3, 16.6, 16.10) |
| **Live system** | https://nyaysetu-project.vercel.app |
| **Public pages, no sign-in** | [/verify](https://nyaysetu-project.vercel.app/verify) · [/transparency](https://nyaysetu-project.vercel.app/transparency) · [/handbook](https://nyaysetu-project.vercel.app/handbook) · [/about](https://nyaysetu-project.vercel.app/about) |
| **Smart contracts (Ethereum Sepolia, source verified)** | EvidenceChain `0x383d996De8cd2a19aCC8d66CdEa2F4A3b1E7F6D4` · SummonsChain `0x18f8D239653A5542d0cBfA8d13c30E46F3c18232` · BailChain `0x90e8B17CB82848ad0fE64Eb217c495cb91E8F946` |
| **Source code** | https://github.com/SAI-RANDIVE/NyaySetu |
| **Developed by** | Sai Randive |
| **Version** | 2.0 · October 2026 |

---

## Contents

1. Abstract
2. The problem
3. Objectives
4. What exists today, and the gap
5. The solution
6. What is new
7. Architecture
8. Modules and features
9. End-to-end workflow
10. Alignment with the new criminal laws
11. Security and privacy
12. Artificial intelligence, used carefully
13. Inclusion and accessibility
14. Quality: how it is verified
15. Deployment
16. Feasibility
17. Impact
18. Roadmap and pilot plan
19. Limitations
20. References

---

## 1. Abstract

In a criminal case, three facts are routinely settled by somebody's word: that
the evidence produced in court is the evidence that was collected, that a
summons reached the person it named, and that bail conditions are being kept.
Since 1 July 2024 the Bharatiya Nagarik Suraksha Sanhita (BNSS) and the
Bharatiya Sakshya Adhiniyam (BSA) require audio-video recording of searches and
seizures, forensic attendance at serious crime scenes, and a certificate stating
the hash value of every electronic record. Police now produce far more digital
evidence, and each item needs a chain of custody that a court — and the defence —
can rely on.

NyaySetu computes a SHA-256 fingerprint of each piece of evidence on the
officer's own device at the moment of capture, before anything is uploaded,
and anchors that fingerprint to a public blockchain. Every subsequent hand-over —
to the malkhana, the forensic laboratory, the prosecution and the court —
re-computes the fingerprint and is refused if it differs; the refusal itself is
recorded permanently. Anyone, including the accused and defence counsel, can
check a file against the ledger from a public web page without an account and
without trusting the police database. Summons acknowledgement and bail
check-ins are recorded the same way. Personal data never goes on the ledger.

The system is deployed and working: seven role portals, a public verification
service, an installable mobile web app, Marathi, Hindi and English throughout,
three verified smart contracts, 183 automated tests, and measured results
including 100% detection of one-byte tampering across 200 files and 100% of 258
unauthorised access attempts blocked.

---

## 2. The problem

### 2.1 Three questions a court should not have to take on trust

| Question asked in court | How it is answered today | Consequence |
|---|---|---|
| **Is this the evidence that was collected?** | A malkhana register and case diary record that a transfer happened, not that the item which arrived is the item which left. | Chain-of-custody challenges, adjournments, acquittals on doubt; the defence cannot independently test the prosecution's copy. |
| **Did the summons reach the person named?** | A process server's endorsement against a flat denial. | Repeated adjournments for service; non-appearance delays framing of charges. |
| **Are bail conditions being kept?** | Conditions written into an order nobody monitors until something has already gone wrong. | Breaches surface late; compliant accused have no way to show compliance. |

### 2.2 Why this matters now, and why in Maharashtra

- **New statutory duties since 1 July 2024.** BNSS §105 (recording of search and
  seizure by audio-video means), BNSS §176(3) (forensic collection and recording
  at the scene for offences punishable with seven years or more), and BSA §63
  (certificate for electronic records, including the hash value) turn recording
  and hashing into legal obligations.
- **Scale of pendency.** Maharashtra's district and taluka courts carry more than
  fifty lakh pending cases, the majority of them criminal (National Judicial Data
  Grid). Every adjournment spent disputing an exhibit or service of summons is
  time those cases do not get.
- **Forensic load.** Forensic laboratories report substantial backlogs, and
  §176(3) increases the volume of material collected at scenes. Proving that the
  item a laboratory examined is the item collected becomes more important, not
  less.

*Figures change continuously; current values should be read from NJDG
(njdg.ecourts.gov.in) and the Directorate of Forensic Science Laboratories,
Maharashtra.*

### 2.3 A recent case: the swapped blood sample (Pune, May 2024)

In the early hours of 19 May 2024 a car driven by a minor killed two young
people in Kalyani Nagar, Pune. A blood sample was drawn at Sassoon General
Hospital to test for alcohol. According to the prosecution, the sample was
discarded and replaced with another person's blood — DNA later matched it to the
driver's mother — before it reached the laboratory. The substitution came to
light only because police, acting on information about possible tampering, had
a second sample drawn at the District Hospital, Aundh, and sent both for DNA
analysis. Two doctors and a hospital staff member were arrested, nine people
were held by August 2024, and the matter is before the court. (Sources: The
Tribune, Scroll, The Week/PTI; listed in §20.)

The lesson is structural. Nothing tied the vial to the person, its seal and the
minute it was drawn, and nobody downstream had anything to check it against.
Detection depended on a tip-off and a second sample — luck, not system.

**With NyaySetu.** The officer records a short collection clip and binds the
serial of the vial's tamper-evident seal to the exhibit; both are anchored
within minutes. A substitute vial must carry a different seal. When the
laboratory types the serial it sees, the mismatch refuses the intake, the wrong
reading is itself anchored, and the prosecutor and the court are alerted — the
same day, without DNA. The interactive replay is at
https://nyaysetu-project.vercel.app/case-study.

What NyaySetu would not have prevented: if the people drawing the sample put
the wrong person's blood into the original sealed vial in front of the camera,
no ledger could know. The clip makes that far harder to do unseen.

### 2.4 Who is affected

| Stakeholder | Pain today | What changes with NyaySetu |
|---|---|---|
| Investigating officer, malkhana in-charge | Paper registers; §63 certificates typed by hand; video handled on personal phones | Capture on a phone with an offline queue, digital malkhana, certificate generated from the record |
| Forensic laboratory | No proof that what arrived is what was sent | Re-hash on arrival; a mismatch is refused, anchored and alerted |
| Public prosecutor | Discovers custody gaps late | Readiness view per case; alerts for every refused hand-over |
| Judge and court registry | Disputes about exhibits and service; unmonitored bail | One verifiable record; summons status from the ledger; ranked bail compliance with a map |
| Defence counsel, legal aid | Must trust the prosecution's copy and log | Independent verification against a public ledger |
| Accused, witnesses (often first-generation litigants) | Obligations in legal English; no way to show compliance | Plain-language explanations in Marathi, Hindi or English, read aloud; their own check-in record |
| The public | Little visibility into how evidence is handled | A transparency page with live counts and every ledger transaction |

---

## 3. Objectives

1. Make the integrity of each item of digital evidence **verifiable by anyone**,
   from capture to courtroom, without trusting any single party's database.
2. Record **every custody hand-over with a re-check**, and make a failed check
   impossible to hide or quietly correct.
3. Generate the **BSA §63 certificate** and custody documents from the record
   itself, each with a QR code back to public verification.
4. Record **summons acknowledgement** as a timestamped, authenticated event.
5. Monitor **bail conditions** as code, with geo-fenced check-ins whose verdict
   is computed by the contract and reproducible by anyone.
6. Keep **personal data off the public ledger** entirely.
7. Serve people who are not lawyers: **Marathi, Hindi and English**, read-aloud,
   large text, low-end Android, intermittent connectivity.
8. Be **deployable now** at negligible cost, with a clear path to state scale.

---

## 4. What exists today, and the gap

| Existing system | What it does well | What it does not do | How NyaySetu relates |
|---|---|---|---|
| **e-Sakshya** (Ministry of Home Affairs / NIC) | Records §105 search-and-seizure media and links it to the FIR | Verification relies on the government's own copy; no public, independent check; does not follow the item through laboratory, malkhana and court; no summons or bail | **Complements it.** NyaySetu can anchor the fingerprint of every e-Sakshya recording and verify it at each later hand-over. |
| **CCTNS / ICJS** | Police case records and data exchange across police, courts, prisons, forensics and prosecution | No tamper-evident fingerprint per exhibit that the defence can check | NyaySetu adds an integrity layer; the exchange with ICJS is designed (`docs/INTEGRATION.md`) but not yet connected. |
| **e-Courts / NJDG** | Case status, cause lists, pendency statistics | No evidence-integrity or bail-compliance layer | Summons and bail status from NyaySetu can feed case status. |
| **Department of Justice "Nyaya Setu" chatbot** | General legal information on WhatsApp | Not case-specific; no evidence, summons or bail record | Different purpose; NyaySetu is a record system, not an information service. |
| **Commercial digital evidence management systems** | Storage, access control, audit logs | Audit log is held by the same party whose conduct is in question | NyaySetu's proof is on a ledger no party in the case controls. |

**The gap:** no existing Indian system lets a party who does not trust the
prosecution verify, independently and without permission, that an exhibit is
unchanged since capture — and none ties evidence custody, service of summons and
bail compliance into one verifiable record.

---

## 5. The solution

### 5.1 The one idea

A SHA-256 fingerprint is a 64-character value computed from a file. Change one
bit of the file and the fingerprint changes completely; it cannot be reversed to
recover the file. NyaySetu computes the fingerprint **on the device that
captured the evidence, before upload**, writes it to a public blockchain, and
compares against it at every later step. Anyone holding the file can recompute
the fingerprint and compare it with the ledger. They need to trust mathematics
and a public ledger — not the police, the laboratory or the court's database.

### 5.2 Five steps, each one checkable

1. **Capture** — photo, video or file on the officer's phone or browser; the
   fingerprint, time, GPS fix and accuracy are recorded before upload. Without
   signal, the capture waits safely in an offline queue and syncs later without
   duplicates.
2. **Anchor** — the fingerprint of a capture manifest is written to the
   EvidenceChain contract. The record shows honestly where it has got to:
   saved locally, submitted, confirmed on chain, review required, or integrity
   mismatch.
3. **Hand over** — malkhana, laboratory, prosecution and court each re-hash what
   they received before accepting it. A mismatch is anchored on chain, the
   transfer is refused, and an alert is raised to the prosecution and the court.
4. **Verify** — anyone can open the item's public Integrity Passport (by
   reference or QR code), or simply drop the file on the verification page, and
   see whether it matches the ledger.
5. **Produce in court** — the BSA §63 certificate, seizure memo and custody
   record are generated from the record, each carrying the SHA-256 digest and a
   QR code to public verification.

---

## 6. What is new

1. **Physical exhibits are covered, not only files.** The serial of a tamper-evident seal is bound to the exhibit and checked at every hand-over, so a substituted sample is refused at the first one.
2. **Fingerprint at the point of capture, on the officer's device.** The proof
   starts before the file reaches any server, so no server — including
   NyaySetu's own — can substitute a file unnoticed.
3. **Verification without permission.** A public page, with no account, lets
   the defence, the court or the accused check a file against the ledger. A
   file can be checked even without its reference: the system finds the
   matching record from the fingerprint alone.
4. **A failed check is permanent.** Integrity mismatches are written to the
   ledger, not to an editable log, and the hand-over is refused.
5. **Evidence, summons and bail in one verifiable record**, with three
   purpose-built contracts.
6. **Bail compliance computed on chain.** Geo-fence arithmetic runs inside the
   contract using integer micro-degrees, so the verdict on each check-in is
   reproducible by anyone and cannot be altered by the operator.
7. **Paper that verifies itself.** Every certificate and custody record carries
   a QR code that opens the public verification page for that item.
8. **Designed for the accused, not only for officials.** Obligations explained
   in Marathi, Hindi and English, read aloud by the phone, with a way to give
   reasons for a missed check-in.
9. **Radical, privacy-preserving transparency.** A public page shows live
   counts and every recent ledger transaction, with no personal data, and a
   "tamper lab" that lets anyone see for themselves what a one-bit change does.
10. **Honesty built into the interface.** The system states what it does not
   prove (a matching fingerprint shows a file is unchanged, not that its content
   is true), labels AI output as decision support, and labels simulated
   components as simulated.

---

## 7. Architecture

```
   Officer's phone / browser            Public: anyone, no account
   React · Vite · PWA                   /verify  /transparency  /handbook
   Expo field app, offline queue               │
   SHA-256 computed HERE, before upload        │
                │ HTTPS · session cookie + CSRF│
                ▼                              ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ API  Node 22 · Express 5 · TypeScript (strict) · Zod          │
   │ role-based + per-case access · server-side sessions           │
   │ verification state machine · nonce-serialised chain writes    │
   │ indexer and scheduler (background worker)                     │
   └───┬───────────────┬───────────────────┬───────────────┬──────┘
       ▼               ▼                   ▼               ▼
   PostgreSQL      IPFS (Pinata)      Flask + scikit-   Ethereum
   (Supabase)      AES-256-GCM        learn service     Sepolia
   row-level       ciphertext only    anomaly · risk ·  EvidenceChain
   security on                        delay estimates   SummonsChain
   all 48 tables                      (advisory only)   BailChain
   readable record  durable storage   decision support  authoritative, immutable
```

**Principle:** the ledger holds only what must be impossible to revise — a
fingerprint, an acknowledgement, a condition, a verdict. Everything readable
lives in PostgreSQL. An indexer reconciles the two; where they disagree, the
ledger is right and the disagreement is shown.

| Layer | Technology | Why |
|---|---|---|
| Smart contracts | Solidity 0.8.24, OpenZeppelin 5 (AccessControl, ReentrancyGuard), Hardhat | Role-gated writes; built-in overflow checks; 53 tests on a real EVM |
| API | Node 22, Express 5, TypeScript strict, Zod validation, Ethers v6 | Every request body parsed, not cast; one module owns every chain call |
| Database | PostgreSQL (Supabase), 13 migrations, 48 tables, row-level security on every table, audit triggers | Least privilege enforced by the database as well as the API |
| Storage | IPFS via Pinata; AES-256-GCM before upload | The store never sees plaintext and is never trusted for integrity |
| Web | React 19, Vite, Tailwind, WebCrypto, installable PWA, Leaflet + OpenStreetMap | Fingerprint in the browser; works on low-end Android; no map API key |
| Mobile | React Native (Expo), expo-crypto, offline queue with idempotency keys | Field capture without signal, never duplicated |
| Intelligence | Python, Flask, scikit-learn (Isolation Forest, Random Forest, Gradient Boosting) | Transparent, explainable models, labelled as advisory |
| Hosting | Vercel (web, API and AI as services; background worker as a daemon), Supabase, Pinata | Deployed today; all components replaceable by State data-centre equivalents |

---

## 8. Modules and features

### 8.1 Evidence (SaakshyaSetu · EvidenceChain)

- Case registration (with or without an FIR); evidence capture with GPS
  accuracy, device and time; resumable chunked upload for large video.
- Seizure memos, digital malkhana register with movements, laboratory intake
  with seal condition, forensic reports with versioned corrections.
- Custody transfer with mandatory re-hash; mismatch refused and anchored.
- Verification states shown on every item, with state history.
- Integrity alerts to prosecution and court; two-person approval for sensitive
  actions.

### 8.1a Physical exhibits — seal binding

A fingerprint proves a file is unchanged; a blood sample, a weapon or a packet
of narcotics is not a file. What travels with a physical exhibit is a
tamper-evident seal with a printed serial.

- The seizing officer binds the serial to the exhibit once, before the first
  hand-over. The serial stays off chain; a digest salted with the internal
  exhibit identifier is anchored.
- Every receiving party (laboratory intake today; custody, malkhana and court
  production use the same check) types the serial it actually sees. Serials are
  compared ignoring case, spaces and dashes.
- A different serial refuses the intake, anchors the wrong reading as its own
  record, and raises a serious `SEAL_MISMATCH` alert to the prosecution and the
  court. A seal cannot be re-bound quietly.
- Implemented in migration `014_exhibit_seals.sql`, `seal.service.ts`, and
  tested in `backend/test/f21-exhibit-seals.test.ts`.

### 8.2 Summons (SammansSetu · SummonsChain)

- Issue a summons with a 72-hour acknowledgement window the contract enforces.
- Acknowledgement by one-time code with time, coordinates and a device
  fingerprint, recorded on chain; service failure is detected automatically when
  the window lapses.

### 8.3 Bail (JaminSetu · BailChain)

- Conditions encoded on chain; geo-fence and check-in interval configured by the
  judge.
- Check-ins verified by one-time code; the contract decides inside or outside the
  fence; missed check-ins flagged by the scheduler.
- Ranked compliance board for the judge with reasons, the accused's
  explanations, and a map of the geo-fence and every check-in.

### 8.4 Public services (no account)

- **Integrity Passport** per item: digests, transaction, custody stages; PDF and
  QR code. Never names, places or case references.
- **Verify by file**: drop a file without knowing its reference; the system
  finds its record from the fingerprint and confirms against the chain.
- **Transparency page**: live counts, contract and transaction links, measured
  cost per operation, and the tamper lab.
- **Handbook**: the whole system explained for every role, publicly.

### 8.5 Documents

- BSA §63 certificate (Part A and Part B) generated from the record, with the
  anchored SHA-256 digest and a QR code; editable template managed by the court
  registry with a fixed disclaimer.
- Seizure memo, custody record, case final report and Integrity Passport PDFs.
  Samples: `docs/samples/`.

### 8.6 Governance and administration

- Accounts only by invitation from the court registry; no public sign-up.
- Password plus emailed one-time code; sessions held server-side and revocable
  instantly.
- Per-case assignment; access requests from defence approved by the court;
  complete audit trail of actions and refusals; chain health and keeper balance
  for the registry.

---

## 9. End-to-end workflow

| # | Actor | Action | What is recorded on chain |
|---|---|---|---|
| 1 | Police | Registers a case; captures a photo at the scene (offline if needed) | Salted case key; fingerprint of the capture manifest |
| 2 | Police | Records the seizure memo and malkhana entry | Fingerprints of memo and movement |
| 3 | Laboratory | Receives the item, re-hashes, records seal condition | Custody transfer with confirmed digest |
| 3a | Laboratory | Receives a **different** file | Integrity mismatch, permanently; transfer refused; alert raised |
| 4 | Laboratory | Files the forensic report; a later correction keeps both versions | Report fingerprints |
| 5 | Prosecution, court | Accept custody with re-check | Custody transfers |
| 6 | Defence | Requests access; on approval verifies files independently | Integrity check result |
| 7 | Court | Issues summons | Summons with 72-hour window |
| 8 | Accused | Acknowledges with a one-time code | Acknowledgement with time, coordinates, device |
| 9 | Court | Grants bail with conditions and a geo-fence | Conditions, fence, interval |
| 10 | Accused | Checks in; one inside the fence, one outside | Each check-in and the contract's verdict |
| 11 | Court registry | Generates the §63 certificate and final report | — (documents carry the anchored digests and QR codes) |
| 12 | Anyone | Scans the QR, or drops the file on /verify | — (reads the chain) |

The complete sequence is automated end to end over HTTP by `npm run flow:check`
(and `npm run demo:data`, which leaves the record in place).

---

## 10. Alignment with the new criminal laws

| Provision | Requirement | How NyaySetu supports it |
|---|---|---|
| **BNSS §105** | Search and seizure recorded through audio-video electronic means, preferably a mobile phone | Capture on the phone with fingerprint, time and location before upload; offline queue for areas without signal |
| **BNSS §176(3)** | Forensic expert to visit the scene of offences punishable with 7+ years, collect evidence and record the process | Laboratory intake with re-hash and seal condition; custody refused on mismatch |
| **BSA §63** | Certificate accompanying electronic records, including hash value(s) | Certificate generated from the record with the SHA-256 digest anchored on chain, QR-verifiable |
| **Supreme Court, 22 May 2026** | *Pune Bar Association v. Union of India*, 2026 SCC OnLine SC 1297: §63(4) upheld; a hash value is "synonymous with an electronic fingerprint" | The fingerprint is computed at the scene and anyone can check it, free |
| **BNSS §§ 63–71** (summons) | Service of summons, including electronic service | Authenticated, timestamped acknowledgement recorded on chain |
| **BNSS bail provisions** | Conditions imposed by the court | Conditions as code; compliance computed and ranked for the court |

**What is not claimed.** NyaySetu does not decide admissibility. The certificate
and forms are templates filled from the record, to be checked by a legal
practitioner. The ledger is supporting proof of integrity, not a substitute for
the certificate or for the court's assessment.

---

## 11. Security and privacy

### 11.1 What goes on the public ledger, and what never does

| On chain | Off chain |
|---|---|
| A salted case key (neither FIR nor case reference recoverable) | Evidence files, encrypted with AES-256-GCM before storage |
| Fingerprint of each item's capture manifest | Names, FIR details, addresses, witnesses |
| Custody transfers and integrity checks, including failures | Exact evidence coordinates (only in the manifest, readable by assigned roles) |
| Fingerprints of seizure memos, malkhana movements, reports | Report text, court orders, comments and notes |
| Summons issue and acknowledgement (with acknowledgement coordinates) | Accounts, sessions, access rules |
| Bail conditions and check-ins with their coordinates (needed for the contract to compute the fence) | |

Aadhaar numbers are never stored; they are converted to keyed HMAC tokens, and
the table holding tokens is unreachable through the API.

### 11.2 Controls

- Server-side sessions (revocable at once), CSRF protection, strict per-route
  rate limits, password plus emailed one-time code.
- Role-based access and per-case assignment enforced by the API **and** by
  row-level security in the database; an authorisation test matrix covers every
  route.
- Every chain write serialised through a nonce ledger; every action and every
  refusal in an audit log.
- Public endpoints return only what the privacy rule allows; a test asserts the
  transparency figures contain no case reference, identifier, digest or name.
- Security review documented in `docs/SECURITY.md`.

---

## 12. Artificial intelligence, used carefully

| Model | Purpose | Safeguard |
|---|---|---|
| Evidence anomaly screening (Isolation Forest + explainable rules) | Flags implausible captures: GPS accuracy, clock skew, mocked location, unusual sizes | Rules always explain the flag; the model only adds outliers for human review |
| Bail risk banding (Random Forest) | Supports the court's monitoring intensity | Labelled "decision support, never a finding"; never decides |
| Case delay estimate (Gradient Boosting) | Indicates likely delay with an interval | Trained on declared distributions, documented in full |
| Statute reference | All 358 sections of the Bharatiya Nyaya Sanhita, 2023 | Severity treated as a lower bound where the source omits sub-sections |

---

## 13. Inclusion and accessibility

- **Languages:** the interface in English, हिंदी and मराठी; plain-language
  explanations for the accused.
- **Read-aloud:** explanations spoken by the phone's own speech engine (Marathi →
  Hindi → Indian English fallback); nothing leaves the device.
- **Low-end devices:** installable web app; main bundle about 60 KB compressed;
  maps and animation loaded only when needed.
- **Connectivity:** offline capture queue that never duplicates.
- **Accessibility:** large-text mode, light and dark themes, keyboard
  navigation, skip links; every page tested with axe-core for WCAG violations.
- **Free to the user:** no app store, no account for verification, no paid map
  or speech API.

---

## 14. Quality: how it is verified

### 14.1 Automated tests

| Suite | Count | What it covers |
|---|---|---|
| Smart contracts (Hardhat) | 53 | Roles, custody stages, mismatch anchoring, summons window, geo-fence arithmetic, breaches |
| API (node:test, over real HTTP) | 121 | Every feature, an authorisation matrix over the API's routes, rate limits, PDFs, public privacy rules |
| Mobile | 9 | Offline queue: ordering, idempotency, retry |
| UI smoke and accessibility (Puppeteer + axe-core) | 44 pages | Every page of every role, desktop and mobile, no console errors, no WCAG violations |

### 14.2 Measured results

| Metric | Result |
|---|---|
| Tampered files detected (one byte changed, 200 files) | **100%** |
| Genuine files confirmed (no false alarms) | **100%** |
| Unauthorised read attempts blocked (258 attempts, six roles) | **100%** |
| Items lost with 35% of chain writes failing | **0** (all confirmed after one retry pass) |
| Public check latency, in process (p50 / p95) | 3.3 ms / 4.9 ms |

Method and limits: `docs/metrics/METRICS.md`.

---

## 15. Deployment

**Live today** at https://nyaysetu-project.vercel.app, with the health of every
subsystem published at `/api/health` and summarised in the header of every
public page.

| Component | Where it runs now | State deployment equivalent |
|---|---|---|
| Web app | Vercel (static, global CDN) | State Data Centre / MeghRaj web tier |
| API | Vercel serverless functions (Node 22) | Containers on State cloud |
| Background worker (indexer, scheduler) | Vercel daemon (container) | Same container image |
| AI service | Vercel Python service | Same container image |
| Database | Supabase PostgreSQL (Singapore region) | PostgreSQL in an Indian data centre |
| File storage | IPFS via Pinata (encrypted) | Private IPFS cluster or object storage in India |
| Ledger | Ethereum Sepolia (public testnet) | Layer-2 network, or a permissioned EVM ledger (e.g. Hyperledger Besu) run by State and judiciary nodes |
| Email | Brevo SMTP | NIC email relay |

Everything is configured by environment variables (`.env.hosting.example`), and
the same code runs on a laptop with no accounts at all (`npm run local`: a local
chain, in-memory database and the web app). Step-by-step hosting guides are in
`docs/hosting.md` and `docs/production.md`.

---

## 16. Feasibility

### 16.1 Technical

Working end to end today, on public infrastructure, with the measured results
above. Every piece is open-source and replaceable. The contracts are standard
Solidity and run unchanged on any EVM network.

### 16.2 Cost of the ledger — measured, not estimated

Gas used per operation, measured with `npm --prefix contracts run gas`:

| Operation | Gas used |
|---|---|
| Register an item of evidence | 3,60,093 |
| Custody transfer with re-check | 1,56,407 |
| Issue a summons | 2,40,107 |
| Acknowledge a summons (with location and device) | 1,31,376 |
| Set bail conditions | 2,76,884 |
| Configure bail monitoring (geo-fence) | 1,03,946 |
| Bail check-in (fence computed on chain) | 2,35,892 |

One item followed from scene to court (registration plus three custody
transfers) uses about 8.3 lakh gas. The cost is independent of file size, since
only a 32-byte fingerprint is written.

- **Public testnet (prototype):** free.
- **Ethereum mainnet:** at 10 gwei, about 0.008 ETH per item from scene to
  court — too expensive at state scale, and not proposed.
- **Layer-2 rollup:** the same contracts at a small fraction of mainnet cost,
  with security inherited from Ethereum.
- **Permissioned EVM ledger (recommended for the State):** no gas fees; the
  cost is that of running validator nodes, which can be held by independent
  institutions (police, judiciary, forensic directorate, a legal-services
  authority) so that no single party controls the record.

### 16.3 Operational

- Officers use the phone they already carry; capture takes the same steps as a
  photo, plus an automatic fingerprint.
- No change to who holds the evidence; NyaySetu adds a check at each existing
  hand-over.
- The court registry controls accounts; there is no public sign-up to police.
- A role-by-role handbook is public, and every screen explains its state in
  plain language.

### 16.4 Legal

Aligned with BNSS §105, §176(3) and BSA §63 as above. The ledger stores no
personal data, which keeps it compatible with the Digital Personal Data
Protection Act, 2023: personal data stays in an access-controlled database that
can be corrected or erased, while the ledger holds only fingerprints and keys
that do not identify anyone.

### 16.5 Scalability

- The API is stateless and scales horizontally; the database is standard
  PostgreSQL with indexed access paths.
- Chain writes are queued and serialised per signer; throughput can be raised
  by adding signers, by batching many fingerprints into one Merkle root per
  block interval, or by moving to a layer-2 or permissioned network.
- At Maharashtra's scale (lakhs of items per year) the database load is modest;
  the ledger is the constraint, which is why §16.2 recommends a permissioned
  EVM network for state rollout.

---

## 17. Impact

| SDG 16 target | Contribution |
|---|---|
| 16.3 Equal access to justice | The defence and the accused can verify evidence and see their obligations in their own language |
| 16.6 Effective, accountable, transparent institutions | Every hand-over is checked; failures cannot be hidden; public transparency page |
| 16.10 Public access to information | Verification and aggregate figures available to anyone, with no personal data |

**Indicators to measure in a pilot:** share of exhibits with a complete,
verified chain of custody; number of custody disputes raised in court;
adjournments attributed to service of summons; time from seizure to laboratory
intake; share of missed bail check-ins detected within one day; time to produce
a §63 certificate.

---

## 18. Roadmap and pilot plan

| Phase | Scope | Duration |
|---|---|---|
| 1. Pilot | One police station (Shivajinagar, Pune), the regional forensic laboratory, one sessions court, one legal-aid clinic | 3 months |
| 2. District | All police stations of one district; malkhana and laboratory workflows | 6 months |
| 3. State | Integration with CCTNS / ICJS and e-Courts; permissioned ledger with independent validator nodes | 12 months |

**Next technical steps:** device-signed mobile captures; anchoring of e-Sakshya
recordings; licensed Aadhaar authentication in place of the sandbox provider;
Bhashini integration for voice in more Indian languages; Merkle batching of
anchors; review of Hindi and Marathi text by native speakers.

---

## 19. Limitations

- A matching fingerprint proves a file is unchanged since it was anchored. It
  does not prove that what the file shows is true, or how it was collected.
- If a device is compromised before the fingerprint is computed, the proof
  starts from the compromised file. GPS accuracy, device time and clock-skew
  checks flag anomalies; the court still weighs the evidence.
- GPS can be wrong or spoofed; accuracy is recorded with every fix, and mocked
  locations are flagged.
- AI output is decision support and never decides anything.
- Citizen one-time codes use a sandbox provider; real Aadhaar authentication
  requires a licensed authentication user agency.
- Bail check-in coordinates are on chain because the contract computes the
  fence; moving that computation to a zero-knowledge proof is future work.
- The prototype ledger is a public testnet; production needs the network in §16.2.

---

## 20. References

1. The Bharatiya Nagarik Suraksha Sanhita, 2023 — §105, §176(3), summons and bail provisions.
2. The Bharatiya Sakshya Adhiniyam, 2023 — §63 and the Schedule (certificate for electronic records).
3. The Bharatiya Nyaya Sanhita, 2023.
4. The Digital Personal Data Protection Act, 2023.
5. National Judicial Data Grid — https://njdg.ecourts.gov.in/
6. e-Sakshya — Ministry of Home Affairs / National Informatics Centre.
7. Inter-operable Criminal Justice System (ICJS) and CCTNS — National Crime Records Bureau.
8. NIST FIPS 180-4, Secure Hash Standard (SHA-256).
9. OpenZeppelin Contracts 5 — AccessControl, ReentrancyGuard.
10. Project documentation in this repository: `README.md`, `docs/SECURITY.md`,
    `docs/DECISIONS.md`, `docs/metrics/METRICS.md`, `docs/hosting.md`,
    `docs/TESTING.md`, `docs/samples/`.
11. *Pune Bar Association v. Union of India*, 2026 SCC OnLine SC 1297 (22 May 2026) — https://www.scconline.com/blog/post/2026/07/08/sc-upholds-admissibility-of-electronic-evidence-under-section-63-4-bsa/
12. Asma Khan, "Madhya Pradesh's new e-Sakshya rules solve custody, not proof", LiveLaw, 11 August 2026 — https://www.livelaw.in/articles/madhya-pradesh-esakshya-rules-solve-custody-545161
13. Pune blood-sample case: The Tribune (May and Aug 2024), Scroll, The Week/PTI (27 June 2025) — links on https://nyaysetu-project.vercel.app/case-study

---

*NyaySetu · न्यायसेतु · Developed by Sai Randive*
