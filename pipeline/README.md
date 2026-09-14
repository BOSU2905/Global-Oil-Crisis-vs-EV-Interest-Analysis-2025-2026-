# Pipeline

Analysis layer for the Oil vs EV interest project. Reads the immutable sources in
`../data`, writes validated JSON to `../web/src/data/generated`.

```bash
python -m pipeline.build --legacy --report
```

Python 3.11+, no third-party runtime dependencies. See
[`../METHODOLOGY.md`](../METHODOLOGY.md) for the analytical decisions and
[`../reports/VALIDATION_REPORT.md`](../reports/VALIDATION_REPORT.md) for results.

## Module boundaries

```
config      paths, series registry, every analytical constant and convention
   ↓
ingest      read + validate; header detection, forward fill, schema errors
   ↓
transform   weekly aggregation, unit conversion, alignment, lag, regime split
   ↓
metrics     correlations, intervals, lag profile, specification checks, sensitivity
   ↓
emit        JSON artifacts + manifest
   ↓
build       CLI orchestration

statistics  stdlib primitives used by metrics (no domain knowledge)
claims      register of every claim the original project made
legacy      bug-for-bug replay of the original notebook (regression fixture)
report      renders the validation report from live metrics
```

The arrows point one way. No statistic is computed outside this package, and
`metrics.json` contains classification codes rather than prose so that editorial
wording never lives in the analytical layer.

## Commands

| Command | Purpose |
| --- | --- |
| `python -m pipeline.build` | write artifacts |
| `python -m pipeline.build --legacy` | assert the legacy replay still matches `final_data.csv` byte-for-byte |
| `python -m pipeline.build --report` | write `../reports/VALIDATION_REPORT.md` |
| `python -m pipeline.build --check` | fail if committed artifacts are stale (for CI) |
| `python -m pytest` | 190 tests |
| `ruff check . && ruff format --check .` | lint + format |
| `mypy src` | strict type check |

## Changing the analysis

Every threshold, window and convention is a constant in `config.py`, and the
values that affect results are serialised into `manifest.json` so any published
figure can be traced to the configuration that produced it. Change a constant,
re-run the build, and the validation report and artifacts update together.

Two invariants are enforced by tests and should stay that way:

- `--legacy` must keep matching. It is what makes every corrected number
  attributable to a decision rather than to a porting error.
- No metric that compares interest *levels* across series may be emitted. The
  Google Trends exports are independently normalised; see `METHODOLOGY.md` §6.
