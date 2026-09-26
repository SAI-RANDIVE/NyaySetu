import * as crypto from "crypto";
import { keccak256, toUtf8Bytes } from "ethers";
import { env } from "../config/env";
import { badRequest } from "./errors";

/**
 * Every cryptographic primitive the system uses, in one file, so the rules
 * about what is hashed, what is encrypted and what is never stored are
 * auditable in one read.
 *
 * Conventions:
 *   - every digest crosses a boundary as "0x" + 64 lowercase hex, which is both
 *     what bytes32 expects and what the hash32 database domain enforces
 *   - Aadhaar numbers are HMAC'd with a server-side pepper and discarded. There
 *     is no function here that stores or returns one
 */

const AES_ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bit nonce, the GCM standard
const encryptionKey = Buffer.from(env.EVIDENCE_ENCRYPTION_KEY, "hex");

export const HASH32_PATTERN = /^0x[0-9a-f]{64}$/;

export function isHash32(value: unknown): value is string {
  return typeof value === "string" && HASH32_PATTERN.test(value);
}

export function assertHash32(value: unknown, label: string): string {
  if (!isHash32(value)) {
    throw badRequest(`${label} must be a 0x-prefixed lowercase SHA-256 digest.`);
  }
  return value;
}

/** SHA-256 of raw bytes. The canonical evidence digest. */
export function sha256Hex(data: Buffer | Uint8Array | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  return "0x" + crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * keccak256 of a UTF-8 string. Used for identifiers that must match a
 * contract constant or a caseId derived from an FIR number.
 */
export function keccakOfString(value: string): string {
  return keccak256(toUtf8Bytes(value));
}

/** The bytes32 caseId every contract uses for this FIR. */
export function caseIdHash(firNumber: string): string {
  return keccakOfString(firNumber.trim().toUpperCase());
}

/**
 * Turns an Aadhaar number into the opaque token the rest of the system uses.
 *
 * HMAC rather than a plain hash: a bare SHA-256 of a 12 digit number is
 * brute-forceable in seconds, so the pepper is what makes the token
 * non-reversible for anyone who steals only the database.
 *
 * The plaintext number is never returned, stored or logged by anything here.
 */
export function aadhaarToken(aadhaarNumber: string): string {
  const digits = aadhaarNumber.replace(/[^0-9]/g, "");
  if (digits.length !== 12) {
    throw badRequest("Aadhaar number must be 12 digits.");
  }
  if (!verhoeffValid(digits)) {
    throw badRequest("That Aadhaar number fails its checksum.");
  }
  const mac = crypto.createHmac("sha256", env.AADHAAR_TOKEN_PEPPER).update(digits).digest("hex");
  return "0x" + mac;
}

/** Last four digits, for display only. Never the full number. */
export function aadhaarLast4(aadhaarNumber: string): string {
  const digits = aadhaarNumber.replace(/[^0-9]/g, "");
  return digits.slice(-4);
}

// Verhoeff tables: dihedral group D5 multiplication, the permutation, and the
// inverse used to derive a check digit.
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function verhoeffChecksum(digits: string): number {
  let c = 0;
  const reversed = digits.split("").reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][reversed[i]]];
  }
  return c;
}

/**
 * UIDAI numbers carry a Verhoeff check digit. Validating it locally rejects
 * typos before they reach an OTP provider, and makes the sandbox behave like
 * the real thing.
 */
export function verhoeffValid(digits: string): boolean {
  if (!/^[0-9]{12}$/.test(digits)) return false;
  return verhoeffChecksum(digits) === 0;
}

/**
 * Check digit for an 11 digit prefix. Only the seed script needs this: it
 * produces synthetic Aadhaar numbers that pass the same validation a real one
 * would, so no test path has to bypass the checksum.
 */
export function verhoeffCheckDigit(prefix11: string): string {
  if (!/^[0-9]{11}$/.test(prefix11)) {
    throw new Error("verhoeffCheckDigit expects exactly 11 digits.");
  }
  return String(VERHOEFF_INV[verhoeffChecksum(prefix11 + "0")]);
}

// ---------------------------------------------------------------- AES-256-GCM

export interface EncryptedBlob {
  ciphertext: Buffer;
  iv: string;
  tag: string;
  keyId: string;
}

/**
 * Encrypts an evidence file before it leaves the process. GCM rather than CBC
 * so the auth tag detects a modified ciphertext: an IPFS pin is public, and a
 * pinning service could in principle serve back different bytes.
 */
export function encryptBuffer(plaintext: Buffer): EncryptedBlob {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    keyId: env.EVIDENCE_ENCRYPTION_KEY_ID,
  };
}

export function decryptBuffer(ciphertext: Buffer, iv: string, tag: string): Buffer {
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, encryptionKey, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Encrypts a short string, such as a phone number, into one storable field. */
export function encryptField(value: string): string {
  const blob = encryptBuffer(Buffer.from(value, "utf8"));
  return [blob.keyId, blob.iv, blob.tag, blob.ciphertext.toString("base64")].join(":");
}

export function decryptField(packed: string): string {
  const [, iv, tag, payload] = packed.split(":");
  if (!iv || !tag || payload === undefined) {
    throw new Error("Malformed encrypted field.");
  }
  return decryptBuffer(Buffer.from(payload, "base64"), iv, tag).toString("utf8");
}

// ------------------------------------------------------------------- tokens

/** URL-safe random token for session cookies and CSRF values. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** What goes in the sessions table. The cookie value itself is never stored. */
export function hashSessionToken(token: string): string {
  return "0x" + crypto.createHash("sha256").update(token).digest("hex");
}

/** Six digit OTP from a CSPRNG, not Math.random. */
export function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** OTPs are stored as a keyed digest scoped to the challenge they belong to. */
export function hashOtp(otp: string, scope: string): string {
  return (
    "0x" +
    crypto.createHmac("sha256", env.AADHAAR_TOKEN_PEPPER).update(`${scope}|${otp}`).digest("hex")
  );
}

/** Constant-time comparison for anything secret. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Stable digest of an arbitrary object. Keys are sorted so the same logical
 * payload always hashes identically, which is what lets an AI verdict be
 * anchored on-chain and re-derived later.
 */
export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalise(value));
}

export function canonicalise(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`);
  return `{${entries.join(",")}}`;
}

/** Stable per-device identifier for a summons acknowledgement. */
export function deviceFingerprint(parts: {
  userAgent?: string;
  platform?: string;
  deviceId?: string;
}): string {
  return sha256Hex(
    canonicalise({
      userAgent: parts.userAgent ?? "",
      platform: parts.platform ?? "",
      deviceId: parts.deviceId ?? "",
    })
  );
}
