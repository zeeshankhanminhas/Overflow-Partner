import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { documentLanguage } from '@/components/workspace/documents/documentLanguage';

export type ClientQuotePdfInput = {
  reference: string; revision: number; clientName?: string | null; recipientName: string;
  validUntil: string; scope?: string | null; deliverables?: string | null; requiredBy?: string | null;
  assumptions?: string | null; exclusions?: string | null; paymentTerms?: string | null; deliveryCommitment?: string | null;
  currency: string; subtotal: number; vat: number; total: number;
  lineItems: { description: string; quantity: number; unit: string; netTotal: number }[];
};

const money = (amount: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount || 0);
const date = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', dateStyle: 'long' });

export async function createClientQuotePdf(input: ClientQuotePdfInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.10, 0.10); const muted = rgb(0.25, 0.27, 0.26);
  const rule = rgb(0.82, 0.81, 0.78); const accent = rgb(0.78, 0.29, 0.19); const paper = rgb(0.98, 0.98, 0.97);
  const width = 595.28; const height = 841.89; const left = 62; const right = 535; const maxWidth = right - left;
  let page!: PDFPage; let y = 0; let pageNumber = 0;

  const addPage = () => {
    page = pdf.addPage([width, height]); pageNumber += 1; y = 770;
    page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
    page.drawRectangle({ x: 0, y: 0, width: 6, height, color: accent });
    page.drawText('OVERFLOW PARTNER', { x: left, y, size: 10, font: bold, color: ink });
    page.drawText('ENGINEERING CAPACITY', { x: left, y: y - 15, size: 7, font: bold, color: accent });
    page.drawText(input.reference, { x: right - bold.widthOfTextAtSize(input.reference, 9), y, size: 9, font: bold, color: ink });
    y -= 37; page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.5, color: ink }); y -= 35;
  };
  const ensure = (needed = 30) => { if (y < 74 + needed) { footer(); addPage(); } };
  const footer = () => {
    page.drawLine({ start: { x: left, y: 52 }, end: { x: right, y: 52 }, thickness: 1.2, color: ink });
    page.drawText('OVERFLOW PARTNER · PRIVATE / CONTROLLED', { x: left, y: 36, size: 7, font: bold, color: muted });
    const pageText = `PAGE ${String(pageNumber).padStart(2, '0')}`;
    page.drawText(pageText, { x: right - bold.widthOfTextAtSize(pageText, 7), y: 36, size: 7, font: bold, color: muted });
  };
  const drawWrapped = (value: string, font: PDFFont, size: number, color = ink, lineGap = 5) => {
    const words = String(value || '').replace(/\s+/g, ' ').trim().split(' '); let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        ensure(size + lineGap); page.drawText(current, { x: left, y, size, font, color }); y -= size + lineGap; current = word;
      } else current = candidate;
    }
    if (current) { ensure(size + lineGap); page.drawText(current, { x: left, y, size, font, color }); y -= size + lineGap; }
  };
  const section = (number: string, title: string) => {
    ensure(52); y -= 4;
    page.drawText(number, { x: left, y, size: 23, font: bold, color: accent });
    page.drawText(title.toUpperCase(), { x: left + 43, y: y + 4, size: 11, font: bold, color: ink });
    y -= 12; page.drawLine({ start: { x: left + 43, y }, end: { x: right, y }, thickness: 1.1, color: ink }); y -= 19;
  };
  const field = (label: string, value?: string | null) => {
    if (!value) return;
    ensure(38); page.drawText(label.toUpperCase(), { x: left, y, size: 7, font: bold, color: accent }); y -= 13;
    drawWrapped(value, regular, 10, ink, 5); y -= 5;
  };

  addPage();
  drawWrapped('CLIENT QUOTATION', bold, 27, ink, 8); y -= 4;
  drawWrapped(`${input.reference}  ·  REVISION ${input.revision}`, bold, 10, accent, 8);
  drawWrapped(`Prepared for ${input.clientName || input.recipientName}`, regular, 11, muted, 6);
  drawWrapped(`Valid until ${date(input.validUntil)}`, regular, 9, muted, 16);
  const language = documentLanguage['client-quote'];
  section('01', language.sections[0].title);
  drawWrapped(language.sections[0].entries[0].body, regular, 10, muted, 6); y -= 7;
  field('Requirement', input.scope ? undefined : input.deliverables);
  field('Scope of work', input.scope);
  field('Deliverables', input.deliverables);
  field('Required by', input.requiredBy ? date(input.requiredBy) : null);
  field('Assumptions', input.assumptions);
  field('Exclusions', input.exclusions);
  field('Delivery commitment', input.deliveryCommitment);

  section('02', language.sections[1].title);
  drawWrapped(language.sections[1].entries[0].body, regular, 10, muted, 6); y -= 9;
  for (const [index, item] of input.lineItems.entries()) {
    ensure(42); page.drawLine({ start: { x: left, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 0.6, color: rule });
    drawWrapped(`${String(index + 1).padStart(2, '0')}  ${item.description}`, bold, 10, ink, 4);
    drawWrapped(`${item.quantity} ${item.unit}  ·  ${money(item.netTotal, input.currency)} net`, regular, 9, muted, 6); y -= 5;
  }
  ensure(115); page.drawLine({ start: { x: left, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 1.2, color: ink }); y -= 8;
  for (const [label, amount, strong] of [['Subtotal', input.subtotal, false], ['VAT', input.vat, false], ['Total', input.total, true]] as const) {
    const value = money(amount, input.currency); const font = strong ? bold : regular; const size = strong ? 14 : 10;
    page.drawText(label, { x: left, y, size, font, color: strong ? accent : muted });
    page.drawText(value, { x: right - font.widthOfTextAtSize(value, size), y, size, font, color: strong ? accent : ink });
    y -= size + (strong ? 12 : 8);
  }
  field('Payment terms', input.paymentTerms);
  const acceptance = language.sections[1].entries.find(entry => entry.heading === 'Acceptance')?.body;
  if (acceptance) { field('Acceptance', acceptance); }
  y -= 2; drawWrapped(language.closingStatement, regular, 8, muted, 4);
  footer();
  return Buffer.from(await pdf.save());
}
