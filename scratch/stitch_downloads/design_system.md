---
name: Financial Reliability Control Plane
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c3c6d7'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8d90a0'
  outline-variant: '#434655'
  surface-tint: '#b4c5ff'
  primary: '#b4c5ff'
  on-primary: '#002a78'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#0053db'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: jetbrainsMono
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: jetbrainsMono
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: jetbrainsMono
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0em
  body-md:
    fontFamily: inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  mono-data-lg:
    fontFamily: jetbrainsMono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
  mono-data-sm:
    fontFamily: jetbrainsMono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-caps:
    fontFamily: jetbrainsMono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
  code-inline:
    fontFamily: jetbrainsMono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 2px
  space-xs: 4px
  space-sm: 8px
  space-md: 12px
  space-base: 16px
  space-lg: 20px
  space-xl: 24px
  space-2xl: 32px
  gutter: 12px
  sidebar-width: 260px
  inspector-width: 420px
---

## Brand & Style
The design system serves financial engineers, treasury teams, and site reliability engineers operating mission-critical payment rails. It fuses the information-dense utility of institutional terminals with the ergonomics of modern distributed systems monitoring.

### Visual Archetype: High-Precision Systems Instrument
- **Aesthetic:** Minimalist, institutional, and technical. The UI prioritizes extreme signal-to-noise ratio, zero latency perception, and structural clarity over ornamental trends.
- **Tone:** Uncompromising, forensic, deterministic, and mission-critical.
- **Rules of Engagement:** 
  - Zero decorative ambient gradients, blurry neons, or rounded playful micro-copy.
  - Every visual mark represents a state machine transition, ledger delta, or telemetry checkpoint.
  - Explicit environmental safety controls (Live Ledger vs. Simulation/Shadow) take visual precedence over ambient navigation.

## Colors
The system is built exclusively for dark-mode operations to reduce ocular fatigue across multi-monitor shifts, maintaining strict contrast ratios compliant with WCAG 2.1 AAA for data grids and tabular numbers.

### Core Architecture
- **Canvas Base:** `#0B0E14` (absolute low-luminescence base)
- **Surface Level 1 (Panels & Rows):** `#121824`
- **Surface Level 2 (Elevated Flyouts, Drawers):** `#161F30`
- **Structural Borders:** `#1B2436` (default), `#26354D` (hover/focus)

### Strict Financial Semantics
- **Reconciled / Settled / Nominal:** `#10B981` (Emerald), background `#064E3B28`, border `#05966966`.
- **System Failure / Divergence / Dangerous:** `#F43F5E` (Rose), background `#88133728`, border `#E11D4866`.
- **Indeterminate / Lagging / Stale:** `#F59E0B` (Amber), background `#78350F28`, border `#D9770666`.
- **In-Flight / Ingestion / Telemetry:** `#06B6D4` (Cyan) and `#3B82F6` (Electric Indigo).
- **Terminal Neutral / Historical:** `#64748B` (Cool Slate), background `#1E293B40`, border `#33415560`.

### Safety Banner Tokens
- **Live Real-Money Ledger:** Solid `#E11D48` safety tag with monospaced bold warning.
- **Isolated Simulation Sandbox:** Striped diagonal border motif with `#F59E0B` indicator and `#121824` fill.

## Typography
Typography is paired into dual roles: **Inter** handles narrative clarity, long-form system logs, context labels, and policies; **JetBrains Mono** governs system state, UUIDs, cryptographic hashes, currency values, idempotency keys, and execution timestamps.

### Tabular Formatting Rules
- All currency balances, transaction latencies, and transaction hashes must implement `font-variant-numeric: tabular-nums lining-nums`.
- Cryptographic hashes and deterministic trace identifiers truncate dynamically via the middle pattern (`0x7f9a...3b21`) using explicit mono tokens.
- Safety flags and operational modes strictly render in `label-caps` with uppercase transformation.

## Layout & Spacing
The layout adheres to a dense 4px base rhythm. Enterprise financial engineering workspaces require dense screen real estate without scroll chaining.

