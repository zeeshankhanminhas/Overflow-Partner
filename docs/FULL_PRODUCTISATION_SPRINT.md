# Overflow Partner Full Productisation Sprint

## Purpose

This document records the product architecture and completion boundary for the full workspace productisation pass. It is an implementation map, not a second product strategy.

The governing rules remain:

- Portfolio surfaces answer what needs attention and where work is moving.
- Record surfaces answer what this record is, what evidence exists, and the next permitted action.
- Specialist controls manage a bounded operating concern such as finance, documents or communications.
- Management surfaces aggregate performance, risk and assurance.
- Pipeline orchestration remains internal system behaviour; it is not a separate operator workflow.

## Canonical workspace navigation

### Home

| Route | Product surface | Responsibility |
| --- | --- | --- |
| `/workspace` | Mission Control | Business decisions, exceptions, workload and next actions |

### Work

| Route | Product surface | Responsibility |
| --- | --- | --- |
| `/workspace/acquisition/prospects` | Acquisition register | Prospect portfolio before qualification |
| `/workspace/acquisition` | Acquisition control | Acquisition operating entry point |
| `/workspace/acquisition/intake` | Intake | Controlled prospect intake |
| `/workspace/acquisition/[id]` | Prospect 360 | Prospect qualification and pre-Case evidence |
| `/workspace/leads` | Cases | Qualified pre-project work; route name is technical compatibility only |
| `/workspace/leads/[id]` | Case 360 | Primary pre-delivery operating record |
| `/workspace/assessments` | Assessment queue | Technical definition and partner-review specialist work |
| `/workspace/projects` | Project portfolio | Delivery-owned work |
| `/workspace/projects/[id]` | Project 360 | Primary controlled delivery record |
| `/workspace/projects/[id]/delivery` | Delivery control | Project delivery items and execution evidence |

### Commercial

| Route | Product surface | Responsibility |
| --- | --- | --- |
| `/workspace/quotes` | Client quotes | Controlled quotation register |
| `/workspace/payments` | Payments | Receivables, payables and cash movement |
| `/workspace/commercial-control` | Commercial control | Financial gates, invoices, partner liabilities and authorisation |
| `/workspace/commercial-control/invoices/[id]` | Invoice record | Controlled invoice detail |
| `/workspace/partners` | Execution partners | Partner readiness, NDA and capability |

### Operations

| Route | Product surface | Responsibility |
| --- | --- | --- |
| `/workspace/exceptions` | Exceptions | Off-plan operational conditions |
| `/workspace/tasks` | Tasks | Governed actions |
| `/workspace/documents` | Documents | Controlled document registry and record context |
| `/workspace/documents/[documentId]` | Document record | Controlled document review |
| `/workspace/documents/templates/[document]` | Document template | Governed template rendering |
| `/workspace/communications` | Communications | Governed message register |
| `/workspace/communications/[entityType]/[entityId]` | Record communications | Case/Project communication history |

### Intelligence

| Route | Product surface | Responsibility |
| --- | --- | --- |
| `/workspace/intelligence` | Executive Intelligence | Business performance |
| `/workspace/risk` | Risk & Compliance | Assurance, risk and compliance |
| `/workspace/knowledge` | Knowledge | Controlled operating knowledge |

### Administration and shared controls

| Route | Product surface | Responsibility |
| --- | --- | --- |
| `/workspace/search` | Search | Cross-workspace retrieval |
| `/workspace/notifications` | Attention Centre | Notifications and operator attention |
| `/workspace/settings` | Settings | Workspace configuration |
| `/workspace/settings/developer-data` | Developer data | Controlled technical inspection |
| `/workspace/companies` | Companies | Company master register |
| `/workspace/companies/[companyId]` | Company 360 | Company master record |
| `/workspace/contacts` | Contacts | Contact master register |
| `/workspace/users` | Users & roles | Access administration |
| `/workspace/activity` | Activity | Global audit activity |
| `/workspace/opds` | OPDS | Internal design-system reference only |

