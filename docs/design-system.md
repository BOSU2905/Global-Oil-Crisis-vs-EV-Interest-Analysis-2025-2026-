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

| It should feel                    | It must not feel                           |
| --------------------------------- | ------------------------------------------ |
| Analytical, editorial, restrained | Like a BI dashboard or admin panel         |
| Premium and deliberately composed | Like a component-library demo              |
| Highly readable, data-first       | Like a crypto/dark-only analytics template |
| Calm and confident                | Busy, gradient-heavy, emoji-labelled       |
| Trustworthy about its own limits  | Like a KPI wall of big meaningless numbers |

Two rules follow from this, and they drive most of the token decisions:

1. **The interface recedes; the data does not.** UI chrome uses deep, slightly
   desaturated colour. Saturated hue appears _only_ in the data palette. This is
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

| Token                        | Light     | Purpose                                                     |
| ---------------------------- | --------- | ----------------------------------------------------------- |
| `--color-bg`                 | `#fcfcfd` | Page ground                                                 |
| `--color-surface`            | `#ffffff` | Cards, panels                                               |
| `--color-surface-raised`     | `#f7f8f9` | Hover, nested surfaces                                      |
| `--color-surface-sunken`     | `#eff1f3` | Wells, table headers                                        |
| `--color-border`             | `#e6e8eb` | Hairline, default                                           |
| `--color-border-strong`      | `#d8dbdf` | Emphasis, axis lines                                        |
| `--color-border-interactive` | `#b9bfc5` | Hover borders, crosshair                                    |
| `--color-fg`                 | `#0b0d0e` | Primary text                                                |
| `--color-fg-secondary`       | `#545c63` | Supporting prose                                            |
| `--color-fg-muted`           | `#6e767d` | Captions, axis labels                                       |
| `--color-fg-subtle`          | `#8f979f` | Decorative only — fails AA at body size, never load-bearing |

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

| Country       | Token                       | Light             |
| ------------- | --------------------------- | ----------------- |
| Indonesia     | `--color-country-indonesia` | `#db2777` pink    |
| Malaysia      | `--color-country-malaysia`  | `#7c3aed` violet  |
| Norway        | `--color-country-norway`    | `#059669` emerald |
| Singapore     | `--color-country-singapore` | `#0891b2` cyan    |
| United States | `--color-country-us`        | `#2563eb` blue    |

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

**Geist, self-hosted from the `geist` npm package.** No `next/font/google`, no
remote font URL, no build-time network dependency, no font file committed to this
repository, and no dependency on a font being installed on the viewing machine.

- `--font-display` / `--font-sans` — **Geist Sans**, via `var(--font-geist-sans)`
  with an explicit generic tail
- `--font-mono` / `--font-numeric` — **Geist Mono**, via `var(--font-geist-mono)`

This is the third and final position on a question the project has answered twice
before, and the history matters because each answer was correct for its premise:

|                 | Face chosen by                  | Consequence                                     |
| --------------- | ------------------------------- | ----------------------------------------------- |
| Original        | `system-ui`, i.e. the OS        | Segoe UI on Windows, fontconfig's pick on Linux |
| SF Pro pass     | the OS, if SF Pro was installed | still per-machine; degraded to `system-ui`      |
| **Geist (now)** | **the dependency tree**         | **identical on every machine**                  |

### How it arrives

`geist` is an exact-pinned runtime dependency with no transitive dependencies. It
calls `next/font/local` on two **variable** `.woff2` files inside
`node_modules/geist/dist/fonts/`, and exposes each as a class name that declares one
custom property:

```tsx
// app/layout.tsx — the only file that names a face
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

<html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
```

The class goes on `<html>`, not `<body>`, and that is load-bearing: `<html>` **is**
`:root`, which is where `tokens.css` declares the font tokens. A custom property set
on `<body>` is invisible to a `var()` in a `:root` rule, so the tokens would silently
take their fallback chain.

