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
  private static transporter: Transporter | null = null;
  private static initialized = false;

  private static getTransporter(): Transporter | null {
    if (this.initialized) {
      return this.transporter;
    }

    this.initialized = true;
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      try {
        const cleanUser = user.trim();
        const cleanPass = pass.replace(/["']/g, '').trim();

        // IMPORTANT: Do NOT use `service: 'gmail'` — it auto-picks port 465 (SSL)
        // and ignores dns.setDefaultResultOrder, causing ENETUNREACH on IPv6-only paths.
        // Use explicit host + port 587 (STARTTLS) + family:4 (force IPv4) instead.
        const isGmail = host === 'smtp.gmail.com';
        const transportConfig: any = {
          host: isGmail ? 'smtp.gmail.com' : host,
          port: isGmail ? 587 : port,
          secure: false,           // false = STARTTLS on port 587 (not SSL on 465)
          family: 4,               // Force IPv4 — prevents ENETUNREACH on Render's IPv6 paths
          auth: { user: cleanUser, pass: cleanPass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
          tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2',
          },
        };

        this.transporter = nodemailer.createTransport(transportConfig);
        console.log(`[EMAIL] SMTP transporter initialized with host/service: ${host}:${port} for ${cleanUser}`);
      } catch (err) {
        console.error('[EMAIL] Failed to initialize SMTP transporter:', err);
        this.transporter = null;
      }
    } else {
      console.log('[EMAIL] No SMTP credentials configured. Running in development console-logging mode.');
      this.transporter = null;
    }

    return this.transporter;
  }

  private static getSenderAddress(): string {
    const defaultSender = process.env.SMTP_USER ? `"UdtaBirdie" <${process.env.SMTP_USER.trim()}>` : '"UdtaBirdie" <noreply@udtabirdie.com>';
    return process.env.EMAIL_FROM || defaultSender;
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
    const transporter = this.getTransporter();
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

    // 1. Try Resend HTTP API first (port 443, works on Render, free 100/day)
    const resendOk = await this.sendViaResend(
      email,
      `${otp} is your UdtaBirdie verification code`,
      htmlContent,
      textContent,
    );
    if (resendOk) return true;

    // 2. Try Brevo as secondary (port 443, works on Render, free 300/day)
    const brevoOk = await this.sendViaBrevo(
      email,
      `${otp} is your UdtaBirdie verification code`,
      htmlContent,
      textContent,
    );
    if (brevoOk) return true;

    // 2. Fall back to SMTP
    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: this.getSenderAddress(),
          to: email,
          subject: `${otp} is your UdtaBirdie verification code`,
          text: textContent,
          html: htmlContent,
        });
        console.log(`[EMAIL] Verification OTP email dispatched to ${email} (MessageID: ${info.messageId})`);
        return true;
      } catch (err: any) {
        console.error(`[EMAIL] Failed to send verification email to ${email}:`, err.message);
        this.logConsoleOtp(email, username, otp, expiryMinutes);
        return false;
      }
    } else {
      this.logConsoleOtp(email, username, otp, expiryMinutes);
      return true;
    }
  }

  /**
   * Send password recovery email via SMTP
   */
  static async sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
    const transporter = this.getTransporter();

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

    const textContent = `
UdtaBirdie Socials - Password Reset

A password reset was requested for your account. Please use the following link to reset your password:
${resetUrl}

This link is valid for 1 hour. If you did not request this, please ignore this email.
`;

    // 1. Try Resend HTTP API first
    const resendOk = await this.sendViaResend(
      email,
      'Reset your UdtaBirdie password',
      htmlContent,
      textContent,
    );
    if (resendOk) return true;

    // 2. Try Brevo as secondary
    const brevoOk = await this.sendViaBrevo(
      email,
      'Reset your UdtaBirdie password',
      htmlContent,
      textContent,
    );
    if (brevoOk) return true;

    // 2. Fall back to SMTP
    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: this.getSenderAddress(),
          to: email,
          subject: 'Reset your UdtaBirdie password',
          text: textContent,
          html: htmlContent,
        });
        console.log(`[EMAIL] Password reset email dispatched to ${email} (MessageID: ${info.messageId})`);
        return true;
      } catch (err: any) {
        console.error(`[EMAIL] Failed to send reset email to ${email}:`, err.message);
        console.log(`[SECURITY/DEV] Password reset link for ${email}: ${resetUrl}`);
        return false;
      }
    } else {
      console.log(`[SECURITY/DEV] Password reset link for ${email}: ${resetUrl}`);
      return true;
    }
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
