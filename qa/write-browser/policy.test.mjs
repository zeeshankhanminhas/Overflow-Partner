import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertDisposableBrowserEnvironment} from './policy.mjs';
const safe={CI:'true',VERCEL_ENV:'local-qa',OP_QA_SUPABASE_PROJECT_REF:'opos_ephemeral_ci',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',OPOS_BROWSER_WRITES:'disposable-only',STRIPE_WEBHOOK_SECRET:'whsec_qa_test',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3211',OP_QA_RESEND_ENDPOINT:'http://127.0.0.1:3411/emails'};
test('accepts only disposable loopback environment',()=>assert.doesNotThrow(()=>assertDisposableBrowserEnvironment(safe)));
for(const key of Object.keys(safe))test('rejects changed '+key,()=>assert.throws(()=>assertDisposableBrowserEnvironment({...safe,[key]:'production'})));
for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','DATABASE_URL','STRIPE_SECRET_KEY','VERCEL_AUTOMATION_BYPASS_SECRET'])test('rejects hosted credential '+key,()=>assert.throws(()=>assertDisposableBrowserEnvironment({...safe,[key]:'secret'})));
