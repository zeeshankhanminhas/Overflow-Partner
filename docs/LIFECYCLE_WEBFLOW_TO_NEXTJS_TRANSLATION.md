# Lifecycle Webflow → Overflow Partner Next.js Translation Specification

## Purpose

Use the public Lifecycle Consulting Webflow template as a visual and structural reference for the Overflow Partner public website while preserving the existing Overflow Partner application architecture, business lifecycle, Workspace, Document Engine, Supabase rules, and operational logic.

This is a presentation-layer translation, not a product rewrite.

The reference site is:

- https://lifecycle-consulting-webflow-template.webflow.io/
- https://lifecycle-consulting-webflow-template.webflow.io/template/style-guide

## Non-negotiable guardrails

1. Do not copy Lifecycle branding, copy, imagery, logos, or proprietary assets.
2. Do not import Webflow-generated HTML, class names, scripts, or framework assumptions.
3. Do not change the existing engineering-overflow business lifecycle.
4. Do not alter Case 360, Project 360, document transitions, Supabase policies, approval rules, or workspace permissions as part of this visual exercise.
5. Do not replace working backend or operational components merely to match the reference.
6. Public website changes must remain compatible with the current Next.js App Router codebase.
7. The public site and protected application may share tokens and brand language, but the Workspace must remain an operator product rather than being styled as an editorial marketing site.

## Reference qualities to translate

The Lifecycle template should be read as a design grammar rather than a page to clone.

### 1. Editorial hierarchy

Translate:

- large, confident display typography;
- short eyebrow labels;
- clear separation between headline, supporting copy, and action;
- generous negative space;
- strong section-to-section rhythm;
- concise content blocks rather than dense marketing paragraphs.

Avoid:

- generic SaaS dashboard styling on the public website;
- glassmorphism;
- decorative gradients;
- excessive card chrome;
- unnecessary pills and shadows;
- oversized H1 text that overwhelms the page on smaller laptops.

### 2. Layout system

Translate:

- wide editorial containers;
- asymmetric two-column compositions;
- alternating image/content sections;
- strong full-width visual moments;
- deliberate whitespace between major sections;
- content grids that feel architectural rather than template-like.

Use a responsive composition system rather than a desktop layout that simply stacks on mobile.

### 3. Navigation

Reference behaviour:

- restrained global navigation;
- strong visual brand anchor;
- clear primary CTA;
- minimal interaction chrome.

Overflow Partner adaptation:

- keep `Workspace` access visible but secondary;
- keep `Submit Requirement` as the primary public CTA;
- keep public navigation focused on service understanding, process, proof, and contact;
- avoid crowding the header with internal application concepts.

### 4. Proof-led storytelling

Lifecycle uses visual and textual proof sections instead of relying only on generic feature cards.

Overflow Partner should translate this into engineering evidence:

- production-ready drawing excerpts;
- controlled drawing packs;
- redacted technical markups;
- revision tables;
- sample deliverable structures;
- CAD/CAM capability evidence;
- technical intake snapshots;
- process artefacts;
- anonymised project proof.

No generic CAD stock photography and no people-led imagery are required.

## Current Overflow Partner homepage

The current homepage component sequence is:

1. Header
2. Hero
3. Problem
4. Services
5. ProofOfWork
6. Proof
7. FAQ
8. CTA
9. Footer

The redesign should preserve the componentised Next.js approach while changing composition and visual language.

## Proposed homepage composition

### Section 01 — Header

Component: `components/Header.tsx`

Keep:

- sticky behaviour;
- mobile menu;
- Workspace link;
- Submit Requirement CTA;
- current logo asset.

Change:

- reduce visual heaviness;
- use cleaner spacing and calmer typography;
- favour editorial navigation proportions over SaaS-style header treatment;
- remove unnecessary shadow dependence;
- use border/state changes on scroll only where useful.

### Section 02 — Hero

Component: `components/Hero.tsx`

Current hero is centred and compact.

Translate toward a Lifecycle-style editorial hero:

- left-weighted headline on desktop;
- supporting copy in a narrower text measure;
- primary CTA plus quieter secondary pathway;
- larger empty-space field;
- one technical proof artefact or engineered visual composition rather than decorative imagery;
- retain the idea of capacity constraints and delivery pressure, but express it more confidently and with less explanatory density.

Recommended content hierarchy:

