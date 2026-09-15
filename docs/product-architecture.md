# Product Architecture

Locked decisions for the Phase 3B frontend: information architecture, hero
direction, component contracts, accessibility requirements, and the disclosure
pattern. Visual tokens are in [`design-system.md`](design-system.md); the data
contract is in [`frontend-data-contract.md`](frontend-data-contract.md).

Everything here is a **contract to implement**, not implemented code. No React
component exists yet.

---

## 1. Information architecture

One long-scroll narrative page, deep-linkable by anchor, with a sticky header and
scrollspy. The page is an argument, and arguments are read in order.

**No separate country routes.** Country analysis lives inside the narrative flow,
selected by an in-page control whose state is reflected in the URL hash. Separate
routes would let a reader reach a country conclusion without the evidence that
qualifies it, and would fragment SEO for what is one coherent piece of work.

```
01  Overview              thesis, period, markets, the tension
02  Oil Shock             what the price series did
03  EV Interest           what search interest did, per market
04  Global Relationship   level co-movement, stated with its limit
05  Robustness            ← the specification comparison
06  Country Divergence    scale-free cross-market comparison
07  Country Deep Dives    per-market evidence + key insight + Read More
08  Interpretation        the editorial framework
09  Limitations           what this analysis cannot support
10  Conclusion            what the complete analysis tells us
```

### One addition to the requested structure

The requested arc had nine sections and no dedicated slot for the robustness
result. The decision memo requires it to be first-class, so **Robustness is its
own section (05)**, placed immediately after the global relationship.

The sequencing matters: the reader sees the strong level correlation, learns
straight away that it does not survive first differencing, and *then* reaches
country divergence — which makes the divergence the analytical payoff rather
than a footnote. Burying this in section 09 would repeat the original project's
error in better typography.

Navigation labels may be shortened for the header (e.g. "Robustness",
"Divergence"), but the order is fixed.

---

## 2. Hero contract

The hero establishes the **question and the tension**, not a result.

**Primary statement:**

> When oil prices surge, does EV search interest move with them — and does that
> relationship hold across markets?

**It must communicate:** the oil shock, EV interest, cross-country divergence,
and uncertainty.

**It must NOT** lead with a correlation coefficient. `r = 0.747` as a hero
number would be actively misleading: the relationship does not survive first
differencing in any market, and no series reaches
`robust_positive_association`. A single coefficient is not this project's
thesis.

**Required elements**

| Element | Source |
| --- | --- |
| Question as the display headline | Editorial |
| One-sentence thesis naming the tension | Editorial, per decision memo §1 |
| Observation period | `panel.coverage.first_week` / `last_week` |
| Markets analysed | `metrics.countries` + registry labels |
| A small visual carrying oil ↑, interest ↑, and divergence | `panel.rows` |
| A direct route to Robustness (05) | Anchor link |

**The first analytical tension, stated in the hero region:** strong level
co-movement versus weak short-run/differenced evidence. The specification
comparison must be reachable in one interaction from the hero — an anchor, not a
scroll hunt.

Permitted supporting figures: the number of weeks, the number of markets, the
oil peak, and the count of markets with no detectable association. Each must be
read from the artifacts, never typed as a literal.

---

## 3. Executive interpretation framework

Editorial structure, derived from the corrected metrics. Not a statistical
calculation, and **not** hard-coded as one.

| Panel | Members | Claim |
| --- | --- | --- |
| **The Subsidized Buffer** | Indonesia | No relationship to crude prices detectable; interest fell as prices rose |
| **The Maturity Gap** | Norway + Singapore | Norway shows no relationship; Singapore responds but only during the price spike |
| **The Co-Movement Case** | United States + Worldwide | The clearest co-movement in the data — and the clearest illustration of why co-movement is not enough |
| **Malaysia** | Malaysia | A separate inconclusive case: interest rose sharply, and this data cannot attribute that to oil |

### Hard rules

1. **"The Proactive Shift" must not appear.** Its `category_review` verdict is
   `not_supported`: Malaysia is inconclusive (r = 0.220, p = 0.242) and the US is
   level-only. Do not render its original claim.
2. **Malaysia must not be presented as a Proactive Shift**, and must not be
   forced into another panel. It is a 3 + 1 composition, and the asymmetry is
   honest — designing for symmetry here would misrepresent the analysis.
3. **Every panel displays `requires_external_evidence`.** All three carry it as
   `true`. The panel *names* assert mechanisms — subsidy buffering, market
   maturity — that a price series and a search index cannot establish. Present
   them as an editorial framework, never as discovered clusters.
4. Panel membership and verdicts come from `metrics.category_review` and
   `metrics.global.evidence_groups`, never from literals in components.
