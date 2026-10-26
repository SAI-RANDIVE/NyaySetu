# Questions an evaluator will ask, and where the system answers them

Each answer is short enough to say in thirty seconds, and each points to
something that can be **shown** on the live system rather than asserted.
Live: https://nyaysetu-project.vercel.app

---

## A. The idea and its novelty

**0. Show me a real case where this would have mattered.**
Pune, May 2024: in a fatal crash case, the minor driver's blood sample was
allegedly swapped inside a hospital with his mother's blood. It was caught only
because police had a tip-off, drew a second sample and compared DNA days later.
With NyaySetu the seal serial is bound at collection; the substitute vial
carries a different seal and is refused at laboratory intake the same day.
*Show:* `/case-study` → Play; then "Try the swap yourself".

**0a. A hash only works for files. Most evidence is physical.**
Correct, which is why physical exhibits are bound to the serial of their
tamper-evident seal. The salted digest is anchored when sealed; each receiving
party reads the serial; a different one is refused, anchored and alerted.
*Show:* an exhibit page → "Tamper-evident seal"; laboratory intake asks for the
serial.

**1. Why blockchain? Why not a well-secured database with audit logs?**
Because the party that runs the database is the party whose handling of the
evidence may be challenged. The defence cannot be asked to trust the
prosecution's own log. A public ledger that no party in the case controls lets
anyone check, without permission. Only 32-byte fingerprints go on chain; the
readable record stays in PostgreSQL.
*Show:* `/verify` in a private window, no account; the transaction link on
Etherscan.

**2. What exactly is new here? Hashing evidence is not new.**
Four things together: the fingerprint is computed on the officer's device
before upload; verification needs no permission and no account; a failed check
is written to the ledger permanently and blocks the hand-over; and evidence,
summons and bail share one verifiable record. A file can even be verified
without its reference.
*Show:* capture screen showing the fingerprint before upload; `/verify` →
"No reference? Use the file itself".

**3. How is this different from e-Sakshya?**
e-Sakshya records search-and-seizure media for BNSS §105 and stores it with the
government. NyaySetu provides independent, public verification and follows the
item through malkhana, laboratory, prosecution and court, and covers summons and
bail. It complements e-Sakshya: the fingerprint of each e-Sakshya recording can
be anchored and re-checked at every later hand-over.

**4. The Department of Justice already has "Nyaya Setu".**
That is a WhatsApp legal-information chatbot. This project is a record system
for evidence, summons and bail; the purposes do not overlap.

---

## B. Does it actually work?

