import { Link } from "react-router-dom";
import { AlertTriangle, FlaskConical, Inbox } from "lucide-react";
import type { EvidenceRow } from "../lib/api";
import { useQuery } from "../lib/useApi";
import { formatDateTime, relativeTime } from "../lib/format";
import { shortHash } from "../lib/hash";
import { AsyncView, EmptyState } from "../components/DataState";
import { Card, PageHeader, Stat } from "../components/ui";
import { IntegrityBadge, StageChip } from "../components/trust";

/**
 * The laboratory's intake queue.
 *
 * It lists items currently at the previous stage, which for the lab means items
 * still at SCENE. Accepting one is a hash confirmation, so the queue deliberately
 * shows the registered digest here: the analyst can compare it against what they
 * physically received before opening the item at all.
 */
export function ForensicInbox() {
  const inbox = useQuery<{ items: EvidenceRow[] }>("/api/evidence/inbox", [], { pollMs: 30_000 });

  const flagged = (inbox.data?.items ?? []).filter((item) => item.anomaly_flagged).length;

  return (
    <>
      <PageHeader
        eyebrow="SaakshyaSetu · laboratory"
        title="Intake queue"
        description="Items awaiting the laboratory's hash confirmation. Accepting custody means the digest you recomputed matches the one registered at the scene."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Awaiting intake" value={inbox.data?.items.length ?? "—"} icon={<Inbox size={14} />} />
        <Stat
          label="Flagged at collection"
          value={flagged}
          tone={flagged > 0 ? "warning" : "default"}
          icon={<AlertTriangle size={14} />}
        />
        <Stat label="Refreshes" value="every 30 s" icon={<FlaskConical size={14} />} />
      </div>

      <Card
        title="Waiting for you"
        subtitle="Open an item to compare digests and accept custody."
      >
        <AsyncView
          state={inbox}
          onRetry={inbox.refetch}
          context="the intake queue"
          isEmpty={(data) => data.items.length === 0}
          empty={
            <EmptyState
              title="Nothing waiting"
              description="Items appear here as soon as a police officer registers them at a scene on a case you are assigned to."
              icon={<Inbox size={19} />}
            />
          }
        >
          {(data) => (
            <ul className="space-y-3">
              {data.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/forensic/cases/evidence/${item.id}`}
                    className="block rounded-card border border-border bg-surface-2 p-4 transition hover:border-primary"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-ui text-sm font-semibold text-text">{item.file_name}</p>
                        <p className="mt-0.5 font-ui text-2xs text-muted">
                          {item.cases?.fir_number ?? "unknown case"} · collected{" "}
                          {formatDateTime(item.collected_at)} · {relativeTime(item.collected_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <StageChip stage={item.current_stage} />
                        <IntegrityBadge
                          anchored={item.chain_evidence_id !== null}
                          mismatchCount={item.mismatch_count}
                        />
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-2">
                      <p className="mb-1 font-ui text-2xs font-semibold uppercase tracking-wider text-faint">
                        Registered digest, to compare against what you received
                      </p>
                      <code className="hash block text-text">{item.file_hash}</code>
                    </div>

                    {item.anomaly_flagged && (
                      <div className="mt-2.5 flex gap-2 rounded-lg border border-warning-soft bg-warning-soft px-3 py-2">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning" />
                        <div>
                          <p className="font-ui text-2xs font-semibold text-text">Flagged at intake</p>
                          <ul className="mt-1 space-y-0.5">
                            {item.anomaly_reasons.slice(0, 2).map((reason, index) => (
                              <li key={index} className="font-ui text-2xs leading-relaxed text-muted">
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AsyncView>
      </Card>
    </>
  );
}