5. **Singapore's statistical classification is `level_only_association`, and the
   editorial panel must never obscure it.** The two groupings are different kinds
   of object and must not be conflated:

   | | Grouping | Authority |
   | --- | --- | --- |
   | Statistical | `level_only_association` — Singapore with the **United States** | `metrics.json` → `classification.evidence_group`. Authoritative. |
   | Editorial | **The Maturity Gap** — Singapore with **Norway** | This document and the decision memo. Interpretive. |

   Singapore appears beside Norway for an *interpretive* reason (market maturity),
   not because the measurements group them together — they do not. Norway is
   `no_detectable_association`; Singapore is `level_only_association` with
   r = 0.580, p = 0.0008.

   Therefore, wherever Singapore is rendered inside The Maturity Gap, its
   evidence group must be visible in the same view, and the panel must be marked
   as an editorial grouping. The product must never state or imply that Singapore
   shows no level association. The honest form of the claim is the decision
   memo's: Singapore responds, but the association is carried by the price spike
   and does not survive its removal (`loses_significance_without_elevated_regime`,
   baseline-only r = 0.304, p = 0.132).

---

## 4. Component contracts

Only components with a justified use. Each is listed with its responsibility and
the artifact fields it reads.

### Shell and layout

| Component | Responsibility |
| --- | --- |
| `AppShell` | Theme attribute, skip link, header + main + footer landmarks |
| `Header` | Product identity, navigation, theme toggle. Sticky with a hairline bottom border; condenses on scroll |
| `Navigation` | Section links reflecting the narrative (§1). Scrollspy via `IntersectionObserver`. Mobile: sheet or drawer. Anchors deep-linkable with `scroll-margin-top` clearing the header |
| `Container` | Width constraint by variant: `page` / `chart` / `content` / `reading` / `narrow` |
| `Section` | `<section>` with id, scroll margin, vertical rhythm, optional reveal-on-enter |
| `SectionHeader` | Eyebrow label (`01 — OVERVIEW`), title, optional lead paragraph |

### Content

| Component | Responsibility |
| --- | --- |
| `Card` | Surface + hairline border + `radius-lg`. **No shadow.** Padding from `--card-padding` |
| `MetricCard` | One statistic: label, value (tabular figures), unit, optional interval, optional caveat badges |
| `StatHighlight` | Inline statistic inside prose, mono + tabular |
| `InsightCard` | `KEY INSIGHT` eyebrow, 1–2 line summary, `ReadMore` for detail, caveat badges |
| `Badge` | Caveat codes, evidence groups, verdicts. Text + shape, never colour alone |
| `SourceNote` | Attribution from `manifest.sources[]`. No hard-coded URLs |
| `ReadMore` | §6 |
| `CountrySelector` | Country choice, URL-hash synced, shared by sections 06–07. Keyboard-navigable tabs; native select or scrollable chips on mobile |
| `Callout` | Limitation/caveat block using status surfaces. Used for the normalisation constraint and the differencing result |

### Charts

| Component | Responsibility |
| --- | --- |
| `ChartFrame` | Card shell for a visualisation: eyebrow, title, one-line "what to look for", chart slot, controls slot, source, and the fallback toggle. Owns loading/empty/error states |
| `EChart` | Thin client wrapper: lazy mount via `IntersectionObserver`, `ResizeObserver` → `resize()` debounced ~100ms, `dispose()` on unmount, theme resolved once per theme change |
| `ChartControls` | Only the interactions a chart declares. Reset is mandatory whenever zoom or pan is enabled |
| `ChartTableFallback` | The tabular twin of every chart. First-class, always reachable, never `display:none`-only |

### Deliberately not built

No generic `Grid`/`Flex`/`Box` primitives (CSS handles it), no `Modal` until
something needs one, no `Tooltip` separate from Radix, no chart type that has no
question to answer.

---

## 5. Accessibility contract

Requirements the Phase 3B implementation must satisfy. Listed as a contract
because writing placeholder a11y code now would be worse than writing none.

### Charts

1. **Meaningful title** — specific, not "Figure 1".
2. **Contextual description** — one sentence naming what to look for.
3. **Long description** — states the finding, not just the axes. Available to
   screen readers.
4. **Tabular fallback** — `ChartTableFallback` for every chart, reachable by a
   visible control and exposed to assistive technology. Canvas charts are opaque
   to screen readers, so the table is the accessible representation, not a
   courtesy.
5. **No hover-only critical information.** Anything only obtainable by hovering
   must also exist in the table or in prose.
6. **Keyboard access** — the chart region is focusable; ←/→ step the axis
   pointer; all controls are reachable and operable by keyboard.
7. **Not colour alone** — colour plus dash plus marker plus direct label
   (enforced by `chart-language.test.ts`).
8. **Provisional data marked visibly** — the single-trading-day week is dashed
   *and* footnoted, never distinguished by colour alone.

`ChartAccessibilityContract` in `chart-language.ts` makes title, description,
long description, table columns, source and the provisional flag **required**
arguments, so a chart cannot ship without them.

