# OP-DEMO-001 — D04 Mechanical Redesign Execution Brief

Status: PROPOSED DESIGN BASIS — internal development only. NOT approved for manufacture, client reliance, or public technical sign-off.
Repository scope: `feature/engineering-demonstrations-preview-2026-11-12`. No changes to production/main without explicit approval.

## 1. Why the existing D02/D03 are insufficient

This engineering workstream takes precedence over further website cosmetics. Audit of existing source:
- D02 provides 22 geometric solids and illustrative open/closed configurations. Its opposing brake pads contact the **rotor rim**, not an external workpiece. The title "clamping fixture" is misleading without a separate workpiece-clamping architecture.
- D02 cylinder and bearing models are envelopes, not vendor-verified selections or physically validated actuation interfaces; five sampled zero-overlap checks are not proof of useful brake contact or motion safety.
- D03 provides an eight-solid keyed spindle/bearing/retention interface study only. It is **not a complete fixture** nor a finished replacement for D02.
- In D03, a nominal 8.5 mm spindle pilot is labelled as an M8 tapped pilot. For an M8 x 1.25 coarse thread a typical tap drill is 6.8 mm; 8.5 mm is closer to a clearance hole. Verify threaded-hole intent, pilot size, thread engagement, screw retention and material assumptions before revision.
- Do not recycle preliminary PDF line art as released drawings. No GD&T, fits, critical load paths or independent engineering approval has been demonstrated.

## 2. Proposed functional design architecture (to be refined by requirement study)

Purpose: **light-duty four-station rotary inspection/assembly workholding fixture** (not machining/cutting). This limits unverified cutting forces and makes the concept mechanically coherent.

Functional sequence: workpiece placed and located; workpiece jaws close using a defined pneumatic actuator system; workpiece operations performed only while index lock engaged; jaws retract, index lock released, rotary table indexed by 90 degrees with position verification, lock reengages, jaws close. Operating modes / hazard controls require engineering definition; nothing here is a validated sequence or safe control design.

Initial inherited geometry references — concept targets, not released dimensions:
- Base envelope: 320 x 240 x 18 mm.
- Rotary plate: nominal diameter 160 mm, four stations at 90 degrees; nominal 120 mm pitch circle for preliminary indexing positions.
- Central spindle: nominal diameter 25 mm.
- Existing indicative bearing envelopes: 25 x 47 x 12 mm; actual manufacturer part number, fit and load rating must be selected.
- Air supply illustration: 6 bar gauge; bore 25 mm / stroke 10 mm from D02 are **not accepted actuator selections**.
- Clamp force, workpiece mass, accuracy, duty cycle, environment, safety risk assessment and loads remain **TBD** until design brief is substantiated.

## 3. D04 engineering modules and objective acceptance tests

### A — Functional requirements + load cases
- Produce a one-page requirement matrix with numbered IDs, acceptance criteria, assumption source, open items and verification methods.
- Define demonstrator workpiece geometry and credible light-duty maximum mass and applied loads; no fabricated customer requirements.
- Separate **index-lock** mechanism from **workpiece clamp** force path; show a labeled functional schematic.

### B — Real component architecture + parametric CAD
- Models: base/mounting arrangement, spindle/bearing housing and retention, rotary table and index engagement, workpiece locating and clamping mechanism, brackets/guide slides, purchased actuation, connections, fasteners, stops and service clearance.
- Vendor-supported components: select traceable actual bearings, cylinders, end fittings and fasteners from manufacturer catalogues; preserve manufacturer data sheet references and dimensional fit requirements.
- Export named, discrete solid parts, assembly STEP, parameter file and BOM keyed to part numbers.
- No meaningless visual-only cylinder envelopes passed off as working connections.

### C — Kinematics, collisions and mechanics
- Define joint degrees of freedom and operating states: unlock, index, locked, clamp-open, clamp-closed.
- Calculate/simulate swept volumes; assess mating contacts and clearances over full stroke and full index rotation, including fasteners, seals and brackets.
- Quantify cylinder extension/retraction force (rod-area effects), jaw force transmission, pin shear/bearing, shaft bending/torsion, bearing loads/life where relevant, key connection or replacement shaft-hub retention, fastener force and basic stiffness.
- Record safety margins with documented assumed loads; an automated intersection check alone is **not** functional validation.

### D — Model-derived engineering drawings
- Generate A3/A2 views by projecting CAD geometry (orthographic, section, detail and assembly views); **never** draw the manufacturing shape freehand in SVG and describe it as CAD-derived.
- Add material, finish, production process, dimensions, controlled datum scheme and verified fit/tolerance specifications for functional interfaces.
- Apply appropriate ISO 1101 geometric specification and ISO 5459 datums where justified. No decorative GD&T.
- Assign drawing numbers, BOM balloon IDs, revision D04, change history, review/status marks, date and release restriction.
- A dimension must be traceable back to the parametric model and verified after geometry changes.

### E — Engineering review and portfolio production
- Perform internal mechanical QA including design risk/verification matrix and open nonconformities.
- Seek independent mechanical engineer review before any manufacturing approval claim; explicitly distinguish review of concept from validation testing.
- Export high-resolution isometric and exploded render, genuine open vs closed operation, one sectioned CAD image, 2–4 preview drawing sheets, BOM and an optimized GLB view.
- Stage assets in the existing **draft** PR #135, noindex; no homepage links, no sitemap entry, no merge without explicit approval.
- Case-study copy reports verified evidence and design limitations without falsely attributing customer work.

## 4. Required files and exit gates

Working artifacts (D04):
- `Source/build_d04.py` (parametric CAD, deterministic).
- `Requirements/D04_design_basis.md` and `Requirements/D04_requirements_matrix.csv`.
- `CAD/individual_parts/*.step`, `CAD/assembly/OP-DEMO-001-D04.step`.
- `BOM/D04_BOM.csv`, including vendor part numbers for purchased items.
- `Calculations/D04_calculation_report.*`, with assumptions, units and inputs.
- `Validation/D04_motion_clearance.json` and `Validation/D04_mechanical_review.md`.
- `Drawings/D04_GA.pdf`, `D04_section.pdf`, `D04_components.pdf` (preliminary/review state).
- `Portfolio/*.webp` and optimized `Portfolio/*.glb`.

Mechanical advancement requires: explicit functional architecture, valid/reimportable CAD, separate workpiece clamp, physical connections, audited component selections, quantified calculated cases, documented unresolved risks.

Publication advancement requires: no misleading CAD screenshots/labels, a complete inspected visual gallery, noindex preview QA, and reviewer approval of the narrative. Manufacturing-approved claims require independent competent verification.

## 5. Toolchain and safeguards

- Parametric CAD: CadQuery + OpenCascade (available in execution environment). Generate STEP from actual solids.
- Render/mesh: OpenCascade/VTP or meshing into GLB from actual STEP; no synthetic illustrative assembly substitutions.
- Drawing: FreeCAD TechDraw when available, or another actual CAD projection pipeline with linked dimensional verification (do not invent annotations).
- Portfolio: Next.js existing case study route with image asset optimization and optional static GLB viewer.
- Current D02/D03 packages are historical inputs for audit/traceability, not a complete D04 engineering release.

**Decision gate:** D04 remains DEVELOPMENT until requirements and physical design are verified. Do not update product website to say "professional validated mechanical design" merely because these artifact filenames exist.