### Compatibility routes

These routes are deliberately retained to protect links and database lineage; they do not define product navigation:

- `/workspace/commercial-reviews` → Case commercial-review view
- `/workspace/partner-quotes` → Case partner-pricing view
- `/workspace/orchestration` → Cases
- `/workspace/leads` and `lead` query/entity keys remain technical compatibility identifiers while the operator-facing product term is **Case**.

## Productised module status

| Requested module | Canonical product treatment |
| --- | --- |
| Dashboard | Mission Control uses canonical page header, metrics, statuses, registers and empty states |
| Leads / Cases | Case register and Case 360 own qualified pre-project work; operator language is Case |
| Assessments | Separate specialist queue for technical definition and partner review |
| Quotes | Controlled quote register linked back to Case context |
| Payments | Canonical ledger metrics, project scope, receivable/payable registers, statuses, feedback and payment history |
| Projects | Portfolio triage plus Project 360 delivery context |
| Documents | Controlled registry/viewer with record context and document transition controls |
| Communications | Governed message register linked to Case/Project records |
| Partners | Controlled execution-partner register with readiness signals |
| Commercial | Canonical financial-authorisation, invoice and partner-liability controls |

## Shared product language

### Page composition

Product pages use the shared primitives in `components/workspace/ProductUI.tsx`:

- `ProductPageHeader`
- `ProductMetrics` / `ProductMetric`
- `ProductSectionHeader`
- `ProductStatus`
- `ProductNotice`
- `ProductEmptyState`
- `ProductFilterBar`
- `ProductRegister` / `ProductRegisterRow`

Specialised registers may keep a dedicated dense layout when the data requires more columns, but must use the same hierarchy, status semantics and responsive rules.

### Status semantics

- `neutral` — informational / no intervention implied
- `active` — work is progressing
- `waiting` — waiting on a person, event or external response
- `attention` — intervention is becoming necessary
- `blocked` — progression is prevented
- `critical` — immediate high-severity condition
- `complete` — successful / complete state

### Product-level states

- **Loading:** workspace route skeleton with `aria-busy` and reduced-motion support
- **Error:** route error boundary with retry, Mission Control and Exceptions recovery paths
- **Empty:** canonical contextual empty state; no dead blank panels
- **Success:** canonical complete-tone notice with live-region feedback
- **Blocked:** canonical blocked/critical notice and status semantics
- **Attention required:** metrics/statuses use attention tone and link to the governed next action

## Record context

The shell resolves a current Prospect, Case or Project context and keeps context navigation available for relevant Documents, Payments, Communications, Delivery and Commercial Control routes.

A record page should make the following obvious without interpretation:

1. What record am I in?
2. What lifecycle state is it in?
3. What is waiting or blocked?
4. What evidence is available?
5. What is the next permitted action?

## Visual system

The active workspace shell is Overflow Partner-native (`op-*`) and no longer uses the cloned MIDTS shell/reset naming.

Product visual rules:

- dark charcoal engineering workspace
- restrained orange accent only where useful
- compact information-dense hierarchy
- strong typography and whitespace rather than decorative cards
- no glassmorphism, generic SaaS gradients or decorative shadows
- statuses are compact semantic signals, not badges for decoration
- controls stay practical and legible under dense operational use

## Responsive contract

At mobile widths:

- the desktop sidebar/top bar become the compact mobile header and five-destination bottom navigation
- product metrics collapse to two columns
- product registers become single-column record cards
- portfolio registers expose labels per field
- two-column specialist controls collapse to one column
- action groups wrap to full-width practical controls
- document tables retain controlled horizontal scrolling where a true table is required
- fixed review panels respect safe-area insets

## Quality gate

The production build command is intentionally strict:

1. lint
2. TypeScript typecheck
3. Next.js production build

The sprint is only complete when the final branch head passes that gate, is merged to `main`, the resulting Vercel production deployment is `READY`, and public/protected route behaviour plus production runtime errors have been checked.
