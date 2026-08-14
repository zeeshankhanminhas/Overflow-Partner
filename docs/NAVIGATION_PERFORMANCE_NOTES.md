# Navigation performance notes

- Dynamic record routes use route-shaped `loading.tsx` boundaries, including secure external token routes.
- Case 360 detail remains record-targeted; do not reintroduce `listWorkflowCases().find()` style organisation-wide loading.
- Case Exceptional Entry support data is loaded only when explicitly opened.
- Project-scoped Payments filter invoices, payables and payment movements in PostgreSQL before rendering.
- Payments, Commercial Control and Project Delivery mutations use local React transitions while existing server actions remain authoritative.
- Project 360 child routes share one Supabase Realtime refresh boundary. External token routes do not subscribe.
- Realtime publication is enabled for `projects`, `partner_progress_updates` and `project_execution_assignments` under existing RLS.
- Primary navigation uses normal Next.js `Link` prefetch behavior; do not disable it without a measured reason.

Known residual: the Projects register still loads Case and Client Quote options for its hidden Administrative Exception form. Keep this isolated and move it to explicit/lazy loading in a later small change rather than broadening this sprint.
