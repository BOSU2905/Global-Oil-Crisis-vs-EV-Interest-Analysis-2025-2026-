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

**Two weights in practice, three in the scale** (400/500/600). More weights is the
fastest route to looking generic — and 500 turns out not to be usable at all, for
the portability reason below.

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

**No type role may request weight 500.** This is a portability rule, not a taste
one, and it is enforced by `web/tests/typography-contract.test.ts` (declarations
and `font-medium` utilities) plus an E2E test asserting no element on the page
computes to 500. Emphasis uses `--weight-semibold`; `--weight-medium` is retained
as a scale value that no role consumes. The measurement behind it is in the next
subsection.

**Tabular figures are non-negotiable.** Any element rendering a number carries
`.numeric` or `[data-numeric]`, which applies `--font-numeric` with
`font-variant-numeric: tabular-nums`. Statistics in a column that do not align
look careless in a data product.

Uppercase is confined to section eyebrows at one size. Uppercase elsewhere is
what makes a dashboard look shouty.

**Headings wrap by `text-wrap: balance`.** With an OS-supplied typeface the same
heading occupies a different number of pixels on each machine, so a greedy break
lands somewhere different per OS — the h1 broke after "EV" on Segoe UI, leaving a
two-word second line. `balance` makes the break a function of line count rather
than of the face's advance widths, so wrapping is deliberate everywhere instead of
only on the author's machine. Applied to `h1`–`h4` in `globals.css`; browsers
without support ignore it, and Chromium limits balancing to short blocks so it
cannot reach prose.

### What is deterministic, and what the operating system decides

The system-stack decision above has a consequence worth stating plainly, because
it was mistaken for a defect when the project moved from a Linux laptop to a
Windows PC: **the project does not ship a typeface, so the typeface differs
between machines.** Nothing is downloaded, nothing falls back by accident, and
nothing is misconfigured — the stack delegates the choice of face to the OS, by
design.

Measured in Chromium 153.0.8010.12 (the Playwright build, identical on both
machines) on Windows 11:

| Declared entry | Resolves on Windows 11? |
| --- | --- |
| `ui-sans-serif`, `ui-monospace` | **no** — Safari-only keywords, ignored by Chromium |
| `system-ui` | **yes** — metrically identical to `"Segoe UI"`, so it wins the sans stack |
| `-apple-system`, `BlinkMacSystemFont`, `"Helvetica Neue"`, `"Noto Sans"` | no — absent |
| `Roboto`, `Arial` | installed, but never reached: `system-ui` precedes them |
| `SFMono-Regular`, `"SF Mono"`, `Menlo`, `"Liberation Mono"` | no — absent |
| `Consolas` | **yes** — wins the mono/numeric stack |

So on Windows the product renders in **Segoe UI** with **Consolas** for
statistics; on a stock Linux box `system-ui` resolves through fontconfig to that
machine's UI font and neither Segoe UI nor Consolas exists. Same CSS, different
glyphs.

Two knock-on effects follow from that, and both are real rather than cosmetic:

- **Weights are as available as the OS face makes them — so no role may use 500.**
  Measured by drawing the same string to a canvas at each weight and hashing the
  pixels: on Segoe UI, **500 and 600 produce an identical digest and an identical
  707.06px advance**, while 400 (696.41px) and 700 (741.38px) are distinct faces. A
  Linux face shipping only 400/700 renders 500 as 400. So a role set to 500 reads as
  emphasised on Windows and as body text on Linux — the *hierarchy*, not just the
  glyphs, would be chosen by the operating system.

  **Resolved:** emphasis uses `--weight-semibold`, which is a real face on Segoe UI
  and maps to 700 where only 400/700 exist — emphasised on both, differing only in
  degree. `--text-label-weight`, `--text-stat-weight`, the header identity and
  `StatHighlight` were moved off 500. On Windows this renders *identically* to
  before, because 500 already resolved to the 600 face there; the change is what
  Linux gains. Two tests hold the line: a unit test rejects any
  `--text-*-weight: var(--weight-medium)` declaration or `font-medium` utility, and
  an E2E test asserts no element on the page computes to weight 500.
- **`ch`-based measures change width with the face.** Under Segoe UI at 16px,
  `1ch` is 8.63px, so `--width-reading: 68ch` is 586.5px on body copy. A wider
  default face yields a wider column, which changes paragraph line counts and
  section heights. The `ch` unit is still right — it keeps the measure correct in
  characters — but it means identical CSS legitimately produces different wrapping
  per machine.

  A `min(68ch, 42rem)` ceiling was tried here to bound that drift and **rejected
  after measuring it**: `ch` scales with the element's own font size while `rem`
  does not, so a single ceiling binds on the 19px lead (clamping it to 65
  characters) and is inert on 16px body copy. A measure token that means different
  things per role is a worse defect than the wrapping drift it was meant to fix.
  The drift stays, documented and accepted.

