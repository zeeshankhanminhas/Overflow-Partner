# OPOS — Visual Lock Specification v1.0
**Status:** Proposed for visual approval; not yet locked  
**Scope:** Complete replacement presentation layer on `design/opos-decision-first-ia`  
**Source of truth:** The previously approved near-black, calm, minimal Opportunity concept. Recreate its design principles, not the legacy workspace screens.  
**Excluded:** Changing commercial stages, approval policy, database schema, payment gates, partner contracts, permissions or audit history.

## 1. Product character
OPOS must feel like a **quiet operating desk for an engineering delivery business**: serious, exact, calm, credible, spacious and operationally decisive.

- **Do:** restrained monochrome, precise typography, strong hierarchy, generous whitespace, contextual controls, polished empty and waiting states.
- **Do not:** generic CRM dashboards, colourful KPI tiles, gradient accents, heavy shadows, nested card walls, excessive pills, double status banners, or visible developer tools.
- Design philosophy: **The operating system works in the background and surfaces human decisions only when needed.**
- One screen = one clear purpose. High business complexity must not become high visual complexity.

## 2. Visual tokens — proposed frozen values
These values are the **starting visual contract** and must be tested in screenshots before approval.

### Colour
| Token | Hex | Purpose |
|---|---|---|
| `canvas` | `#0B0C0E` | Application background |
| `navigation` | `#0F1012` | Internal app navigation |
| `surface` | `#151619` | Cards, panels, dialogs |
| `surface-raised` | `#1B1D20` | Hover, dropdowns, subtle hierarchy |
| `surface-hover` | `#23252A` | Interactive hover |
| `border` | `#303238` | Quiet dividers and outlines |
| `border-strong` | `#484B52` | Control boundaries and selected state |
| `text-primary` | `#F4F4F5` | Main headings and content |
| `text-secondary` | `#B8BAC0` | Support text and descriptions |
| `text-tertiary` | `#9497A0` | Metadata only |
| `action-primary-bg` | `#F4F4F5` | Primary action, exceptionally |
| `action-primary-fg` | `#101114` | Primary button label |
| `positive` | `#72CFA1` | Confirmed completion |
| `attention` | `#F1C076` | Action needed / expiring |
| `critical` | `#F08A8A` | Errors and blockers |
| `informational` | `#9DBDFF` | Neutral information, rare |

Colours are not branding decoration. Semantic colours indicate a *verified* condition. A queued email is **not** green-delivered. Status text must remain understandable without colour.

### Typography
- **Typeface:** Inter; fallback to system sans-serif. No secondary display font.
- **Weights:** 400 normal, 500 medium, 600 semibold. Avoid 700 except rare metrics.
- **Scale:** 12 (metadata), 13 (labels), 14 (controls, tables), 16 (body), 20 (section), 28 (record heading), 36 (Mission Control heading).
- **Line height:** 1.45 body; 1.15–1.25 large headings. Small caps/letterspacing restricted to eyebrows.
- **Numbers:** tabular numerals for money, dates, quantities and IDs.
- **Copy:** plain business English; concise, human, actionable. Do not use engineering jargon where a simpler label is accurate.

### Geometry, layout, motion
- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64 px. No arbitrary per-page margins.
- **Radius:** 8 px controls; 12 px panels; 16 px large decision surfaces. No excessive pill shapes beyond status tokens.
- **Border:** 1 px; no decorative glass or heavy drop shadows.
- **Desktop shell:** 224 px sidebar, 64 px top region, 32–40 px content gutters, 1160 px maximum working content. Record decision column should read comfortably at 800–920 px.
- **Responsive:** 16 px page gutters at mobile widths; collapse sidebar into deliberate navigation; stack content without horizontal page scrolling.
- **Motion:** 120–180 ms restrained transitions for focus, hover and disclosure; respect reduced-motion; no parallax, entrance animation or distracting dashboard motion.

## 3. Universal screen anatomy
Every internal operating record must have these layers **once only**:
1. **Identity** — location in lifecycle, record name/reference, discreet state.
2. **Situation** — one sentence describing what has happened and what is pending.
3. **Decision or waiting** — exactly one primary operator action when genuinely required; otherwise a calm waiting state without a fake call to action.
4. **Evidence and dependencies** — compact, readable supporting proof and blockers.
5. **History and administration** — subordinate, collapsible, not competing visually.

Business state comes from the governed lifecycle; no component may independently invent a contradictory status. All actions link to real handlers.

## 4. Core components — mandatory behaviours
| Component | Appearance | Interaction |
|---|---|---|
| App shell | Dark canvas; one clean navigation rail and restrained header | Clear active location; never duplicate page navigation |
| Record header | Single h1, short supporting line, discreet reference/status | No oversized second summary banner |
| Progress / stage | Compact grouped stages, highlight current stage | Show prior/next on demand; avoid 11 equal-width steps |
| Decision surface | One dominant quiet panel, one obvious primary CTA | If waiting, **no action button** unless genuine retry/escalation applies |
| Status | Small label with text + optional semantic icon | Distinguish queued, sent to provider, delivered if independently verified, failed |
| Register | Spacious rows, restrained dividers, clear aligned columns | Search/filter/sort; row opens detail; destructive/bulk actions separate |
| Forms | Narrow readable column, clear field grouping | Inline validation, saved state, non-destructive progress |
| Evidence | Compact documents and approval records | Preview/inspect without losing record context |
| Drawer/disclosure | Minimal secondary layer | Preserve focus, keyboard accessibility and browser history where applicable |
| Dialog | Used for irreversible/financial/contractual decisions | Explicit summary and confirmation; cannot bypass governance |
| Notifications | Visible only if useful to the next decision | No duplicated page banners and toasts for one state |

