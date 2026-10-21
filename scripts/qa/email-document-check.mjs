import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const require = createRequire(import.meta.url);
const Module = require('node:module');
const typescript = require('typescript');
const originalLoad = Module._load;
const rows = [];
const inbox = [];
let failNext = false;
let assertionCount = 0;
function check(condition, explanation) {
  assert.ok(condition, explanation);
  assertionCount += 1;
}
const fakeDb = {
  async rpc(name, args) {
    if (name === 'op_enqueue_notification') {
      const prior = rows.find(row => row.idempotency_key === args.p_idempotency_key);
      if (prior) return { data: prior.id, error: null };
      const id = '00000000-0000-4000-8000-' + String(rows.length + 1).padStart(12, '0');
      rows.push({
        id, idempotency_key: args.p_idempotency_key, event_key: args.p_event_key,
        category: args.p_category, recipient_email: args.p_recipient_email,
        recipient_name: args.p_recipient_name, subject: args.p_subject,
        template_key: args.p_template_key, payload: args.p_payload, status: 'pending',
        attempts: 0, scheduled_for: new Date(args.p_scheduled_for).getTime(),
      });
      return { data: id, error: null };
    }
    if (name === 'op_claim_notification_batch') {
      const due = rows.filter(row => row.status === 'pending' && row.scheduled_for <= Date.now())
        .slice(0, args.p_limit);
      for (const row of due) { row.status = 'processing'; row.attempts += 1; }
      return { data: due, error: null };
    }
    if (name === 'op_complete_notification') {
      const row = rows.find(r => r.id === args.p_id);
      row.status = 'sent'; row.provider_message_id = args.p_provider_message_id;
      return { data: null, error: null };
    }
    if (name === 'op_fail_notification') {
      const row = rows.find(r => r.id === args.p_id);
      row.status = 'pending'; row.last_error = args.p_error;
      row.scheduled_for = Date.now() + 300000;
      return { data: null, error: null };
    }
    throw new Error('Unexpected database RPC: ' + name);
  },
};
Module._load = function (request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => fakeDb };
  const name = request.startsWith('@/') ? resolve(root, request.slice(2)) : request;
  return originalLoad.call(this, name, parent, isMain);
};
for (const suffix of ['.ts', '.tsx']) {
  Module._extensions[suffix] = function (module, filename) {
    const source = readFileSync(filename, 'utf8');
    const result = typescript.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022,
        jsx: typescript.JsxEmit.ReactJSX, esModuleInterop: true,
      },
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter(d => d.category === typescript.DiagnosticCategory.Error);
    check(errors.length === 0, filename + ': TypeScript transpile errors');
    module._compile(result.outputText, filename);
  };
}
const { createClientQuotePdf } = require(resolve(root, 'lib/quotes/clientQuotePdf.ts'));
const { createControlledPdf } = require(resolve(root, 'lib/notifications/controlledPdf.ts'));
const { queueLifecycleEmail, lifecycleEmailScenarios } = require(resolve(root, 'lib/notifications/scenarios.ts'));
const { renderNotificationEmail } = require(resolve(root, 'lib/notifications/templates.ts'));
const { PDFDocument } = require('pdf-lib');

