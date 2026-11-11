import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = {'Cache-Control':'no-store'};
  if (process.env.VERCEL_ENV !== 'preview')
    return Response.json({status:'ok',service:'overflow-partner'},{headers});
  if (!isKnownIsolatedQaBackend())
    return Response.json({status:'unverified',service:'overflow-partner'},{status:503,headers});
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (key) {
    try {
      const response=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/settings',{
        headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(5000)
      });
      if (response.ok && (response.headers.get('content-type') || '').includes('application/json'))
        return Response.json({status:'ok',environment:'preview',supabaseProject:process.env.OP_QA_SUPABASE_PROJECT_REF,commit:process.env.VERCEL_GIT_COMMIT_SHA},{headers});
    } catch { /* transient auth endpoint failure */ }
  }
  return Response.json({status:'unavailable'},{status:503,headers});
}
