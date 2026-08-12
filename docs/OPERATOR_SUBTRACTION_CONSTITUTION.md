# Operator Subtraction Constitution

Status: Normative

## Product intent

Overflow Partner may keep a sophisticated governed database, audit model and lifecycle. The normal operator interface must not require the operator to understand or repeatedly manage that internal machinery.

The primary rule is:

> **A governance object is not automatically a UI object.**

A second non-negotiable rule is:

> **Never ask an operator to enter, confirm, select or manage information that the system can derive authoritatively.**

The database remains explicit. The operator experience remains simple.

## Classification

Every operator-facing object, field, status, form, metric and control must be classified as one of four types before it is rendered.

1. **Action** — a human must make a real business choice, provide new evidence, or exercise authority.
2. **Evidence** — a completed control or external fact that the operator may need to verify. Evidence is read-only by default.
3. **Derived** — the system already knows the value from authoritative lineage, current state or authenticated identity. It must not be re-keyed or re-confirmed in the normal path.
4. **Internal control** — a database/governance implementation object required for integrity, audit, security or orchestration. It is hidden from the normal operator path unless a specific admin/debug task requires it.

## KISS rules

1. **Governance objects stay below the waterline.** Assignment rows, session rows, token hashes, cycle records, stage enums, technical IDs and evidence joins may exist in the DB without becoming operator objects.
2. **Derived values are inherited, not selected.** Accepted Partner, approved scope, Project dates, authenticated signer identity, current lifecycle owner and current execution cycle are examples.
3. **Completed controls collapse into evidence.** A completed form must not remain permanently open/editable. It becomes a compact read-only statement with an explicit exceptional edit/replace path only where allowed.
4. **One business action has one operator locus.** Other pages may show the state and link to the owner; they must not duplicate the same action form.
5. **One fact appears once per working viewport.** Repetition is allowed only where the fact is necessary to make a decision in that exact component.
6. **Human actions use verbs, not DB states.** Prefer `Start work`, `Request changes`, `Send to client`, `Mark blocked`, `Record payment`. Do not expose a raw status dropdown when contextual actions can drive the state.
7. **Normal waiting is quiet.** A Partner/client/internal dependency is not an alert, blocker or editable control unless it is overdue or off-plan.
8. **Internal identifiers are hidden by default.** UUIDs, entity types, session IDs, assignment IDs, internal versions and raw event payloads belong in audit/admin disclosure only.
9. **Inherited lineage is locked evidence.** If a Partner, quote, scope or Project was chosen earlier by a governed decision, later stages display the inherited result; they do not offer another selector.
10. **Advanced controls are exceptional.** Overrides, rotations, manual record creation, direct status repair and destructive tools are role-gated and/or behind an explicit Advanced/Admin path.
11. **No parallel requirement presenters.** A requirement should have one current-state/action presenter. Registry, history and audit views may show the same record for different jobs, but not repeat the current decision UI.
12. **The operating state owns the first viewport.** Record identity, current operating state, one next action/waiting condition and a small number of decision-relevant facts come first. Everything else progressively discloses.
13. **Read-only evidence does not need a card just because it is stored.** Supporting facts should use compact rows/text; borders and containers are reserved for real hierarchy or attention.
14. **Compatibility routes do not become concepts.** Legacy redirects may remain for links, but their old vocabulary must not reappear in navigation or operator copy.
15. **Admin/debug surfaces are allowed to be technical only when the audience boundary is explicit.** Developer tools are not a template for normal operator UI.

## First-viewport budget

For a normal lifecycle record, the first working viewport should target:

- 1 record identity block
- 1 operating-state statement
- 1 next action **or** waiting condition
- no more than 3–4 decision-relevant facts
- 0 UUIDs or internal IDs
- 0 raw enum selectors
- 0 selectors for authoritative inherited values
- 0 completed-control forms
- 0 duplicate navigation for the same record

Everything else should be progressive disclosure or a linked specialist surface.

## Workspace audit matrix

The following matrix is the baseline subtraction audit. `Keep DB` means the underlying model remains authoritative even where the UI projection is removed.

