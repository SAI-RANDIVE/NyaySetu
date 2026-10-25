import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Boxes, CheckCircle2, Download, ExternalLink, FileCheck2, FlaskConical, Gavel, Link2, RefreshCw, ScrollText, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { api } from "../lib/api";
import { sha256File } from "../lib/hash";
import { formatDateTime } from "../lib/format";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

/**
 * Public transparency: aggregate figures from the live system and the ledger
 * transactions behind them, plus a hands-on demonstration of why a fingerprint
 * reveals any change. No sign-in; no names, references or locations.
 */

interface Stats {
  generatedAt: string;
  evidence: { registered: number; confirmedOnChain: number; pending: number; mismatchRecorded: number };
  verification: { checks: number; matched: number; refused: number };
  custody: { transfers: number; malkhanaMovements: number; seizureMemos: number; labIntakes: number; forensicReports: number };
  court: { summonsIssued: number; summonsAcknowledged: number; certificates: number };
  cost: { measuredTransactions: number; averageGas: number | null; byMethod: { method: string; transactions: number; averageGas: number }[] };
  ledger: {
    network: string | null;
    chainId: number | null;
    contracts: { name: string; address: string; explorer: string | null }[];
    recent: { at: string; purpose: string; txHash: string; explorer: string | null }[];
  };
}

function Figure({ value, label, icon: Icon, tone = "text-text" }: { value: number | string; label: string; icon: typeof ShieldCheck; tone?: string }) {
  return (
    <div className="panel p-5">
      <Icon size={18} className="text-primary" aria-hidden />
      <p className={`mt-3 font-display text-3xl ${tone}`}>{value}</p>
      <p className="mt-1 font-ui text-sm text-muted">{label}</p>
    </div>
  );
}

/** Highlights the characters of `b` that differ from `a`. */
function Diff({ a, b }: { a: string; b: string }) {
  return (
    <code className="block break-all font-mono text-xs leading-relaxed">
      {b.split("").map((ch, i) => (
        <span key={i} className={ch !== a[i] ? "rounded-sm bg-danger-soft font-semibold text-danger" : "text-text"}>
          {ch}
        </span>
      ))}
    </code>
  );
}

