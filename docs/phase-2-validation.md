# Phase 2 Validation — Analytical Foundation

Independent re-validation of the analytical layer after all Phase 2 edits. Every
gate below was re-run from a wiped state (artifacts and caches deleted) rather
than reported from an earlier run.

---

## Status

**PASS WITH DOCUMENTED LIMITATIONS**

All six quality gates pass. Two limitations are recorded deliberately and are not
defects in the pipeline:

1. **The analysis is weak, and the pipeline says so.** No series shows a
   week-to-week relationship between crude prices and EV search interest. The
   strong-looking level correlations are classified `level_only_association` and
   no series reaches `robust_positive_association`. This is a property of the
   data, surfaced rather than suppressed.
2. **Eight external claims remain uncited.** They are registered with
   `disposition: requires_citation`, empty `sources`, and
   `publishable_as_fact: false`. No source was invented. These are publication
   blockers, not build failures.

---

## Environment

| Item | Value |
| --- | --- |
| Python | 3.11.15 (CPython) |
| Runtime dependencies | **none** — standard library only |
| Dev tooling | pytest 9.1.1, ruff 0.16.1, mypy 2.3.0 |
| Network | Offline sandbox; PyPI unreachable (`INTEGRATIONS_ONLY`) |

### Dependency strategy, and why it deviates from the approved plan

The Phase 1 plan specified pandas + SciPy. PyPI is unreachable in this
environment, so neither could be installed. Rather than block, the pipeline was
implemented against the standard library. On reflection this is the better choice
for this project regardless of the constraint:

- The analytical dataset is 31 weekly observations. pandas + numpy + scipy is
  >100 MB of dependency surface to do arithmetic on 31 numbers.
- The original project's single worst reproducibility failure *was* its
  dependency situation: `requirements.txt` was UTF-16LE encoded (unparseable by
  pip) and pinned `pandas==3.0.2` / `numpy==2.4.4`. A zero-dependency pipeline
  removes that failure mode permanently.

The trade-off is that the numerics are hand-written, so they are verified two
ways:

- `tests/test_statistics.py` — 40 assertions against published reference values:
  Anscombe's quartet set I (r = 0.816421, slope = 0.500091, intercept = 3.000091,
  R² = 0.666542), Student-t critical values t(0.975, df) for df ∈ {4, 8, 29, 35,
  10⁶}, standard-normal quantiles z(0.975) = 1.959963985 and z(0.995) =
  2.575829304, and closed-form incomplete-beta identities I₁⸝₂(½,½) = ½ and
  I₁⸝₂(2,3) = 11/16.
- `tests/test_statistics_scipy.py` — cross-validates Pearson, Spearman with ties,
  `rankdata`, the t-distribution tail, the normal quantile, `betainc` and
  `linregress` against SciPy to 1e-12. **Skipped here** (SciPy unavailable);
  activates automatically in any networked CI via
  `pip install -e 'pipeline[validate]'`.

This is the one architectural deviation from the approved plan. It is reversible:
adding SciPy later changes nothing except which implementation the tests compare
against.

---

## Data

| Source | Series | Units | Rows | Range |
| --- | --- | --- | --- | --- |
| FRED / U.S. EIA | `DCOILBRENTEU` Brent crude spot | USD/barrel, daily (business days) | 1,305 | 2021-03-23 → 2026-03-23 |
| Google Trends | "Electric Car" interest × 6 | index 0–100, weekly (Sunday start) | 31 per series | 2025-08-31 → 2026-03-29 |

- **Markets:** 5 (Indonesia, Malaysia, Norway, Singapore, United States) plus a
  Worldwide aggregate = 6 series.
- **Weekly observations:** 31 per interest series after the ingestion fix
  (29 before).
- **Weekly oil observations in range:** 30.
- **Analytical pairs at the primary lag:** 30.
- **Missing daily oil values:** 41 in the raw file (market holidays),
  forward-filled and counted. Inside the analysis window: 2025-12-21 (2 days),
  2025-12-28 (1 day).
- **Partial oil week:** 1 — week beginning 2026-03-22 has **one** trading day.
- **Week with no oil coverage:** 2026-03-29, retained with `oil: null` because it
  is the Worldwide and US interest peak and an inner join would have deleted it.

Raw input integrity: `data/raw/DCOILBRENTEU.csv` is opened read-only and its
SHA-256 is recorded in `manifest.json`. A test asserts the hash is unchanged.

---

