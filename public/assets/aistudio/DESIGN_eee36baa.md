---
name: Obsidian Telemetry
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2ef'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dfe2ef'
  inverse-on-surface: '#2c303a'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#1bbd85'
  on-tertiary-container: '#00452e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0f131c'
  on-background: '#dfe2ef'
  surface-variant: '#31353f'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.005em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system embodies high-frequency infrastructure monitoring, real-time TCP/UDP observability, and deep systems engineering. The aesthetic marries **technical minimalism** with **refined data-density and subtle glassmorphic precision**. It rejects bloated enterprise clutter in favor of high-signal, zero-latency ergonomics.

The visual language communicates instant reliability, deterministic execution, and cryptographic accuracy. It bridges the command line and modern spatial UI: deep obsidian voids anchor the canvas, while laser-focused cyan and electric indigo accents indicate throughput, packet flow, and telemetry states. Interfaces must feel fast, cool-tempered, and mathematically disciplined.

## Colors

The palette is engineered around low-strain operational monitoring over long viewing sessions, rooted in deep spectral contrasts.

- **Primary (`#06B6D4` / Electric Cyan):** Dictates active network connections, primary data streams, interactive focus rings, and primary action affordances.
- **Secondary (`#6366F1` / Electric Indigo):** Reserved for system infrastructure metrics, auxiliary ingress pipelines, routing protocol switches, and analytical charts.
- **Tertiary (`#10B981` / Pulse Emerald):** Functional status token dedicated to live TCP socket states (`ESTABLISHED`, `LISTEN`), healthy keep-alives, and zero-loss packet streams.
- **Neutral Canvas (`#090D16` / Midnight Obsidian):** The deepest base canvas surface. Sub-tier surfaces tier upward through `#0F172A` (Slate 900) for structural cards, up to `#1E293B` (Slate 800) for interactive elements and panel dividers.
- **Functional Semantics:** Use `#F59E0B` (Amber) for `SYN_SENT` / degraded buffers, and `#EF4444` (Crimson) for dropped frames, `TIME_WAIT` overflow, and socket termination errors.

## Typography

Typography acts as a dynamic instrumentation layer. The system creates clear operational separation:
- **Inter** executes primary narrative flow, contextual summaries, modal structures, and high-level navigation. Its geometric clarity prevents visual drag across dense panels.
- **JetBrains Mono** governs all raw operational realities: IP addresses, port identifiers, byte offsets, latency counters, TCP header flags (`ACK`, `SYN`, `FIN`), and real-time log outputs.
- Keep numbers strictly tabular via `font-variant-numeric: tabular-nums` to guarantee steady visual scanning during metric updates.
- Metric subtitles, table headers, and category tags utilize `label-caps` in uppercase format to form crisp visual anchors.

## Layout & Spacing

The layout is built upon a modular **Bento Grid** architecture structured around a strict 8pt base spacing rhythm (with a 4pt sub-grid for dense mono data rows).

- **Fluid Bento Structure:** Break layouts into 12 columns on desktop (`>= 1280px`), 8 columns on tablet (`>= 768px`), and single-column stacked modules on mobile (`< 768px`).
- **Telemetry Card Span:** Modular analytical tiles flex across varying spans: `span-3` for standalone metric gauges (RTT, packet loss, bandwidth), `span-6` for live stream logs, and `span-12` for low-latency line graphs and global topology.
- **Gutter & Margins:** Maintain strict outer clearance with `margin-desktop` (2rem) and `gutter-desktop` (1.5rem). Modules should maintain snug interior paddings (`space-md` to `space-lg`) to balance spatial density with operational legibility.

## Elevation & Depth

Visual hierarchy relies on **translucent surface layering, subtle ambient glow, and micro-borders**, bypassing muddy drop shadows.

- **Surface Tiers:**
  - *Base Canvas:* `#090D16` solid substrate.
  - *Container Surface:* `#0F172A` with an 80% opacity fill layered over backdrop blur (`backdrop-filter: blur(12px)`).
  - *Hover/Active Overlays:* `#1E293B` at 60% opacity with dynamic internal inset highlight lines.
