import { env } from "../config/env";

/**
 * OpenAPI 3.1 description of the v1 integration API, served at
 * /api/v1/openapi.json. Kept beside the routes so the two change together.
 */
export function openApiDocument() {
  const error = { $ref: "#/components/schemas/Error" };
  const json = (schema: unknown) => ({ "application/json": { schema } });
  const digest = { type: "string", pattern: "^0x[0-9a-f]{64}$", description: "SHA-256, 0x-prefixed lowercase hex" };
  const ref = { name: "ref", in: "path", required: true, schema: { type: "string" }, description: "Public evidence reference, e.g. NSE-…" };
  const errors = {
    "400": { description: "Malformed request", content: json(error) },
    "404": { description: "Unknown reference", content: json(error) },
    "429": { description: "Rate limited", content: json(error) },
    "503": { description: "The ledger cannot be read right now; nothing was compared", content: json(error) },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "NyaySetu integration API",
      version: "1.0.0",
      description:
        "Verify evidence, custody and documents produced by NyaySetu. Public endpoints disclose only what the public Integrity Passport discloses. " +
        "Protected endpoints require a NyaySetu session and assignment to the case. No external government system is connected; this is the interface one would use.",
    },
    servers: [{ url: `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/api/v1` }],
    components: {
      securitySchemes: { session: { type: "apiKey", in: "cookie", name: env.SESSION_COOKIE_NAME } },
      schemas: {
        Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code", "message"] } } },
        FileCheck: {
          type: "object",
          properties: {
            matched: { type: "boolean" },
            comparedAgainst: { const: "chain" },
            anchorMode: { enum: ["file", "manifest"] },
            fileMatchesRecordedManifest: { type: ["boolean", "null"] },
            explanation: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/evidence/{ref}": {
        get: { summary: "Public passport of an item", parameters: [ref], responses: { "200": { description: "Passport" }, ...errors } },
      },
      "/evidence/{ref}/custody": {
        get: { summary: "Custody stages of an item", parameters: [ref], responses: { "200": { description: "Custody status" }, ...errors } },
      },
      "/verify": {
        post: {
          summary: "Verify a file by its SHA-256, with or without a reference",
          requestBody: { required: true, content: json({ type: "object", required: ["sha256"], properties: { sha256: digest, reference: { type: "string" } } }) },
          responses: {
            "200": {
              description: "found=false, or found=true with the reference and the chain comparison",
              content: json({ type: "object", properties: { found: { type: "boolean" }, reference: { type: "string" }, result: { $ref: "#/components/schemas/FileCheck" } } }),
            },
            ...errors,
          },
        },
      },
      "/documents/verify": {
        post: {
          summary: "Verify a Section 63 certificate or approved final report by the SHA-256 of its PDF",
          requestBody: { required: true, content: json({ type: "object", required: ["sha256"], properties: { sha256: digest } }) },
          responses: { "200": { description: "Whether NyaySetu produced this exact document, its kind and state" }, ...errors },
        },
      },
      "/cases/{caseId}/evidence": {
        get: {
          summary: "Evidence metadata of a case (assigned parties only)",
          security: [{ session: [] }],
          parameters: [{ name: "caseId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Evidence metadata" }, "401": { description: "No session", content: json(error) }, "403": { description: "Not assigned", content: json(error) } },
        },
      },
      "/evidence/{ref}/audit": {
        get: {
          summary: "Audit history of an item (assigned parties only)",
          security: [{ session: [] }],
          parameters: [ref],
          responses: { "200": { description: "Audit entries" }, "401": { description: "No session", content: json(error) }, "403": { description: "Not assigned", content: json(error) } },
        },
      },
    },
  };
}
