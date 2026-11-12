import {assertDisposableBrowserEnvironment} from './policy.mjs';
import {resolve} from 'node:path';
import {defineConfig} from '@playwright/test';
assertDisposableBrowserEnvironment(process.env);
export default defineConfig({testDir:'.',testMatch:'journey.spec.mjs',outputDir:resolve(process.cwd(),'qa/write-browser/artifacts'),workers:1,retries:0,timeout:900000,reporter:[['list'],['json',{outputFile:resolve(process.cwd(),'qa/write-browser/results.json')}]],use:{baseURL:'http://127.0.0.1:3211',browserName:'chromium',headless:true,trace:'off',video:'off',screenshot:'off'}});
