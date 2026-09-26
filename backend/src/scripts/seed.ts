/**
 * Seeds the demo cast, one account per role, plus a case they all work on.
 *
 * Idempotent: re-running updates the existing rows rather than duplicating them.
 *
 *   cd backend && npm run seed
 *
 * The Aadhaar numbers below are synthetic but carry valid Verhoeff check digits,
 * so they pass the same validation a real number would. They are tokenised on
 * insert; the numbers themselves are never stored.
 */
import bcrypt from "bcryptjs";
import { db } from "../lib/supabase";
import { aadhaarToken, aadhaarLast4, encryptField, caseIdHash, verhoeffValid } from "../lib/crypto";
import { logger } from "../lib/logger";

const PASSWORD = process.env.SEED_PASSWORD ?? "NyaySetu@2026";

/**
 * Where sign-in codes actually go.
 *
 * The default addresses end in @nyaysetu.demo, which is not a real domain, so an
 * emailed sign-in code has nowhere to land. Set SEED_EMAIL_BASE to an address
 * you control and every demo account becomes a plus-addressed alias of it:
 *
 *   SEED_EMAIL_BASE=apurva@gmail.com
 *     -> apurva+police@gmail.com, apurva+judge@gmail.com, and so on
 *
 * Gmail, Outlook and Fastmail all deliver plus-addressed mail to the same
 * inbox, so one mailbox receives the codes for all eight roles. That is what
 * makes two-factor sign-in demonstrable without eight real mailboxes.
 */
const EMAIL_BASE = (process.env.SEED_EMAIL_BASE ?? "").trim();

function addressFor(slug: string, fallback: string): string {
  if (!EMAIL_BASE || !EMAIL_BASE.includes("@")) return fallback;
  const [local, domain] = EMAIL_BASE.split("@");
  // Strip any existing +tag so re-running with a tagged base does not nest them.
  const base = local.split("+")[0];
  return `${base}+${slug}@${domain}`;
}

interface SeedUser {
  /** Used for the plus-address alias and as the map key. */
  slug: string;
  email: string;
  fullName: string;
  role:
    | "police"
    | "forensic_lab"
    | "prosecutor"
    | "judge"
    | "defence_lawyer"
    | "accused"
    | "court_admin";
  designation: string;
  stationOrCourt: string;
  aadhaar: string;
  phone: string;
  note?: string;
}

const USERS: SeedUser[] = [
  {
    slug: "police",
    email: addressFor("police", "police@nyaysetu.demo"),
    fullName: "Insp. Meera Deshpande",
    role: "police",
    designation: "Inspector, Crime Branch",
    stationOrCourt: "Shivajinagar Police Station, Pune",
    aadhaar: "223344556676",
    phone: "+919820000001",
  },
  {
    slug: "forensic",
    email: addressFor("forensic", "forensic@nyaysetu.demo"),
    fullName: "Dr. Anil Kulkarni",
    role: "forensic_lab",
    designation: "Assistant Director, Digital Forensics",
    stationOrCourt: "Regional Forensic Science Laboratory, Pune",
    aadhaar: "322113344556",
    phone: "+919820000002",
  },
  {
    slug: "prosecutor",
    email: addressFor("prosecutor", "prosecutor@nyaysetu.demo"),
    fullName: "Adv. Rohit Sathe",
    role: "prosecutor",
    designation: "Additional Public Prosecutor",
    stationOrCourt: "District Court, Pune",
    aadhaar: "422334455665",
    phone: "+919820000003",
  },
  {
    slug: "judge",
    email: addressFor("judge", "judge@nyaysetu.demo"),
    fullName: "Hon. Justice S. Iyer",
    role: "judge",
    designation: "Additional Sessions Judge",
    stationOrCourt: "Sessions Court, Pune",
    aadhaar: "522445566770",
    phone: "+919820000004",
  },
  {
    slug: "defence",
    email: addressFor("defence", "defence@nyaysetu.demo"),
    fullName: "Adv. Priya Nair",
    role: "defence_lawyer",
    designation: "Counsel for the accused",
    stationOrCourt: "Bar Association, Pune",
    aadhaar: "622556677884",
    phone: "+919820000005",
  },
  {
    slug: "accused",
    email: addressFor("accused", "accused@nyaysetu.demo"),
    fullName: "Vikram Jadhav",
    role: "accused",
    designation: "Accused, on bail",
    stationOrCourt: "Resident, Shivajinagar, Pune",
    aadhaar: "722667788997",
    phone: "+919820000006",
  },
  {
    slug: "surety",
    email: addressFor("surety", "surety@nyaysetu.demo"),
    fullName: "Sunita Jadhav",
    role: "accused",
    designation: "Surety / guarantor",
    stationOrCourt: "Resident, Shivajinagar, Pune",
    aadhaar: "822778899001",
    phone: "+919820000007",
    // There is no separate surety role: a guarantor is a citizen. Their
    // read-only compliance view is driven by bail_conditions.surety_user_id, not
    // by a role, which is why this account shares the accused role.
    note: "surety",
  },
  {
    slug: "admin",
    email: addressFor("admin", "admin@nyaysetu.demo"),
    fullName: "R. Kulkarni",
    role: "court_admin",
    designation: "Court Registrar",
    stationOrCourt: "Sessions Court, Pune",
    aadhaar: "922889900115",
    phone: "+919820000008",
  },
];

