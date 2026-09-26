import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, unwrap, unwrapList, unwrapMaybe } from "../lib/supabase";
import { aadhaarToken, aadhaarLast4, encryptField } from "../lib/crypto";
import { chain } from "../lib/chain";
import { conflict, notFound } from "../lib/errors";
import { asyncRoute } from "../middleware/error";
import { validate, uuid, safeText, aadhaarNumber, pagination } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { recordAction } from "../services/audit";
import { ownerOfToken, piiDirectory, upsertPii } from "../lib/pii";

const router = Router();
router.use(requireAuth, requireRole("court_admin"));

const USER_COLUMNS =
  "id, email, full_name, role, designation, station_or_court, wallet_address, is_active, last_login_at, created_at";

router.get(
  "/users",
  validate(pagination, "query"),
  asyncRoute(async (req, res) => {
    const { limit, offset } = req.query as any;
    const users = unwrapList(
      await db
        .from("users")
        .select(USER_COLUMNS)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)
    ) as any[];

    // Whether an Aadhaar token exists, never the token or the number.
    const pii = await piiDirectory();
    const byUser = new Map(pii.map((p) => [p.user_id, p.aadhaar_last4]));

    res.json({
      users: users.map((u) => ({
        ...u,
        aadhaarOnFile: byUser.has(u.id),
        aadhaarLast4: byUser.get(u.id) ?? null,
      })),
    });
  })
);

/**
 * Create a participant.
 *
 * The Aadhaar number is accepted once, tokenised, and never stored. Only the
 * HMAC token and the last four digits survive the request.
 */
router.post(
  "/users",
  validate(
    z.object({
      email: z.string().trim().email().max(200),
      password: z.string().min(12).max(200),
      fullName: safeText(160),
      role: z.enum([
        "police",
        "forensic_lab",
        "prosecutor",
        "judge",
        "defence_lawyer",
        "accused",
        "court_admin",
      ]),
      designation: safeText(120).optional().nullable(),
      stationOrCourt: safeText(160).optional().nullable(),
      walletAddress: z
        .string()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .optional()
        .nullable(),
      aadhaarNumber: aadhaarNumber.optional(),
      phone: safeText(20).optional().nullable(),
      address: safeText(400).optional().nullable(),
    })
  ),
  asyncRoute(async (req, res) => {
    const body = req.body as any;

    const existing = unwrapMaybe(
      await db.from("users").select("id").ilike("email", body.email).maybeSingle()
    ) as { id: string } | null;
    if (existing) throw conflict("A user with that email address already exists.");

    const created = unwrap(
      await db
        .from("users")
        .insert({
          email: body.email.toLowerCase(),
          password_hash: await bcrypt.hash(body.password, 12),
          full_name: body.fullName,
          role: body.role,
          designation: body.designation ?? null,
          station_or_court: body.stationOrCourt ?? null,
          wallet_address: body.walletAddress ?? null,
        })
        .select(USER_COLUMNS)
        .single()
    ) as any;

    if (body.aadhaarNumber) {
      const token = aadhaarToken(body.aadhaarNumber);
      const last4 = aadhaarLast4(body.aadhaarNumber);

      const clash = await ownerOfToken(token);
      if (clash) {
        // The account was created a moment ago and is now invalid, so remove it
        // rather than leaving an account nobody can complete.
        await db.from("users").delete().eq("id", created.id);
        throw conflict("That Aadhaar number is already registered to another account.");
      }

      await upsertPii({
        userId: created.id,
        aadhaarToken: token,
        aadhaarLast4: last4,
        phoneEncrypted: body.phone ? encryptField(body.phone) : null,
        addressEncrypted: body.address ? encryptField(body.address) : null,
      });
    }

    await recordAction(req, {
      action: "admin.create_user",
      subject: created.id,
      detail: { role: created.role, aadhaarOnFile: Boolean(body.aadhaarNumber) },
    });

    res.status(201).json({ user: { ...created, aadhaarOnFile: Boolean(body.aadhaarNumber) } });
  })
);

