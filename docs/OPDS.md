# Overflow Partner Engineering Design System (OPDS)

## Purpose

OPDS is the single source of truth for Overflow Partner identity, interface, engineering documents and communications. It governs the public website, private Workspace, controlled documents, drawing packs, commercial output and future client-facing assets.

## Core principle

**Structure is black. Added capacity is red.**

The red extension is functional, not decorative. It represents Overflow Partner extending a client's existing engineering capacity without replacing it.

## Identity

- Primary name: Overflow Partner
- Symbol: two engineered horizontal structural lines; lower line extends beyond the system
- Extension colour: `#E64A35`
- Minimum clear space: one symbol-line height around every side
- Do not rotate, outline, gradient-fill or recolour the mark
- Do not use the red extension as a general decorative stripe

## Colour

| Token | Value | Use |
|---|---:|---|
| Ink | `#111815` | Primary text and structure |
| Black | `#050705` | High-contrast fields and public sections |
| Paper | `#F7F7F5` | Workspace background |
| Panel | `#FFFFFF` | Cards and documents |
| Technical | `#ECEFEB` | Technical surfaces |
| Line | `#D9D6CE` | Borders and control rules |
| Extension | `#E64A35` | Capacity extension only |
| Success | `#18794E` | Approved, accepted, completed |
| Warning | `#9A6700` | Review, clarification, pending approval |
| Danger | `#B42318` | Rejected, blocked, expired |
| Information | `#175CD3` | New, requested, submitted |

## Typography

- Primary: Aspekta when available; Arial/Helvetica system fallback
- References and controlled IDs: monospace
- Headings: compact tracking, restrained scale
- Body: direct, readable, no decorative styling
- Engineering notes: sentence case; no marketing superlatives

## Spacing and geometry

- Base spacing unit: 4px
- Controls: 6px radius maximum
- Panels: 8px radius maximum
- Documents and drawings: square geometry permitted and preferred
- No glassmorphism, gradients, pill-heavy UI or decorative shadows

## Motion

- Standard duration: 200ms
- Easing: `cubic-bezier(.2,.8,.2,1)`
- Use fade, opacity and short translation only
- No bounce, spring or theatrical page transitions
- Respect reduced-motion preferences

## Workflow language

The interface uses controlled operational verbs:

- Create intake
- Approve feasibility
- Request partner pricing
- Select partner quote
- Approve commercial position
- Issue client quote
- Accept quote
- Create project
- Issue document

Avoid vague verbs such as “process”, “handle” or “do next”.

## Reference standards

- Lead: `OP-LEAD-YYYY-NNNN`
- Quote: `OP-Q-YYYY-NNNN-RNN`
- Project: `OP-PRJ-YYYY-NNNN`
- Document: `OP-DOC-YYYY-NNNN`
- Drawing: `OP-DRG-YYYY-NNNN-RNN`

References are generated, never manually invented.

## Controlled documents

Every generated document must contain:

- Overflow Partner identity
- document reference
- revision
- status
- issue date
- linked project or lead reference
- approval/issue metadata
- page control where applicable

The document frame implemented in `components/opds` is the baseline for quotes, scopes, RFQs, partner assessments and project records.

## Engineering graphics

Preferred subjects:

- machined components
- datum structures
- section cuts
- tolerance callouts
- exploded assemblies
- tool paths
- fixture plates
- controlled drawing extracts

Do not use people-led stock photography, generic teamwork imagery or futuristic CAD renders without engineering meaning.

## Tone of voice

Direct, calm and technically credible.

Use:

> Engineering capacity when your internal team reaches its limit.

Avoid:

> Innovative world-class solutions that transform your business.

## Governance

Any new component, document template or visual pattern must:

1. use OPDS tokens;
2. preserve the red extension meaning;
3. minimise manual entry;
4. use controlled references;
5. support print and responsive use where relevant;
6. be added to the live `/workspace/opds` specimen page when reusable.
