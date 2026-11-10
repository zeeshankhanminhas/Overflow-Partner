import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const page=readFileSync(new URL('../../app/portal/[kind]/page.tsx',import.meta.url),'utf8');
const style=readFileSync(new URL('../../app/portal/portal.module.css',import.meta.url),'utf8');

test('client and partner dashboard overview is scoped to entitled account records',()=>{
 assert.match(page,/const dashboardStats=isClient\?/);
 assert.match(page,/activeCount=projects\.filter/);
 assert.match(page,/permitted\?<section className=\{css\.metrics\}/);
 assert.match(page,/dashboardStats\.map\(stat=>/);
 assert.match(page,/portalContext\(kind\)/);
});
test('approved light navy proposal is enabled in QA preview and responsive',()=>{
 assert.match(style,/\.qaV2\{background:#f5f7fa;color:#17263d;color-scheme:light\}/);
 assert.match(style,/\.qaV2 \.action\{background:#193a60;color:#fff/);
 assert.match(style,/@media\(max-width:420px\)\{\.metrics/);
 assert.match(style,/\.qaV2 :is\(a,button,summary,input\):focus-visible/);
});