**5. Is it deployed, or is it a mock-up?**
Deployed and live, with real transactions on Ethereum Sepolia from three
source-verified contracts.
*Show:* the status line in the site header ("All services operational ·
Ethereum sepolia"); `/api/health`; the contracts on Etherscan; `/transparency`.

**6. Show me tampering being caught.**
*Show:* `/transparency` → Tamper lab → "Use a sample" → "Change one bit": the
fingerprint changes almost completely. Then `/verify/<reference>` with
`docs/demo-kit/exhibit-original.png` (match) and `exhibit-altered.png`, which
differs in one pixel (no match).

**7. What happens when a tampered item reaches the laboratory?**
The laboratory re-hashes on arrival. A mismatch is anchored on chain, the
custody transfer is refused, and alerts go to the prosecution and the court.
It cannot be corrected quietly; a later genuine transfer is a separate record.
*Show:* Alerts page; the item's state history showing "Integrity mismatch".

**8. How do you know it works beyond a demo?**
183 automated tests (53 contract, 121 API, 9 mobile), plus a browser test of all
44 pages for errors and accessibility. Measured: 100% of one-byte changes
detected across 200 files; 100% of 258 unauthorised access attempts blocked; no
items lost with 35% of chain writes failing.
*Show:* `docs/metrics/METRICS.md`; `npm test` output.

---

## C. Law and admissibility

**9. Is a blockchain record admissible in court?**
The court relies on the BSA §63 certificate, which must state the hash value.
NyaySetu generates that certificate from the record, with the digest anchored
on chain and a QR code so the court can verify the paper itself. The ledger is
supporting proof of integrity, not a replacement for the certificate.
*Show:* Generate the §63 certificate PDF; scan its QR code with a phone.

**10. Which provisions does it support?**
BNSS §105 (recorded search and seizure), BNSS §176(3) (forensic collection at
the scene), BSA §63 (hash certificate), BNSS summons and bail provisions.
*Show:* the "Why now" section on the home page.

**11. Does a matching hash prove the evidence is genuine?**
No, and the system says so on its home page. It proves the file has not changed
since it was anchored. How it was collected, and what it shows, remain matters
for the court. GPS accuracy, device time and mocked-location flags help the
court weigh it.

---

## D. Privacy and security

**11a. Under some State e-Sakshya rules the accused must pay to have a hash checked. Does that apply here?**
No. Verification is a public page and a public API: drop the file, get the
ledger's answer, at no cost and without anyone's permission. Commentary on
Madhya Pradesh's 2026 rules (LiveLaw, 11 Aug 2026) identifies exactly this
cost as a fairness gap.

**11b. Does the Supreme Court accept hash values?**
Yes. In *Pune Bar Association v. Union of India* (22 May 2026) the Court upheld
BSA §63(4) and described a hash value as "synonymous with an electronic
fingerprint". NyaySetu computes it at the scene and makes it checkable by all.

**12. A public blockchain is permanent. What personal data is on it?**
None that identifies anyone. Case keys are salted hashes; no names, FIR
numbers, addresses or file contents. Files are encrypted with AES-256-GCM and
stored off chain. One exception, stated openly: bail check-in coordinates are
on chain because the contract computes the geo-fence; moving that to a
zero-knowledge proof is planned.
*Show:* home page section "What goes on a public blockchain, and what never
does"; a passport page showing no names or places.

**13. Who can see what?**
Seven roles, each seeing only its part. Per-case assignment is enforced by the
API and again by row-level security in the database. Defence access is
requested and approved by the court. Every action and every refusal is logged.
*Show:* Admin → Audit; Defence → Access requests.

**14. What if someone steals an officer's account?**
Password plus an emailed one-time code; sessions are server-side and the
registry can revoke them instantly; sensitive actions need two-person approval.
Anything the attacker registers is attributed to that account on chain.

**15. What if the officer's phone is compromised before hashing?**
Then the proof starts from the compromised file — no system can prove what
happened before capture. Device time, GPS accuracy, clock skew and mocked
location are recorded, and the anomaly screen flags implausible captures for
review.

**16. Is it compliant with the DPDP Act, 2023?**
Personal data stays in a database where it can be corrected or erased; the
ledger holds only non-identifying fingerprints and keys, so erasure obligations
do not collide with immutability.

---

## E. Feasibility, cost and scale

**17. What does it cost per record?**
Measured, not estimated: registering an item uses 3,60,093 gas; each custody
transfer 1,56,407; scene to court about 8.3 lakh gas, independent of file size.
On the public testnet this is free. On Ethereum mainnet it would be too
expensive at state scale, so the recommendation for the State is a
permissioned EVM network (no gas fees) or a layer-2 network.
*Show:* `/transparency` → "What a record costs"; `npm --prefix contracts run gas`.

**18. Can it handle Maharashtra's volume?**
The API is stateless and scales horizontally; PostgreSQL handles lakhs of
records a year comfortably. The ledger is the constraint, addressed by a
permissioned network, by batching many fingerprints into one Merkle root, and
by adding signers.

**19. Police stations have poor connectivity.**
The field app queues captures on the phone with an idempotency key and syncs
when signal returns, without duplicates.
*Show:* aeroplane mode during capture, then reconnect.

**20. Will officers actually use it?**
Capture is the same as taking a photo; the fingerprint is automatic. It removes
work: the §63 certificate and custody record are generated instead of typed.
The handbook explains every role's steps publicly.

**21. How would it integrate with CCTNS, ICJS and e-Courts?**
Through its HTTP API. Any system can verify a file by posting only its
fingerprint to the public lookup endpoint, and the case, summons and bail
records can be exchanged with ICJS. No government system is connected today;
the exchange design, which needs each owning agency's approval, is in
`docs/INTEGRATION.md`.

**22. Who runs the ledger in production? Isn't a government-run chain just a database?**
Validator nodes held by institutions with different interests — police,
judiciary, forensic directorate, a legal-services authority — so that no single
party can rewrite the record. Fingerprints can additionally be checkpointed to a
public network periodically.

---

## F. Inclusion and impact

**23. How does this help ordinary people?**
The accused sees obligations in Marathi, Hindi or English, has them read aloud,
can give a reason for a missed check-in, and can verify evidence against them.
Anyone can verify a file without an account.
*Show:* Accused portal → "Listen"; switch language in the header.

**24. Is it accessible?**
Large-text mode, light and dark themes, keyboard navigation, screen-reader
labels; every page tested with axe-core. Installable on Android from the
browser; works on low-end phones.

**25. How will you measure impact?**
In a pilot: share of exhibits with a complete verified chain of custody; custody
disputes in court; adjournments for service of summons; seizure-to-laboratory
time; missed check-ins detected within a day; time to produce a §63 certificate.

---

## G. Honesty and next steps

**26. What does it not do yet?**
Citizen one-time codes use a sandbox provider (real Aadhaar needs a licensed
agency); Hindi and Marathi text needs review by native speakers; the ledger is a
testnet; device-signed captures are next.

**27. What do you need to go further?**
A pilot partner — one police station, the regional forensic laboratory, one
court and a legal-aid clinic — and guidance on integration with ICJS and on the
State's preferred ledger infrastructure.
