/**
 * The only place the app talks to the network.
 *
 * Three things it guarantees, so no component has to remember them:
 *   1. credentials: "include", because auth is an HttpOnly cookie
 *   2. the X-CSRF-Token header on every mutating request, read from the
 *      double-submit cookie
 *   3. a typed ApiError with the server's code and message, so a UI can say
 *      "the hash did not match" instead of "request failed"
 */

const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
const CSRF_COOKIE = "nyaysetu_csrf";

/**
 * Where requests are actually going, for the diagnostics below.
 *
 * Blank BASE is correct in development, where Vite proxies /api to the API, and
 * is almost always a mistake in a deployed build: the request then goes to the
 * static host, which answers a rewrite rule with index.html, and the app gets
 * HTML where it expected JSON.
 */
export const apiOrigin = BASE || window.location.origin;
export const apiBaseConfigured = BASE !== "";
export const isDeployedBuild = import.meta.env.PROD;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuth() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  /** True when the blockchain, IPFS or the model service is not configured. */
  get isUnavailable() {
    return this.status === 503;
  }

  /**
   * True when the API was not reachable at all, as opposed to reaching it and
   * being refused. These are the two cases that look identical to a user and
   * have completely different causes, so they are separated here rather than in
   * every component.
   */
  get isUnreachable() {
    return this.status === 0 || this.code === "NETWORK" || this.code === "BAD_RESPONSE";
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface Options {
  method?: Method;
  body?: unknown;
  /** FormData bypasses JSON encoding so the browser sets the multipart boundary. */
  form?: FormData;
  signal?: AbortSignal;
  /** Set for endpoints that stream a file rather than JSON. */
  raw?: boolean;
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};

  if (method !== "GET") {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers["x-csrf-token"] = csrf;
  }
  if (options.body !== undefined && !options.form) {
    headers["content-type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      signal: options.signal,
      body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
  } catch (caught) {
    // fetch rejects for a blocked CORS response, a DNS failure, a refused
    // connection and an offline browser, and gives the same opaque TypeError for
    // all of them by design. So the message says what to check rather than
    // pretending to know which one it was.
    if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
    throw new ApiError(0, "NETWORK", networkFailureMessage());
  }

  if (options.raw) {
    if (!response.ok) throw await toError(response);
    return response as unknown as T;
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // HTML where JSON was expected has one overwhelmingly likely cause: the
    // request went to the static host instead of the API, and a catch-all rewrite
    // answered it with index.html. Saying so is worth more than the first 200
    // characters of a document.
    const looksLikeHtml = /^\s*<(!doctype|html)/i.test(text);
    payload = {
      error: {
        code: "BAD_RESPONSE",
        message: looksLikeHtml ? htmlInsteadOfJsonMessage() : text.slice(0, 200),
      },
    };
  }

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(
      response.status,
      error.code ?? "UNKNOWN",
      error.message ?? `Request failed with ${response.status}.`,
      error.details
    );
  }

  return payload as T;
}

/** Why a request never reached the API, in the order worth checking. */
function networkFailureMessage(): string {
  if (isDeployedBuild && !apiBaseConfigured) {
    return (
      "This build has no API address, so requests are going to the site itself. " +
      "Set VITE_API_BASE to the API's URL in the hosting dashboard and redeploy."
    );
  }
  if (isDeployedBuild) {
    return (
      `Could not reach the NyaySetu API at ${apiOrigin}. Either it is asleep or down, ` +
      "or its CORS_ORIGINS does not list this site's address — a cross-origin " +
      "request is blocked before it reaches a route, which looks identical to the " +
      "API being offline."
    );
  }
  return "Could not reach the NyaySetu API. Check that the backend is running on port 4000.";
}

function htmlInsteadOfJsonMessage(): string {
  return apiBaseConfigured
    ? `${apiOrigin} answered with a web page instead of data. That address is serving a site, not the NyaySetu API.`
    : "The API address is not set, so requests are hitting this site and getting its HTML back. Set VITE_API_BASE to the API's URL and redeploy.";
}

async function toError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text);
    return new ApiError(
      response.status,
      parsed?.error?.code ?? "UNKNOWN",
      parsed?.error?.message ?? "Request failed.",
      parsed?.error?.details
    );
  } catch {
    return new ApiError(response.status, "UNKNOWN", text.slice(0, 200) || "Request failed.");
  }
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", form }),
  download: (path: string) => request<Response>(path, { raw: true }),
};

