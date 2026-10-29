import { db } from "../lib/supabase";
import { chainReader } from "./verification/reader";
import { digestsEqual } from "../shared/integrity";
import type { CaseDossier } from "./report.service";

/**
 * The Document Readiness Engine (2.1).
 *
 * Before a legal document can be approved, every fact it relies on is checked
 * and the result is stated plainly: PASS, WARNING, BLOCKING or NOT_VERIFIED.
 * Approval is refused while anything is BLOCKING — and a NOT_VERIFIED ledger
 * check counts as blocking for approval, because "the chain could not be read"
 * is not the same as "the chain agrees".
 *
 * Passing every check means the record is consistent and complete enough for
 * a person to review. It never means the document is legally valid; signature
 * and endorsement stay with the officer, and the readiness report says so.
 */

export type ReadinessLevel = "PASS" | "WARNING" | "BLOCKING" | "NOT_VERIFIED";

export interface Finding {
  code: string;
  level: ReadinessLevel;
  area: "case" | "people" | "narrative" | "evidence" | "ledger" | "custody" | "signature" | "disclosure";
  message: string;
}

/** Officer-entered particulars a final report needs and the record does not hold. */
export interface ReportParticulars {
  nature?: "charge_sheet" | "closure_report" | "untraced_report" | null;
  complainant?: string | null;
  narrative?: string | null;
  annexures?: string[] | null;
}

const ORDER = ["SCENE", "FORENSIC_LAB", "PROSECUTOR", "COURT"];
const MAX_LEDGER_CHECKS = 25;

export function blocksApproval(findings: Finding[]): boolean {
  return findings.some((f) => f.level === "BLOCKING" || (f.level === "NOT_VERIFIED" && f.area === "ledger"));
}

export function summarise(findings: Finding[]) {
  const count = (level: ReadinessLevel) => findings.filter((f) => f.level === level).length;
  return { pass: count("PASS"), warning: count("WARNING"), blocking: count("BLOCKING"), notVerified: count("NOT_VERIFIED"), canApprove: !blocksApproval(findings) };
}

