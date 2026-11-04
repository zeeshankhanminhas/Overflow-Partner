import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const logic=read('lib/presentation/threePortalNextAction.ts');
const operator=read('app/opos-next/projects/[id]/page.tsx');
const clientHome=read('app/portal/[kind]/page.tsx');
const accountDetail=read('app/portal/[kind]/projects/[projectId]/page.tsx');
const clientSecure=read('app/client-portal/page.tsx');
const partnerWork=read('components/execution/PartnerWorkSurface.tsx');
const workRecord=read('app/opos-next/WorkRecordV2.tsx');
const route=read('app/portal/[kind]/projects/[projectId]/open/route.ts');
const doc=read('app/portal/portal.module.css');
for(const name of ['portalProjectNextStep','operatorProjectNextStep'])
 assert.ok(logic.includes('function '+name),'Centralised next action missing: '+name);
for(const a of ['internal_review','partner_correction','ready_for_client_issue','completion','closed'])
 assert.ok(logic.includes(a),'Stage missing from action mapping: '+a);
assert.ok(logic.includes('engineeringAccepted')&&logic.includes('manifestVerified')&&logic.includes('releaseAuthorised'),
 'Operator decision must respect independent revision-specific QA gates');
assert.ok(logic.includes('canReviewEngineering')&&logic.includes('canAuthoriseRelease')&&logic.includes('canWrite'),
 'Owner/reviewer permissions must be considered before presenting actions');
assert.ok(logic.includes("situation.key==='secure_review_blocked'")&&logic.includes('Inspect watermarked QA review preview'),
 'Client issue must remain blocked while operator can inspect watermarked internal preparation');
assert.ok(operator.includes('operatorProjectNextStep({')&&
 operator.includes('const displayNext=stage===')&&
 operator.includes("qaRecipient?.ready")&&
 operator.includes("title:'Activate a separate QA Client account'")&&
 operator.includes("anchor:'#release-authorisation'")&&
 operator.includes('waiting={displayNext.waiting}')&&
 operator.includes('actionLabel={displayNext.action')&&
 operator.includes('displayNext.anchor'),
 'Project 360 must use canonical stage actions, except the evidence-gated independent-client onboarding prerequisite');
for(const anchor of ['engineering-review','manifest-verification','release-authorisation','stage-advance',
 'client-review-outcome','final-release','project-closure','work-order-issue'])
 assert.ok(operator.includes('id="'+anchor+'"'),'Operator link target missing: '+anchor);
assert.ok(clientHome.includes('portalProjectNextStep(kind,p)')&&clientHome.includes('YOUR NEXT STEP')&&
 clientHome.includes('/portal/client/quotes/'),'Account home must highlight exactly one current action');
assert.ok(accountDetail.includes('portalProjectNextStep(kind,p)')&&accountDetail.includes('YOUR NEXT ACTION'),
 'External project view must direct to a real governed action');
assert.ok(clientSecure.includes('clientNext')&&clientSecure.includes('YOUR NEXT STEP')&&
 clientSecure.includes('independently verified')&&clientSecure.includes('id="quote-acceptance"')&&
 clientSecure.includes('id="opening-payment"'),'Secure client flow must have one action and keep financial gates');
assert.ok(partnerWork.includes('primaryMode:Mode')&&partnerWork.includes('Other permitted actions')&&
 partnerWork.includes("onClick={()=>setMode(primaryMode)}"),'Partner work must use one primary action');
assert.ok(partnerWork.includes("send(e,'accept_work_order')")&&partnerWork.includes("send(e,'commencement')")&&
 partnerWork.includes("send(e,'delivery')"),'No original partner workflows may be removed');
assert.ok(route.includes("portal_my_projects")&&route.includes("project.account_id")&&
 route.includes('token_hash'),'Secure account handoff must remain entitlement scoped');
assert.ok(doc.includes('.nextAction')&&workRecord.includes('waiting?'),'Action-first portals must render waiting without a fake transaction');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(logic),'Read-only decision helper must not mutate data');
console.log('Three-portal next-action contract: Operator, Client and Partner; all guarded original actions preserved. PASS (static).');
