import {getCloseoutEvidence,CLOSEOUT_BUCKET} from '@/lib/qa/northfieldCloseoutEvidence';
import {PROJECT,ORG} from '@/lib/qa/northfieldPartnerSettlement';

export const runtime='nodejs';

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  if(id!==PROJECT)return new Response('Unknown QA project',{status:404});
  const kind=new URL(request.url).searchParams.get('kind');
  if(kind!=='invoice'&&kind!=='completion-report')
   return new Response('Unknown controlled document type',{status:400});
  const e=await getCloseoutEvidence(id);
  const doc=kind==='invoice'?e.invoiceDoc:e.completionDoc;
  if(!doc?.id||!doc.storage_path)return new Response('Controlled document not prepared',{status:404});
  const prefix=CLOSEOUT_BUCKET+':'+ORG+'/'+PROJECT+'/'+doc.id+'/';
  if(!doc.storage_path.startsWith(prefix))return new Response('Untrusted protected file path',{status:403});
  const path=doc.storage_path.slice(CLOSEOUT_BUCKET.length+1);
  const {data,error}=await e.db.storage.from(CLOSEOUT_BUCKET).download(path);
  if(error||!data)return new Response('Controlled private PDF not found',{status:404});
  return new Response(await data.arrayBuffer(),{
   headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':'inline; filename="Northfield-QA-Controlled-'+kind+'-R01.pdf"',
    'Cache-Control':'private, no-store, max-age=0',
    'Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff'
   }
  });
 }catch{return new Response('Not authorised',{status:403});}
}
