import { Request } from "express";
import { db, unwrap, unwrapList, unwrapMaybe } from "../lib/supabase";
import { AppError, conflict, notFound } from "../lib/errors";
import { sha256Hex } from "../lib/crypto";
import { recordAction } from "./audit";
import { loadDossier, redactForRole } from "./report.service";
import { canSeeFir } from "./case.service";
import { assessFinalReport, blocksApproval, summarise, type Finding, type ReportParticulars } from "./readiness.service";
import { buildFinalReport, type ReportStatus } from "../lib/pdf/finalReport";
import type { SessionUser, UserRole } from "../middleware/auth";

/**
 * Versions of a final report and their review (2.1). See migration 015 for the
 * states. The rules that matter:
 *   - a version is created with the readiness findings of that moment;
 *   - only the latest version can be approved, by a police officer, and only
 *     when nothing blocks approval on a fresh re-check;
 *   - approval freezes the PDF bytes and their SHA-256;
 *   - FILED is recorded by a person, against a court receipt, never inferred.
 */

export interface VersionRow {
  id: string;
  case_id: string;
  kind: "final_report";
  version: number;
  state: ReportStatus["state"];
  particulars: ReportParticulars;
  readiness: Finding[];
  content_sha256: string | null;
  pdf_base64: string | null;
  generated_at: string;
  supersedes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  exported_at: string | null;
  filed_reference: string | null;
  filed_on: string | null;
  filed_at: string | null;
}

/** What the API returns: never the stored PDF bytes. */
function present(row: VersionRow) {
  const { pdf_base64: _pdf, ...rest } = row;
  return { ...rest, summary: summarise(row.readiness ?? []) };
}

async function loadVersion(id: string): Promise<VersionRow> {
  const row = unwrapMaybe(await db.from("document_versions").select("*").eq("id", id).maybeSingle()) as VersionRow | null;
  if (!row) throw notFound("Document version");
  return row;
}

async function nameOf(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const row = unwrapMaybe(await db.from("user_directory").select("full_name, designation").eq("id", userId).maybeSingle()) as {
    full_name: string;
    designation: string | null;
  } | null;
  return row ? `${row.full_name}${row.designation ? `, ${row.designation}` : ""}` : null;
}

export async function listVersions(caseId: string) {
  const rows = unwrapList(
    await db.from("document_versions").select("*").eq("case_id", caseId).eq("kind", "final_report").order("version", { ascending: false })
  ) as VersionRow[];
  return rows.map(present);
}

/** Readiness of the case right now, against the latest version's particulars (or those given). */
export async function currentReadiness(caseId: string, particulars?: ReportParticulars) {
  let use = particulars;
  if (!use) {
    const { data } = await db.from("document_versions").select("particulars").eq("case_id", caseId).eq("kind", "final_report").order("version", { ascending: false }).limit(1);
    use = ((data ?? [])[0] as { particulars?: ReportParticulars } | undefined)?.particulars ?? {};
  }
  const findings = await assessFinalReport(await loadDossier(caseId), use);
  return { findings, summary: summarise(findings), particulars: use };
}

function clean(p: ReportParticulars): ReportParticulars {
  return {
    nature: p.nature ?? null,
    complainant: p.complainant?.trim() || null,
    narrative: p.narrative?.trim() || null,
    annexures: (p.annexures ?? []).map((a) => a.trim()).filter(Boolean).slice(0, 30),
  };
}

export async function createVersion(req: Request, user: SessionUser, caseId: string, input: ReportParticulars) {
  const particulars = clean(input);
  const findings = await assessFinalReport(await loadDossier(caseId), particulars);
  const { data: latest } = await db.from("document_versions").select("id, version").eq("case_id", caseId).eq("kind", "final_report").order("version", { ascending: false }).limit(1);
  const previous = (latest ?? [])[0] as { id: string; version: number } | undefined;

  const row = unwrap(
    await db
      .from("document_versions")
      .insert({
        case_id: caseId,
        kind: "final_report",
        version: (previous?.version ?? 0) + 1,
        state: blocksApproval(findings) ? "VALIDATION_REQUIRED" : "READY_FOR_REVIEW",
        particulars,
        readiness: findings,
        supersedes: previous?.id ?? null,
        created_by: user.id,
      })
      .select("*")
      .single()
  ) as VersionRow;
  await recordAction(req, { action: "report.version", subject: row.id, caseId, detail: { version: row.version, state: row.state } });
  return present(row);
}

