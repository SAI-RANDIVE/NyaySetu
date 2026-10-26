import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Pause, Play, RotateCcw, ShieldAlert, SkipForward, XCircle } from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { CinematicBackdrop } from "../components/cinematic";
import { Reveal } from "../components/ui";
import { sha256Text } from "../lib/hash";

/**
 * Case replay: a real, recent Maharashtra case in which forensic evidence was
 * allegedly substituted, set beside the same events as NyaySetu would have
 * recorded them. Facts are limited to what was publicly reported; nobody is
 * named; the times on the NyaySetu side are illustrative.
 */

type Tone = "neutral" | "ok" | "warn" | "bad";

interface Step {
  when: string;
  title: string;
  happened: string;
  happenedTone: Tone;
  withNyaysetu: string;
  ledger?: { at: string; label: string; record: Record<string, string>; tone: Tone };
}

const BOUND_SERIAL = "MH-PN-0419";

const STEPS: Step[] = [
  {
    when: "19 May 2024, early hours",
    title: "A crash in Kalyani Nagar",
    happened: "A speeding car kills two young people on a Pune road. The driver, a minor, is taken into custody and a case is registered.",
    happenedTone: "neutral",
    withNyaysetu: "The investigating officer registers the case on a phone. Only a salted case key goes to the ledger — no names, no FIR number.",
    ledger: { at: "03:40", label: "Case registered", record: { kind: "case", station: "Pune" }, tone: "ok" },
  },
  {
    when: "19 May 2024, morning",
    title: "A blood sample is drawn",
    happened:
      "A blood sample is taken at Sassoon General Hospital to test for alcohol. The collection is recorded on paper. Nothing ties the vial to the person, to its seal and to the minute it was drawn.",
    happenedTone: "warn",
    withNyaysetu:
      "The officer records a 20-second clip on the same phone: the person, the draw, the vial and its seal. The clip is fingerprinted before upload, and the seal serial is bound to the exhibit.",
    ledger: { at: "11:06", label: `Collection clip + seal ${BOUND_SERIAL} anchored`, record: { kind: "exhibit", seal: BOUND_SERIAL, item: "blood sample, 5 ml" }, tone: "ok" },
  },
  {
    when: "19 May 2024, inside the hospital",
    title: "The sample is replaced",
    happened:
      "According to the prosecution, the sample is discarded and replaced with another person's blood — later shown by DNA to be the mother's — in a vial passed off as the original.",
    happenedTone: "bad",
    withNyaysetu:
      "To pass a substitute off, the new vial needs a seal. Its serial cannot be the one already on the ledger: that serial is bound to this exhibit, and a digest of it was anchored hours earlier.",
  },
  {
    when: "Dispatch to the laboratory",
    title: "The first hand-over",
    happened: "The substituted vial travels on to the forensic laboratory as if it were the original. Nobody downstream has anything to check it against.",
    happenedTone: "bad",
    withNyaysetu:
      "The laboratory types the serial it actually sees. It does not match. Intake is refused, the wrong reading is itself anchored, and the prosecutor, the court and the supervising officer are alerted.",
    ledger: { at: "13:52", label: "Seal MH-PN-0477 ≠ bound serial · intake refused", record: { kind: "seal_check", observed: "MH-PN-0477" }, tone: "bad" },
  },
  {
    when: "Over the following days",
    title: "How the swap came to light",
    happened:
      "Acting on information about possible tampering, police had a second sample drawn at the District Hospital, Aundh, and sent both for DNA analysis. The mismatch emerged days later. Two doctors and a hospital staff member were arrested; nine people were held by August 2024.",
    happenedTone: "warn",
    withNyaysetu:
      "Detected at the first hand-over, the same afternoon, without DNA — by design, not by a tip-off. The custody record names the window in which the swap happened and who held the exhibit during it.",
  },
  {
    when: "In court",
    title: "Proving what happened",
    happened: "The prosecution relies on DNA reports, call records and testimony to reconstruct what happened inside the hospital. The trial continues.",
    happenedTone: "neutral",
    withNyaysetu:
      "Add a record nobody can rewrite: who sealed the exhibit, who received it, which serial each saw and when — plus a BSA §63 certificate for the collection clip, with a QR code the court can scan.",
  },
];

