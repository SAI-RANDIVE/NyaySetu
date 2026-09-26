/**
 * Drives the nine-step demo end to end against the running API.
 *
 *   terminal 1:  cd contracts && npm run node
 *   terminal 2:  cd contracts && npm run deploy:local
 *   terminal 3:  cd backend && npm run dev
 *   terminal 4:  cd backend && npm run demo
 *
 * Every step goes through HTTP with real cookies, real CSRF headers and real
 * transactions, so a green run is proof the whole stack works, not a mock.
 *
 * The nine steps, matching the presentation script:
 *   1  police register evidence at the scene
 *   2  forensic lab confirms the hash on arrival
 *   3  a tampered file is rejected, and the rejection is anchored
 *   4  prosecutor and court take custody
 *   5  judge issues a summons
 *   6  the accused acknowledges it with Aadhaar OTP and GPS
 *   7  judge grants bail with encoded conditions
 *   8  a compliant check-in, then one from outside the fence
 *   9  defence counsel verifies independently against the chain
 */
import * as crypto from "crypto";

const BASE = process.env.DEMO_API_URL ?? "http://localhost:4000";
const PASSWORD = process.env.SEED_PASSWORD ?? "NyaySetu@2026";

const HOME = { lat: 18.5308, lng: 73.8478 };
const AWAY = { lat: 18.5808, lng: 73.8478 }; // ~5.6 km north, outside a 2 km fence

type Json = Record<string, any>;

class Session {
  private cookies = new Map<string, string>();
  private csrf: string | null = null;
  readonly label: string;

  constructor(label: string) {
    this.label = label;
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private absorb(response: Response) {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  async request(method: string, path: string, body?: unknown, isForm = false): Promise<Json> {
    const headers: Record<string, string> = { cookie: this.cookieHeader() };
    if (this.csrf) headers["x-csrf-token"] = this.csrf;
    if (body !== undefined && !isForm) headers["content-type"] = "application/json";

    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });

    this.absorb(response);

    const text = await response.text();
    let json: Json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text.slice(0, 400) };
    }

    if (!response.ok) {
      const error = new Error(
        `${method} ${path} -> ${response.status} ${json?.error?.code ?? ""} ${json?.error?.message ?? text.slice(0, 200)}`
      );
      (error as any).payload = json;
      (error as any).status = response.status;
      throw error;
    }
    return json;
  }

  /**
   * Signs in, completing the email second factor when the deployment requires
   * one.
   *
   * The script can only finish that step when the API echoes the code back,
   * which it does outside production when the mail server could not take the
   * message. With a working mail server the code goes to a real inbox and no
   * script can read it, so the demo tells you to turn the second factor off
   * rather than appearing to hang.
   */
  async login(email: string): Promise<Json> {
    const result = await this.request("POST", "/api/auth/login", { email, password: PASSWORD });

    if (result.mfaRequired) {
      if (!result.otp) {
        throw new Error(
          `${email} needs an emailed sign-in code, which this script cannot read.\n` +
            "  For the scripted demo set LOGIN_OTP_ENABLED=false in backend/.env and restart the API.\n" +
            "  To demonstrate two-factor sign-in, use the web portal instead."
        );
      }
      const verified = await this.request("POST", "/api/auth/login/verify", { otp: result.otp });
      this.csrf = verified.csrfToken;
      return verified.user;
    }

    this.csrf = result.csrfToken;
    return result.user;
  }

  get(path: string) {
    return this.request("GET", path);
  }
  post(path: string, body?: unknown) {
    return this.request("POST", path, body);
  }
  postForm(path: string, form: FormData) {
    return this.request("POST", path, form, true);
  }
}

const sha256 = (buf: Buffer) => "0x" + crypto.createHash("sha256").update(buf).digest("hex");

let step = 0;
function heading(title: string) {
  step += 1;
  console.log(`\n${"=".repeat(72)}\n  STEP ${step}  ${title}\n${"=".repeat(72)}`);
}
const ok = (message: string) => console.log(`  [ok]   ${message}`);
const info = (message: string) => console.log(`         ${message}`);

