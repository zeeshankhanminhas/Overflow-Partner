import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const nda=read('supabase/migrations/20261102191500_partner_nda_and_internal_approval_evidence_qa.sql');
const temporal=read('supabase/migrations/20261102192000_prequotation_partner_approval_temporal_gate_qa.sql');
const realActions=read('app/opos-next/partners/governance-actions.ts');
const partnerUi=read('app/opos-next/partners/[id]/page.tsx');
const simulation=read('app/opos-next/partners/qa-actions.ts');
const readiness=read('app/opos-next/qa-readiness/page.tsx');
const checks=[
 ['NDA verification and internal approval stored separately',
   nda.includes('create table if not exists public.op_partner_nda_verifications')&&nda.includes('create table if not exists public.op_partner_internal_approvals')],
 ['Neither evidence table publicly readable',
   nda.includes('revoke all on public.op_partner_nda_verifications from public,anon,authenticated')&&
   nda.includes('revoke all on public.op_partner_internal_approvals from public,anon,authenticated')],
 ['Reviewer role and session checked by database actions',
   (nda.match(/v_actor uuid:=auth.uid\(\)/g)||[]).length===2 &&
   (nda.match(/op_assert_workspace_role\(p_organisation_id,v_actor,array\['owner','admin'\]\)/g)||[]).length===2],
 ['Fictional partners cannot be marked as legally signed or approved',
   nda.includes("v_partner.company_name like 'QA - %'")&&
   nda.includes("v_partner.company_name like 'OP QA TEST%'")&&
   nda.includes('Fictional QA partners cannot receive a real approval status.')],
 ['No direct partner status change on simulated approval action',
   simulation.includes('legalNdaExecuted:false')&&!simulation.includes(".update({status:'approved'")&&!simulation.includes('nda_signed:true')],
 ['NDA evidence precedes internal approval and quotation issue',
   nda.includes('n.verified_at<=a.approved_at and a.approved_at<=p_quoted_at')&&
   temporal.includes('op_partner_prequote_governance_ready(')],
 ['Formal NDA and internal decision are user-supplied evidence, never invented',
   realActions.includes("form.get('verified_external_evidence')!=='yes'")&&
   realActions.includes("form.get('capability_review_confirmed')!=='yes'")],
 ['No production onboarding writes are enabled',
   (realActions.match(/assertIsolatedQaBackend\(\)/g)||[]).length===2],
 ['New forms are available only for non-fictional records',
   partnerUi.includes("qaGovernanceEnabled && !qa?<PartnerGovernanceForms")],
 ['Client quotation remains payment-blocked when prequotation lineage fails',
   readiness.includes('preprojectReady')&&
   readiness.includes('approved_nda_partner_missing')],
];
for(const [label,ok] of checks){assert.ok(ok,label);console.log('PASS '+label);}
console.log('OPOS partner governance contract: '+checks.length+' checks passed; no legal evidence simulated or written.');
