# Design System

The visual foundation for the analytical product. Tokens are implemented in
[`web/src/styles/tokens.css`](../web/src/styles/tokens.css); the chart language
is a typed contract in
[`web/src/styles/chart-language.ts`](../web/src/styles/chart-language.ts) and is
enforced by `web/tests/chart-language.test.ts`.

---

## 1. Product character

The product is an **interactive intelligence report**, not a dashboard. It is
read top to bottom like an argument, and its visual language should say
"considered analysis" before it says anything else.

| It should feel | It must not feel |
| --- | --- |
| Analytical, editorial, restrained | Like a BI dashboard or admin panel |
| Premium and deliberately composed | Like a component-library demo |
| Highly readable, data-first | Like a crypto/dark-only analytics template |
| Calm and confident | Busy, gradient-heavy, emoji-labelled |
| Trustworthy about its own limits | Like a KPI wall of big meaningless numbers |

Two rules follow from this, and they drive most of the token decisions:

1. **The interface recedes; the data does not.** UI chrome uses deep, slightly
   desaturated colour. Saturated hue appears *only* in the data palette. This is
   the single strongest lever against the generic-dashboard look.
2. **Elevation comes from border and background delta, not shadow.** Cards do
   not float. Shadow is reserved for genuinely overlaid surfaces — popovers,
   dialogs, dropdowns. A page of floating cards is what makes an analytical UI
   read as plastic.

**Explicitly rejected:** generic Bootstrap/BI appearance, excessive cards,
rainbow chart palettes, decorative gradients, oversized meaningless KPI numbers,
animation that delays reading, emoji as section hierarchy, and Streamlit-style
stacked widget controls.

---

## 2. Colour

Light-first with a complete dark theme. Both are first-class: dark-only is a
cliché and light-only is not credible for a 2026 product. Dark applies via
`prefers-color-scheme` and can be forced with `[data-theme="dark"]`.

Components reference **semantic** tokens only. Primitive values (`--neutral-*`,
`--hue-*`) exist so themes can be retuned in one place, and must not be used
directly in components.

### Surfaces and text

| Token | Light | Purpose |
| --- | --- | --- |
| `--color-bg` | `#fcfcfd` | Page ground |
| `--color-surface` | `#ffffff` | Cards, panels |
| `--color-surface-raised` | `#f7f8f9` | Hover, nested surfaces |
| `--color-surface-sunken` | `#eff1f3` | Wells, table headers |
| `--color-border` | `#e6e8eb` | Hairline, default |
| `--color-border-strong` | `#d8dbdf` | Emphasis, axis lines |
| `--color-border-interactive` | `#b9bfc5` | Hover borders, crosshair |
| `--color-fg` | `#0b0d0e` | Primary text |
| `--color-fg-secondary` | `#545c63` | Supporting prose |
| `--color-fg-muted` | `#6e767d` | Captions, axis labels |
| `--color-fg-subtle` | `#8f979f` | Decorative only — fails AA at body size, never load-bearing |

### Accent

`--color-accent` is **contrast, not hue**: near-black fill on light ground,
near-white on dark. Interactive emphasis comes from weight and contrast rather
than from a brand colour, which keeps hue available for data.

### Status

Deliberately deeper and less saturated than the data palette, so a callout never
competes with a chart: `--color-positive` `#15803d`, `--color-warning` `#a16207`,
`--color-negative` `#b91c1c`, `--color-info` `#1e40af`, each with a matching
`-surface` tint.

### Data series

`--color-oil` (`#c2410c` rust) is **reserved**. It is never assigned to a
country, so a rust line means the price series in every chart.

`--color-series-worldwide` is near-ink rather than a hue, because worldwide is an
aggregate and not a peer of the five markets.

### Country colours are identifiers only

| Country | Token | Light |
| --- | --- | --- |
| Indonesia | `--color-country-indonesia` | `#db2777` pink |
| Malaysia | `--color-country-malaysia` | `#7c3aed` violet |
| Norway | `--color-country-norway` | `#059669` emerald |
| Singapore | `--color-country-singapore` | `#0891b2` cyan |
| United States | `--color-country-us` | `#2563eb` blue |

These encode **no ranking, quality, sentiment or magnitude**. Assignment is
fixed and arbitrary, and must stay identical across the whole product — a reader
who learns "violet is Malaysia" in one chart carries that to every other.

Two deliberate constraints:

- **Red is excluded from the country palette** (reserved for
  `--color-negative`). With no red present, no red/green pair exists among the
  countries, so the set cannot be read as good-versus-bad. A test asserts no
  country is assigned a status colour.
