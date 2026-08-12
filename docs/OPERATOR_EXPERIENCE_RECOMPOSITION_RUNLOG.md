# Operator Experience Recomposition — Run Log

Status: working record for PR #23. The normative plan remains `OPERATOR_EXPERIENCE_RECOMPOSITION_SPRINT.md` and the constitutions it references.

## 2026-08-12 — Wave 3 in progress

### Changed

- Reworked shared `RecordWorkspace` toward the canonical first-viewport order: record identity, canonical operating state, one next action or waiting condition, then decision-relevant facts.
- When a canonical `presentation` exists, the lifecycle stage strip no longer competes above the operating state. It moves to a supporting `Lifecycle progress` disclosure.
- Readiness detail no longer occupies a permanent equal-weight first-viewport panel. It is available under `Unresolved requirements` disclosure.
- Current action and decision facts remain the two visible decision surfaces; history, older documents, metadata, audit and lifecycle orientation remain progressively disclosed.
- Removed desktop topbar `Approvals` and `Notifications` links so the sidebar remains the primary global navigation hierarchy; Command Palette remains the quiet utility affordance.
- Updated responsive RecordWorkspace layout to keep the decision hierarchy readable on desktop and collapse cleanly to one column at narrower widths.

### Safety preserved

- PR #23 remains draft and unmerged on `sprint/operator-subtraction`.
- No Northstar test-project data was mutated.
- The hard start-payment migration remains unapplied to the live Supabase project.
- No payment/start lifecycle gate was weakened or bypassed.

### Validation state

- Vercel has produced a READY build for Wave 3 commit `cfacc08ccb3cc5388586efcf805ee331f21464d0` (`RecordWorkspace` archetype).
- The subsequent shell commit `10b32cd28d249001c9a3fce03ed6f5123e057a95` entered Vercel BUILDING.
- Exact-head validation is still required for the current branch head before Wave 3 can be declared complete or Wave 4 can begin.
- Protected-preview login is treated separately from build validity; manual visual review remains pending where the user cannot access the preview.

### Next run

1. Re-read all normative programme constitutions at the start of the run.
2. Confirm PR #23 exact head and obtain strongest available Vercel exact-head build/runtime evidence.
3. Inspect the canonical Project/Case/Enquiry record surfaces against the first-viewport budget and shared RecordWorkspace behavior.
4. Finish any remaining Wave 3 navigation/archetype reconciliation without adding another navigation layer.
5. Do not begin Wave 4 until Wave 3 exact head is validated strongly enough to satisfy the sprint exit gate.
