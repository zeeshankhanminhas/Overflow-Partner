# Overflow Partner — Project Charter

**Status:** Initiated  
**Repository:** `Overflow-Partner`  
**Reference implementation:** `midts-backend`  
**Initial source of truth:** This repository and its version-controlled documentation

## 1. Purpose

Overflow Partner will provide the partner-facing operating layer for Engineering Overflow. It will control how external engineering partners receive approved work packages, complete technical assessments, submit pricing, exchange controlled documents, and progress assigned work without gaining access to confidential client, margin, or internal commercial information.

The project is initiated as a clean application rather than a direct copy of the legacy MIDTS Apps Script and Google Sheets implementation.

## 2. Reference Architecture

`midts-backend` is the functional and lifecycle reference. Its strongest principles will be retained:

- one controlled commercial and technical lifecycle;
- explicit gates between qualification, partner assessment, pricing, quotation, project creation, delivery, and invoicing;
- partner pricing blocked until a feasible and pricing-ready technical assessment exists;
- immutable document and commercial snapshots;
- auditable workflow transitions, email attempts, approvals, and document revisions;
- Google Drive folderisation aligned to the lifecycle;
- internal commercial controls separated from public and partner-facing actions.

Overflow Partner will not inherit the MIDTS storage limitations. Google Sheets and Apps Script are not the target database or workflow engine.

## 3. Product Boundary

Overflow Partner is responsible for the external partner experience and partner-controlled transactions.

### In scope

- secure partner invitation and access;
- partner organisation and user profiles;
- assigned opportunity and project views;
- controlled Vendor Safe Package access;
- Partner Technical Assessment submission;
- feasibility, assumptions, risks, clarifications, evidence, and pricing-readiness capture;
- vendor quotation and pricing revision submission;
- assignment acceptance or decline;
- delivery milestone updates;
- controlled file exchange through Google Drive;
- React PDF generation for partner-facing and internal-controlled records;
- approval requests and decisions associated with partner submissions;
- Gmail-based transactional communication;
- complete workflow and audit history.

### Out of scope for initiation

- unrestricted access to client-identifying source files;
- visibility of internal margin, markup, client price, or commercial strategy;
- direct editing of internal Engineering Overflow records;
- marketing campaigns and bulk email;
- replacement of Google Drive folderisation;
- importing messy legacy Sheet tables as the new data model.

## 4. Target Stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Application | Next.js and TypeScript | Partner portal, protected pages, API routes, and server actions |
| Database | Supabase PostgreSQL | Structured operational data and source of truth |
| Authentication | Supabase Auth | Partner identity, sessions, and access control |
| Authorisation | Supabase RLS and server-side policies | Organisation, assignment, document, and action boundaries |
| PDF generation | `@react-pdf/renderer` | Controlled assessments, quotations, acknowledgements, and reports |
| File repository | Google Drive | Existing folder hierarchy, engineering files, evidence, and generated PDFs |
| Email | Gmail API | Transactional partner and internal emails |
| Hosting | Vercel | Application deployment |
| Source control | GitHub | Code, migrations, decisions, and documentation |

## 5. System Responsibilities

### Supabase owns

- partner organisations and users;
- invitations and memberships;
- work assignments;
- technical assessments;
- pricing revisions;
- approval requests and decisions;
- workflow states and transitions;
- document metadata and immutable snapshots;
- Google Drive resource mappings;
- email jobs and email audit events;
- application audit events.

### Google Drive owns

- approved partner-safe packages;
- drawings and technical reference files;
- partner evidence and attachments;
- generated assessment PDFs;
- generated pricing and delivery documents;
- project deliverables and handover records;
- revision-organised folders and files.

### Gmail owns

- delivery of transactional messages;
- normal mailbox replies and threads;
- sent-message history.

Supabase remains the operational audit source even when Gmail sends the message and Google Drive stores the file.

## 6. Core Lifecycle

The initial controlled sequence is:

```text
Partner Invited
-> Partner Access Activated
-> Work Package Assigned
-> Vendor Safe Package Available
-> Assignment Accepted
-> Technical Assessment In Progress
-> Technical Assessment Submitted
-> Internal Assessment Review
-> Feasible and Pricing Ready
-> Pricing Requested
-> Pricing Revision Submitted
-> Internal Pricing Review
-> Assignment Confirmed
-> Delivery In Progress
-> Delivery Submitted
-> Internal Delivery Review
-> Handover Complete
```

Alternate controlled outcomes include:

```text
Assignment Declined
More Information Required
Not Feasible
Feasible with Assumptions
Pricing Returned for Revision
Delivery Returned for Correction
Assignment Cancelled
```

No page or client-side component may update lifecycle state directly. All transitions must pass through a central workflow service that validates the current state, actor, permissions, required evidence, and target state.

## 7. Security and Information Separation

The partner portal must enforce the following boundaries:

- a partner sees only records assigned to its organisation;
- partner users cannot read internal comments unless explicitly released;
- partner users cannot access client price, margin, markup, or internal approval notes;
- partner users receive only approved partner-safe files;
- Drive links are never treated as authorisation by themselves;
- all protected reads and writes are checked server-side;
- public or tokenised actions use scoped, expiring, revocable tokens;
- sensitive credentials remain server-side;
- every material read, download, submission, decision, and issue action is auditable.