## Pipeline

```
data/raw + Trends exports
   → ingest      schema validation, header detection, forward fill
   → transform   weekly aggregation, unit conversion, alignment, lag, regime
   → metrics     correlations, intervals, lag profile, specifications, sensitivity
   → emit        JSON artifacts + manifest
```

One command, no manual steps:

```bash
cd pipeline && python -m pipeline.build --legacy --report
```

| Stage | What it does | Key correction |
| --- | --- | --- |
| **ingest** | Reads FRED + 6 Trends exports; rejects bad schemas loudly | Header **detection** replaces hard-coded `skiprows=2`, which had consumed the header, eaten the 2025-08-31 row, and promoted 2025-09-07 to be the header. Recovers 2 observations per the worldwide series. |
| **transform** | Groups daily closes into Sunday-start weeks; converts units; pairs series at an explicit lag; detects the price regime | Canonical `week_start` key so oil and interest weeks cover the same 7 days. The original used `resample('W-SUN')` (week **end**) joined to a Trends week **start** key — an accidental +1-week lag. |
| **metrics** | Pearson, Spearman, bootstrap + Fisher intervals, OLS, lag profile −4…+4, three specifications, leave-one-out, four sensitivity variants | Statistics existed nowhere in the original, which nonetheless asserted "near-perfect correlation". |
| **emit** | Five JSON artifacts + manifest | Strict JSON (no `NaN`), floats rounded to 10 dp, single volatile field. |

Phase 2A gate: the legacy replay reproduces `data/processed/final_data.csv`
**byte-for-byte** (SHA-256 `e653ad8c…`, 29 rows). This is what makes every
corrected number attributable to a decision rather than a porting error.

---

## Quality gates

Run from a wiped state on 2026-09-14.

| Gate | Command | Result |
| --- | --- | --- |
| Tests | `python -m pytest` | **190 passed, 1 skipped** |
| Lint | `ruff check .` | **All checks passed** |
| Format | `ruff format --check .` | **21 files already formatted** |
| Types | `mypy` (src strict + tests) | **Success: no issues in 20 source files** |
| Clean build | `python -m pipeline.build --legacy --report` | **PASS**, legacy replay MATCH |
| Freshness | `python -m pipeline.build --check` | **All 4 artifacts up to date** |

The skipped test is the SciPy cross-validation suite (SciPy unavailable offline).

**Test-count reconciliation (added 2026-09-15).** Re-running these gates during the
Phase 3B bootstrap, on pytest 9.1.1 / Python 3.11.16, reports **191 passed, 1
skipped**, and `python -m pytest --collect-only` reports **191 tests collected**.
Every other figure in the table above reproduced exactly (21 files formatted, 20
source files type-checked), so the `190` recorded on 2026-09-14 is an off-by-one
transcription in that run's record, not a change in the suite. The dated row is
left as originally written; 191 is the correct count.

`mypy` runs strict over `src` with **no exemptions**. A documented per-module
override relaxes exactly three annotation rules (`disallow_untyped_defs`,
`disallow_untyped_calls`, `disallow_incomplete_defs`) for `tests.*`, because
those rules only penalise pytest's fixture idioms. Every other strict check —
including argument and return type compatibility — still applies to tests. No
type-safety rule that could hide a defect in the analytical layer is disabled.

One defect was found and fixed during this validation: `manifest.json`'s
`generated_at` emitted `+00:00Z`, a doubled timezone designator that strict date
parsers reject. Now normalised to RFC 3339 UTC with a single `Z`, with a
regression test.

### Reproducibility

Two independent builds ~1.5 s apart, into separate directories:

| Artifact | Result |
| --- | --- |
| `panel.json` | byte-identical (`e446aeb525e1…`) |
| `metrics.json` | byte-identical (`5e5f43bf255b…`) |
| `countries.json` | byte-identical (`6789e21c6b3a…`) |
| `claims.json` | byte-identical (`c46072971a2b…`) |
| `manifest.json` | differs **only** in `generated_at`; identical once removed; `content_hash` equal |

Bootstrap intervals are deterministic by construction: `random.Random(20260329)`
with a fixed 10,000 iterations. Committed artifacts were confirmed hash-identical
to a fresh build, so nothing on disk is stale.

---

## Statistical validation

