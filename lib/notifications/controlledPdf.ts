import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { AdaptedDocumentData } from '@/components/workspace/documents/documentAdapter';

export async function createControlledPdf(title: string, data: AdaptedDocumentData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(.1, .11, .13), muted = rgb(.4, .42, .45), accent = rgb(.86, .16, .14);
  let page = pdf.addPage([595.28, 841.89]); let y = 790;
  const addPage = () => { page = pdf.addPage([595.28, 841.89]); y = 790; };
  const draw = (value: string, size = 10, strong = false, color = ink) => {
    const font = strong ? bold : regular; const max = 495;
    for (const paragraph of String(value || '—').split(/\n+/)) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, size) > max) { if (y < 70) addPage(); page.drawText(line, { x: 50, y, size, font, color }); y -= size + 5; line = word; }
        else line = next;
      }
      if (y < 70) addPage(); page.drawText(line || ' ', { x: 50, y, size, font, color }); y -= size + 6;
    }
  };
  page.drawText('OVERFLOW PARTNER', { x: 50, y, size: 11, font: bold, color: accent }); y -= 38;
  draw(title.toUpperCase(), 21, true); draw(`${data.reference} · Revision ${data.revision}`, 11, true, muted); draw(data.subject, 10, false, muted); y -= 14;
  for (const section of data.sections) {
    if (y < 90) addPage(); draw(section.title, 13, true); y -= 2;
    for (const item of section.facts) { if (item.value && item.value !== 'Not recorded') { draw(item.label, 9, true, muted); draw(item.value, 10); } }
    y -= 10;
  }
  draw('Controlled document issued by Overflow Partner. This PDF represents the identified revision at the time of issue.', 8, false, muted);
  return Buffer.from(await pdf.save());
}

export function pdfEmailAttachment(filename: string, pdf: Buffer) {
  return { filename, content: pdf.toString('base64'), content_type: 'application/pdf' };
}