## 8. Approval Model

Approvals are first-class records and always apply to a specific revision or immutable snapshot.

Initial approval types:

- partner onboarding approval;
- Vendor Safe Package release approval;
- technical assessment acceptance;
- pricing revision acceptance;
- assignment confirmation;
- delivery acceptance;
- handover acceptance.

When an approved record changes, a new revision is created and the previous approval does not authorise the new revision.

## 9. Document Model

Web views and PDF components will consume the same typed document-data contracts.

Initial PDF outputs:

- Partner Technical Assessment Report;
- partner pricing submission record;
- assignment confirmation;
- delivery submission record;
- completion or handover acknowledgement.

Generation sequence:

```text
Supabase records
-> typed document mapper
-> immutable JSON snapshot
-> React PDF renderer
-> PDF buffer
-> Google Drive upload
-> Drive file ID and revision stored in Supabase
-> approval or issue event recorded
```

PDF components must not query Supabase directly.

## 10. Drive Folderisation

Existing Engineering Overflow and MIDTS folder-control concepts will be preserved. Supabase will store Drive IDs and relationships; it will not recreate folders unnecessarily.

Indicative structure:

```text
Engineering Overflow
└── Partners
    └── <Partner Organisation>
        ├── 01 Onboarding
        ├── 02 Assessments
        ├── 03 Pricing
        └── 04 Active Assignments

Clients
└── <Client>
    └── Lead_<reference>
        ├── Client Intake Files
        ├── Vendor Safe
        │   └── VSP-<revision>
        ├── Partner Assessments
        ├── Pricing
        └── Project
            ├── Working Files
            ├── Deliverables
            ├── Completion
            └── Handover
```

Drive resource IDs, not only URLs, must be stored in Supabase.

## 11. Initial Data Model

The first schema should remain focused:

```text
profiles
partner_organisations
partner_memberships
partner_invitations
work_assignments
vendor_safe_packages
technical_assessments
assessment_revisions
pricing_requests
pricing_revisions
approval_requests
approval_decisions
documents
document_revisions
drive_resources
email_jobs
email_events
workflow_events
audit_events
external_action_tokens
```

Legacy Sheet structures must not dictate this schema. Valuable active records may later pass through a staging and validation process.

## 12. Initiation Slice

The first end-to-end vertical slice will prove:

```text
Internal user creates partner invitation
-> partner activates access
-> internal user assigns one approved Vendor Safe Package
-> partner accepts the assignment
-> partner submits a technical assessment with evidence
-> React PDF generates the assessment report
-> PDF uploads into the correct Google Drive folder
-> internal reviewer approves or returns the assessment
-> Gmail sends the resulting notification
-> Supabase records the complete audit trail
```

This slice must work before pricing, delivery, and broader portal capabilities are added.

## 13. Definition of Done — Initiation Slice

The initiation slice is complete when:

- partner authentication and organisation membership work;
- RLS prevents cross-partner data access;
- an internal user can issue an assignment;
- the partner can access only the approved package and assigned record;
- technical assessment submission validates required fields and evidence;
- a revision-specific immutable snapshot is created;
- `@react-pdf/renderer` produces the assessment PDF;
- the PDF is uploaded to the correct existing or newly created Drive folder;
- Supabase stores the Drive file ID and document revision;
- an internal approval can approve or return the submission;
- Gmail sends the correct transactional message;
- workflow, approval, document, Drive, and email events are auditable;
- no Apps Script or Google Sheet is required for the completed path.

## 14. Engineering Principles

1. **Workflow before screens.** Pages expose controlled transactions; they do not define business rules.
2. **One authoritative state.** Do not duplicate full lifecycle status across unrelated tables.
3. **Snapshots before issue.** Approved and issued outputs must be reproducible.
4. **Revision-aware approvals.** Changes after approval require a new decision.
5. **Drive for files, Supabase for truth.** Folder hierarchy is preserved without using Drive as the database.
6. **Server-side trust boundary.** Credentials and privileged operations never run in the browser.
7. **Partner-safe by design.** Client confidentiality and internal commercial data remain separated.
8. **Incremental delivery.** Build and prove one complete vertical slice at a time.
9. **GitHub is the source of truth.** Architecture, migrations, decisions, and implementation remain version controlled.

## 15. Immediate Next Actions

1. Initialise the Next.js and TypeScript application.
2. Create the Supabase project and migration structure.
3. Define authentication roles, partner membership, and RLS policies.
4. Implement the initial schema listed in this charter.
5. Add Google Drive and Gmail server-side integration modules.
6. Build the invitation-to-assessment vertical slice.
7. Implement the first React PDF document: Partner Technical Assessment Report.
8. Add automated tests for permission boundaries and lifecycle transitions.
9. Record architectural decisions in `docs/decisions/` as the system evolves.

## 16. Charter Authority

This charter establishes the initial product boundary and architecture for Overflow Partner. Material changes to security boundaries, workflow gates, storage ownership, or approval semantics should be recorded through a version-controlled architectural decision before implementation.
