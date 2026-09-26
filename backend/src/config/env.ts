import * as dotenv from "dotenv";
import * as path from "path";
import { z } from "zod";

dotenv.config();

/**
 * Environment contract for the API.
 *
 * Three tiers:
 *   - required: the process refuses to start without them
 *   - optional-with-degradation: the feature reports itself unavailable
 *     (chain, IPFS, AI) instead of crashing, so a partially configured clone
 *     still boots and tells you what is missing
 *   - defaulted: sensible values so a local run needs almost no setup
 */

const hex32 = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters (32 bytes)");

/**
 * An optional setting that is ABSENT when the variable is present but blank.
 *
 * This matters more than it looks. A committed .env.example lists every
 * optional key with an empty value, so a copied .env hands this schema
 * EVIDENCE_CHAIN_ADDRESS="" rather than undefined. Plain `.optional()` accepts
 * that, and "" then survives a `?? fallback` because it is neither null nor
 * undefined -- which is how an empty string ends up being passed to ethers as a
 * contract address. Normalising blanks to undefined here fixes the whole class
 * of that bug in one place.
 */
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional()
);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  // Comma-separated list. Credentials are sent with requests, so this can
  // never be "*".
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:4173"),

  // ---------------------------------------------------------------- database
  SUPABASE_URL: z.string().url("set SUPABASE_URL to your project URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "set SUPABASE_SERVICE_ROLE_KEY"),

  // ---------------------------------------------------------------- sessions
  SESSION_COOKIE_NAME: z.string().default("nyaysetu_session"),
  CSRF_COOKIE_NAME: z.string().default("nyaysetu_csrf"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(8),
  // "none" is required when the API and the SPA sit on different sites; it
  // demands Secure, so it only works over HTTPS.
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("strict"),
  COOKIE_DOMAIN: optionalString,

  // ------------------------------------------------------------------ crypto
  // HMAC pepper for Aadhaar tokenisation. Changing it invalidates every stored
  // token, so it belongs in a secrets manager, not in a migration.
  AADHAAR_TOKEN_PEPPER: z.string().min(32, "AADHAAR_TOKEN_PEPPER must be >= 32 chars"),
  // AES-256-GCM key for evidence files. 64 hex characters.
  EVIDENCE_ENCRYPTION_KEY: hex32,
  EVIDENCE_ENCRYPTION_KEY_ID: z.string().default("v1"),

  // ------------------------------------------------------------------- chain
  CHAIN_RPC_URL: optionalString,
  // The keeper wallet that relays citizen actions. Testnet key only.
  CHAIN_PRIVATE_KEY: optionalString,
  CHAIN_NETWORK: z.string().default("localhost"),
  // Path to the file contracts/scripts/deploy.ts wrote. Carries addresses + ABIs.
  DEPLOYED_ARTIFACT: optionalString,
  EVIDENCE_CHAIN_ADDRESS: optionalString,
  SUMMONS_CHAIN_ADDRESS: optionalString,
  BAIL_CHAIN_ADDRESS: optionalString,
  CHAIN_CONFIRMATIONS: z.coerce.number().int().min(1).default(1),

  // -------------------------------------------------------------------- IPFS
  PINATA_JWT: optionalString,
  PINATA_API_KEY: optionalString,
  PINATA_API_SECRET: optionalString,
  PINATA_GATEWAY: z.string().default("https://gateway.pinata.cloud"),
  // Where encrypted blobs go when Pinata is not configured. Keeps the demo
  // runnable offline; never use in production.
  LOCAL_BLOB_DIR: z.string().default("storage/blobs"),

  // ---------------------------------------------------------------------- AI
  AI_SERVICE_URL: optionalString,
  AI_SERVICE_KEY: optionalString,
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),

  // --------------------------------------------------------------------- OTP
  OTP_PROVIDER: z.enum(["sandbox", "uidai"]).default("sandbox"),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  // Sandbox only: echo the OTP in the API response so a demo needs no SMS.
  // Refuses to take effect when NODE_ENV=production.
  OTP_ECHO_IN_RESPONSE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  UIDAI_BASE_URL: optionalString,
  UIDAI_CLIENT_ID: optionalString,
  UIDAI_CLIENT_SECRET: optionalString,
  UIDAI_AUA_CODE: optionalString,

  // ------------------------------------------------------------------- jobs
  // 72 hours, per the specification.
  SUMMONS_WINDOW_HOURS: z.coerce.number().int().positive().default(72),
  SWEEP_INTERVAL_MS: z.coerce.number().int().min(10_000).default(120_000),
  INDEXER_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  SCHEDULER_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),

  // ------------------------------------------------------------ rate limits
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  OTP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
  console.error(
    [
      "",
      "NyaySetu API cannot start: the environment is incomplete.",
      "",
      ...lines,
      "",
      "Copy backend/.env.example to backend/.env and fill in the values.",
      "Generate the two secrets with:",
      "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const raw = parsed.data;

const corsOrigins = raw.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// A sandbox OTP that prints itself is a demo convenience and a production hole.
const otpEcho = raw.NODE_ENV === "production" ? false : raw.OTP_ECHO_IN_RESPONSE;

export const env = {
  ...raw,
  corsOrigins,
  otpEcho,
  isProduction: raw.NODE_ENV === "production",
  cookieSecure: raw.NODE_ENV === "production" || raw.COOKIE_SAMESITE === "none",
  localBlobDir: path.resolve(process.cwd(), raw.LOCAL_BLOB_DIR),
};

export type Env = typeof env;

/** What is wired up, for /api/health and the admin dashboard. */
export const capabilities = {
  chain: Boolean(raw.CHAIN_RPC_URL && raw.CHAIN_PRIVATE_KEY),
  ipfs: Boolean(raw.PINATA_JWT || (raw.PINATA_API_KEY && raw.PINATA_API_SECRET)),
  ai: Boolean(raw.AI_SERVICE_URL),
  otpProvider: raw.OTP_PROVIDER,
};
