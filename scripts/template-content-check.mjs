import { readFileSync } from 'node:fs';

const scenarios = readFileSync('lib/notifications/scenarios.ts', 'utf8');
const renderer = readFileSync('lib/notifications/templates.ts', 'utf8');
const registry = readFileSync('components/workspace/documents/documentRegistry.ts', 'utf8');
const adapter = readFileSync('components/workspace/documents/documentAdapter.ts', 'utf8');
const contracts = readFileSync('components/workspace/documents/documentDataContracts.ts', 'utf8');
const reviewActions = readFileSync('app/workspace/documents/review-actions.ts', 'utf8');
const language = readFileSync('components/workspace/documents/documentLanguage.ts', 'utf8');
const reviewPage = readFileSync('app/workspace/template-review/page.tsx', 'utf8');
const reviewCentre = readFileSync('components/workspace/templates/TemplateReviewCentre.tsx', 'utf8');
const documentsPage = readFileSync('app/workspace/documents/page.tsx', 'utf8');
const communicationsPage = readFileSync('app/workspace/communications/page.tsx', 'utf8');

const checks = [
  ['Enquiry acknowledgement uses direct reply', scenarios.includes("actionLabel:'Reply to this email'")],
  ['Requirements invitation uses a secure form', scenarios.includes("actionLabel:'Complete secure requirements form'")],
  ['Partner review uses a secure review', scenarios.includes("actionLabel:'Open secure delivery review'")],
  ['Partner assessment states that work must not begin', scenarios.includes('It is not an instruction to begin work')],
  ['Quotation acceptance confirms payment before delivery setup', scenarios.includes('recorded your written acceptance and confirmed the agreed payment')],
  ['Invoice actions use the secure invoice view', scenarios.includes("actionLabel:'View secure invoice'")],
  ['Partner delivery uses the secure workspace', scenarios.includes("actionLabel:'Open secure delivery workspace'")],
  ['Conversational actions generate mailto links', renderer.includes("content.action.startsWith('Reply')") && renderer.includes('mailto:')],
  ['Email templates are not listed as controlled documents', !registry.includes("{ slug: 'email-templates'")],
  ['Client-facing document data does not expose owner IDs', !adapter.includes("fact('Owner', lead.owner_id)")],
  ['Document data uses human-readable requirement labels', adapter.includes("fact('Requirement reference'") && adapter.includes("fact('Requirement'" )],
  ['Invoice documents use the invoice ledger', adapter.includes("many(supabase, 'invoices'") && !/slug === 'invoice'[\s\S]{0,500}quote\?\.(?:subtotal|vat|total)/.test(adapter)],
  ['Legacy document variants cannot become issue ready', contracts.includes("'requirement-sheet': contract('internal', ['technicalIntake'], false)") && contracts.includes("'technical-review': contract('internal', ['partnerAssessment'], false)") && contracts.includes("'quote': contract('client', ['clientQuote'], false)")],
  ['Legacy document variants are retired from the active suite', !registry.includes("{ slug: 'requirement-sheet'") && !registry.includes("{ slug: 'technical-review'") && !registry.includes("{ slug: 'quote'") && registry.includes("'requirement-sheet': 'client-requirements'")],
  ['Review and issue fail closed on evidence gaps', (reviewActions.match(/assertDocumentEvidenceReady\(/g) || []).length >= 3],
  ['Issueable document copy contains no authoring placeholders', !/body: '(?:List|Show|State|Record|Describe|Choose|Provide|Give|Reference|Carry forward)\b/.test(language.replace(/'email-templates':[\s\S]*$/, ''))],
  ['Template review centre requires workspace authentication', reviewPage.includes('await requireUserContext()')],
  ['Template review centre remains read only', !/(fetch\(|useActionState|<form|type="submit")/.test(reviewCentre)],
  ['Template review centre is linked from Documents and Messages', documentsPage.includes('href="/workspace/template-review"') && communicationsPage.includes('href="/workspace/template-review"')],
];

let failures = 0;
for (const [name, passed] of checks) {
  if (passed) console.log(`PASS ${name}`);
  else { console.error(`FAIL ${name}`); failures += 1; }
}

console.log(`Template content checks: ${checks.length - failures}/${checks.length} passed`);
if (failures) process.exit(1);
