import { Link } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  Camera,
  Database,
  FileCheck2,
  Gavel,
  Link2,
  Lock,
  Scale,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  HeroBackdrop,
  HeroCta,
  LandingHeader,
  LiquidGlassCard,
  StatsFooter,
  TrustRow,
} from "../components/landing";
import { Reveal } from "../components/ui";

/**
 * The public entry point.
 *
 * Structure: a full-bleed cinematic first viewport, then the explanatory
 * sections on the ordinary themed surface. The hero opts out of the light theme
 * with data-surface="cinematic" because it sits over a video, where a light
 * palette would be unreadable whatever the user's preference.
 */

const MODULES = [
  {
    icon: Camera,
    name: "SaakshyaSetu",
    devanagari: "साक्ष्यसेतु",
    tagline: "Evidence Bridge",
    body:
      "The digest is computed on the officer's device before a byte is uploaded. Custody is then " +
      "confirmed by each receiving party, who re-hashes what they were handed. A mismatch is " +
      "anchored on chain and the transfer is refused, so a rejected tamper attempt leaves a " +
      "permanent record rather than a server log.",
    points: [
      "SHA-256 in the browser, before upload",
      "Scene → lab → prosecutor → court, each hop hash-confirmed",
      "Refused transfers anchored, not just denied",
    ],
  },
  {
    icon: ScrollText,
    name: "SammansSetu",
    devanagari: "समन्ससेतु",
    tagline: "Summons Bridge",
    body:
      "A summons acknowledgement is an Aadhaar-OTP-authenticated transaction carrying the time, the " +
      "coordinates and a device fingerprint. It cannot be produced without the recipient and cannot " +
      "be back-dated, because the timestamp is the block's. After 72 hours without one, the court " +
      "dashboard shows FAILED on its own.",
    points: [
      "OTP-authenticated acknowledgement with GPS",
      "72 hour window, enforced by the contract",
      "Non-delivery surfaces without anyone noticing",
    ],
  },
  {
    icon: Scale,
    name: "JaminSetu",
    devanagari: "जमानतसेतु",
    tagline: "Bail Bridge",
    body:
      "Bail conditions are stored on chain, and every check-in is a transaction carrying coordinates. " +
      "The geo-fence arithmetic runs in the contract, so a breach is reproducible by anyone reading " +
      "the chain rather than asserted by a server. A missed check-in is computed lazily in a view, " +
      "because a chain cannot react to nothing happening.",
    points: [
      "Conditions encoded, not filed as a PDF",
      "Geo-fence checked on chain, in integer maths",
      "Live compliance score for the court, read-only view for the surety",
    ],
  },
];

const SPLIT = {
  onChain: [
    "Evidence digest, GPS and collection timestamp",
    "Every custody transfer, with the confirming party",
    "Integrity checks, including the ones that failed",
    "Summons issuance hash and acknowledgement event",
    "Bail conditions, check-ins and violation alerts",
    "Forensic result hash and the AI anomaly verdict",
  ],
  offChain: [
    "The evidence files themselves, AES-256-GCM encrypted",
    "FIR content, case notes and the full bail order",
    "Officer and accused personal data, in a separate schema",
    "Summons document text and hearing schedules",
    "Dashboards, reports and the detailed forensic write-up",
  ],
};

