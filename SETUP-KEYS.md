# What I need from you

Every credential this project uses, where to get it, and what breaks without it.

**Only one is mandatory: Supabase.** Everything else degrades gracefully — the affected feature reports itself unavailable on `/api/health` instead of crashing, so you can add keys one at a time and watch each subsystem come up.

Paste the values into **`backend/.env`**. That file is git-ignored and already exists with the two cryptographic secrets generated and a local chain wired up, so you are filling in blanks rather than starting over.

---

## Priority order

Work top to bottom. Each row says what you lose by skipping it.

| # | Credential | Required? | Without it |
|---|---|---|---|
| 1 | Supabase URL + secret key | **Yes** | Nothing works. No accounts, no cases, no sessions. |
| 2 | Gmail App Password | For email OTP | Sign-in is password-only. No summons notices. |
| 3 | Sepolia RPC URL + wallet key | For a public chain | Falls back to a local chain, which works fully but only on your machine. |
| 4 | Pinata JWT | For real IPFS | Encrypted files go to `backend/storage/` instead. |
| 5 | Etherscan API key | Optional | Contract source is not published. Everything else identical. |

---

## 1 · Supabase — the only mandatory one

**What it is:** managed Postgres. Holds accounts, cases, evidence metadata, sessions and the audit trail.

**Cost:** free tier is enough.

### Steps

