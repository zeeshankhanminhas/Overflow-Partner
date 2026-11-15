# Overflow Partner — Target Visual Foundation Specification

Status: **ACTIVE as a compatible visual reference.** Current accessible UI defaults and IA are controlled by [OPOS Operator Experience Contract](OPOS_OPERATOR_EXPERIENCE_CONTRACT.md); historical small-control and tiny-copy numbers below have been retired.

This specification turns the six Visual System Contracts into one finite target foundation. It governs the physical composition of every page, panel, card, table, register, drawer, dialog, work window, form control, status capsule, toolbar, navigation control and icon in the Overflow Partner workspace.

The product contracts govern behaviour. This specification governs rendering.

## Reusable principles — never override accessible operator defaults

1. Reuse shared spacing, radius, typography, colour and icon tokens wherever possible; accessibility, content and device geometry may require considered exceptions.
2. Do not introduce competing rescue override layers; consolidate styles under existing ownership.
3. Do not introduce new `--saas-*` presentation tokens; migrate existing inherited declarations deliberately and without visual regression.
4. No hard-coded dark legacy islands are allowed inside JSX.
5. No Unicode glyph may be used as a UI icon where a conventional SVG icon is required.
6. Feature CSS composes layouts; shared primitives define defaults, including operator-experience accessibility minima. This target specification is not a hard-coded veto against necessary improvements.

---

# A. Spacing & Density Contract

## Canonical spacing scale

| Token | Value | Use |
|---|---:|---|
| `--op-space-1` | 4px | micro separation, icon/text optical correction |
| `--op-space-2` | 8px | compact control gap, metadata rows |
| `--op-space-3` | 12px | compact card/inset padding, table horizontal rhythm |
| `--op-space-4` | 16px | standard card/panel padding, section internals |
| `--op-space-5` | 24px | major section gap, drawer/modal body padding |
| `--op-space-6` | 32px | desktop page gutter / major page separation |

Prefer the spacing scale; responsive composition, type legibility and safe touch targets take precedence over exact numeric spacing. Optical exceptions must not become layout tokens.

## Density targets

- Desktop page gutter: **32px**, responsive down to **24px**, then **16px** on mobile.
- Major page section gap: **24px**.
- Register/dashboard compact page section gap: **16px** only where density is intentional.
- Standard panel/card padding: **16px**.
- Compact inset padding: **12px**.
- Drawer/modal/work-window body padding: **24px desktop / 16px mobile**.
- Table header horizontal padding: **12px**.
- Table body cell padding: **12px**.
- Register row padding: **12px 16px**.
- Gap between icon and label: **8px**.
- Gap between adjacent controls: **8px**.

The visual test is simple: text must never appear to touch a border, and equivalent containers must have equivalent breathing room.

---

# B. Typography Contract

Use a small semantic scale rather than per-component tuning.

| Role | Size | Line height | Weight | Notes |
|---|---:|---:|---:|---|
| Page title | 32px desktop / 28px mobile | 1.10 | 650 | Aspekta/display font |
| Record title / major heading | 24px | 1.15 | 650 | Aspekta/display font |
| Section heading | 18px | 1.25 | 650 | Aspekta/display font |
| Emphasised body | 14px | 1.45 | 650 | Key value / row primary text |
| Body | 14–16px | 1.55 | 400–500 | Default operational copy |
| Compact body | 13–14px | 1.5 | 400–600 | Tables, registers, secondary detail |
| Label | 12–13px | 1.4 | 650 | Status, control label, metadata |
| Micro | 11–12px | 1.35 | 650 | Optional eyebrows, tertiary metadata only |

Rules:

- Eyebrows may be uppercase with modest letter spacing; body text must not be.
- No tiny critical UI. Important text stays at least 14px; optional labels may use 11–12px when sufficiently legible.
- Font weight choices are restricted to regular/body, medium and 650 semibold emphasis. Avoid 680/700/720/750/760/800 drift.
- Table headers use **11px / 650**, not micro typography.
- Supporting text must remain readable without relying on opacity alone.

---

# C. Geometry Contract — Radius, Border & Shadow

## Radius scale

| Token | Value | Use |
|---|---:|---|
| `--op-radius-control` | 8px | buttons, inputs, selects, compact controls |
| `--op-radius-inset` | 8px | inset facts, menus, notices |
| `--op-radius-panel` | 12px | cards, panels, register frames |
| `--op-radius-overlay` | 12px | dialogs/work windows; drawers remain edge-bound |
| `--op-radius-pill` | 999px | status capsules only |

Shared radius tokens are preferred. Responsive, accessible component patterns are not to be rejected merely because an earlier visual spec prohibited an intermediate radius.

## Border levels

| Token | Purpose |
|---|---|
| `--op-border-soft` | row separators, inset separation |
| `--op-border-default` | cards, panels, inputs, controls |
| `--op-border-strong` | selected/focus/emphasis boundary |

