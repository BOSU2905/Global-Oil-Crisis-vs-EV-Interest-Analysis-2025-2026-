# Methodology

How the analytical dataset is built, what each decision was, and what the result
can and cannot support. Every figure quoted in `reports/VALIDATION_REPORT.md` is
produced by the code described here.

Reproduce everything with:

```bash
cd pipeline
python -m pipeline.build --legacy --report
```

---

## 1. Research question

> Over the observed period, did Brent crude prices and Google Trends search
> interest in electric cars move together, and did that co-movement differ
> across five markets?

Two limits are built into the question deliberately. It asks about
**co-movement**, not causation, because two observational time series with no
controls cannot establish causation. And it asks about *relative* differences
between markets, because the search-interest data does not permit comparison of
absolute levels (§6).

---

## 2. Sources

### 2.1 Brent crude oil price

| Field | Value |
| --- | --- |
| Series | `DCOILBRENTEU` |
| Title | Crude Oil Prices: Brent – Europe |
| Publisher | U.S. Energy Information Administration, via FRED (Federal Reserve Bank of St. Louis) |
| URL | https://fred.stlouisfed.org/series/DCOILBRENTEU |
| Units | U.S. dollars per **barrel** |
| Frequency | Daily, business days only (Mon–Fri) |
| File | `data/raw/DCOILBRENTEU.csv` (immutable) |
| Coverage | 1,305 rows, 2021-03-23 → 2026-03-23 |
| Missing | 41 empty cells (market holidays), 9 of them inside the analysis window |

This is a **crude benchmark spot price**. It is not a retail pump price and is
never described as one.

### 2.2 Google Trends search interest

| Field | Value |
| --- | --- |
| Publisher | Google Trends |
| Measure | Relative search interest, 0–100 |
| Frequency | Weekly, each week keyed by its first day (a Sunday) |
| Files | `data/processed/{EV Trends, Indonesia_EV_Trends, Malaysia_EV_Trends, Norway_EV_Trends, Singapore_EV_Trends, US_EV_Trends}.csv` |
| Coverage | 31 weeks, 2025-08-31 → 2026-03-29, in all six series |

Six **independent** exports: Worldwide, Indonesia, Malaysia, Norway, Singapore,
United States.

**Known provenance gap.** The original project did not record the exact query
term, category filter, or retrieval date for any of the six exports. The Google
Trends half of this analysis is therefore not fully reproducible from source, and
the index is subject to Google's own sampling. This is disclosed rather than
papered over.

**File location note.** The Trends exports are raw source data that sit under
`data/processed/` in the original repository layout. They are read read-only and
left where they are; moving them to `data/raw/trends/` is a Phase 3 task so the
`git mv` keeps history intact.

---

## 3. Ingestion

### 3.1 Oil