Next emits the `@font-face` rules, copies the files into `/_next/static/media/` at
build time and serves them same-origin. So a page load now makes **exactly two**
font requests, both from this origin, where it previously made zero. That reversal is
deliberate and the E2E suite asserts the _new_ rule rather than dropping the old one:
every font request must be same-origin under `/_next/static/media/`, nothing may come
from a font provider, and every `@font-face` family must match `/^Geist/`.

### Two faces, two purposes — and not every number is monospace

| Treatment                     | Face                   | For                                                                                                                                                                          |
| ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| default                       | Geist Sans             | all prose, headings, labels, navigation, UI                                                                                                                                  |
| `.tabular` / `[data-tabular]` | Geist Sans (inherited) | **human-facing figures** — observation period, weekly observation count, market count, metric-card figures, confidence intervals, narrative ordinals, inline `StatHighlight` |
| `.numeric` / `[data-numeric]` | Geist Mono             | **technical identifiers** — FRED series ids, content hashes, pipeline versions, filenames                                                                                    |

**Tabular figures are non-negotiable**, so both utilities apply
`font-variant-numeric: tabular-nums` and `font-feature-settings: "tnum" 1`. They
differ only in face. The question a caller answers is not "is this a number?" but
"is this a value a reader reads, or an identifier a reader copies?" — a date range
or a count set in monospace makes an analytical page look like console output.

That the alignment is load-bearing is measured, not assumed: Geist Sans's figures
are **proportional** by default. At 400/40px, `"111111"` is 80px wide against
`"000000"` at 162px; with `tabular-nums` both are 144px. Without the utility a
column of metric cards would visibly misalign.

### The type roles

| Role              | Token prefix          |  Weight | Notes                                                               |
| ----------------- | --------------------- | ------: | ------------------------------------------------------------------- |
| Display           | `--text-display-*`    | **500** | Hero only. `clamp(2.25rem → 3.75rem)`, tracking `-0.028em`          |
| Heading 1         | `--text-h1-*`         |     600 | Fluid to 2.75rem                                                    |
| Heading 2         | `--text-h2-*`         |     600 | Fluid to 2rem                                                       |
| Heading 3         | `--text-h3-*`         |     600 | 1.25rem fixed                                                       |
| Heading 4         | `--text-h4-*`         | **500** | 1.0625rem. Also the header wordmark                                 |
| Lead              | `--text-lead-*`       |     400 | The analytical thesis under a section heading                       |
| Body              | `--text-body-*`       |     400 | `1rem / 1.68`                                                       |
| Small             | `--text-small-*`      | **400** | Secondary prose, navigation links, disclosures                      |
| Metadata          | `--text-meta-*`       | **400** | Sources, footnotes, captions, metric-card labels                    |
| Label             | `--text-label-*`      | **500** | Section eyebrows and `Badge`. **The only uppercase in the product** |
| Statistic         | `--text-stat-*`       |     600 | Large numeric display                                               |
| Statistic (small) | `--text-stat-small-*` | **500** | The metric-card figure                                              |
| Data              | `--text-data-*`       |       — | Axis ticks. Weight comes from `--chart-*` tokens                    |

Bold values changed in the Geist migration. `small` and `meta` previously declared
no weight at all and inherited the body's, which meant `globals.css` never emitted a
`font-weight` for them — a hierarchy that happened rather than one that was decided.

### The weight scale, and the rule that was retired

Four steps: `--weight-regular` 400, `--weight-medium` **500**, `--weight-semibold`
600, `--weight-bold` 700. Three are used by roles; 700 is declared and deliberately
unused.

**The rule "no type role may request weight 500" is retired, and its premise is why.**
That rule was measured and correct while the face came from the operating system:

- on Segoe UI, 500 and 600 produced an identical pixel digest and an identical
  **707.06px** advance, so 500 bought nothing;
