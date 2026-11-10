import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=(file)=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');
const shared=read('lib/portals/clientSettlementPosition.ts');
const detail=read('app/portal/[kind]/projects/[projectId]/page.tsx');
const home=read('app/portal/[kind]/page.tsx');

test('both client project and dashboard use the same scoped current-cycle position',()=>{
 assert.match(detail,/await clientSettlementPosition\(p\.organisation_id,p\.project_id,p\.project_stage\)/);
 assert.match(home,/await clientSettlementPosition\(p\.organisation_id,p\.project_id,p\.project_stage\)/);
 assert.match(home,/const positionByProject=new Map/);
 assert.match(home,/const chosenAction=chosenProject\?nextFor\(chosenProject\):null/);
});

test('privileged settlement reader is server-only and cannot grant client membership',()=>{
 assert.match(shared,/import 'server-only'/);
 assert.match(shared,/eq\('organisation_id',organisationId\)/);
 assert.match(shared,/eq\('project_id',projectId\)/);
 assert.match(detail,/const p=permitted\?projects\.find\(x=>x\.project_id===projectId\):null/);
 assert.match(home,/const completionProjects=permitted&&isClient/);
 assert.match(shared,/isKnownIsolatedQaBackend\(\)\|\|process\.env\.VERCEL_ENV==='production'/);
});

test('dashboard never offers repeat payment or download without positive current evidence',()=>{
 assert.match(home,/if\(settlement\.finalSettlementUnavailable\)/);
 assert.match(home,/if\(settlement\.finalFilesReady\)/);
 assert.match(home,/if\(settlement\.finalPaid\)/);
 assert.match(home,/if\(settlement\.finalBalanceReady\)/);
 assert.match(home,/return \{title:'Final review verification pending'/);
 assert.match(shared,/const files=paid\?await clientFinalFilesReady/);
});
