import { test, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { assign, call, makeActor, mem, resetDatabase, stopServer, type Actor } from "./support/harness";
import { FakeChain } from "./support/fakeChain";
import { createCase, sha, uploadEvidence } from "./support/evidence";
import { env } from "../src/config/env";

/**
 * Physical exhibits (2.1): a tamper-evident seal serial is bound to the exhibit
 * while it is with the seizing officer, and the laboratory must read the same
 * serial on arrival. A substituted packet — the blood-sample swap — is refused
 * at intake, recorded on chain and alerted, not discovered weeks later.
 */

after(stopServer);

let fake: FakeChain;
let police: Actor;
let lab: Actor;
let kase: { id: string; case_reference: string };
const depth = env.confirmationDepth;

beforeEach(async () => {
  resetDatabase();
  fake = new FakeChain().install();
  (env as any).confirmationDepth = 1;
  police = makeActor("police");
  lab = makeActor("forensic_lab");
  kase = await createCase(police);
  assign(lab, kase.id, "write");
});
afterEach(() => {
  fake.uninstall();
  (env as any).confirmationDepth = depth;
});

async function sealedExhibit(serial = "MH-PN-0419") {
  const bytes = randomBytes(2500); // the photograph of the sealed vial
  const { response } = await uploadEvidence(police, kase.id, { bytes });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const id = response.body.evidence.id as string;
  const sealed = await call(police, "POST", `/api/evidence/${id}/seal`, { body: { serial, description: "Blood sample vial, 5 ml" } });
  assert.equal(sealed.status, 201, JSON.stringify(sealed.body));
  return { id, bytes };
}

async function toLab(id: string, bytes: Buffer) {
  const moved = await call(lab, "POST", `/api/evidence/${id}/custody`, { body: { confirmedHash: sha(bytes) } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
}

test("binding a seal anchors a salted digest, never the serial itself", async () => {
  const { id } = await sealedExhibit();
  const seal = mem.table("exhibit_seals")[0];
  assert.equal(seal.serial, "MHPN0419");
  assert.match(seal.seal_digest, /^0x[0-9a-f]{64}$/);
  assert.ok(seal.anchor_id, "anchored");
  const onChain = JSON.stringify(fake.sent, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  // Letters that cannot occur in hex, so a match could only be the serial itself.
  assert.ok(!onChain.toUpperCase().includes("MHPN"), "the serial never reaches the chain");

  const read = await call(police, "GET", `/api/evidence/${id}/seal`);
  assert.equal(read.status, 200);
  assert.equal(read.body.seal.serial, "MHPN0419");
});

test("a seal is bound once, only by the police, and only before the first hand-over", async () => {
  const { id, bytes } = await sealedExhibit();
  assert.equal((await call(police, "POST", `/api/evidence/${id}/seal`, { body: { serial: "OTHER-1" } })).status, 409);
  assert.equal((await call(lab, "POST", `/api/evidence/${id}/seal`, { body: { serial: "LAB-1" } })).status, 403);

  const { response } = await uploadEvidence(police, kase.id, { bytes: randomBytes(900) });
  const other = response.body.evidence.id;
  await toLab(id, bytes);
  void other;
  assert.equal((await call(police, "POST", `/api/evidence/${id}/seal`, { body: { serial: "LATE-1" } })).status, 409);
});

test("the same serial on arrival is accepted, however it is typed", async () => {
  const { id, bytes } = await sealedExhibit("MH-PN-0419");
  await toLab(id, bytes);
  const intake = await call(lab, "POST", `/api/lab/evidence/${id}/intake`, {
    body: { sealIntact: true, sealSerial: "mh pn 0419", recheckSha256: sha(bytes) },
  });
  assert.equal(intake.status, 201, JSON.stringify(intake.body));
  const checks = mem.table("seal_checks");
  assert.equal(checks.length, 1);
  assert.equal(checks[0].matched, true);
  assert.equal(mem.table("discrepancy_alerts").length, 0);
});

test("a substituted packet is refused at intake, anchored and alerted", async () => {
  const { id, bytes } = await sealedExhibit("MH-PN-0419");
  await toLab(id, bytes);
  const before = fake.sent.length;

  const intake = await call(lab, "POST", `/api/lab/evidence/${id}/intake`, {
    body: { sealIntact: true, sealSerial: "MH-PN-0477", recheckSha256: sha(bytes) },
  });
  assert.equal(intake.status, 409, JSON.stringify(intake.body));
  assert.equal(intake.body.error.code, "SEAL_MISMATCH");
  assert.equal(mem.table("lab_intakes").length, 0, "no intake is recorded for the wrong packet");

  const checks = mem.table("seal_checks");
  assert.equal(checks.length, 1);
  assert.equal(checks[0].matched, false);
  assert.ok(checks[0].anchor_id, "the wrong reading is anchored");
  assert.ok(fake.sent.length > before, "a transaction was sent for the mismatch");

  const alerts = mem.table("discrepancy_alerts");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "SEAL_MISMATCH");
  assert.equal(alerts[0].severity, "serious");
});

test("a sealed exhibit cannot be taken in without reading its seal", async () => {
  const { id, bytes } = await sealedExhibit();
  await toLab(id, bytes);
  const intake = await call(lab, "POST", `/api/lab/evidence/${id}/intake`, { body: { sealIntact: true, recheckSha256: sha(bytes) } });
  assert.equal(intake.status, 400, JSON.stringify(intake.body));
});

test("an unsealed item is taken in exactly as before", async () => {
  const bytes = randomBytes(1200);
  const { response } = await uploadEvidence(police, kase.id, { bytes });
  const id = response.body.evidence.id;
  await toLab(id, bytes);
  const intake = await call(lab, "POST", `/api/lab/evidence/${id}/intake`, { body: { sealIntact: true, recheckSha256: sha(bytes) } });
  assert.equal(intake.status, 201, JSON.stringify(intake.body));
  assert.equal(mem.table("seal_checks").length, 0);
});
