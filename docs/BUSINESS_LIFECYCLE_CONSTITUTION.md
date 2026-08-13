# Overflow Partner — Business Lifecycle Constitution

**Status:** Normative business-logic source of truth  
**Scope:** Website intake → Acquisition → Case 360 → Project 360 → Closeout  
**Rule:** Product UI, server actions, database RPCs, document requirements and automation must conform to this lifecycle. A later implementation must not introduce a second route around a governed gate.

## Core operating principles

1. **One lifecycle owner at a time.** Acquisition owns the opportunity until governed Go / No-Go. Case 360 owns commercial conversion after qualification. Project 360 owns delivery after client acceptance.
2. **Record, controlled document and evidence are different things.** A workflow state is not a document; a partner declaration is not an Overflow Partner approval; a controlled document is not proof that an external event occurred unless that event is explicitly recorded.
3. **Partner feasibility and pricing happen once.** The governed Execution Partner review belongs to Acquisition. Case 360 inherits it and must not ask for the same pre-commercial review again.
4. **The commercially selected partner is the default execution partner.** Replacement after quotation is an exception/change-control decision, not a normal selection step.
5. **Project stage is governance state.** Partner progress is execution intelligence. Progress reports do not independently change Project stage.
6. **External declarations remain attributable.** Partner-reported and client-reported evidence must remain distinguishable from Overflow Partner-verified evidence.
7. **One readiness authority.** `op_project_stage_readiness(project_id)` is the canonical Project stage-exit gate. Stage-transition RPCs must not implement competing readiness logic.
8. **No silent bypasses.** A direct database/API call must be subject to the same invariant as the UI.
9. **No Project starts without client money received.** Client acceptance may create the Project record, but the Project remains commercially locked in an `Awaiting Payment` pre-start condition until the required start payment has been recorded as received/cleared. No mobilisation completion, Execution Partner release, Partner access, commencement or engineering execution may occur before this gate is satisfied.

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
| **G09 Client acceptance evidenced** | Case 360 | Written acceptance is recorded | Quote Acceptance Record (signed quote / PO / email / portal / other written evidence) | Existing issued Client Quote remains authoritative | Create Project 360 in Awaiting Payment |
| **G10 Start payment received** | Project 360 / Commercial | Project exists but remains commercially locked until the required start payment is received/cleared | Client Invoice / payment request where applicable + Client Payment record(s) + accepted commercial payment terms | Issued Invoice / payment request evidence where required by the agreed terms | Unlock Project mobilisation |
| **G11 Project mobilisation complete** | Project 360 | Required start payment gate satisfied and mobilisation basis complete | Project + accepted quote + selected partner lineage + start-payment evidence | Inherited Scope of Work approved; Statement of Work approved; mobilisation controls complete | Authorise execution |
| **G12 Partner execution released and commenced** | Project 360 / Execution Partner | OP releases governed execution to the approved partner; partner declares commencement | Project Execution Assignment + Partner Commencement Declaration | Execution assignment must link approved controlled scope | Project becomes In Progress |
| **G13 Governed execution** | Project 360 / Execution Partner | Partner works, reports progress/exceptions and submits delivery | Progress Updates, Execution Exceptions, Delivery Control Items, current-cycle Partner Delivery Submission **plus attached engineering output files** | Deliverables may link controlled documents; open exceptions, unresolved required delivery items or a file-less Partner submission block progression | Submit for Internal Review |
| **G14 Internal review and controlled client issue** | Project 360 | OP verifies current-cycle submission | Current-cycle Partner Delivery Submission review outcome + internal review evidence | Technical Review / Document Register as required; issued client package | Record client transmittal |
| **G15 Client review, completion and closure** | Project 360 | Client outcome recorded, closeout evidence complete, finance reconciled | Client Transmittal + Client Review Outcome + closeout audit | Completion Report / Handover evidence; issued Invoice where applicable | Close Project |

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
- Project creation requires written acceptance evidence.
- Project creation after acceptance does **not** mean the Project has started. The new Project enters the pre-start `Awaiting Payment` condition until G10 is satisfied.