- a Linux face shipping only 400/700 rendered 500 as **400**, i.e. as body text;
- SF Pro Display as installed had no upright Semibold cut, so 600 resolved to the
  **Bold** cut and 600/700 were indistinguishable.

Every one of those is a property of a font the machine supplied. None can occur now.
Both Geist files carry a **`100 900` variable weight axis**, so every integer step is
an instance the file interpolates from the same bytes on every machine, and CSS
font-matching never synthesizes a weight that the family already covers.

Verified against the build rather than assumed. Drawing one string at 100…900 in
Chromium 153 gives **nine distinct pixel digests** for each face; Geist Sans's
advance grows monotonically from 700px to 811px, while Geist Mono's stays fixed at
798px at every weight — which is exactly right for a monospace face, where weight
changes stem thickness and never advance.

**The replacement rule is stricter, not looser.** Every `--text-*-weight` must
resolve to a declared step on the scale (a raw number or an undeclared token fails),
every sized role must declare a weight, no element may compute a weight outside
400/500/600/700, no role at 20px or below may exceed 500, and each declared step must
render as a genuinely distinct face. Enforced by
`web/tests/typography-contract.test.ts` at source level and
`web/e2e/typography.e2e.ts` in the browser.

### The mapping is audited, and the measure is ink coverage

The weights above were re-decided against the rendered build rather than carried over
from SF Pro, because a weight _number_ does not tell you how bold something looks:
600 at 12px uppercase is denser per unit area than 600 at 60px display. The measure
used is **ink coverage** — the share of a string's bounding box that is ink, at the
role's own size.

Measured on Geist Sans in Chromium 153:

| Role                       | Size |    300 |        400 |        500 |    600 |    700 |  Chosen |
| -------------------------- | ---: | -----: | ---------: | ---------: | -----: | -----: | ------: |
| display (hero)             | 60px |      — |     23.72% | **28.27%** | 31.73% | 34.71% | **500** |
| label (eyebrow, badge)     | 12px |      — |     30.60% | **35.53%** | 40.32% |      — | **500** |
| h4 (wordmark)              | 17px |      — |     27.42% | **30.24%** | 34.43% |      — | **500** |
| stat-small (metric figure) | 17px |      — |     27.91% | **32.21%** | 35.62% |      — | **500** |
| small (nav link)           | 15px | 22.20% | **26.88%** |     32.77% |      — |      — | **400** |

Four decisions follow from that table:

- **The hero is 500, not 600.** 700 (34.71%) is the "excessively bold" end and 600
  (31.73%) was close enough to it to read as a marketing headline rather than an
  analytical title. Tracking at `-0.028em` supplies the density weight was doing.
- **`display` is a step LIGHTER than `h2`, and that is optical sizing rather than an
  inverted hierarchy.** The larger the type, the less weight it needs to dominate:
  the hero is nearly twice the size of a section heading. Hierarchy is carried by
  size, tracking and colour; weight only separates emphasis from prose.
- **Eyebrows and country badges drop to 500.** Uppercase at 12px with `0.075em`
  tracking is the densest type on the page per unit area — all cap-height, spaced —
  and 600 measured 40.32% against the hero's 31.73%, so every eyebrow read as heavier
  than the title above it.
- **The navigation rail stays at 400.** 300 was measured (22.20%) and rejected: a
  thinner stroke at 15px on `--color-fg-muted` degrades perceived legibility even
  where the computed contrast ratio still passes. The rail was already at prose
  weight; what got lighter beside it is the wordmark, 600 → 500.

Uppercase is confined to section eyebrows and `Badge`, at one size. Uppercase
elsewhere is what makes a dashboard look shouty.

### Editorial case: titles are Title Case, prose and controls are not