| Surface / object | Current operator burden | Classification | Target presentation | Keep DB |
| --- | --- | --- | --- | --- |
| Workspace shell | Multiple visual/navigation layers compete for attention | Internal/presentation | One global nav + one record context + one current action hierarchy | Yes |
| Project layout top tabs | Duplicates the left Current Record navigation | Derived navigation | Keep one record navigation system, not both | Yes |
| Topbar Approvals/Notifications | Useful shortcuts but duplicate sidebar destinations | Convenience | Keep only if visually quiet; no third navigation hierarchy | Yes |
| Mission Control signal strip + metrics | Same queue counts are repeated twice before queue content | Derived summary | Keep one compact operating summary plus the next intervention | Yes |
| Acquisition overview | Each card repeats state, summary, waiting owner, next action, requirement and intake date | Derived/repeated | Register row: identity + state + owner/wait + next action; detail holds evidence | Yes |
| Enquiry register | Mostly clean; summary metrics repeat some queue meaning | Derived summary | Keep concise register; remove metrics that do not change operator choice | Yes |
| Technical intake register | Internal session records become a separate operational concept | Internal control/read model | Keep as specialist/admin monitoring or demote; work intake from Enquiry | Yes |
| Enquiry detail stage strip | Repeats the canonical Operating State | Derived | Remove or collapse to quiet progress only when it aids orientation | Yes |
| Enquiry readiness facts | Intake/submission/Partner price/approval/lifecycle all repeat state already interpreted above | Derived/evidence | Show only the unresolved gate; completed gates collapse to evidence | Yes |
| Enquiry activity facts | Sent/submitted/responded timestamps persist in current work | Evidence/history | Show timing only when it affects the current wait; otherwise History | Yes |
| Enquiry metadata | IDs/references shown in generic Record Details | Internal/evidence | Keep under Audit/Admin disclosure only | Yes |
| Manual Prospect form `Stage` | Operator can choose a lifecycle status at creation | Internal state | New Enquiry starts in canonical initial state automatically | Yes |
| Manual Prospect `Next action/date` | Parallel manual next-action model competes with presentation engine | Internal/duplicate | Remove from normal creation; use Tasks only for exceptional follow-up | Yes |
| Partner Assessment request defaults | Due date/instructions are routine defaults shown as mandatory configuration | Derived/default | One `Send to Partner` action; routine defaults in Advanced | Yes |
| Partner Assessment client identity toggle | Real privacy decision | Action | Keep explicit | Yes |
| Partner response fact wall | Every response field is promoted into the approval viewport | Evidence | Decision summary first; full technical/commercial response in Review details | Yes |
| Accepted assumptions/risks textareas | Copies Partner evidence into a second editable representation | Derived/duplicate evidence | Approval references exact response revision; conditions only if operator changes/qualifies it | Yes |
| Case list `Exceptional entry` | Manual Case creation bypass is present on the normal Case page | Internal/admin exception | Role-gate and move to Advanced/Admin | Yes |
| Case compatibility filters | Old Partner review/pricing vocabulary remains as queue concepts | Compatibility | Retain links only if needed; favour current Case stages and inherited evidence language | Yes |
| Case 360 stage strip | Duplicates Operating State | Derived | Quiet orientation or remove | Yes |
| Case readiness facts | Technical scope, inherited Partner evidence, price, commercial review and quote evidence repeat the basis | Evidence/derived | Show only unresolved requirement; completed basis becomes compact evidence | Yes |
| Historical Case controls | Handoff record can still visually resemble active work | Evidence/history | Historical Case becomes read-only handoff summary + Project link | Yes |
| Quote issue recipient name/email | Often already known from the Case | Derived with possible exception | Prefill silently; expose `Change recipient` only when needed | Yes |
| Quote acceptance accepted-by contact | Default contact is often known but actual accepter can differ | Action + derived default | Show concise evidence capture; allow change only when actual accepter differs | Yes |
| Project list `Administrative exception` | Manual Project creation appears on the normal portfolio | Internal/admin exception | Move to developer/admin tools or role-gated Advanced | Yes |
| Project portfolio | Mostly presentation-led; many backend joins are not exposed | Derived read model | Keep operator-friendly read model; avoid adding more columns | Yes |
| Project 360 state strip | Long stage tracker + Operating State + readiness create stacked interpretations | Derived | Operating State dominates; stage progress becomes secondary | Yes |
| Project 360 readiness rows | Partner commencement, delivery, documents, delivery control etc. can duplicate specialist surfaces | Evidence/derived | Show only items blocking the next action; completed items collapse | Yes |
| Project 360 Key Details | Static client/owner/due/value repeat portfolio/header facts | Derived | Keep only decision-relevant facts; rest in Details | Yes |
| Execution assignment row | Legitimate DB anchor is exposed as a permanent operator object | Internal control | Create/update automatically from authoritative commercial lineage | Yes |
| Execution Partner selector | Only the accepted commercial Partner is allowed, yet a selector is shown | Derived | Display Partner as locked evidence; no selector | Yes |
| Execution scope selector | Current approved SOW/STW is already governed | Derived | Auto-bind the authoritative current controlled scope; exceptional change only before release | Yes |
| Execution project dates | Planned start/due repeat Project dates | Derived | Inherit Project dates; expose override only if business rules genuinely allow a separate commitment | Yes |
| Execution Partner contact | Often already stored on Partner/assignment | Derived with exception | Show recipient; `Change contact` only when required | Yes |
| Execution reporting cadence | Routine configuration shown alongside core release | Optional action | Default system cadence; Advanced override | Yes |
| Execution release notes | Optional | Action | Advanced/optional, not core form | Yes |
| `Save execution controls` after assignment | Completed control remains as editable form | Internal/control history | Collapse to `Released/Configured` evidence; exceptional edit only before commencement | Yes |
| Execution session state | Session status is shown as a business metric | Internal control | Show `Partner access active` only when useful; session internals hidden | Yes |
| Secure Partner URL | Raw security artefact is permanently visible | Internal/security control | `Open Partner workspace`; Copy/replace link under Advanced/Security | Yes |
| Rotate/replace Partner link | Security exception is always visible | Internal/admin action | Advanced disclosure only | Yes |
| Execution metrics grid | Project stage/release/commencement/exceptions repeat Project 360 and cards below | Derived | One concise execution status sentence + intervention count only when non-zero | Yes |
| Execution intelligence | Commencement/progress/forecast duplicated across status/Partner workspace/project | Evidence | Current Partner update only; commencement becomes compact completed evidence | Yes |
| Execution Exceptions card | Duplicates Issues when no exception exists | Evidence/exception | Hide at zero; when open, show intervention and link to owning issue/context | Yes |
| Execution Delivery submissions card | Duplicates Delivery/Internal Review path | Evidence | Hide until submission exists; then show received package + next action | Yes |
| Delivery item raw `status` select | DB state machine is directly editable | Internal state | Contextual actions/verbs drive governed transitions | Yes |
| Delivery internal/client review status selects | Parallel status fields are manually maintained | Internal state/evidence | Derived from explicit review actions/evidence; no raw dropdowns | Yes |
| Delivery Partner selector | Can conflict with Project's governed Execution Partner | Derived lineage | Inherit Project Partner unless an explicitly modelled multi-partner exception exists | Yes |
| Delivery owner selector | Real operational assignment | Action | Keep when ownership can genuinely change | Yes |
| Delivery revision field | Can be document-derived for linked controlled outputs | Derived/optional | Derive from controlled document where possible; otherwise Advanced | Yes |
| Delivery review-required checkboxes | Configuration detail on every item | Internal/default | Derive from item type/workflow policy or put in Advanced when truly variable | Yes |
| Delivery linked-document selector | May be real mapping but often follows generated output | Derived/exception | Auto-link where lineage exists; manual link under Advanced | Yes |
| Delivery page language | Describes managing fields/statuses rather than delivering work | Presentation | Phrase around due work, review, blockers and outputs | Yes |
| Commercial Control vs Payments | Both surfaces can record client and Partner payments | Duplicate action | Commercial Control owns authorisation/invoices/liabilities; Payments owns settlement | Yes |
| Commercial Control project selector when project-scoped | Re-asks context already supplied in URL | Derived | Lock scoped Project; selector only in global view | Yes |
| Commercial terms | Legitimate financial decision but a dense field set is always available | Action + advanced | Show chosen basis/current requirement; edit terms behind explicit action | Yes |
| Partner payable Partner selector | Project already has governed execution Partner | Derived lineage | Inherit Partner for project-scoped payable; exception path if model supports legitimate alternative supplier | Yes |
| Partner payable `evidence confirmed` checkbox | Re-confirms evidence that can be derived from governed delivery | Derived/evidence | Derive from accepted delivery evidence where available | Yes |
| Payments forecast margin/cash position | Management metrics on settlement workspace may distract from payment job | Derived management | Keep settlement-focused metrics; management margin belongs Executive/Commercial | Yes |
| Payments record forms | This is the correct settlement locus | Action | Keep concise payment evidence capture | Yes |
| Invoice detail footer | Says settlement is governed in Commercial Control | Ownership wording | Point settlement to Payments after ownership reconciliation | Yes |
| Partner creation status | New Partner can be created directly as approved/suspended/inactive | Internal lifecycle state | New Partner starts Prospective; explicit approval/suspension actions later | Yes |
| Partner creation NDA flag | Operator can declare NDA signed without evidence workflow | Evidence/control | Default not-ready; NDA readiness comes from controlled evidence/action | Yes |
| Partner creation rating | Rating is entered before performance exists | Derived/assessment | Remove from creation; derive/record through performance review | Yes |
| Partner register metrics | Network/Approved/NDA-ready/gap are useful but can be reduced | Derived summary | Keep only metrics that change partner-selection decisions | Yes |
| Documents: revision + internal version | Two version concepts shown together | Internal/derived | Show canonical human revision only; internal version hidden | Yes |
| Documents issue purpose column | Low-value control detail in main register | Internal/evidence | Move to document detail/issue history unless decision-relevant | Yes |
| Document issue history | Full release ledger sits on main register | Audit/evidence | Progressive disclosure or document detail | Yes |
| Document ID in document footer | UUID is printed in normal document detail | Internal ID | Remove from normal presentation; audit disclosure only | Yes |
| Document signer name/role inputs | Authenticated identity is already known | Derived identity | Server records signed-in name/role; operator accepts declaration + Sign | Yes |
| Document signature declaration | Real legal/intent action | Action | Keep explicit | Yes |
| ControlledEvidence | Presents requirement counts/list/actions | Requirement presenter | Consolidate with StageDocumentGuide/DocumentGenerationPanel | Yes |
| StageDocumentGuide | Second requirement presenter for same state | Requirement presenter | Consolidate | Yes |
| DocumentGenerationPanel | Third requirement presenter including complete/later-stage lists | Requirement presenter | One canonical `Documents needed now` component; completed/later items move to registry/disclosure | Yes |
| Required-document zero state | Some presenters explain absence of blockers | Noise | Render nothing when no requirement exists unless absence itself is meaningful | Yes |
| Messages | Already reconciled to correspondence only | Action/evidence | Keep | Yes |
| Notifications attempts/max attempts | Technical retry data shown on every row | Internal diagnostics | Show only on failure/diagnostic expansion | Yes |
| Issues | Correctly owns off-plan work after reconciliation | Action/exception | Keep; no normal waiting states | Yes |
| Tasks exceptional creation | Requires raw entity type + UUID and manual starting status | Internal/admin exception | Create tasks from source record; exceptional global creation role-gated with record search, no UUID typing | Yes |
| Task status | Status is shown as an enum; no contextual task actions | Internal state | Use Start / Complete / Block actions where task editing is required | Yes |
| Risk raw status select | Operator manages DB status directly | Internal state + decision | Replace with contextual actions (`Mitigate`, `Accept`, `Close`) while keeping status in DB | Yes |
| Compliance raw status select | Same | Internal state + evidence | Drive from evidence/expiry where possible; explicit Waive/Confirm valid actions when human authority is required | Yes |
| Risk/compliance record selector | Legitimate association but technical when creating from global page | Action/context | Prefer creating from source record; global add remains Advanced | Yes |
| Knowledge | Mostly user-intent driven; add form already disclosed | Action/content | Keep; simplify only where metadata becomes compulsory noise | Yes |
| Company register profile-coverage metrics | Data-completeness KPIs occupy prime space | Derived admin metric | Remove from normal CRM view or move to data-quality/admin | Yes |
| Contact register profile-coverage metrics | Same | Derived admin metric | Remove/move | Yes |
| Company detail Add Contact panel | Permanent creation form occupies working space | Action | Collapse behind `Add contact` button/disclosure | Yes |
| Company 360 document/activity summaries | Valid context but secondary to relationship job | Evidence/history | Progressive disclosure; avoid turning CRM into another operational dashboard | Yes |
| Activity audit entity UUIDs | Raw entity IDs shown in every row | Internal ID | Human record label + link; UUID only in expanded technical detail | Yes |
| Activity event names | Raw-ish event vocabulary may leak | Internal event | Human label in normal audit; exact event type in technical detail | Yes |
| Search | Correct specialist read model; mostly clean | Derived navigation | Keep concise | Yes |
| Settings `Attention Centre` row | Stale pre-contract concept reintroduced in Settings | Compatibility wording | Rename/remove; Settings should not duplicate primary operating destinations | Yes |
| Settings account metrics | Useful admin context but not an operating action | Admin evidence | Keep compact | Yes |
| Users & roles | Read-only access register is appropriately administrative | Admin evidence | Keep | Yes |
| Developer data cleanup | Intentionally technical and explicitly capability-gated | Internal/admin | Keep technical; never promote to normal operator path | Yes |
| OPDS specimen route | Design/developer reference, not an operator job | Internal/design | Keep unlinked/developer-only | Yes |
| Compatibility routes | Redirect only | Internal compatibility | Keep invisible; never re-promote old concepts | Yes |
| CSS layer stack | Many historical CSS layers increase visual drift and make subtraction hard to reason about | Presentation technical debt | Consolidate after operator structure stabilises; do not add another global patch layer | N/A |

