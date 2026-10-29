#!/usr/bin/env node
/**
 * SANDBOX ADAPTER — how another agency's system would call NyaySetu.
 *
 * This is a demonstration client, not an official integration with any
 * government system. It does what a records system, a court case system or a
 * laboratory system would do: hash a file locally, ask NyaySetu's v1 API
 * whether the ledger holds it, and act on the answer.
 *
 *   node scripts/sandbox-adapter.mjs <file> [--ref NSE-…] [--base https://nyaysetu-project.vercel.app]
 *   node scripts/sandbox-adapter.mjs --document <pdf>    verify a NyaySetu-produced document
 *
 * Only the SHA-256 leaves this machine; the file never does.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const base = (flag("--base") ?? process.env.NYAYSETU_BASE ?? "https://nyaysetu-project.vercel.app").replace(/\/$/, "");
const documentPath = flag("--document");
const reference = flag("--ref");
const filePath = documentPath ?? args.find((a, i) => !a.startsWith("--") && !["--ref", "--base", "--document"].includes(args[i - 1]));

if (!filePath) {
  console.error("Usage: node scripts/sandbox-adapter.mjs <file> [--ref NSE-…] [--base URL] | --document <pdf>");
  process.exit(2);
}

const sha256 = "0x" + createHash("sha256").update(readFileSync(filePath)).digest("hex");
const api = async (method, path, body) => {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${response.status} ${json?.error?.code ?? ""} ${json?.error?.message ?? ""}`.trim());
  return json;
};

console.log(`\n  NyaySetu sandbox adapter (demonstration client, not an official integration)`);
console.log(`  API     ${base}/api/v1`);
const spec = await api("GET", "/openapi.json");
console.log(`  Spec    ${spec.info.title} ${spec.info.version}`);
console.log(`  File    ${filePath}`);
console.log(`  SHA-256 ${sha256}\n`);

if (documentPath) {
  const out = await api("POST", "/documents/verify", { sha256 });
  console.log(out.found ? `  ✔ NyaySetu produced this exact document: ${JSON.stringify(out.document)}` : "  ✘ Not a document NyaySetu produced, or it has been altered.");
  process.exit(out.found ? 0 : 1);
}

const out = await api("POST", "/verify", reference ? { sha256, reference } : { sha256 });
if (!out.found) {
  console.log("  ✘ No registered evidence has this exact fingerprint (never registered, or altered).");
  process.exit(1);
}
const r = out.result;
console.log(`  Reference      ${out.reference}`);
console.log(`  Compared with  the ${r.comparedAgainst} (${r.anchorMode === "manifest" ? "capture manifest digest" : "file digest"})`);
console.log(`  ${r.matched ? "✔ MATCH" : "✘ NO MATCH"} — ${r.explanation}`);
const custody = await api("GET", `/evidence/${encodeURIComponent(out.reference)}/custody`);
console.log(`  Custody        ${custody.custody.map((c) => (c.type === "REGISTERED" ? `registered (${c.to})` : c.to)).join(" → ") || "none recorded"}\n`);
process.exit(r.matched ? 0 : 1);
