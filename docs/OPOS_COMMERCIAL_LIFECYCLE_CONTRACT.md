# Overflow Partner OS — Authoritative commercial lifecycle

Status: implementation contract on development branch. **Not yet an end-to-end released workflow.**

## Nine stages, one case spine

| Stage | Required exit event | Operator ownership |
| --- | --- | --- |
| 1. Opportunity & qualification | Qualified client and opportunity | Commercial |
| 2. Requirements & technical definition | Approved client requirements and scoped deliverables | OP |
| 3. Partner feasibility & costing | Approved formal partner assessment, capacity, risk and cost | Execution Partner evidence + OP approval |
| 4. Commercial review & quotation | Controlled current quotation with price, terms and expiry | OP |
| 5. Client acceptance & release | Named authorised acceptance plus verified contractual release condition | Client + OP finance |
| 6. Project/SOW/mobilisation | Exactly one project, approved SOW, partner commitment | OP + Execution Partner |
| 7. Execution, progress & quality controls | Partner submission and evidence complete | Execution Partner |
| 8. OP verification & client delivery | OP-controlled release, secure transmittal, client decision | OP + Client |
| 9. Settlement & closeout | Client receivables, partner payables, disputes and obligations reconciled | OP |

### Four policies

1. **Proportionate governance.** All work takes the same nine-stage route. Choose standard or enhanced depth according to complexity, delivery risk, regulated/safety-critical status and a configurable value threshold. Cost alone cannot reduce a high-risk job to standard. Formal commercial gates always apply. The initial £5,000 threshold in code is an implementation default, **not an approved commercial policy**; set a policy threshold before production activation.
2. **Two distinct partner interactions.** Preliminary partner consultation may clarify feasibility and scope, without permission to issue a commercial offer. Formal partner assessment must provide reviewed capacity, constraints and cost evidence before a binding quotation.
3. **Contractual payment release.** Named secure acceptance is necessary but not sufficient for project creation. Full advance, verified deposit, approved PO, approved credit or explicit no-advance terms may be the issue-specific release condition. The condition must be captured in the accepted quotation and evidenced before release. Bank transfers require reconciliation, not merely an uploaded receipt.
4. **Controlled exceptions.** Clarification, scope revision, re-quotation, change order, delay, partner failure, dispute, cancellation and refund are versioned/traceable transitions, not ad-hoc status edits.

### Cross-cutting invariants

- Never start execution solely because a client clicks Accept.
- Never treat a draft controlled document as an approved one.
- Partner assessment is not required *before* technical definition; preliminary consultation is optional in that stage.
- Formal partner evidence is required before commercial authority.
- Only current quote revision with explicit expiry and terms can be accepted.
- A settled event may create one project **once**, even if Stripe webhooks are retried.
- Trigger client-facing communications on authoritative transitions, with idempotency and no duplicate blast.
- Partner mobilisation authority and OP release authority are separate.
- The UI, server action and database must use equivalent guards; the backend remains authoritative.

### Release verification required

- Unit tests for governance classification, consultation vs assessment, and all release conditions.
- One clean QA case through partner review, quote, acceptance, Stripe Sandbox settlement, exactly-once project.
- Duplicate and out-of-order webhook tests; cancelled/failed checkout.
- Bank-transfer and PO exception paths, with explicit authorisation.
- Email idempotency and document revision/expiry tests.
- Full partner delivery, QA, client acceptance, final invoicing and closure tests.
- No live Stripe activation or shared-database test payment without explicit approval.