### Screen Partitioning
- **Global Control Rail (Top):** Fixed 40px height. Houses safety environments, tenant selector, cluster sync health, and global search.
- **Primary Grid:** 12-column dynamic fluid layout with strict 12px gutters.
- **Triage Split Pane:** 60% Left Stage (State machine diagrams, transaction timeline, explainability pipeline) | 40% Right Stage (Deterministic ledger balance changes, raw payload inspector, proof certificates).
- **Responsive Handling:** When viewport width drops below 1280px, the right inspector folds into an overlay sliding drawer. Below 768px, navigation collapses to an emergency command palette (`Cmd+K`).

## Elevation & Depth
This design system rejects diffuse, floating shadows. Visual hierarchy is achieved exclusively through **tonal surfacing**, **1px crisp containment borders**, and **luminance stepping**.

- **Level 0 (Canvas Base):** `#0B0E14` (Underlying workspace viewport).
- **Level 1 (Panels, Tables, Pipelines):** `#121824` enclosed with `1px solid #1B2436`.
- **Level 2 (Active Focus / Selected Rows / Hover):** `#161F30` with `1px solid #26354D`.
- **Level 3 (Modals, Overlays, Dropdowns):** `#1C263B` with `1px solid #334668` accompanied by an ultra-crisp structural drop shadow: `0 8px 24px -4px rgba(0, 0, 0, 0.65)`.
- **Z-Index Layering Order:** Base (1) -> Grid Fixed Header (10) -> Context Menus (50) -> Inspector Drawer (100) -> Global Safety Warning Layer (500).

## Shapes
Shapes emphasize high-density utility with minimal radius curvature. A soft 4px (`roundedness: 1`) radius prevents corners from encroaching on dense telemetry while avoiding brutalist raw edge abrasion.

- **Buttons, Inputs, Cells, Status Tags:** 4px radius (`0.25rem`).
- **Cards, Panels, Modals, Containers:** 6px radius (`0.375rem`).
- **State Indicators & Network Pings:** Circular / 9999px pill only for micro status dots (6px × 6px).

## Components

### 1. Six-Stage Explainability Pipeline
A horizontal stepped trace representing deterministic AI resolution:
`EVENT → OBSERVATION → AI HYPOTHESIS → POLICY DECISION → TRANSITION → AUDIT EVIDENCE`
- **Container:** `#121824` card with continuous connecting 1px track line (`#1B2436`).
- **Nodes:** 24px × 24px square nodes with 4px border radius. 
- **States:**
  - *Completed:* `#10B981` border with translucent background, checkmark glyph.
  - *In-Flight:* `#06B6D4` pulsing outline with continuous border stroke animation.
  - *Failed / Diverged:* `#F43F5E` background with diagnostic error code tooltip.
  - *Pending:* `#1B2436` background with `#64748B` step numbering.

### 2. Status Badges & Safety Chips
- **Format:** High-density, horizontal layout containing `[Icon Status Dot] [Mono State Code] [Human Label]`.
- **Padding:** 2px 6px. Height: 20px.
- **Styling:** Border-tint matched to text color at 40% opacity; background tint at 15% opacity.

### 3. Safety Indicator Header Strip
- Placed directly beneath global navigation or directly inside high-risk transaction panels.
- **Production Mode:** Height 28px. Dark crimson background `#2C0B12`, 1px solid border `#E11D48`, text `₹ REAL MONEY ENVIRONMENT | LEDGER MUTATION ACTIVE`.
- **Sandbox Mode:** Dark amber background `#271804`, 1px solid border `#D97706`, text `TEST / SIMULATION | HARD-ISOLATED SANDBOX`.

### 4. Enterprise Tables & Hash Grids
- **Header:** Height 32px, text in `label-caps`, uppercase, color `#64748B`, bottom border `1px solid #1B2436`.
- **Row:** Height 36px, hover state `#161F30`, active state border highlight on left edge (2px solid `#3B82F6`).
- **ID Columns:** Displayed in `mono-data-sm` with quick one-click clipboard copy triggers and hover tooltip revealing raw JSON trace keys.

### 5. Interactive Buttons & Form Inputs
- **Primary Execution Button:** `#2563EB` fill, white text, 4px radius, hover `#1D4ED8`, height 32px.
- **Dangerous Action Button (Force Reconcile / Kill Switch):** Transparent background with `1px solid #F43F5E`, text `#F43F5E`, hover background `#88133733`.
- **Data Input Fields:** Background `#0B0E14`, border `1px solid #1B2436`, active focus border `1px solid #2563EB`, text `jetbrainsMono`.