Hard-coded `rgba(...)` border variants are not allowed in component CSS except overlay backdrops/shadows.

## Shadows

- Panels/cards: no visible decorative shadow; at most a nearly-flat separation shadow.
- Menus/popovers: one restrained elevation token.
- Dialog/window: one overlay elevation token.
- No shadows used to compensate for weak borders or hierarchy.

---

# D. Controls & Status Alignment Contract

## Control heights

| Usage | Minimum target | Guidance |
| --- | --- | --- |
| Standard clickable control | **44px** | Navigation, actions, selects, buttons, disclosure rows |
| Prominent action / mobile | **44–48px** | Clear next permitted action, safe spacing |
| Compact desktop-only utility | 36px exception | Non-critical secondary controls with sufficient separation; never a mobile default |

- Use 16px input text on mobile to avoid viewport zoom.
- Button text must remain legible, normally 14px or more; keep semantic text with icons.
- Old mandatory 32/36/40px interactive control targets are retired and must not be restored by CSS or tests.

## Status capsule geometry

Canonical status capsule:

- `display:inline-flex`
- `align-items:center`
- `justify-content:center`
- minimum height: **24px**
- horizontal padding: **8px**
- vertical padding: **0**
- font: **11px / 1 / 650**
- dot: **5px**
- dot-to-label gap: **6px**
- pill radius only
- no wrapping inside ordinary register/table use

Long workflow descriptions must not be forced into a capsule; use normal text instead.

Semantic colours remain: neutral, active/information, waiting, attention, blocked/critical, complete.

---

# E. Containers & Interaction Layers Contract

Only three ordinary containment levels exist:

1. **Canvas** — page background.
2. **Panel/Card** — primary bounded object or section.
3. **Inset** — supporting information inside a panel/card.

## Panel/Card anatomy

- radius: 12px
- border: default
- background: white
- padding: 16px
- internal gap: 12px or 16px depending content rhythm

## Inset anatomy

- radius: 8px
- border: soft
- background: subtle neutral
- padding: 12px
- internal gap: 8px

## Table/Register anatomy

- outer frame radius: 12px
- table header: 11px/650
- cell padding: 12px
- row separators: soft border
- primary row text: 14–16px
- secondary row text: 12–13px
- status and actions vertically centred against the row baseline
- no local row height hacks; content determines height with a minimum comfortable density

## Drawer

- width: up to 520px desktop
- full height
- white surface
- header: 24px padding
- body: 24px
- footer: 16px 24px
- mobile: 16px anatomy
- no independent dark theme

## Dialog

- default max width: 620px
- radius: 12px
- same header/body/footer anatomy as drawer

## Work window

- max width: approximately 1050px
- radius: 12px
- same visual tokens as dialog
- larger dimensions do not create a new design language

Interaction hierarchy remains: Page = choose work; Drawer = inspect; Dialog = decide; Work Window = perform substantial bounded work.

---

# F. Iconography & Brand Contract

## Canonical icon geometry

All workspace UI icons use one SVG family with:

- `viewBox="0 0 24 24"`
- `fill="none"`
- `stroke="currentColor"`
- `stroke-width="1.8"`
- `stroke-linecap="round"`
- `stroke-linejoin="round"`

The existing Mobile Workspace Nav is the reference geometry.

## Icon sizes

- compact/table utility: **16px**
- standard control/top bar: **18px**
- navigation: **20–21px**
- major illustrative/domain icon: **24px maximum** unless it is a file thumbnail or dedicated artwork

## Rules

- No Unicode pseudo-icons for Search, Alerts, Work Centre, Add, More, Close, Calendar, Filter, Download, Delete, Approve, etc.
- `currentColor` only; semantic state may colour the icon through the parent.
- Icon-only controls require accessible names/tooltips where useful.
- Ambiguous actions retain text labels.
- Filled and outline icon styles must not be mixed randomly.
- OP red is reserved for primary/action/attention meaning; it is not applied to every icon as decoration.
- The authoritative Overflow Partner logo asset must be used consistently across desktop and mobile shell branding.

---

# Implementation gate

Before broad visual migration begins, active legacy presentation must be reduced to zero:

- no active dark `interaction-surfaces.css` grammar
- no `--saas-*` presentation fallbacks in active workspace styling
- no Command Palette dark inline visual system
- no duplicate interaction layer ownership
- no obsolete presentation file kept active merely because some selector may still depend on it

Required migration method:

1. move still-needed structural selectors into the current owning primitive stylesheet;
2. remove the legacy import;
3. physically delete the legacy file;
4. verify the build;
5. then migrate primitives to this target foundation.

This is a target visual reference subordinate to the active operator-experience contract. Its original pre-consolidation migration checklist is historical and must not block removal of unused legacy layers or improvement of accessibility.