- Eyebrow: `Overflow engineering partner`
- H1: outcome-led engineering-capacity statement
- Lead: concise description of how Overflow Partner extends internal engineering capacity
- Primary CTA: `Submit Requirement`
- Secondary CTA: `How We Work`
- Technical proof zone: real or representative controlled engineering artefact

### Section 03 — Capacity problem / context

Current component: `Problem.tsx`

Reframe as a large editorial context section rather than a conventional problem-card block.

Possible narrative:

- internal teams hit peaks;
- deadlines do not move;
- recruitment is slow;
- uncontrolled outsourcing creates risk;
- Overflow Partner adds governed capacity without replacing the client's engineering function.

Use oversized statement typography paired with a concise evidence panel.

### Section 04 — Engineering proof strip

Introduce a proof-led band inspired by Lifecycle's credibility moments.

Possible evidence items:

- controlled drawing issue;
- revision discipline;
- CAD/CAM capacity;
- reverse engineering;
- production drawings;
- partner-controlled delivery.

This section must feel like evidence, not a logo carousel with invented client logos.

### Section 05 — Services

Current component: `Services.tsx`

Translate Lifecycle's service presentation into a restrained editorial service index.

Recommended service groups:

- CAD overflow support
- CAM / manufacturing support
- reverse engineering
- production drawings
- drawing updates and revisions
- technical documentation support

Interaction can use hover/active states, but avoid accordion gimmicks unless they materially improve scanning.

### Section 06 — How the overflow model works

Use Lifecycle's process storytelling as inspiration.

Public process should explain only the client-facing journey, for example:

1. Submit requirement
2. Technical intake
3. Scope and commercial review
4. Quote approval / payment gate
5. Controlled project delivery
6. Review and issue
7. Closeout

Do not expose internal partner-pricing orchestration or workspace-only statuses.

### Section 07 — Proof of work

Current component: `ProofOfWork.tsx`

This should become one of the strongest visual sections on the site.

Use an editorial project/case-study presentation inspired by Lifecycle customer stories, but adapted to engineering evidence.

Each proof item should communicate:

- challenge;
- scope;
- artefact;
- delivery control;
- result;
- discipline / software / output type where useful.

Prefer real redacted artefacts over decorative illustrations.

### Section 08 — Why Overflow Partner

Current component: `Proof.tsx` may be adapted.

Focus on differentiators:

- capacity extension, not replacement;
- UK-facing commercial control;
- structured intake;
- governed delivery;
- documented revisions;
- controlled partner execution;
- clear ownership of client communication;
- protected technical and commercial information.

Use a strong editorial split layout rather than six equal icon cards.

### Section 09 — FAQ

Current component: `FAQ.tsx`

Keep FAQ, but visually simplify it.

Prioritise questions around:

- confidentiality;
- file handling;
- software compatibility;
- turnaround;
- revision handling;
- payment timing;
- who performs the work;
- ownership and IP;
- what happens after requirement submission.

### Section 10 — Final CTA

Current component: `CTA.tsx`

Use a large high-contrast closing statement inspired by Lifecycle's editorial endings.

Primary action: `Submit Requirement`

Secondary action where appropriate: `Speak With Us`

Avoid generic "Ready to get started?" language.

### Section 11 — Footer

Current component: `Footer.tsx`

Translate Lifecycle's structured footer concept while keeping Overflow Partner legal and operational links.

Suggested groups:

- Services
- Company / How We Work
- Workspace
- Legal
- Contact

## Design token translation

Do not hard-code the Webflow template values blindly. Establish an Overflow Partner token system using the same underlying design logic.

### Colour

Recommended direction:

- `--op-bg`: warm off-white or precise neutral surface for most public pages;
- `--op-bg-dark`: near-black / engineered charcoal for high-contrast sections;
- `--op-text`: near-black;
- `--op-text-muted`: controlled neutral grey;
- `--op-border`: quiet neutral rule;
- `--op-accent`: existing Overflow Partner red used sparingly and intentionally;
- `--op-surface`: white / subtle warm neutral.

The red accent should communicate extension, status, or a deliberate emphasis—not decoration.

### Typography

Use the existing project font stack unless there is a deliberate approved font change.

Set semantic roles:

- Display XL
- Display L
- H2
- H3
- Lead
- Body
- Small
- Eyebrow / label

Typography should scale with `clamp()` where practical.

### Widths

