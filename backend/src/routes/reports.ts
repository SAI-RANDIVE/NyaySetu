import { Router } from "express";
import { z } from "zod";
import { db, unwrapList } from "../lib/supabase";
import { sha256Hex } from "../lib/crypto";
import { badRequest, unavailable } from "../lib/errors";
import { logger } from "../lib/logger";
import { asyncRoute } from "../middleware/error";
import { validate, uuid, safeText } from "../middleware/validate";
import { requireAuth, requireRole, assertCaseAccess } from "../middleware/auth";
import { recordAction } from "../services/audit";
import { loadDossier, redactForRole } from "../services/report.service";
import { canSeeFir } from "../services/case.service";
import type { UserRole } from "../middleware/auth";
import { buildFinalReport } from "../lib/pdf/finalReport";
import { buildTemplatePdf } from "../lib/pdf/template";
import { approveVersion, createVersion, currentReadiness, listVersions, markFiled, versionCase, versionPdf } from "../services/documentVersions.service";
import { sendCaseDocument, maskEmail } from "../lib/mailer";
import { capabilities } from "../config/env";
import { listCaseRecipients } from "../services/assignments.service";

/**
 * Court documents: produced here, and emailed from here.
 *
 * WHY THE SERVER RENDERS THEM AND NOT THE BROWSER
 *   A charge sheet has to be identical every time it is produced, and it has to
 *   contain everything the record holds rather than whatever a screen had loaded.
 *   Rendering in the browser would make the document a function of the client's
 *   state, its fonts and its filters. Rendering here makes it a function of the
 *   database.
 *
 * WHY THE DIGEST IS RECORDED
 *   Every rendering is hashed and the hash written to the action log. That turns
 *   "is this the report you filed in March" into a question with an answer, without
 *   storing a copy of every PDF anybody ever generated.
 */

const router = Router();
router.use(requireAuth);