1. Read every daily row.
2. Empty values (and FRED's `.` variant) are **forward-filled** from the previous
   trading day and flagged `is_imputed`. Forward fill is appropriate for a price
   level: on a day with no trading, the last traded price is the best available
   estimate.
3. Reject the file loudly on a bad header, a non-positive price, duplicate dates,
   descending dates, or a missing value with nothing before it to fill from.

`data/processed/DCOILBRENTEU_2025_filtered.csv` was committed by the original
project with no code that produced it. It is **not** an input here — the pipeline
derives the same series from the raw file — but a test asserts the two match, so
its provenance is now established rather than unknown.

### 3.2 Trends: header detection instead of `skiprows`

The original notebook used `pd.read_csv(..., skiprows=2)`. Google's own export
has a two-line preamble, but the files committed to this repository have already
been stripped to a single header row. Applied to those files, `skiprows=2`:

1. consumed the header row,
2. consumed the first data row (`2025-08-31`),
3. promoted the second data row (`2025-09-07`) to be the header, discarding it.

Two observations were destroyed. The five country files were read **without**
`skiprows`, so only the worldwide series was truncated — which is why the
resulting inner join silently produced 29 rows instead of 31.

The correction detects the header rather than assuming its position: find the
first row whose first cell parses as an ISO date and whose second cell is
numeric, and treat everything above it as preamble plus an optional header. This
handles the full Google preamble, a single header row, and no header at all.

**This mattered analytically, not just cosmetically.** The two lost values were
60 and 56, both *above* the mean of the remaining pre-surge weeks. Dropping the
two highest early observations mechanically strengthened the apparent
oil↑/interest↑ relationship.

Validation applied to every Trends file:

- every week key is a Sunday (the join in §4 depends on it),
- weeks are strictly ascending, unique, and exactly 7 days apart,
- scores lie in 0–100,
- Google's `<1` convention maps to 0.5 and is counted,
- all six series share one identical weekly grid.

---

## 4. Weekly alignment

This is the correction with the largest conceptual consequence.

| Series | What its weekly key means |
| --- | --- |
| Google Trends | The **first** day of the week (Sunday) |
| `pandas.resample('W-SUN')` | The **last** day of the bin (Sunday), bin = Mon–Sun |

The original notebook resampled oil with `W-SUN` and joined the result to the
Trends key. Because the two conventions point at opposite ends of a week, each
interest observation was paired with the **preceding** week's oil price — an
accidental one-week lag that nobody chose and nothing documented.

### Canonical convention

```
week_start = the Sunday that BEGINS the week containing a date
oil weekly value = mean of all daily closes in [week_start, week_start + 6 days]
```

Oil weeks and Trends weeks now cover exactly the same seven days, so lag 0 means
"the same week". The legacy behaviour is reproducible as lag `+1`.

### Explicit lag

`lag = k` pairs oil from week `t − k` with interest at week `t`.

| k | Meaning |
| --- | --- |
| 0 | Contemporaneous — the primary specification |
| > 0 | Oil leads interest by k weeks |
| < 0 | Interest leads oil (a sanity check, not a hypothesis) |

The lag window is −4 … +4 weeks and no lag is computed on fewer than 20 pairs.

Lag analysis is **exploratory**. The best lag is chosen after seeing the results,
so its p-value is not corrected for the multiple comparisons a window scan
implies. Negative lags are reported for diagnosis but excluded from the "best
lag" answer: a maximum at negative lag would say interest predicts later oil
prices, and with two trending series that is a trend artifact rather than a
finding. Where the unrestricted maximum does fall at a negative lag, the series
is flagged `negative_lag_maximum`.

---

## 5. Units

```
brent_usd_per_barrel  as published by FRED
brent_usd_per_litre = brent_usd_per_barrel / 158.987294928
```

One US petroleum barrel is 42 US gallons = 158.987294928 litres. The original
project divided by the rounded 159.

Both fields are emitted. Two consequences are worth stating plainly:

- **Correlations are unaffected by the choice.** The conversion is a positive
  linear rescale, so Pearson r, Spearman ρ and both p-values are identical in
  either unit. A test asserts this. Only the OLS slope changes, which is why the
  fit is published with its unit fixed.
- **$/litre of crude is not a pump price.** At $0.65/litre crude the barrel price
  is roughly $103. Retail prices differ by country through tax and subsidy
  regimes and are absent from this dataset. The original project's retail figures
  (Indonesian rupiah and Singapore dollar pump prices) are recorded in
  `claims.json` as requiring citation, not published as fact.

**No rounding before analysis.** The original rounded $/litre to 2 decimals,
collapsing a 0.38–0.70 range into about a dozen distinct values and coarsening
every correlation computed from it. Here full precision is retained internally
and rounding is applied only for display.

---

## 6. The comparability constraint

Each Google Trends export is an independent query, rescaled so that **its own**
maximum week equals 100. All six series contain a 100. They sit on six different
scales.

### Not computable from these files

- ranking markets by mean or peak interest
- "the most enthusiastic market"
- any statement that one country has more search interest than another

The original project's KPI *"Pasar paling antusias: Norway (60.7 avg)"* and its
mean-score bar chart are invalid for this reason. No re-weighting of the
committed files can fix it.

### Computable

Metrics that are ratios or timings **within** one series, so the per-series scale
factor cancels:

| Metric | Definition |
| --- | --- |
| `pearson_r`, `spearman_rho` | correlation with the oil series |
| `peak_week` | week of that series' maximum |
| `peak_lag_weeks` | weeks between the oil peak week and this series' peak week |
| `baseline_to_peak_pct_change` | (peak − baseline mean) / baseline mean × 100 |
| `baseline_to_elevated_pct_change` | (elevated mean − baseline mean) / baseline mean × 100 |
| `best_lag_weeks` | lag with the strongest non-negative-lag correlation |

The constraint is machine-readable in `countries.json` (`scale_free_metrics`,
`series_local_metrics`, `forbidden_comparisons`), and every series-local metric
in `metrics.json` carries `_comparable_across_series: false`. The frontend cannot
re-introduce the error without ignoring an explicit flag. A test asserts that no
ranking field is emitted at all.

**Remedy, if wanted:** a single Google Trends *multi-region comparison* query
would place all five markets on one shared scale and make level comparison valid.
That requires a new export.

---

## 7. Price regime

The regime split follows one rule with no tunable parameters, fixed before any
correlation was inspected:

```
onset    = the week with the largest week-over-week % increase in weekly mean Brent
baseline = every week before onset
elevated = the onset week and every week after it
```

On this data: onset **2026-03-01** at **+19.5%**, giving **26 baseline weeks** and
**4 elevated weeks**.

A guard checks that the elevated minimum exceeds the baseline maximum, so the two
regimes do not overlap in level. Here they are cleanly separated ($85.28 vs
$71.66 per barrel). If a future data update breaks that, the pipeline warns and
the split must not be described as a distinct regime.

The imbalance is the analysis' central weakness: the oil variable barely moves
for 26 weeks, then steps up for 4. Nearly all of its variance lives in that short
episode, so §9's robustness checks are not optional garnish.

---

## 8. Partial weeks

The oil extract ends 2026-03-23, mid-week. Each weekly oil value therefore
carries:

```
trading_days      how many daily rows contributed (5 = complete)
imputed_days      how many were forward-filled holidays
is_partial_week   true when trading_days < 5
```

On this data the week beginning **2026-03-22** has **one** trading day. Holiday
imputation affects 2025-12-21 (2 days) and 2025-12-28 (1 day).

The partial week is **kept** in the primary analysis and flagged everywhere,
rather than dropped. A dedicated sensitivity variant reports what changes when
partial weeks are excluded.

Separately, the final Trends week (**2026-03-29**) has *no* oil coverage at all.
It is retained in `panel.json` with `oil: null` rather than dropped by an inner
join — it happens to be the worldwide and US interest peak, and silently deleting
it would be the same class of error as the `skiprows` bug. Consequently the
primary analysis has **31 interest observations** but **30 usable pairs**.

---

## 9. Statistics

All implemented in `pipeline/src/pipeline/statistics.py` using only the Python
standard library, and validated in `tests/test_statistics.py` against published
reference values (Anscombe's quartet, Student-t critical values, standard-normal
quantiles, closed-form incomplete-beta identities). `tests/test_statistics_scipy.py`
cross-checks against SciPy wherever SciPy is installed.

| Quantity | Method |
| --- | --- |
| Pearson r | product-moment; p from a two-sided t-test, `t = r√((n−2)/(1−r²))` |
| Spearman ρ | Pearson on average ranks (ties averaged); p from the same t-approximation |
| p-values | `P(|T| > t) = I_{df/(df+t²)}(df/2, ½)` via the regularised incomplete beta |
| Bootstrap CI | percentile, resampling (x, y) **pairs**, 10,000 iterations, seed 20260329, 95% |
| Analytic CI | Fisher z-transformation, 95% |
| OLS fit | slope, intercept, R², slope standard error |

Both intervals are reported because with n ≈ 30 their disagreement is itself
informative. The bootstrap is deterministic: a fixed seed and a fixed iteration
count make the interval bit-for-bit reproducible. The seed is the date of the
final observation and carries no analytical meaning.

Significance is labelled at α = 0.05 **for description only**. Nothing in the
pipeline selects, filters, promotes or reorders a finding by its p-value.

### 9.1 Specification checks

Both variables trend upward over the window (oil vs time r = 0.61; interest vs
time r = 0.48–0.83). Two series that both trend will correlate in levels whether
or not they are related, so three specifications are computed:

| Specification | What it does | Limitation |
| --- | --- | --- |
| `levels` | weekly values as published | shared trend not removed |
| `first_differences` | week-over-week changes | removes any trend; noisy, low power if the relationship is in levels |
| `linear_detrended` | residuals after removing a straight-line trend | a flat-then-step path is poorly modelled by a line |

Neither check is decisive alone, so all three are published and their
disagreement is treated as a result. On this data **no series survives first
differencing** while linear detrending retains significance for several. Any
level correlation that is significant but fails differencing is classified
`level_only_association`, never "robust".

### 9.2 Sensitivity

- **Leave-one-out** — r recomputed with each week removed; reports min, max, the
  largest |Δr|, the most influential week, and whether the sign ever flips. A
  sign flip is only flagged when |r| ≥ 0.10, since at r ≈ 0 it is noise.
- **exclude_partial_weeks** — drops weeks with fewer than 5 trading days.
- **baseline_regime_only** — does the association survive without the high-price
  episode?
- **elevated_regime_only** — reported with its n = 4 visible, so a reader can see
  how little is there rather than finding it quietly omitted.
- **rank_based** — Spearman, which limits the leverage of extreme values.

---

## 10. Classification vocabulary

The pipeline emits **codes, not prose**. The analytical layer says what is
limiting; the content layer decides wording. This is why `metrics.json` contains
no sentences.

`evidence_group` — statistical pattern only, no mechanism implied:

| Code | Meaning |
| --- | --- |
| `no_detectable_association` | CI includes 0 and \|r\| < 0.20 |
| `inconclusive` | CI includes 0 otherwise, or not significant |
| `level_only_association` | significant in levels, absent in first differences |
| `robust_positive_association` | significant in levels **and** in first differences |

`robustness`: `fragile` / `moderate` / `robust`. A level-only association cannot
be `robust` however large r is.

`caveats`: `small_sample`, `few_elevated_observations`, `includes_partial_week`,
`ci_includes_zero`, `not_significant`, `loo_sign_flip`, `leverage_dependent`,
`series_local_scale`, `loses_significance_without_elevated_regime`,
`no_short_run_comovement`, `shared_trend_confound_possible`,
`specification_sensitive`, `regime_sensitive`, `negative_lag_maximum`.

All thresholds are module constants applied identically to every series.

---

## 11. Claims register

`claims.json` records every factual assertion the original project made, with a
status, a disposition, the evidence supporting it, and a `publishable_as_fact`
flag the frontend can enforce.

Statuses: `supported_by_data`, `overstated_relative_to_data`,
`contradicted_by_data`, `invalid_method`,
`external_unverifiable_from_dataset`, `beyond_data_window`,
`describes_work_not_present`.

Dispositions: `retain`, `rewrite`, `remove`, `requires_citation`.

Claims about geopolitical events, fuel-subsidy policy, retail fuel prices,
vehicle-ownership shares and national energy policy cannot be tested against
these two datasets. They are recorded with `requires_citation` and an **empty
sources array** — no source is invented anywhere in this repository — and
`publishable_as_fact: false`. A claim with neither evidence nor a source must not
be rendered as fact.

---

## 12. Artifacts

Written to `web/src/data/generated/`:

| File | Contents |
| --- | --- |
| `panel.json` | one row per Trends week: oil (nullable), interest, flags, regime, units, coverage |
| `metrics.json` | every statistic per series, plus global findings, peak dispersion, category review |
| `countries.json` | series registry and the comparability rules |
| `claims.json` | disposition of every original claim |
| `manifest.json` | source SHA-256s, artifact SHA-256s, analytical configuration, `content_hash` |

Guarantees:

- Strictly valid JSON. Non-finite floats become `null`, never the bare `NaN` that
  `json.dump` emits by default and `JSON.parse` rejects.
- Floats rounded to 10 decimals so artifacts are diff-stable.
- `manifest.json`'s `generated_at` is the **only** non-reproducible field. Compare
  `content_hash` to verify two runs produced identical analytical output;
  `python -m pipeline.build --check` does exactly that and fails if artifacts are
  stale.

---

## 13. What this analysis cannot support

1. **Causation.** No confounder is measured or controlled — seasonality, model
   launches, news volume, advertising, policy announcements. Correlation here is
   correlation.
2. **A short-run relationship.** No series survives first differencing. Both
   variables rose over seven months; this dataset cannot separate a genuine
   relationship from two coincident trends.
3. **Cross-market interest levels.** Precluded by per-series normalisation (§6).
4. **Consumer motivation.** The data records searches and prices. It contains no
   variable describing why anyone searched, so it cannot distinguish
   environmental concern from cost anxiety.
5. **Adoption.** Search interest is not purchase.
6. **Anything outside 2025-08-31 → 2026-03-29.** Statements about April or June
   2026 are not findings.
7. **Retail price effects.** The price variable is a global crude benchmark;
   consumers face pump prices, which are absent here.
8. **Precision.** 30 pairs, 4 of them in the elevated regime. Every interval is
   wide and every coefficient imprecise.