router.patch(
  "/users/:id",
  validate(z.object({ id: uuid }), "params"),
  validate(
    z.object({
      isActive: z.boolean().optional(),
      designation: safeText(120).optional().nullable(),
      stationOrCourt: safeText(160).optional().nullable(),
      walletAddress: z
        .string()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .optional()
        .nullable(),
      unlock: z.boolean().optional(),
    })
  ),
  asyncRoute(async (req, res) => {
    const body = req.body as any;
    const patch: Record<string, unknown> = {};
    if (body.isActive !== undefined) patch.is_active = body.isActive;
    if (body.designation !== undefined) patch.designation = body.designation;
    if (body.stationOrCourt !== undefined) patch.station_or_court = body.stationOrCourt;
    if (body.walletAddress !== undefined) patch.wallet_address = body.walletAddress;
    if (body.unlock) {
      patch.locked_until = null;
      patch.failed_login_attempts = 0;
    }

    if (Object.keys(patch).length === 0) throw conflict("Nothing to update.");

    const row = unwrap(
      await db.from("users").update(patch).eq("id", req.params.id).select(USER_COLUMNS).single()
    );

    // Deactivating an account must end its live sessions immediately.
    if (body.isActive === false) {
      await db
        .from("sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", req.params.id)
        .is("revoked_at", null);
    }

    await recordAction(req, { action: "admin.update_user", subject: req.params.id, detail: patch });
    res.json({ user: row });
  })
);

/** Attach or replace an Aadhaar token on an existing account. */
router.put(
  "/users/:id/aadhaar",
  validate(z.object({ id: uuid }), "params"),
  validate(
    z.object({
      aadhaarNumber,
      phone: safeText(20).optional().nullable(),
      address: safeText(400).optional().nullable(),
    })
  ),
  asyncRoute(async (req, res) => {
    const target = unwrapMaybe(
      await db.from("users").select("id").eq("id", req.params.id).maybeSingle()
    ) as { id: string } | null;
    if (!target) throw notFound("User");

    const token = aadhaarToken(req.body.aadhaarNumber);

    // The same number must not end up on two accounts.
    const clash = await ownerOfToken(token);
    if (clash && clash !== req.params.id) {
      throw conflict("That Aadhaar number is already registered to another account.");
    }

    await upsertPii({
      userId: req.params.id,
      aadhaarToken: token,
      aadhaarLast4: aadhaarLast4(req.body.aadhaarNumber),
      phoneEncrypted: req.body.phone ? encryptField(req.body.phone) : null,
      addressEncrypted: req.body.address ? encryptField(req.body.address) : null,
    });

    await recordAction(req, { action: "admin.set_aadhaar", subject: req.params.id });
    res.json({ ok: true, aadhaarLast4: aadhaarLast4(req.body.aadhaarNumber) });
  })
);

