import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Clock3,
  Database,
  FileCheck2,
  FlaskConical,
  Gavel,
  Languages,
  Link2,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
} from "lucide-react";
import { Reveal } from "../components/ui";
import { CinematicBackdrop, CountUp, LiveFingerprint } from "../components/cinematic";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

/**
 * The public entry point: what NyaySetu records, who uses it, what goes on the
 * blockchain and what deliberately does not, and what it cannot prove. Every
 * claim here should match the code; the "Limits" section is part of the page,
 * not a footnote.
 */

const QUESTIONS = [
  {
    q: "A hash only works for files. Most evidence is a blood sample, a weapon, a packet.",
    a: "Physical exhibits carry a tamper-evident seal with a printed serial. NyaySetu binds that serial to the exhibit when it is sealed and anchors a salted digest of it. Every receiving party must read the same serial; a substituted packet carries a different one and is refused, recorded on chain and alerted. The photograph of the sealed packet is fingerprinted as well.",
  },
  {
    q: "Why a blockchain? A government database with audit logs would do.",
    a: "The party that runs the database is the party whose handling may be challenged. A ledger that no party in the case controls is the only record the defence has no reason to distrust. Only 32-byte fingerprints go on it; everything readable stays in an access-controlled database.",
  },
  {
    q: "e-Sakshya already records search and seizure. Isn't this duplication?",
    a: "e-Sakshya records the media and stores it with the government. NyaySetu proves integrity independently and follows the item through malkhana, laboratory, prosecution and court, plus summons and bail. It complements e-Sakshya: the fingerprint of each e-Sakshya recording can be anchored and re-checked at every later hand-over.",
  },
  {
    q: "Under some State rules the accused must pay to have a hash checked. What changes?",
    a: "Here, verification is a public web page and a public API. The accused, the defence or a legal-aid lawyer drops the file and gets the ledger's answer in seconds, at no cost and without anyone's permission.",
  },
  {
    q: "Isn't a public blockchain a privacy disaster for victims and accused?",
    a: "No names, FIR numbers, addresses or files go on chain — only salted fingerprints. Files are encrypted with AES-256-GCM off chain. Personal data stays where it can be corrected or erased under the DPDP Act, 2023. The one exception, bail check-in coordinates, is stated openly and is next to move off chain.",
  },
  {
    q: "What if the officer is the one who tampers, before the fingerprint?",
    a: "Then the proof starts from the tampered file — no system can prove what happened before capture. That is why capture is on the device at the scene, with GPS accuracy, device time and mocked-location flags, and why a collection clip showing the person and the seal is recorded. The court still weighs the evidence; NyaySetu narrows where tampering can hide.",
  },
  {
    q: "Is a ledger record admissible in court?",
    a: "The court relies on the BSA §63 certificate, whose hash requirement the Supreme Court upheld on 22 May 2026. NyaySetu generates that certificate from the record, with the anchored digest and a QR code, so the court can verify the paper itself. The ledger supports the certificate; it does not replace it.",
  },
  {
    q: "Can it scale to a State, and what does it cost?",
    a: "Measured, not estimated: about 3.6 lakh gas to register an item and 1.56 lakh per hand-over, whatever the file size. On a permissioned ledger run by State institutions there are no gas fees at all; the API scales horizontally on ordinary cloud infrastructure.",
  },
];

const LAW = [
  {
    section: "BNSS § 105",
    duty: "Search and seizure must be recorded by audio-video means",
    how: "Captures are fingerprinted on the officer's phone at the scene, before upload, with location and time — and queued safely when there is no signal.",
  },
  {
    section: "BNSS § 176(3)",
    duty: "Forensic experts must attend serious crime scenes and record the process",
    how: "The laboratory accepts custody only after re-checking the fingerprint, so the item examined is provably the item collected.",
  },
  {
    section: "SC · 22 May 2026",
    duty: "The Supreme Court upholds the hash certificate",
    how: "Pune Bar Association v. Union of India: a hash value is \u201csynonymous with an electronic fingerprint\u201d. NyaySetu computes it at the scene and lets anyone check it, free.",
  },
  {
    section: "BSA § 63",
    duty: "Electronic records need a certificate stating their hash value",
    how: "The Section 63 certificate is generated from the record itself, carries the SHA-256 digest, and has a QR code that anyone can scan to verify it.",
  },
];