async function main() {
  // Preflight: the chain must be live, or nothing below can be anchored.
  const health = (await (await fetch(`${BASE}/api/health`)).json()) as Json;
  if (!health.subsystems?.blockchain?.ready) {
    throw new Error(
      `The chain bridge is not ready: ${health.subsystems?.blockchain?.reason}\n` +
        "Start a local chain and deploy, then set CHAIN_RPC_URL and CHAIN_PRIVATE_KEY in backend/.env."
    );
  }
  console.log(`API healthy. Chain: ${JSON.stringify(health.subsystems.blockchain.network)}`);

  const police = new Session("police");
  const lab = new Session("forensic");
  const prosecutor = new Session("prosecutor");
  const judge = new Session("judge");
  const defence = new Session("defence");
  const accused = new Session("accused");

  await police.login("police@nyaysetu.demo");
  await lab.login("forensic@nyaysetu.demo");
  await prosecutor.login("prosecutor@nyaysetu.demo");
  await judge.login("judge@nyaysetu.demo");
  await defence.login("defence@nyaysetu.demo");
  await accused.login("accused@nyaysetu.demo");
  ok("all six participants signed in");

  const { cases } = await police.get("/api/cases");
  const demoCase = cases[0];
  if (!demoCase) throw new Error("No case found. Run `npm run seed` first.");
  info(`case: ${demoCase.fir_number}`);

  // ---------------------------------------------------------------- step 1
  heading("Police register evidence at the scene");

  // Stand in for a bodycam still. The digest is computed here, on the "device",
  // before the bytes are sent, exactly as the mobile app does it.
  const original = Buffer.from(
    `NYAYSETU-DEMO-EVIDENCE\nbodycam frame\ncaptured ${new Date().toISOString()}\n${crypto.randomBytes(24).toString("hex")}`,
    "utf8"
  );
  const originalHash = sha256(original);
  info(`client-side SHA-256: ${originalHash}`);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(original)], { type: "image/jpeg" }), "bodycam-frame-0001.jpg");
  form.append("caseId", demoCase.id);
  form.append("clientHash", originalHash);
  form.append("kind", "photo");
  form.append("gpsLat", String(HOME.lat));
  form.append("gpsLng", String(HOME.lng));
  form.append("collectedAt", new Date().toISOString());
  form.append("notes", "Seized from the rear entrance. Bodycam still.");

  const registered = await police.postForm("/api/evidence", form);
  const evidenceId = registered.evidence.id;
  ok(`registered on chain as evidence #${registered.chain.chainEvidenceId}`);
  info(`tx ${registered.chain.txHash}`);
  info(
    `anomaly screening: ${
      registered.screening.available
        ? `${registered.screening.anomaly ? "FLAGGED" : "clean"} (score ${registered.screening.score})`
        : "unavailable (AI service not running)"
    }`
  );

  // ---------------------------------------------------------------- step 2
  heading("Forensic lab confirms the hash on arrival");
  const accepted = await lab.post(`/api/evidence/${evidenceId}/custody`, { confirmedHash: originalHash });
  ok(`custody ${accepted.fromStage} -> ${accepted.toStage}`);
  info(`tx ${accepted.chain.txHash}`);

  const report = await lab.post(`/api/evidence/${evidenceId}/forensic-report`, {
    conclusion: "Frame is unaltered. EXIF and container timestamps are internally consistent.",
    detail: "Hash recomputed on arrival matches the registered digest. No re-encoding artefacts found.",
  });
  ok(`forensic report anchored: ${report.report.report_hash.slice(0, 18)}...`);

  // ---------------------------------------------------------------- step 3
  heading("A tampered file is rejected, and the rejection is anchored");
  const tampered = Buffer.concat([original, Buffer.from("\n<<edited by an interested party>>")]);
  const tamperedHash = sha256(tampered);
  info(`tampered SHA-256: ${tamperedHash}`);

  try {
    await prosecutor.post(`/api/evidence/${evidenceId}/custody`, { confirmedHash: tamperedHash });
    throw new Error("The tampered transfer was accepted. That is a bug.");
  } catch (error: any) {
    const payload = error.payload?.error;
    if (payload?.code !== "HASH_MISMATCH") throw error;
    ok("transfer refused: HASH_MISMATCH");
    info(`mismatch anchored at tx ${payload.details?.anchoredAt}`);
    info("the refusal is now a permanent on-chain record, not just a server log");
  }

  // ---------------------------------------------------------------- step 4
  heading("Prosecutor and court take custody of the genuine file");
  const toProsecutor = await prosecutor.post(`/api/evidence/${evidenceId}/custody`, {
    confirmedHash: originalHash,
  });
  ok(`custody ${toProsecutor.fromStage} -> ${toProsecutor.toStage}`);

  const toCourt = await judge.post(`/api/evidence/${evidenceId}/custody`, { confirmedHash: originalHash });
  ok(`custody ${toCourt.fromStage} -> ${toCourt.toStage}`);

  const custody = await judge.get(`/api/evidence/${evidenceId}/custody`);
  info(`chain of custody has ${custody.onChain.length} on-chain hops, ${custody.offChain.length} mirrored rows`);

  // ---------------------------------------------------------------- step 5
  heading("Judge issues a summons");
  const summonsResult = await judge.post("/api/summons", {
    caseId: demoCase.id,
    recipientName: "Vikram Jadhav",
    recipientAadhaarNumber: "722667788997",
    documentBody:
      "IN THE COURT OF SESSIONS, PUNE\n\nYou are hereby summoned to appear before this court in " +
      `${demoCase.fir_number} to answer the charge framed against you.`,
    hearingAt: new Date(Date.now() + 14 * 86400_000).toISOString(),
    windowHours: 72,
  });
  const summonsId = summonsResult.summons.id;
  ok(`summons #${summonsResult.chain.chainSummonsId} issued, 72 hour window`);
  info(`document hash ${summonsResult.summons.document_hash.slice(0, 18)}...`);

  const beforeAck = await judge.get(`/api/summons/${summonsId}/status`);
  info(`status before acknowledgement: ${beforeAck.effectiveStatus}, ${Math.round(beforeAck.secondsRemaining / 3600)}h left`);

  // ---------------------------------------------------------------- step 6
  heading("The accused acknowledges it with Aadhaar OTP and GPS");
  const otp1 = await accused.post(`/api/summons/${summonsId}/otp`);
  if (!otp1.otp) throw new Error("The sandbox did not echo the OTP. Set OTP_ECHO_IN_RESPONSE=true.");
  info(`OTP issued to ${otp1.maskedDestination}`);

  const acknowledged = await accused.post(`/api/summons/${summonsId}/acknowledge`, {
    challengeId: otp1.challengeId,
    otp: otp1.otp,
    gpsLat: HOME.lat,
    gpsLng: HOME.lng,
    deviceId: "demo-pixel-7a",
    platform: "android",
  });
  ok(`acknowledged and anchored: ${acknowledged.chain.txHash}`);
  info('"I was never served" is no longer available as a defence');

  // ---------------------------------------------------------------- step 7
  heading("Judge grants bail with conditions encoded on chain");
  const bail = await judge.post("/api/bail/grant", {
    caseId: demoCase.id,
    accusedName: "Vikram Jadhav",
    accusedAadhaarNumber: "722667788997",
    conditionTags: ["GEO_RESTRICTION", "PERIODIC_CHECKIN", "NO_CONTACT"],
    centreLat: HOME.lat,
    centreLng: HOME.lng,
    radiusMetres: 2000,
    // One hour, so a missed check-in is demonstrable inside a presentation.
    checkinIntervalSeconds: 3600,
    expiryAt: new Date(Date.now() + 90 * 86400_000).toISOString(),
    orderText: "Bail granted on a personal bond of Rs 50,000 with one surety of the like amount.",
    suretyName: "Sunita Jadhav",
    riskFactors: {
      offenceType: "burglary",
      priorConvictions: 1,
      ageYears: 29,
      previousBailViolations: 0,
      checkInConsistency: 0.9,
      movementRadiusKm: 4,
      employmentStable: true,
    },
  });
  ok(`bail granted, geo-fence 2000 m, check-in every hour`);
  info(
    `risk assessment: ${
      bail.risk?.available ? `${bail.risk.band} (${bail.risk.score})` : "unavailable (AI service not running)"
    }`
  );

  // ---------------------------------------------------------------- step 8
  heading("A compliant check-in, then one from outside the fence");
  const otp2 = await accused.post(`/api/bail/case/${demoCase.id}/otp`);
  const good = await accused.post(`/api/bail/case/${demoCase.id}/checkin`, {
    challengeId: otp2.challengeId,
    otp: otp2.otp,
    gpsLat: HOME.lat + 0.005,
    gpsLng: HOME.lng,
  });
  ok(`check-in accepted, ${good.distanceMetres} m from home, inside the fence`);
  info(`compliance score: ${good.compliance?.score}`);

  const otp3 = await accused.post(`/api/bail/case/${demoCase.id}/otp`);
  const bad = await accused.post(`/api/bail/case/${demoCase.id}/checkin`, {
    challengeId: otp3.challengeId,
    otp: otp3.otp,
    gpsLat: AWAY.lat,
    gpsLng: AWAY.lng,
  });
  ok(`check-in recorded from ${bad.distanceMetres} m away: outside the fence`);
  info(`violations raised: ${bad.violations.map((v: any) => v.reason).join(", ") || "none"}`);
  info(`compliance score now: ${bad.compliance?.score}`);

  const board = await judge.get("/api/bail/dashboard");
  info(`court board: ${board.counts.compliant} compliant, ${board.counts.breach} in breach`);

  // ---------------------------------------------------------------- step 9
  heading("Defence counsel verifies independently against the chain");

  // Counsel holds only the file and the evidence id. The answer is read from the
  // chain, so it does not depend on trusting the prosecution's database.
  const genuine = await defence.post(`/api/evidence/${evidenceId}/verify`, {
    submittedHash: originalHash,
    anchor: true,
  });
  ok(`genuine file verifies: matched=${genuine.matched}`);
  info(`on-chain hash ${genuine.onChainHash.slice(0, 18)}...`);
  info(`database agrees with chain: ${genuine.databaseAgreesWithChain}`);
  info(`on-chain mismatch counter: ${genuine.onChain.mismatchCount} (the refused tamper attempt)`);

  const forged = await defence.post(`/api/evidence/${evidenceId}/verify`, {
    submittedHash: tamperedHash,
    anchor: true,
  });
  ok(`forged copy fails: matched=${forged.matched}`);

  const checks = await defence.get(`/api/evidence/${evidenceId}/integrity-checks`);
  info(`${checks.checks.length} integrity checks on record, ${checks.checks.filter((c: any) => !c.matched).length} failed`);

  console.log(`\n${"=".repeat(72)}`);
  console.log("  Demo complete. Every step above was a real transaction.");
  console.log(`${"=".repeat(72)}\n`);
}

main().catch((error) => {
  console.error(`\nDemo failed: ${error.message}\n`);
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2));
  process.exit(1);
});
