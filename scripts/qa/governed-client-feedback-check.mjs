import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261104210000_qa_governed_client_feedback_classification.sql');
const reviewState=read('supabase/migrations/20261104211500_qa_staff_review_classification_projection.sql');
const entitlement=read('supabase/migrations/20261104213000_qa_reuse_canonical_client_correction_entitlement.sql');
const operator=read('app/opos-next/projects/[id]/page.tsx');
const actions=read('app/opos-next/projects/[id]/qa-actions.ts');
const partner=read('components/execution/PartnerWorkSurface.tsx');
const partnerApi=read('app/api/execution/[token]/route.ts');
const canonical=read('lib/presentation/canonicalProjectDecision.ts');
const cases=[
 ['classification is separately audited and bound to the exact client decision',
  migration.includes('create table if not exists public.op_qa_client_correction_classifications(')&&
  migration.includes('decision_id uuid not null unique references')&&
  migration.includes('issue_id uuid not null unique references')&&
  migration.includes('execution_cycle integer not null')&&
  migration.includes('classified_by uuid not null references public.profiles(id)')],
 ['classification evidence is private with row-level security',
  migration.includes('alter table public.op_qa_client_correction_classifications enable row level security')&&
  migration.includes('revoke all on public.op_qa_client_correction_classifications from public,anon,authenticated')],
 ['only an authorised owner may classify actual current client feedback',
  migration.includes("v_role not in ('owner','admin')")&&
  migration.includes("v_project.project_stage<>'client_review'")&&
  migration.includes("v_decision.outcome not in ('changes_requested','rejected')")&&
  migration.includes('i.execution_cycle=v_cycle')],
 ['one included correction comes from the existing canonical entitlement ledger',
  entitlement.includes("if p_classification='included_correction' then")&&
  entitlement.includes('public.op_client_correction_entitlements')&&
  entitlement.includes('if v_used>=1 then raise exception')&&
  !entitlement.includes("from public.op_qa_client_correction_classifications\n   where project_id=p_project_id")],
 ['partner defect classification requires a corrective instruction',
  migration.includes("'partner_defect'")&&
  migration.includes("length(btrim(coalesce(p_partner_instruction,'')))<25")],
 ['partner correction instructions do not disclose client contact data',
  partnerApi.includes("select('classification,partner_instruction,classified_at,execution_cycle')")&&
  !partnerApi.includes("select('recipient_email,")],
 ['new scope creates an unpriced proposal without dispatching partner work',
  migration.includes("p_classification='variation'")&&
  migration.includes("'proposed',v_user")&&
  migration.includes("'partnerInstructed',false")&&
  migration.includes("'projectStage','client_review'")&&
  migration.includes("'No programme change approved'")],
 ['canonical correction requires externally attested feedback and same-cycle classification',
  migration.includes("c.classification in ('included_correction','partner_defect')")&&
  migration.includes("p_evidence_reference='QA-PORTAL/'||d.id::text")&&
  migration.includes("Current protected review requires an actual authenticated client decision")],
 ['existing canonical classified review and stage machine reopen one governed cycle',
  entitlement.includes('public.op_record_classified_client_review(')&&
  entitlement.includes("'in_scope_correction',p_classification='partner_defect'")&&
  entitlement.includes("if v_result->>'projectStage'<>'partner_correction'")&&
  entitlement.includes("'newExecutionCycle',v_cycle+1")],
 ['scope classification and canonical entitlement/partner rework share one transaction',
  migration.includes('insert into public.op_qa_client_correction_classifications')&&
  entitlement.includes("v_result:=public.op_record_classified_client_review")],
 ['Project 360 includes explicit operator classification and authorisation',
  operator.includes('classifyClientFeedbackAction')&&
  operator.includes('classification_authorised')&&
  operator.includes('included_correction')&&operator.includes('partner_defect')&&
  operator.includes('variation')],
 ['server action independently validates QA isolation, role and project stage',
  actions.includes('export async function classifyClientFeedbackAction')&&
  actions.includes('assertIsolatedQaBackend()')&&
  actions.includes("assertRole(profile.role,['owner','admin'])")&&
  actions.includes("project.project_stage!=='client_review'")],
 ['Operator sees pending variation and cannot classify it twice',
  reviewState.includes("'feedbackClassification',v_classification")&&
  operator.includes('staffReview.feedbackClassification?')&&
  operator.includes("staffReview.feedbackClassification==='variation'")],
 ['partner token must already be validated and instruction limited to current cycle',
  partnerApi.includes("const{supabase,session,assignment}=await loadSession(token)")&&
  partnerApi.includes("const correctionResult=isKnownIsolatedQaBackend()")&&
  partnerApi.includes("Number(assignment.execution_cycle)-1")&&
  partnerApi.includes(".eq('organisation_id',assignment.organisation_id)")&&
  partnerApi.includes(".eq('project_id',assignment.project_id)")],
 ['Partner Work displays OP-approved instruction with no date or price amendment',
  partner.includes('state.correction_instruction?.instruction')&&
  partner.includes('state.correction_instruction.instruction')&&
  partner.includes('This instruction does not amend the agreed Work Order price or delivery date.')],
 ['correction still returns to a fresh submission and canonical partner decision',
  canonical.includes("'correct_execution'")&&
  partner.includes("correction?'Submit corrected drawings'")],
 ['no new payments or native file releases are performed by this correction workflow',
  !/\.from\('(invoices|project_payments|partner_payables)'\).(insert|update|upsert)/.test(
    operator+actions+partner+partnerApi)],
];
for(const [label,ok] of cases)assert.ok(ok,label);
console.log('Governed client feedback: '+cases.length+' classification, partner and commercial separation checks PASS (static).');
