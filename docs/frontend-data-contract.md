# Frontend Data Contract

What the Phase 3 frontend consumes, and the rules it must follow. The frontend
should never need to infer a convention — everything below is carried explicitly
in the artifacts.

**Location:** `web/src/data/generated/` (committed, so the web build needs no
Python toolchain).

**Regenerate / verify:**

```bash
cd pipeline
python -m pipeline.build          # write
python -m pipeline.build --check  # non-zero exit if stale
```

---

## 0. Four hard rules

1. **Never compute a statistic.** No Pearson, Spearman, mean, median,
   percentage change, peak detection or regression in component code. If a number
   appears on screen it came from an artifact. The pipeline is the only
   analytical source of truth.
2. **Never compare interest levels across series.** Each Google Trends export is
   an independent query rescaled so *its own* maximum week = 100. All six series
   contain a 100. See §5.
3. **Never render a claim as fact unless `publishable_as_fact === true`** in
   `claims.json`.
4. **Never call the crude price a pump price.** `brent_usd_per_litre` is a
   benchmark cost per litre of crude oil, not retail fuel. See §6.

A `--check` step in CI plus a build-time assertion that every hard-coded number
in MDX matches `metrics.json` is the recommended enforcement.

---

## 1. `panel.json` — the time series

```ts
{
  schema_version: "1.0.0",
  units: { brent_usd_per_barrel: string, brent_usd_per_litre: string, interest: string },
  conventions: {
    week_key: string,              // "week_start (the Sunday beginning the 7-day week)"
    oil_aggregation: string,       // "arithmetic mean of daily closes within the week"
    missing_daily_values: string,  // forward-fill policy
    rows_without_oil: string       // why null rows are retained
  },
  coverage: {
    trends_weeks: 31,
    oil_weeks: 30,
    first_week: "2025-08-31",
    last_week: "2026-03-29",
    weeks_without_oil: ["2026-03-29"],
    partial_weeks: ["2026-03-22"]
  },
  rows: PanelRow[]                 // 31 rows, ascending by week_start
}

type PanelRow = {
  week_start: string,              // ISO date, always a Sunday
  week_end: string,                // week_start + 6 days
  regime: "baseline" | "elevated" | null,   // null iff oil is null
  oil: {
    brent_usd_per_barrel: number,        // rounded 2dp, for display
    brent_usd_per_litre: number,         // rounded 4dp, for display
    brent_usd_per_barrel_exact: number,  // full precision, for plotting
    brent_usd_per_litre_exact: number,
    trading_days: number,                // 5 = complete week
    imputed_days: number,                // forward-filled holidays
    is_partial_week: boolean,            // trading_days < 5
    min_usd_per_barrel: number,
    max_usd_per_barrel: number
  } | null,                              // null where the oil extract stops short
  interest: Record<SeriesId, number>     // all 6 series, 0-100
}
```

### Rendering requirements

- **`oil === null`** happens for exactly one row (2026-03-29) and it is the
  Worldwide and US interest **peak**. Draw the interest series through it; break
  the oil line. Do not filter the row out.
- **`is_partial_week === true`** (2026-03-22, one trading day) must be visually
  distinguished — dashed segment, hollow marker, or a footnote. It must not read
  as equivalent to a complete week.
- Use `*_exact` for plotting, the rounded fields for tooltips and tables.
- `regime === "elevated"` marks the 4-week high-price window from 2026-03-01; use
  it to shade the crisis band rather than hard-coding dates.

---

## 2. `countries.json` — registry and comparability rules

```ts
{
  schema_version: "1.0.0",
  series: Array<{
    id: SeriesId, label: string, short: string,
    is_country: boolean, source_file: string, legacy_column: string
  }>,
  comparability: {
    trends_normalisation: "per_series_max_100_independent_queries",
    explanation: string,
    scale_free_metrics: string[],      // safe to compare across series
    series_local_metrics: string[],    // NEVER compare across series
    forbidden_comparisons: string[],   // render these as prohibited
    remedy: string
  }
}
```

Canonical identifiers — use these, never invent a variant:

