/**
 * One error type for everything the client is allowed to know about, and a
 * default of "500, details in the log" for everything else. That split is what
 * stops a Postgres constraint name or a contract revert reason leaking into a
 * response body.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = status < 500;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "BAD_REQUEST", message, details);

export const unauthorised = (message = "Sign in to continue.") =>
  new AppError(401, "UNAUTHORISED", message);

export const forbidden = (message = "Your role does not permit this action.") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (what = "Resource") =>
  new AppError(404, "NOT_FOUND", `${what} not found.`);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, "CONFLICT", message, details);

export const tooMany = (message = "Too many attempts. Try again shortly.") =>
  new AppError(429, "RATE_LIMITED", message);

export const unavailable = (message: string) =>
  new AppError(503, "UNAVAILABLE", message);

/** Wraps a Supabase error object into something with a status code. */
export function fromSupabase(error: { message: string; code?: string; details?: string }): AppError {
  // P0001 is a deliberate RAISE from one of our own triggers, and its message
  // was written to be read by a person, so it is the one case where the database
  // text is passed through rather than replaced.
  if (error.code === "P0001") return conflict(error.message);
  // 23505 unique_violation, 23503 foreign_key_violation, 23514 check_violation
  if (error.code === "23505") return conflict("That record already exists.", error.details);
  if (error.code === "23503") return badRequest("Referenced record does not exist.", error.details);
  if (error.code === "23514") return badRequest("A value failed a database constraint.", error.details);
  if (error.code === "PGRST116") return notFound("Record");
  return new AppError(500, "DB_ERROR", error.message, error.details);
}
