import assert from 'node:assert/strict';
import {defineConfig} from '@playwright/test';
assert.equal(process.env.CI,'true');
assert.equal(process.env.VERCEL_ENV,'local-qa');
assert.equal(process.env.OP_QA_SUPABASE_PROJECT_REF,'opos_ephemeral_ci');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(process.env.OPOS_BROWSER_WRITES,'disposable-only');
for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','DATABASE_URL','STRIPE_SECRET_KEY','VERCEL_AUTOMATION_BYPASS_SECRET']) assert.ok(!process.env[key],key+' must be absent');
export default defineConfig({testDir:'.',testMatch:'journey.spec.mjs',workers:1,retries:0,timeout:900000,reporter:[['list'],['json',{outputFile:'qa/write-browser/results.json'}]],use:{baseURL:'http://127.0.0.1:3211',browserName:'chromium',headless:true,trace:'off',video:'off',screenshot:'off'}});
