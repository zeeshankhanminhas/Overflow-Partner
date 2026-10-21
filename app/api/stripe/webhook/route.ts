import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { openingPayment } from '@/lib/lifecycle/voiceAgreedContract';

export const runtime = 'nodejs';

function validSignature(body: string, header: string, secret: string): boolean {
  const pieces = header.split(',').map(part=>part.trim().split('='));
  const timestamp = pieces.find(([k])=>k==='t')?.[1] || '';
  const candidates = pieces.filter(([k])=>k==='v1').map(([,v])=>v);
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now()/1000 - Number(timestamp)) > 300) return false;
  const calculated = createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
  const expected = Buffer.from(calculated,'hex');
  return candidates.some(v=>{
    if (!/^[a-f0-9]{64}$/i.test(v||'')) return false;
    const actual=Buffer.from(v,'hex');
    return actual.length===expected.length && timingSafeEqual(actual,expected);
  });
}

export async function POST(request: Request) {
  if (process.env.OP_PACKAGE01_PAYMENTS_ENABLED !== 'true') return new Response('Not enabled',{status:503});
  if (process.env.VERCEL_ENV !== 'preview' || process.env.OP_ISOLATED_QA_BACKEND !== 'true') return new Response('Isolated Preview QA backend required',{status:503});
  const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET;
  const dbUrl=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const dbKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!webhookSecret || !dbUrl || !dbKey) return new Response('Not configured',{status:503});
  const body=await request.text();
  const signature=request.headers.get('stripe-signature')||'';
  if (!validSignature(body,signature,webhookSecret)) return new Response('Invalid signature',{status:400});
  type StripeSession = { livemode?: boolean; object?: string; payment_status?: string; mode?: string; id?: string; payment_intent?: string | null; amount_total?: number; currency?: string; metadata?: { quote_id?: string; organisation_id?: string; quote_revision?: string; payment_stage?: string } };
  let event: {id?: string; livemode?: boolean; type?: string; data?: {object?: StripeSession}};
  try { event=JSON.parse(body); } catch { return new Response('Invalid JSON',{status:400}); }
  if (event.livemode !== false) return new Response('Only test-mode Stripe events are accepted',{status:400});
  if (event.type!=='checkout.session.completed' && event.type!=='checkout.session.async_payment_succeeded') {
    return Response.json({received:true,ignored:true});
  }
  const session=event.data?.object;
  if (!session || session.livemode !== false || session.object!=='checkout.session' || session.payment_status!=='paid' || session.mode!=='payment') {
    return Response.json({received:true,ignored:true});
  }
  if (!session.id || !event.id) return new Response('Malformed event',{status:400});
  if(session.metadata?.payment_stage!=='opening') return new Response('Unexpected payment stage',{status:422});
  const quoteId=String(session.metadata?.quote_id||'');
  const organisationId=String(session.metadata?.organisation_id||'');
  const revision=Number(session.metadata?.quote_revision);
  const amount=Number(session.amount_total);
  const currency=String(session.currency||'').toUpperCase();
  const db=createSupabaseClient(dbUrl,dbKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:quote,error}=await db.from('quotes').select('id,lead_id,organisation_id,revision,total,currency').eq('id',quoteId).eq('organisation_id',organisationId).eq('revision',revision).maybeSingle();
  if (error || !quote) return new Response('Quote cannot be verified',{status:422});
  const {data:qaLead,error:qaError}=await db.from('leads').select('company_name').eq('organisation_id',organisationId).eq('id',quote.lead_id).maybeSingle();
  if (qaError || !qaLead?.company_name?.startsWith('OP QA TEST')) return new Response('Sandbox evidence restricted to QA cases',{status:422});
  const {data:authorisation,error:authorisationError}=await db.from('op_sandbox_payment_authorisations')
    .select('quote_id').eq('quote_id',quote.id).eq('organisation_id',organisationId)
    .eq('quote_revision',quote.revision).gt('expires_at',new Date().toISOString()).maybeSingle();
  if (authorisationError || !authorisation) return new Response('Quote is not allowlisted for shared-database sandbox reconciliation',{status:422});
  const {data:contract,error:contractError}=await db.from('quote_release_contracts')
    .select('release_basis,opening_amount,currency').eq('organisation_id',organisationId)
    .eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle();
  if(contractError || !contract || !['deposit','payment'].includes(String(contract.release_basis)) ||
     String(contract.currency).toUpperCase()!==String(quote.currency).toUpperCase()) {
    return new Response('Paid event conflicts with issued contractual release terms',{status:422});
  }
  const {data:signatory,error:signatoryError}=await db.from('quote_client_signatory_attestations')
    .select('quote_id').eq('organisation_id',organisationId)
    .eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle();
  if(signatoryError || !signatory)return new Response('Named authorised acceptance is required',{status:422});
  const agreed = contract.release_basis==='deposit' ? openingPayment(Number(quote.total)) : Number(quote.total);
  if(Math.abs(Number(contract.opening_amount)-agreed)>0.01) return new Response('Frozen deposit amount differs from contract',{status:422});
  const expectedAmount=Math.round(Number(contract.opening_amount)*100);
  if (!Number.isSafeInteger(amount) || amount!==expectedAmount || currency!==String(quote.currency).trim().toUpperCase()) {
    return new Response('Settlement does not match quotation',{status:422});
  }
  const {error:insertError}=await db.from('quote_stripe_payment_events').insert({
    stripe_event_id:String(event.id),stripe_session_id:String(session.id),
    stripe_payment_intent_id:session.payment_intent ? String(session.payment_intent) : null,
    quote_id:quoteId,organisation_id:organisationId,quote_revision:revision,
    amount_total:amount,currency,stripe_payment_status:'paid'
  });
  if (insertError && insertError.code!=='23505') {
    // Fail so Stripe retries; do not acknowledge evidence we failed to store.
    return new Response('Unable to persist verified payment',{status:500});
  }
  // Reconciliation is gated separately so the proof-of-payment table can be
  // migrated and exercised before automatic project creation is enabled.
  if (process.env.OP_PACKAGE01_AUTO_RELEASE_ENABLED === 'true') {
    const {error:reconcileError}=await db.rpc('op_finalize_verified_stripe_quote_payment',{p_session_id:String(session.id)});
    if (reconcileError) return new Response('Settlement stored but project release needs retry',{status:503});
  }
  return Response.json({received:true});
}