- **Border Gradients (Glass Framing):** Bento cards utilize a 1px boundary stroke using linear gradients starting from `rgba(255, 255, 255, 0.12)` at the light-struck top edge fading to `rgba(255, 255, 255, 0.02)` at the base.
- **Active Glow & Ambient Depth:** High-priority items (active socket pipes, threshold triggers) cast an ultra-soft radiant glow: `0 0 24px -4px rgba(6, 182, 212, 0.18)` for primary connections and `0 0 20px -4px rgba(16, 185, 129, 0.22)` for healthy socket indicators.
- **Z-Index Layering:** Flyouts, inspector drawers, and socket raw hex dumps sit elevated on `#131C31` bounded by `rgba(99, 102, 241, 0.25)` micro-borders.

## Shapes

The design system enforces a **Soft (`1`)** shape language (4px base, 8px for cards, 12px for modal overlays) to reflect architectural precision, hardware chassis contours, and high-density computing consoles.

- **Panels & Bento Containers:** Standardized at `8px` (`rounded-lg`). Provides distinct separation while maximizing active viewing area inside data grids.
- **Inputs, Buttons, and Code Badges:** Set to `4px` (`rounded-base`). Keeps interactive affordances crisp, efficient, and aligned with standard code-editor UI conventions.
- **Status Indicators & Network Nodes:** Perfectly circular (`border-radius: 9999px`) dots to denote socket connectivity, client-server pulse points, and signal beacons.

## Components

### Buttons & Action Bars
- **Primary Action:** Solid `#06B6D4` fill with dark ink (`#090D16`), weight 600 Inter typography, `4px` radius. Hover shifts to `#22D3EE` with a subtle cyan ambient halo.
- **Secondary Action:** Ghost obsidian container (`#0F172A`) with a 1px border (`rgba(255, 255, 255, 0.1)`), elevating on hover to `rgba(99, 102, 241, 0.15)` background and `#6366F1` border stroke.
- **System Command Button:** JetBrains Mono font, monospaced icon prefixes (`$`, `>`), designed for quick shell invocation and trace triggers.

### Chips & Telemetry Badges
- Built using `label-caps` in JetBrains Mono.
- Status configurations:
  - *ESTABLISHED:* `#10B981` text, `rgba(16, 185, 129, 0.12)` fill, 1px border `rgba(16, 185, 129, 0.3)`. Includes a 6px pulsing emerald beacon.
  - *SYN_RECV / QUEUED:* `#F59E0B` text, `rgba(245, 158, 11, 0.1)` fill, 1px border `rgba(245, 158, 11, 0.25)`.
  - *CLOSED / DROPPED:* `#EF4444` text, `rgba(239, 68, 68, 0.1)` fill, 1px border `rgba(239, 68, 68, 0.25)`.

### Bento Metric & Graph Cards
- Composed of a structural card wrapper (`#0F172A` at 85% opacity, backdrop blur, `rounded-lg`).
- Header holds a `label-caps` metric category accompanied by real-time latency indicators.
- Center features large numeric tabular readouts (`font-variant-numeric: tabular-nums`).
- Base integrates sparklines or packet density bars rendered with gradient stroke transitions (`#06B6D4` down to `rgba(6, 182, 212, 0)`).

### Interactive Terminal & Payload Lists
- Row items separated by hairline border dividers (`rgba(255, 255, 255, 0.04)`).
- Alternate row highlight on mouse sweep: `rgba(99, 102, 241, 0.06)`.
- Timestamp, IP, Port, and Size columns aligned strictly with monospace metrics.

### Input & Filter Fields
- Background set to deep obsidian canvas `#090D16`, framed with `rgba(255, 255, 255, 0.08)` border stroke.
- Focus state delivers a 1px ring in `#06B6D4` paired with an inner box-shadow glow (`0 0 0 1px #06B6D4`).
- Placeholder text styled in muted slate `#475569`. Filter fields support keyboard shortcut badges (e.g., `⌘K`) rendered in JetBrains Mono at the trailing edge.