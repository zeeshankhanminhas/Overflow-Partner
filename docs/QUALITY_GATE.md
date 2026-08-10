# Quality Gate

Overflow Partner enforces a repository-native quality gate in `.github/workflows/quality-gate.yml`.

Every pull request to `main` and every push to `main` runs:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npx next build`

This is intentionally independent of the Vercel deployment check so product code can still be validated when the hosting account is temporarily subject to build-rate limits.

Vercel remains the deployment/runtime gate after repository validation passes.