export async function approveVersion(req: Request, user: SessionUser, versionId: string) {
  const row = await loadVersion(versionId);
  if (!["READY_FOR_REVIEW", "VALIDATION_REQUIRED"].includes(row.state)) throw conflict(`Version ${row.version} is ${row.state.toLowerCase().replace(/_/g, " ")}; it cannot be approved again.`);
  const { data: latest } = await db.from("document_versions").select("id").eq("case_id", row.case_id).eq("kind", "final_report").order("version", { ascending: false }).limit(1);
  if ((latest ?? [])[0]?.id !== row.id) throw conflict("A newer version exists. Only the latest version can be approved.");

  // Re-checked now, not trusted from when the version was created.
  const dossier = await loadDossier(row.case_id);
  const findings = await assessFinalReport(dossier, row.particulars);
  if (blocksApproval(findings)) {
    await db.from("document_versions").update({ state: "VALIDATION_REQUIRED", readiness: findings }).eq("id", row.id);
    await recordAction(req, { action: "report.approve", subject: row.id, caseId: row.case_id, outcome: "refused", detail: summarise(findings) });
    throw new AppError(409, "READINESS_BLOCKED", "This version cannot be approved: the readiness checks found blocking problems. Correct them and create a new version.", {
      findings,
    });
  }

  const approvedAt = new Date().toISOString();
  const approverName = await nameOf(user.id);
  const pdf = await buildFinalReport(dossier, {
    particulars: row.particulars,
    status: { state: "APPROVED", version: row.version, approvedBy: approverName, approvedAt },
  }).toBuffer();
  const digest = sha256Hex(pdf);

  const updated = unwrap(
    await db
      .from("document_versions")
      .update({
        state: "APPROVED",
        readiness: findings,
        approved_by: user.id,
        approved_at: approvedAt,
        content_sha256: digest,
        pdf_base64: pdf.toString("base64"),
      })
      .eq("id", row.id)
      .select("*")
      .single()
  ) as VersionRow;
  await recordAction(req, { action: "report.approve", subject: row.id, caseId: row.case_id, detail: { version: row.version, digest } });
  return present(updated);
}

/**
 * The PDF of a version. An approved version is served as the stored bytes, so
 * every export is identical and matches the recorded digest; the first export
 * moves it to EXPORTED. A reader who may not see the FIR number gets a redacted
 * rendering of the approved version instead, which names the approved digest.
 * A draft is rendered fresh, watermarked.
 */
export async function versionPdf(req: Request, role: UserRole, versionId: string) {
  const row = await loadVersion(versionId);
  const approved = ["APPROVED", "EXPORTED", "FILED"].includes(row.state);

  if (approved && row.pdf_base64 && canSeeFir(role)) {
    if (row.state === "APPROVED") {
      await db.from("document_versions").update({ state: "EXPORTED", exported_at: new Date().toISOString() }).eq("id", row.id).eq("state", "APPROVED");
    }
    await recordAction(req, { action: "report.export", subject: row.id, caseId: row.case_id, detail: { version: row.version, digest: row.content_sha256 } });
    return { pdf: Buffer.from(row.pdf_base64, "base64"), digest: row.content_sha256!, row };
  }

  const dossier = redactForRole(await loadDossier(row.case_id), role);
  const status: ReportStatus = approved
    ? { state: row.state, version: row.version, approvedBy: await nameOf(row.approved_by), approvedAt: row.approved_at, filedReference: row.filed_reference }
    : { state: row.state, version: row.version };
  const pdf = await buildFinalReport(dossier, { particulars: row.particulars, status }).toBuffer();
  return { pdf, digest: sha256Hex(pdf), row };
}

export async function markFiled(req: Request, user: SessionUser, versionId: string, input: { reference: string; filedOn: string }) {
  const row = await loadVersion(versionId);
  if (!["APPROVED", "EXPORTED"].includes(row.state)) throw conflict("Only an approved version can be recorded as filed.");
  const updated = unwrap(
    await db
      .from("document_versions")
      .update({ state: "FILED", filed_reference: input.reference.trim(), filed_on: input.filedOn, filed_by: user.id, filed_at: new Date().toISOString() })
      .eq("id", row.id)
      .select("*")
      .single()
  ) as VersionRow;
  await recordAction(req, { action: "report.filed", subject: row.id, caseId: row.case_id, detail: { version: row.version, reference: input.reference } });
  return present(updated);
}

export async function versionCase(versionId: string): Promise<string> {
  return (await loadVersion(versionId)).case_id;
}