1. Go to **[supabase.com](https://supabase.com)** → sign in with GitHub → **New project**.
2. Name it `nyaysetu`. Choose the region closest to you (**Mumbai** if offered). Set a database password and save it somewhere, though this project does not use it directly.
3. Wait about two minutes for provisioning.
4. Open the **SQL Editor** and run these six files in order, one at a time. Paste each file's contents, press Run, wait for success, then move to the next.

   ```
   database/migrations/001_schema.sql        tables, enums, indexes
   database/migrations/002_rls.sql           row level security, default deny
   database/migrations/003_audit.sql         audit triggers
   database/migrations/004_otp_channels.sql  email OTP channel, email log
   database/migrations/005_pii_access.sql    PII access functions
   database/seed/reference.sql               role reference rows
   ```

   `002` prints `RLS verified: every table...` at the end. If it prints a warning instead, stop and tell me.

   There is **no dashboard step**. An earlier version needed `restricted` added under
   Settings → API → Exposed schemas; migration `005` removes that requirement by
   reaching the PII table through four `SECURITY DEFINER` functions instead. The
   schema now stays unreachable over the API entirely, which is both less setup
   and a smaller surface.

5. Still on **Settings → API**, copy two values:

   | Label on the page | Goes into |
   |---|---|
   | **Project URL** | `SUPABASE_URL` |
   | **`service_role`** secret, or a **secret key** (`sb_secret_…`) on newer projects | `SUPABASE_SERVICE_ROLE_KEY` |

### What to send me

```dotenv
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

> **Take the secret key, not the publishable/anon one.** The anon key is deliberately powerless here; every request would be refused by row level security. The secret key bypasses RLS, which is why it stays on the server and never reaches the browser or the phone.

---

## 2 · Gmail App Password — for emailed sign-in codes

**What it is:** SMTP credentials so the API can send email. Two things use it:

- the six digit code after your password, which is the **real** second factor in this project
- a notice to a summons recipient that one exists, and an alert to the court when a window closes unanswered

**Cost:** free.

### Steps

1. Go to **[myaccount.google.com/security](https://myaccount.google.com/security)** and turn on **2-Step Verification** if it is not already on. App Passwords do not exist without it.
2. Go to **[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**.
3. Type `NyaySetu` as the name and press **Create**.
4. Google shows **16 characters in four groups of four**. Copy it and **remove the spaces**.

### What to send me

```dotenv
SMTP_USER=yourname@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
```

> **Your ordinary Google password will not work.** Google answers `Username and Password not accepted`, and that is the single most common setup mistake here. `/api/health` names this cause explicitly when it happens, so you will not be guessing.

### Also worth setting

```dotenv
BOOTSTRAP_ADMIN_EMAIL=yourname@gmail.com
BOOTSTRAP_ADMIN_NAME=Your Name
```

This is the account `npm run bootstrap` creates: the one court administrator, and
the only account that is not created from inside the platform. Use the same
mailbox as `SMTP_USER` or any other address you can read — every sign-in emails a
six digit code to it.

**Demonstrating more than one role from one mailbox.** Invite the other accounts
with plus-addressed aliases of the same inbox — `yourname+judge@gmail.com`,
`yourname+police@gmail.com`. Gmail, Outlook and Fastmail all deliver those to the
same place, so one mailbox receives the sign-in codes for every role, and each is
still a genuinely separate account with its own password and its own audit trail.

**If you would rather not use email at all:** set `LOGIN_OTP_ENABLED=false` and sign-in stays password-only. Everything else works, including invitations — the password is then shown to the administrator in the browser instead of being emailed.

---

## 3 · Sepolia — for a public blockchain

**What it is:** a free Ethereum test network. Without it the project runs on a local chain that works completely but exists only on your machine, so you cannot show a transaction to anyone on Etherscan.

**Cost:** free. Test ETH has no value.

### 3a · An RPC URL

1. Go to **[alchemy.com](https://www.alchemy.com)** → sign up → **Create new app**.
2. Chain **Ethereum**, network **Sepolia**.
3. Copy the **HTTPS** URL. It looks like `https://eth-sepolia.g.alchemy.com/v2/AbC123...`

Infura and QuickNode work identically if you prefer them.

### 3b · A throwaway wallet

1. Install **[MetaMask](https://metamask.io)**, create a **brand new** wallet. Do not reuse one that holds anything.
2. Switch the network to **Sepolia** (Settings → Advanced → Show test networks, then pick Sepolia from the dropdown).
3. Copy the address, then export the private key: **⋮ → Account details → Show private key**.

> This key goes into a plain text file. Create it for this project and never put real funds in it.

### 3c · Fund it

Paste the address into any of these:

- [sepoliafaucet.com](https://sepoliafaucet.com) (Alchemy, needs the account from 3a)
- [cloud.google.com/application/web3/faucet/ethereum/sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
- [sepolia-faucet.pk910.de](https://sepolia-faucet.pk910.de) (mines in the browser, no sign-up)

**0.05 ETH** covers deploying all three contracts plus a few hundred demo transactions.

### What to send me

```dotenv
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/AbC123...
DEPLOYER_PRIVATE_KEY=0xabc123...        # 64 hex characters after the 0x
WALLET_ADDRESS=0xYourAddress            # so I can check the balance
```

The same key serves as `CHAIN_PRIVATE_KEY` for the backend. It is the "keeper" wallet that submits transactions for citizens after their OTP is verified, since no ordinary person holds a funded blockchain wallet.

---

## 4 · Pinata — for real IPFS storage

**What it is:** a pinning service that keeps files available on IPFS. Evidence files are encrypted with AES-256-GCM **before** they go anywhere near it, so Pinata never holds anything readable.

**Cost:** free tier gives 1 GB, far more than a demo needs.

### Steps

1. Go to **[pinata.cloud](https://pinata.cloud)** → sign up.
2. **API Keys → New Key**.
3. Under Admin toggles, enable **`pinFileToIPFS`**. That is the only permission needed.
4. Name it `NyaySetu` and create it. Copy the **JWT** — the long one, not the API key or secret.

### What to send me

```dotenv
PINATA_JWT=eyJhbGciOiJIUzI1NiIs...
```

Skip it and encrypted blobs are written to `backend/storage/blobs/` instead. Every other part of the evidence flow is identical; `/api/health` reports `storage.backend: local-fallback` so nobody mistakes it for production.

---

## 5 · Etherscan — optional

Publishes the contract source so anyone can read what was deployed. Nice for a viva, irrelevant to whether anything works.

1. **[etherscan.io/myapikey](https://etherscan.io/myapikey)** → sign up → **Add** an API key.

```dotenv
ETHERSCAN_API_KEY=ABC123...
```

---

## The fastest path

If you want to see the whole thing working with the least effort:

1. **Supabase** (step 1) — five minutes, and unavoidable.
2. **Gmail App Password** (step 2) — five minutes, and it is the piece that makes the login genuinely real.
3. Skip Sepolia and Pinata for now. The local chain and local storage give you every feature; you just cannot link a stranger to a transaction.

Add Sepolia and Pinata later when you want the public-chain demonstration. Nothing needs rewriting; they are environment variables.

---

## Already wired in

As of the latest commit these are configured in `backend/.env` and verified live:

| | Status |
|---|---|
| Supabase | connected, authenticated, all 16 tables present |
| Gmail SMTP | authenticated as `apurva.sanpurkar25@vit.edu`, sign-in codes and notices will send |
| Local blockchain | 3 contracts deployed, keeper funded |
| AI models | all three loaded |

**One step remains, and only you can do it:** run
`database/migrations/005_pii_access.sql` in the Supabase SQL editor. It creates
the four functions that reach the Aadhaar table. Until then Aadhaar capture stops
with a message pointing at it.

Still optional: Sepolia (for a public chain) and Pinata (for real IPFS). The
local chain and local storage give every feature; you just cannot link a
stranger to a transaction on Etherscan.

---

## How to send them

Paste this filled in, in one message:

```dotenv
# --- required ---
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# --- email (recommended) ---
SMTP_USER=
SMTP_PASSWORD=

# --- public chain (optional) ---
SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=

# --- IPFS (optional) ---
PINATA_JWT=

# --- source verification (optional) ---
ETHERSCAN_API_KEY=
```

Leave any line blank to skip it. I will wire them in, run the migrations check, create the first administrator, start every service, and report what each subsystem says about itself.

---

## What happens the moment you send them

1. Values go into `backend/.env` and `contracts/.env`. Neither is ever committed.
2. `npm run bootstrap` creates one court administrator and prints its password.
   Every other account is invited from `/admin`; there is no demo cast.
3. Contracts deploy to Sepolia if you supplied a key, otherwise the local chain.
4. Everything starts; `/api/health` is checked subsystem by subsystem.
5. `npm run chain:check` runs its 24 integration checks against the live chain.
6. You get the sign-in URL and the administrator's credentials, and from `/admin`
   you invite one account per role and put them on a case.

---

## A note on these secrets

Two of the values in `backend/.env` are already generated and should never change once real data exists:

- **`AADHAAR_TOKEN_PEPPER`** is mixed into every stored Aadhaar token. Change it and every existing token becomes unmatchable, so every OTP flow fails permanently. There is no recovery.
- **`EVIDENCE_ENCRYPTION_KEY`** decrypts every stored evidence file. Lose it and the evidence is gone.

They are in `backend/.env` now, git-ignored. Before anything resembling a real deployment, regenerate both and put them in a secrets manager. `DEPLOYMENT.md` covers that.

And the obvious one: a private key in a text file is fine for a throwaway testnet wallet and unacceptable for anything else. Never reuse a wallet that holds real funds.
