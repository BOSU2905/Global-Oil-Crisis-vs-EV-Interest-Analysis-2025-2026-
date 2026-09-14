"""Pipeline entry point:  ``python -m pipeline.build``

One command reproduces every generated artifact from the immutable sources in
``data/raw`` plus the committed Google Trends exports. Nothing else in the
repository is written to.

Flags
-----
``--check``       run without writing; fail if artifacts on disk are stale
``--legacy``      also verify the Phase 2A byte-identical legacy reproduction
``--report``      write reports/VALIDATION_REPORT.md
``--out DIR``     override the artifact directory
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import config as cfg
from .claims import CLAIMS, summarise
from .emit import (
    ARTIFACT_CLAIMS,
    ARTIFACT_COUNTRIES,
    ARTIFACT_METRICS,
    ARTIFACT_PANEL,
    build_countries_payload,
    build_metrics_payload,
    build_panel_payload,
    dumps,
    sha256_of_text,
    write_artifacts,
)
from .ingest import read_all_trends, read_oil_csv
from .legacy import reproduce_legacy_final_data
from .metrics import (
    SeriesMetrics,
    compute_series_metrics,
    evidence_groups,
    peak_dispersion,
    review_categories,
)
from .report import render_validation_report
from .statistics import mean, median
from .transform import Panel, aggregate_oil_weekly, build_panel, detect_regime


@dataclass(frozen=True, slots=True)
class BuildResult:
    panel: Panel
    series_metrics: list[SeriesMetrics]
    payloads: dict[str, dict[str, Any]]
    source_hashes: dict[str, str]
    oil_stats: dict[str, Any]


def _oil_statistics(panel: Panel) -> dict[str, Any]:
    weeks = [row.oil for row in panel.rows if row.oil is not None]
    barrels = [w.usd_per_barrel for w in weeks]
    peak = max(weeks, key=lambda w: w.usd_per_barrel)
    trough = min(weeks, key=lambda w: w.usd_per_barrel)
    return {
        "weeks": len(weeks),
        "first_week": weeks[0].week_start.isoformat(),
        "last_week": weeks[-1].week_start.isoformat(),
        "mean_usd_per_barrel": mean(barrels),
        "median_usd_per_barrel": median(barrels),
        "min_usd_per_barrel": trough.usd_per_barrel,
        "min_week": trough.week_start.isoformat(),
        "max_usd_per_barrel": peak.usd_per_barrel,
        "max_week": peak.week_start.isoformat(),
        "max_usd_per_litre": peak.usd_per_litre,
        "total_pct_change_first_to_max": (peak.usd_per_barrel / barrels[0] - 1.0) * 100.0,
        "partial_weeks": [w.week_start.isoformat() for w in weeks if w.is_partial_week],
        "weeks_with_imputed_days": [
            {"week_start": w.week_start.isoformat(), "imputed_days": w.imputed_days}
            for w in weeks
            if w.imputed_days
        ],
    }


def run() -> BuildResult:
    """Execute the corrected pipeline and assemble every payload."""
    oil = read_oil_csv(cfg.OIL_RAW_CSV)
    trends = read_all_trends(cfg.PROCESSED_DIR, cfg.ALL_SERIES)

    # Restrict the daily oil series to the span the Trends grid needs, then
    # aggregate to Sunday-start weeks.
    trends_start = min(series.dates[0] for series in trends.values())
    oil_weeks = aggregate_oil_weekly(oil.since(trends_start))

    # Regime detection uses only weeks that actually appear in the panel.
    trends_grid = set(next(iter(trends.values())).dates)
    covered = [w for w in oil_weeks if w.week_start in trends_grid]
    regime = detect_regime(covered)
    if not regime.separated:
        print(
            "WARNING: baseline and elevated price regimes overlap in level; the regime "
            "split must not be presented as a distinct price regime.",
            file=sys.stderr,
        )

    panel = build_panel(oil_weeks, trends, regime=regime)

    oil_stats = _oil_statistics(panel)
    oil_peak_week = dt.date.fromisoformat(str(oil_stats["max_week"]))

    series_metrics = [compute_series_metrics(panel, s, oil_peak_week) for s in cfg.ALL_SERIES]
    by_id = {m.series.id: m for m in series_metrics}
    countries = [m for m in series_metrics if m.series.is_country]

    dispersion = peak_dispersion(countries)
    groups = evidence_groups(countries)
    reviews = review_categories({m.series.id: m for m in countries})

    payloads = {
        ARTIFACT_PANEL: build_panel_payload(panel),
        ARTIFACT_METRICS: build_metrics_payload(
            panel, series_metrics, dispersion, reviews, groups, oil_stats
        ),
        ARTIFACT_COUNTRIES: build_countries_payload(),
        ARTIFACT_CLAIMS: {
            "schema_version": "1.0.0",
            "summary": summarise(CLAIMS),
            "policy": {
                "unverifiable_external_claims": (
                    "Claims about geopolitical events, fuel subsidy policy, retail fuel "
                    "prices, vehicle ownership shares and national energy policy cannot be "
                    "tested against the two committed datasets. They are recorded with "
                    "disposition 'requires_citation' and an empty sources list. A claim "
                    "with no sources and no evidence must not be published as fact."
                ),
                "publishable_rule": (
                    "Render a claim as a factual statement only when publishable_as_fact is true."
                ),
            },
            "claims": [c.as_dict() for c in CLAIMS],
        },
    }

    source_hashes = {
        cfg.OIL_RAW_CSV.name: oil.source_sha256,
        **{series.source_path.name: series.source_sha256 for series in trends.values()},
    }

    _ = by_id  # retained for readability of the assembly above
    return BuildResult(panel, series_metrics, payloads, source_hashes, oil_stats)


def _verify_legacy() -> tuple[bool, int, str]:
    """Phase 2A gate: the legacy replay must match the committed CSV exactly."""
    result = reproduce_legacy_final_data(
        cfg.OIL_RAW_CSV, cfg.PROCESSED_DIR, cfg.COUNTRIES, cfg.WORLDWIDE
    )
    produced = result.to_csv_text()
    committed = (cfg.PROCESSED_DIR / "final_data.csv").read_text(encoding="utf-8-sig")
    return produced == committed, len(result), sha256_of_text(produced)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pipeline.build", description=__doc__)
    parser.add_argument("--out", type=Path, default=cfg.GENERATED_DIR)
    parser.add_argument("--check", action="store_true", help="verify artifacts are up to date")
    parser.add_argument("--legacy", action="store_true", help="verify the legacy reproduction")
    parser.add_argument("--report", action="store_true", help="write the validation report")
    args = parser.parse_args(argv)

    if args.legacy:
        ok, rows, digest = _verify_legacy()
        status = "MATCH" if ok else "MISMATCH"
        print(f"[phase 2a] legacy reproduction: {status}  rows={rows}  sha256={digest[:16]}")
        if not ok:
            print(
                "ERROR: legacy replay diverged from data/processed/final_data.csv", file=sys.stderr
            )
            return 1

    result = run()

    if args.check:
        stale: list[str] = []
        for name, payload in result.payloads.items():
            path = args.out / name
            if not path.exists():
                stale.append(f"{name} (missing)")
            elif sha256_of_text(dumps(payload)) != sha256_of_text(path.read_text(encoding="utf-8")):
                stale.append(f"{name} (stale)")
        if stale:
            print(
                "ERROR: generated artifacts are out of date: " + ", ".join(stale), file=sys.stderr
            )
            return 1
        print(f"[check] all {len(result.payloads)} artifacts are up to date in {args.out}")
        return 0

    written = write_artifacts(
        args.out,
        panel_payload=result.payloads[ARTIFACT_PANEL],
        metrics_payload=result.payloads[ARTIFACT_METRICS],
        countries_payload=result.payloads[ARTIFACT_COUNTRIES],
        claims_payload=result.payloads[ARTIFACT_CLAIMS],
        source_hashes=result.source_hashes,
    )

    _print_summary(result, written.directory, written.content_hash)

    if args.report:
        cfg.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        report_path = cfg.REPORTS_DIR / "VALIDATION_REPORT.md"
        legacy_ok, legacy_rows, _ = _verify_legacy()
        report_path.write_text(
            render_validation_report(
                result.panel,
                result.series_metrics,
                result.oil_stats,
                legacy_matches=legacy_ok,
                legacy_rows=legacy_rows,
            ),
            encoding="utf-8",
        )
        print(f"[report] wrote {report_path.relative_to(cfg.REPO_ROOT)}")

    return 0


def _print_summary(result: BuildResult, out_dir: Path, content_hash: str) -> None:
    panel = result.panel
    print(f"\n[coverage] Trends weeks={panel.trends_weeks}  oil weeks={panel.oil_weeks}")
    if panel.weeks_without_oil:
        print(
            "           weeks with no oil observation: "
            + ", ".join(d.isoformat() for d in panel.weeks_without_oil)
        )
    if panel.partial_weeks:
        print(
            "           partial oil weeks: " + ", ".join(d.isoformat() for d in panel.partial_weeks)
        )
    print(
        f"[regime]   onset={panel.regime.onset_week} "
        f"({panel.regime.onset_pct_change * 100:+.1f}% WoW)  "
        f"baseline={len(panel.regime.baseline_weeks)}w "
        f"elevated={len(panel.regime.elevated_weeks)}w  "
        f"separated={panel.regime.separated}"
    )
    print(
        f"\n[metrics]  lag={cfg.PRIMARY_LAG_WEEKS} (contemporaneous), "
        f"CI={cfg.CONFIDENCE_LEVEL:.0%} bootstrap seed={cfg.BOOTSTRAP_SEED}\n"
    )
    header = (
        f"{'series':<16}{'n':>4}{'r':>8}{'p':>9}{'rho':>8}{'CI(low)':>9}{'CI(high)':>9}  "
        f"{'group':<32}{'robust':<9}"
    )
    print(header)
    print("-" * len(header))
    for m in result.series_metrics:
        p = m.primary
        print(
            f"{m.series.label:<16}{p.n:>4}{p.pearson_r:>8.3f}{p.pearson_p:>9.4f}"
            f"{p.spearman_rho:>8.3f}{p.bootstrap_ci.low:>9.3f}{p.bootstrap_ci.high:>9.3f}  "
            f"{m.evidence_group:<32}{m.robustness:<9}"
        )
    print(f"\n[artifacts] {out_dir}  content_hash={content_hash[:16]}")


if __name__ == "__main__":
    raise SystemExit(main())
