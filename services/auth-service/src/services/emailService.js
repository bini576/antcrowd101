import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let cachedTransporter;
let verifiedTransport = false;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (config.email.provider === 'mailpit') {
    cachedTransporter = nodemailer.createTransport({
      host: config.email.mailpit.host,
      port: config.email.mailpit.port,
      secure: false
    });
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.secure,
    auth: config.email.smtp.user
      ? {
          user: config.email.smtp.user,
          pass: config.email.smtp.pass
        }
      : undefined
  });

  return cachedTransporter;
}

export async function verifyEmailTransport() {
  const transporter = getTransporter();

  try {
    await transporter.verify();
    return {
      ok: true,
      provider: config.email.provider
    };
  } catch (error) {
    return {
      ok: false,
      provider: config.email.provider,
      error: error?.message ?? String(error)
    };
  }
}

async function sendEmail({ to, subject, html, text }) {
  // All auth emails (verification, password reset, invitations, decisions) go through this shared transporter.
  // This guarantees the selected provider (Brevo or Mailpit) is applied consistently across all flows.
  const transporter = getTransporter();

  if (!verifiedTransport && config.nodeEnv !== 'production') {
    try {
      await transporter.verify();
    } catch (error) {
      console.warn('Email transport verify failed', {
        provider: config.email.provider,
        host: config.email.provider === 'mailpit' ? config.email.mailpit.host : config.email.smtp.host,
        port: config.email.provider === 'mailpit' ? config.email.mailpit.port : config.email.smtp.port,
        error: error?.message ?? String(error)
      });
    } finally {
      verifiedTransport = true;
    }
  }

  if (config.nodeEnv !== 'production') {
    console.log('Sending email', { provider: config.email.provider, to, subject });
  }

  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
      text
    });
  } catch (error) {
    const message = error?.message ?? String(error);
    throw new Error(`Failed to send email via ${config.email.provider}: ${message}`);
  }
}

