# Presentation — seven slides

Light theme; the NyaySetu mark top left. One idea per slide, large numbers, and
nothing on a slide that cannot be shown on the live system. Speaker notes are
under each slide.

---

## Slide 1 · Title

**NyaySetu — Proof, not paperwork**
Tamper-evident evidence, summons and bail records for Maharashtra's criminal courts.
Governance and civic technology · SDG 16 · Live at nyaysetu-project.vercel.app
Developed by Sai Randive

*Visual:* phone capturing evidence → fingerprint → ledger → courtroom.

> Notes: one sentence — "We make it possible for anyone, including the accused,
> to check that the evidence in court is the evidence that was collected."

---

## Slide 2 · The problem

- More than **50 lakh** cases pending in Maharashtra's district courts, most of them criminal (NJDG)
- Since **1 July 2024**: BNSS §105 video, BNSS §176(3) forensics at the scene, BSA §63 hash certificate
- Three questions settled by someone's word:
  **Was the evidence altered? Was the summons served? Is bail being kept?**

*Visual:* a paper malkhana register beside a forwarded video file.

> Notes: a register records that an item moved, not that it is the same item.

---

## Slide 2a · One real case

**Pune, May 2024 — the swapped blood sample.** In a crash that killed two
people, the driver's sample was allegedly replaced inside a hospital. Caught
only by a tip-off, a second sample and DNA, days later.
**With NyaySetu:** the seal serial bound at collection; the substitute is
refused at the laboratory the same day.

*Visual:* the two-lane replay from `/case-study`, stopped at the laboratory step.

---

## Slide 3 · The solution

**Capture → Anchor → Hand over → Verify → Produce in court**

- SHA-256 fingerprint on the officer's phone, **before upload**; works offline
- Fingerprint on a public blockchain; **personal data never on chain**
- Every hand-over re-checks; a mismatch is **refused and recorded permanently**
- **Anyone** can verify a file — by reference, QR code, or the file alone
- BSA §63 certificate generated from the record, with a QR code

*Visual:* five screenshots in a row.

---

## Slide 4 · What you will see (live)

1. Case replay: the Pune sample swap, caught at the first hand-over
2. Tamper lab: change one bit → the fingerprint changes completely
3. Public verification, no account: original ✅, one-pixel copy ❌
4. Laboratory receives a different seal or file → refused, anchored, alert raised
5. Accused hears obligations read aloud in Marathi
6. Judge sees the bail geo-fence and check-ins on a map
7. §63 certificate PDF → scan the QR → verification opens

---

## Slide 5 · Architecture and quality

Phone / web (React, PWA, Expo offline queue) → API (Node, TypeScript, verification
state machine, role and per-case access) → PostgreSQL with row-level security on
all 48 tables · encrypted IPFS storage · three verified Solidity contracts on
Ethereum · Python models labelled as decision support.

| Measured | Result |
|---|---|
| One-byte tampering detected (200 files) | **100%** |
| Unauthorised access blocked (258 attempts) | **100%** |
| Items lost with 35% of chain writes failing | **0** |
| Automated tests | **194**, plus 44 pages checked for accessibility |

---

## Slide 6 · Feasibility and scale

- **Deployed today**; every subsystem's health is public
- **Cost measured:** 3.6 lakh gas to register an item, 1.56 lakh per hand-over —
  fixed, whatever the file size
- **State rollout:** a permissioned EVM ledger with nodes held by police,
  judiciary, forensic directorate and legal-services authority — no gas fees,
  no single party in control
- **Integration path:** CCTNS / ICJS / e-Courts through the API (designed);
  complements e-Sakshya by anchoring its recordings

---

## Slide 7 · Impact and next step

- Access to justice (SDG 16.3): defence and accused verify independently, in their language
- Accountable institutions (16.6): failures cannot be hidden
- Public information (16.10): live transparency page, no personal data

**Pilot:** Shivajinagar Police Station, Regional Forensic Laboratory Pune, one
Sessions Court, one legal-aid clinic — three months.

**Honest limit:** a matching fingerprint proves a file is unchanged, not that it
is true.