Create shared values for:

- page gutter;
- standard container;
- wide container;
- narrow copy measure;
- media measure.

Avoid repeated one-off `max-w-*` values across sections.

### Spacing

Create semantic spacing for:

- section compact;
- section standard;
- section large;
- editorial gap;
- component gap;
- micro gap.

The visual quality should come from consistent rhythm, not individually tuned margins on every element.

## Component architecture

Codex should favour reusable components such as:

```text
components/
  marketing/
    MarketingHeader.tsx
    MarketingFooter.tsx
    EditorialHero.tsx
    SectionEyebrow.tsx
    EditorialHeading.tsx
    SplitFeature.tsx
    ProofStrip.tsx
    ServiceIndex.tsx
    ProcessSteps.tsx
    CaseStudyFeature.tsx
    TechnicalArtifact.tsx
    EditorialCTA.tsx
  ui/
    Button.tsx
    Container.tsx
    Section.tsx
    Divider.tsx
```

Do not move Workspace-specific application components into the marketing component namespace.

## Responsive requirements

Mobile must be intentionally recomposed.

For every major section Codex must verify:

- content order;
- headline measure;
- image cropping;
- CTA stacking;
- section spacing;
- readable line length;
- navigation behaviour;
- no horizontal overflow;
- no desktop-only visual dependencies.

Tablet should not be treated as an afterthought.

## Motion

Use restrained motion only where it reinforces hierarchy.

Allowed examples:

- subtle reveal on major media;
- underline / rule motion;
- small CTA state change;
- restrained image scale on hover where appropriate.

Avoid:

- parallax for decoration;
- excessive scroll choreography;
- animated gradients;
- floating cards;
- large motion on essential content.

Respect `prefers-reduced-motion`.

## Implementation order for Codex

### Pass 1 — Foundation

1. Audit existing marketing components and `app/globals.css` / current design-system styles.
2. Introduce or rationalise public-site tokens.
3. Build shared `Container`, `Section`, typography, and CTA primitives.
4. Do not touch Workspace state or backend code.

### Pass 2 — Homepage structure

1. Header
2. Hero
3. Context / problem
4. Proof strip
5. Services
6. Public process
7. Proof of work
8. Why Overflow Partner
9. FAQ
10. CTA
11. Footer

### Pass 3 — Responsive refinement

Test at minimum:

- 1440px desktop
- 1280px laptop
- 1024px tablet landscape
- 768px tablet
- 430px mobile
- 390px mobile

### Pass 4 — Visual QA

Compare the completed Overflow Partner page against the Lifecycle reference for:

- hierarchy;
- whitespace;
- rhythm;
- editorial balance;
- image scale;
- density;
- navigation calmness;
- mobile recomposition.

Do not compare for copied colours, branding, copy, or imagery.

## Codex master instruction

Use the Lifecycle Consulting Webflow demo only as a visual and structural reference. Rebuild its editorial hierarchy, spacing discipline, asymmetric layout logic, section rhythm, and restrained interaction style as a native Next.js/React implementation for Overflow Partner.

Preserve all existing Overflow Partner business logic, Supabase integrations, Workspace routes, Document Engine behaviour, Case 360 / Project 360 flows, authentication, permissions, approval rules, and operational state transitions. This task is not permission to redesign the operating model.

Do not import Webflow HTML, CSS class names, JavaScript, copy, images, logos, or branded assets. Do not produce a literal clone. Translate the design principles into reusable project-native components and design tokens.

Use engineering proof artefacts instead of generic consulting photography. Maintain Overflow Partner's monochrome/neutral engineering identity with restrained red emphasis. Prioritise production evidence, controlled technical work, and capacity-extension messaging.

Work iteratively. After each major homepage section, verify responsive behaviour and visual consistency before moving on. Avoid one-off CSS where a reusable token or component is appropriate.

## Definition of done

This translation is complete when:

- the public website clearly feels more editorial, premium, and technically credible;
- the visual rhythm is recognisably inspired by Lifecycle without being a clone;
- Overflow Partner remains visually distinct and engineering-led;
- the homepage is coherent across desktop, tablet, and mobile;
- public components are reusable and token-driven;
- Workspace and Document Engine functionality are unchanged;
- Supabase and workflow behaviour are unchanged;
- no Webflow-generated code or proprietary template assets are included;
- production build, lint, and responsive checks pass.
