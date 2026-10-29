import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Download, FileCheck2, Gavel, ShieldX, Stamp } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useMutation, useQuery } from "../lib/useApi";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { formatDateTime } from "../lib/format";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";

/**
 * The final report's review (2.1): readiness findings, the officer's
 * particulars, and the versions with their states. Nothing here can make a
 * report "filed" except a court receipt entered by a person.
 */

type Level = "PASS" | "WARNING" | "BLOCKING" | "NOT_VERIFIED";
interface Finding {
  code: string;
  level: Level;
  area: string;
  message: string;
}
interface Summary {
  pass: number;
  warning: number;
  blocking: number;
  notVerified: number;
  canApprove: boolean;
}
interface Particulars {
  nature?: "charge_sheet" | "closure_report" | "untraced_report" | null;
  complainant?: string | null;
  narrative?: string | null;
  annexures?: string[] | null;
}
interface Version {
  id: string;
  version: number;
  state: "DRAFT" | "VALIDATION_REQUIRED" | "READY_FOR_REVIEW" | "APPROVED" | "EXPORTED" | "FILED";
  particulars: Particulars;
  content_sha256: string | null;
  generated_at: string;
  approved_at: string | null;
  filed_reference: string | null;
  summary: Summary;
}

const LEVEL_STYLE: Record<Level, { icon: typeof CheckCircle2; cls: string; label: string }> = {
  PASS: { icon: CheckCircle2, cls: "text-success", label: "Pass" },
  WARNING: { icon: AlertTriangle, cls: "text-warning", label: "Warning" },
  BLOCKING: { icon: ShieldX, cls: "text-danger", label: "Blocking" },
  NOT_VERIFIED: { icon: CircleDashed, cls: "text-muted", label: "Not verified" },
};

const STATE_STYLE: Record<Version["state"], string> = {
  DRAFT: "bg-surface-2 text-muted",
  VALIDATION_REQUIRED: "bg-danger-soft text-danger",
  READY_FOR_REVIEW: "bg-warning-soft text-warning",
  APPROVED: "bg-success-soft text-success",
  EXPORTED: "bg-success-soft text-success",
  FILED: "bg-primary-soft text-primary",
};

async function saveBlob(path: string, name: string): Promise<string | null> {
  const response = await api.download(path);
  const digest = response.headers.get("x-nyaysetu-sha256");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return digest;
}

