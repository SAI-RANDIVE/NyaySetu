import { Request } from "express";
import { db, unwrap, unwrapMaybe } from "../lib/supabase";
import { badRequest, conflict } from "../lib/errors";
import { sha256Hex } from "../lib/crypto";
import { recordAction } from "./audit";
import { raiseAlert } from "./alerts.service";
import { anchorDocument } from "./verification/documentAnchor";
import { loadEvidence } from "./evidence.service";
import type { SessionUser } from "../middleware/auth";

/**
 * Physical exhibits (2.1).
 *
 * A fingerprint proves a file is unchanged; a blood sample or a weapon is not a
 * file. What travels with a physical exhibit is a tamper-evident seal with a
 * printed serial. The serial is bound to the exhibit when it is sealed, and its
 * salted digest is anchored on chain. Every receiving party then reads the
 * serial it actually sees; a different serial — which a substituted packet must
 * carry — is refused, anchored and alerted, exactly as a file mismatch is.
 *
 * The serial stays off chain. The chain holds a digest salted with the internal
 * evidence id, so the ledger reveals nothing about the seal to anyone else.
 */

export type SealContext = "lab_intake" | "custody_transfer" | "court_production" | "malkhana";

/** Serials are compared as printed, ignoring case, spaces and dashes. */
export function normaliseSerial(serial: string): string {
  return serial.normalize("NFKC").toUpperCase().replace(/[\s\-_/.]+/g, "");
}

export function sealDigest(evidenceId: string, serial: string): string {
  return sha256Hex(`nyaysetu-seal|${evidenceId}|${normaliseSerial(serial)}`);
}

/**
 * True when the error means migration 014 has not been run. Reading a seal must
 * then behave as "no seal", so laboratory intake keeps working on a database
 * that has not been upgraded; only binding a seal asks for the migration.
 */
function schemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["42P01", "PGRST205"].includes(String(error.code)) || /exhibit_seals|seal_checks/.test(String(error.message)) && /does not exist|Could not find/i.test(String(error.message));
}

export async function sealFor(evidenceId: string) {
  const result = await db.from("exhibit_seals").select("*").eq("evidence_id", evidenceId).maybeSingle();
  if (schemaMissing(result.error)) return null;
  return unwrapMaybe(result) as {
    id: string;
    evidence_id: string;
    case_id: string;
    serial: string;
    seal_digest: string;
    anchor_id: string | null;
    description: string | null;
    sealed_by: string | null;
    sealed_at: string;
  } | null;
}

export async function sealChecksFor(evidenceId: string) {
  const { data, error } = await db.from("seal_checks").select("*").eq("evidence_id", evidenceId).order("checked_at", { ascending: true });
  if (error && !schemaMissing(error)) throw badRequest(error.message);
  return (data ?? []) as any[];
}

/** Binds the seal serial to an exhibit. Once only: a seal cannot be quietly re-bound. */
export async function bindSeal(req: Request, user: SessionUser, evidenceId: string, input: { serial: string; description?: string | null }) {
  const item = await loadEvidence(evidenceId);
  const serial = normaliseSerial(input.serial);
  if (serial.length < 3) throw badRequest("Enter the serial printed on the seal, at least three characters.");
  if (item.current_stage !== "SCENE") {
    throw conflict("A seal is bound while the exhibit is still with the seizing officer, before its first hand-over.");
  }
  if (await sealFor(item.id)) throw conflict("This exhibit already has a seal bound to it. A later reading is recorded as a seal check, never as a new seal.");

  const digest = sealDigest(item.id, serial);
  const row = unwrap(
    await db
      .from("exhibit_seals")
      .insert({
        evidence_id: item.id,
        case_id: item.case_id,
        serial,
        seal_digest: digest,
        description: input.description?.trim() || null,
        sealed_by: user.id,
      })
      .select("*")
      .single()
  ) as any;

  const { anchor, error } = await anchorDocument({
    caseId: item.case_id,
    digest,
    subjectType: "exhibit_seal",
    subjectId: row.id,
    parentAnchorId: item.anchor_id ?? null,
    idempotencyKey: `seal:${item.id}`,
    actor: { id: user.id, role: user.role },
  });
  await db.from("exhibit_seals").update({ anchor_id: anchor.id }).eq("id", row.id);

  await recordAction(req, { action: "evidence.seal", subject: item.id, caseId: item.case_id, detail: { anchorState: anchor.state, error } });
  return { seal: { ...row, anchor_id: anchor.id }, anchorState: anchor.state };
}

/**
 * Records a receiving party's reading of the seal. A mismatch is anchored as
 * its own record and raises a serious alert; the caller decides whether the
 * hand-over it belongs to is refused.
 */
export async function checkSeal(
  req: Request,
  user: SessionUser,
  item: { id: string; case_id: string; public_ref: string; anchor_id?: string | null },
  observed: string,
  context: SealContext
): Promise<{ bound: boolean; matched: boolean | null }> {
  const seal = await sealFor(item.id);
  if (!seal) return { bound: false, matched: null };
  const serial = normaliseSerial(observed ?? "");
  if (serial.length < 3) throw badRequest("This exhibit was sealed. Enter the serial printed on the seal you received.");

  const digest = sealDigest(item.id, serial);
  const matched = digest === seal.seal_digest;
  const check = unwrap(
    await db
      .from("seal_checks")
      .insert({
        evidence_id: item.id,
        case_id: item.case_id,
        context,
        observed_serial: serial,
        observed_digest: digest,
        matched,
        checked_by: user.id,
        checked_by_role: user.role,
      })
      .select("*")
      .single()
  ) as any;

  if (!matched) {
    // The wrong serial is itself evidence: it goes on chain, so nobody can later
    // say the packet that arrived was the one that was sealed.
    const { anchor } = await anchorDocument({
      caseId: item.case_id,
      digest,
      subjectType: "seal_check",
      subjectId: check.id,
      parentAnchorId: seal.anchor_id,
      idempotencyKey: `seal-check:${check.id}`,
      actor: { id: user.id, role: user.role },
    });
    await db.from("seal_checks").update({ anchor_id: anchor.id }).eq("id", check.id);
    await raiseAlert({
      caseId: item.case_id,
      evidenceId: item.id,
      kind: "SEAL_MISMATCH",
      severity: "serious",
      explanation: `The seal on ${item.public_ref} received at ${context.replace("_", " ")} does not carry the serial bound when it was sealed. The packet may have been substituted. The reading is recorded on chain.`,
      dedupeKey: `seal-check:${check.id}`,
    });
  }
  await recordAction(req, { action: "evidence.seal_check", subject: item.id, caseId: item.case_id, outcome: matched ? "ok" : "refused", detail: { context } });
  return { bound: true, matched };
}