| Kind                              | Case           | Examples                                                   |
| --------------------------------- | -------------- | ---------------------------------------------------------- |
| Section eyebrow                   | **Title Case** | `Analytical Foundation`, `Cross-Market Comparison`         |
| Section / subsection title        | **Title Case** | `Observation Scope`, `Narrative Structure`                 |
| Metric-card label                 | **Title Case** | `Observation Period`, `Weekly Observations`                |
| Badge, callout kind               | **Title Case** | `Provisional`, `Guardrail`                                 |
| Lead, body copy, caveat sentences | sentence case  | "The finished product is one long-scroll argument…"        |
| Controls                          | sentence case  | `Read more`, `Show less`, `What that means for the charts` |

Chicago-style, not AP: articles, coordinating conjunctions and prepositions stay
lowercase unless they lead or close the title, so the hero keeps a lowercase "vs" in
`Global Oil Crisis vs EV Interest Analysis`. Both halves of a hyphenated compound are
capitalised — `Cross-Market`, not `Cross-market`.

**The case lives in the content string, and there is no runtime title-caser.** A
transform would have to guess at `vs`, `EV`, `Cross-Market` and every proper noun the
narrative sections introduce, and it would mangle the one it guessed wrong while
looking correct in review. Three tests in `web/tests/layout-contract.test.ts` enforce
the convention instead: the helper is checked against known-good and known-bad strings
before anything trusts it, every `eyebrow=` / `title=` / `label:` on the page must be
Title Case, and every `lead=` must **not** be — that last one stops an
over-correction from turning a section thesis into a headline.

A section eyebrow is worth a note of its own: it renders through
`text-transform: uppercase`, so its source casing has **no visible effect**. It is
still Title Case in the string, because `text-transform` does not change the
accessible name — a screen reader reads the DOM text, so sentence case there would be
announced as sentence case while the page showed upper case.

**Headings wrap by `text-wrap: balance`.** The face is identical on every machine
now, so a greedy break would at least be _consistent_ — but the display size is
fluid across a `clamp()` range, so a greedy break still lands somewhere different at
every viewport. `balance` makes it depend on line count instead. Applied to `h1`–`h4`
in `globals.css`; browsers without support ignore it, and Chromium limits balancing
to short blocks so it cannot reach prose.

### What is now deterministic, and the one caveat that is not

Everything the project controls is deterministic and asserted: the face, the stacks,
sizes, line-heights, tracking, weights, tabular figures, measures and wrapping
strategy. The per-machine typeface difference that this document previously recorded
as an accepted limitation **is resolved** — the same bytes render on every machine.

Two caveats remain, both measured:

- **`next/font`'s metric-adjusted fallback face does not load on a machine without
  Arial.** The audit found three `@font-face` entries: `GeistSans [100 900]` loaded,
  `GeistMono [100 900]` loaded, and `GeistSans Fallback [normal]` with
  `status: "error"`. That third face is built on a local Arial, which is absent on
  this Linux box. It matters only during the `font-display: swap` window before the
  real font arrives, and it means there is no metric-matched fallback on such a
  machine — a swap would shift layout rather than being size-adjusted.
- **The package's sans chain does not terminate in a generic family.**
  `--font-geist-sans` resolves to exactly `"GeistSans", "GeistSans Fallback"`. With
  the fallback face erroring, a failed `.woff2` load would run off the end of the
  chain and take the UA default serif. `tokens.css` therefore appends an explicit
  tail ending in `sans-serif`, and a unit test asserts it. Geist Mono needs no tail:
  the package already ships a full monospace chain ending in `monospace`.

`ch`-based measures are unaffected in principle but their absolute width is now
fixed: `--width-reading: 68ch` resolves to one number everywhere, so paragraph
wrapping no longer differs per machine. The `min(68ch, 42rem)` ceiling that was tried
and rejected stays rejected — it resolved differently per role, binding on the 19px
lead and inert on 16px body copy, which was a worse defect than the drift it targeted.

`document.fonts.check()` must not be used to test any of this: it returned `true` for
`"Inter"`, `"DejaVu Sans"` and `"Cantarell"` on a machine with none of them
installed. Enumerating `document.fonts` for family/weight/status, and comparing
advance widths against a forced-fallback sentinel, are the reliable methods — both
are what the audit and the E2E suite use.