| `id` | `label` | `short` | `is_country` |
| --- | --- | --- | --- |
| `worldwide` | Worldwide | WLD | false |
| `indonesia` | Indonesia | IDN | true |
| `malaysia` | Malaysia | MYS | true |
| `norway` | Norway | NOR | true |
| `singapore` | Singapore | SGP | true |
| `us` | **United States** | USA | true |

The original project used `US_`, `"USA"`, `"United States"` and `"America"`
interchangeably. `id = "us"`, `label = "United States"`. One of each, forever.

---

## 3. `metrics.json` — every statistic

### 3.1 Global

```ts
metrics.configuration = {
  primary_lag_weeks: 0,
  lag_window_weeks: [-4, 4],
  min_pairs_for_lag: 20,
  confidence_level: 0.95,
  bootstrap_iterations: 10000,
  bootstrap_seed: 20260329,
  significance_alpha: 0.05,
  litres_per_barrel: 158.987294928,
  include_partial_weeks_in_primary: true,
  regime_rule: "max_week_over_week_pct_increase",
  lag_sign_convention: string
}

metrics.global = {
  oil: {
    weeks, first_week, last_week,
    mean_usd_per_barrel, median_usd_per_barrel,
    min_usd_per_barrel, min_week, max_usd_per_barrel, max_week,
    max_usd_per_litre, total_pct_change_first_to_max,
    partial_weeks: string[],
    weeks_with_imputed_days: Array<{ week_start, imputed_days }>
  },
  regime: {
    rule, onset_week, onset_pct_change,
    baseline_weeks, elevated_weeks,
    baseline_max_usd_per_barrel, elevated_min_usd_per_barrel,
    regimes_separated: boolean          // if false, do NOT call it a regime
  },
  peak_dispersion: {
    peaks: Record<CountryId, string>,
    distinct_weeks, distinct_months: string[], span_weeks,
    synchronised_within_one_month: boolean   // currently FALSE
  },
  worldwide: SeriesMetrics,
  evidence_groups: Record<string, CountryId[]>
}
```

### 3.2 Per series — `metrics.series[id]`

```ts
{
  id, label, short, is_country,

  primary: {
    lag_weeks: 0, n: 30,
    pearson_r, pearson_p, spearman_rho, spearman_p,
    bootstrap_ci: { low, high, level, method },
    fisher_ci:    { low, high, level, method },
    fit: { slope, intercept, r_squared, slope_stderr, n },   // OLS in $/litre
    significant_at_alpha, alpha, ci_includes_zero,
    strength_label, direction, includes_partial_week
  },

  lag_profile: Array<{ lag_weeks, n, pearson_r, pearson_p, spearman_rho }>,
  best_lag: LagPoint | null,                    // restricted to k >= 0
  unrestricted_lag_maximum_is_negative: boolean, // true => trend artifact

  trend_diagnostics: {
    oil_vs_time_r, interest_vs_time_r,
    both_series_trend_same_direction: boolean,
    specifications: Array<{ id, description, n, pearson_r, pearson_p, significant_at_alpha }>,
    agreement: "consistent" | "significance_disagreement" | "sign_disagreement",
    note: string
  },

  sensitivity: {
    leave_one_out: {
      baseline_r, min_r, max_r, max_abs_delta,
      most_influential_index, sign_flips,
      per_observation: Array<{ index, label, r_without, delta }>  // label = ISO week
    },
    variants: Array<{ id, description, n, pearson_r, pearson_p, delta_vs_primary, computable, reason }>
  },

  profile: {
    series_local: {                     // _comparable_across_series: false
      mean_interest, median_interest, min_interest, peak_value,
      baseline_mean_interest, elevated_mean_interest,
      _comparable_across_series: false
    },
    scale_free: {                       // _comparable_across_series: true
      peak_week, peak_week_ties,
      baseline_to_peak_pct_change, baseline_to_elevated_pct_change,
      peak_lag_weeks,                   // + = peaked after the oil peak
      _comparable_across_series: true
    }
  },

  classification: {
    strength, direction, significance, robustness, evidence_group,
    caveats: string[]
  }
}
```

