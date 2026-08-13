# Vercel validation strategy

This sprint uses GitHub quality checks for intermediate commits and Vercel preview deployment only at deliberate validation boundaries.

## Rule

- Do not create a Vercel deployment for every micro-commit.
- Batch implementation changes within a wave behind GitHub lint, typecheck and production-build checks.
- Trigger one fresh Vercel preview when the wave reaches an exact-head validation boundary.
- Do not advance to the next wave until that exact head is Vercel-ready when runtime validation is required by the sprint.
- A Vercel build-rate rejection is an infrastructure/quota condition, not permission to bypass lifecycle or release gates.

This file was added as a no-application-code validation commit after Wave 13 so Vercel can re-evaluate the exact Wave 13 tree once deployment quota is available.
