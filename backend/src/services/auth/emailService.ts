import nodemailer, { Transporter } from 'nodemailer';

export interface EmailDispatchResult {
  success: boolean;
  provider: 'resend' | 'brevo' | 'smtp' | 'console' | 'none';
  messageId?: string;
  error?: string;
  details?: any;
}

export class EmailService {
  private static transporter: Transporter | null = null;
  private static initialized = false;
  public static lastDispatchResult: EmailDispatchResult | null = null;

  static getResendApiKey(): string | null {
    const raw = process.env.RESEND_API_KEY ||
      process.env.RESEND_KEY ||
      process.env.RESEND_API ||
      process.env.RESEND ||
      process.env.VITE_RESEND_API_KEY;
    if (!raw) return null;
    return raw.replace(/["']/g, '').trim();
  }

  static getBrevoApiKey(): string | null {
    const raw = process.env.BREVO_API_KEY ||
      process.env.BREVO_KEY ||
      process.env.SENDINBLUE_API_KEY;
    if (!raw) return null;
    return raw.replace(/["']/g, '').trim();
  }

  static getResendFrom(): string {
    const custom = process.env.RESEND_FROM?.replace(/["']/g, '').trim();
    if (custom && !custom.includes('@gmail.com') && !custom.includes('@yahoo.com') && !custom.includes('@hotmail.com')) {
      return custom;
    }
    // Resend free tier strictly requires onboarding@resend.dev unless a custom domain is verified
    return 'UdtaBirdie <onboarding@resend.dev>';
  }

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

        const transportConfig: any = host === 'smtp.gmail.com'
          ? {
              service: 'gmail',
              auth: { user: cleanUser, pass: cleanPass },
              connectionTimeout: 5000,
              greetingTimeout: 5000,
              socketTimeout: 5000,
            }
          : {
              host,
              port,
              secure,
              auth: { user: cleanUser, pass: cleanPass },
              connectionTimeout: 5000,
              greetingTimeout: 5000,
              socketTimeout: 5000,
              tls: {
                rejectUnauthorized: false,
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
   * Unified email dispatcher:
   * 1. Tries Resend HTTP API (immune to cloud SMTP port blocks on port 443)
   * 2. Tries Brevo HTTP API (immune to cloud SMTP port blocks on port 443)
   * 3. Falls back to standard SMTP (subject to cloud firewall restrictions)
   * 4. Logs to console in local/development mode
   */
  static async dispatchEmail(to: string, subject: string, html: string, text: string): Promise<EmailDispatchResult> {
    const errors: string[] = [];

    // 1. Try Resend HTTP API
    const resendKey = this.getResendApiKey();
    if (resendKey) {
      const from = this.getResendFrom();
      console.log(`[EMAIL] Attempting Resend API dispatch to ${to} (from: ${from})...`);
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
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
          console.log(`[EMAIL-HTTP] ✅ Resend delivered successfully! Message ID: ${data.id}`);
          const result: EmailDispatchResult = {
            success: true,
            provider: 'resend',
            messageId: data.id,
            details: data,
          };
          this.lastDispatchResult = result;
          return result;
        } else {
          const errMsg = data.message || `HTTP ${res.status}: ${JSON.stringify(data)}`;
          console.error(`[EMAIL-HTTP] ❌ Resend returned error:`, errMsg);
          errors.push(`Resend: ${errMsg}`);
        }
      } catch (err: any) {
        console.error('[EMAIL-HTTP] ❌ Resend request failed:', err.message);
        errors.push(`Resend network: ${err.message}`);
      }
    }

    // 2. Try Brevo HTTP API
    const brevoKey = this.getBrevoApiKey();
    if (brevoKey) {
      const senderEmail = process.env.SMTP_USER?.trim() || 'udtabirdie@gmail.com';
      console.log(`[EMAIL] Attempting Brevo API dispatch to ${to}...`);
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'UdtaBirdie', email: senderEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text,
          }),
        });
        const data: any = await res.json().catch(() => ({}));
        if (res.ok && data.messageId) {
          console.log(`[EMAIL-HTTP] ✅ Brevo delivered successfully! Message ID: ${data.messageId}`);
          const result: EmailDispatchResult = {
            success: true,
            provider: 'brevo',
            messageId: data.messageId,
            details: data,
          };
          this.lastDispatchResult = result;
          return result;
        } else {
          const errMsg = data.message || `HTTP ${res.status}: ${JSON.stringify(data)}`;
          console.error(`[EMAIL-HTTP] ❌ Brevo returned error:`, errMsg);
          errors.push(`Brevo: ${errMsg}`);
        }
      } catch (err: any) {
        console.error('[EMAIL-HTTP] ❌ Brevo request failed:', err.message);
        errors.push(`Brevo network: ${err.message}`);
      }
    }

    // 3. Fall back to SMTP transporter
    const transporter = this.getTransporter();
    if (transporter) {
      console.log(`[EMAIL] Attempting SMTP dispatch to ${to}...`);
      try {
        const info = await transporter.sendMail({
          from: this.getSenderAddress(),
          to,
          subject,
          text,
          html,
        });
        console.log(`[EMAIL-SMTP] ✅ SMTP delivered successfully! ID: ${info.messageId}`);
        const result: EmailDispatchResult = {
          success: true,
          provider: 'smtp',
          messageId: info.messageId,
        };
        this.lastDispatchResult = result;
        return result;
      } catch (err: any) {
        console.error(`[EMAIL-SMTP] ❌ SMTP failed:`, err.message);
        errors.push(`SMTP (${process.env.SMTP_HOST}): ${err.message}`);
      }
    }

    // 4. If all fail, log to console in development
    this.logConsoleOtp(to, 'User', subject, 10);
    const failureResult: EmailDispatchResult = {
      success: false,
      provider: 'console',
      error: errors.join(' | ') || 'No email delivery provider configured or reachable',
    };
    this.lastDispatchResult = failureResult;
    return failureResult;
  }

  /**
   * Send 6-digit email verification OTP to new account
   */
  static async sendVerificationOtp(email: string, username: string, otp: string): Promise<boolean> {
    const detailed = await this.sendVerificationOtpDetailed(email, username, otp);
    return detailed.success;
  }

  static async sendVerificationOtpDetailed(email: string, username: string, otp: string): Promise<EmailDispatchResult> {
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

    return await this.dispatchEmail(email, `${otp} is your UdtaBirdie verification code`, htmlContent, textContent);
  }

  /**
   * Send password recovery email
   */
  static async sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
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

    const result = await this.dispatchEmail(email, 'Reset your UdtaBirdie password', htmlContent, textContent);
    return result.success;
  }

  private static logConsoleOtp(email: string, username: string, otp: string, expiryMinutes: number): void {
    const separator = '═'.repeat(60);
    console.log(`\n${separator}`);
    console.log('  [EMAIL DISPATCH - DEVELOPMENT / FALLBACK]');
    console.log(`  To: ${username} <${email}>`);
    console.log(`  Subject: ${otp}`);
    console.log(`  OTP Code: ══▶  [  ${otp}  ]  ◀══ (Expires in ${expiryMinutes} mins)`);
    console.log(`${separator}\n`);
  }
}
