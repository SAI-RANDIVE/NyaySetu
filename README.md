# NyaySetu · न्यायसेतु

**Bridge of Justice.** Evidence digests, summons acknowledgements and bail conditions anchored to a public blockchain, so integrity is something anyone can check rather than something a party asserts.

Final year project · Vishwakarma Institute of Technology, Pune · AI & Data Science · 2026

---

## What problem this actually solves

Three places in a criminal matter where the record is only as good as somebody's word:

| Question asked in court | How it is answered today | What NyaySetu does |
|---|---|---|
| Was this evidence altered? | A custody register, which records that a transfer happened, not that the item is the same item. | The digest is computed on the collecting device and anchored on chain. Each receiving party re-hashes what they were handed and confirms it. A mismatch is anchored **and** the transfer refused. |
| Were you served? | A process server's endorsement against a flat denial. Cases adjourn for months on this. | Acknowledgement is an Aadhaar-OTP-authenticated transaction carrying time, coordinates and a device fingerprint. It cannot be produced without the recipient or back-dated. |
| Did they comply with bail? | A PDF nobody monitors until something has already gone wrong. | Conditions live on chain, check-ins are transactions, and the geo-fence arithmetic runs in the contract. A breach emits an event the court dashboard is subscribed to. |

---

## The three modules

**SaakshyaSetu** (`EvidenceChain.sol`) — evidence registration, chain of custody, tamper rejection, independent defence verification.

**SammansSetu** (`SummonsChain.sol`) — summons issuance, OTP-authenticated acknowledgement with GPS, a 72-hour window the contract enforces itself.

**JaminSetu** (`BailChain.sol`) — bail conditions as code, geo-fenced check-ins, automatic violation detection, live compliance scoring.

---

## Repository layout

```
nyaysetu/
├── contracts/          Solidity + Hardhat. 53 tests.
│   ├── contracts/      EvidenceChain, SummonsChain, BailChain, NyayRoles, GeoMath
│   ├── scripts/        deploy, grantRoles, verify
│   └── deployed/       addresses + ABIs the backend reads at boot
├── database/           Postgres migrations: schema, RLS, audit triggers
├── backend/            Node + Express + TypeScript. Ethers bridge, OTP seam, jobs.
├── ai-service/         Python + scikit-learn + Flask. Three models.
├── frontend/           React + Tailwind. Seven role portals, light and dark.
└── mobile/             React Native (Expo). Field capture and bail check-in.
```

---

## Running it

### 0 · What you need

- Node 20 or newer, and Python 3.10 or newer
- A Supabase project (free tier is enough)
- Optionally: a Pinata account, and a Sepolia RPC URL plus a funded testnet wallet

Everything except Supabase is optional. Each missing piece reports itself as unavailable on `/api/health` rather than failing quietly.

### 1 · Install

```bash
cd nyaysetu
npm run install:all
cd ai-service && python -m venv .venv && .venv\Scripts\activate   # source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt && cd ..
```

### 2 · Database

Run these three files, in order, in the Supabase SQL editor:

```
database/migrations/001_schema.sql
database/migrations/002_rls.sql
database/migrations/003_audit.sql
database/seed/reference.sql
```

Then, in **Supabase → Settings → API → Exposed schemas**, add `restricted` alongside `public`. That is the one manual dashboard step; personally identifying data lives in that schema and PostgREST will not reach it otherwise.

### 3 · Contracts

```bash
npm run contracts:test          # 53 tests, all should pass

# Terminal A — a local chain
npm run chain

# Terminal B
cp contracts/.env.example contracts/.env
npm run deploy:local
```

For Sepolia instead: put `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` in `contracts/.env`, then `npm run deploy:sepolia`.

The deploy script writes `contracts/deployed/<network>.json` with both addresses and ABIs, and the backend reads it at boot. No copying required.

### 4 · Models

```bash
npm run ai:train      # writes ai-service/models/, prints the metrics
npm run ai:serve      # http://localhost:5001
```

### 5 · Backend