| Method | Implementation |
| --- | --- |
| Pearson r | product-moment; two-sided t-test p |
| Spearman ρ | Pearson on average ranks (ties averaged); t-approximation p |
| p-values | `P(|T|>t) = I_{df/(df+t²)}(df/2, ½)`, regularised incomplete beta via Lentz continued fraction |
| Bootstrap CI | percentile, resampling (x, y) **pairs**, 10,000 iterations, seed 20260329, 95% |
| Analytic CI | Fisher z-transformation, 95% |
| OLS | slope, intercept, R², slope standard error |
| Lag | −4 … +4 weeks, minimum 20 pairs |
| Specifications | levels, first differences, linear-detrended residuals |
| Sensitivity | leave-one-out, exclude-partial-weeks, baseline-only, elevated-only, rank-based |

Significance is labelled at α = 0.05 **for description only**. Nothing selects,
filters, promotes or reorders a finding by its p-value; all thresholds are module
constants applied identically to every series.

---

## Final findings

Primary specification: contemporaneous (lag 0), oil in $/litre of crude, n = 30,
95% percentile bootstrap. All values read from the generated `metrics.json`.

### Global — oil and regime

| Quantity | Value |
| --- | --- |
| Weekly Brent range | $60.83 (2025-12-14) → $111.40 (2026-03-15) per barrel |
| Weekly mean | $70.39 per barrel |
| Peak in crude $/litre | $0.7007 |
| Rise, first week to peak | +66.6% |
| Regime onset (largest WoW rise) | 2026-03-01, +19.5% |
| Baseline / elevated weeks | 26 / 4 |
| Baseline max vs elevated min | $71.66 vs $85.28 per barrel — **separated** |

### Correlation, by series

| Series | n | Pearson r | p | Spearman ρ | 95% CI (bootstrap) | 95% CI (Fisher) | Classification | Robustness |
| --- | ---: | ---: | ---: | ---: | :---: | :---: | --- | --- |
| Worldwide | 30 | 0.7269 | 0.000005 | 0.7212 | [0.545, 0.887] | [0.497, 0.862] | level-only | moderate |
| United States | 30 | 0.7466 | 0.000002 | 0.5274 | [0.507, 0.865] | [0.529, 0.872] | level-only | moderate |
| Singapore | 30 | 0.5796 | 0.000790 | 0.5102 | [0.284, 0.756] | [0.277, 0.778] | level-only | moderate |
| Malaysia | 30 | 0.2203 | 0.2420 | 0.2017 | [−0.001, 0.471] | [−0.152, 0.538] | inconclusive | fragile |
| Norway | 30 | 0.1460 | 0.4413 | 0.1449 | [−0.156, 0.443] | [−0.226, 0.481] | no detectable assoc. | fragile |
| Indonesia | 30 | −0.0191 | 0.9204 | 0.1152 | [−0.181, 0.270] | [−0.377, 0.344] | no detectable assoc. | fragile |

### Specification comparison — the decisive table

| Series | Oil vs time r | Interest vs time r | Levels r (p) | First-diff r (p) | Detrended r (p) | Agreement |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Worldwide | 0.612 | 0.703 | **0.727** (<0.0001) | −0.116 (0.548) | **0.527** (0.003) | disagreement |
| United States | 0.612 | 0.817 | **0.747** (<0.0001) | 0.133 (0.493) | **0.541** (0.002) | disagreement |
| Singapore | 0.612 | 0.829 | **0.580** (0.0008) | 0.089 (0.647) | 0.164 (0.387) | disagreement |
| Malaysia | 0.612 | 0.641 | 0.220 (0.242) | −0.148 (0.442) | −0.283 (0.129) | consistent |
| Norway | 0.612 | 0.703 | 0.146 (0.441) | 0.143 (0.459) | **−0.505** (0.004) | disagreement |
| Indonesia | 0.612 | 0.478 | −0.019 (0.920) | −0.087 (0.654) | **−0.448** (0.013) | disagreement |

**Zero of six series survive first differencing.** Bold = significant at α = 0.05.

### Timing and within-market change (scale-free)

| Series | Peak week | vs oil peak | Baseline→peak | Baseline→elevated | Best lag k ≥ 0 (r) |
| --- | --- | ---: | ---: | ---: | :---: |
| United States | 2026-03-29 | +2w | +138.3% | +60.1% | +2 (0.841) |
| Worldwide | 2026-03-29 | +2w | +79.6% | +46.5% | +3 (0.783) |
| Singapore | 2026-03-08 | −1w | +92.6% | +44.1% | 0 (0.580) |
| Malaysia | 2026-02-15 | −4w | +92.3% | +11.2% | +1 (0.266) |
| Indonesia | 2026-02-15 | −4w | +300.0% | **−31.2%** | none positive |
| Norway | 2026-01-25 | −7w | +69.3% | +9.0% | 0 (0.146) |

