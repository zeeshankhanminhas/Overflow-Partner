# Vercel Preview Validation

This sprint uses GitHub quality checks for intermediate commits and a deliberate Vercel Preview deployment at wave or acceptance boundaries.

Preview deployments must receive the same public Supabase configuration required by the workspace runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Environment-variable changes are validated by triggering a fresh Preview deployment from the sprint branch. Production/main is not redeployed merely to validate Preview configuration.

This file also documents the deployment-rate safeguard adopted during the Operator Experience Recomposition programme: avoid one Vercel deployment per micro-commit; batch validation at controlled boundaries instead.