export function ReportLifecycle({ caseId }: { caseId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const readiness = useQuery<{ findings: Finding[]; summary: Summary; particulars: Particulars }>(`/api/reports/cases/${caseId}/final-report/readiness`);
  const versions = useQuery<{ versions: Version[] }>(`/api/reports/cases/${caseId}/final-report/versions`);
  const [editing, setEditing] = useState(false);
  const [filing, setFiling] = useState<Version | null>(null);
  const role = user?.role;
  const canDraft = role === "police" || role === "prosecutor";
  const latest = versions.data?.versions[0];

  const refresh = () => {
    readiness.refetch();
    versions.refetch();
  };

  const approve = useMutation(async (id: string) => api.post<{ version: Version }>(`/api/reports/final-report/versions/${id}/approve`, {}));

  return (
    <div className="mt-5 space-y-5 border-t border-border pt-5">
      {/* ------------------------------------------------ readiness */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-ui text-sm font-bold text-text">Document readiness</h3>
          <Button
            size="sm"
            variant="ghost"
            icon={<Download size={13} />}
            onClick={() => void saveBlob(`/api/reports/cases/${caseId}/final-report/readiness.pdf`, "readiness-report.pdf").catch(() => toast.error("Could not produce the readiness report"))}
          >
            Readiness report
          </Button>
        </div>
        {readiness.data ? (
          <>
            <p className={`mt-2 rounded-lg px-3 py-2 font-ui text-xs font-semibold ${readiness.data.summary.canApprove ? "bg-success-soft text-text" : "bg-danger-soft text-text"}`}>
              {readiness.data.summary.pass} passed · {readiness.data.summary.warning} warning(s) · {readiness.data.summary.blocking} blocking ·{" "}
              {readiness.data.summary.notVerified} not verified —{" "}
              {readiness.data.summary.canApprove ? "nothing blocks approval by an authorised officer." : "approval is blocked until the blocking items are resolved."}
            </p>
            <ul className="mt-2 space-y-1.5">
              {readiness.data.findings.map((f) => {
                const s = LEVEL_STYLE[f.level];
                return (
                  <li key={f.code} className="flex items-start gap-2 font-ui text-xs leading-relaxed">
                    <s.icon size={14} className={`mt-0.5 shrink-0 ${s.cls}`} aria-hidden />
                    <span>
                      <span className={`font-semibold ${s.cls}`}>{s.label}</span> <span className="text-muted">· {f.message}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 font-ui text-2xs text-faint">Passing these checks makes the record ready for review. It does not make the report legally valid; signature and endorsement remain with the officer.</p>
          </>
        ) : (
          <p className="mt-2 font-ui text-xs text-muted">{readiness.error ? (readiness.error as Error).message : "Checking the record and the ledger…"}</p>
        )}
      </section>

      {/* ------------------------------------------------ versions */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-ui text-sm font-bold text-text">Versions</h3>
          {canDraft && (
            <Button size="sm" icon={<FileCheck2 size={13} />} onClick={() => setEditing(true)}>
              {latest ? "New version" : "Prepare version 1"}
            </Button>
          )}
        </div>
        {versions.error ? <p className="mt-2 font-ui text-xs text-muted">{(versions.error as Error).message}</p> : null}
        {versions.data && versions.data.versions.length === 0 && <p className="mt-2 font-ui text-xs text-muted">No version yet. The working draft above is not a version and cannot be approved.</p>}
        <ul className="mt-2 space-y-2">
          {versions.data?.versions.map((v, i) => (
            <li key={v.id} className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-ui text-sm font-semibold text-text">
                  Version {v.version}
                  <span className={`rounded-full px-2 py-0.5 font-ui text-2xs font-bold ${STATE_STYLE[v.state]}`}>{v.state.replace(/_/g, " ").toLowerCase()}</span>
                </span>
                <span className="font-ui text-2xs text-faint">{formatDateTime(v.generated_at)}</span>
              </div>
              {v.content_sha256 && <p className="mt-1 break-all font-mono text-2xs text-muted">SHA-256 {v.content_sha256}</p>}
              {v.filed_reference && <p className="mt-1 font-ui text-xs text-text">Filed · court receipt {v.filed_reference}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Download size={13} />}
                  onClick={async () => {
                    try {
                      const digest = await saveBlob(`/api/reports/final-report/versions/${v.id}/pdf`, `final-report-v${v.version}.pdf`);
                      toast.success(`Version ${v.version} downloaded`, digest ? `SHA-256 ${digest.slice(0, 18)}…` : undefined);
                      versions.refetch();
                    } catch {
                      toast.error("Could not produce the PDF");
                    }
                  }}
                >
                  {["APPROVED", "EXPORTED", "FILED"].includes(v.state) ? "Approved PDF" : "Draft PDF"}
                </Button>
                {role === "police" && i === 0 && ["READY_FOR_REVIEW", "VALIDATION_REQUIRED"].includes(v.state) && (
                  <Button
                    size="sm"
                    icon={<Stamp size={13} />}
                    loading={approve.pending}
                    onClick={async () => {
                      const out = await approve.run(v.id);
                      if (out) toast.success(`Version ${v.version} approved`, "The PDF is frozen with its SHA-256.");
                      else if (approve.error instanceof ApiError) toast.error("Not approved", approve.error.message);
                      refresh();
                    }}
                  >
                    Approve
                  </Button>
                )}
                {(role === "prosecutor" || role === "court_admin") && ["APPROVED", "EXPORTED"].includes(v.state) && (
                  <Button size="sm" variant="ghost" icon={<Gavel size={13} />} onClick={() => setFiling(v)}>
                    Record filing
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {editing && (
        <ParticularsModal
          caseId={caseId}
          initial={latest?.particulars ?? readiness.data?.particulars ?? {}}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}
      {filing && (
        <FilingModal
          version={filing}
          onClose={() => setFiling(null)}
          onSaved={() => {
            setFiling(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ParticularsModal({ caseId, initial, onClose, onSaved }: { caseId: string; initial: Particulars; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [nature, setNature] = useState(initial.nature ?? "");
  const [complainant, setComplainant] = useState(initial.complainant ?? "");
  const [narrative, setNarrative] = useState(initial.narrative ?? "");
  const [annexures, setAnnexures] = useState((initial.annexures ?? []).join("\n"));
  const save = useMutation(async () =>
    api.post<{ version: Version }>(`/api/reports/cases/${caseId}/final-report/versions`, {
      nature: nature || null,
      complainant: complainant.trim() || null,
      narrative: narrative.trim() || null,
      annexures: annexures.split("\n").map((a) => a.trim()).filter(Boolean),
    })
  );
  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title="Prepare a version of the final report"
      description="These particulars are not held anywhere else in NyaySetu. They are checked at once; a version with blocking findings is saved but cannot be approved."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.pending}
            onClick={async () => {
              const out = await save.run(undefined as never);
              if (out) {
                toast.success(`Version ${out.version.version} saved`, out.version.summary.canApprove ? "Ready for review." : "Validation required before approval.");
                onSaved();
              }
            }}
          >
            Save as a new version
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nature of the report" required>
          <Select value={nature} onChange={(e) => setNature(e.target.value as Particulars["nature"] & string)}>
            <option value="">Choose…</option>
            <option value="charge_sheet">Charge sheet</option>
            <option value="closure_report">Closure report</option>
            <option value="untraced_report">Untraced report</option>
          </Select>
        </Field>
        <Field label="Complainant / informant particulars" hint="From the station records: name, parentage, address." required>
          <Textarea rows={2} value={complainant} onChange={(e) => setComplainant(e.target.value)} />
        </Field>
        <Field label="Brief facts and investigation" hint="Written by the investigating officer. NyaySetu does not compose it." required>
          <Textarea rows={6} value={narrative} onChange={(e) => setNarrative(e.target.value)} />
        </Field>
        <Field label="Annexures" hint="One per line: statements, reports, memos.">
          <Textarea rows={3} value={annexures} onChange={(e) => setAnnexures(e.target.value)} />
        </Field>
        {save.error && (
          <p role="alert" className="font-ui text-xs text-danger">
            {save.error.message}
          </p>
        )}
      </div>
    </Modal>
  );
}

function FilingModal({ version, onClose, onSaved }: { version: Version; onClose: () => void; onSaved: () => void }) {
  const [reference, setReference] = useState("");
  const [filedOn, setFiledOn] = useState(new Date().toISOString().slice(0, 10));
  const save = useMutation(async () => api.post(`/api/reports/final-report/versions/${version.id}/filed`, { reference: reference.trim(), filedOn }));
  return (
    <Modal
      open
      onClose={onClose}
      title={`Record filing of version ${version.version}`}
      description="Only after the court has received it. Enter the receipt or diary number the court gave; downloading the PDF is not filing."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={reference.trim().length < 3} loading={save.pending} onClick={async () => (await save.run(undefined as never)) && onSaved()}>
            Record filing
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Court receipt / diary number" required>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Filed on" required>
          <Input type="date" value={filedOn} onChange={(e) => setFiledOn(e.target.value)} />
        </Field>
        {save.error && (
          <p role="alert" className="font-ui text-xs text-danger">
            {save.error.message}
          </p>
        )}
      </div>
    </Modal>
  );
}