Oil peak week = 2026-03-15. Indonesia's +300% baseline→peak reflects a single
spike week against a very low baseline (median 17), while its baseline→elevated
change is *negative* — the two together are why it classifies as no detectable
association.

### Leave-one-out and regime sensitivity

| Series | r | min / max r | max │Δr│ | Most influential week | Baseline-only r (p) | Sign flip |
| --- | ---: | :---: | ---: | --- | :---: | :---: |
| Worldwide | 0.727 | 0.671 / 0.780 | 0.056 | 2026-03-08 | 0.659 (0.0002) | no |
| United States | 0.747 | 0.687 / 0.765 | 0.059 | 2026-03-22 | 0.408 (0.038) | no |
| Singapore | 0.580 | 0.478 / 0.621 | 0.101 | 2026-03-08 | 0.304 (0.132) | no |
| Malaysia | 0.220 | 0.118 / 0.261 | 0.103 | 2026-03-22 | 0.257 (0.205) | no |
| Norway | 0.146 | 0.072 / 0.266 | 0.120 | 2026-03-22 | 0.115 (0.574) | no |
| Indonesia | −0.019 | −0.048 / 0.037 | 0.056 | 2026-03-15 | **0.453 (0.020)** | yes (at r≈0) |

Notable: Worldwide and the US survive removal of the entire elevated regime;
Singapore does not. Indonesia is significantly **positive** within the baseline
regime despite being ≈ 0 overall — recorded as `regime_sensitive`.

### Peak dispersion — the "synchronised peak" claim

| Metric | Value |
| --- | --- |
| Distinct peak weeks | 4 |
| Distinct calendar months | 3 — 2026-01, 2026-02, 2026-03 |
| Span, earliest to latest | 9 weeks |
| **Synchronised within one month** | **false** |

Three of five markets (Norway, Indonesia, Malaysia) peaked *before* the
2026-03-01 regime onset, so their peaks cannot be a response to the price rise.

### Before vs after correction

| Series | r before | r after | Δr | n before | n after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Worldwide | 0.772 | 0.727 | −0.045 | 29 | 30 |
| United States | 0.772 | 0.747 | −0.025 | 29 | 30 |
| Singapore | 0.447 | 0.580 | +0.133 | 29 | 30 |
| Malaysia | 0.251 | 0.220 | −0.031 | 29 | 30 |
| Norway | −0.081 | **0.146** | +0.227 | 29 | 30 |
| Indonesia | −0.093 | −0.019 | +0.074 | 29 | 30 |

"Before" is recomputed from the byte-identical legacy replay, so both columns are
generated by code. Norway changes sign. Four independent fixes contribute:
ingestion (+2 observations), alignment (+1-week lag removed), precision (no 2-dp
rounding), and the exact litres-per-barrel constant — the last of which is
analytically inert, since a positive linear rescale leaves every correlation
unchanged.

---

## Narrative corrections

| Original claim | Status | Disposition |
| --- | --- | --- |
| "synchronized peak in EV interest across 5 different countries in a single month" | contradicted by data | rewrite |
| "near-perfect correlation between the March 2026 energy crisis and EV interest" | overstated | rewrite |
| "Between March 15–22 … EV interests hit a maximum score of 100" | contradicted (peak is 2026-03-29) | rewrite |
| "proves that fuel price shocks are the single greatest driver … worldwide" | overstated | **remove** |
| "EV interest is no longer driven by environmental sentiment, but by National Energy Security" | unverifiable from dataset | **remove** |
| "Pasar paling antusias: Norway (60.7 avg)" + mean-score bar chart | **invalid method** | **remove** |
| Malaysia "exceptional sensitivity … accelerates toward 100" | contradicted (r = 0.220, p = 0.24) | rewrite |
| "As of April 2026 … projected June 2026 fuel crisis" | beyond data window | **remove** |
| Norway "proves … Post-Transition phase" | statistical half supported, mechanism not | rewrite |
| Indonesia "Subsidized Shield" motivation claim | statistical half supported, mechanism not | rewrite |
| "global Breaking Point … at the $0.65/Litre mark" | overstated; crude ≠ pump price | rewrite |
| README describing IEA/OPEC data, CAGR, forecasting, `scripts/` | describes work not present | **remove** |

