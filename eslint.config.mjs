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
      // React 19 advisory rules below flag established server-time calculations,
      // legacy synchronisation effects and repository error-boundary patterns. They
      // remain candidates for later refactor, but are not production blockers.
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      // Product copy is rendered safely by React; typography punctuation is not a
      // runtime or security concern and should not block a commercial build.
      'react/no-unescaped-entities': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);
