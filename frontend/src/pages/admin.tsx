import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Blocks,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSearch,
  HardDrive,
  KeyRound,
  Link2Off,
  Plus,
  RefreshCw,
  ScrollText,
  Users as UsersIcon,
  Wallet,
} from "lucide-react";
import { api, type HealthResponse, type Role } from "../lib/api";
import { useMutation, useQuery } from "../lib/useApi";
import { useToast } from "../context/ToastContext";
import { ROLE_LABEL, formatDateTime, formatEth, relativeTime } from "../lib/format";
import { shortHash } from "../lib/hash";
import { AsyncView, EmptyState } from "../components/DataState";
import { Button, Card, Field, Input, Modal, PageHeader, Select, Stat } from "../components/ui";
import { StatusChip, TxLink } from "../components/trust";

/* ==================================================== AdminOverview ====== */

interface Stats {
  stats: {
    activeUsers: number;
    cases: number;
    evidenceItems: number;
    flaggedEvidence: number;
    summonsPending: number;
    summonsFailed: number;
    activeBailOrders: number;
    openViolations: number;
  };
}

export function AdminOverview() {
  const toast = useToast();
  const stats = useQuery<Stats>("/api/admin/stats", [], { pollMs: 60_000 });
  const health = useQuery<HealthResponse>("/api/health", [], { pollMs: 30_000 });

  const sweepSummons = useMutation(async () => api.post<{ marked: number }>("/api/summons/sweep"));
  const sweepBail = useMutation(async () => api.post<{ flagged: number }>("/api/bail/sweep"));

  return (
    <>
      <PageHeader
        eyebrow="Court registry"
        title="System overview"
        description="Participants, case load, and whether every subsystem this platform depends on is actually running."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={sweepSummons.pending}
              icon={<ScrollText size={13} />}
              onClick={async () => {
                const outcome = await sweepSummons.run(undefined as never);
                if (outcome)
                  toast.success(
                    outcome.marked === 0 ? "Nothing overdue" : `${outcome.marked} marked non-delivered`,
                    "The 72 hour sweep also runs automatically every two minutes."
                  );
              }}
            >
              Sweep summons
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={sweepBail.pending}
              icon={<RefreshCw size={13} />}
              onClick={async () => {
                const outcome = await sweepBail.run(undefined as never);
                if (outcome)
                  toast.success(
                    outcome.flagged === 0 ? "No check-in overdue" : `${outcome.flagged} flagged`,
                    "Missed check-ins are now recorded on chain."
                  );
              }}
            >
              Sweep check-ins
            </Button>
          </>
        }
      />

      <AsyncView state={stats} onRetry={stats.refetch} context="the statistics">
        {(data) => (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Active participants" value={data.stats.activeUsers} icon={<UsersIcon size={14} />} />
            <Stat label="Cases" value={data.stats.cases} icon={<ClipboardList size={14} />} />
            <Stat
              label="Evidence items"
              value={data.stats.evidenceItems}
              hint={`${data.stats.flaggedEvidence} flagged at intake`}
              tone={data.stats.flaggedEvidence > 0 ? "warning" : "default"}
              icon={<Blocks size={14} />}
            />
            <Stat
              label="Active bail orders"
              value={data.stats.activeBailOrders}
              hint={`${data.stats.openViolations} open violations`}
              tone={data.stats.openViolations > 0 ? "danger" : "default"}
              icon={<Activity size={14} />}
            />
          </div>
        )}
      </AsyncView>

      <Card
        title="Subsystem health"
        subtitle="Every dependency reports whether it is configured and whether it actually answers."
      >
        <AsyncView state={health} onRetry={health.refetch} context="system health">
          {(data) => (
            <div className="space-y-3">
              <HealthRow
                icon={<Database size={16} />}
                name="Supabase Postgres"
                ok={data.subsystems.database.reachable}
                detail={
                  data.subsystems.database.reachable
                    ? "Reachable. Row level security is enabled on every table."
                    : "Unreachable. Check SUPABASE_URL and the service role key, and that the migrations have been run."
                }
              />

              <HealthRow
                icon={<Blocks size={16} />}
                name="Ethereum"
                ok={data.subsystems.blockchain.ready}
                detail={
                  data.subsystems.blockchain.ready
                    ? `${data.subsystems.blockchain.network?.name} (chain ${data.subsystems.blockchain.network?.chainId}) at block ${data.subsystems.blockchain.blockNumber}`
                    : data.subsystems.blockchain.reason
                }
              />

              <HealthRow
                icon={<HardDrive size={16} />}
                name="Evidence storage"
                ok={data.subsystems.storage.configured}
                warnOnly
                detail={data.subsystems.storage.note ?? data.subsystems.storage.backend}
              />

              <HealthRow
                icon={<Activity size={16} />}
                name="Model service"
                ok={data.subsystems.ai.reachable}
                warnOnly
                detail={
                  data.subsystems.ai.reachable
                    ? "Answering. Screening and risk scoring are live."
                    : (data.subsystems.ai.note ??
                      "Not reachable. Screening reports itself unavailable rather than claiming an item is clean.")
                }
              />

              <HealthRow
                icon={<KeyRound size={16} />}
                name="Identity provider"
                ok={data.subsystems.identity.authorisedForProduction}
                warnOnly
                detail={data.subsystems.identity.note ?? data.subsystems.identity.provider}
              />

              {data.subsystems.blockchain.ready && (
                <div className="mt-4 rounded-card border border-border bg-surface-2 p-4">
                  <p className="mb-3 flex items-center gap-2 font-ui text-xs font-semibold text-text">
                    <Wallet size={14} className="text-primary" />
                    Keeper wallet
                  </p>
                  <dl className="space-y-2">
                    <Row
                      label="Address"
                      value={
                        <code className="font-mono text-2xs">
                          {shortHash(data.subsystems.blockchain.keeper, 10, 8)}
                        </code>
                      }
                    />
                    <Row label="Balance" value={formatEth(data.subsystems.blockchain.keeperBalanceWei)} />
                  </dl>
                  {data.subsystems.blockchain.keeperBalanceWei === "0" && (
                    <p className="mt-2.5 font-ui text-2xs leading-relaxed text-danger">
                      The keeper has no ETH, so every citizen action it relays will fail. Fund it from a
                      Sepolia faucet.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </AsyncView>
      </Card>
    </>
  );
}

function HealthRow({
  icon,
  name,
  ok,
  detail,
  warnOnly,
}: {
  icon: React.ReactNode;
  name: string;
  ok: boolean;
  detail: string;
  /** A missing optional subsystem is a warning, not a failure. */
  warnOnly?: boolean;
}) {
  const tone = ok ? "border-success-soft bg-success-soft" : warnOnly ? "border-warning-soft bg-warning-soft" : "border-danger-soft bg-danger-soft";
  const iconTone = ok ? "text-success" : warnOnly ? "text-warning" : "text-danger";

  return (
    <div className={`flex gap-3 rounded-lg border p-3.5 ${tone}`}>
      <span className={`mt-0.5 shrink-0 ${iconTone}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-ui text-sm font-semibold text-text">{name}</p>
          {ok ? (
            <StatusChip tone="success" label="OK" icon={<CheckCircle2 size={10} />} />
          ) : (
            <StatusChip
              tone={warnOnly ? "warning" : "danger"}
              label={warnOnly ? "Degraded" : "Down"}
              icon={warnOnly ? <AlertTriangle size={10} /> : <Link2Off size={10} />}
            />
          )}
        </div>
        <p className="mt-1 font-ui text-2xs leading-relaxed text-muted">{detail}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-ui text-2xs uppercase tracking-wider text-faint">{label}</dt>
      <dd className="text-right font-ui text-xs font-medium text-text">{value}</dd>
    </div>
  );
}

/* ======================================================= AdminUsers ====== */

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  designation: string | null;
  station_or_court: string | null;
  is_active: boolean;
  last_login_at: string | null;
  aadhaarOnFile: boolean;
  aadhaarLast4: string | null;
}

export function AdminUsers() {
  const toast = useToast();
  const users = useQuery<{ users: UserRow[] }>("/api/admin/users?limit=200");
  const [createOpen, setCreateOpen] = useState(false);

  const toggle = useMutation(async (args: { id: string; isActive: boolean }) =>
    api.patch(`/api/admin/users/${args.id}`, { isActive: args.isActive })
  );

  return (
    <>
      <PageHeader
        eyebrow="Court registry"
        title="Participants"
        description="Every account on the platform. Deactivating one revokes its live sessions immediately."
        actions={
          <Button icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            Add participant
          </Button>
        }
      />

      <Card title="Accounts">
        <AsyncView
          state={users}
          onRetry={users.refetch}
          context="participants"
          isEmpty={(data) => data.users.length === 0}
          empty={
            <EmptyState
              title="No participants"
              description="Run the seed script, or add accounts here."
              icon={<UsersIcon size={19} />}
            />
          }
        >
          {(data) => (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {["Name", "Role", "Posting", "Aadhaar", "Last seen", "Status", ""].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-2.5 text-left font-ui text-2xs font-semibold uppercase tracking-wider text-faint"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-ui text-sm font-medium text-text">{row.full_name}</p>
                        <p className="font-ui text-2xs text-muted">{row.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-ui text-xs text-text">{ROLE_LABEL[row.role]}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-ui text-2xs text-muted">{row.station_or_court ?? "—"}</span>
                      </td>
                      <td className="px-5 py-3">
                        {row.aadhaarOnFile ? (
                          <span className="font-mono text-2xs text-muted">•••• {row.aadhaarLast4}</span>
                        ) : (
                          <StatusChip tone="warning" label="Missing" />
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-ui text-2xs text-muted">
                          {row.last_login_at ? relativeTime(row.last_login_at) : "never"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusChip
                          tone={row.is_active ? "success" : "neutral"}
                          label={row.is_active ? "Active" : "Disabled"}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const outcome = await toggle.run({ id: row.id, isActive: !row.is_active });
                            if (outcome) {
                              toast.success(
                                row.is_active ? "Account disabled" : "Account enabled",
                                row.is_active ? "Its live sessions have been revoked." : undefined
                              );
                              users.refetch();
                            }
                          }}
                        >
                          {row.is_active ? "Disable" : "Enable"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          users.refetch();
          setCreateOpen(false);
        }}
      />
    </>
  );
}

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "police" as Role,
    designation: "",
    stationOrCourt: "",
    aadhaarNumber: "",
    phone: "",
  });

  const create = useMutation(async () =>
    api.post("/api/admin/users", {
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      role: form.role,
      designation: form.designation.trim() || undefined,
      stationOrCourt: form.stationOrCourt.trim() || undefined,
      aadhaarNumber: form.aadhaarNumber.replace(/[^0-9]/g, "") || undefined,
      phone: form.phone.trim() || undefined,
    })
  );

  const valid =
    /\S+@\S+\.\S+/.test(form.email) && form.password.length >= 12 && form.fullName.trim().length >= 3;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a participant"
      description="An Aadhaar number entered here is converted to a one-way token and discarded. Only the token and the last four digits are kept."
      width="max-w-xl"
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
                toast.success("Participant added", `${form.fullName} can now sign in.`);
                onCreated();
              }
            }}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </Field>
          <Field label="Role" required>
            <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Email" required>
          <Input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>

        <Field label="Initial password" required hint="At least 12 characters. They can change it after signing in.">
          <Input
            type="text"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className="font-mono"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Designation">
            <Input
              value={form.designation}
              onChange={(event) => setForm({ ...form, designation: event.target.value })}
              placeholder="Inspector, Crime Branch"
            />
          </Field>
          <Field label="Station or court">
            <Input
              value={form.stationOrCourt}
              onChange={(event) => setForm({ ...form, stationOrCourt: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Aadhaar number"
            hint="Needed for OTP flows. Validated against its Verhoeff check digit."
          >
            <Input
              inputMode="numeric"
              maxLength={14}
              value={form.aadhaarNumber}
              onChange={(event) => setForm({ ...form, aadhaarNumber: event.target.value.replace(/[^0-9 ]/g, "") })}
              className="font-mono"
              placeholder="2233 4455 6676"
            />
          </Field>
          <Field label="Phone" hint="Encrypted at rest.">
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
        </div>

        {create.error && (
          <p role="alert" className="font-ui text-xs text-danger">
            {create.error.message}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ======================================================= AdminAudit ====== */

export function AdminAudit() {
  const [tab, setTab] = useState<"actions" | "rows">("actions");
  const actions = useQuery<{ entries: any[] }>("/api/admin/audit/actions?limit=100", [], {
    enabled: tab === "actions",
  });
  const rows = useQuery<{ entries: any[] }>("/api/admin/audit/rows?limit=100", [], {
    enabled: tab === "rows",
  });

  return (
    <>
      <PageHeader
        eyebrow="Court registry"
        title="Audit trail"
        description="Two layers. Actions record intent, including attempts that were refused and therefore changed no row. Row changes come from database triggers, so a direct edit is captured whatever made it."
      />

      <div className="mb-5 inline-flex rounded-full border border-border bg-surface-2 p-1">
        {(["actions", "rows"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-2 font-ui text-xs font-semibold transition ${
              tab === value ? "bg-primary text-on-primary" : "text-muted hover:text-text"
            }`}
          >
            {value === "actions" ? "API actions" : "Row changes"}
          </button>
        ))}
      </div>

      {tab === "actions" ? (
        <Card title="API actions" subtitle="What was attempted, by whom, and whether it succeeded.">
          <AsyncView
            state={actions}
            onRetry={actions.refetch}
            context="the action log"
            isEmpty={(data) => data.entries.length === 0}
            empty={<EmptyState title="Nothing logged yet" icon={<FileSearch size={19} />} />}
          >
            {(data) => (
              <ul className="space-y-2">
                {data.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className={`rounded-lg border p-3 ${
                      entry.outcome === "refused"
                        ? "border-warning-soft bg-warning-soft"
                        : entry.outcome === "failed"
                          ? "border-danger-soft bg-danger-soft"
                          : "border-border bg-surface-2"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="font-mono text-2xs font-semibold text-text">{entry.action}</code>
                      <div className="flex items-center gap-2">
                        {entry.actor_role && (
                          <span className="font-ui text-2xs text-muted">{ROLE_LABEL[entry.actor_role as Role]}</span>
                        )}
                        <StatusChip
                          tone={entry.outcome === "ok" ? "success" : entry.outcome === "refused" ? "warning" : "danger"}
                          label={entry.outcome}
                        />
                      </div>
                    </div>
                    <p className="mt-1 font-ui text-2xs text-faint">{formatDateTime(entry.occurred_at)}</p>
                    {entry.detail && (
                      <pre className="mt-1.5 overflow-x-auto rounded bg-surface px-2.5 py-2 font-mono text-2xs leading-relaxed text-muted">
                        {JSON.stringify(entry.detail, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AsyncView>
        </Card>
      ) : (
        <Card title="Row changes" subtitle="Captured by a trigger, so it fires whatever made the change.">
          <AsyncView
            state={rows}
            onRetry={rows.refetch}
            context="the row audit"
            isEmpty={(data) => data.entries.length === 0}
            empty={<EmptyState title="Nothing logged yet" icon={<FileSearch size={19} />} />}
          >
            {(data) => (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {["When", "Table", "Operation", "Actor", "Columns changed"].map((heading) => (
                        <th
                          key={heading}
                          className="px-5 py-2.5 text-left font-ui text-2xs font-semibold uppercase tracking-wider text-faint"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-2.5 font-ui text-2xs text-muted">
                          {formatDateTime(entry.occurred_at)}
                        </td>
                        <td className="px-5 py-2.5 font-mono text-2xs text-text">{entry.table_name}</td>
                        <td className="px-5 py-2.5">
                          <StatusChip
                            tone={entry.operation === "DELETE" ? "danger" : entry.operation === "INSERT" ? "success" : "info"}
                            label={entry.operation}
                          />
                        </td>
                        <td className="px-5 py-2.5 font-ui text-2xs text-muted">{entry.actor_role ?? "service"}</td>
                        <td className="px-5 py-2.5 font-mono text-2xs text-muted">
                          {(entry.changed_columns ?? []).join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AsyncView>
        </Card>
      )}
    </>
  );
}

/* ======================================================= AdminChain ====== */

export function AdminChain() {
  const chain = useQuery<{
    status: {
      ready: boolean;
      reason: string;
      network: { name: string; chainId: number } | null;
      keeper: string | null;
      keeperBalanceWei: string | null;
      blockNumber: number | null;
      addresses: Record<string, string | undefined> | null;
    };
    transactions: any[];
    events: any[];
    counts: { pending: number; failed: number };
  }>("/api/admin/chain", [], { pollMs: 20_000 });

  return (
    <>
      <PageHeader
        eyebrow="Court registry"
        title="Chain status"
        description="Deployed contracts, the keeper wallet, and every transaction this platform has submitted."
      />

      <AsyncView state={chain} onRetry={chain.refetch} context="chain status">
        {(data) => (
          <>
            {!data.status.ready && (
              <div role="alert" className="panel mb-6 border-danger-soft p-5">
                <div className="flex gap-3">
                  <Link2Off size={19} className="mt-0.5 shrink-0 text-danger" />
                  <div>
                    <p className="font-ui text-sm font-semibold text-text">The chain bridge is not ready</p>
                    <p className="mt-1 font-ui text-xs leading-relaxed text-muted">{data.status.reason}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Network"
                value={data.status.network?.name ?? "—"}
                hint={data.status.network ? `chain ${data.status.network.chainId}` : undefined}
                icon={<Blocks size={14} />}
              />
              <Stat label="Block" value={data.status.blockNumber ?? "—"} icon={<Activity size={14} />} />
              <Stat
                label="Keeper balance"
                value={formatEth(data.status.keeperBalanceWei)}
                tone={data.status.keeperBalanceWei === "0" ? "danger" : "default"}
                icon={<Wallet size={14} />}
              />
              <Stat
                label="Failed transactions"
                value={data.counts.failed}
                tone={data.counts.failed > 0 ? "danger" : "default"}
                hint={`${data.counts.pending} pending`}
                icon={<AlertTriangle size={14} />}
              />
            </div>

            {data.status.addresses && (
              <Card className="mb-5" title="Deployed contracts">
                <dl className="space-y-2.5">
                  {Object.entries(data.status.addresses).map(([name, address]) => (
                    <div key={name} className="flex flex-wrap items-baseline justify-between gap-2">
                      <dt className="font-ui text-xs font-semibold text-text">{name}</dt>
                      <dd>
                        <code className="font-mono text-2xs text-muted">{address ?? "—"}</code>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Recent transactions" subtitle="Everything this platform has submitted.">
                {data.transactions.length === 0 ? (
                  <EmptyState title="No transactions yet" icon={<Blocks size={19} />} />
                ) : (
                  <ul className="space-y-2">
                    {data.transactions.map((tx) => (
                      <li
                        key={tx.tx_hash}
                        className={`rounded-lg border p-3 ${
                          tx.status === "failed"
                            ? "border-danger-soft bg-danger-soft"
                            : tx.status === "pending"
                              ? "border-warning-soft bg-warning-soft"
                              : "border-border bg-surface-2"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <code className="font-mono text-2xs font-semibold text-text">
                            {tx.contract}.{tx.method}
                          </code>
                          <StatusChip
                            tone={tx.status === "confirmed" ? "success" : tx.status === "pending" ? "warning" : "danger"}
                            label={tx.status}
                          />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <TxLink txHash={tx.tx_hash} />
                          {tx.block_number && (
                            <span className="font-ui text-2xs text-faint">block {tx.block_number}</span>
                          )}
                          {tx.gas_used && (
                            <span className="font-ui text-2xs text-faint">{Number(tx.gas_used).toLocaleString()} gas</span>
                          )}
                          <span className="font-ui text-2xs text-faint">{relativeTime(tx.created_at)}</span>
                        </div>
                        {tx.error && (
                          <p className="mt-1.5 font-ui text-2xs leading-relaxed text-danger">{tx.error}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card
                title="Indexed events"
                subtitle="Materialised from the contracts. The chain stays authoritative; this is a read cache."
              >
                {data.events.length === 0 ? (
                  <EmptyState
                    title="No events indexed"
                    description="The indexer polls every few seconds once the chain bridge is ready."
                    icon={<Activity size={19} />}
                  />
                ) : (
                  <ul className="space-y-2">
                    {data.events.map((event, index) => (
                      <li key={`${event.tx_hash}-${index}`} className="rounded-lg border border-border bg-surface-2 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <code className="font-mono text-2xs font-semibold text-primary">{event.event_name}</code>
                          <span className="font-ui text-2xs text-faint">block {event.block_number}</span>
                        </div>
                        <p className="mt-0.5 font-ui text-2xs text-muted">{event.contract}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </AsyncView>
    </>
  );
}
