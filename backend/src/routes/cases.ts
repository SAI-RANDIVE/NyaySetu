import { Router } from "express";
import { z } from "zod";
import { db, unwrap, unwrapList, unwrapMaybe } from "../lib/supabase";
import { caseIdHash } from "../lib/crypto";
import { describeSections, parseReference } from "../lib/statute";
import { conflict, notFound } from "../lib/errors";
import { asyncRoute } from "../middleware/error";
import { validate, safeText, firNumber, uuid } from "../middleware/validate";
import { requireAuth, requireRole, assertCaseAccess } from "../middleware/auth";
import { recordAction } from "../services/audit";
import { listCaseEvidence } from "../services/evidence.service";
import { listForCase as summonsForCase } from "../services/summons.service";

const router = Router();
router.use(requireAuth);

const CASE_COLUMNS =
  "id, fir_number, case_id_hash, title, offence_type, sections, police_station, court_name, status, registered_at, created_at";

/** Cases the caller may see. The court registry sees all of them. */
router.get(
  "/",
  asyncRoute(async (req, res) => {
    const user = req.user!;

    if (user.role === "court_admin") {
      const cases = unwrapList(
        await db.from("cases").select(CASE_COLUMNS).order("registered_at", { ascending: false }).limit(200)
      );
      return res.json({ cases });
    }

    const assignments = unwrapList(
      await db.from("case_assignments").select("case_id, access").eq("user_id", user.id)
    ) as { case_id: string; access: string }[];

    if (assignments.length === 0) return res.json({ cases: [] });

    const cases = unwrapList(
      await db
        .from("cases")
        .select(CASE_COLUMNS)
        .in(
          "id",
          assignments.map((a) => a.case_id)
        )
        .order("registered_at", { ascending: false })
    ) as any[];

    const accessById = new Map(assignments.map((a) => [a.case_id, a.access]));
    res.json({ cases: cases.map((c) => ({ ...c, access: accessById.get(c.id) ?? "read" })) });
  })
);

/**
 * Register an FIR. The case id every contract uses is keccak256 of the FIR
 * number, so the same case is addressable from any of the three modules without
 * a shared registry contract.
 */
router.post(
  "/",
  requireRole("police", "court_admin"),
  validate(
    z.object({
      firNumber,
      title: safeText(200),
      offenceType: safeText(120),
      sections: z.array(safeText(40)).max(20).default([]),
      policeStation: safeText(160),
      courtName: safeText(160).optional(),
      summary: safeText(8000).optional(),
    })
  ),
  asyncRoute(async (req, res) => {
    const body = req.body as any;
    const user = req.user!;
    const hash = caseIdHash(body.firNumber);

    const existing = unwrapMaybe(
      await db.from("cases").select("id").eq("case_id_hash", hash).maybeSingle()
    ) as { id: string } | null;
    if (existing) throw conflict("A case with that FIR number already exists.");

    // Citations are normalised on the way in, so the column holds "BNS 305" rather
    // than whichever of "305", "s.305" or "bns305" this station happens to type.
    // Anything the code does not recognise — an NDPS or POCSO section — is kept
    // exactly as written, because refusing it would refuse a real charge sheet.
    const normalisedSections: string[] = (body.sections ?? []).map(
      (raw: string) => parseReference(raw).canonical
    );

    const created = unwrap(
      await db
        .from("cases")
        .insert({
          fir_number: body.firNumber.trim().toUpperCase(),
          case_id_hash: hash,
          title: body.title,
          offence_type: body.offenceType,
          sections: normalisedSections,
          police_station: body.policeStation,
          court_name: body.courtName ?? null,
          summary: body.summary ?? null,
          status: "registered",
          registered_by: user.id,
        })
        .select(CASE_COLUMNS)
        .single()
    ) as any;

    // The registering officer gets write access immediately; without this the
    // very next call would be refused by their own case-access check.
    await db.from("case_assignments").insert({
      case_id: created.id,
      user_id: user.id,
      access: "write",
      assigned_by: user.id,
    });

    const statute = describeSections(normalisedSections);

    await recordAction(req, {
      action: "case.register",
      subject: created.id,
      caseId: created.id,
      detail: {
        firNumber: created.fir_number,
        caseIdHash: hash,
        // Recorded so a later question about the gravity of a charge can be
        // answered from the trail rather than re-derived from whatever the
        // reference file says at that point.
        sectionsRecognised: statute.recognised,
        statutorySeverity: statute.severity,
      },
    });

    res.status(201).json({ case: created, statute });
  })
);

