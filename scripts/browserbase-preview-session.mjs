import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const url = 'https://overflow-partner-mh7jib5sg-zeeshankhanminhas-projects.vercel.app/workspace/v2';
if (!process.env.BROWSERBASE_API_KEY) throw new Error('Missing GitHub Actions secret BROWSERBASE_API_KEY');
const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
const session = await bb.sessions.create({
  ...(process.env.BROWSERBASE_PROJECT_ID ? { projectId: process.env.BROWSERBASE_PROJECT_ID } : {}),
  api_timeout: 600,
});
console.log('Browserbase session created. Open Browserbase Dashboard → Sessions → Active to view or control the browser.');
let browser;
try {
  browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Navigation attempted. Inspect current page in Browserbase live view.');
  console.log('Session will stay available for up to 8 minutes. Do not enter real payment information.');
  await new Promise(resolve => setTimeout(resolve, 480000));
} finally {
  await browser?.close().catch(() => {});
  await bb.sessions.update(session.id, { status: 'REQUEST_RELEASE' }).catch(() => {});
}