function TamperLab() {
  const [original, setOriginal] = useState<{ name: string; bytes: Uint8Array<ArrayBuffer>; hash: string } | null>(null);
  const [altered, setAltered] = useState<{ bytes: Uint8Array<ArrayBuffer>; hash: string; position: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = async (file: File) => {
    setBusy(true);
    setAltered(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setOriginal({ name: file.name, bytes, hash: await sha256File(file) });
    setBusy(false);
  };

  const useSample = async () => {
    const text = "Seizure memo SZ-17/2026: one black mobile phone, cracked screen, sealed with seal SPS-0917 in the presence of two witnesses.";
    await load(new File([text], "sample-memo.txt", { type: "text/plain" }));
  };

  const tamper = async () => {
    if (!original) return;
    const bytes = original.bytes.slice();
    const position = Math.floor(bytes.length / 2);
    bytes[position] = bytes[position] ^ 0x01; // flip the lowest bit of one byte
    setAltered({ bytes, hash: await sha256File(new Blob([bytes])), position });
  };

  const downloadAltered = () => {
    if (!altered || !original) return;
    const url = URL.createObjectURL(new Blob([altered.bytes]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `altered-${original.name}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const changed = altered && original ? altered.hash.split("").filter((c, i) => c !== original.hash[i]).length : 0;

  return (
    <div className="panel p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h3 className="font-display text-2xl text-text">Tamper lab: change one bit, see what happens</h3>
          <p className="mt-2 font-ui text-sm leading-relaxed text-muted">
            Choose any file — it stays in this browser. NyaySetu computes its SHA-256 fingerprint, then changes a single bit of a single byte and fingerprints
            it again. Even that smallest possible edit produces a completely different fingerprint, which is why a fingerprint recorded at the scene
            exposes any later alteration.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-primary-fill px-5 py-2.5 font-ui text-sm font-semibold text-on-primary">
            <Upload size={15} aria-hidden /> Choose a file
          </button>
          <button type="button" onClick={() => void useSample()} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 font-ui text-sm font-semibold text-text hover:border-primary">
            Use a sample
          </button>
          <input ref={input} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} aria-label="Choose a file to fingerprint" />
        </div>
      </div>

      {busy && <p className="mt-6 font-ui text-sm text-muted">Fingerprinting…</p>}
      {original && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-success-soft bg-success-soft p-4">
            <p className="flex items-center gap-2 font-ui text-sm font-semibold text-text">
              <CheckCircle2 size={16} className="text-success" aria-hidden /> Original: {original.name} ({original.bytes.length.toLocaleString()} bytes)
            </p>
            <code className="mt-2 block break-all font-mono text-xs text-text">{original.hash}</code>
          </div>
          {!altered ? (
            <button type="button" onClick={() => void tamper()} className="inline-flex items-center gap-2 rounded-full border border-danger-soft bg-danger-soft px-5 py-2.5 font-ui text-sm font-semibold text-danger">
              <ShieldAlert size={15} aria-hidden /> Change one bit of byte {Math.floor(original.bytes.length / 2).toLocaleString()}
            </button>
          ) : (
            <div className="rounded-xl border border-danger-soft bg-danger-soft p-4">
              <p className="flex items-center gap-2 font-ui text-sm font-semibold text-text">
                <ShieldAlert size={16} className="text-danger" aria-hidden /> Altered copy — 1 bit changed at byte {altered.position.toLocaleString()}
              </p>
              <div className="mt-2">
                <Diff a={original.hash} b={altered.hash} />
              </div>
              <p className="mt-2 font-ui text-xs text-text">
                <strong>{changed} of 66</strong> fingerprint characters changed. The altered copy would fail verification against the ledger.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={downloadAltered} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 font-ui text-xs font-semibold text-text">
                  <Download size={13} aria-hidden /> Download the altered copy
                </button>
                <button type="button" onClick={() => setAltered(null)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 font-ui text-xs font-semibold text-text">
                  <RefreshCw size={13} aria-hidden /> Reset
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Transparency() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Transparency · NyaySetu";
    api
      .get<Stats>("/api/public/stats")
      .then(setStats)
      .catch(() => setError("Live figures are unavailable at the moment."));
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader />

      <main id="main" className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6 sm:py-16">
        <section>
          <p className="mb-2 font-ui text-xs font-bold uppercase tracking-[0.18em] text-primary">Transparency</p>
          <h1 className="max-w-3xl font-display text-4xl leading-tight text-text sm:text-5xl">The system, in the open</h1>
          <p className="mt-4 max-w-3xl font-ui text-lg leading-relaxed text-muted">
            Live figures from NyaySetu and the public ledger transactions behind them. Only counts are shown here — never a name, a case reference, a
            location or a file. Every transaction can be checked independently on a block explorer.
          </p>
          {stats && <p className="mt-2 font-ui text-xs text-faint">Updated {formatDateTime(stats.generatedAt)}</p>}
          {error && <p className="mt-4 rounded-xl bg-warning-soft p-4 font-ui text-sm text-text">{error}</p>}
        </section>

        {stats && (
          <>
            <section aria-label="Evidence">
              <h2 className="mb-4 font-display text-2xl text-text">Evidence</h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Figure value={stats.evidence.registered} label="items registered" icon={FileCheck2} />
                <Figure value={stats.evidence.confirmedOnChain} label="confirmed on the ledger" icon={ShieldCheck} tone="text-success" />
                <Figure value={stats.verification.checks} label="integrity checks performed" icon={CheckCircle2} />
                <Figure value={stats.verification.refused} label="alterations detected and recorded" icon={ShieldAlert} tone={stats.verification.refused ? "text-danger" : "text-text"} />
              </div>
            </section>
            <section aria-label="Custody and court">
              <h2 className="mb-4 font-display text-2xl text-text">Custody and court</h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Figure value={stats.custody.transfers} label="custody hand-overs, each re-verified" icon={Link2} />
                <Figure value={stats.custody.seizureMemos + stats.custody.malkhanaMovements} label="seizure memos and malkhana entries" icon={Boxes} />
                <Figure value={stats.custody.labIntakes + stats.custody.forensicReports} label="laboratory intakes and reports" icon={FlaskConical} />
                <Figure value={`${stats.court.summonsAcknowledged}/${stats.court.summonsIssued}`} label="summons acknowledged / issued" icon={ScrollText} />
              </div>
            </section>
            <section aria-label="Ledger" className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <div className="panel p-6">
                <h2 className="font-display text-xl text-text">Smart contracts</h2>
                <p className="mt-1 font-ui text-sm text-muted">{stats.ledger.network ? `Ethereum ${stats.ledger.network}` : "Ledger not connected"}</p>
                <ul className="mt-4 space-y-2">
                  {stats.ledger.contracts.map((c) => (
                    <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                      <span className="font-ui text-sm font-semibold text-text">{c.name}</span>
                      {c.explorer ? (
                        <a href={c.explorer} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                          {c.address.slice(0, 10)}…{c.address.slice(-6)} <ExternalLink size={11} aria-hidden />
                        </a>
                      ) : (
                        <code className="font-mono text-xs text-muted">{c.address}</code>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel p-6">
                <h2 className="font-display text-xl text-text">Latest anchored records</h2>
                {stats.ledger.recent.length === 0 ? (
                  <p className="mt-3 font-ui text-sm text-muted">No records anchored yet.</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {stats.ledger.recent.map((r) => (
                      <li key={r.txHash} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                        <span className="font-ui text-sm text-text">{r.purpose}</span>
                        <span className="flex items-center gap-3">
                          <span className="font-ui text-xs text-faint">{r.at ? formatDateTime(r.at) : ""}</span>
                          {r.explorer ? (
                            <a href={r.explorer} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                              {r.txHash.slice(0, 10)}… <ExternalLink size={11} aria-hidden />
                            </a>
                          ) : (
                            <code className="font-mono text-xs text-muted">{r.txHash.slice(0, 10)}…</code>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}

        {stats?.cost && stats.cost.averageGas != null && (
          <section aria-label="Cost per record" className="panel p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
              <div>
                <h2 className="font-display text-2xl text-text">What a record costs</h2>
                <p className="mt-2 font-ui text-sm leading-relaxed text-muted">
                  Measured from {stats.cost.measuredTransactions.toLocaleString("en-IN")} confirmed transactions, not estimated. Only a 32-byte fingerprint
                  is written, so the cost per record is fixed whatever the size of the file.
                </p>
                <p className="mt-5 font-display text-4xl text-text">{stats.cost.averageGas.toLocaleString("en-IN")}</p>
                <p className="font-ui text-sm text-muted">gas per transaction, on average</p>
                <p className="mt-4 rounded-xl bg-surface-2 p-3 font-ui text-xs leading-relaxed text-muted">
                  At 10 gwei on Ethereum mainnet that is about <strong className="text-text">{((stats.cost.averageGas * 10) / 1e9).toFixed(4)} ETH</strong> per
                  record. A layer-2 network or a permissioned ledger operated by the State costs a small fraction of that, with the same contracts.
                </p>
              </div>
              <div>
                <table className="w-full font-ui text-sm">
                  <caption className="sr-only">Average gas by operation</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-2xs uppercase tracking-wider text-faint">
                      <th className="py-2 font-semibold">Operation</th>
                      <th className="py-2 text-right font-semibold">Transactions</th>
                      <th className="py-2 text-right font-semibold">Average gas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.cost.byMethod.map((m) => (
                      <tr key={m.method} className="border-b border-border last:border-0">
                        <td className="py-2.5 font-mono text-xs text-text">{m.method}</td>
                        <td className="py-2.5 text-right text-muted">{m.transactions.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 text-right text-text">{m.averageGas.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <section aria-label="Tamper lab">
          <TamperLab />
        </section>

        <section className="rounded-[28px] border border-primary-ring bg-primary-soft px-6 py-10 text-center">
          <Gavel size={22} className="mx-auto text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-2xl text-text">Hold a file from a case? Check it against the ledger.</h2>
          <Link to="/verify" className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-fill px-6 py-3 font-ui text-sm font-semibold text-on-primary">
            Open verification <ArrowRight size={15} aria-hidden />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