router.get(
  "/:id",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.id);

    const row = unwrapMaybe(
      await db
        .from("cases")
        .select(`${CASE_COLUMNS}, summary`)
        .eq("id", req.params.id)
        .maybeSingle()
    ) as any;
    if (!row) throw notFound("Case");

    const assignments = unwrapList(
      await db
        .from("case_assignments")
        .select("user_id, access, created_at, user_directory!inner(full_name, role, designation)")
        .eq("case_id", row.id)
    ) as any[];

    // What the code says about the sections cited, so a reader of the dossier does
    // not have to know the Sanhita by heart to know what was charged.
    res.json({ case: row, assignments, statute: describeSections(row.sections ?? []) });
  })
);

/** One call that fills a case dossier screen. */
router.get(
  "/:id/overview",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.id);
    const caseId = req.params.id;

    const row = unwrapMaybe(
      await db.from("cases").select(`${CASE_COLUMNS}, summary`).eq("id", caseId).maybeSingle()
    ) as any;
    if (!row) throw notFound("Case");

    const [evidence, summons, bail, violations] = await Promise.all([
      listCaseEvidence(caseId),
      summonsForCase(caseId),
      db
        .from("bail_conditions")
        .select("id, accused_name, conditions, compliance_score, risk_band, active, expiry_at, radius_metres")
        .eq("case_id", caseId)
        .maybeSingle()
        .then((r) => r.data),
      db
        .from("violations")
        .select("id, kind, reason, detected_at, acknowledged_at")
        .eq("case_id", caseId)
        .order("detected_at", { ascending: false })
        .limit(20)
        .then((r) => r.data ?? []),
    ]);

    // The defence sees the evidence chain and nothing that would expose the
    // prosecution's working notes.
    const redactPrivileged = req.user!.role === "defence_lawyer";

    res.json({
      case: redactPrivileged ? { ...row, summary: null } : row,
      statute: describeSections(row.sections ?? []),
      evidence,
      summons: redactPrivileged ? [] : summons,
      bail,
      violations,
      counts: {
        evidence: evidence.length,
        flaggedEvidence: evidence.filter((e: any) => e.anomaly_flagged).length,
        summons: summons.length,
        openViolations: violations.filter((v: any) => !v.acknowledged_at).length,
      },
    });
  })
);

/** Case assignment is how every other permission is derived. */
router.post(
  "/:id/assignments",
  requireRole("court_admin", "judge"),
  validate(z.object({ id: uuid }), "params"),
  validate(
    z.object({
      userId: uuid,
      access: z.enum(["read", "write"]).default("read"),
    })
  ),
  asyncRoute(async (req, res) => {
    const caseId = req.params.id;
    const { userId, access } = req.body as { userId: string; access: "read" | "write" };

    const target = unwrapMaybe(
      await db.from("users").select("id, full_name, role").eq("id", userId).maybeSingle()
    ) as { id: string; full_name: string; role: string } | null;
    if (!target) throw notFound("User");

    // Defence counsel never gets write access to prosecution material.
    const effective = target.role === "defence_lawyer" ? "read" : access;

    const row = unwrap(
      await db
        .from("case_assignments")
        .upsert(
          { case_id: caseId, user_id: userId, access: effective, assigned_by: req.user!.id },
          { onConflict: "case_id,user_id" }
        )
        .select("case_id, user_id, access, created_at")
        .single()
    );

    await recordAction(req, {
      action: "case.assign",
      subject: userId,
      caseId,
      detail: { role: target.role, access: effective, downgraded: effective !== access },
    });

    res.status(201).json({ assignment: row, downgradedToRead: effective !== access });
  })
);

router.delete(
  "/:id/assignments/:userId",
  requireRole("court_admin", "judge"),
  validate(z.object({ id: uuid, userId: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await db
      .from("case_assignments")
      .delete()
      .eq("case_id", req.params.id)
      .eq("user_id", req.params.userId);

    await recordAction(req, {
      action: "case.unassign",
      subject: req.params.userId,
      caseId: req.params.id,
    });

    res.json({ ok: true });
  })
);

router.patch(
  "/:id/status",
  requireRole("police", "prosecutor", "judge", "court_admin"),
  validate(z.object({ id: uuid }), "params"),
  validate(
    z.object({
      status: z.enum(["registered", "under_investigation", "charge_sheeted", "trial", "disposed"]),
    })
  ),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.id, "write");

    const row = unwrap(
      await db
        .from("cases")
        .update({ status: req.body.status })
        .eq("id", req.params.id)
        .select(CASE_COLUMNS)
        .single()
    );

    await recordAction(req, {
      action: "case.status_change",
      subject: req.params.id,
      caseId: req.params.id,
      detail: { status: req.body.status },
    });

    res.json({ case: row });
  })
);

export default router;
