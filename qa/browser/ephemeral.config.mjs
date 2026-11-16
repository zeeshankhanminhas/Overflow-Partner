import {defineConfig} from '@playwright/test';
// This runner is intentionally separate from the protected real-account suite.
// It may execute on PR code only with a disposable localhost Supabase fixture.
if(process.env.OP_ISOLATED_QA_BACKEND!=='true' ||
   process.env.OP_PAID_EXTERNAL_PORTALS_ENABLED!=='true' ||
   process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:54321' ||
   process.env.OPOS_SYNTHETIC_BASE_URL!=='http://127.0.0.1:3333'){
 throw Error('Synthetic role browser QA may only run against localhost ephemeral services.');
}
export default defineConfig({
 testDir:'./tests',testMatch:['ephemeral-roles.spec.mjs'],
 workers:1,fullyParallel:false,retries:0,
 timeout:90000,expect:{timeout:20000},
 reporter:'list',outputDir:'qa/browser/ephemeral-private-results',
 use:{
   baseURL:'http://127.0.0.1:3333',browserName:'chromium',
   headless:true,serviceWorkers:'block',
   trace:'off',video:'off',screenshot:'off'
 }
});
