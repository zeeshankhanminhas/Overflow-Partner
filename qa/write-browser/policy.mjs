import assert from 'node:assert/strict';
export function assertDisposableBrowserEnvironment(env){
 for(const [key,value] of Object.entries({CI:'true',VERCEL_ENV:'local-qa',OP_QA_SUPABASE_PROJECT_REF:'opos_ephemeral_ci',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',OPOS_BROWSER_WRITES:'disposable-only'}))assert.equal(env[key],value,'Unsafe browser write environment: '+key);
 for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','DATABASE_URL','STRIPE_SECRET_KEY','VERCEL_AUTOMATION_BYPASS_SECRET'])assert.ok(!env[key],key+' must be absent');
 assert.ok(env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_qa_'),'Only synthetic webhook signing');
 assert.equal(env.NEXT_PUBLIC_APP_URL,'http://127.0.0.1:3211');
 assert.equal(env.OP_QA_RESEND_ENDPOINT,'http://127.0.0.1:3411/emails');
}
