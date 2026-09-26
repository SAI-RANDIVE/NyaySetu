import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env";
import { badRequest, notFound } from "../lib/errors";
import { asyncRoute } from "../middleware/error";
import { validate, hash32, uuid, latitude, longitude, safeText } from "../middleware/validate";
import { requireAuth, requireRole, assertCaseAccess } from "../middleware/auth";
import {
  registerEvidence,
  transferCustody,
  verifyAgainstChain,
  custodyTimeline,
  anchorForensicReport,
  fetchPlaintext,
  listCaseEvidence,
  loadEvidence,
  inboxFor,
} from "../services/evidence.service";

const router = Router();
router.use(requireAuth);

// Files are held in memory and never written to a temp directory, so an
// unencrypted evidence file never touches the server's disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
});

const registerSchema = z.object({
  caseId: uuid,
  // The digest the device computed before the upload started.
  clientHash: hash32,
  kind: z.enum(["photo", "video", "document", "audio", "physical"]),
  gpsLat: latitude,
  gpsLng: longitude,
  collectedAt: z.string().datetime({ offset: true }),
  deviceReportedMtime: z.string().datetime({ offset: true }).optional().nullable(),
  notes: safeText(2000).optional().nullable(),
});

/**
 * Register evidence collected at a scene.
 *
 * Multipart, because the file and its metadata arrive together. clientHash is
 * the digest the device computed over the raw bytes before the upload began;
 * the service recomputes it server-side and refuses any disagreement.
 */
router.post(
  "/",
  requireRole("police"),
  upload.single("file"),
  asyncRoute(async (req, res) => {
    if (!req.file) throw badRequest("Attach the evidence file as the `file` field.");

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(
        "Invalid evidence metadata.",
        Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]))
      );
    }

    await assertCaseAccess(req, parsed.data.caseId, "write");

    const result = await registerEvidence(req, req.user!, {
      caseId: parsed.data.caseId,
      clientHash: parsed.data.clientHash,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype || "application/octet-stream",
      kind: parsed.data.kind,
      buffer: req.file.buffer,
      gpsLat: parsed.data.gpsLat,
      gpsLng: parsed.data.gpsLng,
      collectedAt: parsed.data.collectedAt,
      deviceReportedMtime: parsed.data.deviceReportedMtime ?? null,
      notes: parsed.data.notes ?? null,
    });

    res.status(201).json(result);
  })
);

/** Items waiting for the caller's role to accept custody. */
router.get(
  "/inbox",
  requireRole("forensic_lab", "prosecutor", "judge"),
  asyncRoute(async (req, res) => {
    res.json({ items: await inboxFor(req.user!.role, req.user!.id) });
  })
);

router.get(
  "/case/:caseId",
  validate(z.object({ caseId: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.caseId);
    res.json({ items: await listCaseEvidence(req.params.caseId) });
  })
);

router.get(
  "/:id",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    const item = await loadEvidence(req.params.id);
    await assertCaseAccess(req, item.case_id);

    // Neither the key id nor the auth tag is any use to a client, and both are
    // part of the encryption envelope, so they stay server-side.
    const { encryption_iv, encryption_tag, encryption_key_id, ...safe } = item;
    res.json({ evidence: safe });
  })
);

/** Both trails side by side, so the UI can prove they agree. */
router.get(
  "/:id/custody",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    const item = await loadEvidence(req.params.id);
    await assertCaseAccess(req, item.case_id);

    const timeline = await custodyTimeline(req.params.id);
    const { encryption_iv, encryption_tag, encryption_key_id, ...safe } = timeline.evidence;
    res.json({ ...timeline, evidence: safe });
  })
);

/**
 * Accept custody. The receiving role submits the digest it recomputed from the
 * artefact it was handed, and a mismatch is anchored before being refused.
 */
router.post(
  "/:id/custody",
  requireRole("forensic_lab", "prosecutor", "judge"),
  validate(z.object({ id: uuid }), "params"),
  validate(z.object({ confirmedHash: hash32 })),
  asyncRoute(async (req, res) => {
    const item = await loadEvidence(req.params.id);
    await assertCaseAccess(req, item.case_id, "write");

    const result = await transferCustody(req, req.user!, req.params.id, req.body.confirmedHash);
    res.json(result);
  })
);