const STACK = [
  { label: "Chain", value: "Solidity 0.8.24 · Sepolia · Hardhat · OpenZeppelin 5" },
  { label: "API", value: "Node 20 · Express · TypeScript · Ethers v6" },
  { label: "Data", value: "Supabase Postgres · RLS on every table · trigger audit" },
  { label: "Storage", value: "IPFS via Pinata · AES-256-GCM before pinning" },
  { label: "Models", value: "Python · scikit-learn · Flask microservice" },
  { label: "Clients", value: "React · Tailwind · React Native (Expo)" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg">
      {/* ================================================ cinematic hero */}
      <section
        data-surface="cinematic"
        className="relative flex min-h-[100vh] flex-col overflow-hidden px-[clamp(14px,3vw,32px)] py-[clamp(16px,2.4vh,28px)]"
        style={{ minHeight: "100dvh" }}
      >
        <HeroBackdrop />

        <LandingHeader />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
          <LiquidGlassCard />

          {/* The card is lifted 50px, so pull the copy back up to close the gap. */}
          <div className="-mt-[26px] flex flex-col items-center">
            <TrustRow />

            <p
              className="anim mb-3 font-jakarta text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: "#5ed29c", ["--d" as any]: "0.1s" }}
            >
              Justice infrastructure · न्यायसेतु
            </p>

            <h1 className="max-w-[16ch] font-ui font-extrabold uppercase leading-[1.04] tracking-tight text-white sm:max-w-none">
              <span
                className="block animate-headline-fade"
                style={{
                  animationDelay: "0.12s",
                  fontSize: "clamp(34px,6.2vw,72px)",
                  letterSpacing: "-0.03em",
                }}
              >
                Proof, not
              </span>
              <span
                className="block animate-headline-fade"
                style={{
                  animationDelay: "0.3s",
                  fontSize: "clamp(34px,6.2vw,72px)",
                  letterSpacing: "-0.03em",
                }}
              >
                paperwork<span style={{ color: "#5ed29c" }}>.</span>
              </span>
            </h1>

            <p
              className="anim mt-5 max-w-[min(520px,92%)] font-ui text-[clamp(13.5px,1.55vw,16.5px)] leading-[1.6]"
              style={{ color: "#d0d0d0", opacity: 0.85, ["--d" as any]: "0.28s" }}
            >
              NyaySetu anchors evidence digests, summons acknowledgements and bail conditions to a
              public blockchain, so integrity is something anyone can check rather than something a
              party asserts.
            </p>

            <div className="mt-7">
              <HeroCta />
            </div>
          </div>
        </div>

        <div className="pb-2 pt-6">
          <StatsFooter />
        </div>
      </section>

      {/* =================================================== the problem */}
      <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <p className="mb-3 font-jakarta text-2xs font-bold uppercase tracking-[0.16em] text-primary">
            The problem
          </p>
          <h2 className="max-w-3xl font-display text-3xl leading-tight text-text sm:text-4xl">
            Three places where the record is only as good as somebody&apos;s word
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              {
                q: "Was this evidence altered?",
                a: "A custody register is a book. It records that a transfer happened, not that the item is the same item.",
              },
              {
                q: "Were you served?",
                a: "A process server's endorsement against a flat denial. Cases adjourn for months on exactly this.",
              },
              {
                q: "Did they comply with bail?",
                a: "The order is a PDF nobody monitors until something has already gone wrong.",
              },
            ].map((item) => (
              <div key={item.q} className="panel p-5">
                <p className="font-display text-lg leading-snug text-text">{item.q}</p>
                <p className="mt-2.5 font-ui text-sm leading-relaxed text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ==================================================== the modules */}
      <section id="modules" className="border-y border-border bg-surface px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="mb-3 font-jakarta text-2xs font-bold uppercase tracking-[0.16em] text-primary">
              Three bridges
            </p>
            <h2 className="max-w-3xl font-display text-3xl leading-tight text-text sm:text-4xl">
              Each one replaces an assertion with a verifiable record
            </h2>
          </Reveal>

          <div className="mt-11 space-y-5">
            {MODULES.map((module, index) => (
              <Reveal key={module.name} delay={index * 0.08}>
                <article className="panel grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_1.35fr]">
                  <div>
                    <span className="mb-4 inline-grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                      <module.icon size={20} />
                    </span>
                    <h3 className="font-display text-2xl leading-tight text-text">{module.name}</h3>
                    <p className="mt-1 font-body text-lg text-muted">{module.devanagari}</p>
                    <p className="mt-2 font-jakarta text-2xs font-bold uppercase tracking-[0.14em] text-primary">
                      {module.tagline}
                    </p>
                  </div>

                  <div>
                    <p className="font-ui text-sm leading-relaxed text-muted">{module.body}</p>
                    <ul className="mt-5 space-y-2.5">
                      {module.points.map((point) => (
                        <li key={point} className="flex gap-2.5">
                          <FileCheck2 size={15} className="mt-0.5 shrink-0 text-primary" />
                          <span className="font-ui text-xs leading-relaxed text-text">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =============================================== the split */}
      <section id="architecture" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <p className="mb-3 font-jakarta text-2xs font-bold uppercase tracking-[0.16em] text-primary">
            Architecture
          </p>
          <h2 className="max-w-3xl font-display text-3xl leading-tight text-text sm:text-4xl">
            What goes on the chain, and what deliberately does not
          </h2>
          <p className="mt-4 max-w-3xl font-ui text-sm leading-relaxed text-muted">
            A blockchain is expensive, public and permanent. Those are the properties you want for a
            digest and the properties you must never give to an evidence photograph or a person&apos;s
            Aadhaar number. So the split is strict, and it is the design decision the rest of the
            system is built around.
          </p>
        </Reveal>

        <div className="mt-9 grid gap-5 lg:grid-cols-2">
          <Reveal delay={0.06}>
            <div className="panel h-full p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <Link2 size={17} className="text-primary" />
                <h3 className="font-display text-xl text-text">On chain</h3>
              </div>
              <p className="mb-4 font-ui text-xs leading-relaxed text-faint">
                Small, permanent, and worth paying gas for. Nothing here is a secret, because
                everything here is already public.
              </p>
              <ul className="space-y-2.5">
                {SPLIT.onChain.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="font-ui text-sm leading-relaxed text-text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="panel h-full p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <Database size={17} className="text-accent" />
                <h3 className="font-display text-xl text-text">Off chain</h3>
              </div>
              <p className="mb-4 font-ui text-xs leading-relaxed text-faint">
                Large, private, or subject to correction and erasure. Postgres with row level
                security on every table, and IPFS for encrypted blobs.
              </p>
              <ul className="space-y-2.5">
                {SPLIT.offChain.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="font-ui text-sm leading-relaxed text-text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.18}>
          <div className="mt-5 panel border-primary-ring p-6">
            <div className="flex gap-3">
              <Sparkles size={18} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <h3 className="font-display text-lg text-text">
                  Why not just use Postgres, then?
                </h3>
                <p className="mt-2 font-ui text-sm leading-relaxed text-muted">
                  Because a database is only as trustworthy as whoever administers it, and in a
                  criminal matter that party is not neutral. A prosecution-run database asking the
                  defence to accept its own audit log is the problem, not the solution. Anchoring the
                  digest to a chain nobody in the case controls means integrity can be checked by a
                  party who trusts neither the server nor its operator. Everything that does not need
                  that property stays in Postgres, where it can be indexed, corrected and erased.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===================================================== verify */}
      <section id="verify" className="border-y border-border bg-surface px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <ShieldCheck size={22} />
            </span>
            <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
              The defence gets the same answer, from the same source
            </h2>
            <p className="mx-auto mt-4 max-w-2xl font-ui text-sm leading-relaxed text-muted">
              Counsel uploads the file they were disclosed. The browser hashes it, and the result is
              compared against the chain, not against the prosecution&apos;s database. If the database
              had been altered, a comparison against it would agree with the alteration. A comparison
              against the chain would not. The verification itself is then anchored, so the fact that
              it was performed is part of the record too.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-ui text-sm font-bold uppercase tracking-wide text-on-primary shadow-glow transition hover:-translate-y-0.5"
              >
                Open the verification portal
                <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ====================================================== stack */}
      <section id="stack" className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-24">
        <Reveal>
          <p className="mb-3 font-jakarta text-2xs font-bold uppercase tracking-[0.16em] text-primary">
            Built with
          </p>
          <h2 className="font-display text-3xl leading-tight text-text">The stack, in full</h2>
        </Reveal>

        <Reveal delay={0.08}>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-2">
            {STACK.map((row) => (
              <div key={row.label} className="bg-surface p-5">
                <dt className="font-jakarta text-2xs font-bold uppercase tracking-[0.14em] text-primary">
                  {row.label}
                </dt>
                <dd className="mt-1.5 font-ui text-sm leading-relaxed text-text">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { icon: Lock, text: "RLS on every table, default deny" },
              { icon: Boxes, text: "No raw Aadhaar number stored anywhere" },
              { icon: Gavel, text: "53 contract tests, all passing" },
            ].map((item) => (
              <span
                key={item.text}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 font-ui text-xs text-muted"
              >
                <item.icon size={13} className="text-primary" />
                {item.text}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ===================================================== footer */}
      <footer className="border-t border-border px-5 py-9 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-grad-primary text-on-primary">
              <Gavel size={16} />
            </span>
            <div>
              <p className="font-display text-base leading-none text-text">NyaySetu</p>
              <p className="mt-1 font-ui text-2xs text-faint">
                Vishwakarma Institute of Technology, Pune · 2026
              </p>
            </div>
          </div>
          <Link
            to="/login"
            className="font-ui text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
