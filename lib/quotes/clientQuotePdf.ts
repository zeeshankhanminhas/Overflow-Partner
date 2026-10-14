import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type ClientQuotePdfInput = {
  reference: string; revision: number; clientName?: string | null; recipientName: string;
  validUntil: string; scope?: string | null; deliverables?: string | null; requiredBy?: string | null;
  assumptions?: string | null; exclusions?: string | null; paymentTerms?: string | null; deliveryCommitment?: string | null;
  currency: string; subtotal: number; vat: number; total: number;
  lineItems: { description: string; quantity: number; unit: string; netTotal: number }[];
};

const money = (amount: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount || 0);

export async function createClientQuotePdf(input: ClientQuotePdfInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.1, 0.12); const muted = rgb(0.38, 0.4, 0.43); const accent = rgb(0.86, 0.16, 0.14);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const newPage = () => { page = pdf.addPage([595.28, 841.89]); y = 790; };
  const line = (text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = opts.size || 11; const font = opts.bold ? bold : regular; const maxWidth = 495;
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' '); let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
        if (y < 72) newPage();
        page.drawText(current, { x: 50, y, size, font, color: opts.color || ink }); y -= size + 5; current = word;
      } else current = next;
    }
    if (current) { if (y < 72) newPage(); page.drawText(current, { x: 50, y, size, font, color: opts.color || ink }); y -= size + (opts.gap ?? 6); }
  };
  page.drawText('OVERFLOW PARTNER', { x: 50, y, size: 11, font: bold, color: accent }); y -= 38;
  line('CLIENT QUOTATION', { size: 24, bold: true, gap: 12 });
  line(`${input.reference} · Revision ${input.revision}`, { size: 13, bold: true });
  line(`Prepared for: ${input.clientName || input.recipientName}`, { color: muted });
  line(`Valid until: ${new Date(`${input.validUntil}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', dateStyle: 'long' })}`, { color: muted, gap: 18 });
  if (input.scope) { line('Scope of work', { size: 14, bold: true, gap: 8 }); line(input.scope, { gap: 12 }); }
  if (input.deliverables) { line('Deliverables', { size: 14, bold: true, gap: 8 }); line(input.deliverables, { gap: 12 }); }
  if (input.requiredBy) line(`Required by: ${new Date(`${input.requiredBy}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', dateStyle: 'long' })}`, { color: muted, gap: 14 });
  if (input.assumptions) { line('Assumptions', { size: 14, bold: true, gap: 8 }); line(input.assumptions, { gap: 12 }); }
  if (input.exclusions) { line('Exclusions', { size: 14, bold: true, gap: 8 }); line(input.exclusions, { gap: 12 }); }
  if (input.deliveryCommitment) { line('Delivery commitment', { size: 14, bold: true, gap: 8 }); line(input.deliveryCommitment, { gap: 12 }); }
  line('Price', { size: 14, bold: true, gap: 10 });
  input.lineItems.forEach((item, index) => line(`${index + 1}. ${item.description} — ${item.quantity} ${item.unit} — ${money(item.netTotal, input.currency)} net`));
  y -= 8;
  line(`Subtotal: ${money(input.subtotal, input.currency)}`, { bold: true });
  line(`VAT: ${money(input.vat, input.currency)}`);
  line(`Total: ${money(input.total, input.currency)}`, { size: 15, bold: true, color: accent, gap: 18 });
  if (input.paymentTerms) { line('Payment terms', { size: 14, bold: true, gap: 8 }); line(input.paymentTerms, { gap: 12 }); }
  line('Client response', { size: 14, bold: true, gap: 8 });
  line('Use one of the response buttons in the accompanying email to accept, decline, or request more time. Acceptance records the client decision; project setup remains subject to confirmation of the agreed opening payment or purchase order.', { color: muted, gap: 16 });
  line('This quotation is limited to the scope, deliverables, assumptions and price stated above. Any change requires a revised quotation.', { size: 9, color: muted });
  return Buffer.from(await pdf.save());
}