`web/e2e/typography.e2e.ts` asserts, at 1280px and 375px: the exact `--font-display`
/ `--font-sans` / `--font-mono` / `--font-numeric` stacks in both their token and
computed forms; the size, line-height, letter-spacing **and weight** of every role;
that human-facing figures render in Geist Sans with tabular figures and identifiers
in Geist Mono; that `tabular-nums` is load-bearing; that uppercase appears only on
eyebrows; that 400/500/600/700 are four distinct faces with monotonically increasing
ink in each family; that no element computes a weight off the scale; and that every
font byte comes from this origin.

---

## 4. Spacing, layout, radius

4px base scale, `--space-0` … `--space-32`, named by step so the scale can be
retuned once.

### Widths

| Token             | Value                           | Use                                                      |
| ----------------- | ------------------------------- | -------------------------------------------------------- |
| `--width-page`    | **1120px, → 1280px at ≥1536px** | **The frame.** Shared by the shell and the page body     |
| `--width-chart`   | 1280px                          | Widest a chart may be. Equals the frame at `2xl`         |
| `--width-content` | 1120px                          | Section content inside the frame: cards, grids, tables   |
| `--width-reading` | 68ch                            | Prose. **Prose never exceeds this**                      |
| `--width-title`   | 22ch                            | Display-type measure. Goes on the heading, not a wrapper |
| `--width-narrow`  | 52ch                            | Pull quotes, key-insight callouts                        |

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

| Element          | Treatment                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Axis labels      | `--font-numeric`, `--text-data-size`, `--color-fg-muted`                                  |
| Gridlines        | **Horizontal only**, 1px, `--color-border`. Vertical gridlines add noise to a time series |
| Tooltip          | Surface + hairline border + mono numerals. Never the library default                      |
| Legend           | `--text-meta-size`, inactive entries drop to `--color-fg-subtle`                          |
| Lines            | 2px, 2.75px on emphasis                                                                   |
| Scatter          | r=4, 85% opacity                                                                          |
| Regime band      | Low-alpha rust wash with a 1px dashed edge, behind data                                   |
| Uncertainty      | Neutral fill, so a CI band is never mistaken for a series                                 |
| Reference line   | `4 4` dash, `--color-reference-line`                                                      |
| Crosshair        | `3 3` dash, `--color-border-interactive`                                                  |
| Dimmed series    | `--chart-dimmed-opacity` 0.28 on highlight                                                |
| Provisional data | `--chart-provisional-dash` `5 4` plus a visible note                                      |

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

| Family                                                                       | Handling                                                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colours, type roles, widths, overlay shadows                                 | Mapped in `@theme inline` → `bg-surface`, `text-lead`, `max-w-reading`, `shadow-overlay`                                                                            |
| `--font-*`, `--radius-*`, `--ease-*`                                         | **Not mapped.** `tokens.css` already overrides the identically-named Tailwind defaults, so `font-sans`, `rounded-lg` and `ease-out` resolve to these values already |
| Spacing, weights, breakpoints                                                | **Not mapped.** They coincide with Tailwind's defaults by design — `p-4` _is_ `--space-4`                                                                           |
| `--card-padding`, `--section-spacing`, `--grid-gap`, `--page-padding-inline` | **Not mapped on purpose.** They change value under 768px in this file; consumed as `p-(--card-padding)` so the responsive decision stays in one place               |

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

