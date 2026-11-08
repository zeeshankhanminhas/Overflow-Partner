import {createHash,createHmac,randomBytes} from 'crypto';
import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {queueNotification} from '@/lib/notifications/queue';
import {publicEnquirySchema} from '@/lib/public-intake/schema';

export const runtime='nodejs';
const unavailable=()=>NextResponse.json({success:false,message:'Enquiries are temporarily unavailable. Please try again later.'},{status:503});
function admin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error('Public intake database is not configured');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function hashed(secret:string,value:string){return createHmac('sha256',secret).update(value).digest('hex')}
function publicOrigin(request:Request){
 if(process.env.VERCEL_ENV==='production')return (process.env.NEXT_PUBLIC_SITE_URL||'https://overflow-partner.vercel.app').replace(/\/$/,'');
 if(process.env.VERCEL_URL)return 'https://'+process.env.VERCEL_URL;
 return new URL(request.url).origin;
}
async function checkTurnstile(token:string,ip:string,secret:string){
 const body=new URLSearchParams({secret,response:token,remoteip:ip});
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),7000);
 try{
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:controller.signal,cache:'no-store'});
  if(!response.ok)return false;
  const data=await response.json() as {success?:boolean;hostname?:string};
  return data.success===true;
 }finally{clearTimeout(timeout)}
}
export async function POST(request:Request){
 if(process.env.VERCEL_ENV==='preview'&&!isKnownIsolatedQaBackend())return unavailable();
 if(!request.headers.get('content-type')?.includes('application/json'))return NextResponse.json({success:false,message:'Please submit the form again.'},{status:415});
 const secret=process.env.TURNSTILE_SECRET_KEY;
 const hashSecret=process.env.PUBLIC_INTAKE_HASH_SECRET;
 if(!secret||!hashSecret||hashSecret.length<32)return unavailable();
 try{
  const raw=await request.text();
  if(raw.length>15000)return NextResponse.json({success:false,message:'Please shorten your message.'},{status:413});
  const parsed=publicEnquirySchema.safeParse(JSON.parse(raw));
  if(!parsed.success)return NextResponse.json({success:false,message:'Please check the form fields.'},{status:400});
  const payload=parsed.data;
  // Respond without side effects to automated honeypot submissions.
  if(payload.company_website)return NextResponse.json({success:true,awaitingVerification:true});
  const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,80);
  if(!(await checkTurnstile(payload.turnstile_token,ip,secret)))return NextResponse.json({success:false,message:'Verification was unsuccessful. Please try again.'},{status:400});
  const supabase=admin();
  const {data:allowed,error:quotaError}=await supabase.rpc('op_public_intake_claim_quota',{
   p_ip_hash:hashed(hashSecret,'ip:'+ip),p_email_hash:hashed(hashSecret,'email:'+payload.work_email),
  });
  if(quotaError)throw quotaError;
  if(!allowed)return NextResponse.json({success:false,message:'Please wait before sending another enquiry.'},{status:429});
  const {data:owners,error:ownerError}=await supabase.from('profiles').select('id,organisation_id').in('role',['owner','admin']).eq('is_active',true).limit(1);
  if(ownerError||!owners?.[0]?.organisation_id)throw ownerError||new Error('No active intake owner');
  const owner=owners[0];
  const token=randomBytes(32).toString('base64url');
  const tokenHash=createHash('sha256').update(token).digest('hex');
  const sourceOrigin=publicOrigin(request);
  const {data:pending,error:pendingError}=await supabase.from('public_intake_pending').insert({
   organisation_id:owner.organisation_id,owner_id:owner.id,
   token_hash:tokenHash,email_normalized:payload.work_email,
   payload:{
     full_name:payload.full_name,work_email:payload.work_email,company:payload.company,
     project_type:payload.project_type,brief_requirement:payload.brief_requirement,
     source:payload.source,pageUrl:payload.pageUrl,lead_id:payload.lead_id,
     nurture_consent:payload.nurture_consent,
   },source_origin:sourceOrigin,
  }).select('id').single();
  if(pendingError||!pending)throw pendingError||new Error('Pending intake could not be created');
  const confirmationUrl=sourceOrigin+'/confirm-enquiry/'+token;
  try{
   const sent=await queueNotification(supabase,{
    organisationId:owner.organisation_id,eventKey:'public_enquiry.email_verify',
    recipientEmail:payload.work_email,recipientName:payload.full_name,
    subject:'Confirm your Overflow Partner enquiry',templateKey:'secure_action',
    payload:{heading:'Confirm your work email',message:'You recently asked Overflow Partner about engineering support. Confirm your email to continue and receive a secure link for your engineering requirements. If you did not make this request, you can ignore this message.',actionLabel:'Confirm my email',actionUrl:confirmationUrl},
    category:'transactional',idempotencyKey:'public-intake:verify:'+pending.id,
   });
   if(!sent)throw new Error('Confirmation notification not queued');
  }catch(queueError){
   await supabase.from('public_intake_pending').delete().eq('id',pending.id);
   throw queueError;
  }
  return NextResponse.json({success:true,awaitingVerification:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('Public intake challenge failed',error);
  return unavailable();
 }
}
