# Problem statement

**Title:** Proof, not paperwork — verifiable evidence, summons and bail records for Maharashtra's criminal courts

**Domain:** Governance and civic technology (primary); emerging technology — blockchain, AI and GIS; digital inclusion
**State:** Maharashtra
**UN SDG:** 16 — Peace, justice and strong institutions (16.3, 16.6, 16.10)

## The problem

In Maharashtra's criminal courts, three questions are routinely answered by the
word of an interested party rather than by a record anyone can check.

1. **Is this the evidence that was collected?** Digital evidence — photographs,
   CCTV, phone extractions, search-and-seizure video — passes from police to
   malkhana, forensic laboratory, prosecutor and court. Custody is recorded in
   registers that say an item moved, not that the item which arrived is the item
   which left. The defence must accept the prosecution's own copy and log.
2. **Did the summons reach the person it named?** Service is disputed, and
   hearings are adjourned while it is attempted again.
3. **Are bail conditions being kept?** Conditions are written into an order that
   nobody monitors until something has already gone wrong.

## A recent case

Pune, May 2024: in a crash that killed two people, the minor driver's blood
sample was allegedly replaced inside a government hospital with another
person's blood before it reached the laboratory. It came to light only because
police, acting on information, drew a second sample elsewhere and compared DNA
days later. Nothing tied the vial to the person, its seal and the minute it was
drawn; nobody downstream had anything to check it against.

## Why now, and why Maharashtra

- **New legal duties since 1 July 2024.** BNSS §105 requires audio-video
  recording of searches and seizures; BNSS §176(3) requires forensic collection
  and recording at the scene of serious offences; BSA §63 requires a certificate
  stating the hash value of every electronic record produced in court — a
  requirement the Supreme Court upheld on 22 May 2026 (*Pune Bar Association v.
  Union of India*), calling a hash "synonymous with an electronic fingerprint". Officers
  now produce far more digital evidence, each item needing a chain of custody a
  court can rely on.
- **Pendency.** Maharashtra's district courts carry more than fifty lakh pending
  cases, most of them criminal (National Judicial Data Grid). Custody disputes
  and failed service add adjournments to an already long queue.
- **Forensic load.** Forensic laboratories report substantial backlogs, and the
  new scene-collection duty adds to the material they receive.

## Who is affected

Investigating officers and malkhana staff; forensic laboratories; public
prosecutors; judges and court registries; defence counsel and legal-aid
lawyers; and accused persons and witnesses — often first-generation litigants
who read neither legal English nor the documents served on them.

## What is missing today

Existing systems record media (e-Sakshya), exchange case data (CCTNS, ICJS) and
publish case status (e-Courts, NJDG). None lets a party who does not trust the
prosecution verify, independently and without permission, that an exhibit is
unchanged since capture; none ties evidence custody, service of summons and bail
compliance into one verifiable record; and none explains a person's obligations
to them in their own language.

## Proposed solution in one paragraph

NyaySetu fingerprints each piece of evidence (SHA-256) on the officer's phone at
the moment of capture, before upload, and anchors the fingerprint on a public
blockchain. Every hand-over re-checks it; a mismatch is refused and recorded
permanently. Anyone — including the accused — can verify a file against the
ledger from a public page without an account. Summons acknowledgement and bail
check-ins are recorded the same way, the BSA §63 certificate is generated from
the record with a QR code back to verification, and obligations are explained
in Marathi, Hindi or English and read aloud. Personal data never goes on the
ledger.

## Expected outcomes

- Fewer chain-of-custody disputes and adjournments; faster §63 compliance.
- Independent verification for the defence and the accused (access to justice).
- Earlier detection of bail breaches, and a way for compliant accused to show
  compliance.
- Public confidence through a transparency page with live, non-identifying
  figures.
