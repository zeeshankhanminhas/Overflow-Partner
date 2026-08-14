# Overflow Partner Workspace Interaction Architecture

Status: **Normative**

This document defines how work is opened and completed across the Overflow Partner workspace. It applies to the full operator product, not only Case 360 or Project 360.

## Governing rule

> **Navigate to choose work. Stay in context to do work.**

The operator should learn the business journey, not a route tree.

Use a full page only when the operator is changing operating area, selecting from a substantial register, or entering an independently meaningful record workspace. Supporting context and bounded work should come to the operator instead of forcing routine child-page navigation.

## Canonical interaction grammar

### Page — choose or change work
Use a page when the operator deliberately changes operating area or primary business object.

Examples:
- Mission Control
- Enquiries
- Cases
- Case 360
- Projects
- Project 360
- Payments
- Commercial Control
- Document register
- Settings

A page must have one operator job and one primary object/domain.

### Drawer — inspect
Use a right-side drawer for supporting context that answers **“show me more”** without changing the operator's current job.

Examples:
- record messages
- history
- audit
- older documents
- Project or Case preview from a register
- payment/invoice facts
- Partner readiness
- issue context
- message metadata

A drawer must not become a hidden second application. If the operator needs substantial editing/review, use a Work Window.

### Decision Dialog — decide
Use a compact centred dialog for **one bounded decision with one business outcome**.

Examples:
- confirm payment
- issue an invoice
- approve a Partner payable
- withdraw a document
- create a new controlled revision
- confirm a destructive/configuration decision

A Decision Dialog must not contain tabs, a large history view, or several unrelated decisions.

### Work Window — perform substantial work
Use a large focused work window when the operator must inspect several related facts/files or enter a meaningful controlled dataset while remaining anchored to the owning record/register.

Examples:
- configure commercial terms
- create a controlled invoice
- record a Partner liability
- create an exceptional Case/Project/Task
- review an engineering delivery
- detailed document review
- closeout reconciliation

A Work Window may occupy most of the viewport, but it must still make the parent operating context obvious.

### Disclosure — reveal small local detail
Use inline disclosure only for low-frequency, short, local material where opening it does not distort the page composition.

Do not use disclosure as a substitute for a Drawer, Dialog or Work Window.

## One-layer rule

Only one active interaction layer may sit above the primary page.

Do not create:

`Page → Drawer → Modal → Dialog → File viewer`

If work launched from a drawer requires a larger surface, the larger Work Window replaces that interaction rather than stacking another layer.

Native modal behaviour must provide Escape-to-close, backdrop dismissal where safe, focus containment and an explicit close control.

## Current truth stays on the page

Never move these into a drawer merely to reduce vertical space:
- record identity
- current state / operating phase
- current owner or waiting-on actor
- current blocker/readiness
- next permitted action
- concise current evidence
- current-stage live work

Supporting history, metadata, old evidence and correspondence should normally be contextual.

## Register behaviour

A register is for finding and prioritising records.

Normal register journey:

`Register → Inspect drawer → Open authoritative record only if action is required`

A row should not force navigation just to answer basic questions such as:
- what state is this in?
- who owns the next move?
- what is the financial/evidence position?
- why is it blocked?

Deep links to authoritative records remain available and are never removed merely because an Inspect drawer exists.

## Action continuity

Governed action flow:

`Open interaction → validate → execute → refresh truth → close successful interaction → show updated parent state`

If validation/execution fails, keep the interaction open so the operator can correct the problem.

Routine actions should not cause a navigation-style reload when local transition/revalidation can refresh the owning surface.

## Mobile behaviour

Mobile is not desktop overlays squeezed smaller.

- Drawer becomes full-screen contextual sheet.
- Decision Dialog becomes a focused full-screen decision surface when space is constrained.
- Work Window becomes a full-screen work surface.
- Primary identity, current state and action remain reachable without being covered by persistent controls.

The semantic interaction type stays the same even if its geometry changes.

## Workspace-wide surface mapping

| Surface | Primary page job | Drawer use | Dialog use | Work Window use |
| --- | --- | --- | --- | --- |
| Mission Control | choose next intervention | approval/dependency/issue preview | rare | rare |
| Approvals | choose authority decision | evidence/decision preview | decision only on owning record unless explicitly canonical | detailed review if needed |
| Enquiries | qualify opportunities | enquiry/intake/Partner context | bounded decisions | substantial intake/review work |
| Cases | control pre-project basis | Case preview/context | approvals and short outcomes | quote/technical/commercial review |
| Projects | operate accepted delivery | Project/Partner/payment/evidence context | release/confirm/outcome decisions | engineering review/closeout |
| Client Quotes | inspect quote portfolio | quote facts/state | bounded quote decisions | full quote review |
| Payments | settlement register | invoice/payable evidence | record settlement | reconciliation |
| Commercial Control | financial control | financial record context | issue/approve/payment | commercial terms, create invoice/payable |
| Execution Partners | controlled Partner directory | Partner readiness/capability | status decisions where appropriate | onboarding/master-data work |
| Issues | choose off-plan intervention | issue/source context | bounded resolution only where canonical | complex source-record work |
| Actions | choose internal work item | task context | short completion decisions | exceptional task creation |
| Documents | controlled registry | document metadata/history | revision/withdraw/issue decisions | document review |
| Messages | correspondence register | message context | send/confirm where canonical | substantial composition only |
| Executive / Risk | management/assurance control | signal/evidence context | bounded governance decisions | detailed assessment |
| Knowledge | find reference knowledge | article/reference preview | none normally | full reference reading/editing |
| Settings | configure system | item detail | destructive/confirm decisions | complex configuration |

## External actor surfaces

External client/Partner links use the same logic but with narrower scope.

The actor should remain on one current-work surface. Supporting evidence may open contextually and substantial submissions may use drawers/work windows. External actors must not be exposed to internal route architecture or governance modules they do not own.

## Implementation primitives

Canonical components:
- `components/workspace/InteractionSurface.tsx`
  - `WorkspaceDrawer`
  - `DecisionDialog`
  - `WorkWindow`
  - `ContextActions`
- `app/workspace/interaction-surfaces.css`

Do not create page-specific replacements such as `ProjectDrawer`, `PaymentsModal`, `CasePopup` unless a domain-specific content component is being placed **inside** one of the canonical interaction primitives.

## Review test

Before adding a route, child page, accordion or overlay, answer:

1. Is the operator changing operating area or primary object? → **Page**
2. Are they only inspecting supporting context? → **Drawer**
3. Are they making one bounded decision? → **Decision Dialog**
4. Are they doing substantial work while remaining on the same object? → **Work Window**
5. Is this only short low-frequency local information? → **Disclosure**
6. Does the proposed interaction create a second workflow or duplicate source of truth? If yes, redesign it.
7. Can the operator close the interaction and still know exactly where they are and what changed? If no, the interaction is too detached from its owner.

## Stability rule

This architecture changes interaction depth, not business ownership.

It must not:
- duplicate lifecycle state
- create shadow approval/payment/document status
- move governed decisions out of their authoritative record merely for convenience
- remove deep-linkable routes required for evidence, browser history or support
- weaken RLS, RPC authority, audit or document controls

The goal is lower cognitive load with the same or stronger governance.
