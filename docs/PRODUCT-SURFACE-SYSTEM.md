# Overflow Partner Product Surface System

Overflow Partner uses exactly four reusable page surface types.

## 1. Dashboard surface
Use for Mission Control only.

Answers: What needs attention now?

Primary inspiration: Linear + Stripe.
Borrow: calm hierarchy, compact navigation, priority-first information, contextual actions.
Avoid: developer-tool feel, giant KPI walls, overly sparse screens.

## 2. Record surface
Use for Case 360 and Project 360.

Answers: What is happening with this record, who owns the next move, what evidence exists, and what can I do?

Primary inspiration: Linear + simplified HubSpot for Case 360; Linear + Procore for Project 360.
Avoid: CRM property clutter, construction terminology, gantt-heavy UI.

## 3. Register surface
Use for Projects, Opportunities, Documents, Quotes, Payments and similar collections.

Answers: What records exist, what state are they in, and which one needs action?

Primary inspiration depends on domain: HubSpot simplified for opportunities; Autodesk + Procore for documents; Stripe + Ramp for commercials.
Avoid: separate visual systems per register.

## 4. Decision surface
Use for Approvals, commercial reviews, document reviews and other bounded authority decisions.

Answers: What am I deciding, what evidence supports it, what is the consequence, and what actions are permitted?

Primary inspiration: Ramp + Rippling, with Autodesk patterns for document review.
Avoid: visual workflow builders on everyday operating screens.

## Interaction components are not surfaces
Drawers, dialogs, windows, forms, notifications, activity panels and inspectors are shared interaction components. They must inherit the current surface language and must never introduce a fifth page type.

## Implementation rule
Every new operating page must declare one of: `dashboard`, `record`, `register`, `decision` before page-specific JSX or CSS is added.

Canonical CSS: `app/workspace/product-surfaces.css`
Canonical wrapper: `components/workspace/ProductSurface.tsx`
