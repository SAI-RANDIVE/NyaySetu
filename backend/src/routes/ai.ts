import { Router } from "express";
import { z } from "zod";
import { capabilities } from "../config/env";
import { db, unwrapList } from "../lib/supabase";
import { asyncRoute } from "../middleware/error";
import { validate, safeText, uuid, pagination } from "../middleware/validate";
import { requireAuth, requireRole, assertCaseAccess } from "../middleware/auth";
import { predictDelay, health as aiHealth, recordPrediction } from "../lib/ai";

const router = Router();
router.use(requireAuth);

router.get(
  "/status",
  asyncRoute(async (_req, res) => {
    res.json({
      configured: capabilities.ai,
      reachable: await aiHealth(),
      models: ["evidence_anomaly", "bail_risk", "case_delay"],
      note: "Models are trained on clearly-labelled synthetic data. See ai-service/README.md.",
    });
  })
);

/**
 * Expected time to disposal.
 *
 * Advisory only: it informs listing priority, never a judicial finding. The
 * prediction is stored so the estimate that was actually shown to a judge can
 * be reconstructed later.
 */
router.post(
  "/case-delay",
  requireRole("judge", "court_admin", "prosecutor"),
  validate(
    z.object({
      caseId: uuid.optional().nullable(),
      offenceType: safeText(120),
      courtBacklog: z.coerce.number().int().min(0).max(100_000),
      witnessCount: z.coerce.number().int().min(0).max(500),
      evidenceCount: z.coerce.number().int().min(0).max(5000),
      adjournmentsSoFar: z.coerce.number().int().min(0).max(500),
      isBailGranted: z.coerce.boolean(),
    })
  ),
  asyncRoute(async (req, res) => {
    const body = req.body as any;
    if (body.caseId) await assertCaseAccess(req, body.caseId);

    const { caseId, ...features } = body;
    const prediction = await predictDelay(features);

    if (prediction.available) {
      await recordPrediction({
        model: "case_delay",
        modelVersion: prediction.modelVersion,
        subjectType: "case",
        subjectId: caseId ?? "ad-hoc",
        caseId: caseId ?? null,
        input: features,
        output: prediction,
      });
    }

    res.json({ prediction });
  })
);

/** Every prediction recorded for a case, with its anchoring digest. */
router.get(
  "/case/:caseId/predictions",
  validate(z.object({ caseId: uuid }), "params"),
  validate(pagination, "query"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.caseId);
    const { limit, offset } = req.query as any;

    res.json({
      predictions: unwrapList(
        await db
          .from("ai_flags")
          .select("id, model, model_version, subject_type, subject_id, output, payload_hash, anchored_tx_hash, created_at")
          .eq("case_id", req.params.caseId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1)
      ),
    });
  })
);

export default router;
