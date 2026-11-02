import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=p=>readFileSync(p,'utf8');
const sql=src('supabase/migrations/20261102002000_governed_partner_work_order_acceptance.sql');
const readSql=src('supabase/migrations/20261102002100_partner_wo_acceptance_member_read.sql');
const agreementSql=src('supabase/migrations/20261102002500_execution_partner_agreement_evidence_gate.sql');
const paidWoSql=src('supabase/migrations/20261102004000_payment_triggered_partner_work_order.sql');
const handoffSql=src('supabase/migrations/20261102004500_work_order_handoff_state_and_finance_assignment_guard.sql');
const api=src('app/api/execution/[token]/route.ts');
const stripeWebhook=src('app/api/stripe/webhook/route.ts');
const handoff=src('lib/execution/paymentWorkOrderHandoff.ts');
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
  ['QA partner and price are inherited from the approved commercial review, without reselection',auto.includes("select('commercial_review_id')")&&auto.includes("select('partner_quote_id,status,approved_at')")&&auto.includes("review.status!=='approved'")&&auto.includes("select('id,lead_id,partner_id,price,currency,status,lead_time_days")],
  ['Work Order release requires approved technical scope, NDA, EPA and verified deposit',auto.includes("partner.status!=='approved'")&&auto.includes("!partner.nda_signed")&&auto.includes("finance?.basis!=='deposit'")&&auto.includes("'scope-of-work'")],
  ['Verified-payment webhook triggers Work Order, not mobilisation transition',stripeWebhook.includes('issueWorkOrderAfterVerifiedOpeningPayment')&&stripeWebhook.includes('reconciledProjectId')&&handoff.includes('ensureApprovedPartnerAssignment')&&handoff.includes('releaseApprovedPartnerWorkOrder')],
  ['Mobilisation only retries payment-driven handoff if evidence was unavailable',stage.includes('issueWorkOrderAfterVerifiedOpeningPayment')&&!stage.includes('await releaseApprovedPartnerWorkOrder')],
  ['Manual invitation is also routed through governed release',manual.includes('await releaseApprovedPartnerWorkOrder')&&!manual.includes('placeholderToken')&&!manual.includes("status:'invited'")],
  ['Partner email uses stable branch origin, no ephemeral deployment URL',auto.includes('qaPublicOrigin()')&&!auto.includes("process.env.VERCEL_URL")],
  ['Work Order has deterministic project reference and stable outbox idempotency',auto.includes("const expectedReference=project.project_number+'/WO-01'")&&auto.includes('release_reference:expectedReference')&&auto.includes("idempotencyKey:'auto:work-order:'")],
  ['Project 360 links to readiness in modern UI',project.includes("+'/work-order'")&&project.includes('workOrderAcceptance')],
  ['Readiness surfaces missing partner lineage without fabricating approval',readiness.includes('commercial_review_id')&&readiness.includes('Not commercially selected')&&readiness.includes('not approved')],
  ['Operator retry is QA-only and identity-authorised',action.includes('assertIsolatedQaBackend()')&&action.includes("assertRole(profile.role,['owner','admin'])")],
  ['Outbox is never represented as delivered solely because queued',action.includes('not yet proven delivered')&&readiness.includes("email?.status==='sent'&&email.provider_message_id")],
  ['Execution Partner Agreement is independently verified before assignment',agreementSql.includes('trg_op_execution_partner_agreement_before_assignment')&&agreementSql.includes('signed_at<=a.verified_at')&&agreementSql.includes('reviewer.role::text')],
  ['Agreement evidence remains mandatory at formal Work Order acceptance',agreementSql.includes('trg_op_partner_agreement_before_wo_acceptance')&&auto.includes("from('partner_execution_agreement_evidence')")],
  ['Readiness displays missing signed agreement instead of assuming compliance',readiness.includes('partnerAgreementVerified')&&readiness.includes('not been independently verified')],
  ['Work Order is an immutable priced document with no advance',paidWoSql.includes('create table if not exists public.partner_work_orders')&&paidWoSql.includes('partner_price numeric(14,2)')&&paidWoSql.includes('op_prevent_issued_partner_wo_mutation')&&paidWoSql.includes('no_partner_advance boolean')],
  ['Issued Work Order inherits the commercially selected partner and exact cost',src('supabase/migrations/20261102005500_inherit_partner_from_approved_commercial_review.sql').includes("pq.status::text in ('received','selected')")&&paidWoSql.includes('v_partner_quote.price<>new.partner_price')&&paidWoSql.includes('v_partner_quote.partner_id<>new.partner_id')],
  ['Work Order acceptance is allowed during mobilisation, but execution is still gated',paidWoSql.includes("v_project.project_stage not in ('mobilisation','ready_for_execution')")&&sql.includes('trg_op_wo_acceptance_before_commencement')&&sql.includes('trg_op_wo_acceptance_before_execution_stage')],
  ['Work Order scope is previously approved, while project SOW is later for mobilisation',paidWoSql.includes("document_type in ('scope-of-work','statement-of-work')")&&handoff.includes("doc.document_type==='scope-of-work'")],
  ['Verified deposit also gates assignment creation at database level',handoffSql.includes('No Execution Partner assignment before a verified opening deposit.')],
  ['Missing partner commercial evidence never rolls back a paid client',handoff.includes("status:'awaiting_evidence'")&&handoffSql.includes('project_work_order_handoffs')&&stripeWebhook.includes('workOrder:result.status')],
  ['Manual recovery is not a second approval or partner selection',action.includes('issueWorkOrderAfterVerifiedOpeningPayment')&&!action.includes('ensureApprovedPartnerAssignment')],
  ['Partner portal shows correct priced WO but no client sale price',api.includes("partner_work_orders').select('reference,partner_price,currency")&&portal.includes('state.work_order.partner_price')],
  ['Partner payment not offered as an advance',sql.includes('subject to client final payment')&&portal.includes('no partner advance is authorized')],
];
for(const [label,ok] of tests){assert.ok(ok,label);console.log('PASS '+label);}
console.log('OPOS Work Order acceptance contract QA: '+tests.length+' assertions passed (source + migration; live partner acceptance remains unverified).');
