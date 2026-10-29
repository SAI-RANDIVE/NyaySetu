import { Router } from "express";
import { z } from "zod";
import { db, unwrapList } from "../lib/supabase";
import { asyncRoute } from "../middleware/error";
import { validate, hash32, uuid } from "../middleware/validate";
import { publicLimiter } from "../middleware/rateLimit";
import { requireAuth, assertCaseAccess } from "../middleware/auth";
import { checkFileAgainstChain, loadByRef, lookupByFile, publicPassport } from "../services/passport/passport.service";
import { openApiDocument } from "./openapi";

/**
 * Versioned integration API (v1) for other systems that need to trust a
 * NyaySetu record: a records system, a court's case system, a laboratory's.
 *
 * Public endpoints say only what the public Integrity Passport says; protected
 * ones use the same session and per-case access as the portals. No external
 * government system is connected; the sandbox client in scripts/ shows how one
 * would call these endpoints.
 *
 * Errors are always { error: { code, message } } with a meaningful status.
 */
const router = Router();
const refParam = z.object({ ref: z.string().trim().min(4).max(40) });

router.get("/openapi.json", (_req, res) => {
  res.setHeader("cache-control", "public, max-age=300").json(openApiDocument());
});

/* ------------------------------------------------------------- public */

const open = Router();
open.use(publicLimiter);

/** The public passport of an item: digests, transaction, state, custody stages. */
open.get(
  "/evidence/:ref",
  validate(refParam, "params"),
  asyncRoute(async (req, res) => {
    res.setHeader("cache-control", "no-store").json({ apiVersion: "1", evidence: await publicPassport(req.params.ref) });
  })
);

/** Custody status: the stages an item has passed through, from the ledger record. */
open.get(
  "/evidence/:ref/custody",
  validate(refParam, "params"),
  asyncRoute(async (req, res) => {
    const passport = await publicPassport(req.params.ref);
    res.setHeader("cache-control", "no-store").json({ apiVersion: "1", reference: passport.reference, state: passport.state, custody: passport.custody });
  })
);

/**
 * Verify a file by its SHA-256, with or without a reference. The caller hashes
 * the file; only the digest is sent. The answer is compared against the chain.
 */
open.post(
  "/verify",
  validate(z.object({ sha256: hash32, reference: z.string().trim().min(4).max(40).optional() }).strict()),
  asyncRoute(async (req, res) => {
    res.setHeader("cache-control", "no-store");
    if (req.body.reference) {
      return res.json({ apiVersion: "1", found: true, reference: req.body.reference, result: await checkFileAgainstChain(req.body.reference, req.body.sha256) });
    }
    res.json({ apiVersion: "1", ...(await lookupByFile(req.body.sha256)) });
  })
);

/**
 * Verify a document NyaySetu produced — a Section 63 certificate or an approved
 * final report — by the SHA-256 of the PDF the caller holds. Says what kind of
 * document it is and its state; nothing about the case.
 */
open.post(
  "/documents/verify",
  validate(z.object({ sha256: hash32 }).strict()),
  asyncRoute(async (req, res) => {
    const digest = req.body.sha256.toLowerCase();
    const [{ data: certs }, { data: reports }] = await Promise.all([
      db.from("certificates").select("created_at").eq("pdf_sha256", digest).limit(1),
      db.from("document_versions").select("version, state, approved_at, filed_at").eq("content_sha256", digest).limit(1),
    ]);
    const cert = (certs ?? [])[0] as { created_at: string } | undefined;
    const report = (reports ?? [])[0] as { version: number; state: string; approved_at: string | null; filed_at: string | null } | undefined;
    res.setHeader("cache-control", "no-store").json({
      apiVersion: "1",
      found: Boolean(cert || report),
      document: cert
        ? { kind: "section63_certificate", issuedAt: cert.created_at, note: "Generated unsigned; valid only when signed under BSA §63." }
        : report
          ? { kind: "final_report", version: report.version, state: report.state, approvedAt: report.approved_at, filedAt: report.filed_at }
          : null,
    });
  })
);

/* ---------------------------------------------------------- protected */

const closed = Router();
closed.use(requireAuth);

/** Evidence metadata of a case, for a party assigned to it. */
closed.get(
  "/cases/:caseId/evidence",
  validate(z.object({ caseId: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.caseId);
    const items = unwrapList(
      await db
        .from("evidence_items")
        .select("public_ref, kind, mime_type, size_bytes, file_hash, anchored_digest, anchor_mode, current_stage, collected_at, mismatch_count")
        .eq("case_id", req.params.caseId)
        .order("collected_at", { ascending: true })
    );
    res.json({ apiVersion: "1", caseId: req.params.caseId, evidence: items });
  })
);

/** Audit history of one item, for a party assigned to its case. */
closed.get(
  "/evidence/:ref/audit",
  validate(refParam, "params"),
  asyncRoute(async (req, res) => {
    const item = await loadByRef(req.params.ref);
    await assertCaseAccess(req, item.case_id);
    const entries = unwrapList(
      await db.from("action_log").select("action, actor_role, outcome, occurred_at").eq("subject", item.id).order("occurred_at", { ascending: true }).limit(500)
    );
    res.json({ apiVersion: "1", reference: req.params.ref, audit: entries });
  })
);

router.use(open);
router.use(closed);
export default router;
