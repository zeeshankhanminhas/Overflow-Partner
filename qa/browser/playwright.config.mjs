import {defineConfig} from '@playwright/test';

// Tests must target an approved isolated QA preview, NEVER production.
// Vercel Authentication stays ON. Its dedicated automation token is supplied
// as a GitHub Actions secret, not source code or a URL parameter.
const target=String(process.env.OPOS_QA_BASE_URL||'').trim().replace(/\/$/,'');
if(!/^https:\/\/overflow-partner-[a-z0-9-]+-zeeshankhanminhas-projects\.vercel\.app$/.test(target)){
 throw new Error('OPOS_QA_BASE_URL must be an approved isolated QA Vercel deployment hostname.');
}
const bypass=String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET||'').trim();
if(!bypass){
 throw new Error('Missing VERCEL_AUTOMATION_BYPASS_SECRET: configure the protected preview browser-runner secret in GitHub Actions. Do not disable Vercel Authentication.');
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
 use:{
  baseURL:target,browserName:'chromium',headless:true,
  extraHTTPHeaders:{
   'x-vercel-protection-bypass':bypass,
   'x-vercel-set-bypass-cookie':'true',
  },
  // Browser traces may include HTTP headers and therefore the bypass secret.
  // Do not record them until redaction is implemented and independently checked.
  trace:'off',video:'off',screenshot:'only-on-failure',
 },
});
