# Overflow Partner — IA / UX / UI Reference Hierarchy

**Status:** Advisory reference layer  
**Authority:** Existing Overflow Partner constitutions remain normative.  
**Purpose:** Give design and implementation work a consistent external reference set without importing another product's visual language or architecture wholesale.

## 1. Authority order

When sources disagree, use this order:

1. `BUSINESS_LIFECYCLE_CONSTITUTION.md` — what the business allows.
2. `workspace-ux-constitution.md` — information architecture and operating hierarchy.
3. `UX_UI_PARITY_CONSTITUTION.md` — experience parity, state, evidence and action priority.
4. `UI_LANGUAGE_CONSTITUTION.md` — operator-facing terminology and microcopy.
5. This reference document — external patterns and implementation guidance.
6. External libraries / design systems — inspiration and proven interaction patterns only.

External references must never override Overflow Partner business rules, permissions, lifecycle gates or terminology.

## 2. Reference stack

### Information architecture and service journeys — GOV.UK Design System

Reference: `alphagov/govuk-design-system`

Use for:
- task-oriented information architecture;
- clear page purpose;
- forms and validation;
- error recovery;
- progressive disclosure;
- accessibility;
- plain-language journeys;
- avoiding unnecessary interaction complexity.

Apply the principle, not the government visual style.

**Overflow translation:** one clear task, one obvious next action, explicit blockers, minimal cognitive load.

### Enterprise operational interaction — IBM Carbon

Reference: `carbon-design-system/carbon`

Use for:
- dense operator workspaces;
- data tables and registers;
- filters and search;
- contextual side panels;
- modal decisions;
- structured forms;
- status-heavy operational surfaces;
- enterprise information density.

Do not copy Carbon's visual identity.

**Overflow translation:** register → record → contextual drawer/dialog → governed action, while keeping the visual treatment flatter and quieter.

### Interaction primitives — Radix UI

Reference: `radix-ui/primitives`

Use for accessible behavioural primitives such as:
- Dialog;
- Alert Dialog;
- Popover;
- Dropdown Menu;
- Tooltip;
- Tabs;
- Accordion;
- Select;
- Context Menu;
- Toast.

Radix supplies behaviour and accessibility. It does not decide the IA or business workflow.

### React implementation layer — shadcn/ui

Reference: `shadcn-ui/ui`

Use for implementation-ready React component patterns where they fit the approved Overflow interaction model.

Rules:
- prefer composition over installing large UI frameworks;
- adapt components to OPDS tokens and Overflow visual language;
- do not let a component library invent product structure;
- do not introduce decorative cards, pills or dashboards simply because examples exist.

### Pattern discovery — Awesome Design Systems

Reference: `alexpate/awesome-design-systems`

Use as an index when a pattern needs comparison across mature design systems.

Examples:
- table behaviour;
- form layout;
- alerts;
- navigation;
- empty states;
- voice and tone;
- accessibility treatment.

Do not use it as a menu of styles to mix together.

### Visual pattern examples — Designopedia

Reference: `GorvGoyl/designopedia`

Use selectively for visual comparison of common UI patterns.

This is a secondary visual reference only. It must not override the Overflow design language.

### Technical architecture — ByteByteGo System Design 101

Reference: `ByteByteGoHq/system-design-101`

Use for technical architecture questions such as:
- API boundaries;
- webhooks vs polling;
- queues and asynchronous work;
- caching;
- database patterns;
- storage;
- scaling;
- resilience;
- security architecture.

Use the smallest architecture that solves the current problem. Do not import hyperscale patterns into a small operational product without evidence.

## 3. Overflow visual filter

Every borrowed pattern must pass through the Overflow visual language:

- Apple-like simplicity;
- The Ordinary-style clarity;
- Swiss editorial hierarchy;
- industrial precision;
- restrained accent colour;
- flat surfaces;
- typography, spacing and borders before decoration;
- no generic SaaS gradients;
- no glass effects;
- no decorative dashboard-card inflation;
- no people or stock imagery in operational product surfaces.

The reference system provides behaviour and hierarchy. Overflow Partner provides the visual identity.

## 4. Canonical interaction choices

Use these defaults unless the task genuinely requires something else.

| User need | Preferred pattern |
|---|---|
| Find many records | Register/table with search and filters |
| Understand one record | Record workspace / 360 view |
| Inspect secondary detail without leaving context | Right-side drawer / sheet |
| Make a bounded decision | Dialog |
| Confirm destructive or irreversible action | Alert dialog |
| Edit a small number of contextual fields | Drawer or compact dialog |
| Edit a substantial record | Dedicated record section/page |
| Choose among a short set of options | Select/radio group |
| Reveal secondary information | Disclosure/accordion |
| Show brief system feedback | Inline confirmation or toast |
| Show blocking state | Inline blocker near the action |
| Show history/audit | Secondary disclosure, not primary canvas |

## 5. SAP-inspired operator behaviour, modern implementation

Overflow Partner may borrow the **operating discipline** of enterprise systems without copying legacy SAP UI.

Useful behaviours:
- stable record identity;
- persistent business status;
- transaction-oriented documents;
- clear authorised actions;
- contextual windows/dialogs;
- drawers for supporting information;
- explicit references and document flow;
- strong separation between transaction data and instructional/help text.

Avoid:
- excessive windows;
- deep nested navigation;
- cryptic codes in primary UI;
- forcing the operator through unnecessary screens;
- dense controls with equal visual weight.

## 6. KISS decision test

Before adding a UI pattern, answer:

1. What job is the operator trying to complete?
2. What is the primary business object?
3. What information is required to make the next decision?
4. Can the task be completed without leaving the current context?
5. Is a drawer enough, or does this deserve a page?
6. Is a dialog a true bounded decision, or are we hiding a workflow inside a modal?
7. Is the component already available in the existing stack?
8. Does the pattern remain understandable with 100x more records?
9. Does it preserve the current lifecycle authority and permissions?
10. Are we solving a current need rather than designing for hypothetical scale?

If the simpler pattern works, use it.

## 7. Screen review sequence

When reviewing or designing an Overflow screen, evaluate in this order:

### IA
- primary object;
- page purpose;
- lifecycle position;
- navigation context;
- information priority.

### UX
- next permitted action;
- blockers;
- evidence needed now;
- continuity after action;
- error recovery;
- progressive disclosure.

### UI
- hierarchy;
- spacing;
- typography;
- component choice;
- density;
- responsive behaviour;
- visual restraint.

Do not use visual polish to compensate for unresolved IA or UX.

## 8. Example: Case 360

**IA:** Follow the frozen Record Workspace hierarchy in `workspace-ux-constitution.md`.

**UX:** Current state and next permitted action dominate. Supporting evidence stays close to the decision. Older history is disclosed secondarily.

**Enterprise interaction:** Use Carbon-like register and contextual panel discipline where useful.

**Primitives:** Use Radix/shadcn dialog, sheet, tabs, select and disclosure patterns only where they serve the approved workflow.

**Visual treatment:** Render everything through OPDS and Overflow's restrained editorial/industrial language.

The result should feel like a modern operational SaaS product with enterprise discipline — not a generic dashboard and not a legacy ERP clone.

## 9. Reuse beyond Overflow Partner

This hierarchy can inform future systems, but each product should maintain its own constitution and terminology.

The reusable principle is:

**Business model → IA → UX behaviour → UI pattern → component implementation → technical architecture.**

Never reverse that chain by starting with a component library and designing the business around it.
