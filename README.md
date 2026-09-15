# Oil Prices vs EV Search Interest — 2025/2026

Did Brent crude prices and public interest in electric cars move together over
the 2025–26 winter, and did that differ across five markets?

This repository holds the reproducible analysis behind that question: a
zero-dependency Python pipeline that turns two public datasets into validated
JSON artifacts, plus a written record of what the data supports and what it does
not.

**Status:** analytical layer complete and tested. The web frontend is in progress —
the Next.js shell builds and is browser-tested, but no charts or narrative
sections exist yet.

---

## The short answer

Crude prices and EV search interest both rose across all five markets. In weekly
**levels** the relationship looks strong — worldwide r = 0.727, United States
r = 0.747. But it does **not** survive first differencing in any market, the five
interest peaks arrived across three different calendar months, and three of the
five markets show no association distinguishable from zero.

So the honest finding is narrower and more interesting than "oil prices drive EV
interest": two series trended upward together over seven months, this dataset
cannot separate a real relationship from a coincidence, and the markets disagree
with each other in ways that timing and relative-change metrics can show.

| Market | Pearson r | p | 95% CI | Classification |
| --- | ---: | ---: | :---: | --- |
| Worldwide | 0.727 | <0.0001 | [0.55, 0.89] | level-only association |
| United States | 0.747 | <0.0001 | [0.51, 0.86] | level-only association |
| Singapore | 0.580 | 0.0008 | [0.28, 0.76] | level-only association |
| Malaysia | 0.220 | 0.24 | [−0.00, 0.47] | inconclusive |
| Norway | 0.146 | 0.44 | [−0.16, 0.44] | no detectable association |
| Indonesia | −0.019 | 0.92 | [−0.18, 0.27] | no detectable association |

Contemporaneous weekly alignment, n = 30 pairs, 95% percentile bootstrap.
"Level-only" means significant in levels but absent in week-over-week changes.

| Document | Purpose |
| --- | --- |
| [`reports/VALIDATION_REPORT.md`](reports/VALIDATION_REPORT.md) | Full generated numbers — rebuilt from source data on every run |
| [`docs/phase-2-validation.md`](docs/phase-2-validation.md) | Quality gates, reproducibility proof, publication blockers |
| [`docs/analytical-decision-memo.md`](docs/analytical-decision-memo.md) | What the data supports, and the editorial line for the site |
| [`docs/frontend-data-contract.md`](docs/frontend-data-contract.md) | Exact contract the frontend consumes |
| [`METHODOLOGY.md`](METHODOLOGY.md) | Every analytical decision, and what the analysis cannot support |

---

## Data