const SOURCES = [
  { label: "The Tribune — Two Sassoon hospital doctors suspended over blood-sample swap (May 2024)", url: "https://www.tribuneindia.com/news/india/porsche-crash-blood-sample-swap-two-doctors-of-punes-sassoon-hospital-suspended-dean-sent-on-leave-625996/amp" },
  { label: "The Tribune — Teen's mother's blood was used in place of his sample, police say (May 2024)", url: "https://www.tribuneindia.com/news/india/punes-teen-mother-absconding-swapped-sons-blood-sample-with-hers-626267" },
  { label: "Scroll — Prosecution says the accused also approached a second hospital", url: "https://scroll.in/latest/1084363/scroll_in" },
  { label: "The Tribune — Two more held; arrests in the swap reach nine (Aug 2024)", url: "https://www.tribuneindia.com/news/india/porsche-car-crash-2-more-held-for-alleged-swapping-of-blood-samples-total-arrests-reach-9" },
  { label: "The Week (PTI) — Prosecution begins arguments for framing charges (June 2025)", url: "https://www.theweek.in/wire-updates/national/2025/06/27/bom26-mh-court-porsche-arguments.html" },
  { label: "SCC Online — Supreme Court upholds Section 63(4) BSA; hash value an electronic fingerprint (22 May 2026)", url: "https://www.scconline.com/blog/post/2026/07/08/sc-upholds-admissibility-of-electronic-evidence-under-section-63-4-bsa/" },
  { label: "LiveLaw — State e-Sakshya rules: the accused pays to have a hash checked (Aug 2026)", url: "https://www.livelaw.in/articles/madhya-pradesh-esakshya-rules-solve-custody-545161" },
];

const TONE: Record<Tone, string> = {
  neutral: "border-border bg-surface",
  ok: "border-success-soft bg-success-soft",
  warn: "border-warning-soft bg-warning-soft",
  bad: "border-danger-soft bg-danger-soft",
};

