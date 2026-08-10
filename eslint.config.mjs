import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Existing repositories and Supabase response shapes still contain deliberately
      // untyped integration boundaries. TypeScript build remains the hard type gate.
      '@typescript-eslint/no-explicit-any': 'off',
      // These React 19 advisory rules flag server-time calculations and legacy
      // external-state synchronisation patterns that are valid in this application.
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);