Primary CTA: neutral light button on dark canvas. Secondary: dark outlined/text actions. Destructive action never looks primary.

## 5. Screen archetypes
**A. Mission Control:** What needs my decision now? One highlighted priority, small queue, waiting-on-others grouped separately. No KPI-wall default.

**B. Work register:** Opportunities, Cases, Projects, Partners, Finance and Documents. Compact search/filter header, sortable usable rows, primary new-record action only when allowed, no cards for each row.

**C. Record workspace:** Shared information hierarchy across Opportunity, Case 360 and Project 360. Context-sensitive decision panel, stage progression, evidence and activity behind clear progressive disclosure.

**D. Review / decision:** Technical and commercial assessments. Side-by-side context only at wide widths; clearly separate decision, rationale, evidence and audit. Decision controls only to authorised roles.

**E. External portal:** Client and Execution Partner use independent simplified shells, no internal nav or governance internals. One meaningful task per view, plain consequences and submission confirmation.

**F. Intake / form:** Guided, single-column, reassuring, minimal required fields and document-upload assistance.

## 6. Required representative screens before visual approval
1. **Mission Control:** one urgent approval, two secondary actions, three waiting cases; demonstrates hierarchy and density.
2. **LinkedIn Outreach:** pre-CRM prospect conversation and interest qualification. Never expose the customer technical form until interest is confirmed.
3. **Opportunity:** website enquiry whose Step 2 email was accepted by provider and is awaiting customer submission. **No manual-send CTA, no LinkedIn copy-link suggestion, no developer test link.**
4. **Case 360:** approved scope, commercial quotation awaiting authorisation; clear pricing evidence and one decision.
5. **Project 360:** verified advance, accepted work order, active execution, QA and dependencies; show operational next action.
6. **Client Portal:** secure requirements, quotation acceptance, payment and delivery-review states, each showing only relevant customer actions.
7. **Execution Partner Portal:** technical assessment, work-order acceptance, uploads and clarification steps; no customer pricing/margin.
8. **Register + Finance:** dense real-data table, search/filters, status, reconciliation with correct money formatting.

Include **desktop (1440 px) and mobile (390 px)** renderings for each, and at least one empty, waiting, blocked, actionable, failed and completed state across the set.

## 7. Navigation / IA principles — proposed, not yet final
- Internal navigation: **Home / Outreach / Work / Partners / Finance / Documents / Administration**.
- **Work** contains Opportunities, Cases and Projects. These are distinct records, not parallel duplicate workflows.
- Outreach remains a separate pre-CRM funnel; only interested prospects are promoted.
- Client and Execution Partner portals do **not** share the internal navigation shell.
- Cross-record links preserve context. Put rare tools in contextual overflow menus; keep global settings out of operating work.

## 8. Invariants that UI must never compromise
- The lifecycle remains **Opportunity → Requirements → Feasibility → Commercial Offer → Contractual Commitment → Mobilisation → Execution → Quality Assurance → Delivery → Payment Settlement → Closure**.
- Client advance **received and verified** before Project 360 creation.
- Execution Partner Work Order issued only after verified advance and project creation; partner must accept before execution.
- Partner payout only after client final payment, execution completion, OP QA and client review conditions.
- Approved quotations, contracts, signatures, revisions and audit history remain governed.
- State changes are derived from persistent facts, not button clicks or visual optimism.
- Email **queued ≠ provider accepted ≠ inbox delivered**.
- Never surface QA or developer test token controls to ordinary operators.

## 9. Visual lock acceptance criteria
A screen **fails visual lock** if it has duplicated status explanations, two competing primary CTAs, unreadable light/dark mixing, unexplained nested panels, noisy coloured decoration, contradictory workflow copy, developer actions in standard UI, uncontrolled horizontal overflow, or inaccessible contrast/focus.

**Accessibility:** WCAG AA contrast targets (4.5:1 normal text; 3:1 controls/large text), keyboard operation, proper labels, visible focus, screen-reader status text, reduced-motion support.

**Functional integrity:** Every presented action must have a real permitted handler; disabled states must explain why; waiting must reflect backend facts; a successful build alone is not acceptance.

## 10. Approval gates and implementation contract
1. **Visual direction review:** approve palette, typography, spacing, shell and component exemplars.
2. **Archetype review:** approve full-screen static designs for Mission Control, record, register, external portal and intake on both viewport sizes.
3. **Visual lock:** approve screenshots and sign off this document as **LOCKED v1.0**. Until then it is *proposed*.
4. **IA lock:** validate navigation, object boundaries and actions separately from appearance.
5. **Implementation:** build new presentation components on `design/opos-decision-first-ia` without importing legacy CSS overrides from PR #111/#112. Reuse existing backend services, validated business state, auth and audit infrastructure.
6. **Regression:** desktop/mobile screenshot comparisons plus end-to-end journey tests for website enquiry, LinkedIn conversion, partner assessment, quotation, verified advance, work order, delivery, payment settlement and closure.
7. **Release:** no merge solely for passing a build; merge only after visual and workflow gates pass.

**Non-negotiable:** A fresh UI does not mean restarting the business, deleting data or replacing established operating rules.
