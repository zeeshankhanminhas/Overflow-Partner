# Overflow Partner — Business Lifecycle Constitution

**Status:** Normative business-logic source of truth  
**Scope:** Website intake → Acquisition → Case 360 → Project 360 → Closeout  
**Rule:** Product UI, server actions, database RPCs, document requirements and automation must conform to this lifecycle. A later implementation must not introduce a second route around a governed gate.

## Core operating principles

1. **One lifecycle owner at a time.** Acquisition owns the opportunity until governed Go / No-Go. Case 360 owns commercial conversion after qualification. Project 360 owns delivery only after written client acceptance and confirmed opening payment.
2. **Record, controlled document and evidence are different things.** A workflow state is not a document; a partner declaration is not an Overflow Partner approval; a controlled document is not proof that an external event occurred unless that event is explicitly recorded.
3. **Partner feasibility and pricing happen once.** The governed Execution Partner review belongs to Acquisition. Case 360 inherits it and must not ask for the same pre-commercial review again.
4. **The commercially selected partner is the default execution partner.** Replacement after quotation is an exception/change-control decision, not a normal selection step.
5. **Project stage is governance state.** Partner progress is execution intelligence. Progress reports do not independently change Project stage.
6. **External declarations remain attributable.** Partner-reported and client-reported evidence must remain distinguishable from Overflow Partner-verified evidence.
7. **One readiness authority.** `op_project_stage_readiness(project_id)` is the canonical Project stage-exit gate. Stage-transition RPCs must not implement competing readiness logic.
8. **No silent bypasses.** A direct database/API call must be subject to the same invariant as the UI.
9. **Technical revision identity stays technical.** Internal execution/revision counters may be used to bind evidence to the correct submission, but normal operator and Partner UI must describe the business event: original delivery, changes requested, revised delivery and review.

## Canonical lifecycle gates

| Gate | Lifecycle owner | Trigger / state | Authoritative record or evidence | Controlled document requirement | Next permitted action |
|---|---|---|---|---|---|
| **G01 Enquiry captured** | Acquisition | Website/manual enquiry received | Prospect + source metadata | None | Issue Step 2 technical intake |
| **G02 Technical intake submitted** | Acquisition | Customer submits secure Step 2 | Intake Session + Intake Submission + source files | None yet; source evidence only | Internal intake review / prepare partner review |
| **G03 Partner review released** | Acquisition | Internal operator selects approved NDA-ready partner and releases governed request | Partner Review Request + secure session/file references | No Case document required; the governed request is the review evidence | Await partner response |
| **G04 Partner feasibility + price received** | Acquisition | Execution Partner submits declaration | Partner Review Response + Partner Quote | No OP-controlled publication yet | Internal Go / No-Go |
| **G05 Go / No-Go approved** | Acquisition | OP approves feasible response and positive partner price | Partner Review Internal Decision | None required to qualify | Create Case 360 |
| **G06 Case technical basis controlled** | Case 360 | Prospect converted; Step 2 and approved partner evidence inherited | Technical Intake + inherited Partner Review/Quote | Client Requirements approved, then Scope of Work approved; Partner Technical Assessment approved before commercial progression | Create commercial review |
| **G07 Commercial position approved** | Case 360 | Partner cost + markup/margin decision approved | Commercial Review | Commercial Review itself is authority; Commercial Approval publication is optional | Generate controlled Client Quote |
| **G08 Client quotation issued** | Case 360 | Quote generated, controlled quotation approved and commercially transmitted | Quote + Quote Issue Record (recipient, method, evidence reference) | Client Quote approved before issue; issued publication remains authoritative | Await client outcome |
| **G09 Client acceptance and opening payment evidenced** | Case 360 | Written acceptance and cleared opening payment are recorded together | Quote Acceptance Record plus Quote Payment Confirmation (method, reference, timestamp and accepted Quote total) | Existing issued Client Quote remains authoritative | Create Project 360 |
| **G10 Project mobilisation complete** | Project 360 | Project created from accepted quote | Project + accepted quote + selected partner lineage | Inherited Scope of Work approved; Statement of Work approved; mobilisation/financial controls complete | Authorise execution |
| **G11 Partner execution released and commenced** | Project 360 / Execution Partner | OP releases controlled execution assignment; partner declares commencement | Project Execution Assignment + Partner Commencement Declaration | Execution assignment must link approved controlled scope | Project becomes In Progress |
| **G12 Governed execution** | Project 360 / Execution Partner | Partner works, reports delivery health/progress/exceptions and submits engineering delivery | Progress Updates, Execution Exceptions, Delivery Control Items, Partner Delivery Submission **plus attached engineering output files** | Deliverables may link controlled documents; open exceptions, unresolved required delivery items or a file-less Partner submission block progression | Hand delivery back to Overflow Partner for Internal Review |
| **G13 Internal review and controlled client issue** | Project 360 | OP verifies the submitted Partner delivery; if changes are needed the work returns to the Partner and a revised delivery returns directly to OP review | Partner Delivery Submission review outcome + internal review evidence + revision-linked evidence | Technical Review / Document Register as required; issued client package | Approve for client issue or request Partner changes |
| **G14 Client review, completion and closure** | Project 360 | Client outcome recorded, closeout evidence complete, finance reconciled | Client Transmittal + Client Review Outcome + closeout audit | Completion Report / Handover evidence; issued Invoice where applicable | Close Project |