const DEMO_CASE = {
  firNumber: "FIR/2026/PUNE-SHIVAJINAGAR/0417",
  title: "State vs. Vikram Jadhav",
  offenceType: "Aggravated burglary with assault",
  sections: ["BNS 331(4)", "BNS 117(2)"],
  policeStation: "Shivajinagar Police Station, Pune",
  courtName: "Sessions Court, Pune",
  summary:
    "Complaint of forced entry and assault at a residence in Shivajinagar on the night of " +
    "14 September 2026. CCTV footage, a recovered tool and a bodycam recording were seized at the scene.",
};

async function upsertUser(user: SeedUser): Promise<string> {
  if (!verhoeffValid(user.aadhaar)) {
    throw new Error(`Seed Aadhaar for ${user.email} fails its checksum: ${user.aadhaar}`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const { data: existing } = await db
    .from("users")
    .select("id")
    .ilike("email", user.email)
    .maybeSingle();

  let userId: string;

  if (existing) {
    const { error } = await db
      .from("users")
      .update({
        password_hash: passwordHash,
        full_name: user.fullName,
        role: user.role,
        designation: user.designation,
        station_or_court: user.stationOrCourt,
        is_active: true,
        failed_login_attempts: 0,
        locked_until: null,
        // A re-seed can change the address, so a previous verification no
        // longer applies. The next successful sign-in code re-establishes it.
        email_verified_at: null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Updating ${user.email}: ${error.message}`);
    userId = existing.id;
  } else {
    const { data, error } = await db
      .from("users")
      .insert({
        email: user.email,
        password_hash: passwordHash,
        full_name: user.fullName,
        role: user.role,
        designation: user.designation,
        station_or_court: user.stationOrCourt,
        theme: "dark",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Creating ${user.email}: ${error?.message}`);
    userId = data.id;
  }

  const { error: piiError } = await db
    .schema("restricted")
    .from("user_pii")
    .upsert(
      {
        user_id: userId,
        aadhaar_token: aadhaarToken(user.aadhaar),
        aadhaar_last4: aadhaarLast4(user.aadhaar),
        phone_encrypted: encryptField(user.phone),
        address_encrypted: encryptField(user.stationOrCourt),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (piiError) {
    throw new Error(
      `Writing the Aadhaar token for ${user.email} failed: ${piiError.message}\n` +
        "If this says the schema is not exposed, add `restricted` under " +
        "Supabase -> Settings -> API -> Exposed schemas. See DEPLOYMENT.md."
    );
  }

  return userId;
}

async function main() {
  console.log("\nSeeding NyaySetu demo data\n" + "=".repeat(60));

  // Reference rows, in case seed/reference.sql was not run.
  await db.from("roles").upsert(
    [
      { role: "police", label: "Police Officer", description: "Captures evidence at the scene.", portal_path: "/police" },
      { role: "forensic_lab", label: "Forensic Laboratory", description: "Confirms hashes and anchors reports.", portal_path: "/forensic" },
      { role: "prosecutor", label: "Public Prosecutor", description: "Takes custody for trial.", portal_path: "/prosecutor" },
      { role: "judge", label: "Judge", description: "Issues summons and grants bail.", portal_path: "/judge" },
      { role: "defence_lawyer", label: "Defence Counsel", description: "Independently verifies evidence.", portal_path: "/defence" },
      { role: "accused", label: "Accused", description: "Acknowledges summons, files check-ins.", portal_path: "/accused" },
      { role: "court_admin", label: "Court Administrator", description: "Manages users and the audit trail.", portal_path: "/admin" },
    ],
    { onConflict: "role" }
  );

  if (EMAIL_BASE) {
    console.log(`  addresses derived from ${EMAIL_BASE} using plus-addressing\n`);
  } else {
    console.log(
      "  using @nyaysetu.demo addresses, which cannot receive mail.\n" +
        "  Set SEED_EMAIL_BASE=you@gmail.com to get real, deliverable aliases.\n"
    );
  }

  const ids: Record<string, string> = {};
  for (const user of USERS) {
    ids[user.note === "surety" ? "surety" : user.role] = await upsertUser(user);
    console.log(`  user  ${user.email.padEnd(34)} ${user.role}`);
  }

  // ------------------------------------------------------------------- case
  const hash = caseIdHash(DEMO_CASE.firNumber);
  const { data: existingCase } = await db
    .from("cases")
    .select("id")
    .eq("case_id_hash", hash)
    .maybeSingle();

  let caseId: string;
  if (existingCase) {
    caseId = existingCase.id;
    console.log(`\n  case  ${DEMO_CASE.firNumber} (existing)`);
  } else {
    const { data, error } = await db
      .from("cases")
      .insert({
        fir_number: DEMO_CASE.firNumber,
        case_id_hash: hash,
        title: DEMO_CASE.title,
        offence_type: DEMO_CASE.offenceType,
        sections: DEMO_CASE.sections,
        police_station: DEMO_CASE.policeStation,
        court_name: DEMO_CASE.courtName,
        summary: DEMO_CASE.summary,
        status: "under_investigation",
        registered_by: ids.police,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Creating the demo case: ${error?.message}`);
    caseId = data.id;
    console.log(`\n  case  ${DEMO_CASE.firNumber} (created)`);
  }

  console.log(`        caseId hash: ${hash}`);

  // ------------------------------------------------------------ assignments
  // Every permission in the system derives from this table, including the
  // defence lawyer's read access. Note the defence entry is read, never write.
  const assignments = [
    { user_id: ids.police, access: "write" },
    { user_id: ids.forensic_lab, access: "write" },
    { user_id: ids.prosecutor, access: "write" },
    { user_id: ids.judge, access: "write" },
    { user_id: ids.defence_lawyer, access: "read" },
    { user_id: ids.accused, access: "read" },
  ].map((a) => ({ ...a, case_id: caseId, assigned_by: ids.court_admin }));

  const { error: assignError } = await db
    .from("case_assignments")
    .upsert(assignments, { onConflict: "case_id,user_id" });
  if (assignError) throw new Error(`Assigning the case: ${assignError.message}`);

  console.log(`        ${assignments.length} participants assigned`);

  // -------------------------------------------------------------------- done
  console.log("\n" + "=".repeat(60));
  console.log("Sign in with any of these. One password for all demo accounts.\n");
  console.log(`  password: ${PASSWORD}\n`);
  for (const user of USERS) {
    const label = user.note === "surety" ? "accused (surety)" : user.role;
    console.log(`  ${user.email.padEnd(34)} ${label}`);
  }

  if (!EMAIL_BASE) {
    console.log(
      "\nNote: these addresses cannot receive email. If LOGIN_OTP_ENABLED is on,\n" +
        "      re-seed with SEED_EMAIL_BASE=you@gmail.com so the codes arrive."
    );
  }
  console.log(
    "\nAadhaar numbers for OTP flows (synthetic, valid checksums):\n" +
      USERS.filter((u) => u.role === "accused")
        .map((u) => `  ${u.email.padEnd(26)} ${u.aadhaar}`)
        .join("\n")
  );
  console.log("\nNext: cd backend && npm run dev\n");
}

main().catch((error) => {
  logger.error("Seed failed", { error: error instanceof Error ? error.message : error });
  console.error(`\n${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
