import dns from 'dns';
import nodemailer, { Transporter } from 'nodemailer';

// Force Node.js DNS to resolve IPv4 addresses first.
// Prevents ENETUNREACH network unreachable errors on cloud hosting (Render/Docker)
// where outbound IPv6 routes are unavailable.
try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch (_) {
  // Ignore in environments where setDefaultResultOrder is not available
}

export class EmailService {
  private static brevoTransporter: Transporter | null = null;
  private static gmailTransporter: Transporter | null = null;
  private static initialized = false;

  private static initTransporters(): void {
    if (this.initialized) return;
    this.initialized = true;

    // ── Brevo SMTP relay ────────────────────────────────────────────────────
    // The BREVO_API_KEY env var starting with "xsmtpsib-" IS a Brevo SMTP password.
    // Brevo SMTP relay (smtp-relay.brevo.com:587) works from Render (port never blocked),
    // sends to ANY recipient, and doesn't need a verified custom domain.
    // SMTP login username = your Brevo ACCOUNT email (top-right in Brevo dashboard).
    // This may differ from the sender address. Set BREVO_SMTP_USER to override.
    const brevoKey = (process.env.BREVO_API_KEY || '').replace(/["'\s]/g, '');
    const brevoSmtpUser = (
      process.env.BREVO_SMTP_USER ||   // Explicit Brevo account email override
      process.env.BREVO_FROM_EMAIL ||   // Sender email (usually same as account email)
      process.env.SMTP_USER ||          // Gmail fallback
      ''
    ).replace(/["'\s]/g, '');

    if (brevoKey && brevoSmtpUser) {
      try {
        this.brevoTransporter = nodemailer.createTransport({
          host: 'smtp-relay.brevo.com',
          port: 587,
          secure: false,     // STARTTLS
          family: 4,         // Force IPv4 — avoid ENETUNREACH on Render
          auth: { user: brevoSmtpUser, pass: brevoKey },
          connectionTimeout: 12000,
          greetingTimeout: 12000,
          socketTimeout: 15000,
          tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
        } as any);
        console.log(`[EMAIL] ☁️ Brevo SMTP ready → smtp-relay.brevo.com:587 (login: ${brevoSmtpUser})`);
      } catch (err) {
        console.error('[EMAIL] Failed to initialize Brevo SMTP transporter:', err);
        this.brevoTransporter = null;
      }
    } else {
      if (!brevoKey) console.log('[EMAIL] Brevo SMTP skipped: BREVO_API_KEY not set.');
      else console.log('[EMAIL] Brevo SMTP skipped: no login email (set BREVO_SMTP_USER or BREVO_FROM_EMAIL).');
    }

    // ── Gmail SMTP fallback ──────────────────────────────────────────────────
    // Used only if Brevo is unavailable. Requires an App Password (not regular password).
    // Explicit host+port 587 + family:4 avoids the IPv6/ENETUNREACH issue on Render.
    const gmailHost = process.env.SMTP_HOST;
    const gmailUser = process.env.SMTP_USER;
    const gmailPass = process.env.SMTP_PASS;

    if (gmailHost && gmailUser && gmailPass) {
      try {
        const cleanUser = gmailUser.trim();
        const cleanPass = gmailPass.replace(/["']/g, '').trim();
        this.gmailTransporter = nodemailer.createTransport({
          host: gmailHost,
          port: 587,
          secure: false,
          family: 4,
          auth: { user: cleanUser, pass: cleanPass },
          connectionTimeout: 12000,
          greetingTimeout: 12000,
          socketTimeout: 15000,
          tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
        } as any);
        console.log(`[EMAIL] 📧 Gmail SMTP fallback ready (${gmailHost}:587) for ${cleanUser}`);
      } catch (err) {
        console.error('[EMAIL] Failed to initialize Gmail SMTP transporter:', err);
        this.gmailTransporter = null;
      }
    }
  }

  // ── Brevo REST API (Port 443 — works on Render Free) ──────────────────────
  // Requires an API key starting with 'xkeysib-' (not an SMTP password).
  private static async sendViaBrevoRest(to: string, subject: string, html: string, text: string): Promise<boolean> {
    const apiKey = (process.env.BREVO_API_KEY || '').replace(/["'\s]/g, '');
    // Only attempt REST if key starts with xkeysib- (Brevo API key format)
    if (!apiKey.startsWith('xkeysib-')) {
      return false;
    }

    const fromEmail = (process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || '').replace(/["'\s]/g, '');
    const fromName = (process.env.BREVO_FROM_NAME || 'UdtaBirdie').replace(/["']/g, '');

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data.messageId) {
        console.log(`[EMAIL-BREVO-REST] ✅ Delivered to ${to} (Message ID: ${data.messageId})`);
        return true;
      }
      console.error(`[EMAIL-BREVO-REST] ❌ Error ${res.status}:`, data.message || JSON.stringify(data));
      return false;
    } catch (err: any) {
      console.error('[EMAIL-BREVO-REST] ❌ Request failed:', err.message);
      return false;
    }
  }

  private static getBrevoSender(): string {
    const email = (process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || '').replace(/["'\s]/g, '');
    const name = (process.env.BREVO_FROM_NAME || 'UdtaBirdie').replace(/["']/g, '');
    return email ? `"${name}" <${email}>` : '"UdtaBirdie" <noreply@udtabirdie.com>';
  }

  private static getGmailSender(): string {
    const email = (process.env.SMTP_USER || '').trim();
    return process.env.EMAIL_FROM || (email ? `"UdtaBirdie" <${email}>` : '"UdtaBirdie" <noreply@udtabirdie.com>');
  }

  /**
   * Send email via Resend HTTP API (port 443 — never blocked by Render/cloud firewalls).
   * Free tier (no custom domain): must send FROM onboarding@resend.dev → can reach ANY recipient, 100 emails/day.
   * With a verified custom domain: use your own FROM address.
   * RESEND_FROM_EMAIL env var: only needed if you have a verified Resend domain. Otherwise onboarding@resend.dev is used.
   */
  private static async sendViaResend(to: string, subject: string, html: string, text: string): Promise<boolean> {
    const apiKey = (process.env.RESEND_API_KEY || process.env.RESEND_KEY || '').replace(/["'\s]/g, '');
    if (!apiKey) {
      console.log('[EMAIL-RESEND] No RESEND_API_KEY configured, skipping.');
      return false;
    }

    // On Resend free tier (no verified domain), you MUST send FROM onboarding@resend.dev.
    // Using a gmail or other unverified address as FROM causes a 422 "Domain is not verified" error.
    // Only override this if RESEND_FROM_EMAIL is a verified Resend domain (not gmail/yahoo/etc).
    const customFromEmail = (process.env.RESEND_FROM_EMAIL || '').replace(/["'\s]/g, '');
    const isVerifiedDomain = customFromEmail && 
      !customFromEmail.includes('@gmail.') && 
      !customFromEmail.includes('@yahoo.') && 
      !customFromEmail.includes('@hotmail.') && 
      !customFromEmail.includes('@outlook.');

    const fromEmail = isVerifiedDomain ? customFromEmail : 'onboarding@resend.dev';
    const fromName = isVerifiedDomain 
      ? (process.env.RESEND_FROM_NAME || 'UdtaBirdie').replace(/["']/g, '')
      : 'UdtaBirdie';
    const from = `${fromName} <${fromEmail}>`;

    try {
      console.log(`[EMAIL-RESEND] Attempting Resend dispatch from=${from} to=${to}...`);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
        }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        console.log(`[EMAIL-RESEND] ✅ Delivered! Email ID: ${data.id}`);
        return true;
      }
      console.error(`[EMAIL-RESEND] ❌ Error ${res.status}:`, JSON.stringify(data));
      return false;
    } catch (err: any) {
      console.error('[EMAIL-RESEND] ❌ Request failed:', err.message);
      return false;
    }
  }

  /**
   * Send email via Brevo (formerly Sendinblue) HTTP API.
   * Works on Render/cloud (port 443, never blocked).
   * Only requires a verified single sender email — NO domain ownership needed.
   * Free plan: 300 emails/day.
   */
  private static async sendViaBrevo(to: string, subject: string, html: string, text: string): Promise<boolean> {
    const apiKey = (process.env.BREVO_API_KEY || '').replace(/["'\s]/g, '');
    if (!apiKey) {
      console.log('[EMAIL-BREVO] No BREVO_API_KEY configured, skipping.');
      return false;
    }

    const fromEmail = (process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || '').replace(/["'\s]/g, '');
    const fromName = (process.env.BREVO_FROM_NAME || 'UdtaBirdie').replace(/["']/g, '');

    if (!fromEmail) {
      console.error('[EMAIL-BREVO] ❌ BREVO_FROM_EMAIL not configured');
      return false;
    }

    try {
      console.log(`[EMAIL-BREVO] Attempting Brevo dispatch to ${to}...`);
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data.messageId) {
        console.log(`[EMAIL-BREVO] ✅ Delivered! Message ID: ${data.messageId}`);
        return true;
      }
      console.error(`[EMAIL-BREVO] ❌ Error ${res.status}:`, data.message || JSON.stringify(data));
      return false;
    } catch (err: any) {
      console.error('[EMAIL-BREVO] ❌ Request failed:', err.message);
      return false;
    }
  }

  /**
   * Send 6-digit email verification OTP to new account via SMTP
   */
  static async sendVerificationOtp(email: string, username: string, otp: string): Promise<boolean> {
    // Initialize transporters (idempotent — safe to call multiple times)
    this.initTransporters();

    const expiryMinutes = 10;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #333333; margin: 0; padding: 20px; background-color: #f9f9f9; }
    .container { max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #eaeaea; border-radius: 8px; padding: 30px; }
    .header { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #111111; }
    .body-text { font-size: 15px; line-height: 1.5; color: #555555; margin-bottom: 24px; }
    .otp-code { font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #111111; text-align: center; background: #f4f4f5; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
    .footer { border-top: 1px solid #eaeaea; padding-top: 20px; font-size: 13px; color: #999999; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">UdtaBirdie Socials</div>
    <p class="body-text">
      Hi <strong>${username}</strong>,<br><br>
      Please use the verification code below to confirm your email address. This code is valid for ${expiryMinutes} minutes.
    </p>
    <div class="otp-code">${otp}</div>
    <p class="body-text" style="font-size: 14px;">
      If you did not sign up for an account, you can safely ignore this email.
    </p>
    <div class="footer">
      &copy; ${new Date().getFullYear()} UdtaBirdie Socials
    </div>
  </div>
</body>
</html>
`;

    const textContent = `
UdtaBirdie Socials - Account Verification

Hello ${username},

Your verification code is: ${otp}

This code is valid for ${expiryMinutes} minutes.

Security Notice: Never share this code with anyone. UdtaBirdie staff will never ask for your code.
If you did not sign up for UdtaBirdie, please ignore this email.
`;

    const subject = `${otp} is your UdtaBirdie verification code`;

    // 0. PRIMARY REST API: Brevo (port 443, works on Render, requires xkeysib- key)
    if (await this.sendViaBrevoRest(email, subject, htmlContent, textContent)) {
      return true;
    }

    // 1. SECONDARY: Brevo SMTP relay (smtp-relay.brevo.com:587)
    //    Uses xsmtpsib- key as SMTP password. Works on Render. Sends to any email.
    if (this.brevoTransporter) {
      try {
        const info = await this.brevoTransporter.sendMail({
          from: this.getBrevoSender(),
          to: email,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`[EMAIL-BREVO-SMTP] ✅ OTP dispatched to ${email} (MsgID: ${info.messageId})`);
        return true;
      } catch (err: any) {
        console.error(`[EMAIL-BREVO-SMTP] ❌ Failed: ${err.message}`);
      }
    }

    // 2. FALLBACK: Gmail SMTP (smtp.gmail.com:587 + App Password)
    if (this.gmailTransporter) {
      try {
        const info = await this.gmailTransporter.sendMail({
          from: this.getGmailSender(),
          to: email,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`[EMAIL-GMAIL-SMTP] ✅ OTP dispatched to ${email} (MsgID: ${info.messageId})`);
        return true;
      } catch (err: any) {
        console.error(`[EMAIL-GMAIL-SMTP] ❌ Failed: ${err.message}`);
      }
    }

    // 3. No transporter worked — log OTP to console (dev/fallback)
    this.logConsoleOtp(email, username, otp, expiryMinutes);
    return false;
  }

  /**
   * Send password recovery email
   */
  /**
   * Send password recovery email
   */
  static async sendPasswordResetEmail(email: string, resetUrl: string, token?: string): Promise<boolean> {
    this.initTransporters();

    // Extract token if not explicitly passed
    let recoveryToken = token || '';
    if (!recoveryToken) {
      try {
        const parsed = new URL(resetUrl);
        recoveryToken = parsed.searchParams.get('token') || '';
      } catch (_) {}
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your UdtaBirdie password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #222222; margin: 0; padding: 24px; background-color: #f6f5f3;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e3dc; border-radius: 8px; padding: 36px 30px;">
    <div style="font-size: 22px; font-weight: 700; margin-bottom: 20px; color: #1a1918; letter-spacing: -0.02em;">
      UdtaBirdie
    </div>
    <p style="font-size: 15px; line-height: 1.6; color: #444444; margin-bottom: 24px;">
      A password reset was requested for your UdtaBirdie account (<strong>${email}</strong>). Click the button below to choose your new password:
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #832729; color: #ffffff; text-decoration: none; padding: 13px 30px; border-radius: 6px; font-weight: 600; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Reset Password
      </a>
    </div>
    <p style="font-size: 13px; line-height: 1.5; color: #666666; margin-bottom: 16px;">
      If the button above does not work in your email app, copy and paste this link into your browser:
    </p>
    <p style="font-size: 13px; line-height: 1.4; color: #832729; word-break: break-all; margin-bottom: 24px; background-color: #faf9f6; padding: 10px 12px; border-radius: 4px; border: 1px solid #eee;">
      <a href="${resetUrl}" style="color: #832729; text-decoration: underline;">${resetUrl}</a>
    </p>
    ${recoveryToken ? `
    <div style="background-color: #f7f6f2; border: 1px dashed #d5d3cc; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #777; margin: 0 0 6px 0; font-weight: 600;">
        Manual Recovery Token
      </p>
      <code style="font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #111111; word-break: break-all;">${recoveryToken}</code>
    </div>
    ` : ''}
    <p style="font-size: 13px; line-height: 1.5; color: #888888; margin-bottom: 0;">
      This password reset link is valid for <strong>1 hour</strong>. If you did not request a password reset, no further action is needed and your account remains secure.
    </p>
    <div style="border-top: 1px solid #eae7df; padding-top: 20px; font-size: 12px; color: #999999; text-align: center; margin-top: 28px;">
      &copy; ${new Date().getFullYear()} UdtaBirdie. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

    const textContent = `UdtaBirdie - Password Reset

A password reset was requested for your account (${email}).

Reset link:
${resetUrl}

${recoveryToken ? `Manual Recovery Token:\n${recoveryToken}\n\n` : ''}
This link is valid for 1 hour. If you did not request this, you can safely ignore this message.`;

    const subject = 'Reset your UdtaBirdie password';

    // 0. PRIMARY REST API: Brevo (port 443, works on Render, requires xkeysib- key)
    if (await this.sendViaBrevoRest(email, subject, htmlContent, textContent)) {
      return true;
    }

    // 1. SECONDARY REST API: Resend (port 443, works on cloud hosting)
    if (await this.sendViaResend(email, subject, htmlContent, textContent)) {
      return true;
    }

    // 2. TERTIARY: Brevo SMTP relay
    if (this.brevoTransporter) {
      try {
        const info = await this.brevoTransporter.sendMail({
          from: this.getBrevoSender(),
          to: email,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`[EMAIL-BREVO-SMTP] ✅ Password reset dispatched to ${email} (MsgID: ${info.messageId})`);
        return true;
      } catch (err: any) {
        console.error(`[EMAIL-BREVO-SMTP] ❌ Failed: ${err.message}`);
      }
    }

    // 3. FALLBACK: Gmail SMTP
    if (this.gmailTransporter) {
      try {
        const info = await this.gmailTransporter.sendMail({
          from: this.getGmailSender(),
          to: email,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`[EMAIL-GMAIL-SMTP] ✅ Password reset dispatched to ${email} (MsgID: ${info.messageId})`);
        return true;
      } catch (err: any) {
        console.error(`[EMAIL-GMAIL-SMTP] ❌ Failed: ${err.message}`);
      }
    }

    console.log(`[SECURITY/DEV] Password reset link for ${email}: ${resetUrl}`);
    return false;
  }

  private static logConsoleOtp(email: string, username: string, otp: string, expiryMinutes: number): void {
    const separator = '═'.repeat(60);
    console.log(`\n${separator}`);
    console.log('  [EMAIL DISPATCH - DEVELOPMENT / FALLBACK]');
    console.log(`  To: ${username} <${email}>`);
    console.log(`  Subject: ${otp} is your UdtaBirdie verification code`);
    console.log(`  OTP Code: ══▶  [  ${otp}  ]  ◀══ (Expires in ${expiryMinutes} mins)`);
    console.log(`${separator}\n`);
  }
}
