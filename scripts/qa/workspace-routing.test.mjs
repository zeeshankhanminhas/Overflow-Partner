import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';

function moduleUrl(file, imports = {}) {
  let source = readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
  for (const [specifier, url] of Object.entries(imports)) {
    source = source.replace("'" + specifier + "'", "'" + url + "'");
  }
  const {outputText} = ts.transpileModule(source, {compilerOptions:{
    target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ES2022,
  }});
  return 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64');
}

const isolation = moduleUrl('lib/qa/isolation.ts');
const {workspaceLinkOrigin} = await import(moduleUrl('lib/qa/publicOrigin.ts', {'./isolation':isolation}));
const {nextHref} = await import(moduleUrl('app/opos-next/nextHref.ts'));

test('release links stay on the verified branch, including when a production fallback exists', t => {
  const env = {
    VERCEL_ENV:'preview', VERCEL_GIT_COMMIT_REF:'release/opos-production-hardening-2026-11-09',
    OP_QA_SUPABASE_PROJECT_REF:'ukcamenuxhdznxaxpyis',
    NEXT_PUBLIC_SUPABASE_URL:'https://ukcamenuxhdznxaxpyis.supabase.co',
    OP_ISOLATED_QA_BACKEND:'true', VERCEL_BRANCH_URL:'qa-release.vercel.app',
    OP_QA_PUBLIC_ORIGIN:'https://qa-release.vercel.app',
  };
  for (const key of Object.keys(env)) {
    const previous = process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  Object.assign(process.env, env);
  const production = 'https://overflow-partner.vercel.app';
  assert.equal(workspaceLinkOrigin(production),env.OP_QA_PUBLIC_ORIGIN);
  process.env.OP_QA_PUBLIC_ORIGIN = production;
  assert.throws(() => workspaceLinkOrigin(production));
  delete process.env.VERCEL_BRANCH_URL;
  assert.throws(() => workspaceLinkOrigin(production));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://other.supabase.co';
  assert.throws(() => workspaceLinkOrigin(production));
  process.env.VERCEL_ENV = 'production';
  assert.equal(workspaceLinkOrigin(production),production);
});

test('operator record identity survives the move and each portal retains its own entry', () => {
  const id = '01234567-89ab-4def-8123-456789abcdef';
  assert.equal(nextHref('/workspace/acquisition/'+id),'/opos-next/opportunities/'+id);
  assert.equal(nextHref('/workspace/projects/'+id),'/opos-next/projects/'+id);
  assert.equal(nextHref('/portal/client'),'/portal/client');
  assert.equal(nextHref('/portal/partner'),'/portal/partner');
});
