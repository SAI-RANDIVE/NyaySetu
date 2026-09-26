import * as fs from "fs";
import * as path from "path";
import nodemailer, { type Transporter } from "nodemailer";
import { env, capabilities } from "../config/env";
import { logger } from "./logger";
import { db } from "./supabase";
import {
  BRAND,
  LOGO_CID,
  button,
  callout,
  codePanel,
  credentialRow,
  escapeHtml,
  paragraph,
  shell,
  steps,
  strong,
} from "./emailTemplates";

/**
 * Outbound email over SMTP.
 *
 * Three things this module is careful about:
 *
 * 1. **It never logs an address or a code.** `email_log` records a masked
 *    recipient and a status, so "I never received the code" is answerable
 *    without the log becoming a directory of who is on bail.
 *
 * 2. **It degrades rather than failing.** If SMTP is not configured, sending
 *    returns `skipped` and the caller decides what that means. Login MFA treats
 *    it as "MFA unavailable, fall through to password-only"; a summons
 *    notification treats it as "nothing to do". Neither crashes.
 *
 * 3. **It verifies the connection once, lazily.** A wrong app password is the
 *    most common misconfiguration here, and finding out on the first real OTP is
 *    worse than finding out at boot.
 */

export interface SendResult {
  status: "sent" | "failed" | "skipped";
  messageId?: string;
  error?: string;
}

let transporter: Transporter | null = null;
let verified: boolean | null = null;

/**
 * The logo, attached inline rather than hotlinked.
 *
 * Most clients block remote images by default, and the project has no public
 * host to serve one from anyway. An inline attachment referenced by Content-ID
 * renders on first open, offline, with no "show images" prompt.
 *
 * Read once at module load: it is 8 KB and never changes.
 */
const LOGO_PATH = path.resolve(__dirname, "..", "assets", "email-logo.png");

let logoBuffer: Buffer | null = null;
try {
  logoBuffer = fs.readFileSync(LOGO_PATH);
} catch {
  // Not fatal. The message still sends; the header simply shows no mark.
  logger.warn("Email logo not found; messages will send without it", { path: LOGO_PATH });
}

function attachments() {
  if (!logoBuffer) return undefined;
  return [
    {
      filename: "nyaysetu.png",
      content: logoBuffer,
      cid: LOGO_CID,
      contentDisposition: "inline" as const,
    },
  ];
}

function build(): Transporter | null {
  if (!capabilities.smtp) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Port 465 is implicit TLS. 587 starts plaintext and upgrades with
    // STARTTLS, which nodemailer does automatically when secure is false.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    // A hung SMTP handshake must not hold an HTTP request open indefinitely.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return transporter;
}

/** Confirms the credentials work. Called once, on the first send. */
export async function verifyTransport(): Promise<{ ok: boolean; error?: string }> {
  const transport = build();
  if (!transport) return { ok: false, error: "SMTP is not configured." };
  if (verified === true) return { ok: true };

  try {
    await transport.verify();
    verified = true;
    logger.info("SMTP transport verified", { host: env.SMTP_HOST, port: env.SMTP_PORT });
    return { ok: true };
  } catch (error) {
    verified = false;
    const message = error instanceof Error ? error.message : "unknown SMTP error";
    logger.error("SMTP verification failed", {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // Gmail returns "Username and Password not accepted" for a normal
      // password used where an App Password is required, which is the single
      // most common cause of this.
      hint: /username and password not accepted|invalid login|535/i.test(message)
        ? "For Gmail, SMTP_PASSWORD must be a 16-character App Password, not the account password, and 2-Step Verification must be on."
        : undefined,
    });
    return { ok: false, error: message };
  }
}

/**
 * Masks an address for display and for the log: `apurva@gmail.com` becomes
 * `a••••a@gmail.com`. Enough for a person to recognise their own address,
 * not enough to harvest.
 */