### Project 360 — mandatory start-payment gate

- A Project may be created after written Client Quote acceptance so that invoicing, payment capture and mobilisation evidence have an authoritative Project context.
- The Project must remain operationally locked until the **required start payment** has been received/cleared.
- The required start payment is derived from the accepted commercial payment terms, not entered again during mobilisation.
- The payment terms may define a deposit, milestone payment, percentage or full upfront amount. The gate is satisfied only when cumulative qualifying client payments meet or exceed the required amount for commencement.
- For positive-value work, a zero-value or missing start-payment requirement is invalid unless an explicit authorised exception policy is later introduced.
- `Payment requested`, `invoice issued`, `payment promised` and `bank transfer pending` do **not** satisfy the gate. Evidence must represent money actually received/cleared according to the settlement rules.
- Once satisfied, the payment gate becomes compact read-only evidence such as `Start payment received · £X · date`; the payment-entry form does not remain in the normal Project workspace.
- If the gate is not satisfied, the canonical operating state is **Awaiting client payment**, with the Client as the waiting owner. This is a normal commercial dependency, not an execution issue.
- No Partner assignment/release session may be issued, no Partner commencement may be accepted, and no Project transition to `in_progress` may occur while the start-payment gate is unsatisfied.
- The lifecycle/readiness layer must enforce the same rule server-side; hiding the Release button in the UI is not sufficient.

### Project 360

- Project creation transfers the current approved `scope-of-work` from Case ownership to Project ownership and creates a draft `statement-of-work` shell.
- Execution Partner assignment must match the partner behind the accepted commercial review unless an explicit governed partner-change process is later introduced.
- Partner release requires both the satisfied start-payment gate and an approved controlled Scope of Work linked to the execution assignment.
- Partner Commencement Declaration is the event that moves a partner-executed project from `ready_for_execution` to `in_progress`.
- Progress Updates do not move Project stage.
- Open Execution Exceptions block progression.
- Delivery Control items participate in readiness whenever they exist; they are not a parallel decorative tracker.
- Partner Delivery Submissions are revision/cycle aware. A prior submission cannot satisfy a correction cycle.
- Every Partner Delivery Submission must attach at least one actual engineering output file in the private Partner Delivery store. A text manifest alone cannot satisfy the `In progress → Internal Review` gate.
- Submission metadata and its current-cycle engineering files are committed as one governed transaction and become immutable after submission.
- Internal Review acceptance applies only to the current execution cycle.
- Client issue requires a transmittal record identifying recipient, method, time and controlled package.
- Client Review requires an explicit outcome. `changes_requested` routes back through correction; accepted outcomes permit Completion.
- Closure requires no open execution exceptions, no unresolved delivery-control items/tasks, final issued closeout evidence, and no outstanding client receivables or partner payables.
- For a positive-value Project, closeout additionally requires client invoices whose recorded total covers the accepted Client Quote, an issued current controlled `invoice` document, and Execution Partner payables whose recorded total covers the accepted Partner cost with payable evidence confirmed. An empty or under-recorded finance ledger is not a valid closeout state.

## Operator presentation for the start-payment gate

The start-payment gate must follow the Operator Subtraction rules.

Before payment:

- Project 360 may exist, but its first viewport says **Awaiting client payment**.
- Show the required start amount, amount received and one relevant action such as **Record payment** or **Open Payments**.
- Do not show Partner release, execution assignment, Partner access or commencement controls as available work.
- Do not repeat the same payment requirement in Project 360, Commercial Control and Payments as three competing action forms. Payments owns settlement capture; Project 360 shows the gate state and links to it.

After payment:

- Replace the payment action with compact evidence: **Start payment received**.
- Unlock mobilisation/readiness automatically.
- The next operator action becomes the next genuine business step, normally **Release to Execution Partner** once the controlled execution basis is otherwise ready.

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

Any future change that alters lifecycle ownership, gate evidence, document requirements, partner/client authority, Project start conditions or Project stage transitions must update this constitution **in the same pull request** and demonstrate an end-to-end lifecycle test. Mid-sprint changes must not introduce a second path around a gate.
