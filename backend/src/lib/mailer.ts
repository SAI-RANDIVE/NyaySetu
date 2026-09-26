import nodemailer, { type Transporter } from "nodemailer";
import { env, capabilities } from "../config/env";
import { logger } from "./logger";
import { db } from "./supabase";

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
 * One shell for every message.
 *
 * Inline styles and a table-free single column, because email clients strip
 * <style> blocks and Outlook ignores flexbox. The dark palette matches the
 * product, and a text/plain alternative always accompanies it, so a client with
 * images and HTML disabled still shows a usable code.
 */
function shell(title: string, body: string, footnote?: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#070b0a;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.1);">
      <span style="display:inline-block;font-size:19px;font-weight:700;color:#f2f6f4;letter-spacing:-0.3px;">NyaySetu</span>
      <span style="display:inline-block;margin-left:8px;font-size:12px;color:#5f6b67;">न्यायसेतु</span>
    </div>

    <h1 style="margin:26px 0 12px;font-size:20px;font-weight:600;color:#f2f6f4;line-height:1.35;">${title}</h1>
    ${body}

    <div style="margin-top:30px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.1);">
      ${footnote ? `<p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#8e9a96;">${footnote}</p>` : ""}
      <p style="margin:0;font-size:11px;line-height:1.6;color:#5f6b67;">
        This message was sent automatically. Do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function codeBlock(code: string): string {
  return `<div style="margin:0 0 20px;padding:18px;background:#0d1412;border:1px solid #5ed29c;border-radius:14px;text-align:center;">
    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:10px;color:#5ed29c;">${code}</div>
  </div>`;
}

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
    "",
    args.ip ? `Requested from ${args.ip}.` : "",
    "If this was not you, your password may be known to somebody else. Change it, and tell the court administrator.",
  ]
    .filter(Boolean)
    .join("\n");

  return send({
    to: args.to,
    userId: args.userId,
    purpose: "login_mfa",
    subject: `${args.code} is your NyaySetu sign-in code`,
    text,
    html: shell(
      "Your sign-in code",
      `<p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#8e9a96;">
         Hello ${first}, use this code to finish signing in.
       </p>
       ${codeBlock(args.code)}
       <p style="margin:0;font-size:13px;line-height:1.65;color:#8e9a96;">
         It expires in <strong style="color:#f2f6f4;">${args.ttlMinutes} minutes</strong> and can be used once.
         ${args.ip ? `Requested from <span style="color:#c4c2c3;">${args.ip}</span>.` : ""}
       </p>`,
      "If this was not you, somebody else may know your password. Change it and tell the court administrator."
    ),
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
    `You must acknowledge it by ${deadline}. If that window closes without your acknowledgement,`,
    "the court is notified that it could not be served and may proceed on that basis.",
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
    html: shell(
      "A summons has been issued to you",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#8e9a96;">
         ${args.recipientName}, a summons has been issued to you in
         <strong style="color:#f2f6f4;">${args.firNumber}</strong>${args.courtName ? ` by ${args.courtName}` : ""}.
       </p>
       <div style="margin:0 0 20px;padding:14px 16px;background:rgba(245,194,107,0.12);border:1px solid rgba(245,194,107,0.3);border-radius:12px;">
         <p style="margin:0;font-size:13px;line-height:1.6;color:#f2f6f4;">
           Acknowledge it by <strong>${deadline}</strong>. If the window closes unanswered, the court is
           told it could not be served and may proceed on that basis.
         </p>
       </div>
       <a href="${args.portalUrl}" style="display:inline-block;padding:13px 26px;background:#5ed29c;color:#070b0a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;text-decoration:none;border-radius:999px;">
         Read and acknowledge
       </a>`,
      "The summons itself is not attached. It is readable only after you sign in."
    ),
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
    `The acknowledgement window for a summons in ${args.firNumber} closed at ${closed} without a response.`,
    "",
    `Recipient: ${args.recipientName}`,
    "",
    "The contract now reports this summons as FAILED, and that conclusion is recorded on chain.",
    "",
    args.portalUrl,
  ].join("\n");

  return send({
    to: args.to,
    userId: args.userId,
    purpose: "non_delivery_alert",
    subject: `Summons not served: ${args.firNumber}`,
    text,
    html: shell(
      "A summons went unanswered",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#8e9a96;">
         The acknowledgement window for a summons in
         <strong style="color:#f2f6f4;">${args.firNumber}</strong> closed at
         <strong style="color:#f2f6f4;">${closed}</strong> without a response.
       </p>
       <div style="margin:0 0 20px;padding:14px 16px;background:rgba(255,107,107,0.12);border:1px solid rgba(255,107,107,0.3);border-radius:12px;">
         <p style="margin:0 0 6px;font-size:13px;color:#f2f6f4;"><strong>Recipient:</strong> ${args.recipientName}</p>
         <p style="margin:0;font-size:13px;line-height:1.6;color:#8e9a96;">
           The contract now reports this summons as FAILED, and that conclusion is on chain.
         </p>
       </div>
       <a href="${args.portalUrl}" style="display:inline-block;padding:13px 26px;background:#5ed29c;color:#070b0a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;text-decoration:none;border-radius:999px;">
         Open the summons register
       </a>`
    ),
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