**The typeface itself cannot be made consistent without shipping one.** Everything
the project controls — stacks, sizes, line-heights, tracking, weights, tabular
figures, measures, wrapping strategy — is now deterministic and asserted. The face
is not, and making it so is a product decision (choose and bundle a typeface) that
has not been taken.

`document.fonts.check()` must not be used to test any of this: it returned `true`
for `"Inter"`, `"DejaVu Sans"` and `"Cantarell"` on a machine with none of them
installed. Advance-width comparison against two sentinel families is the reliable
method.

What the project *does* own is asserted by `web/e2e/typography.e2e.ts` at 1280px
and 375px: the exact `--font-sans` / `--font-mono` / `--font-numeric` stacks, the
size, line-height, letter-spacing and weight of every role, tabular figures on
`.numeric`, uppercase only on eyebrows, that 400 and 600 are distinct faces, and
that the page requests **zero** font files and declares **zero** `@font-face`
rules — so the "no webfont, no build-time network dependency" rule is enforced by
the suite rather than by review. Which face the OS supplied is recorded as a test
annotation, not asserted, because asserting it would fail every machine that is
not the author's.

---

## 4. Spacing, layout, radius

4px base scale, `--space-0` … `--space-32`, named by step so the scale can be
retuned once.

### Widths

| Token | Value | Use |
| --- | --- | --- |
| `--width-page` | **1120px, → 1280px at ≥1536px** | **The frame.** Shared by the shell and the page body |
| `--width-chart` | 1280px | Widest a chart may be. Equals the frame at `2xl` |
| `--width-content` | 1120px | Section content inside the frame: cards, grids, tables |
| `--width-reading` | 68ch | Prose. **Prose never exceeds this** |
| `--width-title` | 22ch | Display-type measure. Goes on the heading, not a wrapper |
| `--width-narrow` | 52ch | Pull quotes, key-insight callouts |

Measure is capped in `ch`, not px, so it stays correct regardless of font size.

#### One frame, shared — and why that is the rule

`--width-page` used to be 1440px while the page body used `--width-content`
(1120px). Both were centred on the same axis, so the body's content sat **80px
inside the header's left edge at 1280px and 160px inside it at 1440px and 1920px** —
measured, not estimated: at 1920px the header identity started at x=264 and the h1
at x=424.

Two centred containers of different widths have no alignment spine. Nothing failed
and no gate noticed, but the composition read as a narrow column floating inside a
wider frame, which is precisely the impression §1 says the product must not give.

**The rule: the shell and the page body use the same `Container width="page"`.** A
`Container` nested inside the frame may narrow (`content`, `reading`, `narrow`), but
the frame itself is one decision. Enforced by a unit test asserting `Header`,
`Footer` and `page.tsx` all request `page` and none requests `content`, and by an
E2E test asserting the header identity, the body eyebrow, the `h1` and the footer
share one left edge at 375/1280/1440/1920.

#### The frame is banded, not fluid

1120px up to `2xl`, then 1280px. A step rather than a `clamp()`, for the same reason
charts adapt by band (§5): a frame that grows continuously makes every chart a
different width at every viewport. The boundary is the documented 1536px `2xl`, not
a new breakpoint, and above it the frame equals `--width-chart` — which is what
"prose stays readable, analytical visuals can breathe" resolves to concretely.

Frame coverage, measured: 100% at 375px, 87.5% at 1280px, 77.8% at 1440px, **66.7%
at 1920px** (58.3% before). The frame never exceeds `--width-chart`, because a frame
wider than the widest permitted chart is space no content variant could fill.

#### Display type does not borrow the prose measure

`--width-title` is 22ch and belongs on the heading element itself, because `ch`
resolves against the **element's own font size**: 22ch is ~733px on a 60px display
heading and ~343px on a 36px one, so the measure tracks the fluid heading scale with
no breakpoint logic.

`SectionHeader` previously capped eyebrow, title and lead together at
`--width-reading` on a wrapper. That is right for the lead and wrong for the title —
a 68-character measure for 16px prose confined a 60px heading to 586px, a third of a
1920px viewport, and broke the h1 mid-phrase. Each role now carries its own measure
and the wrapper carries none, which is also what lets the eyebrow, the title and the
section body share the frame's left edge.

A consequence worth knowing: moving `max-w-reading` onto the lead paragraph itself
made the token resolve against the lead's 19px font, so the lead's measure is ~696px
rather than the ~586px it got from a 16px wrapper. That is the 68-character rule
applied correctly; the old value was an artifact of where the cap sat.

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

### Decided direction for the chart implementation (Phase 3C step 5)

