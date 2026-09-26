import { Request } from "express";
import { db, unwrap, unwrapList, unwrapMaybe } from "../lib/supabase";
import { sha256Hex, keccakOfString } from "../lib/crypto";
import { storeEncrypted, loadDecrypted } from "../lib/storage";
import { submit, read, eventArgs, toMicroDegrees, fromMicroDegrees, explorerUrl, chain } from "../lib/chain";
import { badRequest, conflict, notFound, AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import { screenEvidence, recordPrediction } from "../lib/ai";
import { recordAction } from "./audit";
import { SessionUser } from "../middleware/auth";

/**
 * SaakshyaSetu service layer.
 *
 * The single most important ordering decision in the project lives here:
 * the digest is produced on the officer's device, and everything downstream is
 * checked against it. The server recomputes the digest over the bytes it
 * received and refuses the upload if the two disagree, so neither a lying
 * client nor a corrupted transfer can register a hash that does not describe
 * the stored file.
 */

export const STAGES = ["SCENE", "FORENSIC_LAB", "PROSECUTOR", "COURT"] as const;
export type Stage = (typeof STAGES)[number];

const NEXT_STAGE: Record<Stage, Stage | null> = {
  SCENE: "FORENSIC_LAB",
  FORENSIC_LAB: "PROSECUTOR",
  PROSECUTOR: "COURT",
  COURT: null,
};

/** Which role is entitled to receive custody at each stage. */
const STAGE_ROLE: Record<Stage, string> = {
  SCENE: "police",
  FORENSIC_LAB: "forensic_lab",
  PROSECUTOR: "prosecutor",
  COURT: "judge",
};

/** keccak256 of the stage label, matching EvidenceChain's STAGE_* constants. */
function stageTag(stage: Stage): string {
  return keccakOfString(stage);
}

export interface RegisterInput {
  caseId: string;
  clientHash: string;
  fileName: string;
  mimeType: string;
  kind: "photo" | "video" | "document" | "audio" | "physical";
  buffer: Buffer;
  gpsLat: number;
  gpsLng: number;
  collectedAt: string;
  deviceReportedMtime?: string | null;
  notes?: string | null;
}

export async function registerEvidence(req: Request, user: SessionUser, input: RegisterInput) {
  const caseRow = unwrapMaybe(
    await db
      .from("cases")
      .select("id, fir_number, case_id_hash, police_station")
      .eq("id", input.caseId)
      .maybeSingle()
  ) as { id: string; fir_number: string; case_id_hash: string; police_station: string } | null;

  if (!caseRow) throw notFound("Case");
  if (!user.aadhaarToken) {
    throw badRequest("Your account has no Aadhaar token on file. Ask the court admin to complete it.");
  }

  // 1 -- Confirm the client's digest describes the bytes we actually received.
  const serverHash = sha256Hex(input.buffer);
  if (serverHash !== input.clientHash) {
    await recordAction(req, {
      action: "evidence.register",
      caseId: caseRow.id,
      outcome: "refused",
      detail: { reason: "client_hash_mismatch", clientHash: input.clientHash, serverHash },
    });
    throw conflict(
      "The digest computed on your device does not match the file that arrived. " +
        "The upload was refused rather than registering a hash that does not describe the file.",
      { clientHash: input.clientHash, serverHash }
    );
  }

  // 2 -- Anomaly screening, before anything is anchored.
  const uploadDelaySeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(input.collectedAt).getTime()) / 1000)
  );
  const screening = await screenEvidence({
    fileSizeBytes: input.buffer.length,
    mimeType: input.mimeType,
    claimedCollectedAt: input.collectedAt,
    deviceReportedMtime: input.deviceReportedMtime ?? null,
    gpsLat: input.gpsLat,
    gpsLng: input.gpsLng,
    uploadDelaySeconds,
  });

  // 3 -- Encrypt and pin. Only ciphertext leaves the process.
  const blob = await storeEncrypted(input.buffer, serverHash.slice(2, 18));

  // 4 -- Persist off-chain first, so a chain failure leaves a visible unanchored
  //      row rather than a lost file.
  const row = unwrap(
    await db
      .from("evidence_items")
      .insert({
        case_id: caseRow.id,
        file_hash: serverHash,
        file_name: input.fileName,
        mime_type: input.mimeType,
        size_bytes: input.buffer.length,
        kind: input.kind,
        ipfs_cid: blob.cid,
        encryption_iv: blob.iv,
        encryption_tag: blob.tag,
        encryption_key_id: blob.keyId,
        gps_lat: input.gpsLat,
        gps_lng: input.gpsLng,
        collected_at: input.collectedAt,
        device_reported_mtime: input.deviceReportedMtime ?? null,
        current_stage: "SCENE",
        officer_id: user.id,
        officer_aadhaar_token: user.aadhaarToken,
        anomaly_score: screening.available ? screening.score : null,
        anomaly_flagged: screening.anomaly,
        anomaly_reasons: screening.reasons,
        notes: input.notes ?? null,
      })
      .select("*")
      .single()
  ) as any;

  // 5 -- Anchor on chain.
  const result = await submit(
    "EvidenceChain",
    "registerEvidence",
    [
      caseRow.case_id_hash,
      serverHash,
      toMicroDegrees(input.gpsLat, "latitude"),
      toMicroDegrees(input.gpsLng, "longitude"),
      user.aadhaarToken,
    ],
    { submittedBy: user.id, payload: { evidenceRowId: row.id, fir: caseRow.fir_number } }
  );

  const args = eventArgs(result.receipt, "EvidenceChain", "EvidenceRegistered");
  const chainEvidenceId = args?.evidenceId ? Number(args.evidenceId) : null;

  await db
    .from("evidence_items")
    .update({ chain_evidence_id: chainEvidenceId, registration_tx_hash: result.txHash })
    .eq("id", row.id);

  // 6 -- Anchor the AI verdict. Write-once on chain, so a flag raised now can
  //      never be quietly removed later.
  let anomalyFlagHash: string | null = null;
  if (screening.available && chainEvidenceId !== null) {
    anomalyFlagHash = await recordPrediction({
      model: "evidence_anomaly",
      modelVersion: screening.modelVersion,
      subjectType: "evidence_item",
      subjectId: row.id,
      caseId: caseRow.id,
      input: {
        fileSizeBytes: input.buffer.length,
        mimeType: input.mimeType,
        claimedCollectedAt: input.collectedAt,
        deviceReportedMtime: input.deviceReportedMtime ?? null,
        gpsLat: input.gpsLat,
        gpsLng: input.gpsLng,
        uploadDelaySeconds,
      },
      output: { anomaly: screening.anomaly, score: screening.score, reasons: screening.reasons },
    });

    try {
      await submit("EvidenceChain", "anchorAnomalyFlag", [chainEvidenceId, anomalyFlagHash], {
        submittedBy: user.id,
        payload: { evidenceRowId: row.id },
      });
      await db
        .from("evidence_items")
        .update({ anomaly_flag_hash: anomalyFlagHash })
        .eq("id", row.id);
    } catch (error) {
      // Not fatal: the evidence is registered. Log loudly, because an
      // un-anchored verdict is weaker than an anchored one.
      logger.warn("Could not anchor the anomaly verdict", {
        evidenceId: row.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  // 7 -- Mirror the genesis custody record.
  await db.from("custody_events").insert({
    evidence_id: row.id,
    from_stage: null,
    to_stage: "SCENE",
    confirmed_hash: serverHash,
    actor_id: user.id,
    actor_role: user.role,
    occurred_at: new Date().toISOString(),
    tx_hash: result.txHash,
    block_number: result.blockNumber,
  });

  await recordAction(req, {
    action: "evidence.register",
    subject: row.id,
    caseId: caseRow.id,
    detail: {
      chainEvidenceId,
      txHash: result.txHash,
      anomalyFlagged: screening.anomaly,
      ipfsBackend: blob.backend,
    },
  });

  return {
    evidence: { ...row, chain_evidence_id: chainEvidenceId, registration_tx_hash: result.txHash },
    screening,
    anomalyFlagHash,
    chain: {
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      explorer: explorerUrl(result.txHash),
      chainEvidenceId,
    },
  };
}

/**
 * Anchors an integrity check and, if it passes, moves custody on.
 *
 * The check is anchored either way. That is the point of
 * reportIntegrityCheck(): a refused transfer leaves a permanent on-chain record
 * of the mismatch, so "we tried to submit an altered file and were stopped" is
 * provable rather than merely asserted.
 */
export async function transferCustody(
  req: Request,
  user: SessionUser,
  evidenceId: string,
  submittedHash: string
) {
  const item = await loadEvidence(evidenceId);
  const fromStage = item.current_stage as Stage;
  const toStage = NEXT_STAGE[fromStage];

  if (!toStage) throw conflict("This item has already reached the court. Custody cannot move further.");
  if (STAGE_ROLE[toStage] !== user.role) {
    throw conflict(
      `Custody at ${toStage} is received by ${STAGE_ROLE[toStage]}. You are signed in as ${user.role}.`
    );
  }
  if (item.chain_evidence_id === null) {
    throw conflict("This item is not anchored on chain yet. Re-anchor it before transferring custody.");
  }

  const matched = submittedHash === item.file_hash;

  // Anchor the check first, whatever the outcome.
  const checkResult = await submit(
    "EvidenceChain",
    "reportIntegrityCheck",
    [item.chain_evidence_id, submittedHash],
    { submittedBy: user.id, payload: { evidenceRowId: item.id, matched } }
  );

  await db.from("integrity_checks").insert({
    evidence_id: item.id,
    submitted_hash: submittedHash,
    expected_hash: item.file_hash,
    matched,
    checked_by: user.id,
    checked_by_role: user.role,
    context: `custody_transfer:${fromStage}->${toStage}`,
    tx_hash: checkResult.txHash,
  });

  if (!matched) {
    await db
      .from("evidence_items")
      .update({ mismatch_count: (item.mismatch_count ?? 0) + 1 })
      .eq("id", item.id);

    await recordAction(req, {
      action: "evidence.custody_transfer",
      subject: item.id,
      caseId: item.case_id,
      outcome: "refused",
      detail: { reason: "hash_mismatch", expected: item.file_hash, submitted: submittedHash, txHash: checkResult.txHash },
    });

    throw new AppError(
      409,
      "HASH_MISMATCH",
      "The hash of the file you hold does not match the registered evidence. " +
        "Custody was refused, and the mismatch is now recorded on chain.",
      {
        expectedHash: item.file_hash,
        submittedHash,
        anchoredAt: checkResult.txHash,
        explorer: explorerUrl(checkResult.txHash),
      }
    );
  }

  const result = await submit(
    "EvidenceChain",
    "transferCustody",
    [item.chain_evidence_id, stageTag(fromStage), stageTag(toStage), submittedHash],
    { submittedBy: user.id, payload: { evidenceRowId: item.id, fromStage, toStage } }
  );

  await db.from("custody_events").insert({
    evidence_id: item.id,
    from_stage: fromStage,
    to_stage: toStage,
    confirmed_hash: submittedHash,
    actor_id: user.id,
    actor_role: user.role,
    occurred_at: new Date().toISOString(),
    tx_hash: result.txHash,
    block_number: result.blockNumber,
  });

  await db.from("evidence_items").update({ current_stage: toStage }).eq("id", item.id);

  await recordAction(req, {
    action: "evidence.custody_transfer",
    subject: item.id,
    caseId: item.case_id,
    detail: { fromStage, toStage, txHash: result.txHash },
  });

  return {
    fromStage,
    toStage,
    chain: {
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      explorer: explorerUrl(result.txHash),
    },
  };
}

/**
 * Independent verification, the defence-side flow.
 *
 * Deliberately reads the answer from the chain rather than from
 * evidence_items.file_hash. If the prosecution's database were altered, a
 * comparison against that database would agree with the alteration; a
 * comparison against the chain would not. The database is used only to find
 * which on-chain id to ask about.
 */
export async function verifyAgainstChain(
  req: Request,
  user: SessionUser,
  evidenceId: string,
  submittedHash: string,
  anchor: boolean
) {
  const item = await loadEvidence(evidenceId);
  if (item.chain_evidence_id === null) {
    throw conflict("This item is not anchored on chain, so there is nothing independent to verify against.");
  }

  const onChain = (await read<any>("EvidenceChain", "getEvidence", [item.chain_evidence_id])) as any;
  const chainHash: string = onChain.fileHash;
  const matched = chainHash.toLowerCase() === submittedHash.toLowerCase();

  // Does the off-chain record still agree with the chain? A disagreement here is
  // a database tampering finding in its own right.
  const databaseAgreesWithChain = item.file_hash.toLowerCase() === chainHash.toLowerCase();

  let txHash: string | null = null;
  if (anchor) {
    const anchored = await submit(
      "EvidenceChain",
      "reportIntegrityCheck",
      [item.chain_evidence_id, submittedHash],
      { submittedBy: user.id, payload: { evidenceRowId: item.id, matched, by: user.role } }
    );
    txHash = anchored.txHash;
  }

  await db.from("integrity_checks").insert({
    evidence_id: item.id,
    submitted_hash: submittedHash,
    expected_hash: chainHash,
    matched,
    checked_by: user.id,
    checked_by_role: user.role,
    context: "independent_verification",
    tx_hash: txHash,
  });

  await recordAction(req, {
    action: "evidence.independent_verify",
    subject: item.id,
    caseId: item.case_id,
    outcome: matched ? "ok" : "refused",
    detail: { matched, databaseAgreesWithChain, txHash },
  });

  return {
    matched,
    databaseAgreesWithChain,
    submittedHash,
    onChainHash: chainHash,
    onChain: {
      caseId: onChain.caseId,
      collectedAt: Number(onChain.collectedAt),
      gpsLat: fromMicroDegrees(onChain.gpsLat),
      gpsLng: fromMicroDegrees(onChain.gpsLng),
      currentStage: onChain.currentStage,
      mismatchCount: Number(onChain.mismatchCount),
      forensicReportHash: onChain.forensicReportHash,
      anomalyFlagHash: onChain.anomalyFlagHash,
      registrar: onChain.registrar,
    },
    anchoredTxHash: txHash,
    explorer: txHash ? explorerUrl(txHash) : null,
  };
}

/** Custody timeline, read from the chain and annotated with off-chain names. */
export async function custodyTimeline(evidenceId: string) {
  const item = await loadEvidence(evidenceId);

  const offChain = unwrapList(
    await db
      .from("custody_events")
      .select("id, from_stage, to_stage, confirmed_hash, actor_id, actor_role, occurred_at, tx_hash, block_number")
      .eq("evidence_id", item.id)
      .order("occurred_at", { ascending: true })
  ) as any[];

  let onChain: any[] = [];
  if (item.chain_evidence_id !== null && chain.isReady) {
    try {
      const raw = (await read<any[]>("EvidenceChain", "getChainOfCustody", [item.chain_evidence_id])) as any[];
      onChain = raw.map((e) => ({
        fromRole: e.fromRole,
        toRole: e.toRole,
        confirmedHash: e.confirmedHash,
        timestamp: Number(e.timestamp),
        actor: e.actor,
      }));
    } catch (error) {
      logger.warn("Could not read the on-chain custody trail", { evidenceId, error });
    }
  }

  return {
    evidence: item,
    offChain,
    onChain,
    // The UI turns a false here into a red banner: the two trails must agree.
    consistent: onChain.length === 0 || onChain.length === offChain.length,
  };
}

export async function anchorForensicReport(
  req: Request,
  user: SessionUser,
  evidenceId: string,
  conclusion: string,
  detail: string | null
) {
  const item = await loadEvidence(evidenceId);
  if (item.chain_evidence_id === null) throw conflict("This item is not anchored on chain yet.");
  if (item.current_stage !== "FORENSIC_LAB") {
    throw conflict("A report can only be anchored while the item is in the lab's custody.");
  }

  const reportHash = sha256Hex(
    JSON.stringify({ evidenceId: item.id, fileHash: item.file_hash, conclusion, detail })
  );

  const result = await submit("EvidenceChain", "anchorForensicResult", [item.chain_evidence_id, reportHash], {
    submittedBy: user.id,
    payload: { evidenceRowId: item.id },
  });

  const row = unwrap(
    await db
      .from("forensic_reports")
      .insert({
        evidence_id: item.id,
        case_id: item.case_id,
        lab_id: user.id,
        report_hash: reportHash,
        conclusion,
        detail,
        tx_hash: result.txHash,
      })
      .select("*")
      .single()
  );

  await db.from("evidence_items").update({ forensic_report_hash: reportHash }).eq("id", item.id);

  await recordAction(req, {
    action: "evidence.forensic_report",
    subject: item.id,
    caseId: item.case_id,
    detail: { reportHash, txHash: result.txHash },
  });

  return { report: row, chain: { txHash: result.txHash, explorer: explorerUrl(result.txHash) } };
}

/** Decrypts and streams the original bytes back to an entitled role. */
export async function fetchPlaintext(evidenceId: string) {
  const item = await loadEvidence(evidenceId);
  if (!item.ipfs_cid || !item.encryption_iv || !item.encryption_tag) {
    throw notFound("Stored file for this evidence item");
  }

  const plaintext = await loadDecrypted(item.ipfs_cid, item.encryption_iv, item.encryption_tag);

  // The bytes we just decrypted must still hash to the registered digest.
  const digest = sha256Hex(plaintext);
  return {
    item,
    plaintext,
    digest,
    intact: digest === item.file_hash,
  };
}

export async function loadEvidence(evidenceId: string) {
  const item = unwrapMaybe(
    await db.from("evidence_items").select("*").eq("id", evidenceId).maybeSingle()
  ) as any;
  if (!item) throw notFound("Evidence item");
  return item;
}

export async function listCaseEvidence(caseId: string) {
  return unwrapList(
    await db
      .from("evidence_items")
      .select(
        "id, case_id, chain_evidence_id, file_hash, file_name, mime_type, size_bytes, kind, current_stage, " +
          "collected_at, gps_lat, gps_lng, anomaly_flagged, anomaly_score, anomaly_reasons, anomaly_flag_hash, " +
          "forensic_report_hash, mismatch_count, registration_tx_hash, created_at"
      )
      .eq("case_id", caseId)
      .order("collected_at", { ascending: false })
  ) as any[];
}

/** Items waiting for this role to accept custody. */
export async function inboxFor(role: SessionUser["role"], userId: string) {
  const stage = (Object.entries(STAGE_ROLE).find(([, r]) => r === role) ?? [])[0] as Stage | undefined;
  if (!stage) return [];
  const previous = (Object.entries(NEXT_STAGE).find(([, next]) => next === stage) ?? [])[0] as
    | Stage
    | undefined;
  if (!previous) return [];

  const assigned = unwrapList(
    await db.from("case_assignments").select("case_id").eq("user_id", userId)
  ) as { case_id: string }[];
  if (assigned.length === 0) return [];

  return unwrapList(
    await db
      .from("evidence_items")
      .select(
        "id, case_id, chain_evidence_id, file_hash, file_name, kind, current_stage, collected_at, " +
          "anomaly_flagged, anomaly_score, cases(fir_number, title)"
      )
      .eq("current_stage", previous)
      .in(
        "case_id",
        assigned.map((a) => a.case_id)
      )
      .order("collected_at", { ascending: true })
  ) as any[];
}
