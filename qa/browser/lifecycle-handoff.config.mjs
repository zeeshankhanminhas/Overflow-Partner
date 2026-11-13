import {defineConfig} from '@playwright/test';
import authenticated from './authenticated.config.mjs';

// Inherits the exact protected main/manual-dispatch QA target and credential guards.
export default defineConfig({
  ...authenticated,
  testMatch:['lifecycle-handoff.spec.mjs'],
  outputDir:'qa/browser/lifecycle-private-results',
});
