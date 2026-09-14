# web/

Placeholder for the Phase 3 frontend. **No application code exists yet.**

Currently this directory holds only the generated analytical artifacts:

```text
web/src/data/generated/
├── panel.json       one row per Trends week: oil (nullable), interest, flags, regime
├── metrics.json     every statistic per series, plus global findings
├── countries.json   series registry + machine-readable comparability rules
├── claims.json      disposition of every claim the original project made
└── manifest.json    source hashes, artifact hashes, analytical configuration
```

These are produced by `pipeline/` and committed so the frontend build never needs
a Python toolchain. Regenerate and verify freshness with:

```bash
cd pipeline
python -m pipeline.build          # write
python -m pipeline.build --check  # fail if stale
```

## Rules for the frontend

1. **Never compute a statistic.** Every number rendered must come from these
   artifacts. No Pearson, Spearman, mean, percentage change or peak detection in
   component code.
2. **Never compare interest levels across series.** The Google Trends exports are
   independently normalised to their own maxima. `countries.json` lists
   `scale_free_metrics`, `series_local_metrics` and `forbidden_comparisons`; every
   series-local metric in `metrics.json` carries
   `_comparable_across_series: false`.
3. **Never render a claim as fact unless `publishable_as_fact` is true** in
   `claims.json`.
4. **Never call the crude price a pump price.** `brent_usd_per_litre` is a
   benchmark cost per litre of crude, not a retail fuel price.

The full contract is specified in
[`../docs/frontend-data-contract.md`](../docs/frontend-data-contract.md).
