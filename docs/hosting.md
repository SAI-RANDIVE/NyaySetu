# Hosting NyaySetu

NyaySetu has three deployable parts:

| Part | Where | Why there |
|---|---|---|
| **API** (`backend/`) | **Render** (free web service) | It must run continuously: the 72-hour summons window and missed bail check-ins are noticed by a background loop. |
| **AI service** (`ai-service/`) | Render (optional) | Python; evidence screening and estimates. The app works without it. |
| **Web app** (`frontend/`) | **Vercel** or **Netlify** | Static files plus a rule that forwards `/api/*` to the Render API. |

Because the web host forwards `/api/*` to Render, the browser only ever talks
to one address. Session cookies stay first-party and `SameSite=Strict`, no CORS
configuration is needed, and the site works on browsers that block
third-party cookies.

```
 phone / browser ──► https://nyaysetu.vercel.app ──┬─► static web app
                                                    └─► /api/* ──► https://nyaysetu-api.onrender.com
                                                                         │
                         Supabase (database) ◄──────────────────────────┤
                         Sepolia (contracts via Alchemy) ◄──────────────┤
                         Pinata (encrypted files) ◄─────────────────────┘
```

Before you start: the database must already have migrations 001–012 (see
`docs/api-keys.md`, step 2), the contracts must be deployed
(`contracts/deployed/sepolia.json` committed), and your keys must be in
`.env.hosting` (copy `.env.hosting.example` and fill it in, or use the one
already prepared on your machine).

---

## 1 · The API on Render

1. Push the repository to GitHub.
2. **render.com** → sign in with GitHub → **New +** → **Blueprint** → choose the
   repository. Render reads `render.yaml` and proposes two services,
   `nyaysetu-api` and `nyaysetu-ai`. (Untick the AI service if you do not want it.)
3. When it asks for the values marked *sync: false*, skip them for now and
   click **Apply**. The first deploy will fail health checks; that is expected.
4. Open **nyaysetu-api → Environment → Add from .env**, paste the **whole**
   `.env.hosting` file, and **Save changes**. Render redeploys.
5. When it is live, open `https://nyaysetu-api.onrender.com/api/health`. You
   should see `"status":"ok"`, `database.reachable: true`,
   `database.schema.upToDate: true` and `blockchain.ready: true`.

If Render gave the service a different address (for example because the name
was taken), note it: you will put it into `vercel.json` / `netlify.toml` in
step 3.

> **Email on Render's free plan.** Render blocks outbound SMTP on free
> services, so Gmail sign-in codes will time out there (`/api/health` shows
> `email.reachable: false`). Fix it with a free **Brevo** account: create an
> API key, verify your sender address, then set `EMAIL_TRANSPORT=brevo`,
> `BREVO_API_KEY=<key>` and `SMTP_FROM=NyaySetu Court Services <your verified address>`.
> Until then you can set `LOGIN_OTP_ENABLED=false` to sign in with the password only.

> **Free-tier sleep.** A free Render service sleeps after 15 minutes without
> traffic and takes about a minute to wake. Open the health URL a minute before
> a demonstration.

## 2 · The AI service on Render (optional)

If you kept `nyaysetu-ai` in the blueprint: **nyaysetu-ai → Environment** and
add `AI_SERVICE_KEY` (the same value as in `.env.hosting`) and `HOST=0.0.0.0`.
Its address (e.g. `https://nyaysetu-ai.onrender.com`) must equal
`AI_SERVICE_URL` on the API service. Check `https://nyaysetu-ai.onrender.com/health`.

## 3 · The web app on Vercel (recommended)

1. If your API address differs from `https://nyaysetu-api.onrender.com`, edit
   `frontend/vercel.json` (the `/api/:path*` rewrite) and push.
2. **vercel.com** → **Add New… → Project** → import the repository.
3. **Root Directory: `frontend`**. Framework: **Vite** (detected). Build
   command `npm run build`, output `dist` (already in `vercel.json`).
4. No environment variables are needed. Click **Deploy**.
5. Note the site address (e.g. `https://nyaysetu.vercel.app`). On Render, set
   `PUBLIC_APP_URL` and `CORS_ORIGINS` on `nyaysetu-api` to exactly that address
   and save (it redeploys).

### …or on Netlify

1. If your API address differs, edit `netlify.toml` at the repository root (the
   `/api/*` redirect) and push.
2. **app.netlify.com** → **Add new site → Import an existing project** → GitHub
   → choose the repository. `netlify.toml` sets the base directory, build
   command and publish folder; accept the defaults and deploy.
3. Set `PUBLIC_APP_URL` and `CORS_ORIGINS` on Render to the Netlify address.

### Why not the API on Vercel or Netlify too?

Their functions stop after each request, so the background loop that closes
summons windows and flags missed check-ins cannot run, and request bodies are
limited to about 4.5 MB. Render keeps a process running. (Large evidence files
are uploaded in 2 MB pieces, so the forwarding rule is never the bottleneck.)

## 4 · Sign in

Open the web address, sign in as the super administrator (`randivesai24@gmail.com`),
enter the six-digit code emailed to you, and invite the other participants from
**Participants**. On an Android phone, use **Install app** (or the browser menu →
*Install app*) to add NyaySetu to the home screen.

## 5 · Checks after every deployment

| Check | Expected |
|---|---|
| `GET /api/health` (through the web address: `https://<site>/api/health`) | `status: ok`, schema up to date, chain ready, email reachable |
| Sign in, open **Chain status** (registry) | the three Sepolia contracts and the keeper wallet's balance |
| Capture or upload a test item | it moves to *Confirmed on chain* within a minute or two |
| Open its public passport `/verify/<reference>` | the item verifies; a modified file does not |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every page says the API cannot be reached | Wrong API address in `vercel.json` / `netlify.toml`, or the Render service is asleep | Fix the address and redeploy; open the health URL to wake it |
| Sign-in returns 403 "origin" | `CORS_ORIGINS` does not match the site address exactly | Set it to the exact `https://…` address, no trailing slash |
| Sign-in code never arrives | SMTP blocked on Render free | Use Brevo (above) |
| Features answer `SCHEMA_OUT_OF_DATE` | Migrations missing | Run `database/upgrade_2_0.sql` in the Supabase SQL Editor |
| Items stay *Submitted* | Keeper wallet out of Sepolia ETH, or RPC down | Fund the wallet from a faucet; check `CHAIN_RPC_URL` |
| Evidence files missing after a redeploy | Pinata not configured (local disk is wiped) | Set `PINATA_JWT` |
| Everyone hits the sign-in rate limit together | `TRUST_PROXY_HOPS` not 2 behind the web host | Set `TRUST_PROXY_HOPS=2` |

## Custom domain (optional)

Add your domain to the Vercel/Netlify project (for example `nyaysetu.in`) and set
`PUBLIC_APP_URL` and `CORS_ORIGINS` on Render to `https://nyaysetu.in`. Nothing
else changes, because the API is still reached through the site's `/api`.
