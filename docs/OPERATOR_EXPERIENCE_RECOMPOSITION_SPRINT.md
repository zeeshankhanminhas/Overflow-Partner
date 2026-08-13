# Overflow Partner — Operator Experience Recomposition Sprint

**Status:** Normative execution plan  
**Programme intent:** Hide the machinery. Preserve the governance. Make every workflow feel like clean operator SaaS.  
**Applies to:** Entire authenticated workspace, every primary/secondary route, every record surface, every shared operator component, every form field, every status presenter, every interaction layer, responsive/mobile presentation, permissions, accessibility, and supporting CSS.  
**Related normative sources:**

- `docs/BUSINESS_LIFECYCLE_CONSTITUTION.md`
- `docs/OPERATOR_SUBTRACTION_CONSTITUTION.md`
- `docs/GLOBAL_STATE_PRESENTATION_CONSTITUTION.md`
- `docs/PRIMARY_NAV_PRODUCT_CONTRACT.md` where present

---

## 1. Sprint objective

Overflow Partner may remain sophisticated underneath. The operator must not have to understand that sophistication in order to run the business correctly.

The sprint is complete only when the workspace behaves as an operator system rather than a visual projection of database objects.

The governing sequence for all implementation work is:

> **Business truth → product ownership → interaction model → visual presentation → validation**

Never reverse that order.

The sprint is not a cosmetic redesign. It is a product-wide reconciliation of:

1. what the system knows;
2. what the operator needs to know now;
3. what the operator must genuinely decide or provide;
4. where that action belongs;
5. how much of the underlying governance should be visible;
6. how completed controls collapse into evidence;
7. how normal waiting differs from off-plan work;
8. how the same business fact is prevented from being repeated across the workspace;
9. how temporary work is given temporary UI depth instead of permanent page clutter;
10. how the whole lifecycle remains enforced by backend invariants, not just hidden buttons.

---

## 2. Non-negotiable product laws

1. **The database may be complex. The operator journey must remain simple.**
2. **A governance object is not automatically a UI object.**
3. **Never ask an operator to enter, confirm, select, or manage information the system can derive authoritatively.**
4. **A completed control becomes evidence, not a permanent form.**
5. **One business action has one operating location.**
6. **One important fact appears once in the working viewport unless repetition is necessary to make a local decision.**
7. **Normal waiting is quiet. Off-plan work gets attention.**
8. **Existing records open in view mode. Editing is intentional.**
9. **Temporary actions use temporary UI.**
10. **The first viewport communicates the current business situation, not the database structure.**
11. **The visual depth of the interface must match the depth of the task.**
12. **Backend state is driven by business verbs and governed evidence, not raw status selectors wherever a contextual action can express the same intent.**
13. **Internal identifiers, raw event payloads, session/token mechanics, assignment records, compatibility vocabulary, and implementation enums remain below the normal operator waterline.**
14. **A route or component is not exempt because it is small, secondary, old, rarely used, or technically correct. Every visible object must earn its place.**
15. **No lifecycle gate may be weakened for visual simplicity. Simplicity comes from orchestration and derivation, not from removing control.**

---

## 3. Canonical lifecycle including hard start-payment gate

The product lifecycle for this sprint is:

> **Enquiry → Technical Intake → Partner Assessment → Go / No-Go → Case 360 → Commercial Approval → Client Quote → Client Acceptance → Project created / Awaiting Payment → Required Start Payment Received/Cleared → Mobilisation Complete → Release to Execution Partner → Partner Commencement → Governed Execution → Partner Delivery → Internal Review → Client Issue → Client Review → Completion → Financial Closeout**

### Payment-before-start rule

A Project record may be created after written client acceptance so that mobilisation, invoicing, settlement evidence, documents, and project administration have an authoritative home.

However:

> **A Project cannot start execution until the required start payment is actually recorded as received/cleared.**

The following do **not** unlock execution:

- invoice issued;
- payment promised;
- bank transfer initiated;
- payment marked pending;
- email confirmation without cleared settlement evidence;
- manual UI override without an explicit governed exception process.

The required start amount is derived from the accepted commercial terms. The normal Project UI must not ask the operator to re-key that amount.

Before qualifying payment:

- Project operating state = **Awaiting client payment**;
- Partner release is unavailable;
- execution assignment/session creation is unavailable through normal and direct governed paths;
- Partner commencement cannot advance the project;
- Project 360 presents the payment requirement and settlement state, not execution machinery.

After qualifying payment is received/cleared:

- the payment action collapses to compact evidence;
- mobilisation readiness may complete;
- **Release to Execution Partner** becomes available when all other required gates are satisfied.

This rule must be enforced in server actions/RPC/readiness, not only in presentation.

---

## 4. Universal object classification

Every operator-facing object, field, card, metric, selector, button, row, status, empty state, panel, dialog, drawer, and disclosure must be classified before it is allowed to remain visible.

### Action

A human must make a real business choice, exercise authority, or provide genuinely new information/evidence.

Examples:

- Approve commercial position
- Release work to Partner
- Request changes
- Accept/reject delivery
- Record cleared payment
- Resolve exception
- Sign declaration

### Evidence

A completed control or external fact the operator may need to verify.

Evidence is read-only by default and should be compact.

Examples:

- Client acceptance received
- Start payment received
- Work released to MIDTS
- Partner commenced
- Document approved
- Client transmittal recorded

### Derived

The system already knows the value from authoritative lineage, current state, authenticated identity, policy, or a linked governed record.

Derived values must not be re-keyed or re-confirmed in the normal path.

Examples:

- commercially selected Execution Partner;
- current approved SOW/STW;
- Project dates;
- current execution cycle;
- authenticated signer identity;
- current lifecycle owner;
- start-payment requirement from commercial terms;
- Project Partner on project-scoped payable/delivery records where lineage is authoritative.

### Internal Control

A database/governance/security/orchestration object required for integrity but not normally part of the operator's mental model.

Examples:

- execution assignment row;
- execution session row;
- token hash;
- raw stage enum;
- raw entity UUID;
- audit event payload;
- internal version counters;
- compatibility aliases;
- internal retry counters.

These remain in DB/audit/admin unless a specific advanced task requires them.

---

## 5. Interaction-depth contract

The workspace may use only a small, consistent set of interaction depths.

### Page

Persistent operating context. The operator lives here.

Use for:

- registers;
- Mission Control;
- primary record workspaces;
- specialist operating surfaces.

### Record tab / working area

Persistent aspect of a large record.

Use for a bounded set of domains such as:

- Overview
- Execution
- Delivery
- Commercial
- Documents
- History

Only one working area should dominate at a time. Do not vertically render the entire database below the fold.

### Right drawer / side sheet

Contextual information or work that should not force the operator to leave the current record.

Use for:

- Project details;
- Partner details;
- commercial basis;
- delivery package inspection;
- evidence;
- current Partner update;
- related record context;
- document preview.

On small screens this may become a full-height sheet.

### Dialog

Temporary, focused decision or action.

Use for:

- Approve / Reject
- Release to Partner
- Request Changes
- Sign
- Issue Document
- Record Payment
- Resolve Exception
- Confirm destructive action
- Create/Send controlled communication where appropriate

A dialog must disappear after completion. The resulting DB record persists; the action form does not.

### Disclosure

Rare, advanced, technical, historical, or exceptional context.

Use for:

- Advanced Partner access
- Replace secure link
- Override recipient
- historical revisions
- technical metadata
- raw audit evidence
- administrative exception
- compatibility/debug information

### Toast / inline completion feedback

Use only for action feedback. It is not a substitute for persistent evidence when the resulting state matters later.

---

## 6. First-viewport budget

For a normal lifecycle record, target:

- **1** record identity block
- **1** operating-state statement
- **1** next action **or** waiting condition
- **3–4** decision-relevant facts maximum
- **0** UUIDs/internal IDs
- **0** raw enum selectors where contextual actions can drive state
- **0** selectors for authoritative inherited values
- **0** completed-control forms
- **0** duplicate record navigation
- **0** empty `0 of 0` evidence presenters unless absence is itself meaningful

Everything else belongs in the selected working area, drawer, disclosure, specialist surface, history, or audit.

---

## 7. Whole-workspace no-miss audit contract

The sprint audit must cover every operator-facing route and component, including small/secondary/legacy surfaces.

For every visible object record:

| Audit question | Required answer |
| --- | --- |
| What operator job does this serve? | Specific business purpose |
| Classification | Action / Evidence / Derived / Internal Control |
| Authoritative truth owner | Canonical DB/domain source |
| Should it be visible? | Yes / contextual / advanced / no |
| Should it be editable? | Yes / exception only / never |
| Interaction depth | Page / Tab / Drawer / Dialog / Disclosure / none |
| Is it duplicated elsewhere? | Exact duplicate/near-duplicate check |
| When should it disappear/collapse? | Completion/state rule |
| Empty-state rule | Explicit |
| Permission rule | Explicit |
| Mobile rule | Explicit |
| Audit requirement | Explicit |
| Backend invariant | Explicit where relevant |

The audit scope includes, at minimum:

- global navigation
- record navigation
- topbar/mobile navigation
- breadcrumbs/context strips
- page headers
- stage trackers
- operating-state panels
- readiness rows
- next-action controls
- metrics
- cards/panels
- registers/tables
- filters/saved views
- forms
- every individual field
- selectors
- status pills
- warning/success/empty/loading/error states
- evidence counters
- document requirement presenters
- drawers/dialogs/disclosures
- action menus/popovers
- messages/notifications
- tasks/issues/risk
- CRM/partners
- audit/history
- settings
- admin/debug/compatibility routes
- desktop/mobile variants
- permission-specific variants
- shared components
- CSS layers and obsolete visual overrides

A component is not retained merely because it is technically functional.

---

## 8. Execution programme

The programme is delivered in controlled waves. Do not merge a giant unvalidated redesign.

### Wave 0 — Freeze product contract and inventory

**Goal:** Establish one source of truth for the recomposition programme before further UI changes.

Deliverables:

- this sprint MD;
- updated business lifecycle including hard payment-before-start gate;
- complete object/route/component inventory;
- Action / Evidence / Derived / Internal Control classification;
- duplicate-fact map;
- action ownership map;
- interaction-depth map;
- list of compatibility/admin exceptions;
- baseline screenshots where available.

Exit gate:

- every workspace route and shared operator component is represented in the audit, or explicitly marked `keep — operator-intent driven`;
- no unresolved lifecycle ownership contradiction remains undocumented.

---

### Wave 1 — Backend lifecycle integrity first

**Goal:** Make the simplified UI impossible to bypass through direct backend paths.

Priority change:

- enforce **payment before Project execution start** in authoritative readiness/server/RPC paths.

Tasks:

- identify accepted commercial term fields/source for start-payment basis;
- identify settlement source of truth;
- define qualifying `received/cleared` semantics;
- ensure partial/deposit payments are supported without duplicate finance state;
- ensure Project readiness consumes the settlement truth;
- block Partner release without qualifying payment;
- block commencement/stage progression without qualifying payment;
- preserve closeout finance rules;
- add audit evidence where required;
- ensure UI cannot be the only enforcement layer.

Exit gate:

- direct governed actions and RPC paths reject release/start without payment;
- paid path remains valid;
- no second payment model introduced.

---

### Wave 2 — Shared interaction primitives

**Goal:** Create interaction depth once so each module does not invent its own UX.

Build/standardise:

- accessible Dialog;
- right Drawer / mobile Sheet;
- Disclosure;
- compact Evidence Row;
- Action Menu / More menu;
- Toast/feedback pattern;
- record working-area/tabs pattern;
- loading/pending/error/confirm states.

Requirements:

- focus management;
- keyboard support;
- Escape behaviour where safe;
- focus restoration;
- scroll locking;
- screen-reader announcements;
- double-submit prevention;
- responsive behaviour;
- no new arbitrary card family.

Exit gate:

- primitives work in isolation and through at least one real record interaction on desktop/mobile.

---

### Wave 3 — Workspace shell and canonical record archetype

**Goal:** Remove competing navigation/state hierarchies before module-by-module recomposition.

Tasks:

- one global navigation hierarchy;
- one record-context navigation hierarchy;
- remove duplicate top/side Project navigation;
- quiet/remove duplicate topbar destinations where they create a third hierarchy;
- standard record archetype:
  1. Identity
  2. Operating State
  3. One next action or waiting condition
  4. 3–4 current decision facts
  5. selected working area
- remove forced empty sections from shared RecordWorkspace;
- progressive disclosure for supporting evidence/history/details.

Exit gate:

- a record can be understood from the first viewport without scanning internal sections.

---

### Wave 4 — Acquisition and Case 360

**Goal:** Turn pre-project lifecycle from object management into decision progression.

Acquisition tasks:

- remove raw Stage selection from normal Enquiry creation;
- remove parallel manual Next Action model from normal creation;
- keep lifecycle state canonical/derived;
- Partner Assessment defaults move below the waterline or into Advanced;
- client identity disclosure remains an explicit privacy decision;
- Partner response presents decision summary first;
- full technical/commercial response moves to review details;
- Go / No-Go uses focused decision UI;
- completed acquisition gates collapse to evidence;
- no duplicate Case-owned Partner review.

Case tasks:

- inherited Partner evidence remains inherited/read-only;
- technical/commercial basis presenters show only unresolved requirements;
- completed basis collapses;
- commercial approval uses a focused action;
- quote recipient defaults derive from Case/contact context;
- exceptional Case creation moves out of normal working flow;
- Project-owned/historical Cases become read-only handoff summaries.

Exit gate:

- operator never re-enters inherited feasibility/Partner/price evidence;
- one clear action or wait at each Case/Acquisition state.

---

### Wave 5 — Project creation, mobilisation, and payment gate

**Goal:** Make Project creation distinct from Project start.

After client acceptance:

- create Project record;
- operating state = **Awaiting client payment** until qualifying payment exists;
- Project can own invoice/payment administration and mobilisation evidence while waiting;
- no Partner release or commencement controls visible/valid yet.

Project payment presentation:

- required amount derived from accepted commercial terms;
- received amount derived from Payments/settlement source;
- one operator locus for settlement capture;
- Project only presents the gate and links/launches the owned payment action;
- once paid, input UI collapses to compact evidence.

Example first viewport before payment:

> **Awaiting client payment**  
> Required to start: £X  
> Received: £Y  
> **Record payment →**

After qualifying payment:

> ✓ **Start payment received** · £X · date  
> **Release to Execution Partner →**

Exit gate:

- Project cannot reach executable state without payment at UI, server, and readiness levels.

---

### Wave 6 — Execution recomposition

**Goal:** Remove execution assignment/session machinery from the normal operator mental model.

Normal pre-release presentation:

- commercially selected Partner = derived locked evidence;
- current approved execution scope = derived locked evidence;
- due/start dates = inherited where authoritative;
- Partner recipient = derived with explicit `Change contact` exception if required;
- routine cadence defaults hidden/Advanced;
- release notes optional/Advanced;
- one primary action: **Release to {Partner}**.

Behind release action:

- create/update execution assignment;
- bind approved scope;
- create/reopen secure Partner session;
- write audit events;
- apply canonical cycle/state controls.

After release:

- release form disappears;
- compact release evidence remains;
- session mechanics remain hidden;
- normal action = Open Partner Workspace;
- raw secure URL/rotation only under Advanced Partner Access;
- zero exceptions render nothing;
- zero Partner delivery submissions render nothing;
- normal Partner wait is quiet;
- current Partner update only shown when useful.

Exit gate:

- operator can run execution without knowing the term `project_execution_assignments` or session/token internals.

---

### Wave 7 — Delivery recomposition

**Goal:** Stop treating Delivery as a database state editor.

Replace raw state management with business verbs:

- Submit for Internal Review
- Approve Internally
- Request Partner Correction
- Send to Client
- Record Client Acceptance
- Mark Blocked
- Resolve Blocker

Derived rules:

- Partner inherited from Project execution lineage unless an explicit multi-partner exception model exists;
- revision derives from controlled document lineage where possible;
- review policy derives from workflow/item policy where possible;
- linked documents auto-bind from lineage where possible;
- current-cycle submission is authoritative;
- prior-cycle evidence cannot satisfy current correction cycle.

Exit gate:

- no normal operator must choose raw internal/client review enum states to progress delivery.

---

### Wave 8 — Documents and Approvals

**Goal:** Create one requirement presenter and focused authority interactions.

Document tasks:

- consolidate `ControlledEvidence`, `StageDocumentGuide`, and `DocumentGenerationPanel` responsibilities into one canonical `Documents needed now` presenter;
- render nothing for zero requirements unless absence is meaningful;
- move completed/later-stage documents to registry/history/disclosure;
- show one canonical human revision; hide internal version where not needed;
- remove UUID/internal IDs from normal document detail;
- authenticated signer identity is derived;
- signer explicitly accepts declaration and signs;
- approval/issue/archive use focused actions;
- completed actions become authorisation evidence.

Approvals tasks:

- remain a decision queue, never a second workflow;
- source record remains authoritative;
- decision panel shows only evidence needed for that authority;
- approval disappears from queue after completion;
- blocked approval is distinct from ready approval.

Exit gate:

- one requirement surface;
- no duplicate signer identity input;
- no shadow approval state.

---

### Wave 9 — Commercial and Payments ownership reconciliation

**Goal:** Remove duplicate financial actions while preserving strong controls.

Commercial owns:

- pricing basis;
- margin/markup;
- commercial approval;
- Client Quote;
- invoice creation/authority;
- Partner liability/payable authorisation;
- management commercial context.

Payments owns:

- actual client settlement received;
- actual Partner settlement paid;
- settlement date/reference/method/evidence;
- cleared/received state used by Project start-payment gate.

Rules:

- Commercial/Project may display settlement state and launch/link to payment action;
- payment recording has one owner;
- project-scoped payable inherits governed Partner where authoritative;
- delivery evidence confirmation should derive from governed evidence where possible;
- management margin metrics should not overwhelm settlement workspace.

Exit gate:

- no duplicate payment-entry forms across Commercial, Project, and Payments;
- start-payment readiness consumes one settlement source of truth.

---

### Wave 10 — Supporting workspace recomposition

**Goal:** Apply the same contract to every non-core surface.

Partners:

- creation starts Prospective;
- approval/suspension are explicit later actions;
- NDA readiness comes from evidence/control, not creation checkbox;
- rating does not exist before performance evidence;
- reduce metrics to selection-relevant indicators.

CRM:

- remove profile-coverage/data-quality KPIs from prime operator space;
- Add Contact becomes intentional action/disclosure;
- documents/activity are secondary context.

Messages:

- correspondence only;
- no activity/audit events mixed into Messages.

Notifications:

- delivery/automation health only;
- retry diagnostics visible only for failure/diagnostic expansion.

Issues:

- off-plan work only;
- normal review/client/Partner waits never appear as issues.

Tasks:

- create from source record by default;
- no normal UUID/entity-type typing;
- contextual Start / Complete / Block actions where task mutation is required.