Recorded before the adapter is written so the visual language is settled rather
than negotiated per chart. Nothing here is implemented yet.

**Appearance.** Dark plotting treatment; restrained green as the primary
analytical signal; thin, precise data strokes; subtle axes and horizontal-only
gridlines; generous whitespace; editorial rather than dashboard. No generic
ECharts blue/orange/rainbow palette and no BI-style grid — `--chart-grid-dash: 0`
with no vertical lines is already the token expression of that, because vertical
gridlines add noise to a time series. `--color-oil` stays reserved and country
colours stay identifiers (§2).

**Interaction.** A contextual tooltip persists while the pointer is inside the
chart, updates as it moves across observations, and disappears on leaving the
interaction region. A paired oil/EV chart shows **both** variables for the same
weekly observation with the week visible. Event annotations — the elevated-price
window, the oil peak — stay visible without hover, because they are part of the
argument rather than a hover reward.

**Motion.** A subtle line draw-in on viewport entry, roughly 1–2s, once. Optional
very slow ambient emphasis only where it stays analytically quiet. The underlying
data points never move, and there is no continuous frame-by-frame React
re-rendering: animation belongs to the canvas, not the component tree. Hover and
analytical reading take priority over ambient motion, and `prefers-reduced-motion`
is honoured globally by §6 below rather than per component.

The principle, stated once: **the data stays still, the interface breathes.**

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

### Delivered in Phase 3C step 3

**Shell and layout components.** `AppShell`, `Header`, `Navigation`, `Footer`,
`Container`, `Section` and `SectionHeader` in `web/src/components/layout/`.
`Container` is the only component permitted to set a max width, and it exposes
exactly the five variants in §4 — a unit test asserts the set matches and that each
resolves to a `--width-*` token defined in this document's stylesheet.

**One token added: `--header-height`** (69px at `lg` and above, 98px below, where
the header stacks into two rows). It exists because the sticky header's height is
also the anchor offset every section needs: `Section` applies
`scroll-mt-(--header-height)` so a deep-linked heading is never covered. Both
values are measured against the rendered header by an E2E test at 1280px and
375px, so a change to the header's padding cannot silently break deep links.

Rhythm still needs no breakpoint logic in any component: `--page-padding-inline`,
`--section-spacing`, `--card-padding` and `--grid-gap` swap below 768px inside
`tokens.css`, and `--header-height` swaps at 1024px because it follows the
header's own layout change rather than the page gutters.

Section rhythm is applied as `margin-top` rather than padding, because
`scroll-margin-top` positions the border box — a margin keeps the visual rhythm
while letting a deep link land on the heading instead of the space above it.

### Delivered in the Phase 3C visual refinement pass

A focused typography and composition pass between steps 4 and 5, driven by a
1920×1080 Windows preview. No component was added and no colour, radius, motion or
spacing token changed.

| Change | Why |
| --- | --- |
| `--width-page` 1440px → **1120px, banded to 1280px at ≥1536px**, and the page body moved from `content` to `page` | The shell and body were two centred frames of different widths, insetting body content 80–160px from the header's left edge. One frame gives the composition a spine and lifts 1920px coverage from 58.3% to 66.7% |
| `--width-title: 22ch`, applied to the heading; `SectionHeader`'s wrapper measure removed | A 60px display heading was capped at the 16px prose measure |
| `text-wrap: balance` on `h1`–`h4` | With an OS-supplied face, a greedy break lands differently per machine |
| `--text-label-weight` and `--text-stat-weight` → `--weight-semibold`; `font-medium` → `font-semibold` in `Header` and `StatHighlight` | Weight 500 is not a distinct face: pixel-identical to 600 on Segoe UI, collapses to 400 on a 400/700-only face |

Verified by measurement at 375/1280/1440/1920: zero horizontal overflow at all four,
one shared left edge at all four, prose within the measure, mobile unchanged. Nine
E2E tests and ten unit tests were added to hold it.

### Still deferred

Requires the component and chart layers, or a wider browser matrix:

- The ECharts adapter that turns a `ChartTheme` into a library option object
- Rendered contrast measurement and visual QA
- Colourblind verification of the cyan/blue pair (chromium is the only installed
  engine)
- The header's condense-on-scroll and a theme toggle. Both are listed in
  `product-architecture.md` §4 and both were deliberately deferred in step 3: the
  first makes the header height dynamic, which is the value every section anchor
  depends on, and the second needs persistence plus an inline script to avoid a
  wrong-theme first paint. Neither blocks the product — both themes already ship
  through `prefers-color-scheme`
- Multi-column evidence layouts inside a section (§7's `≥1280` row). The frame now
  has the width for them, but nothing in the scaffold needs one yet; a grid added
  before there is content to justify it is the dense-card-grid outcome §1 rejects
