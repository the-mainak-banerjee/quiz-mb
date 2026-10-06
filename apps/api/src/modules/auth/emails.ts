import { OTP_RULES } from '@quizmb/contracts';
import type { EmailMessage, InlineImage } from '../../infrastructure/email.js';
import { LOGO_PNG_BASE64 } from './email-logo.js';

// Mail clients block SVG and data URIs, so the logo travels with the email
// as an inline attachment and the HTML points at it by content id.
const LOGO: InlineImage = {
  contentId: 'quizmb-logo',
  filename: 'quizmb-logo.png',
  content: LOGO_PNG_BASE64,
};

// Layout follows the Stitch "Email Verification OTP" and "Password Reset OTP"
// designs. Email clients ignore stylesheets, so styles are inline and colors
// are the QuizMB palette values (apps/web tokens).
const COLOR = {
  canvas: '#f9faf8',
  surface: '#ffffff',
  surfaceLow: '#f3f4f2',
  primary: '#1b3022',
  text: '#131b15',
  secondary: '#5c665f',
  border: '#e6e9e4',
  accent: '#3d6047',
};
const FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ENTITIES[char]!);

type Content = {
  name: string;
  code: string;
  /** Where people can write to; the sending address is not read. */
  supportEmail?: string | undefined;
};

type Copy = {
  heading: string;
  preview: string;
  intro: string;
  codeLabel: string;
  ignore: string;
};

function paragraph(html: string, style = '') {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:${COLOR.secondary};${style}">${html}</p>`;
}

function render(content: Content, copy: Copy) {
  const minutes = OTP_RULES.ttlSeconds / 60;
  const spaced = `${content.code.slice(0, 3)} ${content.code.slice(3)}`;
  const support = content.supportEmail
    ? ` Questions? Contact us at <a href="mailto:${escape(content.supportEmail)}" style="color:${COLOR.accent};">${escape(content.supportEmail)}</a>.`
    : '';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(copy.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.canvas};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;">${escape(copy.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.canvas};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${COLOR.surface};border:1px solid ${COLOR.border};border-radius:16px;">
<tr><td style="padding:32px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" valign="middle"><img src="cid:${LOGO.contentId}" width="36" height="36" alt="QuizMB" style="display:block;width:36px;height:36px;border:0;outline:none;"></td>
<td style="padding-left:10px;font-family:${FONT};font-size:20px;line-height:36px;font-weight:700;color:${COLOR.primary};">Quiz<span style="color:${COLOR.accent};">MB</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 32px 0;">
<h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:700;color:${COLOR.text};">${escape(copy.heading)}</h1>
${paragraph(`Hi ${escape(content.name)},`, `color:${COLOR.text};`)}
${paragraph(escape(copy.intro))}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.surfaceLow};border-radius:12px;margin:12px 0 24px;">
<tr><td align="center" style="padding:20px 16px;">
<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${COLOR.secondary};margin-bottom:8px;">${escape(copy.codeLabel)}</div>
<div style="font-size:36px;line-height:44px;font-weight:700;letter-spacing:6px;color:${COLOR.text};">${spaced}</div>
</td></tr>
</table>
${paragraph(`This code expires in <strong style="color:${COLOR.text};">${minutes} minutes</strong> and works once.`)}
${paragraph('For your security, don&rsquo;t share this code with anyone.')}
${paragraph(escape(copy.ignore))}
</td></tr>
<tr><td style="padding:8px 32px 32px;">
<div style="border-top:1px solid ${COLOR.border};padding-top:16px;font-size:13px;line-height:20px;color:${COLOR.secondary};">
<strong style="color:${COLOR.text};">QuizMB</strong><br>
This is an automated email, so replies to it are not read.${support}
</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    `Hi ${content.name},`,
    '',
    copy.intro,
    '',
    `${copy.codeLabel}: ${content.code}`,
    '',
    `This code expires in ${minutes} minutes and works once.`,
    "For your security, don't share this code with anyone.",
    copy.ignore,
    '',
    'QuizMB',
    'This is an automated email, so replies to it are not read.' +
      (content.supportEmail
        ? ` Questions? Contact us at ${content.supportEmail}.`
        : ''),
  ].join('\n');
  return { html, text, inlineImages: [LOGO] };
}

export function verificationEmail(to: string, content: Content): EmailMessage {
  return {
    to,
    subject: `${content.code} is your QuizMB verification code`,
    ...render(content, {
      heading: 'Verify your email',
      preview: 'Use this code to finish creating your QuizMB account.',
      intro:
        'Use the verification code below to confirm your email address and finish setting up your QuizMB account.',
      codeLabel: 'Your verification code',
      ignore:
        "If you didn't create a QuizMB account, you can safely ignore this email.",
    }),
  };
}

export function passwordResetEmail(to: string, content: Content): EmailMessage {
  return {
    to,
    subject: `${content.code} is your QuizMB password reset code`,
    ...render(content, {
      heading: 'Reset your password',
      preview: 'Use this code to reset your QuizMB password.',
      intro:
        'We received a request to reset the password for your QuizMB account. Use the code below to continue.',
      codeLabel: 'Your reset code',
      ignore:
        "If you didn't ask to reset your password, you can ignore this email. Your password stays the same.",
    }),
  };
}
