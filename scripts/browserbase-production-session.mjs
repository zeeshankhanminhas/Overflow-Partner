import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const apiKey = process.env.BROWSERBASE_API_KEY;
const projectId = process.env.BROWSERBASE_PROJECT_ID;
const targetUrl = 'https://overflow-partner.vercel.app/login';
if (!apiKey) throw new Error('Missing GitHub Actions secret BROWSERBASE_API_KEY');
if (!projectId) throw new Error('Missing GitHub Actions secret BROWSERBASE_PROJECT_ID');

const bb = new Browserbase({ apiKey });
const session = await bb.sessions.create({ projectId });
console.log('Browserbase session ID:', session.id);
console.log('Go to Browserbase Dashboard → Sessions to view this session.');
let browser;
try {
  browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Opened production OP login page; no credentials entered and no forms submitted.');
  console.log('Session remains available for up to five minutes for supervised inspection.');
  await new Promise(resolve => setTimeout(resolve, 300000));
} finally {
  await browser?.close().catch(() => {});
  await bb.sessions.update(session.id, { status: 'REQUEST_RELEASE' }).catch(() => {});
}
