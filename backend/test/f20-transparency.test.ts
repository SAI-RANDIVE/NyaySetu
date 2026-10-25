import { test, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { call, makeActor, resetDatabase, stopServer, type Actor } from "./support/harness";
import { FakeChain } from "./support/fakeChain";
import { createCase, sha, uploadEvidence } from "./support/evidence";
import { env } from "../src/config/env";
import { resetTransparencyCache } from "../src/services/transparency.service";

after(stopServer);

let fake: FakeChain;
let police: Actor;
const originalDepth = env.confirmationDepth;

beforeEach(() => {
  resetDatabase();
  resetTransparencyCache();
  fake = new FakeChain().install();
  (env as any).confirmationDepth = 1;
  police = makeActor("police", { name: "Inspector Openhand" });
});

afterEach(() => {
  fake.uninstall();
  (env as any).confirmationDepth = originalDepth;
});

test("the transparency figures are public and cacheable", async () => {
  const response = await call(null, "GET", "/api/public/stats");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.match(response.headers.get("cache-control") ?? "", /public/);
  assert.equal(response.body.evidence.registered, 0);
  assert.ok(Array.isArray(response.body.ledger.recent));
});

test("registered evidence is counted, and nothing identifying is disclosed", async () => {
  const kase = await createCase(police);
  const bytes = randomBytes(2048);
  const { response: upload } = await uploadEvidence(police, kase.id, { bytes });
  assert.equal(upload.status, 201, JSON.stringify(upload.body));

  resetTransparencyCache();
  const response = await call(null, "GET", "/api/public/stats");
  assert.equal(response.status, 200);
  assert.equal(response.body.evidence.registered, 1);

  const text = JSON.stringify(response.body);
  for (const secret of [kase.case_reference, kase.id, upload.body.evidence.public_ref, upload.body.evidence.id, sha(bytes), "Openhand"]) {
    if (secret) assert.ok(!text.includes(String(secret)), `the public figures disclose ${secret}`);
  }
  for (const r of response.body.ledger.recent) {
    assert.deepEqual(Object.keys(r).sort(), ["at", "explorer", "purpose", "txHash"]);
  }
});

test("cost per record is reported from measured transactions, not assumed", async () => {
  const response = await call(null, "GET", "/api/public/stats");
  assert.equal(typeof response.body.cost.measuredTransactions, "number");
  assert.ok(Array.isArray(response.body.cost.byMethod));
  if (response.body.cost.measuredTransactions === 0) assert.equal(response.body.cost.averageGas, null);
});

test("a file can be verified without its reference, and the answer comes from the chain", async () => {
  const kase = await createCase(police);
  const bytes = randomBytes(3000);
  const { response: upload } = await uploadEvidence(police, kase.id, { bytes });
  assert.equal(upload.status, 201, JSON.stringify(upload.body));

  const found = await call(null, "POST", "/api/public/lookup", { body: { sha256: sha(bytes) } });
  assert.equal(found.status, 200, JSON.stringify(found.body));
  assert.equal(found.body.found, true);
  assert.equal(found.body.reference, upload.body.evidence.public_ref);
  assert.equal(found.body.result.matched, true);
  assert.equal(found.body.result.comparedAgainst, "chain");
  assert.ok(!JSON.stringify(found.body).includes(kase.case_reference), "no case reference");

  const altered = Buffer.from(bytes);
  altered[10] ^= 0x01;
  const missing = await call(null, "POST", "/api/public/lookup", { body: { sha256: sha(altered) } });
  assert.deepEqual(missing.body, { found: false });

  assert.equal((await call(null, "POST", "/api/public/lookup", { body: { sha256: "not-a-digest" } })).status, 400);
});
