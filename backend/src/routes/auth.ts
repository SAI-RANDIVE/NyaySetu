import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env";
import { db, unwrapMaybe } from "../lib/supabase";
import { badRequest, unauthorised } from "../lib/errors";
import { logger } from "../lib/logger";
import { asyncRoute } from "../middleware/error";
import { validate, safeText } from "../middleware/validate";
import { authLimiter } from "../middleware/rateLimit";
import { createSession, destroySession, requireAuth } from "../middleware/auth";
import { recordAction } from "../services/audit";

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

/**
 * Sign in.
 *
 * Failure is deliberately uniform: a wrong password and an unknown address
 * return the same message, so the endpoint is not an account enumerator. A
 * dummy bcrypt comparison runs for unknown addresses so the response time does
 * not give the answer away either.
 */
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncRoute(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = unwrapMaybe(
      await db
        .from("users")
        .select(
          "id, email, password_hash, full_name, role, designation, station_or_court, theme, is_active, failed_login_attempts, locked_until"
        )
        .ilike("email", email)
        .maybeSingle()
    ) as any;

    if (!user) {
      // Constant-ish work for an unknown address.
      await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");
      throw unauthorised("That email address and password do not match.");
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const minutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60_000);
      throw unauthorised(`This account is locked for another ${minutes} minute(s) after repeated failures.`);
    }

    if (!user.is_active) {
      throw unauthorised("This account has been deactivated. Contact the court administrator.");
    }

    const matches = await bcrypt.compare(password, user.password_hash);

    if (!matches) {
      const attempts = (user.failed_login_attempts ?? 0) + 1;
      const shouldLock = attempts >= env.LOGIN_LOCKOUT_ATTEMPTS;

      await db
        .from("users")
        .update({
          failed_login_attempts: attempts,
          locked_until: shouldLock
            ? new Date(Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60_000).toISOString()
            : null,
        })
        .eq("id", user.id);

      logger.warn("Failed sign-in", { userId: user.id, attempts, locked: shouldLock });

      throw unauthorised(
        shouldLock
          ? `Too many failed attempts. This account is locked for ${env.LOGIN_LOCKOUT_MINUTES} minutes.`
          : "That email address and password do not match."
      );
    }

    await db
      .from("users")
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    const { csrfToken } = await createSession(res, user.id, {
      userAgent: req.get("user-agent") ?? undefined,
      ip: req.ip,
    });

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      designation: user.designation,
      stationOrCourt: user.station_or_court,
      theme: user.theme,
      aadhaarToken: null,
    };
    await recordAction(req, { action: "auth.login" });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        designation: user.designation,
        stationOrCourt: user.station_or_court,
        theme: user.theme,
      },
      csrfToken,
      expiresInHours: env.SESSION_TTL_HOURS,
    });
  })
);

router.post(
  "/logout",
  asyncRoute(async (req, res) => {
    if (req.user) await recordAction(req, { action: "auth.logout" });
    await destroySession(res, req.sessionId);
    res.json({ ok: true });
  })
);

/** Who am I. The SPA calls this on boot to restore a session. */
router.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        designation: user.designation,
        stationOrCourt: user.stationOrCourt,
        theme: user.theme,
        hasAadhaarToken: Boolean(user.aadhaarToken),
      },
      csrfToken: req.csrfToken,
    });
  })
);

/** Theme is a server-side preference, so it follows the user across devices. */
router.patch(
  "/me/theme",
  requireAuth,
  validate(z.object({ theme: z.enum(["dark", "light"]) })),
  asyncRoute(async (req, res) => {
    await db.from("users").update({ theme: req.body.theme }).eq("id", req.user!.id);
    res.json({ theme: req.body.theme });
  })
);

router.post(
  "/change-password",
  requireAuth,
  authLimiter,
  validate(
    z.object({
      currentPassword: z.string().min(8).max(200),
      newPassword: z
        .string()
        .min(12, "Use at least 12 characters.")
        .max(200)
        .regex(/[a-z]/, "Include a lowercase letter.")
        .regex(/[A-Z]/, "Include an uppercase letter.")
        .regex(/[0-9]/, "Include a digit."),
    })
  ),
  asyncRoute(async (req, res) => {
    const row = unwrapMaybe(
      await db.from("users").select("password_hash").eq("id", req.user!.id).maybeSingle()
    ) as { password_hash: string } | null;
    if (!row) throw unauthorised();

    if (!(await bcrypt.compare(req.body.currentPassword, row.password_hash))) {
      throw badRequest("Your current password is not correct.");
    }

    const hash = await bcrypt.hash(req.body.newPassword, 12);
    await db.from("users").update({ password_hash: hash }).eq("id", req.user!.id);

    // A password change invalidates every other session for this user.
    await db
      .from("sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", req.user!.id)
      .neq("id", req.sessionId ?? "")
      .is("revoked_at", null);

    await recordAction(req, { action: "auth.change_password" });
    res.json({ ok: true, otherSessionsRevoked: true });
  })
);

/** Reference data for the sign-in screen and role badges. */
router.get(
  "/roles",
  asyncRoute(async (_req, res) => {
    const { data } = await db.from("roles").select("role, label, description, portal_path").order("role");
    res.json({ roles: data ?? [] });
  })
);

export default router;