```bash
cp backend/.env.example backend/.env
```

Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then generate the two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # EVIDENCE_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"  # AADHAAR_TOKEN_PEPPER
```

For a local chain, `CHAIN_PRIVATE_KEY` can be Hardhat's first account — it is printed when you run `npm run chain`.

```bash
npm run chain:check   # 24 checks against the live contracts, no database needed
npm run seed          # demo cast: one account per role, plus a case
npm run api           # http://localhost:4000
```

### 6 · Frontend

```bash
npm run web           # http://localhost:5173
```

Sign in with any seeded account. One password for all of them: `NyaySetu@2026`

| Email | Role |
|---|---|
| police@nyaysetu.demo | Police officer |
| forensic@nyaysetu.demo | Forensic laboratory |
| prosecutor@nyaysetu.demo | Public prosecutor |
| judge@nyaysetu.demo | Judge |
| defence@nyaysetu.demo | Defence counsel |
| accused@nyaysetu.demo | Accused |
| surety@nyaysetu.demo | Surety (read-only compliance) |
| admin@nyaysetu.demo | Court administrator |

### 7 · Mobile, optional

```bash
npm run install:mobile
cd mobile && npx expo install --fix     # reconciles versions to your Expo SDK
cp .env.example .env
npm start
```

An Android emulator reaches your laptop at `10.0.2.2`, not `localhost`. A physical phone needs your LAN address added to `CORS_ORIGINS` in `backend/.env`.

---

## The nine-step demo

```bash
npm run demo
```

Drives the whole flow over HTTP with real cookies, real CSRF headers and real transactions. A green run is proof the stack works, not a mock.

1. Police register evidence at a scene
2. The forensic laboratory confirms the hash on arrival
3. **A tampered file is refused, and the refusal is anchored on chain**
4. Prosecutor and court take custody of the genuine file
5. A judge issues a summons with a 72-hour window
6. The accused acknowledges it with Aadhaar OTP and GPS
7. The judge grants bail with conditions encoded on chain
8. A compliant check-in, then one from outside the geo-fence
9. **Defence counsel verifies independently, against the chain**

Steps 3 and 9 are the ones worth watching. Step 3 shows that a rejected tamper attempt leaves a permanent record rather than a server log. Step 9 shows the defence getting the same answer from a source neither party controls.

---

## What is verified, and how

| Layer | Check | How to run it |
|---|---|---|
| Contracts | 53 unit tests: tamper rejection, unauthorised transfer, expired summons, missed check-in, geo-fence breach | `npm run contracts:test` |
| Backend ↔ contracts | 24 integration checks against a live chain, no database needed | `npm run chain:check` |
| Whole stack | The nine-step demo over HTTP | `npm run demo` |
| Types | Strict TypeScript across backend and frontend | `npm run typecheck` |
| Models | Metrics printed at train time, written to `models/metadata.json` | `npm run ai:train` |
| Dependencies (shipped) | 0 vulnerabilities across all three Node packages | `npm run audit` |
| Dependencies (Python) | 0 vulnerabilities | `npm run audit:python` |

---

## Honest limitations

Read these before the viva; they are the questions an examiner will ask.

**Aadhaar OTP is simulated.** The live UIDAI API requires AUA/KUA registration, an ASA route, a licence key and a digital signature certificate. UIDAI grants that to government departments, not to student projects, and there is no public sandbox that issues real OTPs. `backend/src/otp/UidaiOtpProvider.ts` writes out the real protocol and refuses to run without credentials, rather than pretending. The sandbox provider matches the real lifecycle exactly: a six digit code, a short TTL, a capped attempt count, single use, bound to one action. `/api/health` reports `authorisedForProduction: false` so a demo deployment can never be mistaken for an authenticated one.

**The models are trained on synthetic data.** Evidence metadata from live investigations is protected. Bail outcomes linked to individuals are personal data under the DPDP Act 2023. NJDG publishes aggregate pendency, not the per-case features a delay regressor needs. Every distribution is written out in `ai-service/src/datasets.py` so a reviewer can judge what the models learned. The outputs are decision support, never findings of fact.

**Citizen actions are relayed.** An accused does not hold a funded Sepolia wallet, so the backend's keeper wallet submits their transactions after OTP verification. The Aadhaar token in the transaction is what binds it to them. A production deployment would want account abstraction or a custodial wallet per citizen.

**Sepolia is not a court system.** A production deployment would need a permissioned chain or a Layer 2 with predictable costs, an availability guarantee, and a legal framework recognising an on-chain record. This demonstrates the mechanism.

**The Hardhat 2 toolchain carries open advisories.** `npm run audit` checks what ships and reports zero across contracts, backend and frontend. `npm run audit:all` includes dev dependencies and reports 25 findings in `contracts/`, every one of them inside Hardhat 2's own tree (adm-zip, undici, elliptic, tmp and friends). None of it is deployed: what reaches Sepolia is solc output, and the package is devDependencies only. The fix is Hardhat 3, which is a rewrite with a different config format and different plugin names, and would break a green 53-test suite. That trade is stated rather than hidden.

**RLS does not constrain the API.** Supabase's service role bypasses row level security by design, so the policies in `002_rls.sql` do not police API traffic — the RBAC middleware does. RLS is the second wall, and it is what stands between a leaked anon key and the contents of these tables. Every table has it on; see `VIVA-NOTES.md`.

---

## Where the reasoning is written down

- **`VIVA-NOTES.md`** — the on-chain/off-chain split, why not just Postgres, and the design decisions worth defending
- **`DEPLOYMENT.md`** — exact environment variables per service, and the order to deploy them in
- **`ai-service/src/datasets.py`** — every synthetic distribution, in full
- **`backend/src/otp/UidaiOtpProvider.ts`** — the government-authorisation seam
- **`database/migrations/002_rls.sql`** — the security model, with its own reasoning in the header

---

## Licence

MIT. See the limitations above before deploying any of this near a real proceeding.
