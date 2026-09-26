import { env } from "../config/env";
import { db, unwrap, unwrapMaybe } from "../lib/supabase";
import { generateOtp, hashOtp, safeEqual } from "../lib/crypto";
import { logger } from "../lib/logger";
import { badRequest } from "../lib/errors";
import {
  OtpDispatch,
  OtpProvider,
  SendOtpRequest,
  VerifyOtpRequest,
  VerifyOtpResult,
} from "./OtpProvider";

/**
 * Local OTP provider with the same lifecycle rules as the UIDAI API:
 *   - a 6 digit code from a CSPRNG
 *   - a short TTL (OTP_TTL_SECONDS, default 300)
 *   - a hard attempt cap, after which the challenge is dead
 *   - single use: verifying consumes it
 *   - bound to one purpose and one reference id, so a code issued for a bail
 *     check-in cannot be replayed against a summons acknowledgement
 *
 * Only the HMAC of the code is stored. A database dump does not yield live
 * OTPs, which matters because the same table is readable by the audit trail.
 */
export class SandboxAadhaarProvider implements OtpProvider {
  readonly name = "sandbox-aadhaar";
  readonly isAuthorisedForProduction = false;

  async sendOtp(request: SendOtpRequest): Promise<OtpDispatch> {
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000).toISOString();

    // Invalidate any earlier live challenge for the same action, so a user who
    // taps "resend" cannot hold several valid codes at once.
    await db
      .from("otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("aadhaar_token", request.aadhaarToken)
      .eq("purpose", request.purpose)
      .is("consumed_at", null);

    const scope = this.scopeFor(request.aadhaarToken, request.purpose, request.referenceId);

    const row = unwrap(
      await db
        .from("otp_challenges")
        .insert({
          purpose: request.purpose,
          aadhaar_token: request.aadhaarToken,
          reference_id: request.referenceId ?? null,
          otp_hash: hashOtp(otp, scope),
          max_attempts: env.OTP_MAX_ATTEMPTS,
          expires_at: expiresAt,
        })
        .select("id")
        .single()
    ) as { id: string };

    // The code goes to the log only outside production, and only because there
    // is no SMS gateway in a demo.
    if (!env.isProduction) {
      logger.debug("Sandbox OTP issued", {
        challengeId: row.id,
        purpose: request.purpose,
        reference: request.referenceId,
      });
    }

    return {
      challengeId: row.id,
      expiresAt,
      maskedDestination: request.destinationHint ?? "registered mobile ending ****",
      ...(env.otpEcho ? { otp } : {}),
    };
  }

  async verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResult> {
    if (!/^[0-9]{6}$/.test(request.otp)) {
      throw badRequest("The OTP must be six digits.");
    }

    const challenge = unwrapMaybe(
      await db
        .from("otp_challenges")
        .select("id, purpose, aadhaar_token, reference_id, otp_hash, attempts, max_attempts, expires_at, consumed_at")
        .eq("id", request.challengeId)
        .maybeSingle()
    ) as
      | {
          id: string;
          purpose: string;
          aadhaar_token: string;
          reference_id: string | null;
          otp_hash: string;
          attempts: number;
          max_attempts: number;
          expires_at: string;
          consumed_at: string | null;
        }
      | null;

    if (!challenge) return { verified: false, reason: "not_found" };
    if (challenge.consumed_at) return { verified: false, reason: "consumed" };
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      return { verified: false, reason: "expired" };
    }
    if (challenge.attempts >= challenge.max_attempts) {
      return { verified: false, reason: "attempts_exhausted", attemptsRemaining: 0 };
    }

    // A code is valid for exactly the action it was issued for.
    if (
      challenge.aadhaar_token !== request.aadhaarToken ||
      challenge.purpose !== request.purpose ||
      (challenge.reference_id ?? null) !== (request.referenceId ?? null)
    ) {
      return { verified: false, reason: "scope_mismatch" };
    }

    const scope = this.scopeFor(challenge.aadhaar_token, request.purpose, challenge.reference_id);
    const matches = safeEqual(hashOtp(request.otp, scope), challenge.otp_hash);

    if (!matches) {
      const attempts = challenge.attempts + 1;
      await db.from("otp_challenges").update({ attempts }).eq("id", challenge.id);
      return {
        verified: false,
        reason: attempts >= challenge.max_attempts ? "attempts_exhausted" : "mismatch",
        attemptsRemaining: Math.max(0, challenge.max_attempts - attempts),
      };
    }

    await db
      .from("otp_challenges")
      .update({ consumed_at: new Date().toISOString(), attempts: challenge.attempts + 1 })
      .eq("id", challenge.id);

    return { verified: true };
  }

  /** Binds the stored digest to the action, so a code cannot be replayed elsewhere. */
  private scopeFor(aadhaarToken: string, purpose: string, referenceId?: string | null): string {
    return `${aadhaarToken}|${purpose}|${referenceId ?? ""}`;
  }
}
