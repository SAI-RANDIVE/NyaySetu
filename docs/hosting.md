# Hosting NyaySetu

Written for whoever is putting this online, which is probably you with a Vercel
tab already open.

---

## Read this before you click Deploy

Importing this repo into Vercel as-is will build the frontend correctly and give
you a broken API. Four things break, and none of them announce themselves:

1. **The scheduler dies.** Two behaviours in this project are the *absence* of a
   transaction: a summons nobody acknowledged inside 72 hours, and a bail
   check-in that never happened. Absences cannot emit events, so a loop in the
   API process notices them and writes the conclusion down. A serverless
   function is killed after it answers a request, so that loop never ticks. The
   summons window silently stops working — which is one of the three modules the
   project is about.

2. **Evidence upload breaks.** With no Pinata key the API encrypts the file and
   writes it to `storage/blobs`. A serverless filesystem is read-only apart from
   `/tmp`, and `/tmp` is gone by the next request. So on serverless, Pinata stops
   being optional.

3. **`CHAIN_RPC_URL=http://127.0.0.1:8545` points at your laptop.** Nothing
   hosted can reach it. You need Sepolia and the contracts deployed there.

4. **`AI_SERVICE_URL=http://127.0.0.1:5001` is the same problem.** The Flask
   service is a separate process; it has to be hosted separately or left blank.

Fixes for all four are below. Pick one of the two paths.

---

## Path A — recommended: Vercel for the site, Render for the API

Keeps a long-running Node process, so the scheduler and the event indexer work
exactly as they do locally. Both free tiers are enough for a project demo.

### 1. Deploy the API to Render

`render.yaml` in the repo root already describes the service, so:

- render.com → **New** → **Blueprint** → pick this repository.
- It reads `render.yaml` and creates a web service rooted at `backend/`.
- Fill in the environment variables it marks as required (list below).
- Note the URL it gives you, e.g. `https://nyaysetu-api.onrender.com`.

Render's free tier sleeps after 15 minutes idle and takes ~40s to wake. For a
viva, open the API URL a minute before you start.

### 2. Deploy the frontend to Vercel

- Import the repo. **Set Root Directory to `frontend`.** Do not use the
  multi-service preset; you are only deploying the static build.
- Framework preset: Vite. Build `npm run build`, output `dist`.
- Environment variable: `VITE_API_BASE=https://nyaysetu-api.onrender.com`
- `frontend/vercel.json` already handles SPA rewrites and security headers.

### 3. Make the cookies work across the two domains

This is the step people miss. The SPA is on `vercel.app`, the API is on
`onrender.com`, so the session cookie is now cross-site. On the **API**:

```
CORS_ORIGINS=https://your-project.vercel.app
COOKIE_SAMESITE=none
PUBLIC_APP_URL=https://your-project.vercel.app
NODE_ENV=production
```

`SameSite=none` requires `Secure`, which requires HTTPS — both platforms give you
that, and `NODE_ENV=production` turns it on.

**Get `CORS_ORIGINS` wrong and every request fails before it reaches a route**,
which in a browser reads as `No 'Access-Control-Allow-Origin' header is present`
and is indistinguishable from the API being offline. Two things make it settleable:

- `GET /api/health` returns `allowedOrigins`, so you can see what the running
  process actually loaded rather than what the dashboard says. If your site's
  origin is not in that array, nothing else you try will work.
- The API logs a refused origin at error level with both values side by side.

A trailing slash, a capital letter or a space after a comma are all absorbed. The
scheme and the host are not: `http://` and `https://` are different origins and
must be listed separately.

For Vercel preview deployments, which get a fresh URL per commit, one entry may
carry a single wildcard subdomain:

```
CORS_ORIGINS=https://nyaysetu-eta.vercel.app,https://*.vercel.app
```

The wildcard matches one label and never a dot, so `https://you.vercel.app.evil.com`
is still refused. It is opt-in and logged as a warning at boot, because it does
widen the set of sites that may send credentialed requests to everything on that
domain — fine for a project, not for real evidence.

