import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

/**
 * This is a RED acceptance gate until the real client-approved lifecycle is
 * implemented. Passing payment integration alone is NOT a full Helix E2E.
 * Run only with synthetic local QA data; no hosted secrets.
 */
const read = path => readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('Helix final acceptance is not injected directly into SQL', () => {
  const scenario = read('scripts/qa/stripe-http-second-org-e2e.mjs');
  assert.doesNotMatch(scenario,/recordSyntheticAcceptance\s*\(/,
    'The Helix scenario still calls a synthetic SQL acceptance helper.');
  assert.doesNotMatch(scenario,/project_client_reviews\s+disable\s+trigger|insert\s+into\s+public\.project_client_reviews/i,
    'Direct SQL client acceptance is not proof of a client action.');
  assert.doesNotMatch(scenario,/execFileSync\s*\(\s*['"]docker['"]/,
    'Lifecycle approval must not be supplied using Docker psql.');
});

test('client portal exposes a governed project delivery review action', () => {
  const page = read('app/client-portal/page.tsx');
  assert.match(page,/project_client_reviews/,
    'The portal must be aware of client review state.');
  assert.match(page,/Record project review|Submit project review|Accept engineering deliverables/i,
    'The client portal needs a real, client-authorised review submission UI.');
  assert.match(page,/action=|action\s*=/,
    'The client needs an actual UI-bound server action, not an informational status.');
});

test('operator-entered client evidence is not misrepresented as client-authenticated review', () => {
  const operator = read('app/workspace/projects/[id]/client-actions.ts');
  assert.match(operator,/recordClientReviewOutcomeAction/);
  const scenario = read('scripts/qa/stripe-http-second-org-e2e.mjs');
  assert.doesNotMatch(scenario,/recordClientReviewOutcomeAction|client-actions\.ts/,
    'A server-side operator action does not prove the client accepted deliverables.');
});
