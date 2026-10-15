import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const paymentModule = { exports: {} };
const source = await readFile(new URL('../lib/payments/stripeSignature.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function('require', 'module', 'exports', compiled)(require, paymentModule, paymentModule.exports);
const { verifyStripeSignature } = paymentModule.exports;

const secret = 'whsec_test';
const body = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' });
const timestamp = 1_800_000_000;
const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${digest}`, secret, timestamp), true);
assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${"00".repeat(32)},v1=${digest}`, secret, timestamp), true);
assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${digest}`, 'wrong-secret', timestamp), false);
assert.equal(verifyStripeSignature(`${body} `, `t=${timestamp},v1=${digest}`, secret, timestamp), false);
assert.equal(verifyStripeSignature(body, `t=${timestamp - 301},v1=${digest}`, secret, timestamp), false);
assert.equal(verifyStripeSignature(body, 'v1=bad', secret, timestamp), false);
process.stdout.write('Stripe webhook signature checks passed.\n');