`sensitivity.variants[].computable === false` means the variant could not be
computed (too few observations); `pearson_r` and `pearson_p` are `null` and
`reason` explains why. Render the reason, do not hide the row.

### 3.3 Vocabularies

`evidence_group`:

| Code | Meaning |
| --- | --- |
| `no_detectable_association` | CI includes 0 and \|r\| < 0.20 |
| `inconclusive` | CI includes 0 otherwise, or not significant |
| `level_only_association` | significant in levels, absent in first differences |
| `robust_positive_association` | significant in levels **and** first differences (currently unused) |

`robustness`: `fragile` | `moderate` | `robust`. A level-only association is
never `robust`.

`strength`: `negligible` | `weak` | `moderate` | `strong` | `very_strong`
(conventional \|r\| bands, a labelling aid, not a test).

`caveats` — codes, not sentences. The frontend owns the wording:

| Code | Suggested copy |
| --- | --- |
| `small_sample` | Based on 30 weekly observations. |
| `few_elevated_observations` | Only 4 weeks sit in the elevated-price regime. |
| `includes_partial_week` | Includes one week built from a single trading day. |
| `ci_includes_zero` | The confidence interval spans zero. |
| `not_significant` | Not distinguishable from zero at α = 0.05. |
| `loo_sign_flip` | Removing one week reverses the sign. |
| `leverage_dependent` | One week moves the coefficient substantially. |
| `series_local_scale` | Interest is scaled to this market's own peak. |
| `loses_significance_without_elevated_regime` | Disappears when the price spike is excluded. |
| `no_short_run_comovement` | Week-to-week changes show no relationship. |
| `shared_trend_confound_possible` | Both series trend upward across the window. |
| `specification_sensitive` | Specifications disagree. |
| `regime_sensitive` | Differs between the baseline and elevated regimes. |
| `negative_lag_maximum` | The lag scan peaks where interest would lead oil — a trend artifact. |

### 3.4 `metrics.category_review`

```ts
Array<{
  id, original_title, original_members: CountryId[],
  data_supported_members: CountryId[], unsupported_members: CountryId[],
  verdict: "supported" | "partially_supported" | "not_supported",
  requires_external_evidence: true,   // always true
  basis: string
}>
```

Current verdicts: `subsidized_buffer` **supported**, `maturity_gap`
**supported**, `proactive_shift` **not_supported**.

`requires_external_evidence` is `true` for all three. The category *names* assert
mechanisms — subsidy buffering, proactive policy, market maturity — which a price
series and a search index cannot establish. Present them as an **editorial
framework**, never as discovered clusters. If a category's verdict is
`not_supported`, do not render its original claim.

---

## 4. `claims.json` — publishability gate

```ts
{
  schema_version, summary, policy,
  claims: Array<{
    id, origin, original_text,
    status: "supported_by_data" | "overstated_relative_to_data" | "contradicted_by_data"
          | "invalid_method" | "external_unverifiable_from_dataset"
          | "beyond_data_window" | "describes_work_not_present",
    disposition: "retain" | "rewrite" | "remove" | "requires_citation",
    reason, evidence: string[], suggested_statement: string | null,
    sources: string[],
    publishable_as_fact: boolean
  }>
}
```

`publishable_as_fact` is `true` only when the disposition is `retain`/`rewrite`
**and** `evidence` is non-empty. Eight claims currently have
`requires_citation`, empty `sources` and `publishable_as_fact: false` — regional
conflict, Malaysian subsidy quota, Singapore pump prices, Singapore EV ownership,
COE costs, Indonesian pump price, US energy-policy attribution, US market rank.

`suggested_statement` is draft wording, not published copy. Final prose belongs
in MDX; see `docs/analytical-decision-memo.md` for the editorial line.

---

## 5. Normalisation — what may and may not be compared

Every Trends series is rescaled to its own maximum, so all six contain a 100.

**Prohibited** (enumerated in `countries.json.comparability.forbidden_comparisons`):

- ranking markets by mean or peak interest
- "the most interested / most enthusiastic market"
- treating 100 in one market as equivalent to 100 in another
- any statement comparing absolute interest levels between markets