| Source | Series | Units | Coverage |
| --- | --- | --- | --- |
| [FRED / U.S. EIA](https://fred.stlouisfed.org/series/DCOILBRENTEU) | `DCOILBRENTEU` — Brent crude spot | USD per barrel, daily | 2021-03-23 → 2026-03-23 (1,305 rows) |
| [Google Trends](https://trends.google.com/trends/) | "Electric Car" search interest ×6 | relative index 0–100, weekly | 2025-08-31 → 2026-03-29 (31 weeks) |

Markets: Worldwide, Indonesia, Malaysia, Norway, Singapore, United States.

Two properties of this data shape everything downstream:

- **The crude price is not a pump price.** `brent_usd_per_litre` is a benchmark
  cost per litre of crude (barrel ÷ 158.987294928), not what anyone pays at a
  fuel station.
- **The six Trends exports are independent queries**, each rescaled so its own
  maximum week = 100. All six contain a 100. **Interest levels cannot be compared
  between markets** — no ranking of "most interested market" is available from
  these files. Only correlation, timing and within-market relative change are
  comparable.

---

## Running it

Requires Python 3.11+. **No third-party packages.**

```bash
cd pipeline
PYTHONPATH=src python -m pipeline.build --legacy --report
```

The package uses a `src/` layout, so `pipeline` is only importable once `src` is
on the path. `PYTHONPATH=src` is the zero-install form. Alternatively install it
once — `pip install -e pipeline` (or `uv pip install -e "pipeline[dev]"` to get
the test and lint tooling too) — after which plain
`python -m pipeline.build` works from anywhere.

| Flag | Effect |
| --- | --- |
| `--legacy` | verify the byte-identical reproduction of the original notebook's output |
| `--report` | write `reports/VALIDATION_REPORT.md` |
| `--check` | verify committed artifacts are up to date; non-zero exit if stale |
| `--out DIR` | override the artifact directory |

Tests and checks:

```bash
cd pipeline
python -m pytest          # 191 tests
ruff check . && ruff format --check .
mypy src                  # strict
```

`pipeline` declares **no runtime dependencies** on purpose. The dataset is 31
weekly observations; pandas, numpy and scipy would add over 100 MB of dependency
surface to do arithmetic on 31 numbers. Every statistic is implemented in
`pipeline/src/pipeline/statistics.py` and validated against published reference
values (Anscombe's quartet, Student-t critical values, standard-normal quantiles,
closed-form incomplete-beta identities). `tests/test_statistics_scipy.py`
cross-checks the same functions against SciPy wherever SciPy is installed, so the
decision is verifiable rather than asserted.

---

## Layout

```text
.
├── data/
│   ├── raw/DCOILBRENTEU.csv          # immutable FRED extract
│   └── processed/                    # Google Trends exports (read-only inputs)
│       ├── EV Trends.csv  Indonesia_EV_Trends.csv  Malaysia_EV_Trends.csv
│       ├── Norway_EV_Trends.csv  Singapore_EV_Trends.csv  US_EV_Trends.csv
│       ├── DCOILBRENTEU_2025_filtered.csv   # legacy intermediate, provenance now tested
│       └── final_data.csv                   # legacy output, kept as a regression fixture
├── pipeline/
│   ├── src/pipeline/
│   │   ├── config.py       # paths, registry, conventions, every analytical constant
│   │   ├── statistics.py   # Pearson, Spearman, t-tests, bootstrap, OLS, leave-one-out
│   │   ├── ingest.py       # readers + schema validation + header detection
│   │   ├── transform.py    # weekly aggregation, alignment, lag, regime split
│   │   ├── metrics.py      # correlations, lag profile, specification checks, sensitivity
│   │   ├── claims.py       # register of every claim the original project made
│   │   ├── legacy.py       # bug-for-bug replay of the original notebook
│   │   ├── emit.py         # JSON artifacts + manifest
│   │   ├── report.py       # renders the validation report from live metrics
│   │   └── build.py        # CLI
│   └── tests/              # 191 tests
├── notebooks/main.ipynb    # original exploratory notebook, kept as provenance
├── web/src/data/generated/ # ← generated artifacts the future frontend consumes
├── METHODOLOGY.md          # how every number is produced, and what it can't support
├── docs/
│   ├── phase-2-validation.md        # gates, reproducibility, publication blockers
│   ├── analytical-decision-memo.md  # editorial source of truth for Phase 3
│   └── frontend-data-contract.md    # the contract the frontend consumes
└── reports/
    └── VALIDATION_REPORT.md         # generated by the pipeline
```

`app.py` is the original Streamlit prototype. It is superseded by this pipeline
and is retained for now as a before/after reference.

---

## Artifacts

`python -m pipeline.build` writes five files to `web/src/data/generated/`:

| File | Contents |
| --- | --- |
| `panel.json` | one row per Trends week — oil (nullable), interest, partial-week flags, regime |
| `metrics.json` | every statistic per series, plus peak dispersion and the category review |
| `countries.json` | series registry and machine-readable comparability rules |
| `claims.json` | status and disposition of every original claim |
| `manifest.json` | source hashes, artifact hashes, analytical configuration, `content_hash` |

The presentation layer will import these directly and must never compute a
statistic. `manifest.json`'s `generated_at` is the only non-reproducible field in
any artifact; `content_hash` covers the analytical output, so two runs can be
compared exactly.

---

## What changed from the original analysis

The original version of this project was a single Streamlit script reading one
pre-baked CSV. Auditing it turned up several problems that changed published
numbers. Each fix is a separate commit with its numeric delta recorded, and the
legacy output is still reproduced byte-for-byte so every difference is
attributable.

| Fix | Effect |
| --- | --- |
| **Ingestion.** A hard-coded `skiprows=2` destroyed two worldwide observations. Replaced with header detection. | 29 → 31 observations. Both recovered values were above the pre-surge mean, so the original figure was inflated. |
| **Alignment.** `resample('W-SUN')` labels a week by its *end*; Google Trends labels it by its *start*. The join silently applied a one-week lag. | Now contemporaneous, with lag as an explicit parameter (−4…+4). |
| **Precision.** $/litre was rounded to 2 decimals before analysis, quantising a 0.38–0.70 range. | Full precision retained; rounding is display-only. |
| **Units.** `Price($)/Litre` conflated crude cost with retail pump prices. | Split into `brent_usd_per_barrel` and `brent_usd_per_litre`, both documented. |
| **Comparability.** Countries were ranked by mean Trends score. | Removed — invalid under per-series normalisation. Replaced with scale-free metrics. |
| **Partial weeks.** The final oil week rests on one trading day; it was presented as a full weekly average. | `trading_days` / `is_partial_week` exposed on every row. |
| **Statistics.** No r, p or CI was ever computed, yet "near-perfect correlation" was asserted. | Pearson, Spearman, bootstrap and Fisher intervals, lag profile, leave-one-out, regime splits, specification checks. |
| **Trend confound.** Never tested. | Three specifications reported; no series survives first differencing. |
| **Claims.** Eight uncited external assertions supplied the causal story. | Registered with `requires_citation` and `publishable_as_fact: false`. No source invented. |
| **Documentation.** The README described a different project (IEA/OPEC sources, CAGR, forecasting, a `scripts/` directory — none present). | Rewritten. |

Before/after for every series is in
[§9 of the validation report](reports/VALIDATION_REPORT.md).

---

## Limitations

Read [§13 of METHODOLOGY.md](METHODOLOGY.md) before citing anything here. The
three that matter most:

1. **No short-run co-movement survives.** All six series fail first differencing
   (p > 0.44). Both variables trend upward; a level correlation cannot be
   separated from coincident trends.
2. **30 pairs, only 4 in the elevated-price regime.** Nearly all variance in the
   oil variable sits in one four-week episode.
3. **Interest levels are not comparable across markets.** Per-series
   normalisation. Unfixable without a new multi-region Trends export.

No causal claim in this repository is supported, and none is made.

---

## Author

Benedictus Alfred Djaja — Data Science undergraduate, Bina Nusantara University.

Data: [FRED `DCOILBRENTEU`](https://fred.stlouisfed.org/series/DCOILBRENTEU)
(U.S. EIA) and [Google Trends](https://trends.google.com/trends/).
