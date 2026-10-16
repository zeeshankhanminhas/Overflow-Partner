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

  // Read-only supervision: report page routes, never page text, cookies, tokens or credentials.
  const appendSummary = async (message) => {
    if (!process.env.GITHUB_STEP_SUMMARY) return;
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, message + '\n');
  };
  let inspectedProject = false;
  let loggedIn = false;
  let lastRoute = '';
  console.log('Watching for manual sign-in and Projects navigation for up to 12 minutes.');
  await appendSummary('### Read-only Project 360 observation');
  for (let i = 0; i < 144; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const openPages = await browser.context.pages();
    const active = openPages.find(p => {
      try { return new URL(p.url()).hostname === 'overflow-partner.vercel.app' && new URL(p.url()).pathname.startsWith('/workspace'); }
      catch { return false; }
    }) ?? openPages[0];
    if (!active) continue;
    const currentUrl = new URL(active.url());
    // Never log query strings or fragments; they can contain sensitive tokens.
    const route = currentUrl.pathname;
    if (route !== lastRoute) {
      lastRoute = route;
      console.log('OP active route:', route);
      await appendSummary(`- Observed route: \`${route.replaceAll('`','')}\``);
    }
    if (route.startsWith('/workspace')) loggedIn = true;
    if (!loggedIn || inspectedProject) continue;
    const isProjects = /project/i.test(route);
    // If the operator is on a project page, inspect it. Otherwise monitor navigation.
    if (isProjects) {
      console.log('Projects route detected. Stagehand read-only Project 360 inspection starting.');
      try {
        const observations = await stagehand.observe('Identify visible sections for Project 360, mobilisation, documents, tasks, next actions and operating alerts. Observe only: never click, type, submit, approve, upload or modify data.');
        const count = Array.isArray(observations?.data) ? observations.data.length : 0;
        console.log('Project 360 inspection completed. UI controls identified:', count);
        await appendSummary(`- Project 360: inspected successfully; visible controls identified: ${count}`);
      } catch (err) {
        console.error('Project 360 observation failed:', err instanceof Error ? err.message : String(err));
        await appendSummary('- Project 360: observation failed (see logs).');
        process.exitCode = 1;
      }
      inspectedProject = true;
    }
  }
  if (!loggedIn) await appendSummary('- Sign-in: not observed during this run.');
  if (loggedIn && !inspectedProject) await appendSummary('- Projects: no Project route observed; no project inspection performed.');
  console.log('Read-only supervision finished. Browser session closing.');

} finally {
  await stagehand?.close().catch(() => {});
  await browser.close().catch(() => {});
}
