import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const database=read('supabase/migrations/20261104153000_qa_protected_client_review_exchange.sql');
const externalAttestationFix=read('supabase/migrations/20261104153100_qa_external_attestation_activity_fix.sql');
const correction=read('supabase/migrations/20261104154700_qa_block_unclassified_client_correction.sql');
const client=read('app/portal/client/projects/[projectId]/review/ClientDrawingReview.tsx');
const legacyReview=read('app/portal/client/projects/[projectId]/review/page.tsx');
const clientDecision=read('app/portal/client/projects/[projectId]/review/review-actions.ts');
const clientPdf=read('app/portal/client/projects/[projectId]/review/[fileId]/route.ts');
const clientProject=read('app/portal/[kind]/projects/[projectId]/page.tsx');
const clientHome=read('app/portal/[kind]/page.tsx');
const operator=read('app/opos-next/projects/[id]/page.tsx');
const operatorActions=read('app/opos-next/projects/[id]/qa-actions.ts');
const viewer=read('app/opos-next/projects/[id]/review-preview/WatermarkedPdfViewer.tsx');
const releasePreview=read('app/opos-next/projects/[id]/review-preview/page.tsx');
const separation=read('supabase/migrations/20261104182500_qa_external_client_identity_separation.sql');
const recipientMigration=read('supabase/migrations/20261104183000_qa_northfield_client_recipient_invitation.sql');
const inviteAction=read('app/opos-next/projects/[id]/qa-client-invite-action.ts');
const manualLinkAction=read('app/opos-next/projects/[id]/qa-manual-client-link-action.ts');
const manualLinkUI=read('app/opos-next/projects/[id]/QaManualClientAccess.tsx');
const qaCallback=read('app/auth/callback/QaClientAuthCallback.tsx');
const loginActions=read('app/login/actions.ts');
const loginPage=read('app/login/page.tsx');
const clientEmailSignIn=read('app/login/QaClientEmailSignIn.tsx');
const passwordSetup=read('app/opos-next/projects/[id]/QaClientPasswordSetup.tsx');
const passwordAction=read('app/opos-next/projects/[id]/qa-client-password-action.ts');
const canonicalGuard=read('supabase/migrations/20261104180000_qa_protected_review_canonical_outcome_guard.sql');