Full register with original wording, reason, evidence and suggested replacement:
`web/src/data/generated/claims.json` (22 claims).

### Leakage audit

Searched the whole repository for every original claim phrase:

| Location | Status |
| --- | --- |
| `pipeline/src/pipeline/claims.py`, `claims.json` | **Intended** — the audit trail stores original wording verbatim by design |
| `README.md`, `METHODOLOGY.md`, `reports/*`, `docs/*` | **Intended** — quoted as corrected/removed |
| `app.py` | Legacy Streamlit prototype. Contains all original claims unqualified. A prominent `SUPERSEDED PROTOTYPE` header was added listing every known defect and pointing at the current source of truth. |
| `notebooks/main.ipynb` | Historical provenance; contains the invalid `paling antusias` KPI. Not executed by anything. |

Analytical-logic leakage: statistics are defined in exactly **one** file
(`pipeline/src/pipeline/statistics.py`). No correlation coefficient, peak date or
country classification is hard-coded anywhere outside `pipeline/` and the
generated artifacts. The only non-pipeline Python is `app.py`, and its
`regplot` references are inside commented-out code. No frontend code exists yet.

---

## Remaining limitations

1. **No short-run co-movement.** 0 of 6 series survive first differencing (all
   p > 0.44). Both variables trend upward (oil vs time r = 0.61; interest vs time
   r = 0.48–0.83). A level correlation cannot be separated from coincident trends.
2. **n = 30, with 4 elevated weeks.** Oil is flat in a $60–72 band for 26 weeks
   then steps to $85–111 for 4. Nearly all its variance is in that episode.
3. **Specification-sensitive.** Levels, first differences and linear detrending
   disagree for 5 of 6 series. Norway and Indonesia turn significantly *negative*
   after detrending.
4. **Interest levels not comparable across markets.** Per-series normalisation to
   100. Not fixable from the committed files.
5. **Observational, no controls.** Seasonality, model launches, news volume and
   advertising are unmeasured. No causal claim is supportable.
6. **Crude, not retail.** Consumers face pump prices, which differ by country
   through tax and subsidy regimes and are absent here.
7. **Search interest ≠ adoption.**
8. **One partial week** (2026-03-22, one trading day) and **one week with no oil
   coverage** (2026-03-29 — the Worldwide and US peak).
9. **Trends provenance incomplete.** Query terms, category filter and retrieval
   dates were never recorded, so that half is not fully reproducible.
10. **Lag scan is exploratory.** Best lag is chosen post hoc; p-values are not
    corrected for multiple comparisons.

---

## Publication blockers

Must be resolved before the dashboard is shown publicly.

| # | Blocker | Owner action |
| --- | --- | --- |
| 1 | **8 uncited external claims** (`requires_citation`, `publishable_as_fact: false`): regional conflict, Malaysian subsidy quota, Singapore pump prices, Singapore EV ownership share, COE costs, Indonesian pump price, US energy-policy attribution, US market rank / manufacturers | Supply sources, or present as clearly-labelled unsourced context, or drop |
| 2 | **The differencing result must be a first-class section**, not a footnote. Publishing r = 0.727 without it repeats the original error in a nicer font | Frontend must lead with the specification comparison |
| 3 | **Trends query provenance** — exact term, category, geo, retrieval date unrecorded | Record, or re-export and record |
| 4 | **"The Proactive Shift" category is not supported** and must be renamed, redefined or removed | Editorial decision (see decision memo §6) |
| 5 | **`app.py` still contains the superseded narrative.** Header added, but it remains in the repo root | Decide: relocate to `legacy/` or delete |

Not blockers, but strongly recommended first (see decision memo §10): re-export
Google Trends over a 5-year window (n ≈ 260) and as a single multi-region
comparison query. Together these would address limitations 1, 2, 4 and 9 for
roughly an afternoon of work, and the pipeline needs no code changes to consume
the longer series.

---

## Sign-off

The analytical foundation is reproducible, tested, deterministic, and honest
about its own weaknesses. `web/src/data/generated/` is the single source of truth
for every number the frontend will render.

Phase 3 may proceed on this contract, provided the narrative it renders is the
corrected one in
[`analytical-decision-memo.md`](analytical-decision-memo.md) and the contract in
[`frontend-data-contract.md`](frontend-data-contract.md).