const quotePdf = await createClientQuotePdf({
  reference: 'OP-QA-EMAIL-2026-001', revision: 2,
  clientName: 'OP QA Test Engineering', recipientName: 'QA Client',
  validUntil: '2026-11-04', scope: 'Mechanical drawing review for test assembly',
  deliverables: 'Six controlled drawings and a PDF review package',
  assumptions: 'One complete input file set', exclusions: 'Site installation excluded',
  paymentTerms: 'Opening payment: GBP 300.00 (30%). Remaining balance GBP 700.00 before editable final files.',
  deliveryCommitment: 'Five working days after approved work order',
  currency: 'GBP', subtotal: 1000, vat: 0, total: 1000,
  lineItems: [{ description: 'Mechanical drawing package', quantity: 1, unit: 'lot', netTotal: 1000 }],
});
check(quotePdf.subarray(0, 5).toString() === '%PDF-', 'Quote must be a genuine PDF');
check((await PDFDocument.load(quotePdf)).getPageCount() >= 1, 'Quotation PDF must open');
const handoverPdf = await createControlledPdf('Client review package', {
  reference: 'OP-DOC-QA-001', revision: 'R02', subject: 'Mechanical assembly',
  sections: [{ title: 'Technical scope', facts: [
    { label: 'Deliverables', value: 'Controlled PDF review pack' },
    { label: 'Release', value: 'Subject to manual client-review approval' },
  ] }],
});
check(handoverPdf.subarray(0, 5).toString() === '%PDF-', 'Document engine must make PDF');
check((await PDFDocument.load(handoverPdf)).getPageCount() >= 1, 'Controlled PDF must open');
const temp = mkdtempSync(join(tmpdir(), 'opos-mail-pdf-'));
try {
  for (const [label, buffer, expected] of [
    ['quotation', quotePdf, ['OP-QA-EMAIL-2026-001', 'REVISION 2', 'GBP 300.00', 'GBP 700.00', 'Mechanical drawing']],
    ['review', handoverPdf, ['OP-DOC-QA-001', 'Controlled PDF review pack']],
  ]) {
    const filename = join(temp, label + '.pdf');
    writeFileSync(filename, buffer);
    const extracted = execFileSync('pdftotext', ['-layout', filename, '-'], { encoding: 'utf8' });
    for (const fragment of expected) check(extracted.includes(fragment), label + ' missing: ' + fragment);
  }
} finally { rmSync(temp, { recursive: true, force: true }); }

const scenarios = [
  'enquiry.received', 'requirements.received', 'partner_review.requested',
  'quote.issued', 'partner_work.released', 'client_delivery.final_released',
];
for (const scenario of scenarios) {
  const definition = lifecycleEmailScenarios[scenario];
  check(Boolean(definition), 'Lifecycle scenario is missing: ' + scenario);
  const id = await queueLifecycleEmail(fakeDb, {
    organisationId: '00000000-0000-4000-8000-000000000001',
    scenario, recipientEmail: 'qa-client@example.invalid',
    recipientName: 'QA Client', entityType: 'prospect',
    entityId: '00000000-0000-4000-8000-000000000002',
    actionUrl: 'https://qa.example.invalid/partner-review/secure-fake-token',
    payload: { reference: 'OP-QA-TEST-001', project: 'QA mechanical package' },
    idempotencyKey: 'qa:' + scenario,
  });
  check(Boolean(id), 'Scenario did not queue: ' + scenario);
  const row = rows.find(r => r.id === id);
  const rendered = await renderNotificationEmail(row);
  check(rendered.html.includes('QA Client') && rendered.text.includes('QA Client'), scenario + ' missing recipient');
  check(rendered.html.includes('OP-QA-TEST-001'), scenario + ' missing reference');
  check(rendered.html.length > 500, scenario + ' HTML output too short');
  if (scenario === 'partner_review.requested') {
    check(!rendered.html.includes('Real Customer Ltd'), 'Partner technical email leaked client identity');
  }
}
rows.length = 0;

const actionCode = readFileSync(resolve(root, 'app/workspace/orchestration/actions.ts'), 'utf8');
check(actionCode.includes('emailAttachments: [quoteAttachment]'), 'Approved quote PDF not persisted in notification outbox');
check(actionCode.includes('attachments: [quoteAttachment]'), 'Synchronous quotation path missing same PDF');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  check(String(url) === 'https://api.resend.com/emails', 'A fake inbox must intercept every provider call');
  const data = JSON.parse(String(init.body));
  inbox.push(data);
  if (failNext) {
    failNext = false;
    return new Response(JSON.stringify({ message: 'Synthetic email provider outage' }), { status: 503 });
  }
  return new Response(JSON.stringify({ id: 'qa-resend-' + inbox.length }), { status: 200 });
};
process.env.CRON_SECRET = 'qa-cron-secret';
process.env.RESEND_API_KEY = 're_qa_not_real';
process.env.RESEND_FROM_EMAIL = 'qa-sender@example.invalid';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'qa-service-key-not-real';
const { GET } = require(resolve(root, 'app/api/notifications/process/route.ts'));
const { NextRequest } = require('next/server');
const endpoint = 'http://127.0.0.1:3211/api/notifications/process';
function authorized() {
  return new NextRequest(endpoint, { headers: { authorization: 'Bearer qa-cron-secret' } });
}
const bad = await GET(new NextRequest(endpoint));
check(bad.status === 401, 'Worker must reject unauthenticated calls');