## Mandatory branch rules

### Acquisition → Case 360

- A Prospect cannot become `qualified` without:
  - submitted Step 2 intake;
  - governed partner response;
  - feasible / feasible-with-conditions result;
  - positive partner price;
  - internal Go / No-Go approval.
- Case conversion must use that same evidence. It must **not** require a separate legacy `prospect_technical_reviews` approval.
- New Case-owned pre-commercial Partner Review Requests are prohibited. Existing inherited records are historical/valid evidence.

### Case 360

- Conversion generates the controlled **Client Requirements** draft from inherited customer evidence.
- Technical Scope approval requires Client Requirements to be approved.
- Technical Scope approval generates draft **Scope of Work** and **Partner Technical Assessment** publications.
- Commercial Review requires:
  - approved Technical Scope;
  - inherited approved partner review/price;
  - approved Scope of Work;
  - approved Partner Technical Assessment.
- `commercial_reviews` approval is the commercial authority. A separate Commercial Approval document is optional, not a lifecycle blocker.
- Quote generation creates exactly one canonical `client-quote` controlled document shell.
- Quote issue requires that canonical document to be approved **and** a Quote Issue Record identifying recipient, delivery method and evidence reference. A status change alone is not commercial transmission evidence.
- Project creation requires both written acceptance evidence and a confirmed opening-payment evidence record.

### Project 360

- Project creation transfers the current approved `scope-of-work` from Case ownership to Project ownership and creates a draft `statement-of-work` shell.
- Execution Partner assignment must match the partner behind the accepted commercial review unless an explicit governed partner-change process is later introduced.
- Partner release requires an approved controlled Scope of Work linked to the execution assignment.
- Partner Commencement Declaration is the event that moves a partner-executed project from `ready_for_execution` to `in_progress`.
- Progress Updates do not move Project stage. `on_track`, `at_risk` and `blocked` are **delivery health**, not lifecycle stages.
- Open Execution Exceptions block progression and keep the Partner assignment visibly blocked until the last open exception is resolved.
- Delivery Control items participate in readiness whenever they exist; they are not a parallel decorative tracker.
- Partner Delivery Submissions are internally revision-aware. A prior delivery cannot satisfy a later requested-change submission, but the internal revision/cycle identifier is not normal business UI language.
- Every Partner Delivery Submission must attach at least one actual engineering output file in the private Partner Delivery store. A text manifest alone cannot satisfy the Partner-work → OP-review gate.
- Submission metadata and its revision-linked engineering files are committed as one governed transaction and become immutable after submission.
- A successful Partner Delivery Submission hands responsibility back to Overflow Partner by setting the assignment to `delivery_submitted`. While that state is active, no further Partner progress, exception or delivery submissions are permitted until changes are formally requested.
- If Internal Review or Client Review requires changes, the UI presents **Changes requested → Partner work → Revised delivery → OP review**. The underlying implementation may increment its revision identity, but there is no separate operator step called “Return to Partner execution”.
- A revised Partner delivery must include the current revision's engineering output evidence and returns directly to Internal Review once the governed readiness gate is satisfied.
- Internal Review acceptance applies only to the current revision of the Partner delivery.
- Client issue requires a transmittal record identifying recipient, method, time and controlled package.
- Client Review requires an explicit outcome. `changes_requested` routes back through Partner work; accepted outcomes permit Completion.
- Closure requires no open execution exceptions, no unresolved delivery-control items/tasks, final issued closeout evidence, and no outstanding client receivables or partner payables.
- For a positive-value Project, closeout additionally requires client invoices whose recorded total covers the accepted Client Quote, an issued current controlled `invoice` document, and Execution Partner payables whose recorded total covers the accepted Partner cost with payable evidence confirmed. An empty or under-recorded finance ledger is not a valid closeout state.

## Operator presentation contract

The governed database stage model remains detailed, but the normal operator orientation is intentionally compressed to five phases:

1. **Setup & release**
2. **Partner work**
3. **OP review**
4. **Client review**
5. **Closeout**

Project 360 must make the **current phase, current responsibility and next permitted action** more prominent than the underlying database stage name. Correction/revision loops must not be represented as a false linear progress history.

The external Partner workspace is narrower still. It should normally present:

- **Ready to start → Working → Delivery submitted**, or
- **Changes requested → Working → Revised delivery submitted**.

The Partner does not need the internal ten-stage Project lifecycle or technical execution-cycle number to perform their work.

## Controlled document naming

Canonical slugs use hyphens:

- `client-requirements`
- `scope-of-work`
- `partner-technical-assessment-report`
- `client-quote`
- `statement-of-work`
- `technical-review`
- `document-register`
- `handover-pack`
- `completion-report`
- `invoice`

Legacy underscore aliases (`client_quote`, `scope_of_work`, `project_closeout`) must not be generated by new workflow code.

## Change-control rule

Any future change that alters lifecycle ownership, gate evidence, document requirements, partner/client authority or Project stage transitions must update this constitution **in the same pull request** and demonstrate an end-to-end lifecycle test. Mid-sprint changes must not introduce a second path around a gate.