function fileNameFor(caseReference: string, kind: string): string {
  const safe = caseReference.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${kind}-${safe}.pdf`;
}

/**
 * The Final Report as a PDF.
 *
 * Available to everyone assigned to the case, including defence counsel: a charge
 * sheet is served on the accused as a matter of law, so withholding it here would
 * be the system inventing a restriction the code does not impose.
 */
router.get(
  "/cases/:id/final-report.pdf",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.id);

    const dossier = redactForRole(await loadDossier(req.params.id), req.user!.role);
    const pdf = await buildFinalReport(dossier).toBuffer();
    const digest = sha256Hex(pdf);

    await recordAction(req, {
      action: "report.final_report",
      subject: dossier.case.id,
      caseId: dossier.case.id,
      detail: {
        documentDigest: digest,
        exhibits: dossier.evidence.length,
        pages: undefined,
        bytes: pdf.length,
      },
    });

    res
      .status(200)
      .setHeader("content-type", "application/pdf")
      .setHeader(
        "content-disposition",
        `inline; filename="${fileNameFor(dossier.case.case_reference, "final-report")}"`
      )
      // So a recipient can check the bytes they received against the bytes sent
      // without opening the file.
      .setHeader("x-nyaysetu-sha256", digest)
      .setHeader("content-length", String(pdf.length))
      .end(pdf);
  })
);

/**
 * Emails the Final Report.
 *
 * Recipients default to the people assigned to the case, because those are the
 * people entitled to it and the list is already maintained. Addresses may also be
 * given explicitly — a Sessions registry, a superior officer, counsel who has not
 * yet been given an account — which is why the endpoint exists at all rather than
 * relying on whoever downloaded it forwarding the file.
 *
 * Restricted to the roles that file and receive filings. An accused person can
 * download their own copy; they cannot post it to arbitrary addresses from the
 * court's mail server.
 */
router.post(
  "/cases/:id/final-report/email",
  requireRole("police", "prosecutor", "judge", "court_admin"),
  validate(z.object({ id: uuid }), "params"),
  validate(
    z.object({
      /** Explicit addresses. Omitted or empty means everyone on the case. */
      recipients: z.array(z.string().trim().email().max(200)).max(20).optional(),
      /** Whether to include the people assigned to the case. */
      includeAssigned: z.boolean().default(true),
      note: safeText(600).optional().nullable(),
    })
  ),
  asyncRoute(async (req, res) => {
    if (!capabilities.emailNotifications) {
      throw unavailable(
        "No mail server is configured, so the report cannot be emailed. Download it and send it " +
          "yourself, or configure SMTP_HOST, SMTP_USER and SMTP_PASSWORD."
      );
    }

    await assertCaseAccess(req, req.params.id);
    const body = req.body as { recipients?: string[]; includeAssigned: boolean; note?: string | null };

    const dossier = await loadDossier(req.params.id);

    const assigned = body.includeAssigned ? await listCaseRecipients(req.params.id) : [];

    // An address typed in by hand has no known role, so it gets the copy with
    // the FIR number withheld.
    const explicit = (body.recipients ?? []).map((email) => ({
      id: null as string | null,
      email,
      full_name: null as string | null,
      role: null as string | null,
    }));

    // Deduplicated on the address, case-insensitively, so somebody who is both
    // assigned and typed in does not receive it twice.
    const seen = new Set<string>();
    const targets = [...assigned, ...explicit].filter((t) => {
      const key = String(t.email).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (targets.length === 0) {
      throw badRequest(
        "Nobody to send it to. Either assign participants to the case or give at least one address."
      );
    }

    // Two renderings at most: one naming the FIR for the roles that may read it,
    // one withholding it for everyone else. Each recipient gets the one for them.
    const privileged = await buildFinalReport(dossier).toBuffer();
    const redacted = await buildFinalReport(redactForRole(dossier, null)).toBuffer();
    const fileName = fileNameFor(dossier.case.case_reference, "final-report");

    // Sent one at a time rather than as a single message with many recipients, so
    // that one bad address fails alone and nobody learns who else received it.
    const results = [];
    for (const target of targets) {
      const pdf = target.role && canSeeFir(target.role as UserRole) ? privileged : redacted;
      const digest = sha256Hex(pdf);
      const outcome = await sendCaseDocument({
        to: target.email,
        userId: target.id,
        recipientName: target.full_name,
        documentTitle: "Final Report / Charge Sheet",
        fileName,
        pdf,
        caseReference: dossier.case.case_reference,
        caseTitle: dossier.case.title,
        sentByName: req.user!.fullName,
        digest,
        note: body.note ?? null,
      });
      results.push({ to: maskEmail(target.email), status: outcome.status, error: outcome.error ?? null });
    }

    const failed = results.filter((r) => r.status !== "sent").length;
    if (failed > 0) {
      logger.warn("Some copies of the final report could not be delivered", {
        caseId: dossier.case.id,
        failed,
      });
    }

    await recordAction(req, {
      action: "report.final_report_emailed",
      subject: dossier.case.id,
      caseId: dossier.case.id,
      outcome: failed === results.length ? "failed" : "ok",
      detail: {
        documentDigest: sha256Hex(privileged),
        redactedDigest: sha256Hex(redacted),
        recipients: results.length,
        failed,
      },
    });

    res.json({
      sent: results.filter((r) => r.status === "sent").length,
      failed,
      digest: sha256Hex(privileged),
      redactedDigest: sha256Hex(redacted),
      fileName,
      results,
    });
  })
);

/**
 * Who this report would go to, so the UI can show the list before sending.
 *
 * Addresses are returned in full rather than masked, because the person calling
 * this is already entitled to the case file and is about to send them a document —
 * masking here would only stop them noticing a wrong address before it is used.
 */
router.get(
  "/cases/:id/final-report/recipients",
  requireRole("police", "prosecutor", "judge", "court_admin"),
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.id);

    const rows = await listCaseRecipients(req.params.id);

    res.json({
      emailConfigured: capabilities.emailNotifications,
      recipients: rows.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        access: u.access,
      })),
    });
  })
);


/* ================================================ readiness and versions (2.1) */

const particularsBody = z
  .object({
    nature: z.enum(["charge_sheet", "closure_report", "untraced_report"]).nullable().optional(),
    complainant: safeText(1500).nullable().optional(),
    narrative: safeText(12000).nullable().optional(),
    annexures: z.array(safeText(300)).max(30).optional(),
  })
  .strict();

/** The Document Readiness Report for the case's final report, as JSON. */
router.get(
  "/cases/:id/final-report/readiness",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.id);
    res.json(await currentReadiness(req.params.id));
  })
);

/** The same report as a PDF, to attach to a file or hand to a reviewer. */
router.get(
  "/cases/:id/final-report/readiness.pdf",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.id);
    const dossier = await loadDossier(req.params.id);
    const { findings, summary } = await currentReadiness(req.params.id);
    const pdf = await buildTemplatePdf({
      title: "Document Readiness Report — Final Report",
      reference: dossier.case.case_reference,
      issuer: dossier.case.police_station,
      sections: [
        {
          heading: "Summary",
          body:
            `${summary.pass} passed, ${summary.warning} warning(s), ${summary.blocking} blocking, ${summary.notVerified} not verified. ` +
            (summary.canApprove ? "Nothing blocks approval by an authorised officer." : "Approval is blocked until the blocking items are resolved.") +
            " Passing these checks means the record is consistent and complete enough for review. It does not make the report legally valid; signature and endorsement remain with the officer.",
        },
      ],
      tables: [
        {
          heading: "Findings",
          columns: ["Result", "Area", "Check", "Detail"],
          widths: [70, 60, 105, 248],
          rows: findings.map((f) => [f.level.replace("_", " "), f.area, f.code.replace(/_/g, " ").toLowerCase(), f.message]),
        },
      ],
      footer: "Generated by NyaySetu from the case record and the ledger at the time shown. Re-run before approval.",
    });
    res.status(200).setHeader("content-type", "application/pdf").setHeader("content-disposition", `inline; filename="${fileNameFor(dossier.case.case_reference, "readiness")}"`).end(pdf);
  })
);

router.get(
  "/cases/:id/final-report/versions",
  validate(z.object({ id: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.id);
    res.json({ versions: await listVersions(req.params.id) });
  })
);

/** A new version: the officer's particulars, checked at once. */
router.post(
  "/cases/:id/final-report/versions",
  requireRole("police", "prosecutor"),
  validate(z.object({ id: uuid }), "params"),
  validate(particularsBody),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, req.params.id, "write");
    res.status(201).json({ version: await createVersion(req, req.user!, req.params.id, req.body) });
  })
);

/** Approval by a police officer, after a fresh readiness check. */
router.post(
  "/final-report/versions/:versionId/approve",
  requireRole("police"),
  validate(z.object({ versionId: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, await versionCase(req.params.versionId), "write");
    res.json({ version: await approveVersion(req, req.user!, req.params.versionId) });
  })
);

router.get(
  "/final-report/versions/:versionId/pdf",
  validate(z.object({ versionId: uuid }), "params"),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, await versionCase(req.params.versionId));
    const { pdf, digest, row } = await versionPdf(req, req.user!.role, req.params.versionId);
    res
      .status(200)
      .setHeader("content-type", "application/pdf")
      .setHeader("content-disposition", `inline; filename="final-report-v${row.version}.pdf"`)
      .setHeader("x-nyaysetu-sha256", digest)
      .end(pdf);
  })
);

/** Filing is recorded by a person, against a receipt from the court. */
router.post(
  "/final-report/versions/:versionId/filed",
  requireRole("prosecutor", "court_admin"),
  validate(z.object({ versionId: uuid }), "params"),
  validate(z.object({ reference: z.string().trim().min(3).max(120), filedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict()),
  asyncRoute(async (req, res) => {
    await assertCaseAccess(req, await versionCase(req.params.versionId), "write");
    res.json({ version: await markFiled(req, req.user!, req.params.versionId, req.body) });
  })
);

export default router;