> Want one origin and no cross-site cookies at all? Put both behind one domain:
> point `nyaysetu.example.in` at Vercel and `api.nyaysetu.example.in` at Render,
> then set `COOKIE_DOMAIN=.nyaysetu.example.in` and keep
> `COOKIE_SAMESITE=strict`.

---

## Path B — everything on Vercel

Workable, with the scheduler moved to Vercel Cron. Use this if you want one
dashboard and can accept the extra setup.

Use the multi-service `vercel.json` Vercel offered you, then on the backend
service set:

```
SCHEDULER_ENABLED=false     # the in-process loop cannot survive; cron replaces it
INDEXER_ENABLED=false       # same reason
CRON_SECRET=<64 random hex> # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PINATA_JWT=<required here>  # there is no writable disk to fall back to
```

Setting `CRON_SECRET` mounts `POST /api/health/sweep`. It does exactly what the
in-process scheduler did — index new events, close the 72 hour summons window,
flag missed bail check-ins — and authenticates with a bearer token instead of a
session, because a cron has no cookies. With the secret unset the route is not
mounted at all; it is never mounted and unprotected.

Add to the root `vercel.json`:

```json
"crons": [{ "path": "/api/health/sweep", "schedule": "*/10 * * * *" }]
```

Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically. Verify it
by hand once:

```bash
curl -X POST https://your-project.vercel.app/api/health/sweep \
  -H "Authorization: Bearer $CRON_SECRET"
```

Because both services sit behind one domain, cookies stay same-origin, so keep
`COOKIE_SAMESITE=strict` and set `CORS_ORIGINS` to that one domain.

---

## Email, hosted: SMTP will not work

**Render, Fly, Vercel and most container platforms block outbound SMTP.** Ports
25, 465 and 587 are dropped, and dropped silently — the connection is accepted
and then nothing happens, so nodemailer reports

```
SMTP verification failed  error: "Connection timeout"  code: "ETIMEDOUT"
```

which is indistinguishable from a wrong App Password. It is not a credentials
problem and no SMTP setting fixes it. SMTP simply cannot leave the container.

Port 443 always can. So set one API key and the same messages — sign-in codes,
invitations, summons notices, the Final Report — go out over HTTPS instead. The
app prefers an HTTP provider over SMTP whenever a key is present, because the only
reason to configure one is that SMTP does not work where it is running.

| | Brevo | Resend |
|---|---|---|
| Verifies | a single **sender address** | a **domain** |
| Without a domain | sends to **anyone** | only to the account owner's own address |
| Free tier | 300/day | 3,000/month |
| Use it when | you do not own a domain | you do |

**With Brevo, which is the one to reach for first:**

1. brevo.com → sign up.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender.** Use the address
   you want mail to come from. Click the confirmation email.
3. **SMTP & API → API keys → Generate a new API key.** It is a v3 API key, not an
   SMTP password.
4. On the API host:
   ```
   BREVO_API_KEY=xkeysib-…
   SMTP_FROM=NyaySetu <the-address-you-just-verified>
   ```
   Leave `EMAIL_TRANSPORT=auto`. Remove nothing: the SMTP variables stay for local
   development, and are ignored while a key is present.

Confirm it with `curl https://your-api-host/api/health` and read `subsystems.email`:
`transport` should say `brevo` and `reachable` should be true. That check proves the
key is accepted; it cannot prove the sender address is verified, so if sending
still fails the error will say `sender` and step 2 is the answer.

> **To get in right now, before any of this:** set `LOGIN_OTP_ENABLED=false` on the
> API. Sign-in drops to password-only and the portal opens. Turn it back on once
> codes are arriving — it is a real control and should not stay off.

## The chain, hosted

Local Hardhat is not reachable from anywhere. To put the contracts online:

1. **RPC endpoint** — alchemy.com → Create App → Ethereum → Sepolia. Free.
   Put it in `contracts/.env` as `SEPOLIA_RPC_URL`.
2. **A throwaway wallet** —
   `node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"`.
   Never a key that has touched mainnet. Fund it from sepoliafaucet.com; 0.1
   test ETH covers a deploy and hundreds of transactions.
