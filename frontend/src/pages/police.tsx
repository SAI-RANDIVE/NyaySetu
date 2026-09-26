import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Camera, ClipboardList, PackageCheck, Plus } from "lucide-react";
import { api, ApiError, type CaseRow, type EvidenceRow } from "../lib/api";
import { useMutation, useQuery } from "../lib/useApi";
import { useToast } from "../context/ToastContext";
import { formatDateTime, relativeTime, CASE_STATUS_LABEL } from "../lib/format";
import { AsyncView, EmptyState } from "../components/DataState";
import {
  Button,
  Card,
  Field,
  Input,
  LinkButton,
  Modal,
  PageHeader,
  Select,
  Stat,
  Textarea,
} from "../components/ui";
import { FileHashPicker, GpsCapture, type HashedFile } from "../components/capture";
import { IntegrityBadge, StageChip, StatusChip } from "../components/trust";
import type { Fix } from "../lib/geo";

/* ================================================== PoliceDashboard ====== */

export function PoliceDashboard() {
  const cases = useQuery<{ cases: CaseRow[] }>("/api/cases");
  const [registerOpen, setRegisterOpen] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="SaakshyaSetu"
        title="Field operations"
        description="Register an FIR, capture evidence at the scene, and hand it to the laboratory with a hash-confirmed transfer."
        actions={
          <>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setRegisterOpen(true)}>
              Register FIR
            </Button>
            <LinkButton to="/police/capture" icon={<Camera size={14} />} className="hidden sm:inline-flex">
              Capture evidence
            </LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Link
          to="/police/capture"
          className="panel group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lift"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Camera size={19} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base text-text">Capture evidence</p>
            <p className="mt-0.5 font-ui text-2xs leading-relaxed text-muted">
              Hashed on this device before upload
            </p>
          </div>
          <ArrowRight size={15} className="ml-auto shrink-0 text-faint transition group-hover:text-primary" />
        </Link>

        <Link
          to="/police/cases"
          className="panel group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lift"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-info-soft text-info">
            <ClipboardList size={19} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base text-text">My cases</p>
            <p className="mt-0.5 font-ui text-2xs leading-relaxed text-muted">
              {cases.data?.cases.length ?? "—"} assigned
            </p>
          </div>
          <ArrowRight size={15} className="ml-auto shrink-0 text-faint transition group-hover:text-primary" />
        </Link>

        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="panel group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lift"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">
            <Plus size={19} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base text-text">Register an FIR</p>
            <p className="mt-0.5 font-ui text-2xs leading-relaxed text-muted">
              Creates the on-chain case id
            </p>
          </div>
          <ArrowRight size={15} className="ml-auto shrink-0 text-faint transition group-hover:text-primary" />
        </button>
      </div>

      <Card title="Recent cases" subtitle="Cases you are assigned to, newest first.">
        <AsyncView
          state={cases}
          onRetry={cases.refetch}
          context="your cases"
          isEmpty={(data) => data.cases.length === 0}
          empty={
            <EmptyState
              title="No cases yet"
              description="Register an FIR to create one. You are assigned write access automatically."
              icon={<ClipboardList size={19} />}
              action={<Button size="sm" onClick={() => setRegisterOpen(true)}>Register FIR</Button>}
            />
          }
        >
          {(data) => (
            <ul className="space-y-2.5">
              {data.cases.slice(0, 8).map((row) => (
                <li key={row.id}>
                  <Link
                    to={`/police/cases/${row.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 transition hover:border-border-strong"
                  >
                    <div className="min-w-0">
                      <p className="font-ui text-sm font-medium text-text">{row.title}</p>
                      <code className="mt-0.5 block font-mono text-2xs text-muted">{row.fir_number}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip tone="info" label={CASE_STATUS_LABEL[row.status] ?? row.status} />
                      <span className="font-ui text-2xs text-faint">{relativeTime(row.registered_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AsyncView>
      </Card>

      <RegisterFirModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onCreated={() => {
          cases.refetch();
          setRegisterOpen(false);
        }}
      />
    </>
  );
}

/* ================================================== RegisterFirModal ===== */

function RegisterFirModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (caseId: string) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    firNumber: "",
    title: "",
    offenceType: "",
    sections: "",
    policeStation: "",
    courtName: "",
    summary: "",
  });

  const create = useMutation(async () =>
    api.post<{ case: CaseRow }>("/api/cases", {
      firNumber: form.firNumber.trim(),
      title: form.title.trim(),
      offenceType: form.offenceType.trim(),
      sections: form.sections
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      policeStation: form.policeStation.trim(),
      courtName: form.courtName.trim() || undefined,
      summary: form.summary.trim() || undefined,
    })
  );

  const valid =
    form.firNumber.trim().length >= 4 &&
    form.title.trim().length >= 3 &&
    form.offenceType.trim().length >= 3 &&
    form.policeStation.trim().length >= 3;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register an FIR"
      description="The on-chain case id is keccak256 of the FIR number, so it must be exact and it cannot be changed later."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            loading={create.pending}
            onClick={async () => {
              const outcome = await create.run(undefined as never);
              if (outcome) {
                toast.success("Case registered", `${outcome.case.fir_number} is now on the register.`);
                onCreated(outcome.case.id);
              }
            }}
          >
            Register
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="FIR number"
          required
          hint="Letters, digits, slash, dash and underscore. This becomes the on-chain case id."
        >
          <Input
            value={form.firNumber}
            onChange={(event) => setForm({ ...form, firNumber: event.target.value })}
            placeholder="FIR/2026/PUNE-SHIVAJINAGAR/0418"
            className="font-mono"
          />
        </Field>

        <Field label="Case title" required>
          <Input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="State vs. …"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Offence type" required>
            <Input
              value={form.offenceType}
              onChange={(event) => setForm({ ...form, offenceType: event.target.value })}
              placeholder="Aggravated burglary"
            />
          </Field>
          <Field label="Sections" hint="Comma separated">
            <Input
              value={form.sections}
              onChange={(event) => setForm({ ...form, sections: event.target.value })}
              placeholder="BNS 331(4), BNS 117(2)"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Police station" required>
            <Input
              value={form.policeStation}
              onChange={(event) => setForm({ ...form, policeStation: event.target.value })}
              placeholder="Shivajinagar Police Station, Pune"
            />
          </Field>
          <Field label="Court">
            <Input
              value={form.courtName}
              onChange={(event) => setForm({ ...form, courtName: event.target.value })}
              placeholder="Sessions Court, Pune"
            />
          </Field>
        </div>

        <Field label="Summary" hint="Stored off chain. Editable later; never anchored.">
          <Textarea
            value={form.summary}
            onChange={(event) => setForm({ ...form, summary: event.target.value })}
            placeholder="What was reported, when, and by whom."
          />
        </Field>

        {create.error && (
          <p role="alert" className="font-ui text-xs text-danger">
            {create.error.message}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ==================================================== CapturePage ======== */

const KINDS = [
  { value: "photo", label: "Photograph" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio recording" },
  { value: "document", label: "Document" },
  { value: "physical", label: "Photograph of a physical exhibit" },
] as const;

/**
 * Field capture, mobile-first.
 *
 * The order of the form matches the order the system enforces: choose the case,
 * hash the file on the device, take a position fix, then register. The submit
 * button is unavailable until all three exist, so an officer cannot half-record
 * an item and discover the problem later.
 */
export function CapturePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const cases = useQuery<{ cases: CaseRow[] }>("/api/cases");

  const [caseId, setCaseId] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("photo");
  const [picked, setPicked] = useState<HashedFile | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [notes, setNotes] = useState("");
  const [collectedAt, setCollectedAt] = useState(() => new Date().toISOString().slice(0, 16));

  const writable = useMemo(
    () => (cases.data?.cases ?? []).filter((row) => row.access !== "read"),
    [cases.data]
  );

  const register = useMutation(async () => {
    if (!picked || !fix) throw new Error("A file and a position fix are both required.");

    const form = new FormData();
    form.append("file", picked.file);
    form.append("caseId", caseId);
    form.append("clientHash", picked.hash);
    form.append("kind", kind);
    form.append("gpsLat", String(fix.lat));
    form.append("gpsLng", String(fix.lng));
    form.append("collectedAt", new Date(collectedAt).toISOString());
    // The file's own mtime is what the anomaly model compares against the
    // claimed collection time.
    form.append("deviceReportedMtime", picked.lastModified);
    if (notes.trim()) form.append("notes", notes.trim());

    return api.upload<{
      evidence: EvidenceRow;
      screening: { available: boolean; anomaly: boolean; score: number; reasons: string[] };
      chain: { txHash: string; explorer: string | null; chainEvidenceId: number | null };
    }>("/api/evidence", form);
  });

  const ready = Boolean(caseId && picked && fix);

  return (
    <>
      <PageHeader
        eyebrow="SaakshyaSetu · field capture"
        title="Capture evidence"
        description="The digest is computed here, on this device, before anything is uploaded. The server recomputes it and refuses the upload if the two differ."
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Card title="1 · Case" subtitle="You need write access on the case to add evidence to it.">
            <AsyncView
              state={cases}
              onRetry={cases.refetch}
              context="your cases"
              isEmpty={() => writable.length === 0}
              empty={
                <EmptyState
                  title="No case with write access"
                  description="Register an FIR from the dashboard, or ask the court administrator to assign you write access."
                  icon={<ClipboardList size={19} />}
                  action={
                    <Button size="sm" onClick={() => navigate("/police")}>
                      Back to dashboard
                    </Button>
                  }
                />
              }
            >
              {() => (
                <Field label="Case" required>
                  <Select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
                    <option value="">Select a case…</option>
                    {writable.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.fir_number} — {row.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </AsyncView>
          </Card>

          <Card title="2 · The file" subtitle="Hashed with SHA-256 in your browser.">
            <FileHashPicker value={picked} onChange={setPicked} disabled={register.pending} />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Kind" required>
                <Select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
                  {KINDS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Collected at"
                required
                hint="When the item was actually seized, not when you are uploading it."
              >
                <Input
                  type="datetime-local"
                  value={collectedAt}
                  max={new Date().toISOString().slice(0, 16)}
                  onChange={(event) => setCollectedAt(event.target.value)}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Notes" hint="Where it was found, and in what condition. Stored off chain.">
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Seized from the rear entrance, bagged and sealed on site."
                />
              </Field>
            </div>
          </Card>

          <Card
            title="3 · Position"
            subtitle="The coordinates go on chain alongside the digest and the timestamp."
          >
            <GpsCapture value={fix} onChange={setFix} autoRequest />
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card title="Ready to register?">
            <ul className="space-y-2.5">
              <Checklist done={Boolean(caseId)} label="Case selected" />
              <Checklist done={Boolean(picked)} label="File hashed on this device" />
              <Checklist done={Boolean(fix)} label="Position captured" />
            </ul>

            {picked && (
              <div className="mt-4 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                <p className="font-ui text-2xs font-semibold uppercase tracking-wider text-faint">
                  Digest going on chain
                </p>
                <code className="mt-1 block hash text-text">{picked.hash}</code>
              </div>
            )}

            {register.error && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-danger-soft bg-danger-soft px-3 py-2.5"
              >
                <p className="font-ui text-xs font-semibold text-text">Registration refused</p>
                <p className="mt-1 font-ui text-2xs leading-relaxed text-muted">
                  {register.error.message}
                </p>
              </div>
            )}

            <Button
              full
              size="lg"
              className="mt-4"
              disabled={!ready}
              loading={register.pending}
              icon={<PackageCheck size={15} />}
              onClick={async () => {
                const outcome = await register.run(undefined as never);
                if (!outcome) return;

                if (outcome.screening.available && outcome.screening.anomaly) {
                  toast.warning(
                    "Registered, and flagged at intake",
                    outcome.screening.reasons[0] ??
                      "Screening found something unusual. The verdict is anchored and cannot be removed."
                  );
                } else {
                  toast.success(
                    `Registered as evidence #${outcome.chain.chainEvidenceId}`,
                    "The digest, coordinates and timestamp are on chain.",
                    outcome.chain.explorer
                      ? { href: outcome.chain.explorer, label: "View transaction" }
                      : undefined
                  );
                }
                navigate(`/police/cases/evidence/${outcome.evidence.id}`);
              }}
            >
              Register on chain
            </Button>

            <p className="mt-3 font-ui text-2xs leading-relaxed text-faint">
              This writes a transaction. The file itself is encrypted with AES-256-GCM and pinned to
              IPFS; only its digest, the coordinates and your Aadhaar token go on chain.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Checklist({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-2xs font-bold ${
          done ? "border-primary bg-primary text-on-primary" : "border-border text-faint"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span className={`font-ui text-xs ${done ? "text-text" : "text-faint"}`}>{label}</span>
    </li>
  );
}