/** Outbound email attempts. Addresses are masked; bodies are never stored. */
router.get(
  "/email-log",
  validate(pagination.extend({ status: safeText(16).optional() }), "query"),
  asyncRoute(async (req, res) => {
    const { limit, offset, status } = req.query as any;
    let query = db
      .from("email_log")
      .select("id, purpose, masked_to, subject, status, error, occurred_at")
      .order("occurred_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const entries = unwrapList(await query) as any[];
    res.json({
      entries,
      counts: {
        sent: entries.filter((e) => e.status === "sent").length,
        failed: entries.filter((e) => e.status === "failed").length,
        skipped: entries.filter((e) => e.status === "skipped").length,
      },
    });
  })
);

/** Row-level audit trail from the database triggers. */
router.get(
  "/audit/rows",
  validate(pagination.extend({ table: safeText(80).optional() }), "query"),
  asyncRoute(async (req, res) => {
    const { limit, offset, table } = req.query as any;
    let query = db
      .from("audit_log")
      .select("id, table_name, operation, row_pk, actor_id, actor_role, changed_columns, occurred_at")
      .order("occurred_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (table) query = query.eq("table_name", table);
    res.json({ entries: unwrapList(await query) });
  })
);

/** API-level trail, including refused attempts that left no row behind. */
router.get(
  "/audit/actions",
  validate(pagination.extend({ action: safeText(80).optional() }), "query"),
  asyncRoute(async (req, res) => {
    const { limit, offset, action } = req.query as any;
    let query = db
      .from("action_log")
      .select("id, actor_id, actor_role, action, subject, case_id, outcome, detail, occurred_at")
      .order("occurred_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) query = query.eq("action", action);
    res.json({ entries: unwrapList(await query) });
  })
);

router.get(
  "/chain",
  asyncRoute(async (_req, res) => {
    const recent = unwrapList(
      await db
        .from("chain_tx")
        .select("tx_hash, contract, method, status, block_number, gas_used, error, created_at")
        .order("created_at", { ascending: false })
        .limit(50)
    ) as any[];

    const events = unwrapList(
      await db
        .from("chain_events")
        .select("contract, event_name, block_number, tx_hash, args, created_at")
        .order("block_number", { ascending: false })
        .limit(50)
    );

    res.json({
      status: {
        ready: chain.isReady,
        reason: chain.reason,
        network: chain.network,
        keeper: chain.keeperAddress ?? null,
        keeperBalanceWei: await chain.keeperBalance(),
        blockNumber: await chain.blockNumber(),
        addresses: chain.isReady ? chain.addresses : null,
      },
      transactions: recent,
      events,
      counts: {
        pending: recent.filter((t) => t.status === "pending").length,
        failed: recent.filter((t) => t.status === "failed").length,
      },
    });
  })
);

/** Numbers for the admin landing page. */
router.get(
  "/stats",
  asyncRoute(async (_req, res) => {
    const count = async (table: string, filter?: (q: any) => any) => {
      let query = db.from(table).select("*", { count: "exact", head: true });
      if (filter) query = filter(query);
      const { count: n } = await query;
      return n ?? 0;
    };

    const [users, cases, evidence, flagged, summonsPending, summonsFailed, bails, openViolations] =
      await Promise.all([
        count("users", (q) => q.eq("is_active", true)),
        count("cases"),
        count("evidence_items"),
        count("evidence_items", (q) => q.eq("anomaly_flagged", true)),
        count("summons", (q) => q.eq("status", "PENDING")),
        count("summons", (q) => q.eq("status", "FAILED")),
        count("bail_conditions", (q) => q.eq("active", true)),
        count("violations", (q) => q.is("acknowledged_at", null)),
      ]);

    res.json({
      stats: {
        activeUsers: users,
        cases,
        evidenceItems: evidence,
        flaggedEvidence: flagged,
        summonsPending,
        summonsFailed,
        activeBailOrders: bails,
        openViolations,
      },
    });
  })
);

/** Housekeeping: expired sessions and spent OTP challenges. */
router.post(
  "/prune",
  asyncRoute(async (req, res) => {
    const { data, error } = await db.rpc("prune_expired");
    if (error) {
      // The function lives in the app schema, which may not be exposed to
      // PostgREST. Fall back to doing it in two statements.
      const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
      await db.from("sessions").delete().lt("expires_at", cutoff);
      await db
        .from("otp_challenges")
        .delete()
        .lt("expires_at", new Date(Date.now() - 86400_000).toISOString());
      await recordAction(req, { action: "admin.prune", detail: { method: "fallback" } });
      return res.json({ pruned: true, method: "fallback" });
    }

    await recordAction(req, { action: "admin.prune", detail: { method: "rpc" } });
    res.json({ pruned: true, method: "rpc", result: data });
  })
);

export default router;
