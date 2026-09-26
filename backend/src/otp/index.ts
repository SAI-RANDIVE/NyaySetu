import { env } from "../config/env";
import { logger } from "../lib/logger";
import { OtpProvider } from "./OtpProvider";
import { SandboxAadhaarProvider } from "./SandboxAadhaarProvider";
import { UidaiOtpProvider } from "./UidaiOtpProvider";

/**
 * Chooses the provider once, at boot, from OTP_PROVIDER.
 *
 * Nothing else in the codebase imports a concrete provider, so replacing the
 * sandbox with a licensed integration touches this file and no other.
 */
function build(): OtpProvider {
  if (env.OTP_PROVIDER === "uidai") return new UidaiOtpProvider();
  return new SandboxAadhaarProvider();
}

export const otpProvider: OtpProvider = build();

if (!otpProvider.isAuthorisedForProduction && env.isProduction) {
  logger.warn(
    "Running in production with the sandbox OTP provider. Identity assertions are NOT Aadhaar-verified."
  );
}

export * from "./OtpProvider";