const STEPS = [
  {
    icon: Camera,
    title: "Capture",
    body: "A photo or video is taken in the app, or a file is chosen. Its SHA-256 fingerprint is computed on the device before anything is uploaded, together with the time, the GPS fix and its accuracy.",
  },
  {
    icon: Link2,
    title: "Anchor",
    body: "The fingerprint of a capture manifest is written to an Ethereum contract. The record says honestly where that has got to: saved locally, submitted, or confirmed after enough blocks.",
  },
  {
    icon: FlaskConical,
    title: "Hand over",
    body: "Police, laboratory, prosecution and court each re-hash what they receive before accepting it. A mismatch is recorded on chain and the transfer does not happen.",
  },
  {
    icon: Gavel,
    title: "Produce in court",
    body: "Anyone can check an item on its public Integrity Passport. The Section 63 certificate template, custody form and an export bundle are generated from the same record.",
  },
];

const STATES = [
  { tone: "bg-surface-2 text-muted", label: "Saved locally", body: "Recorded here; not yet sent to the blockchain." },
  { tone: "bg-info-soft text-info", label: "Submitted", body: "Sent; waiting for the network to include it." },
  { tone: "bg-success-soft text-success", label: "Confirmed on chain", body: "Included and buried under enough blocks to rely on." },
  { tone: "bg-warning-soft text-warning", label: "Review required", body: "Something unexpected happened; a person must look." },
  { tone: "bg-danger-soft text-danger", label: "Integrity mismatch", body: "A file did not match its anchored fingerprint." },
];

const ROLES = [
  { icon: ShieldCheck, name: "Police", body: "Register cases, capture evidence with GPS, record seizure memos and malkhana movements." },
  { icon: FlaskConical, name: "Forensic laboratory", body: "Re-hash on arrival, check the seal, record working copies and file versioned reports." },
  { icon: Scale, name: "Prosecution", body: "See which cases are ready: what is confirmed, what is pending, and every open alert." },
  { icon: Gavel, name: "Judge", body: "Hearings and orders, access requests, objections, ranked bail compliance and approvals." },
  { icon: BadgeCheck, name: "Defence", body: "Request access through the court and verify disclosed files against the chain, not the database." },
  { icon: UserRound, name: "Accused or witness", body: "Summons and check-ins explained plainly in English, Hindi or Marathi, with a way to give reasons." },
  { icon: Users, name: "Court registry", body: "Participants, case access, document templates, the audit trail and the chain's health." },
];

const ON_CHAIN = [
  "A salted case key, from which neither the FIR nor the case reference can be recovered",
  "The fingerprint of each evidence item's capture manifest",
  "Custody transfers and integrity checks, including the ones that failed",
  "Fingerprints of seizure memos, malkhana movements, working copies and forensic reports",
  "Summons issue and acknowledgement events, including the acknowledgement's coordinates",
  "Bail conditions and check-ins, whose coordinates the contract needs to check the permitted area",
];

const OFF_CHAIN = [
  "The evidence files, encrypted with AES-256-GCM before storage",
  "Names, FIR details, addresses and witnesses",
  "Exact evidence coordinates (kept in the manifest, which only assigned roles may see)",
  "Report text, court orders, comments and case notes",
  "Accounts, sessions and the role-based access rules, enforced in the API and by row-level security",
];

const LIMITS = [
  "A matching fingerprint proves a file is unchanged since it was anchored. It does not prove what the file shows is true, or how it was collected.",
  "GPS can be wrong or spoofed. Accuracy is recorded with every fix, and a poor fix is flagged rather than hidden.",
  "The AI screening and estimates are decision support. They are labelled with their limitations and never decide anything.",
  "Generated certificates and forms are templates filled from the record, to be checked by a legal practitioner before filing.",
  "One-time codes use a sandbox provider by default. Real Aadhaar authentication needs a licensed provider and is not part of this build.",
  "Hindi and Marathi text has not yet been reviewed by native speakers.",
];


