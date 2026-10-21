/** Prevent Preview tests from accidentally writing to the shared production OPOS database.
 * The QA ref must be explicitly configured and different from the known live project.
 */
const OPOS_PRODUCTION_SUPABASE_REF='klricctsxiifuduxpmzd';

export function isKnownIsolatedQaBackend():boolean {
  if(process.env.VERCEL_ENV!=='preview' || process.env.OP_ISOLATED_QA_BACKEND!=='true')return false;
  const qaRef=String(process.env.OP_QA_SUPABASE_PROJECT_REF||'').trim().toLowerCase();
  if(!/^[a-z0-9]{12,32}$/.test(qaRef)||qaRef===OPOS_PRODUCTION_SUPABASE_REF)return false;
  const value=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||'';
  try {
    const url=new URL(value);
    return url.protocol==='https:' && url.hostname.toLowerCase()===qaRef+'.supabase.co';
  }catch{return false;}
}

export function assertIsolatedQaBackend() {
  if(!isKnownIsolatedQaBackend())throw new Error(
    'Safe QA is not configured: a separate Supabase project ref must match the Preview URL, and must not equal the OPOS production project.'
  );
}
