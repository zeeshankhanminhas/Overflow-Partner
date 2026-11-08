# OPOS Engineering Demonstration Pack — Technical Acceptance Standard

Reference reading (background, not a substitute for standards): https://draftaid.io/blog/engineering-drawings/ (DraftAid, engineering drawings guide).

## Purpose and publication gate
The public website will not present placeholder illustrations, generic geometric blocks, or unreviewed models as evidence of engineering capability. These demonstration projects must be original, fictional engineering studies and must receive a signed technical review before publication. Never imply prior customer work or claim certified manufacture-ready design without validation.

## Default drawing conventions — confirm per project
- UK-oriented ISO drawing framework, SI metric dimensions (mm), first-angle projection symbol as appropriate; do not mix ASME third-angle convention unless the entire controlled set is intentionally adapted.
- Confirm applicable editions and standards (e.g., ISO 128 technical representation, ISO 129-1 dimension indication, ISO 1101 geometrical tolerancing, ISO 5455 scales, ISO 5457 drawing sheets, ISO 7200 title blocks, ISO 2768 only where justified). These are candidate references, not a claim of compliance.
- Drawing sheet size (A3/A2 as appropriate), stated scale, units and projection method.
- Clear line hierarchy, appropriate centerlines, hidden lines, cutting planes, hatching, and detail/section views.
- Functional dimensions prioritized; avoid redundant chains, duplicate dimensions and dimensions that cannot be inspected.
- Fit/tolerance calls must follow verified mechanical function and process capability, not arbitrary guessed specifications.
- Material, finish, thread, weld (if relevant), heat-treatment and inspection requirements must be traceable to the design brief and engineering review.

## Mandatory technical deliverables per demonstration
1. Design brief: intended operation, engineering constraints, loads, interfaces, assumptions, exclusions and safety boundaries.
2. Parametric CAD model and inspection-ready STEP neutral exchange with matching revisions and consistent units.
3. Assembly drawing: front/top/side or required orthographic views, useful isometric/exploded view, correct section and detail views, part balloons and an internally consistent BOM.
4. Detailed part drawings: dimensions needed for fabrication/inspection, datum scheme when relevant, verified tolerances, material specifications, surface finish, drawing title block and revision table.
5. Manufacturing-specific drawings only where appropriate: machining drawing, flat pattern/bend drawing for sheet metal, weld symbols for fabricated joints, or installation interface drawing.
6. BOM: stable part numbers, sensible descriptions, quantities, sourcing designation for purchased components, declared material/standard where applicable; all balloons match BOM.
7. Engineering verification log: solids validity, assembly fits/interference, loads/deflection or clamping force (where relevant), fastener and bearing selection, fit/tolerance stack-up, manufacturability and safety concerns.
8. Controlled issue package: document register, revision history, drawing approval state, issues/assumptions list, clear final handover manifest.

## Reviewer decision
- `REVISION REQUIRED`: missing or contradictory critical information; not public.
- `TECHNICALLY REVIEWED FOR DEMONSTRATION`: coherent and accurately labeled as an original demonstration; allowed to publish a sanitized subset.
- `RELEASED FOR MANUFACTURE`: only if the specifically required verification, manufacturing constraints and qualified authorization have actually been completed; not assumed from demonstration sign-off.

## Project-specific acceptance checks
### OP-DEMO-001 — Clamping and indexing fixture
Develop a defined use case and workpiece interface first. Specify motion, indexing/locking, clamping forces, cylinder and guide selection, fastening, datum features, tolerances, operator safety and motion clearances. Geometry and BOM must agree.

### OP-DEMO-002 — Adjustable roller support
Define loads, span, mounting envelope, adjustable feature, bearing arrangement, shaft seats, rotating and fixed interfaces, fasteners, sealing, roller concentricity/runout, load path and maintenance needs. Geometry and drawing BOM must agree.

## Publication rules
- No unreviewed CAD file download, pseudo-manufacturing drawing or generic placeholder assembly on public marketing pages.
- Public preview should contain *only* technically reviewed and specifically approved sanitized extracts of the work.
- Do not reuse DraftAid's illustrations, screenshots or text verbatim without rights. The page is guidance to inform original engineering documentation.
