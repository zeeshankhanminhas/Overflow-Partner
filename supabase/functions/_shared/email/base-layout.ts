import type { TransactionalEmail } from './types.ts';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}

export function safe(value: string) {
  return escapeHtml(value);
}

export function renderEmailLayout(input: {
  preview: string;
  heading: string;
  bodyHtml: string;
  bodyText: string;
  footerNote?: string;
}): TransactionalEmail {
  const footer = input.footerNote || 'Overflow Partner · Engineering capacity, extended.';
  return {
    subject: input.heading,
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${safe(input.heading)}</title></head><body style="margin:0;background:#f3f1eb;padding:0;font-family:Arial,Helvetica,sans-serif;color:#171717"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${safe(input.preview)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1eb"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #d8d4ca"><tr><td style="padding:26px 30px;border-bottom:3px solid #d94b37"><div style="font-size:20px;font-weight:700;letter-spacing:-.02em">Overflow Partner</div><div style="margin-top:5px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6f6b63">Engineering capacity, controlled</div></td></tr><tr><td style="padding:34px 30px">${input.bodyHtml}</td></tr><tr><td style="padding:20px 30px;border-top:1px solid #e5e1d8;font-size:12px;line-height:1.6;color:#77736b">${safe(footer)}</td></tr></table></td></tr></table></body></html>`,
    text: `${input.bodyText}\n\n${footer}`,
  };
}