3. **Deploy** — `cd contracts && npm run deploy:sepolia`. It writes
   `contracts/deployed/sepolia.json` with the addresses and ABIs, and prints the
   addresses.
4. **Tell the API** — on the host:
   ```
   CHAIN_RPC_URL=<the same Alchemy URL>
   CHAIN_PRIVATE_KEY=<the same throwaway key>
   CHAIN_NETWORK=sepolia
   CHAIN_CONFIRMATIONS=2
   EVIDENCE_CHAIN_ADDRESS=0x…
   SUMMONS_CHAIN_ADDRESS=0x…
   BAIL_CHAIN_ADDRESS=0x…
   ```
   The addresses are set explicitly because `contracts/deployed/` is not part of
   the backend's deployment artefact.

The keeper wallet relays citizen actions, so it needs ETH. `/api/health` reports
its balance; when it runs dry, chain writes start failing and reads keep working.

Leave all of it blank and the platform still runs: every anchored action reports
`503 chain unavailable` instead of pretending it was recorded.

## The AI service, hosted

Render again — `render.yaml` includes it, commented out. It is a Python service,
so it needs its own runtime; it cannot share the Node one. Host it, set
`AI_SERVICE_URL` and a matching `AI_SERVICE_KEY` on both sides, or leave
`AI_SERVICE_URL` blank and screening reports itself unavailable rather than
claiming an item is clean.

---

## Environment variables on the host

Copy from `backend/.env`, with these **changed**:

| Variable | Local | Hosted |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `CORS_ORIGINS` | `http://localhost:5173` | your site's HTTPS origin |
| `COOKIE_SAMESITE` | `strict` | `none` on Path A, `strict` on Path B |
| `PUBLIC_APP_URL` | `http://localhost:5173` | your site's HTTPS origin |
| `CHAIN_RPC_URL` | `http://127.0.0.1:8545` | your Sepolia RPC, or blank |
| `CHAIN_NETWORK` | `localhost` | `sepolia` |
| `AI_SERVICE_URL` | `http://127.0.0.1:5001` | its hosted URL, or blank |
| `SCHEDULER_ENABLED` | `true` | `false` on Path B |
| `INDEXER_ENABLED` | `true` | `false` on Path B |
| `OTP_ECHO_IN_RESPONSE` | `true` | ignored — forced off in production |

**Carry over unchanged:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`AADHAAR_TOKEN_PEPPER`, `EVIDENCE_ENCRYPTION_KEY`, `EVIDENCE_ENCRYPTION_KEY_ID`,
`SMTP_*`, and the rate-limit and lockout values.

**Two of these are not rotatable.** Changing `AADHAAR_TOKEN_PEPPER` invalidates
every stored Aadhaar token, and changing `EVIDENCE_ENCRYPTION_KEY` makes every
already-encrypted file undecryptable. Set them once and copy them exactly.

**Nothing from `frontend/.env` is secret and nothing in it may become secret.**
Vite inlines every `VITE_` variable into the bundle, so anything there is
readable by anyone who opens the site. The Supabase key belongs to the API only.

---

## After the first deploy

```bash
# 1. Migrations. Supabase blocks DDL over the API, so paste each file into
#    the SQL editor at supabase.com/dashboard → SQL Editor, in order:
#    001_schema, 002_rls, 003_audit, 004_otp_channels, 005_pii_access,
#    006_invitations, 007_account_removal

# 2. The one account the system cannot create for itself.
#    Run it against the hosted database, from your machine, with
#    backend/.env pointing at the same Supabase project:
cd backend && npm run bootstrap

# 3. Confirm what is actually wired up.
curl https://your-api-host/api/health
```

`/api/health` is the honest answer to "is it working": it reports the database,
the chain and its keeper balance, the storage backend, the model service, the
mailer and the identity provider separately, so a partial deployment tells you
which part is partial instead of failing as a whole.

Then sign in at `https://your-site/login` with the address and password
`npm run bootstrap` printed, and invite everybody else from `/admin`.
