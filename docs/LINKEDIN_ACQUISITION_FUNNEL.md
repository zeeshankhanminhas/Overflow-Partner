# LinkedIn acquisition funnel — separate from the OPOS commercial lifecycle

## Purpose
The existing 12-step operational code-path diagram starts with an entered enquiry. A cold LinkedIn prospect is **not yet an enquiry** and must not begin at the detailed requirements form.

The top-of-funnel is a separate **marketing/acquisition journey**:

1. **Identify** a target engineering company and relevant contact; create Company → Contact → Prospect in OPOS, with source `linkedin`.
2. **Outreach**: send a personalised connection/message manually in LinkedIn; record message sent and the next follow-up in the Prospect record.
3. **Conversation**: record replies and understand whether outsourced CAD, design, manufacturing or engineering support is relevant.
4. **Interest**: record the reply as `replied` + `interested`. This is only *marketing-qualified interest*, not the governed `qualified` Prospect status.
5. **Enquiry handoff**: send the secure technical requirements link from the existing Acquisition Prospect record, then continue governed Step 2 → Partner Review → Go / No-Go → Case 360.

Outcomes such as `later`, `no_response` and `paused` go to **Nurture**. Explicit disinterest / `not_a_fit` closes the pursuit. Follow-ups are handled from the same Prospect record; no competing contact database or shadow pipeline.

## Non-negotiable handoff controls
- Do **not** auto-email or auto-nurture an unsolicited LinkedIn prospect when the record is created.
- Do **not** send a secure requirements invitation for a LinkedIn-sourced prospect without a recorded interested reply.
- Every prospect stays attached to an organisation, company and contact; existing activity audit, row-level security and duplicate checks remain authoritative.
- A positive LinkedIn response **does not** bypass submitted requirements, governed partner assessment, internal Go / No-Go, canonical quotation, acceptance or verified pre-project financial release.
- No automatic LinkedIn sending, scraping, or campaigns are introduced here.
- The existing 11-stage commercial lifecycle remains authoritative: Opportunity → Requirements → Feasibility → Commercial Offer → Contractual Commitment → Mobilisation → Execution → Quality Assurance → Delivery → Payment Settlement → Closure.
- No database migration or live payment change is part of this addition.

## Acceptance checks
- A new LinkedIn prospect appears in **Identified** on the dedicated `/workspace/acquisition/funnel` dashboard.
- Recorded `message_sent` moves it into **Outreach**; a reply moves it to **Conversation** or **Interested**, according to outcome.
- `replied` + `interested` is required before a first requirements invitation. With no recorded interest the server action refuses the invitation.
- An invite creates existing intake evidence and moves the prospect into **Enquiry handoff**.
- Nurture and closed records do not count as active campaign work.
- Existing non-LinkedIn inbound enquiry, partner, Case 360, payment and Project 360 guards remain unchanged.
- No email is automatically sent solely by creating a LinkedIn prospect.

## Release status
Implementation is delivered on a feature branch for review; production migration, authenticated integration tests, real emails, campaign dispatch and manual browser testing are **not** implied by this document.
