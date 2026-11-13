// No hosted credentials, no production writes and no network submissions to /api/intake.
// This file is executed against a locally started Next.js build in GitHub Actions.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const base = process.env.OPOS_MARKETING_BASE_URL || 'http://127.0.0.1:3100';
const routes = ['/', '/services', '/services/cad-modelling', '/services/production-drawings',
  '/process', '/assurance', '/assurance/templates', '/about', '/faq',
  '/contact', '/privacy', '/terms', '/cookie-policy', '/login'];
let passed = 0;
const report = message => { passed++; console.log('PASS ' + message); };
const url = path => new URL(path, base).toString();
async function checkHttpRoutes() {
  for (const path of routes) {
    const response = await fetch(url(path), { signal: AbortSignal.timeout(20000), redirect: 'manual' });
    assert.equal(response.status, 200, path + ' should return HTTP 200');
    assert.match(response.headers.get('content-type') || '', /text\/html/i, path + ' must serve HTML');
  }
  report('14 public routes and secure login return HTML 200');
}
async function checkPdfs() {
  for (const [path, count] of [
    ['/api/public/capability-statement', 2],
    ['/api/public/sample-handover', 3],
  ]) {
    const response = await fetch(url(path), { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, path + ' must succeed');
    assert.match(response.headers.get('content-type') || '', /application\/pdf/i);
    assert.match(response.headers.get('content-disposition') || '', /attachment; filename=/i);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('ascii'), '%PDF-');
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), count, 'PDF page count mismatch for ' + path);
    for (const page of pdf.getPages()) {
      const {width, height} = page.getSize();
      assert.ok(width >= 590 && width <= 600 && height >= 837 && height <= 847, 'PDF should be A4');
    }
    report(path + ' renders ' + count + ' A4 PDF pages');
  }
}
const browser = await chromium.launch({headless:true});
try {
  await checkHttpRoutes();
  await checkPdfs();

  const fresh = await browser.newContext({viewport:{width:1440,height:900}});
  const consent = await fresh.newPage();
  await consent.goto(url('/'), {waitUntil:'domcontentloaded'});
  const privacyPanel = consent.getByRole('region', {name:'Privacy and analytics preferences'});
  await privacyPanel.waitFor({state:'visible'});
  await consent.getByRole('button', {name:'Decline analytics'}).click();
  await privacyPanel.waitFor({state:'hidden'});
  await consent.getByRole('button', {name:'Cookie preferences'}).click();
  await privacyPanel.waitFor({state:'visible'});
  await consent.getByRole('button', {name:'Decline analytics'}).click();
  await consent.goto(url('/login'));
  assert.equal(await consent.locator('.cookie_banner').count(), 0, 'No marketing consent in secure login');
  report('Consent can be declined, reopened and stays off secure login');
  await fresh.close();

  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(() => localStorage.setItem('overflow_partner_cookie_consent', 'rejected'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    for (const path of ['/', '/assurance', '/assurance/templates', '/contact']) {
      await page.goto(url(path), {waitUntil:'domcontentloaded'});
      await page.locator('body').waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 2, path + ' has horizontal viewport overflow at ' + width + 'px: ' + overflow + 'px');
      assert.equal(await page.locator('h1').count() >= 1, true, path + ' should have a visible page heading');
    }
    await page.goto(url('/'));
    const header = page.locator('header.section_header');
    if (width < 1280) {
      const toggle = header.getByRole('button', {name:'Open navigation'});
      await toggle.click();
      const nav = page.getByRole('navigation', {name:'Mobile navigation'});
      assert.equal(await nav.isVisible(), true, 'Mobile nav should expand');
      assert.ok(await nav.getByRole('link', {name:/Sign In/}).isVisible(), 'Mobile nav should include secure Sign In');
      await nav.getByRole('link', {name:/Sign In/}).click();
      await page.waitForURL('**/login', {timeout:10000});
      assert.equal(new URL(page.url()).pathname, '/login');
    } else {
      const signIn = header.getByRole('link', {name:'Sign In',exact:true});
      assert.equal(await signIn.isVisible(), true);
      await signIn.click();
      await page.waitForURL('**/login', {timeout:10000});
      assert.equal(new URL(page.url()).pathname, '/login');
    }
    assert.equal(await page.getByRole('heading', {name:'Sign In'}).isVisible(), true, 'Branded login should have a heading');
    assert.ok(await page.getByRole('link', {name:'Discuss a Requirement'}).isVisible());
    assert.deepEqual(errors, [], 'Unexpected frontend errors: ' + errors.join('; '));
    report('Responsive pages, links and login at ' + width + 'px');
    await context.close();
  }

  const context = await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(() => localStorage.setItem('overflow_partner_cookie_consent', 'rejected'));
  const page = await context.newPage();
  await page.goto(url('/contact'));
  const form = page.locator('form.form_enquiry');
  assert.equal(await form.isVisible(), true, 'Enquiry form visible');
  assert.ok(await form.locator('select[name="project_type"] option').count() >= 7, 'Service selection populated');
  let requests = 0;
  await page.route('**/api/intake', async route => {
    requests++;
    const payload = route.request().postDataJSON();
    assert.equal(payload.work_email, 'qa@example.invalid');
    assert.equal(payload.nurture_consent, 'false', 'Marketing follow-up is optional and off by default');
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,submissionId:'TEST-MOCK-001',timestamp:new Date().toISOString(),
        acknowledgement:'queued',step2:{created:true,emailStatus:'queued'}})});
  });
  await form.getByLabel('Full Name').fill('QA Example');
  await form.getByLabel('Work Email').fill('qa@example.invalid');
  await form.getByLabel('Company').fill('QA Synthetic Engineering');
  await form.getByLabel('Project Type').selectOption({index:1});
  await form.getByLabel('What would you like help with?').fill('Synthetic requirement for frontend preflight only; no real enquiry.');
  await form.getByRole('button', {name:'Send enquiry'}).click();
  await form.getByRole('status').waitFor();
  assert.match(await form.getByRole('status').innerText(), /TEST-MOCK-001/);
  assert.equal(requests, 1);
  report('Mock enquiry success and acknowledgement reference (NO real lead/email)');

  await page.unroute('**/api/intake');
  await page.route('**/api/intake', route => route.fulfill({status:503,contentType:'application/json',
    body:JSON.stringify({success:false,message:'Enquiries are temporarily unavailable. Please try again later.'})}));
  await form.getByLabel('Full Name').fill('QA Example');
  await form.getByLabel('Work Email').fill('qa@example.invalid');
  await form.getByLabel('Company').fill('QA Synthetic Engineering');
  await form.getByLabel('Project Type').selectOption({index:1});
  await form.getByLabel('What would you like help with?').fill('Second synthetic requirement to verify error feedback.');
  await form.getByRole('button', {name:'Send enquiry'}).click();
  await form.getByRole('alert').waitFor();
  assert.match(await form.getByRole('alert').innerText(), /temporarily unavailable/);
  report('Mock enquiry 503 displays accessible error (NO production write)');
  await context.close();
  console.log('Public frontend isolated smoke: ' + passed + ' checks passed');
} finally {
  await browser.close();
}