function Dot({ tone }: { tone: Tone }) {
  const c = tone === "bad" ? "bg-danger" : tone === "warn" ? "bg-warning" : tone === "ok" ? "bg-success" : "bg-faint";
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${c}`} />;
}

/** One ledger line, fingerprinted for real in the browser. */
function LedgerLine({ entry }: { entry: NonNullable<Step["ledger"]> }) {
  const [hash, setHash] = useState("");
  useEffect(() => {
    void sha256Text(JSON.stringify({ ...entry.record, at: `2024-05-19T${entry.at}:00+05:30` })).then(setHash);
  }, [entry]);
  return (
    <li className={`animate-overlay-in rounded-lg border px-3 py-2 ${entry.tone === "bad" ? "border-danger-soft bg-danger-soft" : "border-white/10 bg-white/[0.04]"}`}>
      <div className="flex items-center justify-between gap-3 font-ui text-xs">
        <span className={`font-semibold ${entry.tone === "bad" ? "text-danger" : "text-white"}`}>{entry.label}</span>
        <span className="shrink-0 font-mono text-white/50">{entry.at} IST</span>
      </div>
      <p className="mt-0.5 truncate font-mono text-[10px] text-[#8ce6b4]/80">{hash}</p>
    </li>
  );
}

/** Type a serial and see what the laboratory would see. */
function SwapLab() {
  const [serial, setSerial] = useState("MH-PN-0477");
  const [result, setResult] = useState<{ bound: string; seen: string; match: boolean } | null>(null);
  const norm = (v: string) => v.toUpperCase().replace(/[\s\-_/.]+/g, "");

  const check = async () => {
    const salt = "evidence-7f3c";
    const bound = await sha256Text(`nyaysetu-seal|${salt}|${norm(BOUND_SERIAL)}`);
    const seen = await sha256Text(`nyaysetu-seal|${salt}|${norm(serial)}`);
    setResult({ bound, seen, match: bound === seen });
  };

  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
      <h3 className="font-display text-2xl text-text">Try the swap yourself</h3>
      <p className="mt-2 font-ui text-sm leading-relaxed text-muted">
        The vial was sealed with serial <span className="font-mono font-semibold text-text">{BOUND_SERIAL}</span>, and only a salted digest of it went on the
        ledger. Type the serial on the vial that reaches the laboratory.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="swap-serial" className="sr-only">
          Serial on the vial at the laboratory
        </label>
        <input
          id="swap-serial"
          value={serial}
          onChange={(e) => {
            setSerial(e.target.value);
            setResult(null);
          }}
          className="input font-mono uppercase sm:max-w-xs"
          spellCheck={false}
          autoComplete="off"
        />
        <button type="button" onClick={() => void check()} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-fill px-6 py-2.5 font-ui text-sm font-semibold text-on-primary">
          Hand it to the laboratory <ArrowRight size={14} aria-hidden />
        </button>
      </div>
      {result && (
        <div role="status" className={`mt-5 rounded-2xl border p-4 ${result.match ? TONE.ok : TONE.bad}`}>
          <p className="flex items-center gap-2 font-ui text-sm font-bold text-text">
            {result.match ? <CheckCircle2 size={17} className="text-success" aria-hidden /> : <XCircle size={17} className="text-danger" aria-hidden />}
            {result.match ? "Same seal. Intake accepted." : "Different seal. Intake refused, recorded on the ledger, and the court is alerted."}
          </p>
          <dl className="mt-3 space-y-1.5 font-mono text-[11px] text-text">
            <div className="flex flex-col sm:flex-row sm:gap-3">
              <dt className="w-24 shrink-0 font-ui text-xs text-muted">On the ledger</dt>
              <dd className="break-all">{result.bound}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-3">
              <dt className="w-24 shrink-0 font-ui text-xs text-muted">At the lab</dt>
              <dd className="break-all">{result.seen}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

export default function CaseStudy() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const done = step >= STEPS.length;

  useEffect(() => {
    document.title = "Case replay · NyaySetu";
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (done) {
      setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 300 : 2600);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [playing, step, done]);

  const shown = STEPS.slice(0, Math.max(step, 0));
  const ledger = useMemo(() => shown.filter((s) => s.ledger).map((s) => s.ledger!), [shown]);

  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader tone="dark" />
      <main id="main">
        <section data-surface="dark" className="relative isolate overflow-hidden">
          <CinematicBackdrop />
          <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
            <p className="font-ui text-[11px] font-bold uppercase tracking-[0.22em] text-[#f9a15a]">Case replay · Pune · May 2024</p>
            <h1 className="mt-3 max-w-4xl font-ui font-extrabold uppercase leading-[0.98] tracking-[-0.03em] text-white" style={{ fontSize: "clamp(36px, 6vw, 76px)" }}>
              The sample that was swapped<span className="text-[#f97316]">.</span>
            </h1>
            <p className="mt-6 max-w-3xl font-ui text-base leading-relaxed text-white/75 sm:text-lg">
              In a crash that killed two people, a forensic blood sample was allegedly replaced inside a government hospital. It was caught because police
              had a tip-off and drew a second sample — luck, not system. Here is the same day, replayed beside what NyaySetu would have recorded.
            </p>
            <p className="mt-6 flex max-w-3xl items-start gap-2.5 rounded-2xl border border-white/10 bg-black/40 p-4 font-ui text-xs leading-relaxed text-white/65 backdrop-blur">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#f9a15a]" aria-hidden />
              Based on public news reports. The matter is before the court, and what is described are the prosecution's allegations. Nobody is named. Times on
              the NyaySetu side are illustrative. This shows a process, not a finding about any person.
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------- replay */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="replay-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="replay-title" className="font-display text-3xl text-text sm:text-4xl">
                Two versions of the same day
              </h2>
              <p className="mt-2 font-ui text-sm text-muted">
                Step {Math.min(step, STEPS.length)} of {STEPS.length}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (done) setStep(0);
                  setPlaying((p) => !p);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-primary-fill px-5 py-2.5 font-ui text-sm font-semibold text-on-primary"
              >
                {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />} {playing ? "Pause" : done ? "Replay" : "Play"}
              </button>
              <button
                type="button"
                disabled={done}
                onClick={() => {
                  setPlaying(false);
                  setStep((s) => Math.min(STEPS.length, s + 1));
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 font-ui text-sm font-semibold text-text disabled:opacity-40"
              >
                <SkipForward size={15} aria-hidden /> Next step
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setStep(0);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 font-ui text-sm font-semibold text-text"
                aria-label="Reset"
              >
                <RotateCcw size={15} aria-hidden />
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr_0.85fr]">
            <div>
              <p className="mb-3 font-ui text-xs font-bold uppercase tracking-[0.16em] text-faint">What happened</p>
              <ol className="space-y-3">
                {STEPS.map((s, i) => (
                  <li key={s.title} className={`rounded-2xl border p-4 transition-all duration-500 ${i < step ? TONE[s.happenedTone] : "border-dashed border-border bg-transparent"}`}>
                    <p className="flex items-center gap-2 font-ui text-[11px] font-semibold uppercase tracking-wider text-muted">
                      <Dot tone={i < step ? s.happenedTone : "neutral"} /> {s.when}
                    </p>
                    <h3 className="mt-1.5 font-ui text-base font-bold text-text">{s.title}</h3>
                    {i < step && <p className="mt-1 font-ui text-sm leading-relaxed text-text/85">{s.happened}</p>}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="mb-3 font-ui text-xs font-bold uppercase tracking-[0.16em] text-primary">With NyaySetu</p>
              <ol className="space-y-3">
                {STEPS.map((s, i) => (
                  <li key={s.title} className={`rounded-2xl border p-4 transition-all duration-500 ${i < step ? (s.ledger?.tone === "bad" ? TONE.bad : TONE.ok) : "border-dashed border-border"}`}>
                    <p className="font-ui text-[11px] font-semibold uppercase tracking-wider text-muted">{s.title}</p>
                    {i < step ? (
                      <p className="mt-1.5 font-ui text-sm leading-relaxed text-text">{s.withNyaysetu}</p>
                    ) : (
                      <p className="mt-1.5 font-ui text-sm text-faint">…</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
            <div data-surface="dark" className="h-fit rounded-3xl border border-white/10 bg-[#070b0a] p-5 lg:sticky lg:top-36">
              <p className="flex items-center gap-2 font-ui text-xs font-bold uppercase tracking-[0.16em] text-[#5ed29c]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#5ed29c]" aria-hidden /> Ledger
              </p>
              <p className="mt-1 font-ui text-[11px] text-white/60">Each line fingerprinted in your browser (SHA-256)</p>
              {ledger.length === 0 ? (
                <p className="mt-5 font-ui text-sm text-white/65">Press Play to begin.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {ledger.map((e) => (
                    <LedgerLine key={e.label} entry={e} />
                  ))}
                </ul>
              )}
              {done && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/[0.06] p-3 font-ui text-xs leading-relaxed text-white/80">
                  <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[#f9a15a]" aria-hidden />
                  Caught at 13:52 on the day — not days later — and the record of it cannot be edited by anyone involved.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- try it */}
        <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
          <SwapLab />
        </section>

        {/* ------------------------------------------------ the difference */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <Reveal>
              <h2 className="font-display text-3xl text-text sm:text-4xl">What changes</h2>
            </Reveal>
            <div className="mt-8 overflow-x-auto" tabIndex={0} role="region" aria-label="Comparison: without and with NyaySetu">
              <table className="w-full min-w-[560px] font-ui text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                    <th className="py-3 pr-4 font-semibold" />
                    <th className="py-3 pr-4 font-semibold">Without</th>
                    <th className="py-3 font-semibold text-primary">With NyaySetu</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["When the swap is found", "Days later", "At the first hand-over, the same day"],
                    ["How it is found", "A tip-off, a second sample and a DNA test", "A seal serial that does not match the ledger"],
                    ["Who learns of it", "A few investigators", "Prosecutor, court and supervising officer, at once"],
                    ["Can the record be altered", "Paper registers can be rewritten", "No — the refusal itself is on the ledger"],
                    ["Cost to the defence to check", "An application and a fee", "Nothing — a public page"],
                  ].map(([k, a, b]) => (
                    <tr key={k} className="border-b border-border last:border-0">
                      <th scope="row" className="py-3.5 pr-4 text-left font-semibold text-text">
                        {k}
                      </th>
                      <td className="py-3.5 pr-4 text-muted">{a}</td>
                      <td className="py-3.5 font-medium text-text">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-10 rounded-2xl border border-warning-soft bg-warning-soft p-5">
              <h3 className="font-ui text-base font-bold text-text">What NyaySetu would not have done</h3>
              <p className="mt-1.5 font-ui text-sm leading-relaxed text-text">
                If the people drawing the sample are themselves part of the plan, and the wrong person's blood goes into the original sealed vial in front of
                the camera, no ledger can know. The collection clip makes that far harder to do unseen, and the record shows exactly who was present — but
                the court still weighs the evidence. NyaySetu narrows where tampering can hide; it does not replace investigation.
              </p>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- the pattern */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <Reveal>
            <h2 className="font-display text-3xl text-text sm:text-4xl">Not one case — a pattern</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                t: "Malkhanas",
                b: "In 2024 the Madhya Pradesh High Court ordered a review of police property rooms after rats destroyed case evidence, and asked for inventories to be updated online every month. NyaySetu's malkhana register is digital and anchored by default.",
              },
              {
                t: "The cost of checking",
                b: "Commentary on one State's 2026 e-Sakshya rules notes that an accused who doubts a hash must pay to have it examined. On NyaySetu, verification is a public page and costs nothing.",
              },
              {
                t: "The law has moved",
                b: "On 22 May 2026 the Supreme Court upheld the BSA §63 hash certificate. The duty to fingerprint evidence exists; what is missing is a way for everyone to check it.",
              },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.05}>
                <div className="panel h-full p-6">
                  <h3 className="font-ui text-base font-bold text-text">{c.t}</h3>
                  <p className="mt-2 font-ui text-sm leading-relaxed text-muted">{c.b}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-12">
            <h2 className="font-ui text-sm font-bold uppercase tracking-[0.16em] text-faint">Sources</h2>
            <ul className="mt-3 space-y-2">
              {SOURCES.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-start gap-1.5 font-ui text-sm text-muted hover:text-primary">
                    <ExternalLink size={13} className="mt-1 shrink-0" aria-hidden /> {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link to="/verify" className="inline-flex items-center gap-2 rounded-full bg-primary-fill px-6 py-3 font-ui text-sm font-semibold text-on-primary">
              Verify a file now <ArrowRight size={15} aria-hidden />
            </Link>
            <Link to="/transparency" className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 font-ui text-sm font-semibold text-text">
              See the live ledger
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
