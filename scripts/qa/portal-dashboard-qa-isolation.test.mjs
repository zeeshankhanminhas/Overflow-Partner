import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const source=readFileSync(new URL('../../app/portal/[kind]/page.tsx',import.meta.url),'utf8');

test('account home never calls the QA review RPC without the verified isolated backend',()=>{
 assert.match(source,/import \{isKnownIsolatedQaBackend\} from '@\/lib\/qa\/isolation'/);
 assert.match(source,/reviewCandidates\s*=\s*permitted\s*&&\s*isClient\s*&&\s*isKnownIsolatedQaBackend\(\)/);
 assert.match(source,/reviewCandidates\.map\(async p=>/);
});

test('client review dashboard remains membership scoped',()=>{
 assert.match(source,/const \{accounts,permitted,projects,quotes,supabase\}=await portalContext\(kind\)/);
 assert.match(source,/permitted&&isClient&&isKnownIsolatedQaBackend/);
});
