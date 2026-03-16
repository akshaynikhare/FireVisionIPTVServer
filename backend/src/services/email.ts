import nodemailer, { Transporter } from 'nodemailer';
import Handlebars from 'handlebars';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}

interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  variables: Record<string, string>;
}

// ---------------------------------------------------------------------------
// SMTP transporter (singleton)
// ---------------------------------------------------------------------------

let transporter: Transporter | null = null;

function getSmtpConfig(): SmtpConfig {
  const provider = (process.env.MAIL_PROVIDER || 'mailhog').toLowerCase();

  if (provider === 'brevo') {
    return {
      host: process.env.BREVO_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.BREVO_PORT || '587', 10),
      secure: false, // STARTTLS
      auth: {
        user: process.env.BREVO_USER || '',
        pass: process.env.BREVO_PASSWORD || '',
      },
    };
  }

  // mailhog (default)
  return {
    host: process.env.MAILHOG_HOST || 'localhost',
    port: parseInt(process.env.MAILHOG_PORT || '1025', 10),
    secure: false,
  };
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport(getSmtpConfig());
  }
  return transporter;
}

// ---------------------------------------------------------------------------
// Template loading & caching
// ---------------------------------------------------------------------------

const TEMPLATE_DIR = path.resolve(__dirname, '../templates/email');
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

let baseHtml: string | null = null;

function getBaseHtml(): string {
  if (!baseHtml) {
    baseHtml = fs.readFileSync(path.join(TEMPLATE_DIR, 'base.html'), 'utf-8');
  }
  return baseHtml;
}

function loadTemplate(name: string): HandlebarsTemplateDelegate {
  const cached = templateCache.get(name);
  if (cached) return cached;

  const bodyHtml = fs.readFileSync(path.join(TEMPLATE_DIR, `${name}.html`), 'utf-8');
  const fullHtml = getBaseHtml().replace('{{{body}}}', bodyHtml);
  const compiled = Handlebars.compile(fullHtml);
  templateCache.set(name, compiled);
  return compiled;
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const template = loadTemplate(opts.template);
  const html = template(opts.variables);

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || 'noreply@firevision.local',
    to: opts.to,
    subject: opts.subject,
    html,
  });
}

// ---------------------------------------------------------------------------
// Convenience wrappers (fire-and-forget, never throw)
// ---------------------------------------------------------------------------

const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';

export function sendWelcomeEmail(to: string, vars: { username: string }): void {
  sendEmail({
    to,
    subject: 'Welcome to FireVision IPTV',
    template: 'welcome',
    variables: {
      username: vars.username,
      loginUrl: `${APP_URL()}/login`,
    },
  }).catch((err: Error) => {
    console.error('[email] Failed to send welcome email:', err.message);
  });
}

export function sendVerificationEmail(
  to: string,
  vars: { username: string; verificationUrl: string },
): void {
  sendEmail({
    to,
    subject: 'Verify your email - FireVision IPTV',
    template: 'verification',
    variables: {
      username: vars.username,
      verificationUrl: vars.verificationUrl,
      expiresIn: '24 hours',
    },
  }).catch((err: Error) => {
    console.error('[email] Failed to send verification email:', err.message);
  });
}

export function sendPasswordResetEmail(
  to: string,
  vars: { username: string; resetUrl: string },
): void {
  sendEmail({
    to,
    subject: 'Reset your password - FireVision IPTV',
    template: 'password-reset',
    variables: {
      username: vars.username,
      resetUrl: vars.resetUrl,
      expiresIn: '1 hour',
    },
  }).catch((err: Error) => {
    console.error('[email] Failed to send password reset email:', err.message);
  });
}

module.exports = { sendEmail, sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail };
