import {defineConfig} from '@playwright/test';

// Browser smoke tests are read-only, on an explicitly allowlisted QA preview.
// Never point them at the production site or a user-supplied arbitrary host.
const target=String(process.env.OPOS_QA_BASE_URL||'').trim().replace(/\/$/,'');
if(!/^https:\/\/overflow-partner-[a-z0-9-]+-zeeshankhanminhas-projects\.vercel\.app$/.test(target)){
 throw new Error('Set OPOS_QA_BASE_URL to an approved Overflow Partner Vercel preview. Production and arbitrary hosts are forbidden.');
}
export default defineConfig({
 testDir:'./tests',
 testMatch:'smoke.spec.mjs',
 fullyParallel:false,
 workers:1,
 retries:process.env.CI?1:0,
 timeout:30_000,
 expect:{timeout:12_000},
 globalTimeout:8*60_000,
 reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
 use:{baseURL:target,browserName:'chromium',headless:true,
  trace:'retain-on-failure',screenshot:'only-on-failure',video:'retain-on-failure'},
});
