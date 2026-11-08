import {createHash} from 'crypto';
import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {finalizeVerifiedEnquiry,type ConfirmedEnquiry} from '@/lib/public-intake/finalize';
export const runtime='nodejs';
const schema=z.object({token:z.string().min(30).max(200)});
export async function POST(request:Request){
 if(process.env.VERCEL_ENV==='preview'&&!isKnownIsolatedQaBackend())return NextResponse.json({success:false,message:'This confirmation is not available.'},{status:503});
 try{
  const value=schema.safeParse(await request.json());
  if(!value.success)return NextResponse.json({success:false,message:'Invalid confirmation.'},{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key||!process.env.TURNSTILE_SECRET_KEY||!process.env.PUBLIC_INTAKE_HASH_SECRET)return NextResponse.json({success:false,message:'Confirmation is temporarily unavailable.'},{status:503});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const tokenHash=createHash('sha256').update(value.data.token).digest('hex');
  const {data:claimed,error:claimError}=await supabase.rpc('op_public_intake_claim_confirmation',{p_token_hash:tokenHash});
  if(claimError)throw claimError;
  const pending=Array.isArray(claimed)?claimed[0]:null;
  if(!pending)return NextResponse.json({success:false,message:'This confirmation link has expired or was already used.'},{status:410});
  const payload=pending.payload as ConfirmedEnquiry;
  if(!payload?.work_email||payload.work_email.toLowerCase()!==String(pending.email_normalized))throw new Error('Email confirmation payload mismatch');
  const result=await finalizeVerifiedEnquiry(supabase,payload,{id:pending.owner_id,organisation_id:pending.organisation_id},pending.source_origin);
  const {error:completedError}=await supabase.rpc('op_public_intake_complete',{p_id:pending.id,p_prospect_id:result.prospectId});
  if(completedError)throw completedError;
  return NextResponse.json({success:true,invitationEmailStatus:result.invitationEmailStatus},{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('Verified public intake finalisation failed',error);return NextResponse.json({success:false,message:'We could not complete your confirmation. Please try again shortly.'},{status:503});}
}