import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const database=read('supabase/migrations/20261104153000_qa_protected_client_review_exchange.sql');
const externalAttestationFix=read('supabase/migrations/20261104153100_qa_external_attestation_activity_fix.sql');
const correction=read('supabase/migrations/20261104154700_qa_block_unclassified_client_correction.sql');
const client=read('app/portal/client/projects/[projectId]/review/page.tsx');
const clientDecision=read('app/portal/client/projects/[projectId]/review/review-actions.ts');
const clientPdf=read('app/portal/client/projects/[projectId]/review/[fileId]/route.ts');
const clientProject=read('app/portal/[kind]/projects/[projectId]/page.tsx');
const clientHome=read('app/portal/[kind]/page.tsx');
const operator=read('app/opos-next/projects/[id]/page.tsx');
const operatorActions=read('app/opos-next/projects/[id]/qa-actions.ts');
const viewer=read('app/opos-next/projects/[id]/review-preview/WatermarkedPdfViewer.tsx');
const cases=[
 ['issue/decision have separate immutable, private RLS evidence tables',
  database.includes('create table if not exists public.op_qa_client_review_issues(')&&
  database.includes('create table if not exists public.op_qa_client_review_decisions(')&&
  database.includes('constraint op_qa_one_protected_issue_per_cycle unique(project_id,execution_cycle)')&&
  database.includes('alter table public.op_qa_client_review_issues enable row level security')&&
  database.includes('revoke all on public.op_qa_client_review_issues from public,anon,authenticated;')],
 ['only OP owner/admin may issue with QA engineering and manifest evidence',
  database.includes("v_role not in ('owner','admin')")&&
  database.includes("v_stage<>'ready_for_client_issue'")&&
   ["v_gate->>'engineering_accepted'","v_gate->>'manifest_verified'",
    "v_gate->>'release_authorised'"].every(p=>database.includes(p))],
 ['recipient identity is exact company membership and single-valued',
  database.includes("if v_count<>1 then")&&database.includes('m.is_active=true')&&
  database.includes("m.portal_kind='client'")&&database.includes("l.company_id=m.company_id")],
 ['issue records existing canonical client transmittal, not a synthetic delivery email',
  database.includes('insert into public.project_client_transmittals')&&
  database.includes("'client_portal',v_files")&&
  database.includes("'emailSent',false")],
 ['canonical lifecycle is still responsible for stage advancement',
  database.includes("perform public.op_advance_project_stage(p_project_id,'issued_to_client'")&&
  database.includes("perform public.op_advance_project_stage(p_project_id,'client_review'")],
 ['readiness requires the actual current QA issue rather than a generic transmittal',
  database.includes('public.op_qa_client_review_issues i')&&
  database.includes('i.manifest_hash=(public.op_qa_delivery_gate(p.id)->>')&&
  database.includes('An authenticated, current-cycle protected Client Portal review issue is required')],
 ['external client can only read the specific attributed current issue',
  database.includes('m.auth_user_id=v_user')&&database.includes('m.is_active=true')&&
  database.includes("m.portal_kind='client'")&&database.includes('i.execution_cycle=v_cycle')],
 ['external decision is attributable to auth.users rather than a staff impersonation',
  database.includes('decided_by uuid not null references auth.users(id)')&&
  database.includes('values(v_project.organisation_id,p_project_id,v_issue.id,v_user,p_outcome')&&
  externalAttestationFix.includes("'externalAuthUserId',v_user")],
 ['unclassified correction cannot automatically dispatch new partner work',
  correction.includes("if v_decision.outcome in ('changes_requested','rejected') then")&&
  correction.includes('scope classification before partner work')],
 ['client review page verifies membership and renders one controlled response',
  client.includes("portalContext('client')")&&client.includes("portal_my_projects")===false&&
  client.includes("op_qa_client_review_position")&&client.includes('<WatermarkedPdfViewer')&&
  client.includes('recordProtectedClientDecisionAction')],
 ['client decision server action calls the existing explicit auth user and guarded RPC',
  clientDecision.includes('supabase.auth.getUser()')&&
  clientDecision.includes("supabase.rpc('op_qa_record_client_review_decision'")&&
  clientDecision.includes("form.get('confirmed')")],
 ['PDF is scoped to external client and exact QA manifest, with no native-file URL',
  clientPdf.includes("supabase.rpc('op_qa_client_review_position'")&&
  clientPdf.includes("admin.rpc('op_qa_delivery_gate'")&&
  clientPdf.includes('gate.manifest_hash!==issue.manifest_hash')&&
  clientPdf.includes('gate.submission_id!==issue.submission_id')&&
  clientPdf.includes("download(file.path)")&&
  !clientPdf.includes('createSignedUrl')&&!clientPdf.includes('NextResponse.redirect(')],
 ['PDF server watermarks bytes, does not cache, or put service key in browser',
  clientPdf.includes('PDFDocument.load')&&clientPdf.includes("doc.save({useObjectStreams:false})")&&
  clientPdf.includes("'Cache-Control':'private, no-store, max-age=0'")],
 ['permanent client workspace directs to real controlled review',
  clientProject.includes('const secureReview=review?')&&
  clientHome.includes('const liveClientReview=')&&
  clientHome.includes('/review')],
 ['operator issue requires manual preview acknowledgement and server role check',
  operator.includes('preview_confirmed')&&
  operator.includes('issueProtectedClientReviewAction')&&
  operatorActions.includes('assertIsolatedQaBackend()')&&
  operatorActions.includes("assertRole(profile.role,['owner','admin'])")],
 ['no manual fake acceptance form remains in protected OP review stage',
  !operator.includes('action={recordClientReviewOutcomeAction}')&&
  operator.includes('reconcileProtectedClientReviewAction')&&
  operator.includes('staffReview?.decisionId')],
 ['review outcomes do not mutate financial settlement or release native files',
  !/\.from\('(?:partner_payables|project_payments|invoices)'\).(?:update|insert|upsert)/.test(
   client+clientDecision+clientPdf+operatorActions)],
 ['viewer validates actual PDF bytes instead of embedding opaque error',
  viewer.includes("response.headers.get('content-type')")&&viewer.includes("!tail.includes('%%EOF')")],
];
for(const [label,ok] of cases)assert.ok(ok,label);
console.log('Protected client review E2E contracts: '+cases.length+' issue, role, QA, decision and no-release checks PASS (static).');