/* ------------------------------------------------------------------ types */

export type Role =
  | "police"
  | "forensic_lab"
  | "prosecutor"
  | "judge"
  | "defence_lawyer"
  | "accused"
  | "court_admin";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  designation: string | null;
  stationOrCourt: string | null;
  theme: "dark" | "light";
  hasAadhaarToken?: boolean;
  /**
   * True while the account still holds the temporary password from its
   * invitation. The API refuses every route except changing it, so the router
   * sends these users to /first-run and nowhere else.
   */
  mustChangePassword?: boolean;
}

export type Stage = "SCENE" | "FORENSIC_LAB" | "PROSECUTOR" | "COURT";
export type SummonsStatus = "PENDING" | "DELIVERED" | "FAILED";

export interface CaseRow {
  id: string;
  fir_number: string;
  case_id_hash: string;
  title: string;
  offence_type: string;
  sections: string[];
  police_station: string;
  court_name: string | null;
  status: string;
  registered_at: string;
  summary?: string | null;
  access?: "read" | "write";
}

export interface EvidenceRow {
  id: string;
  case_id: string;
  chain_evidence_id: number | null;
  file_hash: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
  current_stage: Stage;
  collected_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
  anomaly_flagged: boolean;
  anomaly_score: number | null;
  anomaly_reasons: string[];
  anomaly_flag_hash: string | null;
  forensic_report_hash: string | null;
  mismatch_count: number;
  registration_tx_hash: string | null;
  notes?: string | null;
  cases?: { fir_number: string; title: string };
}

export interface CustodyEventRow {
  id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  confirmed_hash: string;
  actor_role: Role | null;
  occurred_at: string;
  tx_hash: string | null;
  block_number: number | null;
}

export interface SummonsRow {
  id: string;
  case_id: string;
  chain_summons_id: number | null;
  recipient_name: string;
  status: SummonsStatus;
  issued_at: string;
  expiry_at: string;
  delivered_at: string | null;
  hearing_at: string | null;
  document_hash: string;
  document_body?: string;
  issue_tx_hash?: string | null;
  ack_tx_hash?: string | null;
  non_delivery_alerted_at?: string | null;
  effectiveStatus?: SummonsStatus;
  hoursRemaining?: number;
  cases?: { fir_number: string; title: string; court_name?: string | null };
}

export interface ComplianceLive {
  score: number;
  flags: boolean[];
  overdue: boolean;
  secondsUntilNextCheckIn: number;
}

export interface BailRow {
  id: string;
  case_id: string;
  accused_name: string;
  conditions: string[];
  condition_tags: string[];
  centre_lat: number | null;
  centre_lng: number | null;
  radius_metres: number;
  checkin_interval_seconds: number;
  expiry_at: string;
  active: boolean;
  compliance_score: number | null;
  risk_band: "LOW" | "MEDIUM" | "HIGH" | null;
  risk_score: number | null;
  order_text?: string | null;
  surety_name?: string | null;
  live?: ComplianceLive | null;
  openViolations?: number;
  state?: "compliant" | "breach" | "unknown";
  cases?: { fir_number: string; title?: string; case_id_hash?: string };
}

export interface ViolationRow {
  id: string;
  kind: string;
  reason: string;
  detected_at: string;
  acknowledged_at: string | null;
  tx_hash: string | null;
}

export interface CheckInRow {
  id: string;
  gps_lat?: number;
  gps_lng?: number;
  distance_metres: number | null;
  within_fence: boolean;
  occurred_at: string;
  tx_hash: string | null;
}

export interface OtpDispatch {
  challengeId: string;
  expiresAt: string;
  maskedDestination: string;
  /** Sandbox provider only, so the demo needs no SMS gateway. */
  otp?: string;
}

export interface ChainInfo {
  txHash: string;
  blockNumber?: number;
  explorer: string | null;
}

export interface HealthResponse {
  status: string;
  environment: string;
  subsystems: {
    database: { reachable: boolean };
    blockchain: {
      configured: boolean;
      ready: boolean;
      reason: string;
      network: { name: string; chainId: number } | null;
      blockNumber: number | null;
      keeper: string | null;
      keeperBalanceWei: string | null;
      addresses: Record<string, string | undefined> | null;
    };
    storage: { backend: string; configured: boolean; note?: string };
    ai: { configured: boolean; reachable: boolean; note?: string };
    identity: { provider: string; authorisedForProduction: boolean; note?: string };
  };
}
