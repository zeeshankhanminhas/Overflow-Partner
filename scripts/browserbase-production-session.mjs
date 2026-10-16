import { browserbase, Stagehand } from '@browserbasehq/stagehand';

const apiKey = process.env.BROWSERBASE_API_KEY;
const projectId = process.env.BROWSERBASE_PROJECT_ID;
if (!apiKey || !projectId) throw new Error('Browserbase GitHub secrets BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID are required.');

const browser = await browserbase.launch({ apiKey, projectId });
let stagehand;
try {
  const sessionId = browser.sessionId ?? browser.session?.id;
  const sessionUrl = sessionId ? `https://www.browserbase.com/sessions/${encodeURIComponent(sessionId)}` : 'https://www.browserbase.com/sessions';
  console.log('Browserbase session:', sessionUrl);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `## OP Browserbase browser session\\n\\n[Open Browserbase session](${sessionUrl})\\n\\nLogin manually in the live session; Stagehand observation is read-only.\\n` .replaceAll('\\n', '\n'));
  }

  stagehand = await Stagehand.create({ browser, cache: true });
  const pages = await browser.context.pages();
  const page = pages[0];
  if (!page) throw new Error('No active Browserbase page.');
  await page.goto('https://overflow-partner.vercel.app/login');
  console.log('OP production login opened in Browserbase. Sign in using the Browserbase live session viewer.');
  console.log('This run is read-only. No clicks, form submissions or payment actions are performed by the runner.');

  // Wait for the operator's manual login; do not collect or transmit credentials.
  let signedIn = false;
  for (let i = 0; i < 48; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const url = await page.url();
    if (new URL(url).pathname.startsWith('/workspace')) { signedIn = true; break; }
  }
  if (!signedIn) {
    console.log('Login not detected. Leaving the browser available for another 8 minutes for manual inspection.');
    await new Promise(resolve => setTimeout(resolve, 8 * 60 * 1000));
  } else {
    console.log('Operator sign-in detected. Stagehand is observing workspace navigation.');
    try {
      const result = await stagehand.observe('Identify the visible navigation controls for Quotes and Payments. Do not click, type, submit or change anything.');
      console.log('Stagehand observation completed; navigation matches:', Array.isArray(result?.data) ? result.data.length : 0);
    } catch (error) {
      console.error('Stagehand observation failed:', error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    console.log('Keeping browser open for up to 9 more minutes for supervised review.');
    await new Promise(resolve => setTimeout(resolve, 9 * 60 * 1000));
  }
} finally {
  await stagehand?.close().catch(() => {});
  await browser.close().catch(() => {});
}
