# Demonstration kit

Two image files that differ in exactly one pixel, for showing what
verification detects.

| File | SHA-256 |
|---|---|
| `exhibit-original.png` | `0x61986c8e5c3f67fa422cc5a634eebcfdf274ff44aff51b0c31d1944675b8c53d` |
| `exhibit-altered.png` | `0x2a07f20b4e78659eb48e677a9bfea6c3fbcc21713741dbb92016a9aca620f3cc` |

The altered copy changes the red channel of pixel (400, 400) by one, from 0 to
1. The two images look identical, but their fingerprints share almost no
characters.

## Using them

1. Sign in as police and capture `exhibit-original.png` as evidence on a case.
   Wait for **Confirmed on the ledger**.
2. Open `/verify/<public reference>` in a private window.
   - Drop `exhibit-original.png`: it **matches**.
   - Drop `exhibit-altered.png`: it **does not match**, and the page shows both
     fingerprints.
3. Sign in as the laboratory and accept custody with `exhibit-altered.png`.
   The hand-over is refused, the mismatch is anchored on chain, and an alert is
   raised.

The **Tamper lab** on `/transparency` shows the same effect with any file,
entirely in the browser.

## A full record in one command

The script reads one-time sign-in codes from the database, so it needs the
same Supabase database as the API it drives: `backend/.env` filled in, and
either `npm run api` running locally or `FLOW_BASE_URL` pointing at a hosted
API that uses that database. (`npm run local` keeps its data in memory inside
the API process, so the script cannot reach it.)

```bash
npm run demo:data -- <admin-email> <admin-password>
# against the hosted API
FLOW_BASE_URL=https://nyaysetu-project.vercel.app npm run demo:data -- <admin-email> <admin-password>
```

This drives the complete lifecycle over HTTP: a case at Shivajinagar Police
Station, evidence capture, laboratory custody, a refused tampered hand-over,
prosecution and court custody, a summons acknowledged with OTP and location,
and bail with check-ins inside and outside the geo-fence. It leaves everything
in place and prints the sign-in details for each role.
