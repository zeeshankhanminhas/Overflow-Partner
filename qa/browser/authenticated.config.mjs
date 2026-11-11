import {defineConfig} from '@playwright/test';

/**
 * Authenticated QA MUST run only from reviewed code on protected main.
 * Do not load these credentials for pull_request events or unreviewed heads.
 */
if(process.env.OPOS_AUTH_QA_APPROVED!=='true'||
   process.env.GITHUB_REF!=='refs/heads/main'||
   process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'){
 throw new Error('Authenticated browser QA requires an explicitly approved main-branch manual workflow.');
}
const target=String(process.env.OPOS_QA_BASE_URL||'').trim().replace(/\/$/,'');
if(!/^https:\/\/overflow-partner-[a-z0-9-]+-zeeshankhanminhas-projects\.vercel\.app$/.test(target)){
 throw new Error('Only the exact approved OPOS QA preview is allowed.');
}
for(const name of [
 'OPOS_QA_CONTROLLER_EMAIL','OPOS_QA_CONTROLLER_PASSWORD',
 'OPOS_QA_CLIENT_EMAIL','OPOS_QA_CLIENT_PASSWORD',
 'OPOS_QA_PARTNER_EMAIL','OPOS_QA_PARTNER_PASSWORD',
 'VERCEL_AUTOMATION_BYPASS_SECRET',
]){
 if(!process.env[name]?.trim())throw new Error('Missing protected QA credential: '+name);
}
const emails=['CONTROLLER','CLIENT','PARTNER'].map(role=>process.env['OPOS_QA_'+role+'_EMAIL'].toLowerCase());
if(new Set(emails).size!==3 || emails.some((e,i)=>!e.endsWith('+'+['controller','client','partner'][i]+'@gmail.com'))){
 throw new Error('Three distinct Gmail plus aliases with the expected QA roles are required.');
}
const bypass=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
export default defineConfig({
 testDir:'./tests',
 testMatch:['authenticated.spec.mjs','project-details.spec.mjs'],
 workers:1,
 fullyParallel:false,
 retries:0,
 timeout:45_000,
 expect:{timeout:15_000},
 globalTimeout:6*60_000,
 reporter:'list',
 outputDir:'qa/browser/auth-private-results',
 use:{
  baseURL:target,browserName:'chromium',headless:true,
  extraHTTPHeaders:{
   'x-vercel-protection-bypass':bypass,
   'x-vercel-set-bypass-cookie':'true',
  },
  // Credentials, cookies and sensitive workspace contents must never become
  // GitHub Actions screenshots, videos, HAR, traces or uploaded artifacts.
  trace:'off',screenshot:'off',video:'off',
 },
});