- **Cyan and blue are the closest pair.** Colour is therefore never the only
  cue: every series also carries a dash pattern and a marker shape (§5).

### Annotation

`--color-regime-elevated` is a low-alpha wash for the four-week elevated-price
window; `--color-uncertainty` is neutral so confidence bands never read as a
second series; `--color-provisional` marks data that is present but must not be
read as equivalent — specifically the single-trading-day week.

---

## 3. Typography

System stacks only. No `next/font/google`, no downloaded webfonts, no build-time
network dependency.

- `--font-sans` — `ui-sans-serif, system-ui, -apple-system, …`
- `--font-mono` / `--font-numeric` — `ui-monospace, SFMono-Regular, …`

**Three weights maximum** (400/500/600). More weights is the fastest route to
looking generic.

| Role | Token prefix | Notes |
| --- | --- | --- |
| Display | `--text-display-*` | Hero only. `clamp(2.25rem → 3.75rem)`, tracking `-0.028em` |
| Headings | `--text-h1-*` … `--text-h4-*` | h1/h2 fluid; h3/h4 fixed |
| Lead | `--text-lead-*` | The analytical thesis under a section heading |
| Body | `--text-body-*` | `1rem / 1.68` |
| Small | `--text-small-*` | Secondary prose |
| Metadata | `--text-meta-*` | Sources, footnotes, captions |
| Label | `--text-label-*` | Section eyebrows. **The only uppercase in the product** |
| Statistic | `--text-stat-*`, `--text-stat-small-*` | Numeric display |
| Data | `--text-data-*` | Axis ticks, inline figures |

**Tabular figures are non-negotiable.** Any element rendering a number carries
`.numeric` or `[data-numeric]`, which applies `--font-numeric` with
`font-variant-numeric: tabular-nums`. Statistics in a column that do not align
look careless in a data product.

Uppercase is confined to section eyebrows at one size. Uppercase elsewhere is
what makes a dashboard look shouty.

---

## 4. Spacing, layout, radius

4px base scale, `--space-0` … `--space-32`, named by step so the scale can be
retuned once.

### Widths

| Token | Value | Use |
| --- | --- | --- |
| `--width-page` | 1440px | Shell maximum |
| `--width-chart` | 1280px | Charts may exceed content width |
| `--width-content` | 1120px | Cards, grids, tables |
| `--width-reading` | 68ch | Prose. **Prose never exceeds this** |
| `--width-narrow` | 52ch | Pull quotes, key-insight callouts |

Measure is capped in `ch`, not px, so it stays correct regardless of font size.

### Rhythm

`--section-spacing` 96px desktop / 64px mobile · `--card-padding` 32px / 20px ·
`--grid-gap` 24px / 16px · `--page-padding-inline` 24px / 16px. Mobile values
swap in automatically under 768px, so components need no breakpoint logic for
rhythm.

### Radius

Deliberately tight: `xs 3px`, `sm 4px`, `md 6px`, `lg 8px` (cards),
`xl 12px` (**hero and executive-summary panels only**), `full` for pills. Large
radii read as consumer app rather than analytical tool.

### Elevation

`--shadow-none` for cards. `--shadow-overlay` and `--shadow-overlay-strong` only
for popovers, dialogs and dropdowns.

---

## 5. Chart visual language

One language, consumed by every chart. The full token list is `CHART_TOKENS` in
`chart-language.ts`; a test asserts each one is defined in `tokens.css`, and that
dark mode defines every colour a chart reads.

### Resolution model

Canvas cannot consume `var()`. `resolveChartTheme(read)` resolves every token to
a concrete string through an injected `CssVariableReader`, called **once per
theme change** rather than per render. Phase 3B supplies a reader backed by
`getComputedStyle`. Dependency injection keeps the module DOM-free and unit
testable, and it throws — naming every unset variable — if `tokens.css` was not
loaded, rather than rendering transparent lines.

### Fixed treatments

| Element | Treatment |
| --- | --- |
| Axis labels | `--font-numeric`, `--text-data-size`, `--color-fg-muted` |
| Gridlines | **Horizontal only**, 1px, `--color-border`. Vertical gridlines add noise to a time series |
| Tooltip | Surface + hairline border + mono numerals. Never the library default |
| Legend | `--text-meta-size`, inactive entries drop to `--color-fg-subtle` |
| Lines | 2px, 2.75px on emphasis |
| Scatter | r=4, 85% opacity |
| Regime band | Low-alpha rust wash with a 1px dashed edge, behind data |
| Uncertainty | Neutral fill, so a CI band is never mistaken for a series |
| Reference line | `4 4` dash, `--color-reference-line` |
| Crosshair | `3 3` dash, `--color-border-interactive` |
| Dimmed series | `--chart-dimmed-opacity` 0.28 on highlight |
| Provisional data | `--chart-provisional-dash` `5 4` plus a visible note |

