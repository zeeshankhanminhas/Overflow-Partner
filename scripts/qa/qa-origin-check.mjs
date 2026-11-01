import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatedQaOrigin, qaPublicOrigin } from '../../lib/qa/publicOrigin.ts';

const good='https://overflow-partner-git-design-o-9eda95-zeeshankhanminhas-projects.vercel.app';
assert.equal(validatedQaOrigin(good),good);
assert.equal(validatedQaOrigin(good+'/',good.replace('https://','')),good);

for(const origin of [
  '', 'http://overflow-partner-git-design-o-9eda95-zeeshankhanminhas-projects.vercel.app',
  'https://overflow-partner-git-design-o-9eda95-zeeshankhanminhas-projects.vercel.app.evil.example',
  'https://user@overflow-partner-git-design-o-9eda95-zeeshankhanminhas-projects.vercel.app',
  good+'/client-portal',good+'?token=abc',good+'#hash',good+':444',
  'https://www.google.com',
]) assert.throws(()=>validatedQaOrigin(origin),/Stable QA public origin/);

assert.throws(()=>validatedQaOrigin(good,'another-branch.vercel.app'),/branch alias/);
const keys=['VERCEL_ENV','OP_ISOLATED_QA_BACKEND','OP_QA_PUBLIC_ORIGIN','VERCEL_BRANCH_URL'];
const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
try {
  process.env.OP_QA_PUBLIC_ORIGIN=good;
  process.env.VERCEL_BRANCH_URL=good.slice(8);
  process.env.VERCEL_ENV='production';
  process.env.OP_ISOLATED_QA_BACKEND='true';
  assert.throws(()=>qaPublicOrigin(),/isolated preview/);
  process.env.VERCEL_ENV='preview';
  process.env.OP_ISOLATED_QA_BACKEND='false';
  assert.throws(()=>qaPublicOrigin(),/isolated preview/);
  process.env.OP_ISOLATED_QA_BACKEND='true';
  assert.equal(qaPublicOrigin(),good);
  process.env.VERCEL_BRANCH_URL='incorrect-branch.vercel.app';
  assert.throws(()=>qaPublicOrigin(),/branch alias/);
} finally {
  for(const key of keys)old[key]===undefined?delete process.env[key]:process.env[key]=old[key];
}

const portal=readFileSync(new URL('../../app/opos-next/cases/[id]/portal-link-action.ts',import.meta.url),'utf8');
const checkout=readFileSync(new URL('../../lib/payments/stripeEnvironment.ts',import.meta.url),'utf8');
assert.match(portal,/qaPublicOrigin\(\)/);
assert.match(checkout,/return qaPublicOrigin\(\)/);
assert.match(portal,/delivery reference:/);
assert.match(portal,/\.eq\('status','pending'\)\.eq\('attempts',0\)/);
assert.match(portal,/\.update\(\{payload,updated_at/);
assert.match(portal,/response\.ok/);
assert.match(portal,/provider_message_id:body\.id/);
const readiness=readFileSync(new URL('../../app/opos-next/qa-readiness/page.tsx',import.meta.url),'utf8');
assert.ok(readiness.includes("assertRole(profile.role,['owner','admin'])"));
assert.ok(readiness.includes('if(!isKnownIsolatedQaBackend())notFound()'));
assert.ok(readiness.includes('const syntheticQaCase='));
assert.ok(readiness.includes('Boolean(authorisation.data)'));
assert.ok(readiness.includes('paymentReady&&syntheticQaCase'));
assert.ok(readiness.includes('createClientPortalToken(quote.id,Number(quote.revision))'));
console.log('PASS: QA-only signed test portal access requires administrator, isolated backend and valid quote authorisation.');
console.log('PASS: trusted stable preview origin, production lock, pending-link refresh, and provider-acceptance contract (offline).');
