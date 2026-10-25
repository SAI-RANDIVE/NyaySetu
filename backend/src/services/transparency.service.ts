import { db } from "../lib/supabase";
import { chain, explorerUrl } from "../lib/chain";

/**
 * Public transparency figures: counts only. No names, case references, file
 * names, locations or evidence references are returned — nothing that is not
 * already deducible from the public ledger itself. Cached for a minute so the
 * public page cannot be used to load the database.
 */

export interface TransparencyStats {
  generatedAt: string;
  evidence: { registered: number; confirmedOnChain: number; pending: number; mismatchRecorded: number };
  verification: { checks: number; matched: number; refused: number };
  custody: { transfers: number; malkhanaMovements: number; seizureMemos: number; labIntakes: number; forensicReports: number };
  court: { summonsIssued: number; summonsAcknowledged: number; certificates: number };
  /** Measured from confirmed transactions, so the cost of a record is evidence, not an estimate. */
  cost: { measuredTransactions: number; averageGas: number | null; byMethod: { method: string; transactions: number; averageGas: number }[] };
  ledger: {
    network: string | null;
    chainId: number | null;
    contracts: { name: string; address: string; explorer: string | null }[];
    recent: { at: string; purpose: string; txHash: string; explorer: string | null }[];
  };
}

const PURPOSE_LABEL: Record<string, string> = {
  evidence_registration: "Evidence registered",
  custody_transfer: "Custody transferred",
  integrity_check: "Integrity checked",
  forensic_report: "Forensic report anchored",
  document: "Document anchored",
};

let cached: { at: number; value: TransparencyStats } | null = null;

async function count(table: string, filter?: (q: any) => any): Promise<number> {
  let query: any = db.from(table).select("id", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count: n, error } = await query;
  return error ? 0 : (n ?? 0);
}

export async function transparencyStats(): Promise<TransparencyStats> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;

  const [
    registered,
    confirmed,
    pending,
    mismatch,
    checks,
    matched,
    transfers,
    movements,
    seizures,
    intakes,
    reports,
    summons,
    acknowledged,
    certificates,
  ] = await Promise.all([
    count("evidence_items"),
    count("anchors", (q) => q.eq("purpose", "evidence_registration").eq("state", "CONFIRMED")),
    count("anchors", (q) => q.eq("purpose", "evidence_registration").in("state", ["LOCAL_ONLY", "SUBMITTED", "SYNC_ERROR", "REVIEW_REQUIRED"])),
    count("anchors", (q) => q.eq("state", "INTEGRITY_MISMATCH")),
    count("integrity_checks"),
    count("integrity_checks", (q) => q.eq("matched", true)),
    count("custody_events"),
    count("malkhana_movements"),
    count("seizures"),
    count("lab_intakes"),
    count("forensic_reports"),
    count("summons"),
    count("summons", (q) => q.eq("status", "DELIVERED")),
    count("certificates"),
  ]);

  const { data: recentRows } = await db
    .from("anchors")
    .select("purpose, tx_hash, confirmed_at, submitted_at")
    .eq("state", "CONFIRMED")
    .not("tx_hash", "is", null)
    .order("confirmed_at", { ascending: false })
    .limit(8);

  const { data: gasRows } = await db
    .from("chain_tx")
    .select("method, gas_used")
    .eq("status", "confirmed")
    .not("gas_used", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  const measured = ((gasRows ?? []) as { method: string; gas_used: number | string }[])
    .map((r) => ({ method: r.method, gas: Number(r.gas_used) }))
    .filter((r) => Number.isFinite(r.gas) && r.gas > 0);
  const groups = new Map<string, number[]>();
  for (const r of measured) groups.set(r.method, [...(groups.get(r.method) ?? []), r.gas]);
  const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

  const addresses = chain.isReady ? (chain.addresses as Record<string, string | undefined>) : {};
  const value: TransparencyStats = {
    generatedAt: new Date().toISOString(),
    evidence: { registered, confirmedOnChain: confirmed, pending, mismatchRecorded: mismatch },
    verification: { checks, matched, refused: Math.max(0, checks - matched) },
    custody: { transfers, malkhanaMovements: movements, seizureMemos: seizures, labIntakes: intakes, forensicReports: reports },
    court: { summonsIssued: summons, summonsAcknowledged: acknowledged, certificates },
    cost: {
      measuredTransactions: measured.length,
      averageGas: measured.length ? mean(measured.map((r) => r.gas)) : null,
      byMethod: [...groups.entries()]
        .map(([method, xs]) => ({ method, transactions: xs.length, averageGas: mean(xs) }))
        .sort((a, b) => b.transactions - a.transactions)
        .slice(0, 6),
    },
    ledger: {
      network: chain.isReady ? chain.network?.name ?? null : null,
      chainId: chain.isReady ? Number(chain.network?.chainId ?? 0) || null : null,
      contracts: Object.entries(addresses)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(([name, address]) => ({ name, address, explorer: explorerUrl(address)?.replace("/tx/", "/address/") ?? null })),
      recent: ((recentRows ?? []) as { purpose: string; tx_hash: string; confirmed_at: string | null; submitted_at: string | null }[]).map((r) => ({
        at: r.confirmed_at ?? r.submitted_at ?? "",
        purpose: PURPOSE_LABEL[r.purpose] ?? "Record anchored",
        txHash: r.tx_hash,
        explorer: explorerUrl(r.tx_hash),
      })),
    },
  };
  cached = { at: Date.now(), value };
  return value;
}

/** For tests. */
export function resetTransparencyCache() {
  cached = null;
}
