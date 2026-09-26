import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { fromSupabase } from "./errors";

/**
 * The single service-role client. It holds the key that bypasses RLS, which is
 * why it lives only here and why nothing in routes/ ever constructs its own.
 *
 * The key must never be shipped to a browser. The frontend talks to this API;
 * it has no Supabase credentials of its own.
 */
export const db: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-nyaysetu-client": "api" } },
  }
);

/**
 * PII lives in the `restricted` schema. For PostgREST to reach it, the schema
 * must be listed under Supabase Settings -> API -> Exposed schemas. See
 * DEPLOYMENT.md; it is the one manual dashboard step.
 */
export const restricted = db.schema("restricted");

/** Throws a typed AppError instead of returning Supabase's shape. */
export function unwrap<T>(result: { data: T | null; error: any }): T {
  if (result.error) throw fromSupabase(result.error);
  if (result.data === null) {
    throw fromSupabase({ message: "Query returned no data.", code: "PGRST116" });
  }
  return result.data;
}

/** For queries where "no row" is a legitimate answer. */
export function unwrapMaybe<T>(result: { data: T | null; error: any }): T | null {
  if (result.error) {
    // maybeSingle() reports "no rows" as an error in some versions; treat it
    // as an empty result rather than a failure.
    if (result.error.code === "PGRST116") return null;
    throw fromSupabase(result.error);
  }
  return result.data;
}

export function unwrapList<T>(result: { data: T[] | null; error: any }): T[] {
  if (result.error) throw fromSupabase(result.error);
  return result.data ?? [];
}

/** Cheap liveness probe for /api/health. */
export async function pingDatabase(): Promise<boolean> {
  const { error } = await db.from("roles").select("role").limit(1);
  return !error;
}