export function maskEmail(address: string): string {
  const [local, domain] = address.split("@");
  if (!domain) return "•••";
  if (local.length <= 2) return `${local[0] ?? "•"}•••@${domain}`;
  return `${local[0]}${"•".repeat(Math.min(6, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

async function record(args: {
  userId?: string | null;
  purpose: string;
  to: string;
  subject: string;
  result: SendResult;
}) {
  try {
    await db.from("email_log").insert({
      user_id: args.userId ?? null,
      purpose: args.purpose,
      masked_to: maskEmail(args.to),
      subject: args.subject,
      status: args.result.status,
      provider_id: args.result.messageId ?? null,
      error: args.result.error?.slice(0, 400) ?? null,
    });
  } catch (error) {
    // A logging failure must not break the thing being logged.
    logger.warn("Could not write email_log", {
      purpose: args.purpose,
      error: error instanceof Error ? error.message : error,
    });
  }
}

async function send(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
  purpose: string;
  userId?: string | null;
}): Promise<SendResult> {
  const transport = build();

  if (!transport) {
    const result: SendResult = { status: "skipped", error: "SMTP is not configured." };
    await record({ ...args, result });
    return result;
  }

  const check = await verifyTransport();
  if (!check.ok) {
    const result: SendResult = { status: "failed", error: check.error };
    await record({ ...args, result });
    return result;
  }

  try {
    const info = await transport.sendMail({
      from: env.SMTP_FROM ?? `NyaySetu <${env.SMTP_USER}>`,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      attachments: attachments(),
      // Marks the message as automatic so replies and vacation responders do
      // not bounce back into the mailbox.
      headers: { "Auto-Submitted": "auto-generated", "X-NyaySetu-Purpose": args.purpose },
    });

    const result: SendResult = { status: "sent", messageId: info.messageId };
    await record({ ...args, result });
    logger.info("Email sent", { purpose: args.purpose, to: maskEmail(args.to) });
    return result;
  } catch (error) {
    const result: SendResult = {
      status: "failed",
      error: error instanceof Error ? error.message : "unknown SMTP error",
    };
    await record({ ...args, result });
    logger.error("Email send failed", {
      purpose: args.purpose,
      to: maskEmail(args.to),
      error: result.error,
    });
    return result;
  }
}

/* ======================================================= templates ======== */

/**
 * Every message is built from the pieces in emailTemplates.ts, and every one
 * ships a text/plain alternative alongside the HTML. A client with images and
 * HTML disabled must still show a usable code: that is the whole reason the
 * plain part is written out by hand rather than stripped from the markup.
 */

/** The login second factor. */
export async function sendLoginOtp(args: {
  to: string;
  userId: string;
  fullName: string;
  code: string;
  ttlMinutes: number;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<SendResult> {
  const first = args.fullName.split(" ")[0] || "there";

  const text = [
    `Hello ${first},`,
    "",
    `Your NyaySetu sign-in code is ${args.code}`,
    "",
    `It expires in ${args.ttlMinutes} minutes and can be used once.`,
    args.ip ? `Requested from ${args.ip}.` : "",
    "",
    "If this was not you, somebody else may know your password. Change it and",
    "tell the court administrator.",
  ]
    .filter(Boolean)
    .join("\n");

  return send({
    to: args.to,
    userId: args.userId,
    purpose: "login_mfa",
    subject: `${args.code} is your NyaySetu sign-in code`,
    text,
    html: shell({
      title: "Your sign-in code",
      kicker: "Verify it is you",
      tone: "green",
      body:
        paragraph(`Hello ${escapeHtml(first)}, use this code to finish signing in.`) +
        codePanel(args.code) +
        paragraph(
          `It expires in ${strong(`${args.ttlMinutes} minutes`)} and can be used once.` +
            (args.ip
              ? ` Requested from <span style="color:${BRAND.text};">${escapeHtml(args.ip)}</span>.`
              : "")
        ) +
        callout(
          "The code is tied to the browser that entered your password, so it cannot be " +
            "redeemed anywhere else even if somebody else reads this inbox.",
          "green"
        ),
      footnote:
        "If this was not you, somebody else may know your password. Change it and tell the court administrator.",
    }),
  });
}

/**
 * The invitation a new account receives.
 *
 * This is the only moment a password travels by email, which is why the one it
 * carries is temporary and single-use. The message says so plainly rather than
 * burying it, because a recipient who does not understand that will leave it in
 * their inbox.
 */
export async function sendInvitation(args: {
  to: string;
  userId: string;
  fullName: string;
  roleLabel: string;
  temporaryPassword: string;
  invitedByName: string;
  portalUrl: string;
}): Promise<SendResult> {
  const first = args.fullName.split(" ")[0] || "there";

  const text = [
    `${first},`,
    "",
    `${args.invitedByName} has created a NyaySetu account for you as ${args.roleLabel}.`,
    "",
    `Sign in at: ${args.portalUrl}`,
    `Email:      ${args.to}`,
    `Password:   ${args.temporaryPassword}`,
    "",
    "This password works once. You will be asked to choose your own before you",
    "can go any further.",
    "",
    "Signing in takes two steps: this password, then a six digit code sent to",
    "this same address. Nobody can reach your account with the password alone.",
    "",
    "If you were not expecting this, tell the court administrator. Do not sign in.",
  ].join("\n");

  return send({
    to: args.to,
    userId: args.userId,
    purpose: "invitation",
    subject: `Your NyaySetu account: ${args.roleLabel}`,
    text,
    html: shell({
      title: "An account has been created for you",
      kicker: "Welcome",
      tone: "green",
      body:
        paragraph(
          `${escapeHtml(first)}, ${escapeHtml(args.invitedByName)} has created a NyaySetu account ` +
            `for you as ${strong(args.roleLabel)}.`
        ) +
        credentialRow("Email", args.to) +
        credentialRow("Temporary password", args.temporaryPassword) +
        callout(
          `This password works ${strong("once")}. You will be asked to choose your own before you can ` +
            "go any further, so it stops being useful the moment you have used it.",
          "orange"
        ) +
        steps([
          "Open the sign-in page and enter the address and password above.",
          "A six digit code arrives at this same address. Enter it.",
          "Choose a password of your own. That is the one you keep.",
        ]) +
        button(args.portalUrl, "Sign in", "green"),
      footnote:
        "If you were not expecting this, tell the court administrator and do not sign in.",
    }),
  });
}

/** Tells a recipient a summons exists, without putting its contents in email. */
export async function sendSummonsNotice(args: {
  to: string;
  userId?: string | null;
  recipientName: string;
  firNumber: string;
  courtName: string | null;
  expiryAt: string;
  portalUrl: string;
}): Promise<SendResult> {
  const deadline = new Date(args.expiryAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const text = [
    `${args.recipientName},`,
    "",
    `A summons has been issued to you in ${args.firNumber}${args.courtName ? ` by ${args.courtName}` : ""}.`,
    "",
    `You must acknowledge it by ${deadline}. If that window closes without your`,
    "acknowledgement, the court is notified that it could not be served and may",
    "proceed on that basis.",
    "",
    `Sign in to read and acknowledge it: ${args.portalUrl}`,
    "",
    "The summons itself is not attached. It is readable only after you sign in.",
  ].join("\n");

  return send({
    to: args.to,
    userId: args.userId,
    purpose: "summons_notice",
    subject: `Action needed: summons in ${args.firNumber}`,
    text,
    html: shell({
      title: "A summons has been issued to you",
      kicker: "Action needed",
      tone: "orange",
      body:
        paragraph(
          `${escapeHtml(args.recipientName)}, a summons has been issued to you in ` +
            `${strong(args.firNumber)}${args.courtName ? ` by ${escapeHtml(args.courtName)}` : ""}.`
        ) +
        callout(
          `Acknowledge it by ${strong(deadline)}. If the window closes unanswered, the court is ` +
            "told it could not be served and may proceed on that basis.",
          "orange"
        ) +
        button(args.portalUrl, "Read and acknowledge", "orange"),
      footnote: "The summons itself is not attached. It is readable only after you sign in.",
    }),
  });
}

/** Warns the court that an acknowledgement window closed unanswered. */
export async function sendNonDeliveryAlert(args: {
  to: string;
  userId?: string | null;
  recipientName: string;
  firNumber: string;
  expiryAt: string;
  portalUrl: string;
}): Promise<SendResult> {
  const closed = new Date(args.expiryAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const text = [
    `The acknowledgement window for a summons in ${args.firNumber} closed at`,
    `${closed} without a response.`,
    "",
    `Recipient: ${args.recipientName}`,
    "",
    "The contract now reports this summons as FAILED, and that conclusion is",
    "recorded on chain.",
    "",
    args.portalUrl,
  ].join("\n");

  return send({
    to: args.to,
    userId: args.userId,
    purpose: "non_delivery_alert",
    subject: `Summons not served: ${args.firNumber}`,
    text,
    html: shell({
      title: "A summons went unanswered",
      kicker: "Service failed",
      tone: "orange",
      body:
        paragraph(
          `The acknowledgement window for a summons in ${strong(args.firNumber)} closed at ` +
            `${strong(closed)} without a response.`
        ) +
        callout(
          `${strong("Recipient:")} ${escapeHtml(args.recipientName)}<br>` +
            "The contract now reports this summons as FAILED, and that conclusion is on chain.",
          "red"
        ) +
        button(args.portalUrl, "Open the summons register", "green"),
    }),
  });
}

/** For the admin dashboard and /api/health. */
export async function mailerHealth(): Promise<{
  configured: boolean;
  reachable: boolean;
  host?: string;
  from?: string;
  error?: string;
}> {
  if (!capabilities.smtp) return { configured: false, reachable: false };
  const check = await verifyTransport();
  return {
    configured: true,
    reachable: check.ok,
    host: `${env.SMTP_HOST}:${env.SMTP_PORT}`,
    from: env.SMTP_FROM ?? env.SMTP_USER,
    error: check.error,
  };
}
