import {createSampleHandoverPdf} from '@/lib/public-assurance-pdf';
export const runtime='nodejs';
export async function GET(){
  const pdf=await createSampleHandoverPdf();
  return new Response(new Uint8Array(pdf),{headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="Overflow_Partner_Illustrative_Handover_Pack.pdf"',
    'Cache-Control':'public, max-age=3600',
    'X-Content-Type-Options':'nosniff'
  }});
}
