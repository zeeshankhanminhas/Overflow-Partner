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
