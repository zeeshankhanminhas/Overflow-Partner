import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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
  const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET;
  const dbUrl=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const dbKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!webhookSecret || !dbUrl || !dbKey) return new Response('Not configured',{status:503});
  const body=await request.text();
  const signature=request.headers.get('stripe-signature')||'';
  if (!validSignature(body,signature,webhookSecret)) return new Response('Invalid signature',{status:400});
  let event: Record<string,any>;
  try { event=JSON.parse(body); } catch { return new Response('Invalid JSON',{status:400}); }
  if (event.type!=='checkout.session.completed' && event.type!=='checkout.session.async_payment_succeeded') {
    return Response.json({received:true,ignored:true});
  }
  const session=event.data?.object;
  if (!session || session.object!=='checkout.session' || session.payment_status!=='paid' || session.mode!=='payment') {
    return Response.json({received:true,ignored:true});
  }
  const quoteId=String(session.metadata?.quote_id||'');
  const organisationId=String(session.metadata?.organisation_id||'');
  const revision=Number(session.metadata?.quote_revision);
  const amount=Number(session.amount_total);
  const currency=String(session.currency||'').toUpperCase();
  const db=createSupabaseClient(dbUrl,dbKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:quote,error}=await db.from('quotes').select('id,organisation_id,revision,total,currency').eq('id',quoteId).eq('organisation_id',organisationId).eq('revision',revision).maybeSingle();
  if (error || !quote) return new Response('Quote cannot be verified',{status:422});
  const expectedAmount=Math.round(Number(quote.total)*100);
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
  // Settlement is recorded, but project release remains gated by an explicitly
  // reconciled opening payment and the approved Execution Partner lineage.
  return Response.json({received:true});
}
