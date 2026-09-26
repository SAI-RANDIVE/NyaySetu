import { Router } from "express";
import { env, capabilities } from "../config/env";
import { chain } from "../lib/chain";
import { pingDatabase } from "../lib/supabase";
import { health as aiHealth } from "../lib/ai";
import { loginOtpProvider, otpProvider } from "../otp";
import { mailerHealth } from "../lib/mailer";
import { asyncRoute } from "../middleware/error";

const router = Router();

/**
 * Honest health reporting. Every subsystem says whether it is configured and
 * whether it is actually reachable, and the OTP provider says out loud whether
 * it is authorised for production. A demo deployment should never be mistakable
 * for an Aadhaar-verified one.
 */
router.get(
  "/",
  asyncRoute(async (_req, res) => {
    const [database, ai, blockNumber, keeperBalance, mail] = await Promise.all([
      pingDatabase(),
      aiHealth(),
      chain.blockNumber(),
      chain.keeperBalance(),
      mailerHealth(),
    ]);

    const healthy = database;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      version: "1.0.0",
      environment: env.NODE_ENV,
      subsystems: {
        database: { configured: true, reachable: database },
        blockchain: {
          configured: capabilities.chain,
          ready: chain.isReady,
          reason: chain.reason,
          network: chain.network,
          blockNumber,
          keeper: chain.keeperAddress ?? null,
          keeperBalanceWei: keeperBalance,
          addresses: chain.isReady ? chain.addresses : null,
        },
        storage: {
          backend: capabilities.ipfs ? "pinata" : "local-fallback",
          configured: capabilities.ipfs,
          note: capabilities.ipfs
            ? "Encrypted blobs are pinned to IPFS."
            : "Pinata is not configured; encrypted blobs are written to disk. Not for production.",
        },
        ai: {
          configured: capabilities.ai,
          reachable: ai,
          note: ai ? undefined : "Evidence screening and risk scoring will report themselves unavailable.",
        },
        email: {
          configured: mail.configured,
          reachable: mail.reachable,
          host: mail.host,
          from: mail.from,
          error: mail.error,
          note: !mail.configured
            ? "SMTP is not configured. Sign-in is password-only and no notices are sent."
            : mail.reachable
              ? "SMTP verified. Sign-in codes and summons notices are live."
              : "SMTP is configured but the server rejected the credentials. For Gmail, use a 16-character App Password.",
        },
        identity: {
          // Citizen actions: acknowledging a summons, filing a bail check-in.
          citizenChannel: otpProvider.name,
          citizenAuthorisedForProduction: otpProvider.isAuthorisedForProduction,
          // Sign-in second factor.
          loginChannel: loginOtpProvider?.name ?? null,
          loginOtpEnabled: Boolean(loginOtpProvider),
          // Kept for older clients that read these two field names.
          provider: otpProvider.name,
          authorisedForProduction: otpProvider.isAuthorisedForProduction,
          note: [
            otpProvider.isAuthorisedForProduction
              ? "Live UIDAI provider selected for citizen actions."
              : "Citizen actions use the sandbox Aadhaar provider: simulated, not Aadhaar-verified.",
            loginOtpProvider
              ? "Sign-in requires a real emailed code."
              : "Sign-in is password-only.",
          ].join(" "),
        },
      },
    });
  })
);

export default router;
