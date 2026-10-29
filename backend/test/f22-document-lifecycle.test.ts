import { test, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { assign, call, makeActor, mem, resetDatabase, stopServer, type Actor } from "./support/harness";
import { FakeChain } from "./support/fakeChain";
import { createCase, sha, uploadEvidence } from "./support/evidence";
import { pdfText } from "./support/pdfText";
import { env } from "../src/config/env";

/**
 * The final report's lifecycle (2.1): a generated report is a draft until an
 * authorised officer approves it on a clean readiness check; approval freezes
 * the bytes; filing needs a court receipt; nothing claims "filed" by itself.
 */

after(stopServer);

let fake: FakeChain;
let police: Actor;
let prosecutor: Actor;
let defence: Actor;
const depth = env.confirmationDepth;

const flat = (s: string) => s.replace(/\s+/g, "");
const PARTICULARS = {
  nature: "charge_sheet",
  complainant: "Shri R. Patil, Kothrud, Pune (from station records)",
  narrative:
    "On the night of the incident the complainant reported the theft of a two-wheeler parked outside his residence. CCTV footage was seized and the vehicle was recovered from the accused.",
  annexures: ["Statement of the complainant", "Seizure memo SZ-1"],
};

beforeEach(() => {
  resetDatabase();
  fake = new FakeChain().install();
  (env as any).confirmationDepth = 1;
  police = makeActor("police", { name: "Insp. Meera Kulkarni" });
  prosecutor = makeActor("prosecutor");
  defence = makeActor("defence_lawyer");
});
afterEach(() => {
  fake.uninstall();
  (env as any).confirmationDepth = depth;
});

async function readyCase() {
  const kase = await createCase(police, { sections: ["BNS 303"], courtName: "JMFC Court, Pune", fir: { number: "CR-0042", year: 2026 } });
  assign(prosecutor, kase.id, "write");
  assign(defence, kase.id, "read");
  const { response } = await uploadEvidence(police, kase.id, { bytes: randomBytes(1500) });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return kase;
}

test("the working draft never claims to be a filed charge sheet", async () => {
  const kase = await readyCase();
  const response = await call(police, "GET", `/api/reports/cases/${kase.id}/final-report.pdf`);
  assert.equal(response.status, 200);
  const text = flat(pdfText(response.raw));
  assert.ok(!text.includes(flat("Charge sheet filed")), "no false claim of filing");
  assert.ok(text.includes(flat("NOT APPROVED")), "watermarked as a draft");
  assert.ok(text.includes(flat("Filing is recorded only on a receipt from the court")));
});

test("missing particulars block approval, and each is named", async () => {
  const kase = await readyCase();
  const readiness = await call(police, "GET", `/api/reports/cases/${kase.id}/final-report/readiness`);
  assert.equal(readiness.status, 200, JSON.stringify(readiness.body));
  const codes = Object.fromEntries(readiness.body.findings.map((f: any) => [f.code, f.level]));
  assert.equal(codes.COMPLAINANT, "BLOCKING");
  assert.equal(codes.NARRATIVE, "BLOCKING");
  assert.equal(codes.NATURE, "BLOCKING");
  assert.equal(codes.SIGNATURE, "NOT_VERIFIED", "the system never claims a signature");
  assert.equal(readiness.body.summary.canApprove, false);

  const created = await call(police, "POST", `/api/reports/cases/${kase.id}/final-report/versions`, { body: {} });
  assert.equal(created.status, 201);
  assert.equal(created.body.version.state, "VALIDATION_REQUIRED");
  const approve = await call(police, "POST", `/api/reports/final-report/versions/${created.body.version.id}/approve`);
  assert.equal(approve.status, 409);
  assert.equal(approve.body.error.code, "READINESS_BLOCKED");
});

test("a complete version is approved once, its bytes frozen, and filing needs a court receipt", async () => {
  const kase = await readyCase();
  const created = await call(police, "POST", `/api/reports/cases/${kase.id}/final-report/versions`, { body: PARTICULARS });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const v = created.body.version;
  assert.equal(v.state, "READY_FOR_REVIEW", JSON.stringify(v.readiness.filter((f: any) => f.level !== "PASS")));
  assert.equal(v.summary.canApprove, true);

  // Before approval: a watermarked draft.
  const draft = await call(police, "GET", `/api/reports/final-report/versions/${v.id}/pdf`);
  assert.ok(flat(pdfText(draft.raw)).includes(flat("NOT APPROVED")));

  // Only police approve.
  assert.equal((await call(prosecutor, "POST", `/api/reports/final-report/versions/${v.id}/approve`)).status, 403);
  const approved = await call(police, "POST", `/api/reports/final-report/versions/${v.id}/approve`);
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.version.state, "APPROVED");
  assert.match(approved.body.version.content_sha256, /^0x[0-9a-f]{64}$/);
  assert.equal(approved.body.version.pdf_base64, undefined, "the stored bytes never leave in JSON");

  // Export: identical bytes every time, matching the recorded digest.
  const a = await call(police, "GET", `/api/reports/final-report/versions/${v.id}/pdf`);
  const b = await call(police, "GET", `/api/reports/final-report/versions/${v.id}/pdf`);
  assert.equal(a.headers.get("x-nyaysetu-sha256"), approved.body.version.content_sha256);
  assert.equal(Buffer.from(a.raw).equals(Buffer.from(b.raw)), true);
  const text = flat(pdfText(a.raw));
  assert.ok(!text.includes(flat("NOT APPROVED")));
  assert.ok(text.includes(flat("Charge sheet")), "states the nature of the report");
  assert.equal(mem.table("document_versions")[0].state, "EXPORTED");

  // Defence gets a redacted rendering, not the FIR-bearing original.
  const forDefence = await call(defence, "GET", `/api/reports/final-report/versions/${v.id}/pdf`);
  assert.equal(forDefence.status, 200);
  assert.ok(!flat(pdfText(forDefence.raw)).includes("CR-0042"));

  // Approved versions cannot be approved again; filing needs a receipt and the right role.
  assert.equal((await call(police, "POST", `/api/reports/final-report/versions/${v.id}/approve`)).status, 409);
  assert.equal((await call(police, "POST", `/api/reports/final-report/versions/${v.id}/filed`, { body: { reference: "SC-123/2026", filedOn: "2026-10-29" } })).status, 403);
  assert.equal((await call(prosecutor, "POST", `/api/reports/final-report/versions/${v.id}/filed`, { body: { filedOn: "2026-10-29" } })).status, 400);
  const filed = await call(prosecutor, "POST", `/api/reports/final-report/versions/${v.id}/filed`, { body: { reference: "SC-123/2026", filedOn: "2026-10-29" } });
  assert.equal(filed.status, 200, JSON.stringify(filed.body));
  assert.equal(filed.body.version.state, "FILED");
});