Risk / Compliance:

- contextual verbs instead of raw status selectors where possible;
- create from source context by default;
- global creation becomes Advanced if still required.

Knowledge:

- retain user-intent driven content flow;
- optional metadata must not become compulsory noise.

Activity / Audit:

- human event labels in normal view;
- no UUIDs/raw payloads in default rows;
- technical evidence behind disclosure.

Settings:

- configuration only;
- no duplicate day-to-day operational launchpads.

Exit gate:

- every primary/secondary destination has one operator job, one conceptual source of truth, and one interaction pattern.

---

### Wave 11 — Registers, saved views, and command/search layer

**Goal:** Make registers the primary operational navigation tool instead of proliferating dashboards.

Core registers:

- Enquiries
- Cases
- Projects
- Partners
- Approvals
- Documents
- Payments where relevant

Useful views:

- My work
- Needs attention
- Waiting on Partner
- Waiting on Client
- Awaiting Payment
- Due this week
- At risk
- Recently updated

Global command/search target:

- client/company
- Project number/title
- Partner
- Case
- Quote reference
- controlled document reference
- Enquiry

Search should reduce navigation depth, not create another dashboard.

Exit gate:

- common records are reachable quickly without navigating multiple modules.

---

### Wave 12 — CSS and information-density reconciliation

**Goal:** Make the visual system reflect the simplified product model.

Audit:

- duplicate selectors;
- stale route-specific overrides;
- broad `.card`/`.button` overrides;
- dead styles;
- obsolete compatibility/MIDTS-era classes;
- multiple competing panel families;
- mobile stacking hacks;
- global density inconsistencies.

Visual hierarchy:

1. **Primary operating surface** — state/action/current work
2. **Supporting context** — quiet, often borderless
3. **Attention/action** — high contrast, used sparingly

Rules:

- no box merely because a component exists;
- no nested card walls;
- no giant whitespace around tiny information;
- no tiny text used simply to fit excessive data;
- one consistent Dialog, Drawer, Register, Evidence, Approval, and Operating State treatment.

Exit gate:

- visual density supports product hierarchy instead of masking data-model clutter.

---

### Wave 13 — Responsive, accessibility, permissions, and performance

**Goal:** Ensure simplification holds under real operating conditions.

Responsive:

- desktop drawer → mobile sheet where appropriate;
- no stacked-desktop 4000px pages;
- registers preserve essential columns/actions;
- dialogs/sheets fit mobile viewport;
- selected record working area remains comprehensible.

Accessibility:

- focus trap for dialogs/sheets;
- Escape handling;
- focus return;
- keyboard navigation;
- semantic labels/headings;
- status/action announcements;
- error association;
- loading/pending feedback;
- destructive confirmation.

Permissions:

- hide irrelevant controls rather than show walls of disabled buttons;
- show waiting-on-authority state when that information is useful;
- preserve server-side role checks.

Performance:

- identify duplicate Supabase queries;
- identify N+1 reads;
- batch repeated lineage/state resolution;
- prevent separate pages from independently deriving contradictory state;
- use canonical presentation/read models where appropriate;
- keep optimisation below the UI waterline.

Exit gate:

- desktop/mobile tell the same operating truth;
- permission differences do not create clutter;
- simplified UI does not rely on excessive repeated backend work.

---

### Wave 14 — Full operator simulation and release acceptance

**Goal:** Validate the product as an operator journey, not as a collection of compiling components.

Create/use a safe sacrificial lifecycle record and walk:

1. Enquiry
2. Technical Intake
3. Partner Assessment
4. Go / No-Go
5. Case 360
6. Technical/commercial basis
7. Quote
8. Client acceptance
9. Project created — Awaiting Payment
10. Start payment recorded/cleared
11. Mobilisation
12. Release to Partner
13. Partner commencement
14. Execution
15. Partner delivery
16. Internal review
17. Client issue/transmittal
18. Client review
19. Completion
20. Final invoice/receivable settlement
21. Partner payable settlement
22. Closeout

