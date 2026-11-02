import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=p=>readFileSync(p,'utf8');
const sql=src('supabase/migrations/20261102002000_governed_partner_work_order_acceptance.sql');
const readSql=src('supabase/migrations/20261102002100_partner_wo_acceptance_member_read.sql');
const agreementSql=src('supabase/migrations/20261102002500_execution_partner_agreement_evidence_gate.sql');
const api=src('app/api/execution/[token]/route.ts');
const portal=src('components/execution/PartnerWorkSurface.tsx');
const auto=src('lib/execution/autoWorkOrder.ts');
const stage=src('app/workspace/projects/[id]/actions.ts');
const manual=src('app/workspace/projects/[id]/execution/actions.ts');
const project=src('app/opos-next/projects/[id]/page.tsx');
const readiness=src('app/opos-next/projects/[id]/work-order/page.tsx');
const action=src('app/opos-next/projects/[id]/work-order/action.ts');

const tests=[
  ['Acceptance has a unique controlled assignment identity',sql.includes('unique(assignment_id)')&&sql.includes('scope_document_id uuid not null')&&sql.includes('session_id uuid not null')],
  ['Acceptance RPC restricted to service role, not anonymous clients',sql.includes('revoke all on function public.op_record_partner_work_order_acceptance')&&sql.includes('grant execute on function public.op_record_partner_work_order_acceptance(uuid,uuid,text,text) to service_role')],
  ['Project Work Order status is read-only for organisation members',readSql.includes('grant select')&&readSql.includes('p.id=auth.uid()')&&!readSql.includes('grant insert')],
  ['No unsigned or expired session may accept a Work Order',api.includes('session.token_hash!==hashToken(token)')&&sql.includes('expires_at>now()')&&sql.includes("status in ('invited','opened','active')")],
  ['Explicit role and named signatory required, not page visit',api.includes("action:z.literal('accept_work_order')")&&api.includes('accepted_by_name')&&api.includes('accepted_by_role')&&api.includes('acceptance_confirmed:z.literal(true)')],
  ['Partner portal separates Work Order acceptance from commencement',portal.includes("mode==='accept'")&&portal.includes("send(e,'accept_work_order')")&&portal.includes('canStart=woAccepted&&')],
  ['API declines commencement before formal Work Order acceptance',api.includes("if(payload.action==='commencement')")&&api.includes("from('partner_work_order_acceptances')")&&api.includes('Formally accept the issued Work Order')],
  ['Database blocks direct commencement bypass',sql.includes('trg_op_wo_acceptance_before_commencement')&&sql.includes('Partner commencement is blocked')],
  ['Database blocks active execution stage without acceptance',sql.includes('trg_op_wo_acceptance_before_execution_stage')&&sql.includes('formally accepted Execution Partner Work Order')],
  ['QA partner is inherited from accepted commercial lineage',auto.includes("select('commercial_review_id')")&&auto.includes("select('partner_quote_id')")&&auto.includes("select('partner_id')")],
  ['Work Order release requires approved SOW, NDA and verified deposit',auto.includes("partner.status!=='approved'")&&auto.includes("!partner.nda_signed")&&auto.includes("finance?.basis!=='deposit'")&&auto.includes("'statement-of-work'")],
  ['Automatic mobilisation release resolves SOW and governed assignment',stage.includes('await ensureApprovedPartnerAssignment')&&stage.includes('await releaseApprovedPartnerWorkOrder')&&stage.includes('Exactly one current approved Statement of Work')],
  ['Manual invitation is also routed through governed release',manual.includes('await releaseApprovedPartnerWorkOrder')&&!manual.includes('placeholderToken')&&!manual.includes("status:'invited'")],
  ['Partner email uses stable branch origin, no ephemeral deployment URL',auto.includes('qaPublicOrigin()')&&!auto.includes("process.env.VERCEL_URL")],
  ['Work Order has unique reference and stable outbox idempotency',auto.includes('release_reference:project.project_number')&&auto.includes("'auto:work-order:'")],
  ['Project 360 links to readiness in modern UI',project.includes("+'/work-order'")&&project.includes('workOrderAcceptance')],
  ['Readiness surfaces missing partner lineage without fabricating approval',readiness.includes('commercial_review_id')&&readiness.includes('Not commercially selected')&&readiness.includes('not approved')],
  ['Operator retry is QA-only and identity-authorised',action.includes('assertIsolatedQaBackend()')&&action.includes("assertRole(profile.role,['owner','admin'])")],
  ['Outbox is never represented as delivered solely because queued',action.includes('queued (not yet delivered)')&&readiness.includes("email?.status==='sent'&&email.provider_message_id")],
  ['Execution Partner Agreement is independently verified before assignment',agreementSql.includes('trg_op_execution_partner_agreement_before_assignment')&&agreementSql.includes('signed_at<=a.verified_at')&&agreementSql.includes('reviewer.role::text')],
  ['Agreement evidence remains mandatory at formal Work Order acceptance',agreementSql.includes('trg_op_partner_agreement_before_wo_acceptance')&&auto.includes("from('partner_execution_agreement_evidence')")],
  ['Readiness displays missing signed agreement instead of assuming compliance',readiness.includes('partnerAgreementVerified')&&readiness.includes('not been independently verified')],
  ['Partner payment not offered as an advance',sql.includes('subject to client final payment')&&portal.includes('no partner advance is authorized')],
];
for(const [label,ok] of tests){assert.ok(ok,label);console.log('PASS '+label);}
console.log('OPOS Work Order acceptance contract QA: '+tests.length+' assertions passed (source + migration; live partner acceptance remains unverified).');