function buildEmailFrame({ heading, body, ctaLabel, ctaUrl, footer }) {
  return `
    <div style="background:#f4f7fb;padding:32px 16px;font-family:Manrope,Segoe UI,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 48px rgba(15,23,42,0.08);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.82;">AntCrowd Security</div>
          <h1 style="margin:16px 0 0;font-size:28px;line-height:1.15;font-family:'Space Grotesk',Manrope,Segoe UI,sans-serif;">${escapeHtml(heading)}</h1>
        </div>
        <div style="padding:32px;">
          <div style="font-size:15px;line-height:1.7;color:#334155;">${body}</div>
          ${
            ctaUrl
              ? `<div style="margin-top:28px;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#f97316;color:#ffffff;text-decoration:none;font-weight:700;">
                    ${escapeHtml(ctaLabel)}
                  </a>
                </div>`
              : ''
          }
          <p style="margin-top:28px;font-size:13px;line-height:1.6;color:#64748b;">
            ${footer}
          </p>
        </div>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail({ to, firstName, verificationCode, verificationEntryUrl, accountType }) {
  const body = `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>Your new ${escapeHtml(accountType)} account is ready for activation. Enter this verification code to unlock sign-in:</p>
    <div style="margin:18px 0 8px;padding:16px 18px;border:1px dashed #94a3b8;border-radius:14px;background:#f8fafc;font-size:30px;letter-spacing:0.28em;font-weight:700;color:#0f172a;text-align:center;">
      ${escapeHtml(verificationCode)}
    </div>
    <p style="margin-top:0;">This code expires in ${config.security.verificationMinutes} minutes and can be used once.</p>
  `;

  await sendEmail({
    to,
    subject: 'Verify your AntCrowd account',
    html: buildEmailFrame({
      heading: 'Verify your email',
      body,
      ctaLabel: 'Enter verification code',
      ctaUrl: verificationEntryUrl,
      footer: 'If you did not create an AntCrowd account, you can safely ignore this message.'
    }),
    text: `Your AntCrowd verification code is ${verificationCode}. Enter it in the verification page: ${verificationEntryUrl}`
  });
}

export async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  const body = `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>We received a request to reset your AntCrowd password. Use the secure link below to choose a new password.</p>
    <p>This reset link expires in 30 minutes.</p>
  `;

  await sendEmail({
    to,
    subject: 'Reset your AntCrowd password',
    html: buildEmailFrame({
      heading: 'Reset your password',
      body,
      ctaLabel: 'Create a new password',
      ctaUrl: resetUrl,
      footer: 'If you did not request a reset, no changes have been made to your account.'
    }),
    text: `Reset your AntCrowd password by visiting ${resetUrl}`
  });
}

export async function sendOrganizationInviteEmail({ to, organizationName, inviteUrl, role }) {
  const body = `
    <p>You were invited to join <strong>${escapeHtml(organizationName)}</strong> on AntCrowd as a ${escapeHtml(role)}.</p>
    <p>Use the link below to activate your access and create your password. The invitation expires in 72 hours.</p>
  `;

  await sendEmail({
    to,
    subject: `Join ${organizationName} on AntCrowd`,
    html: buildEmailFrame({
      heading: 'Organization invitation',
      body,
      ctaLabel: 'Accept invitation',
      ctaUrl: inviteUrl,
      footer: 'If you were not expecting this invitation, you can ignore this email.'
    }),
    text: `Accept your AntCrowd invitation by visiting ${inviteUrl}`
  });
}

export async function sendResearcherInviteEmail({ to, inviteUrl, fullName, researcherType, notes }) {
  const greetingName = fullName ? escapeHtml(fullName) : 'there';
  const body = `
    <p>Hi ${greetingName},</p>
    <p>You were invited to join ANTCROWD as an <strong>${escapeHtml(researcherType)}</strong> researcher.</p>
    <p>Use the secure link below to create your password and activate your account.</p>
    ${notes ? `<p><strong>Platform admin note:</strong> ${escapeHtml(notes)}</p>` : ''}
    <p>This invitation expires in ${config.security.researcherInviteHours} hours and can only be used once.</p>
    <p>After login, submit your national ID and certification evidence for approval before using researcher services.</p>
  `;

  await sendEmail({
    to,
    subject: 'Create Your ANTCROWD Account',
    html: buildEmailFrame({
      heading: 'Create Your ANTCROWD Account',
      body,
      ctaLabel: 'Create your password',
      ctaUrl: inviteUrl,
      footer: 'If you were not expecting this invitation, you can ignore this email.'
    }),
    text: `Create your ANTCROWD account by visiting ${inviteUrl}`
  });
}

export async function sendResearcherDecisionEmail({ to, firstName, status, notes }) {
  const decisionLabel = status === 'approved' ? 'approved' : 'needs changes';
  const body = `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>Your AntCrowd researcher verification has been <strong>${escapeHtml(decisionLabel)}</strong>.</p>
    ${notes ? `<p><strong>Reviewer notes:</strong> ${escapeHtml(notes)}</p>` : ''}
    <p>${status === 'approved'
      ? 'You can now access researcher programs and service workflows.'
      : 'Please sign in, update your verification documents, and resubmit for review.'}</p>
  `;

  await sendEmail({
    to,
    subject: status === 'approved' ? 'Your AntCrowd researcher access is approved' : 'Update your AntCrowd verification submission',
    html: buildEmailFrame({
      heading: status === 'approved' ? 'Researcher access approved' : 'Verification update required',
      body,
      ctaLabel: 'Sign in to AntCrowd',
      ctaUrl: `${config.frontendBaseUrl}/researchers/login`,
      footer: 'AntCrowd platform administration sent this update after reviewing your researcher verification submission.'
    }),
    text: status === 'approved'
      ? 'Your AntCrowd researcher access has been approved.'
      : 'Your AntCrowd verification submission needs changes before access can be approved.'
  });
}

export async function sendOrganizationDecisionEmail({ to, firstName, organizationName, status, notes }) {
  const approved = status === 'approved';
  const body = `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>Your organization workspace <strong>${escapeHtml(organizationName)}</strong> has been <strong>${approved ? 'approved' : 'rejected'}</strong> by the AntCrowd platform admin.</p>
    ${notes ? `<p><strong>Reviewer notes:</strong> ${escapeHtml(notes)}</p>` : ''}
    <p>${approved
      ? 'You can now sign in and access organization dashboards and connected services.'
      : 'Organization access remains blocked. Contact the platform admin to resolve next steps.'}</p>
  `;

  await sendEmail({
    to,
    subject: approved
      ? 'Your AntCrowd organization access is approved'
      : 'Your AntCrowd organization approval needs attention',
    html: buildEmailFrame({
      heading: approved ? 'Organization access approved' : 'Organization approval update',
      body,
      ctaLabel: 'Sign in to AntCrowd',
      ctaUrl: `${config.frontendBaseUrl}/login`,
      footer: 'AntCrowd platform administration sent this decision after reviewing your organization registration.'
    }),
    text: approved
      ? `Your organization ${organizationName} has been approved for AntCrowd access.`
      : `Your organization ${organizationName} was not approved yet. Contact the platform admin for next steps.`
  });
}

export async function sendTwoFactorOtpEmail(email, displayName, otp) {
  const safeName = escapeHtml(displayName || 'there');
  const safeOtp = escapeHtml(otp);

  const body = `
    <p>Hi ${safeName},</p>
    <p>Your 6-digit sign-in code is:</p>
    <div style="margin:18px 0 8px;padding:20px 18px;border:1px dashed #94a3b8;border-radius:14px;background:#f8fafc;font-size:2.5rem;letter-spacing:0.5rem;font-weight:700;color:#0f172a;text-align:center;">
      ${safeOtp}
    </div>
    <p>This code expires in 10 minutes. Do not share it with anyone.</p>
  `;

  await sendEmail({
    to: email,
    subject: 'Your AntCrowd sign-in code',
    html: buildEmailFrame({
      heading: 'Your sign-in code',
      body,
      footer: 'If you did not try to sign in to AntCrowd, you can safely ignore this message.'
    }),
    text: `Your AntCrowd sign-in code is ${otp}. It expires in 10 minutes.`
  });
}
