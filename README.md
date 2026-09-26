# NyaySetu · न्यायसेतु

**Bridge of Justice.** Evidence digests, summons acknowledgements and bail conditions anchored to a public blockchain, so integrity is something anyone can check rather than something a party asserts.

Final year project · Vishwakarma Institute of Technology, Pune · AI & Data Science · 2026

**New here?** Read the in-app **[Handbook](#the-handbook)** — it explains the one technical idea and then walks through what each of the seven roles actually does. **Setting it up?** **[docs/api-keys.md](docs/api-keys.md)** lists every credential, where to get it, and what breaks without it. **Hosting it?** **[docs/hosting.md](docs/hosting.md)**, and read its first section before importing the repo into Vercel.

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

Six deployable pieces and two folders that are not code. Each piece runs on its
own and says so when a neighbour is missing, which is why you can start the API
with no chain and no models and still get a working portal.

```
nyaysetu/
│
├── frontend/           ← THE WEBSITE. React + Vite + Tailwind.
│   │                     This is the folder you deploy to Vercel or Netlify.
│   ├── src/
│   │   ├── pages/        one file per portal: police, forensic, prosecutor,
│   │   │                 judge, defence, accused, admin, plus Landing, Login,
│   │   │                 FirstRun and the public Handbook
│   │   ├── components/   shared UI: ui.tsx is the whole design system,
│   │   │                 trust.tsx renders hashes and transaction links
│   │   ├── context/      auth, theme and toast providers
│   │   ├── lib/          api.ts is the only place the app touches the network
│   │   └── styles/       tokens.css holds every colour as a variable
│   ├── public/           favicons, manifest, the logo the browser tab shows
│   └── dist/             build output. Never committed.
│
├── backend/            ← THE API. Node + Express + TypeScript. Port 4000.
│   └── src/
│       ├── routes/       one file per area; auth.ts holds the two-step sign-in
│       ├── middleware/   auth (sessions + RBAC), csrf, rate limits, validation
│       ├── services/     the logic a route calls: evidence, summons, bail, audit
│       ├── lib/          chain.ts (ethers bridge + nonce ledger), crypto.ts
│       │                 (every primitive in one auditable file), mailer.ts,
│       │                 supabase.ts, pii.ts (the only route to Aadhaar tokens)
│       ├── otp/          the swappable identity seam: sandbox, email, UIDAI
│       ├── jobs/         the sweeps that notice a summons nobody answered
│       ├── indexer/      reads contract events back into Postgres
│       └── scripts/      bootstrap (the first admin), chainCheck, authCheck
│
├── contracts/          ← THE CHAIN. Solidity 0.8.24 + Hardhat. 53 tests.
│   ├── contracts/        EvidenceChain, SummonsChain, BailChain, NyayRoles,
│   │                     GeoMath (integer-only geodesy, no floats on chain)
│   ├── test/             the 53 tests, including tamper rejection
│   ├── scripts/          deploy, grantRoles, verify
│   └── deployed/         addresses + ABIs the backend reads at boot
│
├── database/           ← THE SCHEMA. Not a service; SQL you run once.
│   ├── migrations/       001 schema · 002 RLS · 003 audit · 004 OTP channels
│   │                     005 PII access · 006 invitations. Run in order, in the
│   │                     Supabase SQL editor — Supabase blocks DDL over the API.
│   └── seed/             reference.sql: role labels only, no accounts
│
├── ai-service/         ← THE MODELS. Python + scikit-learn + Flask. Port 5001.
│   ├── src/              three models: anomaly screening, bail risk, delay
│   └── models/           trained artefacts + metadata.json with the metrics
│
├── mobile/             ← THE FIELD APP. React Native (Expo). Optional.
│                         Scene capture and bail check-in. Hashes on-device.
│
├── docs/               ← EVERY GUIDE. Start with docs/README.md.
├── brand/              ← the source logo the favicons were generated from
└── render.yaml           deploy blueprint for the API
```

### Which folder is "the website"?

**`frontend/`.** Set that as the Root Directory in Vercel or Netlify; the build
command is `npm run build` and the output is `dist`. `frontend/vercel.json` and
`frontend/netlify.toml` are already in place with SPA rewrites and security
headers. The API is a **separate** deployment from `backend/` — see
[docs/hosting.md](docs/hosting.md).

---

## The `.env` files, and why there are five

One per deployable piece, because each one runs as its own process and they do
not share a filesystem in production. Splitting them is not tidiness: it is what
keeps the Supabase key out of the browser bundle. Every file is git-ignored, and
each has a committed `.env.example` next to it.

| File | Belongs to | Holds | Secret? |
|---|---|---|---|
| **`backend/.env`** | the API | Supabase service key, Aadhaar pepper, evidence AES key, SMTP password, the keeper wallet's private key | **Yes — all of it.** The only file that holds real secrets |
| **`frontend/.env`** | the website | the API's URL and the hero video URL | **No, and it must never be.** Vite inlines every `VITE_` variable into the bundle, so anything here is readable by anyone who opens the site |
| **`mobile/.env`** | the phone app | the API's URL as seen from the device | No, same reason — `EXPO_PUBLIC_` variables are compiled into the app |
| **`ai-service/.env`** | the model service | its port and the shared secret the API calls it with | Mildly. It holds no user data and no keys |
| **`contracts/.env`** | deploying to Sepolia | RPC URL, deployer key, Etherscan key | Yes, but only needed when deploying. Nothing at runtime reads it |

The rule the split enforces: **`SUPABASE_SERVICE_ROLE_KEY` appears in exactly one
file, and that file is never read by anything a user's browser can see.** It
bypasses row level security by design, so a copy of it in a frontend bundle would
hand every visitor the whole database.

`contracts/.env` is only read by Hardhat at deploy time; the backend learns the
contract addresses from `contracts/deployed/<network>.json` or from its own
`EVIDENCE_CHAIN_ADDRESS` / `SUMMONS_CHAIN_ADDRESS` / `BAIL_CHAIN_ADDRESS`.

Full list of what goes in each, where to get it, and what breaks without it:
[docs/api-keys.md](docs/api-keys.md).

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

Run these six files, in order, in the Supabase SQL editor:

```
database/migrations/001_schema.sql        tables, enums, indexes
database/migrations/002_rls.sql           row level security, default deny
database/migrations/003_audit.sql         audit triggers
database/migrations/004_otp_channels.sql  email OTP channel, email log
database/migrations/005_pii_access.sql    PII access functions
database/seed/reference.sql               role reference rows
```

No dashboard configuration is needed. Personally identifying data lives in a
`restricted` schema that is deliberately **not** exposed over the API; migration
`005` reaches it through four `SECURITY DEFINER` functions instead. Exposing the
schema would have made every table in it reachable forever, including ones added
later; four named functions do not grow.

Confirm everything is wired with:

```bash
cd backend && npm run check
```

It reports Supabase, SMTP and the chain separately, and names the fix for
whatever is wrong rather than leaving you to infer it.

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
npm run bootstrap     # the first court administrator; prints its password once
npm run api           # http://localhost:4000
```

`npm run bootstrap` reads `BOOTSTRAP_ADMIN_EMAIL` from `backend/.env`, or takes
it directly:

```bash
cd backend && npm run bootstrap -- --email you@example.com --name "Your Name"
```

Use a mailbox you can read. Every sign-in emails a six digit code to that
address, so an address that bounces is an account you cannot get into.

### 6 · Frontend

```bash
npm run web           # http://localhost:5173
```

Sign in at `/login` with the address and password `npm run bootstrap` printed.

Sign-in is two steps when SMTP is configured: the password, then a six digit code
emailed to the account's own address. Without SMTP it stays password-only and the
second step never appears.

### Accounts

**There are none until you make them, and there is no sign-up.** A court is a
closed institution: somebody with authority decides who is a judge. So the only
route into the system is a court administrator creating an account from `/admin`,
which emails its holder a one-time password.

| Step | Where |
|---|---|
| The first administrator | `npm run bootstrap`, once, from a terminal |
| Everybody else | `/admin/users` → **Invite a participant** |
| Which cases they can open | `/admin/access` |

An invited account can do exactly one thing until it replaces the password it was
emailed: replace it. Every other route answers `403 PASSWORD_CHANGE_REQUIRED`,
because a password that has been sent by email is a password sitting in an inbox.

Holding a role is not the same as being on a case. A judge is a judge; *this*
judge is on *this* case. Grant that separately at `/admin/access`, or the portal
will be correctly empty.

### 7 · Mobile, optional

```bash
npm run install:mobile
cd mobile && npx expo install --fix     # reconciles versions to your Expo SDK
cp .env.example .env
npm start
```

An Android emulator reaches your laptop at `10.0.2.2`, not `localhost`. A physical phone needs your LAN address added to `CORS_ORIGINS` in `backend/.env`.

---

## The nine-step walkthrough

Drive it yourself from the portals; there is no scripted cast to stand in for
real accounts. Invite one account per role from `/admin`, assign them all to one
case at `/admin/access`, then:

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

## The handbook

There is a full walkthrough built into the app at **`/handbook`**, public and readable without an account. It covers:

- the one technical idea, a digest, in two paragraphs and with a worked example
- what each of the three bridges replaces, and why
- **a step-by-step walkthrough for each of the seven roles**, with what that role deliberately cannot do
- what every badge and status chip in the interface means
- why there are two different one-time codes, and which one is simulated
- eight common questions, a plain-English glossary, and a triage list for when something goes wrong

It is linked from the landing page, the sign-in screen and every portal header. When you are signed in it jumps straight to your own role.

---

## Two one-time codes, and only one of them is simulated

This distinction matters more than anything else in the honesty of the project.

| | Signing in | Acting on a case |
|---|---|---|
| **Channel** | Email, over your own SMTP server | Aadhaar-registered mobile |
| **Proves** | You control this account | This specific person performed this legal act |
| **Used for** | The second factor after a password | Acknowledging a summons, filing a bail check-in |
| **Real?** | **Yes.** A working mail server delivers it. | **No.** Simulated, because UIDAI access is government-gated. |

`/api/health` reports both separately, and the interface says "simulated" wherever an Aadhaar code appears. Collapsing them into one provider would let the simulated channel stand in for the real one, which is exactly the kind of quiet substitution this project is built to prevent.

---

## What is verified, and how

| Layer | Check | How to run it |
|---|---|---|
| Contracts | 53 unit tests: tamper rejection, unauthorised transfer, expired summons, missed check-in, geo-fence breach | `npm run contracts:test` |
| Backend ↔ contracts | 24 integration checks against a live chain, no database needed | `npm run chain:check` |
| Sign-in and invitations | 21 assertions over real HTTP: two-step sign-in, single-use invitation, the gate that refuses every other route, credential rotation, the last-admin guard | `cd backend && npm run auth:check -- <admin-email> <password> <you+check@your-mail>` |
| Types | Strict TypeScript across backend and frontend | `npm run typecheck` |
| Models | Metrics printed at train time, written to `models/metadata.json` | `npm run ai:train` |
| Dependencies (shipped) | 0 vulnerabilities across all three Node packages | `npm run audit` |
| Dependencies (Python) | 0 vulnerabilities | `npm run audit:python` |
| Whole stack boots | Chain, models, API and web all start; health reports each subsystem | see below |

---

## Honest limitations

Read these before the viva; they are the questions an examiner will ask.

**Aadhaar OTP is simulated; email OTP is not.** Sign-in uses a real code delivered by a real mail server. Citizen actions on a case use a simulated Aadhaar channel, because the live UIDAI API requires AUA/KUA registration, an ASA route, a licence key and a digital signature certificate. UIDAI grants that to government departments, not to student projects, and there is no public sandbox that issues real OTPs. `backend/src/otp/UidaiOtpProvider.ts` writes out the real protocol and refuses to run without credentials, rather than pretending. The sandbox provider matches the real lifecycle exactly: a six digit code, a short TTL, a capped attempt count, single use, bound to one action. `/api/health` reports `authorisedForProduction: false` so a demo deployment can never be mistaken for an authenticated one.

**The models are trained on synthetic data.** Evidence metadata from live investigations is protected. Bail outcomes linked to individuals are personal data under the DPDP Act 2023. NJDG publishes aggregate pendency, not the per-case features a delay regressor needs. Every distribution is written out in `ai-service/src/datasets.py` so a reviewer can judge what the models learned. The outputs are decision support, never findings of fact.

**Citizen actions are relayed.** An accused does not hold a funded Sepolia wallet, so the backend's keeper wallet submits their transactions after OTP verification. The Aadhaar token in the transaction is what binds it to them. A production deployment would want account abstraction or a custodial wallet per citizen.

**Sepolia is not a court system.** A production deployment would need a permissioned chain or a Layer 2 with predictable costs, an availability guarantee, and a legal framework recognising an on-chain record. This demonstrates the mechanism.

**The Hardhat 2 toolchain carries open advisories.** `npm run audit` checks what ships and reports zero across contracts, backend and frontend. `npm run audit:all` includes dev dependencies and reports 25 findings in `contracts/`, every one of them inside Hardhat 2's own tree (adm-zip, undici, elliptic, tmp and friends). None of it is deployed: what reaches Sepolia is solc output, and the package is devDependencies only. The fix is Hardhat 3, which is a rewrite with a different config format and different plugin names, and would break a green 53-test suite. That trade is stated rather than hidden.

**RLS does not constrain the API.** Supabase's service role bypasses row level security by design, so the policies in `002_rls.sql` do not police API traffic — the RBAC middleware does. RLS is the second wall, and it is what stands between a leaked anon key and the contents of these tables. Every table has it on; see `docs/design-decisions.md`.

---

## Where the reasoning is written down

- **[`docs/`](docs/)** — all five guides, with an index that says which one you want
- **`docs/api-keys.md`** — every credential, where to get it, what breaks without it
- **`docs/hosting.md`** — Vercel and Render, and the four things that break if you skip it
- **`docs/production.md`** — the six fallbacks a default deployment still uses, and the checklist before real data
- **`docs/design-decisions.md`** — the on-chain/off-chain split, why not just Postgres, and the decisions worth defending
- **`docs/deployment.md`** — exact environment variables per service, and the order to deploy them in
- **`ai-service/src/datasets.py`** — every synthetic distribution, in full
- **`backend/src/otp/UidaiOtpProvider.ts`** — the government-authorisation seam
- **`database/migrations/002_rls.sql`** — the security model, with its own reasoning in the header

---

## Licence

MIT. See the limitations above before deploying any of this near a real proceeding.
