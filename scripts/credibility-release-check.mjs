import { existsSync, readFileSync } from 'node:fs';

const checks=[];
const expect=(condition,label)=>checks.push({pass:Boolean(condition),label});
const read=(path)=>readFileSync(path,'utf8');

const action=read('app/workspace/orchestration/actions.ts');
const case360=read('app/workspace/leads/[id]/page.tsx');
const releaseFields=read('app/workspace/leads/[id]/QuoteReleaseFields.tsx');
const projectRegister=read('app/workspace/projects/page.tsx');
const legacyActions=read('app/workspace/workflow-actions.ts');
const migration=read('supabase/migrations/20260903000500_project_opening_payment_gate.sql');
const releaseMigration=read('supabase/migrations/20261014215400_quote_release_condition_gate.sql');
const lifecycle=read('docs/BUSINESS_LIFECYCLE_CONSTITUTION.md');
const interaction=read('scripts/workspace-interaction-check.mjs');

expect(existsSync('app/api/intake/route.ts'),'Guided demo starts at governed enquiry intake');
expect(existsSync('app/workspace/acquisition/page.tsx'),'Guided demo includes Acquisition');
expect(existsSync('app/workspace/leads/[id]/page.tsx'),'Guided demo includes Case 360');
expect(existsSync('app/workspace/projects/[id]/page.tsx'),'Guided demo includes Project 360');

expect(action.includes("op_accept_quote_create_project_with_release_evidence"),'Case action uses the governed quote-release RPC');
expect(action.includes("['payment', 'purchase_order', 'no_advance_payment']")&&case360.includes('Confirm agreed release condition'),'Case 360 exposes payment, PO and no-advance quote conditions');
expect(existsSync('app/workspace/leads/[id]/QuoteReleaseFields.tsx')&&releaseFields.includes('No advance payment due under the issued quote'),'No-advance release is tied to terms in the issued quote');
expect(!projectRegister.includes('Create exceptional Project'),'Project register exposes no direct-creation bypass');
expect(legacyActions.includes('Project 360 can only be created from Case 360 after written client acceptance and evidence of the release condition agreed in the issued quote.'),'Stale direct Project action fails closed');

expect(migration.includes('create table if not exists public.quote_payment_confirmations'),'Payment evidence has an authoritative record');
expect(migration.includes('Project 360 requires recorded written client acceptance evidence.'),'Database trigger requires acceptance evidence');
expect(releaseMigration.includes('create table if not exists public.quote_release_confirmations')&&releaseMigration.includes("release_basis in ('purchase_order','no_advance_payment')"),'Non-payment release evidence has an authoritative record');
expect(releaseMigration.includes('quote_payment_confirmations p')&&releaseMigration.includes('quote_release_confirmations r')&&releaseMigration.includes('evidence that the issued quote release condition has been met'),'Database guard requires payment or documented quote release evidence');
expect(releaseMigration.includes('v_payment_terms')&&releaseMigration.includes('does not state that no advance payment is due'),'RPC verifies release basis against the issued quote terms');
expect(migration.includes('new.quote_id is null'),'Database trigger rejects unquoted Project creation');
expect(migration.includes("array['owner','admin','operator','commercial','business_development']"),'Payment-gated RPC has explicit role authority');
expect(migration.includes('from public, anon, authenticated'),'Previous acceptance-only RPC is unavailable to workspace callers');
expect(migration.includes('op_developer_delete_test_record(text,uuid) from public, anon'),'Developer deletion RPC is unavailable anonymously');
expect(migration.includes('client_payment_confirmed_for_project_release'),'Payment confirmation writes quote audit history');
expect(migration.includes('project_opening_payment_gate_satisfied'),'Project release writes Project audit history');
expect(lifecycle.includes('Quote Payment Confirmation'),'Lifecycle constitution defines payment evidence');
expect(interaction.includes("prefers-reduced-motion"),'Release suite covers reduced motion');
expect(interaction.includes(":focus-visible"),'Release suite covers keyboard focus');
expect(interaction.includes('100dvh'),'Release suite covers mobile viewport safety');

let failed=0;
for(const check of checks){
  console.log(`${check.pass?'PASS':'FAIL'} ${check.label}`);
  if(!check.pass)failed+=1;
}
console.log(`Credibility release checks: ${checks.length-failed}/${checks.length} passed`);
if(failed)process.exit(1);
