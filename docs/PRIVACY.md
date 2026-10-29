# Privacy threat model

What NyaySetu discloses, to whom, and how an adversary might try to learn more
than they should. Written against the Digital Personal Data Protection Act,
2023 and the principle that a public ledger is permanent.

## 1. What is where

| Data | Where it lives | Who can read it |
|---|---|---|
| Evidence files | IPFS, AES-256-GCM ciphertext; key server-side | Roles assigned to the case, through the API |
| File SHA-256, capture manifest SHA-256 | Database; the committed one also on chain | Anyone (fingerprints reveal nothing about content) |
| Case key on chain | `case_id_hash`: a hash salted with a per-case secret | Anyone; not reversible to the FIR or case reference |
| Officer identity on chain | HMAC pseudonym keyed with a server pepper | Anyone; not reversible without the pepper |
| Aadhaar numbers | Never stored; HMAC token with pepper, in a table unreachable through the API | Nobody through the API |
| Evidence location | Capture manifest in the database; on chain only if `ANCHOR_RAW_COORDS_ON_CHAIN=true` (default false: zeros are anchored) | Roles assigned to the case |
| Seal serials | Database; on chain a digest salted with the internal exhibit id | Roles assigned to the case |
| Summons acknowledgement coordinates | On chain (SummonsChain) | Anyone — see §3, risk R4 |
| Bail check-in coordinates | On chain (BailChain), because the contract computes the geo-fence | Anyone — see §3, risk R4 |
| Names, FIR, addresses, witnesses, narratives | Database only, row-level security on every table | Roles assigned to the case; FIR number withheld from defence and accused |
| Public pages and `/api/public`, `/api/v1` public endpoints | — | Anyone: reference, digests, transaction, block time, state, custody stage names. Asserted by tests |

## 2. Adversaries

1. A member of the public, or anyone reading the public ledger.
2. A participant in one case trying to see another (a defence lawyer, an accused).
3. A malicious insider with a valid account.
4. An attacker with a copy of the database but not the server secrets.

## 3. Risks and mitigations

| # | Risk | Mitigation | Residual |
|---|---|---|---|
| R1 | **Re-identification from hashes of predictable values** (Aadhaar, FIR numbers, seal serials) by brute force | Every identifier-derived value is an HMAC with a server pepper, or a hash salted with a secret per-case or per-exhibit value; no unsalted hash of a predictable value is written anywhere public | Loss of the pepper would expose tokens; it is held only in the host's secret store |
| R2 | **Linkability across cases** through a shared officer or accused token | Officer pseudonyms and accused tokens on chain are HMACs keyed with the server pepper; an observer can tell that the same officer registered two items, or that one person's summons and bail belong together, but not who they are. EvidenceChain carries no accused token | Activity patterns of one pseudonym remain visible on chain; a per-case token would remove cross-case linking and is planned |
| R3 | **Metadata leakage** from public pages: timing, counts, file sizes | Public passport omits file name, size, MIME type, case reference and location; transparency page publishes counts only (tested). Transaction times are public by nature | Block times reveal when an item was registered |
| R4 | **Precise location on a public ledger** for bail check-ins and summons acknowledgements | Stated openly in the interface and documents; evidence locations are not anchored by default | Contract change planned: commit a salted hash of the coordinates, or prove fence membership without revealing them (zero-knowledge). Until then, deploy BailChain/SummonsChain on a permissioned ledger for real use |
| R5 | **Cross-case access by a participant** | Per-case assignment enforced by the API and again by row-level security; an authorisation test walks every route of the running app as each role | — |
| R6 | **Insider altering history** | Corrections are new records (versions, readings, movements); refusals are logged; integrity mismatches and seal mismatches are anchored on chain; audit triggers on every table | An administrator with database access could edit the database, but not the ledger — the readiness check would show the disagreement |
| R7 | **Database copy without secrets** | Files are ciphertext; tokens are peppered HMACs; sessions are server-side and revocable | Names and narratives in the database are readable; protect backups as such |
| R8 | **Right to erasure vs an immutable ledger** | Nothing personal is on chain (except R4), so erasure is a database operation; on-chain fingerprints of erased records identify no one | R4 data cannot be erased from a public chain |

## 4. Rules for contributors

- Never write an unsalted hash of an identifier, a phone number, a serial or a
  location anywhere public.
- Every new public field needs a test asserting what it does not disclose.
- Corrections create new records; nothing that was approved, refused or
  anchored is overwritten.