At every state verify:

- What is happening?
- Who owns the next move?
- What can the operator do right now?
- Is there exactly one primary action or clear wait?
- Is anything unnecessarily editable?
- Is anything repeated?
- Is any completed form still hanging around?
- Is any DB terminology exposed?
- Is any internal ID visible?
- Is normal waiting made to look like a problem?
- Is the first viewport calm enough?
- Can the operator accomplish the action without understanding the schema?
- Is the authoritative backend gate enforced?
- Does desktop work?
- Does mobile work?
- Does the permission variant make sense?
- Does the empty/loading/error path make sense?
- Is audit evidence retained?

A state does not pass merely because lint/typecheck/build pass.

---

## 9. Module ownership target

The following ownership boundaries are the default target and must be challenged only through explicit lifecycle change control.

| Module | Primary operator job |
| --- | --- |
| Mission Control | What needs attention/decision now |
| Enquiries / Acquisition | Capture and qualify incoming work |
| Partner Assessments | Govern pre-commercial Partner feasibility/pricing |
| Cases | Convert qualified opportunity into controlled commercial basis |
| Approvals | Cross-product authority decisions only |
| Projects | Govern accepted work and delivery lifecycle |
| Execution | Run current Partner execution relationship |
| Delivery | Review and progress actual delivery/output |
| Commercial | Pricing, quote, invoicing authority, liability, margin context |
| Payments | Actual settlement capture/evidence |
| Documents | Controlled publication registry and document actions |
| Messages | Business correspondence |
| Notifications | Delivery/automation health |
| Issues | Off-plan intervention work |
| Partners | Execution Partner master/network management |
| CRM | Company/contact relationship context |
| Activity / Audit | Immutable/historical trace |
| Settings | Configuration only |
| Admin/Debug | Internal machinery, repair, diagnostics |

No module gets a second operator job merely because the DB model is convenient to query there.

---

## 10. Duplicate-information audit

For every major business fact, map every place it is rendered:

- Client
- Company
- Partner
- Owner
- Scope
- Due date
- Start date
- Project value
- Partner cost
- Margin
- Lifecycle stage
- Operating state
- Execution cycle
- Quote
- Payment requirement
- Amount received
- Document requirement
- Current controlled document
- Client review outcome

For each rendering ask:

> **Why does the operator need this fact here to make this specific decision?**

If there is no local decision reason, remove it, move it to context, or make it accessible through a drawer/disclosure.

---

## 11. Completed-control collapse audit

Every workflow action that produces a durable record/evidence must be checked for stale form persistence.

Examples:

- Go / No-Go
- commercial approval
- quote issue
- client acceptance
- start payment
- Project mobilisation
- Partner release
- Partner commencement
- document sign/approve/issue
- delivery review
- client transmittal
- client acceptance
- payable approval
- payment recording
- closeout

Rule:

> **Before completion: action UI. After completion: compact evidence.**

Reopening the control requires an explicit `Change`, `Amend`, `Replace`, `Correct`, or advanced exception path that respects lifecycle rules.

---

## 12. Language audit

Remove database/developer vocabulary from normal operator presentation unless it is genuinely business language.

Avoid in normal UI where possible:

- assignment record
- session record
- entity ID
- execution state enum
- canonical lifecycle
- token
- payload
- internal version
- evidence confirmation boolean
- retry count
- raw event type
- `published` compatibility state

Prefer:

- Release work
- Partner started
- Awaiting Partner delivery
- Delivery received
- Needs review
- Request correction
- Send to client
- Client accepted
- Start payment received
- Record payment
- Close Project

Backend vocabulary may remain backend vocabulary.

---

## 13. Per-PR acceptance sheet

Every implementation PR must document:

1. Business rule affected
2. Authoritative data source
3. Operator job
4. Classification of removed/retained objects
5. Interaction primitive used
6. Duplicate-information check
7. Completed-state behaviour
8. Empty-state behaviour
9. Loading/error behaviour
10. Permission behaviour
11. Mobile behaviour
12. Accessibility behaviour
13. Audit/evidence retention
14. Backend invariant/gate
15. Lint/typecheck/build result
16. Preview/runtime result
17. Known limitations
18. Rollback/compatibility considerations

No PR is accepted solely because it compiles.

---

## 14. Branch, PR, and deployment strategy

This programme must not land as one uncontrolled 100-file redesign.

Rules:

- keep `main` stable;
- use the current sprint/programme branch as the integration line while work is isolated;
- deliver coherent, reviewable PR boundaries where practical;
- do not bypass exact-head validation because preview infrastructure is temporarily unavailable;
- when Vercel build-rate limits prevent exact-head validation, keep work draft/unmerged rather than declaring it safe;
- no production promotion without validated head and appropriate runtime checks;
- no lifecycle/data mutation merely to make a test appear green;
- no fake evidence;
- no direct DB repair replacing proper governed flow unless explicitly operating in an authorised admin/debug repair task.

Recommended PR boundaries after the foundation sprint:

- Payment Start Gate
- Shared Interaction Primitives
- Workspace Shell + Record Archetype
- Acquisition + Case
- Project Mobilisation
- Execution
- Delivery
- Documents + Approvals
- Commercial + Payments
- Supporting Workspace
- Registers + Search
- CSS / Responsive / Accessibility / Performance
- Full Lifecycle Acceptance

---

## 15. Safety constraints

Throughout the programme:

- preserve existing governed evidence;
- preserve current lifecycle auditability;
- do not silently change ownership between Acquisition, Case, Project, Commercial, Payments, Documents, or Approvals;
- do not create a generic shadow workflow table to simplify presentation;
- do not weaken role enforcement;
- do not expose private Partner/session/token material;
- do not mutate the Northstar validation Project merely to make screens appear complete;
- do not bypass the new payment-before-start rule;
- do not make visual state authoritative over database truth;
- do not remove an evidence capture merely because its current form is ugly — first relocate/recompose the genuine human action;
- do not introduce a new interaction pattern when Page / Tab / Drawer / Dialog / Disclosure is sufficient.

---

## 16. Definition of done

The programme is complete when all of the following are true:

1. The operator can run the entire lifecycle without understanding Overflow Partner's database design.
2. No Project execution can start before the required client start payment is received/cleared.
3. Every primary navigation destination has one clear operator job, one conceptual source of truth, and one interaction pattern.
4. Major records present identity, operating state, one action/wait, and only decision-relevant facts in the first viewport.
5. Derived values are not re-keyed in downstream stages.
6. Internal control objects remain below the normal UI waterline.
7. Completed controls collapse into evidence across the lifecycle.
8. Normal waiting is not presented as an issue/blocker.
9. Delivery is driven by business actions rather than raw status editing.
10. Documents have one canonical current-requirement presenter.
11. Approvals remain authority decisions, not a shadow workflow.
12. Commercial and Payments have non-overlapping action ownership.
13. Messages, Notifications, Issues, and Activity/Audit remain conceptually separated.
14. No internal UUIDs/raw audit payloads appear in normal operator presentation.
15. Duplicate information has been challenged and removed unless locally decision-relevant.
16. Dialogs/drawers/disclosures provide interaction depth without adding clutter.
17. Desktop and mobile tell the same operating truth.
18. Accessibility and role behaviour are intentional.
19. Backend invariants enforce the same rules the UI communicates.
20. Full end-to-end operator simulation passes from Enquiry through payment-gated Project start and financial closeout.

Final product test:

> **Can a competent operator correctly run Overflow Partner by understanding the business, without needing to understand assignments, sessions, raw status enums, evidence joins, UUIDs, or internal orchestration?**

If the answer is not clearly yes, the sprint is not finished.