### Series identity

`SERIES_IDENTITY` fixes colour + dash + marker per series. Enforced by test:
colours distinct, markers distinct, country dash patterns distinct, the
cyan/blue pair separated by both dash and marker, oil colour never assigned to a
series, and no country assigned a status colour. Worldwide uses `marker: "none"`
and a plain ink line so the aggregate subordinates to the five markets.

### Responsive behaviour

Charts change **layout** by band, not by scaling down.

- `dualAxisLayout(width)` returns `stacked-panels` below 768px. Two y-axes become
  unreadable at that width — tick density collapses and the reader cannot tell
  which axis a line belongs to. The correct adaptation is two vertically stacked
  single-axis panels sharing one x-domain.
- `axisTickBudget(width)` thins x-labels: 4 on mobile up to 12 on wide desktop.
- Heights are banded: `hero 420px`, `standard 360px`, `compact 300px`,
  `mobile 280px`, `sparkline 40px`.

### Interaction

`ChartInteractionCapabilities` is opt-in per chart, defaulting to
`NO_INTERACTIONS` (inspection only). Interaction is added because it answers an
analytical question, never because the library supports it.
`assertInteractionsCoherent` enforces two invariants: zoom or pan requires a
visible reset, and brush requires hover inspection.

---

## 6. Motion

`--duration-fast 140ms` (hover, focus, colour) · `--duration-medium 200ms`
(disclosure) · `--duration-slow 360ms` (section reveal, once only). Easing
`--ease-out`. Reveal offset is 12px — small enough that content never appears to
jump.

Only `transform` and `opacity` are animated. Nothing animates that delays
reading a number: no counting-up statistics, no dramatic chart entrances, no
scroll-linked effects.

`prefers-reduced-motion: reduce` is handled **globally**, not per component, so
a missed component cannot reintroduce motion. Durations collapse to 1ms rather
than being removed, which keeps state changes from flickering.

---

## 7. Focus and contrast

`--focus-ring` is a 2px `--color-focus-ring` ring at 2px offset. It is always
visible and never removed. Body text, secondary text and muted text all meet
WCAG AA on their intended surfaces; `--color-fg-subtle` is decorative only and
is never the sole carrier of meaning.

---

## 8. Implementation status

### Delivered in Phase 3C step 1

**Tailwind theme wiring.** `web/app/globals.css` maps these tokens onto Tailwind
utilities with `@theme inline`, using same-name self-reference so there is still
exactly one token system — this file remains the only place a value is defined.
Because the utilities resolve `var(--token)` at the element, the dark theme works
with **no `dark:` variants anywhere in the markup**.

The mapping is deliberately partial, and what it leaves out matters:

| Family | Handling |
| --- | --- |
| Colours, type roles, widths, overlay shadows | Mapped in `@theme inline` → `bg-surface`, `text-lead`, `max-w-reading`, `shadow-overlay` |
| `--font-*`, `--radius-*`, `--ease-*` | **Not mapped.** `tokens.css` already overrides the identically-named Tailwind defaults, so `font-sans`, `rounded-lg` and `ease-out` resolve to these values already |
| Spacing, weights, breakpoints | **Not mapped.** They coincide with Tailwind's defaults by design — `p-4` *is* `--space-4` |
| `--card-padding`, `--section-spacing`, `--grid-gap`, `--page-padding-inline` | **Not mapped on purpose.** They change value under 768px in this file; consumed as `p-(--card-padding)` so the responsive decision stays in one place |

Two rules from this document are now enforced by the build rather than by review:
Tailwind's **default colour palette is removed** (`--color-*: initial`), so
`bg-red-500` does not exist and §1's rejection of rainbow palettes cannot be
violated by accident; and **radius above `xl` is removed**, so `rounded-2xl`
cannot contradict §4's 12px cap.

Verified in-browser by `web/e2e/foundation.e2e.ts`: computed `background-color` in
both light and dark themes, and a country token resolving through the primitive
chain.

### Still deferred

Requires the component and chart layers, or a wider browser matrix:

- React component implementations (`Card`, `MetricCard`, `ReadMore`, …)
- The ECharts adapter that turns a `ChartTheme` into a library option object
- Rendered contrast measurement and visual QA
- Real responsive verification at each breakpoint
- Colourblind verification of the cyan/blue pair (chromium is the only installed
  engine)