## Ownership simplifications

The following action ownership is authoritative for the operator experience:

- **Acquisition:** Enquiry intake, Partner Assessment, Go / No-Go.
- **Case 360:** controlled technical basis, commercial position, Client Quote preparation/issue/acceptance.
- **Project 360:** delivery operating position and governed handoffs.
- **Execution:** Partner access and current Partner execution only; internal assignment/session machinery is hidden.
- **Delivery:** outputs, due work, blockers and review actions; not raw lifecycle fields.
- **Documents:** controlled publication review/issue; other surfaces link to it rather than reimplementing document control.
- **Commercial Control:** financial authorisation, invoices and Partner liabilities.
- **Payments:** cash settlement evidence and balances.
- **Approvals:** decision queue only; action stays in authoritative owner.
- **Issues:** off-plan intervention only.
- **Messages:** correspondence only.
- **Notifications:** delivery health only.
- **Activity/Audit:** traceability only.

## Shared component rule

`OperatingStatePanel` is the canonical first interpretation of record state.

`RecordWorkspace` must not force pages to populate Action Controls, Readiness Details and Key Details when those areas have no unique decision value. Empty or completed supporting structures should disappear rather than preserve layout symmetry.

Document requirement presentation must converge on one canonical component. A registry can show all documents; the operating record shows only what is needed **now**.

## Acceptance test

Before any operator-facing change is merged, inspect the resulting page and answer:

1. What is the single thing the operator is trying to accomplish here?
2. Is every editable field a genuine human choice or new evidence?
3. Could any visible value be inherited from an authoritative source instead?
4. Is any completed form still occupying space instead of becoming evidence?
5. Is the same fact/status/action visible elsewhere in the same viewport?
6. Does another surface already own this action?
7. Are any raw IDs, enum values, session/assignment records or technical diagnostics exposed without an explicit admin purpose?
8. Can a normal wait be mistaken for a blocker or task?
9. Can one clear verb replace a status dropdown?
10. If this component vanished, would the operator lose a decision or only lose visibility into implementation machinery?

If the last answer is implementation machinery, remove it from the normal operator path.

## Change control

This constitution is additive to:

- `BUSINESS_LIFECYCLE_CONSTITUTION.md`
- `GLOBAL_STATE_PRESENTATION_CONSTITUTION.md`
- `PRIMARY_NAV_PRODUCT_CONTRACT.md`

Business governance remains intact. Subtraction changes **presentation and operator interaction**, not the authoritative evidence model, lifecycle gates or audit requirements.