| Change                                                                                                                                | Why                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--width-page` 1440px → **1120px, banded to 1280px at ≥1536px**, and the page body moved from `content` to `page`                     | The shell and body were two centred frames of different widths, insetting body content 80–160px from the header's left edge. One frame gives the composition a spine and lifts 1920px coverage from 58.3% to 66.7%                                                                                                                                              |
| `--width-title: 22ch`, applied to the heading; `SectionHeader`'s wrapper measure removed                                              | A 60px display heading was capped at the 16px prose measure                                                                                                                                                                                                                                                                                                     |
| `text-wrap: balance` on `h1`–`h4`                                                                                                     | With an OS-supplied face, a greedy break lands differently per machine. (Still applied under Geist, for a different reason: the display size is fluid across a `clamp()` range)                                                                                                                                                                                 |
| `--text-label-weight` and `--text-stat-weight` → `--weight-semibold`; `font-medium` → `font-semibold` in `Header` and `StatHighlight` | Weight 500 is not a distinct face: pixel-identical to 600 on Segoe UI, collapses to 400 on a 400/700-only face. (**Partly superseded**: with Geist bundled, 500 is a real interpolated instance, so `--text-label-weight` returned to it and both components moved back to 500 — `Header` by dropping its override entirely. `--text-stat-weight` stays at 600) |

Verified by measurement at 375/1280/1440/1920: zero horizontal overflow at all four,
one shared left edge at all four, prose within the measure, mobile unchanged. Nine
E2E tests and ten unit tests were added to hold it.

### Delivered in the Geist typography migration

Also between steps 4 and 5, after a brief SF Pro pass that named the face by name but
still depended on it being installed. Typography only: no colour, radius, motion or
spacing token changed, no component was added or removed, and no analytical file was
touched. Full rationale and measurements in §3.

| Change                                                                                                                                       | Why                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geist` 1.7.2 as an exact-pinned runtime dependency; `GeistSans.variable` + `GeistMono.variable` on `<html>` in `app/layout.tsx`             | The typeface becomes a dependency instead of a property of the viewing machine. Self-hosted from `node_modules` into `/_next/static/media/` — no font file in the repository, no OS install, no remote URL                                                                                    |
| `--font-display` / `--font-sans` → Geist Sans; `--font-mono` / `--font-numeric` → Geist Mono                                                 | The display/prose token split is kept even though Geist ships one optical size, because the _roles_ still differ — giving display type its own face later is a one-line token change                                                                                                          |
| An explicit generic tail on the sans chain                                                                                                   | Measured: the package's `--font-geist-sans` is only `"GeistSans", "GeistSans Fallback"` and does not terminate in a generic family, while that fallback face errors on a machine without Arial                                                                                                |
| New `.tabular` / `[data-tabular]`: tabular figures with **no** family declaration                                                            | Human-facing figures — coverage dates, counts, ordinals, inline stats — kept the monospace face and read as console output. `.numeric` is now reserved for identifiers a reader transcribes                                                                                                   |
| `--weight-bold: 700` added; the "no role may use 500" rule **retired and replaced**                                                          | Its premise was an OS-supplied face. Geist's `100 900` variable axis interpolates every step from the same bytes everywhere, verified as nine distinct pixel digests per face. The replacement rule is stricter: every role weight must be a declared step, and none may fall outside 400–700 |
| `display` 600 → **500**; `h4` 600 → **500**; `label` 600 → **500**; `stat-small` 600 → **500**; `small` and `meta` given an explicit **400** | Audited by ink coverage at each role's own size, not carried over from SF Pro. The hero at 600 measured 31.73% against 700's 34.71% and read as a marketing headline; uppercase 12px at 600 measured 40.32%, denser than the hero itself                                                      |
| `Header` dropped its `font-semibold` override; the wordmark now takes `--text-h4-weight`                                                     | A component override is how a component quietly opts out of the type scale. The override existed only as a portability workaround that no longer applies                                                                                                                                      |

Verified by a bounded Chromium audit over 22 representative roles on the production
build: every role draws in its intended face, no unintended fallback anywhere, no
weight synthesis, exactly two same-origin font requests, and `tabular-nums` shown to
be load-bearing. The audit spec was temporary and was deleted; what it established is
recorded in §3 and asserted by six new unit tests and six new E2E tests.

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