**Permitted:**

| Comparison | Field |
| --- | --- |
| Correlation with oil | `primary.pearson_r`, `spearman_rho` |
| Peak timing | `profile.scale_free.peak_week`, `peak_lag_weeks` |
| Within-market relative change | `baseline_to_peak_pct_change`, `baseline_to_elevated_pct_change` |
| Lag behaviour | `lag_profile`, `best_lag` |
| Shape over time | `panel.rows[].interest[id]` — plot shapes, do not compare heights |
| Robustness | `classification.robustness`, `sensitivity` |

When plotting multiple markets on one chart, either give each its own axis or
label the axis explicitly as "index, each market scaled to its own peak = 100".

---

## 6. Oil terminology

Three distinct quantities. Keep them distinct in copy:

| Concept | Field | Correct wording |
| --- | --- | --- |
| Benchmark price | `brent_usd_per_barrel` | "Brent crude, USD per barrel" |
| Derived per-litre crude cost | `brent_usd_per_litre` | "Brent crude, USD per litre (crude-equivalent)" |
| Retail fuel price | **not in the dataset** | do not state |

`brent_usd_per_litre = brent_usd_per_barrel / 158.987294928`. At $0.65/litre the
barrel price is about $103. Never imply this is what a driver paid at a station.
Retail prices differ by country through tax and subsidy regimes and are absent
here — which is precisely why the "subsidy" explanation cannot be tested.

Note: correlations are **identical** in either unit (a positive linear rescale),
so the unit choice is presentational. Only `fit.slope` is unit-dependent, and it
is computed in $/litre.

---

## 7. `manifest.json` — provenance

```ts
{
  schema_version, pipeline_version, generated_at,   // RFC3339 UTC, e.g. "2026-09-14T16:30:28Z"
  _determinism_note, content_hash,
  sources: Array<{ id, name, publisher, url, series_id, units, frequency, notes }>,
  source_files: Record<filename, sha256>,
  artifacts: Record<filename, sha256>,
  coverage, analytical_configuration, claims_summary
}
```

`generated_at` is the **only** non-reproducible field in any artifact. Use
`content_hash` to compare two builds. Use `sources[]` to render the methodology
section's citations — the FRED series URL and the Google Trends URL are both
there, so no URL should be hard-coded in a component.

---

## 8. Methodology values to surface in the UI

All available in the artifacts; none should be typed by hand:

| Item | Source |
| --- | --- |
| Source names, publishers, URLs, units, frequency | `manifest.sources[]` |
| Normalisation warning | `countries.comparability.explanation` |
| Weekly aggregation rule | `panel.conventions.oil_aggregation` |
| Alignment convention | `panel.conventions.week_key`, `metrics.configuration.lag_sign_convention` |
| Partial-week rule | `panel.conventions`, `metrics.configuration.include_partial_weeks_in_primary` |
| Forward-fill policy | `panel.conventions.missing_daily_values` |
| Statistical methods | `primary.bootstrap_ci.method`, `fisher_ci.method` |
| Bootstrap seed / iterations / level | `metrics.configuration` |
| Significance threshold | `metrics.configuration.significance_alpha` |
| Litres per barrel | `metrics.configuration.litres_per_barrel` |
| Regime rule and onset | `metrics.global.regime` |
| Coverage and gaps | `panel.coverage` |

---

## 9. Suggested TypeScript boundary

Validate once at the module edge with Zod, export typed accessors, and let the
rest of the app depend only on those. Two invariants worth asserting at build
time, both cheap:

```ts
// 1. no series-local metric leaks into a cross-series comparison
assert(profile.series_local._comparable_across_series === false);

// 2. a claim is only rendered as fact when the pipeline says so
if (!claim.publishable_as_fact) renderAsUnsourcedContext(claim);
```

A third is worth adding as a CI script rather than runtime code: fail the build if
any number hard-coded in MDX disagrees with `metrics.json`. That is the mechanism
that keeps prose and data from drifting apart, which is how the original project
ended up asserting a correlation it never computed.
