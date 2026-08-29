# Five Product Capabilities

This pass closes the five highest-value product-design gaps identified from live operator use.

## 1. Project Delivery work objects
Project delivery is organised around deliverables, milestones and dependencies. Each object carries owner, due date, status, review state and next action. Inspect/update happens in context before full-page navigation.

## 2. Universal business Activity
Activity is presented as a dated business timeline. Raw event names are translated before display. The same component is available to internal object surfaces and the Delivery Partner surface.

## 3. Universal Inspect Drawer
Use ObjectInspectDrawer when an operator needs context or a bounded edit without losing their current list/project position. Full-page navigation remains available for deeper work.

## 4. Universal Object Header
ObjectHeader is the identity contract for work objects: reference, title, status, owner/context facts, due date and contextual actions. It should replace page-specific hero/dashboard headers as object surfaces are touched.

## 5. Delivery Partner workspace
The external task surface intentionally exposes only: work basis, current responsibility, progress, issues, completed-work submission and activity. Backend execution terminology and payloads remain internal implementation details.

## Guardrails
- no schema duplication to support UI composition
- drawers do not create alternate sources of truth
- technical event names stay behind presentation language
- dense comparison jobs remain registers/tables
- a project should be operable primarily from its project/delivery context