test("a correction is a new version; only the latest can be approved", async () => {
  const kase = await readyCase();
  const first = await call(police, "POST", `/api/reports/cases/${kase.id}/final-report/versions`, { body: PARTICULARS });
  const second = await call(police, "POST", `/api/reports/cases/${kase.id}/final-report/versions`, { body: { ...PARTICULARS, annexures: ["Statement", "Memo", "FSL report"] } });
  assert.equal(second.body.version.version, 2);
  assert.equal(second.body.version.supersedes, first.body.version.id);
  assert.equal((await call(police, "POST", `/api/reports/final-report/versions/${first.body.version.id}/approve`)).status, 409);
  const list = await call(defence, "GET", `/api/reports/cases/${kase.id}/final-report/versions`);
  assert.equal(list.body.versions.length, 2, "history is kept");
});

test("a record that disagrees with the ledger blocks approval", async () => {
  const kase = await readyCase();
  const item = mem.table("evidence_items")[0];
  item.anchored_digest = sha(Buffer.from("something else"));
  const readiness = await call(police, "GET", `/api/reports/cases/${kase.id}/final-report/readiness`);
  const ledger = readiness.body.findings.find((f: any) => f.code === "LEDGER_CONSISTENCY");
  assert.equal(ledger.level, "BLOCKING", JSON.stringify(ledger));
});

test("the readiness report is downloadable as a PDF", async () => {
  const kase = await readyCase();
  const response = await call(prosecutor, "GET", `/api/reports/cases/${kase.id}/final-report/readiness.pdf`);
  assert.equal(response.status, 200);
  assert.ok(flat(pdfText(response.raw)).includes(flat("Document Readiness Report")));
});
