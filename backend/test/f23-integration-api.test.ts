import { test, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { assign, call, makeActor, resetDatabase, stopServer, type Actor } from "./support/harness";
import { FakeChain } from "./support/fakeChain";
import { createCase, sha, uploadEvidence } from "./support/evidence";
import { env } from "../src/config/env";

/** The versioned integration API (v1): public verification, protected metadata, OpenAPI. */

after(stopServer);

let fake: FakeChain;
let police: Actor;
const depth = env.confirmationDepth;

beforeEach(() => {
  resetDatabase();
  fake = new FakeChain().install();
  (env as any).confirmationDepth = 1;
  police = makeActor("police");
});
afterEach(() => {
  fake.uninstall();
  (env as any).confirmationDepth = depth;
});

async function item() {
  const kase = await createCase(police);
  const bytes = randomBytes(2000);
  const { response } = await uploadEvidence(police, kase.id, { bytes });
  return { kase, bytes, ref: response.body.evidence.public_ref as string };
}

test("the OpenAPI description is served and names every v1 path", async () => {
  const response = await call(null, "GET", "/api/v1/openapi.json");
  assert.equal(response.status, 200);
  assert.equal(response.body.openapi, "3.1.0");
  for (const path of ["/evidence/{ref}", "/evidence/{ref}/custody", "/verify", "/documents/verify", "/cases/{caseId}/evidence", "/evidence/{ref}/audit"]) {
    assert.ok(response.body.paths[path], `documents ${path}`);
  }
});

test("verify by digest, with and without a reference; a changed file fails", async () => {
  const { bytes, ref } = await item();
  const withRef = await call(null, "POST", "/api/v1/verify", { body: { sha256: sha(bytes), reference: ref } });
  assert.equal(withRef.status, 200, JSON.stringify(withRef.body));
  assert.equal(withRef.body.result.matched, true);
  assert.equal(withRef.body.apiVersion, "1");

  const without = await call(null, "POST", "/api/v1/verify", { body: { sha256: sha(bytes) } });
  assert.equal(without.body.found, true);
  assert.equal(without.body.reference, ref);

  const changed = Buffer.from(bytes);
  changed[0] ^= 1;
  const bad = await call(null, "POST", "/api/v1/verify", { body: { sha256: sha(changed), reference: ref } });
  assert.equal(bad.body.result.matched, false);
});

test("public evidence and custody disclose no case reference", async () => {
  const { kase, ref } = await item();
  for (const path of [`/api/v1/evidence/${ref}`, `/api/v1/evidence/${ref}/custody`]) {
    const response = await call(null, "GET", path);
    assert.equal(response.status, 200, path);
    assert.ok(!JSON.stringify(response.body).includes(kase.case_reference), `${path} leaks the case reference`);
  }
  const missing = await call(null, "GET", "/api/v1/evidence/NSE-00000000000000000000000000");
  assert.equal(missing.status, 404);
  assert.ok(missing.body.error?.code, "structured error");
});

test("protected endpoints need a session and an assignment", async () => {
  const { kase, ref } = await item();
  assert.equal((await call(null, "GET", `/api/v1/cases/${kase.id}/evidence`)).status, 401);
  const stranger = makeActor("prosecutor");
  assert.equal((await call(stranger, "GET", `/api/v1/cases/${kase.id}/evidence`)).status, 403);
  assert.equal((await call(stranger, "GET", `/api/v1/evidence/${ref}/audit`)).status, 403);
  assign(stranger, kase.id, "read");
  const allowed = await call(stranger, "GET", `/api/v1/cases/${kase.id}/evidence`);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.evidence.length, 1);
  const audit = await call(stranger, "GET", `/api/v1/evidence/${ref}/audit`);
  assert.equal(audit.status, 200);
  assert.ok(Array.isArray(audit.body.audit));
});

test("an unknown document digest is reported as not found", async () => {
  const response = await call(null, "POST", "/api/v1/documents/verify", { body: { sha256: sha(Buffer.from("not a document")) } });
  assert.equal(response.status, 200);
  assert.deepEqual({ found: response.body.found, document: response.body.document }, { found: false, document: null });
});
