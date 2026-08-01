# Overflow Partner — Product and Build Charter

## 1. Purpose

Overflow Partner is the new business entity and brand for the engineering overflow service originally designed and built within MIDTS.

This project is not a new product concept and is not a ground-up business-system build. It is the controlled extraction, rebranding and technical migration of the existing MIDTS engineering-overflow product into its own independent company, repository and operating platform.

The existing engineering-overflow frontend, Workspace, Document Engine and business logic remain the foundation of Overflow Partner.

The principal architectural change is the replacement of Google Apps Script, Google Sheets and Drive-led backend operations with Supabase.

---

## 2. Core Direction

Overflow Partner will:

1. inherit the existing engineering-overflow service already built in MIDTS;
2. preserve the current business workflow and operating logic wherever it remains relevant;
3. retain the existing frontend, protected Workspace and Document Engine as the starting product;
4. remove MIDTS branding and any modules that belong only to MIDTS's new business direction;
5. rebrand the extracted product as Overflow Partner;
6. replace the Apps Script backend with Supabase;
7. validate, polish and launch the separated product as an independent business platform.

The governing principle is:

> Same engineering-overflow product. Same core workflow. New business entity. New brand. New Supabase backend.

---

## 3. Relationship to MIDTS

MIDTS is moving in a different business direction.

The engineering-overflow service previously housed within MIDTS is being transferred into Overflow Partner. Overflow Partner therefore inherits the product work already completed for that service, including its commercial journey, operational Workspace and document-generation capability.

MIDTS and Overflow Partner must become independent products after separation.

Following migration:

- MIDTS may continue to evolve under its new business direction;
- Overflow Partner will own and operate the engineering-overflow proposition;
- future changes in one repository must not automatically alter the other;
- shared code may be extracted later only where doing so creates a clear maintenance benefit.

A shared monorepo or common package architecture is not a launch requirement.

---

## 4. Scope of Reuse

The following existing MIDTS assets should be copied into Overflow Partner and adapted rather than rebuilt.

### 4.1 Public Frontend

Retain:

- page and route structure;
- responsive layout;
- design system;
- reusable UI components;
- navigation patterns;
- enquiry and intake experience;
- SEO and metadata framework;
- accessibility foundations;
- launch-ready interaction patterns.

Change only what is required for:

- Overflow Partner branding;
- company identity;
- service positioning;
- legal and compliance copy;
- domain, contact and metadata details;
- removal of content linked solely to MIDTS's new direction.

### 4.2 Protected Workspace

Retain:

- Workspace shell;
- navigation;
- dashboards;
- queues;
- record views;
- status presentation;
- task and activity views;
- review and approval interfaces;
- quotation and project interfaces;
- user and access patterns;
- mobile and desktop behaviour.

The Workspace should continue to express the existing engineering-overflow lifecycle rather than being redesigned as a new operating model.

### 4.3 Document Engine

Retain:

- document registry;
- document templates;
- structured document data model;
- document viewer;
- review interface;
- generation workflow;
- versioning concepts;
- download/export behaviour;
- links between commercial and project records and their documents.

Update:

- branding;
- company identity;
- legal entity details;
- headers, footers and reference formats;
- any terminology that is MIDTS-specific rather than engineering-overflow-specific.

---

## 5. Business Logic

The existing engineering-overflow business logic is to be preserved as the baseline.

This includes the established journey from enquiry through technical intake, partner assessment, pricing, quotation, project creation, delivery and document control.

The migration must not introduce a new lifecycle merely because the backend is changing.

Existing logic should be reviewed only to:

- remove assumptions tied exclusively to MIDTS;
- align names and terminology with Overflow Partner;
- close known workflow gaps;
- improve data integrity;
- convert informal or Apps Script-dependent rules into explicit database and application rules;
- support Supabase authentication, permissions, storage and auditability.

The charter does not authorise an unnecessary redesign of the engineering-overflow service.

---

## 6. Target Technical Architecture

### 6.1 Application

The existing frontend and Workspace application remain the product foundation.

The preferred target is:

- Next.js application;
- TypeScript;
- existing component and styling system;
- server actions and/or route handlers for trusted operations;
- Supabase client use only where appropriate and protected by Row Level Security.

### 6.2 Supabase

Supabase replaces the existing Apps Script-led backend.

Use:

- Supabase Postgres for operational data;
- Supabase Auth for authentication and sessions;
- Supabase Storage for uploaded files and generated assets;
- Row Level Security for record-level access;
- database constraints for data integrity;
- database functions and triggers where server-side enforcement is required;
- audit and activity tables for traceability;
- scheduled jobs or Edge Functions only where the workflow genuinely requires them.

### 6.3 Components Being Retired

Overflow Partner must remove production dependency on:

- Google Apps Script web apps;
- Google Sheets as the primary operational database;
- Drive folders as the primary record model;
- Apps Script session and permission logic;
- Apps Script workflow orchestration;
- Apps Script document registry logic;
- Cloud Run gateway components that exist only to bridge the current Apps Script architecture.

Google services may still be used as normal business tools, but they must not remain the core application backend.

---

## 7. Indicative Supabase Domain Model

The final schema must reflect the existing product, but is expected to include entities such as:

- profiles;
- organisations;
- contacts;
- leads;
- technical_intakes;
- intake_files;
- partner_organisations;
- partner_assessments;
- partner_quote_requests;
- partner_quotes;
- commercial_reviews;
- client_quotes;
- quote_items;
- projects;
- project_partners;
- milestones;
- deliverables;
- documents;
- document_versions;
- approvals;
- change_requests;
- activity_events;
- notifications;
- tasks.

This list is a migration guide, not permission to invent parallel workflows that do not exist in the current engineering-overflow product.

---

## 8. Migration Principles

### 8.1 Preserve Before Improving

First reproduce the existing engineering-overflow capability in the new repository and backend. Improvements should be deliberate and separately identifiable.

### 8.2 No Cosmetic Clone Without Data Migration

The product is not considered migrated merely because the UI has been copied. Workspace actions, statuses, records, documents, permissions and storage must operate against Supabase.

### 8.3 No Ground-Up Rewrite

Do not rebuild working frontend, Workspace or Document Engine components without a demonstrated technical reason.

### 8.4 No MIDTS Coupling at Launch

Overflow Partner must not require the MIDTS repository, MIDTS deployment or MIDTS production backend to operate.

### 8.5 Controlled Terminology Change

Rename company and brand language while preserving engineering terms, workflow meanings and established commercial controls.

### 8.6 Evidence-Based Completion

A feature is complete only when it works in the running application with Supabase-backed data, permissions and storage where applicable.

---

## 9. Delivery Programme

### Phase 1 — Repository Foundation

- establish the Overflow Partner repository;
- copy the relevant MIDTS application foundation;
- preserve git history where practical or document the source commit used;
- remove unrelated MIDTS-only assets;
- establish environment and deployment configuration.

### Phase 2 — Brand Separation

- replace company name and visual identity;
- update public copy;
- update metadata and legal identity;
- update Workspace labels only where genuinely brand-specific;
- update Document Engine branding and references.

### Phase 3 — Supabase Foundation

- create the Supabase project;
- define schema and migrations;
- configure Auth;
- configure Storage;
- implement Row Level Security;
- establish seed data and local development workflow.

### Phase 4 — Backend Migration

- replace Apps Script API calls;
- replace Sheets persistence;
- migrate authentication and session handling;
- migrate uploads and file relationships;
- migrate activity, notifications and document records;
- preserve current workflow transitions and validation rules.

### Phase 5 — Document Engine Migration

- connect the existing Document Engine to Supabase records;
- preserve template behaviour;
- establish version and approval records;
- migrate file generation and storage;
- confirm secure document access.

### Phase 6 — Validation and UI Polish

Validate only after the migrated product is functionally wired.

The phase includes:

- public frontend review;
- Workspace navigation and state review;
- Document Engine generation and viewing review;
- responsive and accessibility checks;
- empty, loading, success and error states;
- permission and RLS checks;
- removal of dead MIDTS and Apps Script references;
- production build and CI validation;
- end-to-end proof of the engineering-overflow journey on Supabase.

---

## 10. Launch Definition

Overflow Partner is launch-ready when:

- the public frontend is fully rebranded and deployable;
- the protected Workspace operates independently of MIDTS;
- the existing engineering-overflow business journey is preserved;
- operational records are stored in Supabase;
- authentication is handled through Supabase Auth;
- files and documents are stored securely through Supabase Storage or an explicitly approved alternative;
- Row Level Security and application permissions are validated;
- the Document Engine generates and retrieves the required documents;
- Apps Script, Sheets and obsolete gateway dependencies are removed from the production path;
- production CI passes;
- the final validation and UI polish work is merged into `main`.

---

## 11. Out of Scope for Initial Launch

Unless required to preserve an already-working feature, the initial separation does not require:

- a new business lifecycle;
- a new design system;
- a full frontend redesign;
- a shared Verilogix monorepo;
- extraction of reusable npm packages;
- multi-tenant SaaS billing;
- native mobile applications;
- AI-led workflow redesign;
- rebuilding working document templates from zero;
- changing the engineering-overflow proposition.

These may be considered after launch through separate decisions.

---

## 12. Decision Authority

This charter is the governing implementation direction for the Overflow Partner repository.

Where code, old planning documents or inherited MIDTS assumptions conflict with this charter, this charter takes priority unless a later written decision explicitly supersedes it.

The default decision must remain:

> Extract and migrate the existing engineering-overflow product. Do not reinvent it.