function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <Reveal>
      <p className="mb-2 font-ui text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h2 className="max-w-3xl font-display text-3xl leading-tight text-text sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 max-w-3xl font-ui text-base leading-relaxed text-muted">{body}</p>}
    </Reveal>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader tone="dark" />

      <main id="main">
        {/* ------------------------------------------------------------ hero */}
        <section data-surface="dark" className="relative isolate overflow-hidden">
          <CinematicBackdrop />
          <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-14 pt-14 text-center sm:px-6 sm:pt-20">
            <Reveal>
              <div className="mx-auto w-full max-w-xs rounded-[22px] border border-white/15 bg-white/[0.06] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
                <p className="font-mono text-xs text-white/60">[ 22 May 2026 ]</p>
                <p className="mt-2 font-ui text-lg font-semibold leading-snug text-white">
                  A hash is <em className="font-display font-normal italic text-[#8ce6b4]">an electronic fingerprint</em>
                </p>
                <p className="mt-2 font-ui text-[11px] leading-relaxed text-white/55">Supreme Court of India, upholding the BSA §63 hash certificate</p>
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-black/40 py-1.5 pl-1.5 pr-4 backdrop-blur">
                <span className="flex -space-x-2">
                  {[
                    { k: "SS", c: "text-[#16a34a]" },
                    { k: "SM", c: "text-[#ea7a2b]" },
                    { k: "JS", c: "text-[#0b3d2a]" },
                  ].map((b) => (
                    <span key={b.k} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-[#070b0a] bg-white font-ui text-[11px] font-extrabold ${b.c}`}>
                      {b.k}
                    </span>
                  ))}
                </span>
                <span className="font-ui text-sm font-medium text-white/90">Evidence · Summons · Bail — one chain of proof</span>
              </div>
            </Reveal>

            <p className="mt-8 font-ui text-[11px] font-bold uppercase tracking-[0.22em] text-[#5ed29c]">Justice infrastructure for India · न्यायसेतु</p>
            <h1 className="mt-3 font-ui font-extrabold uppercase leading-[0.95] tracking-[-0.035em] text-white" style={{ fontSize: "clamp(44px, 8.4vw, 112px)" }}>
              Proof, not
              <br />
              paperwork<span className="text-[#f97316]">.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl font-ui text-base leading-relaxed text-white/75 sm:text-lg">
              An integrity layer for the criminal justice system. Every exhibit is fingerprinted where it is seized, every hand-over must match it, and
              anyone — the court, the defence, the accused — can check it without asking permission and without paying for it.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link
                to="/case-study"
                className="inline-flex items-center gap-2 rounded-full bg-[#16a34a] px-7 py-3.5 font-ui text-sm font-bold uppercase tracking-wide text-white shadow-[0_0_40px_-6px_rgba(34,197,94,0.7)] transition hover:-translate-y-0.5 hover:bg-[#15803d]"
              >
                Replay the Pune case <ArrowRight size={16} aria-hidden />
              </Link>
              <Link
                to="/verify"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 font-ui text-sm font-bold uppercase tracking-wide text-white transition hover:border-white/60 hover:bg-white/5"
              >
                Verify a file
              </Link>
            </div>

            <div className="mt-14 w-full max-w-3xl rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-left backdrop-blur">
              <p className="mb-1 font-ui text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Computed in your browser, every second</p>
              <LiveFingerprint />
            </div>

            <dl className="mt-10 grid w-full grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-left lg:grid-cols-4">
              {[
                { v: <CountUp to={50} suffix=" lakh+" />, l: "cases pending in Maharashtra's district courts (NJDG)" },
                { v: <CountUp to={100} suffix="%" />, l: "of one-byte changes detected across 200 test files" },
                { v: <CountUp to={0} prefix="₹" />, l: "for an accused person to verify the evidence against them" },
                { v: <CountUp to={3} />, l: "verified smart contracts live on Ethereum Sepolia" },
              ].map((s, i) => (
                <div key={i} className="bg-[#0a110e]/90 px-5 py-5">
                  <dt className="sr-only">{s.l}</dt>
                  <dd>
                    <span className="block font-ui text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{s.v}</span>
                    <span className="mt-1 block font-ui text-xs leading-snug text-white/55">{s.l}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ------------------------------------------------- the case teaser */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
            <Reveal>
              <p className="mb-2 font-ui text-xs font-bold uppercase tracking-[0.16em] text-[#c2410c]">The case that shows the gap</p>
              <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">Pune, May 2024: a blood sample was swapped inside a hospital.</h2>
              <p className="mt-4 font-ui text-base leading-relaxed text-muted">
                In a crash that killed two young people, the driver's blood sample was allegedly replaced with another person's before it reached the
                laboratory. It was caught only because police acted on a tip-off, drew a second sample elsewhere and compared DNA — days later.
              </p>
              <p className="mt-3 font-ui text-base leading-relaxed text-text">
                With NyaySetu, the swap fails at the first hand-over, the same day, without DNA — because the seal on the substitute cannot carry the serial
                already written to the ledger.
              </p>
              <Link to="/case-study" className="mt-6 inline-flex items-center gap-2 font-ui text-sm font-bold text-primary hover:underline">
                Watch the replay, step by step <ArrowRight size={15} aria-hidden />
              </Link>
            </Reveal>
            <Reveal delay={0.08}>
              <ol className="relative space-y-3 border-l-2 border-dashed border-border pl-6">
                {[
                  { t: "Collection", a: "Paper record; nothing ties vial, person and seal", b: "Clip + seal serial anchored at the bedside", tone: "ok" },
                  { t: "Substitution", a: "Vial replaced and relabelled", b: "A new vial needs a new seal — a different serial", tone: "warn" },
                  { t: "Laboratory", a: "Swapped vial accepted as the original", b: "Serial mismatch: refused, anchored, alerted", tone: "bad" },
                  { t: "Detection", a: "Days later, by luck and DNA", b: "Minutes later, by design", tone: "ok" },
                ].map((s) => (
                  <li key={s.t} className="relative rounded-xl border border-border bg-bg p-4">
                    <span
                      aria-hidden
                      className={`absolute -left-[33px] top-5 h-3.5 w-3.5 rounded-full border-2 border-surface ${s.tone === "bad" ? "bg-danger" : s.tone === "warn" ? "bg-warning" : "bg-success"}`}
                    />
                    <p className="font-ui text-xs font-bold uppercase tracking-wider text-faint">{s.t}</p>
                    <p className="mt-1 font-ui text-sm text-muted line-through decoration-danger/60">{s.a}</p>
                    <p className="font-ui text-sm font-semibold text-text">{s.b}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>

        {/* ----------------------------------------------------- problems */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHead eyebrow="Why" title="Three questions a court should not have to take on trust" />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: FileCheck2, q: "Is this the evidence that was collected?", a: "A register records that a transfer happened, not that the item is unchanged. A fingerprint checked at every hand-over does." },
              { icon: ScrollText, q: "Was the summons received?", a: "The recipient acknowledges with a one-time code, and the acknowledgement is a timestamped blockchain event." },
              { icon: Scale, q: "Are bail conditions being kept?", a: "Check-ins are recorded against the permitted area, ranked for the court with the reason for each rank and any explanation given." },
            ].map((item, i) => (
              <Reveal key={item.q} delay={i * 0.06}>
                <div className="panel h-full p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <item.icon size={18} aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-xl leading-snug text-text">{item.q}</h3>
                  <p className="mt-2 font-ui text-sm leading-relaxed text-muted">{item.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- the law */}
        <section id="law" className="scroll-mt-20 border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <SectionHead
              eyebrow="Why now"
              title="Since 1 July 2024, the law asks for exactly this"
              body="The Bharatiya Nagarik Suraksha Sanhita and the Bharatiya Sakshya Adhiniyam turned recording and hashing from good practice into statutory duty. NyaySetu is built around those sections."
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {LAW.map((item, i) => (
                <Reveal key={item.section} delay={i * 0.06}>
                  <div className="panel flex h-full flex-col p-6">
                    <p className="font-mono text-xs font-semibold text-primary">{item.section}</p>
                    <h3 className="mt-2 font-display text-xl leading-snug text-text">{item.duty}</h3>
                    <p className="mt-3 flex-1 font-ui text-sm leading-relaxed text-muted">{item.how}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.1}>
              <p className="mt-8 max-w-3xl font-ui text-sm leading-relaxed text-muted">
                Maharashtra&rsquo;s district courts carry more than fifty lakh pending cases, most of them criminal, according to the{" "}
                <a href="https://njdg.ecourts.gov.in/" target="_blank" rel="noreferrer noopener" className="font-semibold text-primary hover:underline">
                  National Judicial Data Grid
                </a>
                . Every adjournment spent disputing whether an exhibit is the one seized is time those cases do not get.{" "}
                <Link to="/transparency" className="font-semibold text-primary hover:underline">
                  See the live figures
                </Link>
                .
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" className="scroll-mt-20 border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <SectionHead eyebrow="How it works" title="Four steps, each one checkable" />
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="h-full">
                  <Reveal delay={i * 0.06} className="relative h-full rounded-panel border border-border bg-bg p-6">
                    <span className="font-mono text-xs text-faint">0{i + 1}</span>
                    <step.icon size={22} className="mt-2 text-primary" aria-hidden />
                    <h3 className="mt-3 font-display text-xl text-text">{step.title}</h3>
                    <p className="mt-2 font-ui text-sm leading-relaxed text-muted">{step.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>

            <Reveal delay={0.1}>
              <div className="mt-10 rounded-panel border border-border bg-bg p-6">
                <div className="flex items-center gap-2">
                  <Clock3 size={16} className="text-primary" aria-hidden />
                  <h3 className="font-display text-lg text-text">Every record says where it has got to</h3>
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {STATES.map((s) => (
                    <li key={s.label}>
                      <span className={`inline-block rounded-full px-2.5 py-1 font-ui text-xs font-semibold ${s.tone}`}>{s.label}</span>
                      <p className="mt-1.5 font-ui text-xs leading-relaxed text-muted">{s.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------- a national layer */}
        <section id="layer" data-surface="dark" className="relative isolate scroll-mt-20 overflow-hidden bg-[#070b0a]">
          <div aria-hidden className="pointer-events-none absolute -right-40 top-0 h-96 w-[40rem] rounded-full bg-[#16a34a] opacity-20 blur-[140px]" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <Reveal>
              <p className="mb-2 font-ui text-xs font-bold uppercase tracking-[0.16em] text-[#5ed29c]">Not another police app</p>
              <h2 className="max-w-3xl font-display text-3xl leading-tight text-white sm:text-4xl">A shared layer of trust that every pillar of the system plugs into.</h2>
              <p className="mt-3 max-w-3xl font-ui text-base leading-relaxed text-white/70">
                India already records evidence (e-Sakshya), exchanges case data (ICJS, CCTNS) and publishes case status (e-Courts, NJDG). What none of them
                gives is proof that a party who distrusts the others can check for themselves. NyaySetu is that missing layer — open, federated and free to
                verify, like UPI is for payments.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Smartphone, t: "Capture anywhere", b: "Phone or browser, online or not. e-Sakshya recordings can be anchored too, so nothing already in use is replaced." },
                { icon: Link2, t: "One call to verify", b: "Any agency's system sends a fingerprint and gets an answer from the ledger — POST /api/public/lookup. No account, no fee." },
                { icon: Users, t: "Run by many, owned by none", b: "For the State: ledger nodes held by police, judiciary, forensic directorate and legal-aid authority, so no single party can rewrite it." },
                { icon: Languages, t: "For the person in the dock", b: "Obligations in Marathi, Hindi and English, read aloud; the accused can verify evidence and show their own compliance." },
              ].map((c, i) => (
                <Reveal key={c.t} delay={i * 0.05}>
                  <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
                    <c.icon size={20} className="text-[#5ed29c]" aria-hidden />
                    <h3 className="mt-4 font-ui text-base font-bold text-white">{c.t}</h3>
                    <p className="mt-2 font-ui text-sm leading-relaxed text-white/65">{c.b}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- hard questions */}
        <section id="questions" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
          <SectionHead
            eyebrow="Hard questions"
            title="The objections, answered in the open"
            body="Every serious critique of a system like this, and what NyaySetu does about it. Where it cannot help, it says so."
          />
          <div className="mt-10 grid gap-3 lg:grid-cols-2">
            {QUESTIONS.map((q, i) => (
              <Reveal key={q.q} delay={(i % 2) * 0.05}>
                <details className="group h-full rounded-2xl border border-border bg-surface p-5 open:shadow-card">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-ui text-base font-semibold text-text">
                    {q.q}
                    <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 font-ui text-sm leading-relaxed text-muted">{q.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- roles */}
        <section id="roles" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
          <SectionHead eyebrow="Who uses it" title="Seven roles, one record" body="Each role sees and can do only what its part of the process needs. The API enforces it, and so does the database." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role, i) => (
              <Reveal key={role.name} delay={(i % 4) * 0.05}>
                <div className="panel h-full p-5 transition hover:-translate-y-0.5 hover:border-primary-ring">
                  <role.icon size={19} className="text-primary" aria-hidden />
                  <h3 className="mt-3 font-ui text-base font-semibold text-text">{role.name}</h3>
                  <p className="mt-1.5 font-ui text-sm leading-relaxed text-muted">{role.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- privacy */}
        <section id="privacy" className="scroll-mt-20 border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <SectionHead
              eyebrow="On and off chain"
              title="What goes on a public blockchain, and what never does"
              body="A blockchain is public and permanent. That suits a fingerprint, and is exactly wrong for a photograph, a name or an address."
            />
            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {[
                { title: "On chain", icon: Link2, items: ON_CHAIN, dot: "bg-primary" },
                { title: "Off chain", icon: Database, items: OFF_CHAIN, dot: "bg-accent" },
              ].map((col, i) => (
                <Reveal key={col.title} delay={i * 0.06}>
                  <div className="h-full rounded-panel border border-border bg-bg p-6">
                    <div className="flex items-center gap-2">
                      <col.icon size={17} className="text-primary" aria-hidden />
                      <h3 className="font-display text-xl text-text">{col.title}</h3>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {col.items.map((item) => (
                        <li key={item} className="flex gap-2.5">
                          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${col.dot}`} aria-hidden />
                          <span className="font-ui text-sm leading-relaxed text-text">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- limits */}
        <section id="limits" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
          <SectionHead eyebrow="Limits" title="What NyaySetu does not prove" body="Saying so plainly is part of the design." />
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {LIMITS.map((limit, i) => (
              <li key={limit} className="h-full">
                <Reveal delay={(i % 2) * 0.05} className="flex h-full gap-3 rounded-panel border border-border bg-surface p-5">
                  <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                  <span className="font-ui text-sm leading-relaxed text-text">{limit}</span>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------------ cta */}
        <section className="px-4 pb-20 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-6xl rounded-[28px] border border-primary-ring bg-primary-soft px-6 py-12 text-center sm:px-12">
              <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">Have a reference or a file? Check it now.</h2>
              <p className="mx-auto mt-3 max-w-2xl font-ui text-base leading-relaxed text-muted">
                The public verification page needs no account. It shows what the blockchain holds for an item, never who or where.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link to="/verify" className="inline-flex items-center gap-2 rounded-full bg-primary-fill px-6 py-3 font-ui text-sm font-semibold text-on-primary transition hover:-translate-y-0.5">
                  Open verification <ArrowRight size={15} aria-hidden />
                </Link>
                <Link to="/handbook" className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 font-ui text-sm font-semibold text-text transition hover:border-primary">
                  Read the handbook
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
