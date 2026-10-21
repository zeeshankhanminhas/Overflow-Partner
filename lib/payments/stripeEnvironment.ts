import { isKnownIsolatedQaBackend, isDisposableLocalWebhookQaBackend } from '@/lib/qa/isolation';

const PRODUCTION_PROJECT='klricctsxiifuduxpmzd';

/** Distinct, explicit environments. A Preview/CI token cannot enable live charges. */
export function stripeRuntimeMode(): 'qa' | 'live' | null {
  if(process.env.OP_PACKAGE01_PAYMENTS_ENABLED!=='true')return null;
  if(isKnownIsolatedQaBackend() || isDisposableLocalWebhookQaBackend())return 'qa';
  if(process.env.VERCEL_ENV!=='production' ||
    process.env.OP_STRIPE_LIVE_ENABLED!=='true' ||
    process.env.OP_CONTRACTUAL_RELEASE_ENABLED!=='true' ||
    process.env.OP_VOICE_FINAL_RELEASE_ENABLED!=='true')return null;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||'';
  if(url!==`https://${PRODUCTION_PROJECT}.supabase.co`)return null;
  const key=process.env.STRIPE_SECRET_KEY||'';
  const secret=process.env.STRIPE_WEBHOOK_SECRET||'';
  if(!key.startsWith('sk_live_') || !secret.startsWith('whsec_'))return null;
  return 'live';
}

export function checkoutOrigin(mode:'qa'|'live'):string {
  if(mode==='qa'){
    if(!isKnownIsolatedQaBackend())throw new Error('Checkout testing requires an isolated Preview backend.');
    const host=process.env.VERCEL_URL||'';
    if(!/^[a-z0-9.-]+\.vercel\.app$/i.test(host))
      throw new Error('Preview Checkout must return to a verified Vercel deployment.');
    return 'https://'+host;
  }
  if(stripeRuntimeMode()!=='live')throw new Error('Live Stripe is not authorised.');
  // Stable public origin must be expressly matched to the operator-approved origin.
  const configured=process.env.OP_STRIPE_LIVE_RETURN_ORIGIN||'';
  const site=process.env.NEXT_PUBLIC_SITE_URL||'';
  if(!configured || configured!==site)throw new Error('Live payment return origin is not approved.');
  const parsed=new URL(configured);
  if(parsed.protocol!=='https:' || parsed.username || parsed.password ||
     parsed.search || parsed.hash || parsed.pathname!=='/' ||
     !/^[a-z0-9.-]+$/i.test(parsed.hostname)){
    throw new Error('Live payment return origin must be a clean HTTPS origin.');
  }
  return parsed.origin;
}