export async function assessFinalReport(dossier: CaseDossier, particulars: ReportParticulars = {}): Promise<Finding[]> {
  const f: Finding[] = [];
  const c = dossier.case;
  const add = (code: string, level: ReadinessLevel, area: Finding["area"], message: string) => f.push({ code, level, area, message });

  /* -------------------------------------------------------------- case */
  add("CASE_PARTICULARS", c.police_station && c.case_reference ? "PASS" : "BLOCKING", "case",
    c.police_station && c.case_reference ? "Police station and case reference are recorded." : "The police station or case reference is missing.");
  add("FIR_LINKED", c.fir_linked ? "PASS" : "BLOCKING", "case",
    c.fir_linked ? "An FIR / C.R. number is linked to the case." : "No FIR / C.R. number is linked. A final report under BNSS §193 refers to a registered case.");
  if (c.sections.length === 0) add("SECTIONS", "BLOCKING", "case", "No offence sections are recorded.");
  else {
    const unknown = dossier.statute.references.filter((r) => !r.recognised);
    add("SECTIONS", unknown.length ? "WARNING" : "PASS", "case",
      unknown.length ? `${unknown.length} section(s) are not sections of the Bharatiya Nyaya Sanhita and need checking: ${unknown.map((u) => u.canonical).join(", ")}.` : `${c.sections.length} offence section(s) recorded and recognised.`);
  }
  add("COURT", c.court_name ? "PASS" : "BLOCKING", "case", c.court_name ? `Court: ${c.court_name}.` : "No court is assigned to the case.");

  /* ------------------------------------------------------------ people */
  add("INVESTIGATING_OFFICER", dossier.registeredBy ? "PASS" : "BLOCKING", "people",
    dossier.registeredBy ? `Investigating officer: ${dossier.registeredBy.full_name}.` : "No investigating officer is recorded.");
  add("COMPLAINANT", particulars.complainant?.trim() ? "PASS" : "BLOCKING", "people",
    particulars.complainant?.trim() ? "Complainant / informant particulars entered by the officer." : "Complainant / informant particulars are not entered. NyaySetu does not hold them; enter them from the station records.");
  const accused = dossier.bail ? 1 : dossier.participants.filter((p) => p.role === "accused").length;
  add("ACCUSED", accused ? "PASS" : particulars.nature === "untraced_report" ? "PASS" : "WARNING", "people",
    accused ? "Accused person(s) recorded against the case." : "No accused person is recorded. Correct for an untraced report; otherwise add the accused before filing.");

  /* --------------------------------------------------------- narrative */
  add("NATURE", particulars.nature ? "PASS" : "BLOCKING", "narrative",
    particulars.nature ? `Nature of report: ${particulars.nature.replace("_", " ")}.` : "The nature of the report (charge sheet, closure report, untraced report) is not chosen.");
  const narrative = (particulars.narrative ?? "").trim();
  add("NARRATIVE", narrative.length >= 80 ? "PASS" : "BLOCKING", "narrative",
    narrative.length >= 80 ? "A brief of the investigation is entered." : "A brief of the facts and the investigation (at least a paragraph) is not entered.");
  add("ANNEXURES", (particulars.annexures ?? []).filter(Boolean).length ? "PASS" : "WARNING", "narrative",
    (particulars.annexures ?? []).filter(Boolean).length ? `${particulars.annexures!.filter(Boolean).length} annexure(s) listed.` : "No annexures are listed (statements, reports, memos).");

  /* ---------------------------------------------------------- evidence */
  const ids = dossier.evidence.map((e) => e.id);
  if (ids.length === 0) {
    add("EVIDENCE", "WARNING", "evidence", "No evidence is registered against the case.");
  } else {
    const { data } = await db
      .from("evidence_items")
      .select("id, public_ref, chain_evidence_id, anchored_digest, anchor_id, collected_at, mismatch_count")
      .in("id", ids);
    const items = (data ?? []) as { id: string; public_ref: string; chain_evidence_id: number | null; anchored_digest: string | null; anchor_id: string | null; collected_at: string; mismatch_count: number }[];
    const anchorIds = items.map((i) => i.anchor_id).filter(Boolean) as string[];
    const anchors = anchorIds.length ? (((await db.from("anchors").select("id, state").in("id", anchorIds)).data ?? []) as { id: string; state: string }[]) : [];
    const stateOf = new Map(anchors.map((a) => [a.id, a.state]));

    const unconfirmed = items.filter((i) => stateOf.get(i.anchor_id ?? "") !== "CONFIRMED");
    add("EVIDENCE_CONFIRMED", unconfirmed.length ? "WARNING" : "PASS", "evidence",
      unconfirmed.length ? `${unconfirmed.length} of ${items.length} item(s) are not confirmed on the ledger: ${unconfirmed.slice(0, 5).map((i) => i.public_ref).join(", ")}.` : `All ${items.length} item(s) are confirmed on the ledger.`);
    const mismatched = items.filter((i) => (i.mismatch_count ?? 0) > 0);
    add("INTEGRITY_MISMATCHES", mismatched.length ? "WARNING" : "PASS", "evidence",
      mismatched.length ? `${mismatched.length} item(s) have a recorded integrity mismatch; the report must explain each: ${mismatched.map((i) => i.public_ref).join(", ")}.` : "No integrity mismatch is recorded.");
    const { data: badSeals } = await db.from("seal_checks").select("evidence_id").in("evidence_id", ids).eq("matched", false);
    if (badSeals?.length) add("SEAL_MISMATCHES", "WARNING", "evidence", `${badSeals.length} seal reading(s) did not match the bound serial; the report must explain each.`);

    /* ---------------------------------------------------------- ledger */
    const reader = chainReader();
    const onChain = items.filter((i) => i.chain_evidence_id !== null && i.anchored_digest).slice(0, MAX_LEDGER_CHECKS);
    if (!onChain.length) {
      add("LEDGER_CONSISTENCY", "NOT_VERIFIED", "ledger", "No item has a ledger record to compare with.");
    } else if (!reader.ready()) {
      add("LEDGER_CONSISTENCY", "NOT_VERIFIED", "ledger", "The ledger cannot be read right now, so the record was not compared with it. Approval waits until it can be.");
    } else {
      let agree = 0;
      const disagree: string[] = [];
      let unreadable = 0;
      for (const item of onChain) {
        try {
          const chainDigest = (await reader.evidence(Number(item.chain_evidence_id))).fileHash;
          if (digestsEqual(chainDigest, item.anchored_digest!)) agree++;
          else disagree.push(item.public_ref);
        } catch {
          unreadable++;
        }
      }
      if (disagree.length) add("LEDGER_CONSISTENCY", "BLOCKING", "ledger", `The record and the ledger disagree for ${disagree.join(", ")}. Resolve before approval.`);
      else if (unreadable) add("LEDGER_CONSISTENCY", "NOT_VERIFIED", "ledger", `${unreadable} item(s) could not be read from the ledger; ${agree} agree.`);
      else add("LEDGER_CONSISTENCY", "PASS", "ledger", `All ${agree} anchored digest(s) were read from the ledger and agree with the record.`);
    }

    /* --------------------------------------------------------- custody */
    const problems: string[] = [];
    for (const item of items) {
      const events = dossier.custody[item.id] ?? [];
      let last = item.collected_at;
      let stage = "SCENE";
      for (const e of events) {
        if (e.occurred_at < last) problems.push(`${item.public_ref}: an event at ${e.occurred_at} precedes the one before it`);
        if (e.from_stage && e.from_stage !== stage) problems.push(`${item.public_ref}: custody moves from ${e.from_stage} while the item was at ${stage}`);
        if (ORDER.indexOf(e.to_stage) < ORDER.indexOf(e.from_stage ?? "SCENE")) problems.push(`${item.public_ref}: custody moves backwards to ${e.to_stage}`);
        last = e.occurred_at;
        stage = e.to_stage;
      }
    }
    add("CUSTODY_CHRONOLOGY", problems.length ? "BLOCKING" : "PASS", "custody",
      problems.length ? `Custody chronology is inconsistent: ${problems.slice(0, 4).join("; ")}.` : "Custody events for every item are in order and follow the permitted stages.");
  }

  /* -------------------------------------------- signature, disclosure */
  add("SIGNATURE", "NOT_VERIFIED", "signature", "The officer in charge must sign and endorse the printed report. NyaySetu does not sign documents.");
  add("DISCLOSURE", "PASS", "disclosure", "The final report is available only to people assigned to the case; the FIR number is withheld from roles that may not see it.");
  return f;
}
