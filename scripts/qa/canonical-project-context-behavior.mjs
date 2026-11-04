import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalProjectDecision} from '../../lib/presentation/canonicalProjectDecision.ts';

// Real state-machine assertions. No database writes, tokens, role impersonation
// or invented client review approvals. Every row uses recorded-evidence-shaped input.
const cases=[
 ['project cannot issue WO before its record exists',{stage:'mobilisation',workOrderIssued:false},'issue_work_order','operator'],
 ['partner must accept issued WO',{stage:'mobilisation',workOrderIssued:true,workOrderAccepted:false},'accept_work_order','partner'],
 ['WO accepted does not commence engineering',{stage:'mobilisation',workOrderIssued:true,workOrderAccepted:true},'complete_mobilisation','operator'],
 ['ready for execution still needs formal WO acceptance',{stage:'ready_for_execution',workOrderAccepted:false},'accept_work_order','partner'],
 ['accepted WO needs separate partner commencement',{stage:'ready_for_execution',workOrderAccepted:true},'confirm_commencement','partner'],
 ['partner owns actual execution',{stage:'in_progress',executionState:'executing'},'perform_execution','partner'],
 ['submitted engineering returns to OP',{stage:'in_progress',executionState:'delivery_submitted'},'await_partner_submission','operator'],
 ['correction round belongs to partner',{stage:'partner_correction',executionState:'executing'},'correct_execution','partner'],
 ['submitted correction returns to OP',{stage:'partner_correction',executionState:'delivery_submitted'},'await_partner_submission','operator'],
 ['missing QA evidence blocks inspection',{stage:'internal_review',qaAvailable:false,hasSubmission:false},'evidence_unavailable','operator'],
 ['missing storage blocks engineering acceptance',{stage:'internal_review',qaAvailable:true,hasSubmission:true,storageComplete:false},'evidence_unavailable','operator'],
 ['Northfield R01: engineering review is next',{stage:'internal_review',qaAvailable:true,hasSubmission:true,storageComplete:true,engineeringAccepted:false,manifestVerified:false},'engineering_review','operator'],
 ['accepted R01 still needs document manifest',{stage:'internal_review',qaAvailable:true,hasSubmission:true,storageComplete:true,engineeringAccepted:true,manifestVerified:false},'verify_manifest','operator'],
 ['accepted and verified R01 may prepare package',{stage:'internal_review',qaAvailable:true,hasSubmission:true,storageComplete:true,engineeringAccepted:true,manifestVerified:true},'advance_internal_review','operator'],
 ['file verification required before release authority',{stage:'ready_for_client_issue',qaAvailable:true,engineeringAccepted:true,manifestVerified:false,releaseAuthorised:false},'evidence_unavailable','operator'],
 ['owner must authorise client review preparation',{stage:'ready_for_client_issue',qaAvailable:true,engineeringAccepted:true,manifestVerified:true,releaseAuthorised:false},'authorise_client_review','operator'],
 ['release authority does not send protected client issue',{stage:'ready_for_client_issue',qaAvailable:true,engineeringAccepted:true,manifestVerified:true,releaseAuthorised:true},'secure_review_blocked','operator'],
 ['project label issued-to-client without viewer is NOT proof',{stage:'issued_to_client',protectedReviewIssued:false},'secure_review_blocked','operator'],
 ['client-review stage alone is not consent or acceptance',{stage:'client_review'},'secure_review_blocked','operator'],
 ['only truly protected issued review permits client decision',{stage:'client_review',protectedReviewIssued:true},'client_review_decision','client'],
 ['stale client acceptance cannot be assumed in completion',{stage:'completion',clientAccepted:false},'await_client_acceptance','operator'],
 ['accepted review requires actual final payment',{stage:'completion',clientAccepted:true,finalPaid:false},'final_payment','client'],
 ['cleared payment still needs owner final release',{stage:'completion',clientAccepted:true,finalPaid:true,finalReleaseApproved:false},'final_release','operator'],
 ['released files still need partner payable checks',{stage:'completion',clientAccepted:true,finalPaid:true,finalReleaseApproved:true,partnerPaid:false},'partner_settlement','operator'],
 ['settlement permits governed closure',{stage:'completion',clientAccepted:true,finalPaid:true,finalReleaseApproved:true,partnerPaid:true},'close_project','operator'],
 ['closed project has no next transaction',{stage:'closed'},'completed','none'],
 ['unknown stage never invents an approval',{stage:'strange_legacy_label'},'unknown_stage','none'],
];
for(const [name,facts,key,owner] of cases){
 const result=canonicalProjectDecision(facts);
 assert.equal(result.key,key,name+': decision');
 assert.equal(result.owner,owner,name+': owner');
 if(result.key==='secure_review_blocked')assert.equal(result.clientReviewAccessible,false,name+': no hidden client access');
}
const source=readFileSync('lib/presentation/threePortalNextAction.ts','utf8');
const operator=readFileSync('app/opos-next/projects/[id]/page.tsx','utf8');
const partner=readFileSync('components/execution/PartnerWorkSurface.tsx','utf8');
const client=readFileSync('app/client-portal/page.tsx','utf8');
const summary=readFileSync('app/portal/[kind]/page.tsx','utf8');
const qa=readFileSync('supabase/migrations/20261104094500_qa_engineering_manifest_release_separation.sql','utf8');
assert.ok(source.includes('canonicalProjectDecision({')&&
 source.includes('const situation=canonicalProjectDecision({'),
 'Both external portal and operator next actions must derive canonical decision');
assert.ok(operator.includes('operatorProjectNextStep({')&&operator.includes('protectedReviewIssued:false'),
 'Operator must not invent a protected client issue');
assert.ok(partner.includes('const core=canonicalProjectDecision({')&&partner.includes('core.key'),
 'Partner Work must use canonical decision, not its own independent next stage');
assert.ok(client.includes('secureClientNextStep({')&&client.includes("eq('execution_cycle',currentCycle>0?currentCycle:-1)"),
 'Client finance UI must not reuse stale-cycle acceptance or a duplicate next-step tree');
assert.ok(summary.includes("'awaiting_response'"),'An issued quote awaiting response must not disappear from Client primary action');
assert.ok(qa.includes('op_qa_engineering_reviews')&&qa.includes('op_qa_manifest_verifications')&&qa.includes('op_qa_release_authorisations'),
 'Independent QA database evidence must remain authoritative');
assert.ok(!/\.(?:insert|update|delete|upsert)\s*\(/.test(readFileSync('lib/presentation/canonicalProjectDecision.ts','utf8')),
 'Canonical context cannot mutate database');
console.log('Canonical OPOS context: '+cases.length+' behavioural decisions and all three portal integrations PASS (read-only).');
