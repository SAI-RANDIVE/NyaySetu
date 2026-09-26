/**
 * The Aadhaar OTP seam.
 *
 * ----------------------------------------------------------------------------
 * READ THIS BEFORE SWAPPING IN A REAL PROVIDER
 *
 * Authenticating against the live UIDAI Aadhaar OTP API requires being a
 * licensed AUA/KUA. That licence is granted by UIDAI to government departments
 * and to entities they authorise, under the Aadhaar Act 2016 and the
 * Authentication Regulations. A student project cannot obtain it, and there is
 * no sandbox that issues real OTPs to real Aadhaar holders.
 *
 * NyaySetu therefore ships two implementations of one interface:
 *
 *   SandboxAadhaarProvider  generates and verifies OTPs locally, with the same
 *                           lifecycle the real API has: a 6 digit code, a
 *                           short TTL, a capped attempt count, single use.
 *                           This is what the demo runs on.
 *
 *   UidaiOtpProvider        the real integration. The request and response
 *                           shapes, the endpoints and the licence checks are
 *                           written out. It refuses to run without credentials
 *                           rather than pretending to work.
 *
 * Nothing above this interface knows which one is active. Swapping providers is
 * an environment variable, not a code change, and that is the point: the
 * dependency on government authorisation is isolated to one file.
 * ----------------------------------------------------------------------------
 */

export type OtpPurpose = "login" | "summons_ack" | "bail_checkin";

export interface SendOtpRequest {
  /** Salted hash of the Aadhaar number. The number itself never reaches here. */
  aadhaarToken: string;
  purpose: OtpPurpose;
  /** Summons id, case id, whatever the OTP is about. Binds the code to one action. */
  referenceId?: string | null;
  /** Masked phone or name, for the "code sent to xxxxxx1234" line in the UI. */
  destinationHint?: string | null;
}

export interface OtpDispatch {
  challengeId: string;
  expiresAt: string;
  maskedDestination: string;
  /**
   * Present only for the sandbox provider, and only when
   * OTP_ECHO_IN_RESPONSE is on and NODE_ENV is not production. It is what lets
   * the demo run without an SMS gateway.
   */
  otp?: string;
}

export interface VerifyOtpRequest {
  challengeId: string;
  otp: string;
  aadhaarToken: string;
  purpose: OtpPurpose;
  referenceId?: string | null;
}

export interface VerifyOtpResult {
  verified: boolean;
  /** Machine-readable failure cause, for the UI and the rate limiter. */
  reason?: "expired" | "consumed" | "attempts_exhausted" | "mismatch" | "not_found" | "scope_mismatch";
  attemptsRemaining?: number;
}

export interface OtpProvider {
  readonly name: string;
  /**
   * False for the sandbox. The health endpoint surfaces this so nobody can
   * mistake a demo deployment for an authenticated one.
   */
  readonly isAuthorisedForProduction: boolean;

  sendOtp(request: SendOtpRequest): Promise<OtpDispatch>;
  verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResult>;
}
