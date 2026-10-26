# Demonstration video — about 4½ minutes

Record at 1080p: the screen, plus the phone (a stand, or mirrored with
`scrcpy`). Narrate in English with Marathi or Hindi on screen where relevant.
Every shot is a real screen of the live system, not a slide.

## Before recording

1. Fill the live system with a complete record:
   `FLOW_BASE_URL=https://nyaysetu-project.vercel.app npm run demo:data -- <admin-email> <admin-password>`
   (requires `backend/.env` pointing at the production database; add
   `--mail you@example.com` to receive the sign-in codes for the created roles).
2. Keep `docs/demo-kit/exhibit-original.png` and `exhibit-altered.png` at hand.
3. A second browser profile (or private window) for the public checks.
4. Phone on the same Wi-Fi, with the web app installed from the browser.
5. Fallback with no internet: `npm run local`.

## Shot list

| Time | Shot | Narration |
|---|---|---|
| 0:00–0:20 | Presenter on camera | "NyaySetu makes evidence, summons and bail in Maharashtra's criminal courts verifiable by anyone." |
| 0:20–0:50 | `/case-study` → Play to the laboratory step | "Pune, May 2024: a blood sample in a fatal crash case was swapped inside a hospital, and was caught only by a tip-off and DNA, days later. Watch the same day with NyaySetu: the substitute vial's seal doesn't match the ledger, and the laboratory refuses it the same afternoon." |
| 0:50–1:20 | Transparency → Tamper lab → sample → change one bit | "This is the whole idea. Change a single bit, and the fingerprint changes completely." |
| 1:20–2:00 | Phone: capture a photo; aeroplane mode, capture another; reconnect | "The fingerprint is computed on the phone before upload. Without signal it waits safely and syncs later — never twice." Show *Confirmed on chain* and the Etherscan link. |
| 2:00–2:40 | Private window: `/verify` → drop original (match), drop altered copy (no match); then "Use the file itself" with no reference | "No account. The defence, the court, the accused can check a file against the blockchain — not against the police database. They don't even need the reference." |
| 2:40–3:05 | Laboratory accepts with a different file → refused; Alerts page | "A mismatch is written to the ledger and an alert is raised. It can never be quietly fixed." |
| 3:05–3:30 | Accused portal in मराठी → Listen | "For the accused, obligations are explained in Marathi or Hindi and read aloud." |
| 3:30–3:50 | Judge → Bail → Map | "The judge sees the geo-fence and every check-in. The contract decided each verdict." |
| 3:50–4:10 | Generate the §63 certificate; scan its QR with the phone | "The certificate is filled from the record, and its QR code lets anyone verify the paper itself." |
| 4:10–4:30 | Transparency page: counts, transactions, cost per record | "Live, measured, and public — with no personal data. Next: a pilot with one Pune police station. Thank you." |