/**
 * Independent verification. Open to every role assigned to the case, which is
 * how the defence uses it: the answer is read from the chain, not from the
 * prosecution's database.
 */
router.post(
  "/:id/verify",
  validate(z.object({ id: uuid }), "params"),
  validate(
    z.object({
      submittedHash: hash32,
      // Anchoring costs gas, so the caller chooses. The defence anchors, so the
      // verification itself becomes part of the record.
      anchor: z.coerce.boolean().default(true),
    })
  ),
  asyncRoute(async (req, res) => {
    const item = await loadEvidence(req.params.id);
    await assertCaseAccess(req, item.case_id);

    const result = await verifyAgainstChain(
      req,
      req.user!,
      req.params.id,
      req.body.submittedHash,
      req.body.anchor
    );
    res.json(result);
  })
);

/**
 * Verification from a file rather than a precomputed digest. The frontend
 * normally hashes in the browser with WebCrypto; this exists for the case where
 * counsel has only the file and wants the server to do the arithmetic.
 */
router.post(
  "/:id/verify-file",
  validate(z.object({ id: uuid }), "params"),
  upload.single("file"),
  asyncRoute(async (req, res) => {
    if (!req.file) throw badRequest("Attach the file to verify as the `file` field.");

    const item = await loadEvidence(req.params.id);
    await assertCaseAccess(req, item.case_id);

    const { sha256Hex } = await import("../lib/crypto");
    const digest = sha256Hex(req.file.buffer);

    const result = await verifyAgainstChain(req, req.user!, req.params.id, digest, true);
    res.json({ ...result, computedHash: digest, fileName: req.file.originalname });
  })
);

router.post(
  "/:id/forensic-report",
  requireRole("forensic_lab"),
  validate(z.object({ id: uuid }), "params"),
  validate(
    z.object({
      conclusion: safeText(500),
      detail: safeText(20000).optional().nullable(),
    })
  ),
  asyncRoute(async (req, res) => {
    const item = await loadEvidence(req.params.id);
    await assertCaseAccess(req, item.case_id, "write");

    const result = await anchorForensicReport(
      req,
      req.user!,
      req.params.id,
      req.body.conclusion,
      req.body.detail ?? null
    );
    res.status(201).json(result);
  })
);

router.get(
  "/:id/forensic-reports",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    const item = await loadEvidence(req.params.id);
    await assertCaseAccess(req, item.case_id);

    const { db, unwrapList } = await import("../lib/supabase");
    const reports = unwrapList(
      await db
        .from("forensic_reports")
        .select("id, report_hash, conclusion, detail, created_at, tx_hash, lab_id")
        .eq("evidence_id", req.params.id)
        .order("created_at", { ascending: false })
    );
    res.json({ reports });
  })
);

/**
 * Download the original file, decrypted.
 *
 * Not available to the defence: counsel verifies integrity against the chain
 * and receives disclosure through the court, not through this API. The response
 * carries the recomputed digest in a header so a client can re-check it.
 */
router.get(
  "/:id/download",
  requireRole("police", "forensic_lab", "prosecutor", "judge", "court_admin"),
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    const item = await loadEvidence(req.params.id);
    await assertCaseAccess(req, item.case_id);

    const { plaintext, digest, intact } = await fetchPlaintext(req.params.id);

    res.setHeader("content-type", item.mime_type || "application/octet-stream");
    res.setHeader("content-disposition", `attachment; filename="${encodeURIComponent(item.file_name)}"`);
    res.setHeader("x-nyaysetu-sha256", digest);
    res.setHeader("x-nyaysetu-integrity", intact ? "verified" : "MISMATCH");
    res.send(plaintext);
  })
);

/** Every verification attempt on an item, pass or fail. */
router.get(
  "/:id/integrity-checks",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    const item = await loadEvidence(req.params.id);
    await assertCaseAccess(req, item.case_id);

    const { db, unwrapList } = await import("../lib/supabase");
    const checks = unwrapList(
      await db
        .from("integrity_checks")
        .select("id, submitted_hash, expected_hash, matched, checked_by_role, context, tx_hash, created_at")
        .eq("evidence_id", req.params.id)
        .order("created_at", { ascending: false })
        .limit(100)
    );
    res.json({ checks });
  })
);

export default router;