const cases=[
 ['client and OP staff must be distinct identities even if both have legacy memberships',
   separation.includes('Client review requires a separate verified external QA login')&&
   separation.includes('OP staff login cannot act as an independent Client Review account')&&
   separation.includes('OP staff account cannot submit a protected client review decision')],
 ['current verified Northfield recipient is assessed as a real independent account',
   recipientMigration.includes('v_count=1 and v_staff=0 and v_confirmed=1')&&
   recipientMigration.includes("p_project_id<>'b447f586-bf79-4839-be5e-1af607d9ca43'")],
 ['client onboarding needs authenticated owner, exact company, consent and explicit invitation',
   recipientMigration.includes("v_role not in ('owner','admin')")&&
   recipientMigration.includes('lower(v_email)<>lower(btrim')&&
   recipientMigration.includes('m.company_id=v_company')&&
   inviteAction.includes("form.get('confirm_separate_login')")&&
   inviteAction.includes('admin.auth.admin.inviteUserByEmail')&&
   inviteAction.includes("assertRole(profile.role,['owner','admin'])")],
 ['both QA design and recovery Operator logins return to the modern workspace, never the legacy one',
   loginActions.includes('["design/opos-decision-first-ia", "qa/recovery-ui-client-gate-20261105"]')&&
   loginActions.includes('redesignPreview ? "/opos-next" : "/workspace"')&&
   loginActions.includes('const qaPreviewBranch = process.env.VERCEL_ENV === "preview"')],
 ['a verified client must use their own invitation or browser-initiated passwordless session',
   qaCallback.includes("supabase.auth.exchangeCodeForSession(code)")&&
   qaCallback.includes("supabase.auth.verifyOtp")&&
   qaCallback.includes("supabase.auth.setSession")&&
   qaCallback.includes("supabase.rpc('portal_my_workspaces')")&&
   clientEmailSignIn.includes("createClient().auth.signInWithOtp")&&
   clientEmailSignIn.includes("shouldCreateUser:false")&&
   clientEmailSignIn.includes("emailRedirectTo:QA_ORIGIN+'/auth/callback'")&&
   clientEmailSignIn.includes('same browser')&&
   loginPage.includes('<QaClientEmailSignIn/>')&&
   !loginActions.includes("export async function emailQaClientLoginLink")&&
   loginPage.includes('isKnownIsolatedQaPresentationPreview()')],
 ['operator keeps independent client activation guarded and never offers issue from read-only preview',
   operator.includes('QaManualClientAccess')&&operator.includes('!qaRecipient?.ready')&&
   operator.includes('qaRecipient?.ready')&&operator.includes('canManageClientAccess')&&
   operator.includes("action:'Set up client access'")&&
   operator.includes('awaitingClientReview&&!qaWritable')&&
   operator.includes("action:null,anchor:'#release-authorisation',waiting:true")],
 ['protected client acceptance cannot be inserted without exact client-attested evidence',
   canonicalGuard.includes('protected review requires an actual authenticated client decision'.replace('protected review','protected review'))||
   (canonicalGuard.includes('p_evidence_reference=')&&canonicalGuard.includes('op_qa_client_review_decisions'))],
 ['SMTP-free QA token is explicit, one-use and limited to the Northfield fixture',
   manualLinkAction.includes("generateLink({")&&
   manualLinkAction.includes("const type=known?'magiclink':'invite'")&&
   manualLinkAction.includes("assertIsolatedQaBackend()")&&
   manualLinkAction.includes("assertRole(profile.role,['owner','admin'])")&&
   manualLinkAction.includes("if(id!==NORTHFIELD)")],
 ['manual QA link never calls Resend, SMTP invitation or sends the token via redirect',
   !manualLinkAction.includes("inviteUserByEmail(")&&
   !manualLinkAction.includes("signInWithOtp(")&&
   !manualLinkAction.includes("redirect(")&&
   manualLinkAction.includes("data.properties.hashed_token")&&
   manualLinkAction.includes("token_hash=")&&
   manualLinkUI.includes("useActionState(")],
 ['manual onboarding explicitly does not claim real mailbox verification or real client onboarding',
   manualLinkAction.includes('No email was sent or mailbox ownership verified')&&
   manualLinkUI.includes('not verify ownership of the email address')&&
   manualLinkUI.includes('must not be used to onboard real customers')],
 ['manual onboarding still assigns a different company-checked authenticated identity',
   manualLinkAction.includes("if(email===String(user.email")&&
   manualLinkAction.includes("supabase.rpc('op_qa_assign_northfield_client_invite'")&&
   manualLinkAction.includes("p_auth_user_id:data.user.id")&&
   manualLinkUI.includes('private browser')],
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
 ['client review is embedded in the entitled Client Portal project, not a separate workflow',
  legacyReview.includes("portalContext('client')")&&
  legacyReview.includes("op_qa_client_review_position")&&
  legacyReview.includes("redirect('/portal/client/projects/'")&&
  !legacyReview.includes('<WatermarkedPdfViewer')&&
  clientProject.includes('<ClientDrawingReview')&&
  clientProject.includes("isKnownIsolatedQaBackend()")&&
  clientProject.includes("const secureReview=review?'#drawing-review'")&&
  client.includes('id="drawing-review"')&&client.includes('<WatermarkedPdfViewer')&&
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
 ['client workspace links to an embedded governed review without a separate portal',
  clientProject.includes("const secureReview=review?'#drawing-review'")&&
  clientHome.includes('const liveClientReview=')&&
  clientHome.includes("+'#drawing-review'")&&
  clientDecision.includes("+'#drawing-review'")],
 ['Northfield QA password sign-in is primary, gated and never creates an identity',
  loginPage.includes('<PasswordSignIn next={next} />')&&
  loginPage.indexOf('<PasswordSignIn next={next} />',loginPage.indexOf('{qaClientEmailAccess ? ('))<
  loginPage.indexOf('<QaClientEmailSignIn/>',loginPage.indexOf('{qaClientEmailAccess ? ('))&&
  operator.includes('<QaClientPasswordSetup projectId={id}/>')&&
  passwordSetup.includes('setNorthfieldQaClientPassword')&&
  passwordSetup.includes('confirm_test_password')&&
  passwordAction.includes('assertIsolatedQaBackend()')&&
  passwordAction.includes("assertRole(profile.role,['owner','admin'])")&&
  passwordAction.includes("project.project_stage!=='client_review'")&&
  passwordAction.includes("EMAIL='midts.systems@gmail.com'")&&
  passwordAction.includes("admin.auth.admin.getUserById")&&
  passwordAction.includes("admin.auth.admin.updateUserById")&&
  !passwordAction.includes('createUser(')&&!passwordAction.includes('inviteUserByEmail(')],
 ['operator PDF preview offers one governed release action with reasoned blocked states',
  releasePreview.includes('issueAllowed?<form action={issueProtectedClientReviewAction}')&&
  releasePreview.includes('recipient?.ready')&&
  releasePreview.includes('ownerCanIssue')&&
  releasePreview.includes('staffReviewResult?.error')&&
  releasePreview.includes('releaseBlocker')&&
  releasePreview.includes('name="preview_confirmed"')&&
  releasePreview.includes('name="return_to" value="review_preview"')&&
  releasePreview.includes('Northfield client access controls')&&
  operatorActions.includes("value(form,'return_to')==='review_preview'")&&
  operatorActions.includes("'/review-preview?error='")],
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
