/**
 * Seed a disposable operator for GitHub Actions' local Supabase stack.
 * HARD SAFETY BOUNDARY: this script refuses all non-loopback Supabase URLs.
 * Never use hosted Supabase credentials here.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const apiURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const githubEnv = process.env.GITHUB_ENV;

if (!apiURL || !serviceKey || !githubEnv) {
  throw new Error('Local-only API URL, service role key, and GITHUB_ENV are required.');
}
const parsedURL = new URL(apiURL);
if (parsedURL.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsedURL.hostname) ||
    parsedURL.port !== '54321' ||
    parsedURL.username || parsedURL.password) {
  throw new Error('Refusing to seed a non-local Supabase instance.');
}
const password = randomBytes(24).toString('base64url') + 'aA1!';
const email = 'op-e2e-owner@example.invalid';
const admin = createClient(apiURL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const org = await admin.from('organisations').insert({ name: 'OP E2E — temporary runner only' }).select('id').single();
if (org.error || !org.data?.id) throw new Error('Local organisation fixture failed: ' + (org.error?.message ?? 'no record'));

const user = await admin.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { source: 'op-e2e-local' },
});
if (user.error || !user.data.user) throw new Error('Local test operator creation failed: ' + (user.error?.message ?? 'no user'));

const profile = await admin.from('profiles').insert({
  id: user.data.user.id,
  organisation_id: org.data.id,
  full_name: 'OP E2E Operator',
  role: 'owner',
  is_active: true,
  email,
});
if (profile.error) throw new Error('Local operator profile fixture failed: ' + profile.error.message);

const attempt = await createClient(apiURL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth.signInWithPassword({ email, password });
if (attempt.error || !attempt.data.user) throw new Error('Local test operator login verification failed: ' + (attempt.error?.message ?? 'no user'));

appendFileSync(githubEnv, 'OP_E2E_EMAIL=' + email + '\nOP_E2E_PASSWORD=' + password + '\n');
console.log('Disposable local operator and organisation created; login verified. No production data touched.');
