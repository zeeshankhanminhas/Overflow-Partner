import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const file=name=>readFileSync(new URL('../../'+name,import.meta.url),'utf8');
const shell=file('app/opos-next/opos.module.css');
const mission=file('app/opos-next/mission.module.css');
const page=file('app/opos-next/page.tsx');
const client=file('app/portal/[kind]/page.tsx');
const externalLayout=file('app/portal/layout.tsx');
const browser=file('scripts/qa/three-role-browser.mjs');

test('controller retains established dark workspace and has mobile coverage',()=>{
 assert.match(shell,/--canvas: #090a0b/);
 assert.match(shell,/--text: #f4f4f5/);
 assert.match(shell,/color-scheme: dark/);
 assert.match(shell,/\.shell \.action \{ display: inline-flex/);
 assert.match(mission,/\.primary \{ border: 1px solid #303238/);
 assert.match(mission,/\.primaryAction \{ display: inline-flex/);
 assert.match(mission,/@media\(max-width:700px\)\{\.overview/);
 assert.match(client,/className=\{css\.metrics\}/);
 assert.match(externalLayout,/isWorkspaceTwoPreview\(\)\?css\.canvas\+' '\+css\.qaV2:css\.canvas/);
});
test('controller data is derived from authenticated repositories, not demonstration figures',()=>{
 assert.match(page,/await requireUserContext\(\)/);
 assert.match(page,/getDashboardSnapshot\(supabase, organisationId\)/);
 assert.match(page,/const overview = \[/);
 assert.match(page,/dashboard\.cases\.filter/);
 assert.match(page,/ranked\.length/);
 assert.match(page,/attention\.waitingOnClient\+attention\.waitingOnPartner/);
 assert.match(page,/aria-label="Controller workspace overview"/);
});
test('three-role browser plan uses separate identities and never changes business records',()=>{
 assert.match(browser,/destination:'\/opos-next'/);
 assert.match(browser,/destination:'\/portal\/client'/);
 assert.match(browser,/destination:'\/portal\/partner'/);
 assert.match(browser,/for\(const width of \[390,768,1440\]\)/);
 assert.doesNotMatch(browser,/\.(click|fill)\([^)]*(checkout|accept|approve|pay|release|upload)/i);
});