const emailId = await queueLifecycleEmail(fakeDb, {
  organisationId: '00000000-0000-4000-8000-000000000001',
  scenario: 'quote.issued', recipientEmail: 'qa-client@example.invalid',
  recipientName: 'QA Client', entityType: 'quote',
  entityId: '00000000-0000-4000-8000-000000000003',
  actionUrl: 'https://qa.example.invalid/client-portal/secure',
  payload: {
    reference: 'OP-QA-EMAIL-2026-001',
    actions: [{ label: 'Open your client portal', url: 'https://qa.example.invalid/client-portal/secure' }],
    emailAttachments: [{
      filename: 'OP-QA-EMAIL-2026-001-R2-Client-Quote.pdf',
      content: quotePdf.toString('base64'), content_type: 'application/pdf',
    }],
  },
  idempotencyKey: 'qa:quote:issued:revision2',
});
const first = await GET(authorized());
check(first.status === 200, 'Worker returned error');
check((await first.json()).processed === 1, 'Worker should process one due quotation');
check(inbox.length === 1, 'Exactly one quotation should enter fake inbox');
check(inbox[0].attachments?.[0]?.filename === 'OP-QA-EMAIL-2026-001-R2-Client-Quote.pdf', 'PDF missing from sent email');
check(Buffer.from(inbox[0].attachments[0].content, 'base64').equals(quotePdf), 'PDF mismatch between generation and inbox');
check(inbox[0].html.includes('https://qa.example.invalid/client-portal/secure'), 'Client portal URL missing');
check(rows.find(r => r.id === emailId).status === 'sent', 'Outbox must record successful provider acceptance');
await GET(authorized());
check(inbox.length === 1, 'Sent email must not be re-sent on worker replay');
const repeatedId = await queueLifecycleEmail(fakeDb, {
  organisationId: '00000000-0000-4000-8000-000000000001',
  scenario: 'quote.issued', recipientEmail: 'qa-client@example.invalid',
  entityType: 'quote', entityId: '00000000-0000-4000-8000-000000000003',
  idempotencyKey: 'qa:quote:issued:revision2',
});
check(repeatedId === emailId && rows.length === 1, 'Idempotent enqueue must reuse quote outbox record');

const secondId = await queueLifecycleEmail(fakeDb, {
  organisationId: '00000000-0000-4000-8000-000000000001',
  scenario: 'requirements.received', recipientEmail: 'qa-client@example.invalid',
  entityType: 'prospect', entityId: '00000000-0000-4000-8000-000000000005',
  idempotencyKey: 'qa:requirements:retry',
});
failNext = true;
const failed = await GET(authorized());
check(failed.status === 200 && (await failed.json()).results[0].status === 'failed', 'Failure must be recorded');
check(rows.find(r => r.id === secondId).status === 'pending', 'Transient failure must remain retryable');
check(inbox.length === 2, 'Fake inbox should record failed provider attempt');
rows.find(r => r.id === secondId).scheduled_for = Date.now() - 1;
const retried = await GET(authorized());
check(retried.status === 200 && (await retried.json()).results[0].status === 'sent', 'Worker retry must succeed');
check(rows.find(r => r.id === secondId).status === 'sent', 'Outbox must settle on eventual success');
check(inbox.length === 3, 'Exactly one retry after transient failure');
globalThis.fetch = originalFetch;
console.log('OPOS email/document QA passed: ' + assertionCount + ' checks; genuine quotation + controlled PDFs, 6 rendered scenarios, fake inbox, PDF attachment, auth, idempotency, retry. No external email sent.');
