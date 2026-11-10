import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const src=readFileSync(new URL('../../app/opos-next/documents/page.tsx',import.meta.url),'utf8');
const style=readFileSync(new URL('../../app/opos-next/documents/document-library.module.css',import.meta.url),'utf8');

test('document library starts project-first without mixing projects',()=>{
 assert.match(src,/const showRegister=scope!=='project'\|\|Boolean\(selected\)/);
 assert.match(src,/if\(scope==='project'&&selected\)query=query\.eq\('project_id',selected\.id\)/);
 assert.match(src,/\.eq\('organisation_id',organisationId\)/);
 assert.match(src,/aria-label="Project document libraries"/);
});
test('document filtering covers types, title, status and revision metadata',()=>{
 assert.match(src,/if\(type\)query=query\.eq\('document_type',type\)/);
 assert.match(src,/if\(search\)query=query\.ilike\('title'/);
 assert.match(src,/if\(\['draft','approved','issued','published','superseded'\]/);
 assert.match(src,/name="type"/);
 assert.match(src,/name="status"/);
 assert.match(src,/Revision \{d\.version\?\?1\}/);
});
test('large document registers have independent project/document pagination',()=>{
 assert.match(src,/const PAGE_SIZE=25/);
 assert.match(src,/p_offset:projectOffset/);
 assert.match(src,/\.range\(/);
 assert.match(src,/page<pageCount/);
 assert.match(src,/hasMoreProjects/);
 assert.match(style,/@media\(max-width:540px\)/);
 assert.match(style,/background:#101113/);
});

test('project directory searches across all pages with organisation scope',()=>{
 assert.match(src,/project_query\?:string/);
 assert.match(src,/if\(projectQuery\)/);
 assert.match(src,/\.from\('projects'\)/);
 assert.match(src,/\.or\('title\.ilike\.%'\+projectQuery\+'%,project_number\.ilike\.%'\+projectQuery\+'%'\)/);
 assert.match(src,/\.range\(projectOffset,projectOffset\+PAGE_SIZE\)/);
 assert.match(src,/name="project_query"/);
 assert.match(src,/project_query:projectQuery/);
});
test('deep links verify exact project membership independently of visible project page',()=>{
 assert.match(src,/\.eq\('organisation_id',organisationId\)\s*\.eq\('id',projectId\)\.maybeSingle\(\)/);
 assert.match(src,/const selected=selectedResult\?\.data/);
 assert.doesNotMatch(src,/const selected=projects\.find/);
 assert.match(src,/if\(scope==='project'&&selected\)query=query\.eq\('project_id',selected\.id\)/);
});