### Page

Semantic landmarks (`header`/`nav`/`main`/`footer`), one `h1`, no skipped heading
levels, a skip-to-content link, visible focus rings never removed, WCAG AA
contrast for all text carrying meaning, `prefers-reduced-motion` honoured
globally, tap targets ≥44px, and no information conveyed by colour alone
anywhere.

### Verification (Phase 3B, requires a browser)

axe-core in CI, a manual screen-reader pass, a full keyboard-only pass, and
colourblind verification of the cyan/blue pair.

---

## 6. ReadMore contract

A disclosure for supporting detail. **Not** built yet — this is its interface.

```ts
interface ReadMoreProps {
  /** Always-visible summary. Must stand alone as a complete statement. */
  summary: ReactNode;
  /** Expanded detail: context, observation, interpretation, caveat. */
  children: ReactNode;
  /** Accessible label for the toggle. Default: "Read more". */
  label?: string;
  /** Start expanded. Default false. */
  defaultOpen?: boolean;
  /** Stable id, so the open state can be deep-linked. */
  id: string;
}
```

### Behaviour

| Requirement | Detail |
| --- | --- |
| Default state | Concise summary visible; detail collapsed |
| Toggle | Real `<button>`, `aria-expanded`, `aria-controls` pointing at the panel |
| Keyboard | Enter/Space toggles; Escape closes when open; focus never trapped |
| Motion | Height + opacity over `--duration-medium`, `--ease-out`; instant under reduced motion |
| Open/close clarity | Label changes ("Read more" → "Show less") plus a rotating chevron. Not icon-only |
| Mobile | Full-width tap target ≥44px; scrolls the summary into view on open |
| Deep linking | `id` addressable so a caveat can be linked directly |

### The hard rule

**No critical analytical conclusion may live only inside a `ReadMore`.**
Specifically these must be visible without interaction:

- that no series survives first differencing
- that cross-market interest levels are not comparable
- that the "synchronised peak" claim is not supported
- that three of five markets show no detectable association
- any claim with `publishable_as_fact: false`

`ReadMore` carries supporting depth — mechanism discussion, method detail,
per-country nuance — never the finding itself.

---

## 7. Responsive contract

| Breakpoint | Layout |
| --- | --- |
| **≥1280 (xl)** | Full editorial composition. 12-col within `--width-page`. Charts get `--width-chart`. Hero chart 420px. Multi-column evidence where justified. Scrollspy rail may appear |
| **1024–1279 (lg)** | Rail drops. Two-column evidence tightens. Chart heights −10% |
| **768–1023 (md)** | Single column. Small multiples 2-across. Table gets a sticky date column with horizontal scroll. Nav → drawer |
| **<768 (sm)** | Single-column narrative. **Dual-axis charts split into stacked panels.** Ticks thinned to ~4. Legends move below the plot. Country selector → chips or native select. Table → card-per-week below 480px |

Adaptation is by **layout decision**, not by scaling desktop CSS down. The
dual-axis split and the table→cards change are the two places that matters most.

---

## 8. Product identity

**Title:** Global Oil Crisis vs EV Interest Analysis — 2026

**Descriptor:** *An interactive analysis of Brent crude prices and electric-car
search interest across five markets, 2025–2026.*

Factual and defensible: it names the data, the scope and the period, and claims
no finding. Branding must not assert a relationship the analysis does not
support — no "proving the EV shift", no "how oil drives EV demand".

The interface must no longer read as "a Streamlit data analysis". It should read
as an interactive research product: confident typography, deliberate composition,
visible methodology, and honest limits.

---

## 9. Preserved from the Streamlit prototype

**Preserved:** the analytical question, both data sources, the five-market scope,
the validated findings, and the useful narrative *concepts* (subsidy buffering,
market maturity, the intent-versus-readiness idea) — each now labelled as
requiring external evidence.

**Not preserved:** layout, widget placement, section order, hard-coded insight
strings, the invalid mean-score comparison, contradicted claims, visual
hierarchy, and Streamlit interaction patterns.

`app.py` retains its `SUPERSEDED PROTOTYPE` header. Relocating it to a
`legacy/` directory or removing it remains an open decision and is **not** part
of Phase 3A.

---

## 10. Phase 3B implementation order

1. Next.js + TypeScript + Tailwind scaffold; wire tokens into the Tailwind theme
2. Swap the hand-rolled validator for Zod behind the same accessors
3. `AppShell`, `Container`, `Section`, `SectionHeader`, `Header`, `Navigation`
4. `Card`, `MetricCard`, `Badge`, `SourceNote`, `StatHighlight`, `ReadMore`
5. `EChart` + `ChartFrame` + `ChartTableFallback` + the ECharts theme adapter
6. Hero (§2) and the Robustness section (05) — the two that set the honest tone
7. Remaining narrative sections in order
8. Responsive, accessibility and performance passes
