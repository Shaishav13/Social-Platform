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
    // Login username = the Brevo account email (BREVO_FROM_EMAIL or SMTP_USER).
    const brevoKey = (process.env.BREVO_API_KEY || '').replace(/["'\s]/g, '');
    const brevoEmail = (process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || '').replace(/["'\s]/g, '');

    if (brevoKey && brevoEmail) {
      try {
        this.brevoTransporter = nodemailer.createTransport({
          host: 'smtp-relay.brevo.com',
          port: 587,
          secure: false,     // STARTTLS
          family: 4,         // Force IPv4 — avoid ENETUNREACH on Render
          auth: { user: brevoEmail, pass: brevoKey },
          connectionTimeout: 12000,
          greetingTimeout: 12000,
          socketTimeout: 15000,
          tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
        } as any);
        console.log(`[EMAIL] ☁️ Brevo SMTP transporter ready (smtp-relay.brevo.com:587) for ${brevoEmail}`);
      } catch (err) {
        console.error('[EMAIL] Failed to initialize Brevo SMTP transporter:', err);
        this.brevoTransporter = null;
      }
    } else {
      console.log('[EMAIL] Brevo SMTP not configured (need BREVO_API_KEY + BREVO_FROM_EMAIL).');
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UdtaBirdie Account Verification</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #121214;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e4e4e7;
    }
    .wrapper {
      width: 100%;
      background-color: #121214;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 36px 32px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      border-bottom: 1px solid #27272a;
      padding-bottom: 16px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #ffffff;
    }
    .hero-text {
      font-size: 22px;
      font-weight: 700;
      color: #fafafa;
      margin: 0 0 12px 0;
    }
    .body-text {
      font-size: 15px;
      line-height: 1.6;
      color: #a1a1aa;
      margin: 0 0 24px 0;
    }
    .otp-box {
      background: linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(225, 29, 72, 0.04) 100%);
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      margin-bottom: 24px;
    }
    .otp-code {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #f43f5e;
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
    }
    .otp-caption {
      font-size: 13px;
      color: #71717a;
      margin-top: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .alert-box {
      background-color: rgba(244, 63, 94, 0.08);
      border-left: 3px solid #f43f5e;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .alert-text {
      font-size: 13px;
      color: #fda4af;
      margin: 0;
      line-height: 1.5;
    }
    .footer {
      border-top: 1px solid #27272a;
      padding-top: 20px;
      margin-top: 24px;
      font-size: 12px;
      color: #52525b;
      line-height: 1.5;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="brand-title">UdtaBirdie Socials</span>
      </div>
      <h1 class="hero-text">Verify Your Email Address</h1>
      <p class="body-text">
        Hello <strong>${username}</strong>, thank you for joining UdtaBirdie. Use the one-time verification code below to confirm your account:
      </p>

      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-caption">Valid for ${expiryMinutes} minutes</div>
      </div>

      <div class="alert-box">
        <p class="alert-text">
          <strong>Security Notice:</strong> Never share this code with anyone. UdtaBirdie staff will never ask for your verification code.
        </p>
      </div>

      <p class="body-text" style="font-size: 13px;">
        If you did not initiate this account registration on UdtaBirdie, you can safely disregard this email.
      </p>

      <div class="footer">
        &copy; ${new Date().getFullYear()} UdtaBirdie Social Platform. All rights reserved.
      </div>
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

    // 1. PRIMARY: Brevo SMTP relay (smtp-relay.brevo.com:587)
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
  static async sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
    this.initTransporters();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { background-color: #121214; font-family: sans-serif; color: #e4e4e7; margin: 0; padding: 30px; }
    .card { max-width: 480px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 30px; }
    .btn { display: inline-block; background: #e11d48; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Reset Your UdtaBirdie Password</h2>
    <p>A password reset was requested for your account. Click the button below to choose a new password:</p>
    <a href="${resetUrl}" class="btn" style="color: #ffffff;">Reset Password</a>
    <p style="font-size: 13px; color: #71717a;">This link is valid for 1 hour. If you did not request a password reset, please ignore this message.</p>
  </div>
</body>
</html>
`;

    const textContent = `UdtaBirdie Socials - Password Reset

A password reset was requested for your account. Reset link:
${resetUrl}

This link is valid for 1 hour. If you did not request this, ignore this email.`;

    const subject = 'Reset your UdtaBirdie password';

    // 1. PRIMARY: Brevo SMTP relay
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

    // 2. FALLBACK: Gmail SMTP
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
