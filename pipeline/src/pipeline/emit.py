"""Serialisation of analytical results into the generated JSON artifacts.

Contract with the future frontend:

  * ``panel.json``     one row per Trends week: oil, interest, flags, regime
  * ``metrics.json``   every statistic, per series, plus global findings
  * ``countries.json`` the series registry and the comparability rules
  * ``claims.json``    disposition of every claim the original project made
  * ``manifest.json``  reproducibility metadata

Rules enforced here:

  * JSON must be strictly valid: non-finite floats (NaN / inf) become ``null``,
    never the literal ``NaN`` that ``json.dump`` emits by default.
  * Floats are rounded to 10 decimals so artifacts are diff-stable.
  * ``manifest.json`` is the ONLY file containing a wall-clock timestamp, so
    every other artifact is byte-reproducible across runs.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import config as cfg
from .claims import CLAIMS, summarise
from .metrics import STRENGTH_BANDS, CategoryReview, PeakDispersion, SeriesMetrics
from .transform import Panel

SCHEMA_VERSION = "1.0.0"
FLOAT_DECIMALS = 10

ARTIFACT_PANEL = "panel.json"
ARTIFACT_METRICS = "metrics.json"
ARTIFACT_COUNTRIES = "countries.json"
ARTIFACT_CLAIMS = "claims.json"
ARTIFACT_MANIFEST = "manifest.json"


def _clean(value: Any) -> Any:
    """Recursively make a structure JSON-safe and diff-stable."""
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        return round(value, FLOAT_DECIMALS)
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean(v) for v in value]
    return value


def dumps(payload: Any) -> str:
    return json.dumps(_clean(payload), indent=2, ensure_ascii=False, allow_nan=False) + "\n"


def sha256_of_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Payload builders
# ---------------------------------------------------------------------------


def build_panel_payload(panel: Panel) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for row in panel.rows:
        oil = row.oil
        rows.append(
            {
                "week_start": row.week_start.isoformat(),
                "week_end": (row.week_start + dt.timedelta(days=6)).isoformat(),
                "regime": row.regime,
                "oil": None
                if oil is None
                else {
                    "brent_usd_per_barrel": round(
                        oil.usd_per_barrel, cfg.DISPLAY_DECIMALS_PER_BARREL
                    ),
                    "brent_usd_per_litre": round(oil.usd_per_litre, cfg.DISPLAY_DECIMALS_PER_LITRE),
                    "brent_usd_per_barrel_exact": oil.usd_per_barrel,
                    "brent_usd_per_litre_exact": oil.usd_per_litre,
                    "trading_days": oil.trading_days,
                    "imputed_days": oil.imputed_days,
                    "is_partial_week": oil.is_partial_week,
                    "min_usd_per_barrel": oil.min_usd_per_barrel,
                    "max_usd_per_barrel": oil.max_usd_per_barrel,
                },
                "interest": dict(row.interest),
            }
        )

    return {
        "schema_version": SCHEMA_VERSION,
        "units": {
            "brent_usd_per_barrel": "USD per barrel (Brent crude benchmark spot price)",
            "brent_usd_per_litre": (
                f"USD per litre of crude, derived as USD/barrel / {cfg.LITRES_PER_BARREL}. "
                "This is a crude benchmark cost, NOT a retail pump price."
            ),
            "interest": (
                "Google Trends relative search interest, 0-100, rescaled independently "
                "per series. Levels are not comparable between series."
            ),
        },
        "conventions": {
            "week_key": "week_start (the Sunday beginning the 7-day week)",
            "oil_aggregation": "arithmetic mean of daily closes within the week",
            "missing_daily_values": (
                "forward-filled from the previous trading day, counted in imputed_days"
            ),
            "rows_without_oil": (
                "oil is null where the Trends grid extends beyond the oil extract; such "
                "rows are retained rather than dropped so no interest observation is lost"
            ),
        },
        "coverage": {
            "trends_weeks": panel.trends_weeks,
            "oil_weeks": panel.oil_weeks,
            "first_week": panel.rows[0].week_start.isoformat(),
            "last_week": panel.rows[-1].week_start.isoformat(),
            "weeks_without_oil": [d.isoformat() for d in panel.weeks_without_oil],
            "partial_weeks": [d.isoformat() for d in panel.partial_weeks],
        },
        "rows": rows,
    }


def build_countries_payload() -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "series": [
            {
                "id": s.id,
                "label": s.label,
                "short": s.short,
                "is_country": s.is_country,
                "source_file": s.filename,
                "legacy_column": s.legacy_column,
            }
            for s in cfg.ALL_SERIES
        ],
        "comparability": {
            "trends_normalisation": cfg.TRENDS_NORMALISATION,
            "explanation": (
                "Each Google Trends export is an independent query rescaled so its own "
                "maximum week equals 100. Every series therefore contains a 100 and sits "
                "on its own scale."
            ),
            "scale_free_metrics": list(cfg.SCALE_FREE_METRICS),
            "series_local_metrics": list(cfg.SERIES_LOCAL_METRICS),
            "forbidden_comparisons": [
                "ranking series by mean interest",
                "ranking series by peak interest value",
                "describing one market as having more search interest than another",
                "any statement comparing absolute interest levels between series",
            ],
            "remedy": (
                "A single Google Trends multi-region comparison query would place all five "
                "markets on one shared scale and make level comparison valid. That requires "
                "a new export; it cannot be recovered from the committed files."
            ),
        },
    }


def build_metrics_payload(
    panel: Panel,
    series_metrics: list[SeriesMetrics],
    dispersion: PeakDispersion,
    category_reviews: list[CategoryReview],
    groups: dict[str, list[str]],
    oil_stats: dict[str, Any],
) -> dict[str, Any]:
    by_id = {m.series.id: m for m in series_metrics}
    countries = [m for m in series_metrics if m.series.is_country]

    return {
        "schema_version": SCHEMA_VERSION,
        "configuration": {
            "primary_lag_weeks": cfg.PRIMARY_LAG_WEEKS,
            "lag_window_weeks": [cfg.LAG_MIN_WEEKS, cfg.LAG_MAX_WEEKS],
            "min_pairs_for_lag": cfg.MIN_PAIRS_FOR_LAG,
            "confidence_level": cfg.CONFIDENCE_LEVEL,
            "bootstrap_iterations": cfg.BOOTSTRAP_ITERATIONS,
            "bootstrap_seed": cfg.BOOTSTRAP_SEED,
            "significance_alpha": cfg.SIGNIFICANCE_ALPHA,
            "litres_per_barrel": cfg.LITRES_PER_BARREL,
            "include_partial_weeks_in_primary": cfg.INCLUDE_PARTIAL_WEEKS_IN_PRIMARY,
            "regime_rule": cfg.REGIME_RULE,
            "lag_sign_convention": (
                "lag = k pairs oil from week (t - k) with interest at week t; k > 0 means "
                "oil leads interest"
            ),
        },
        "global": {
            "oil": oil_stats,
            "regime": {
                "rule": panel.regime.rule,
                "onset_week": panel.regime.onset_week.isoformat(),
                "onset_pct_change": panel.regime.onset_pct_change,
                "baseline_weeks": len(panel.regime.baseline_weeks),
                "elevated_weeks": len(panel.regime.elevated_weeks),
                "baseline_max_usd_per_barrel": panel.regime.baseline_max_usd_per_barrel,
                "elevated_min_usd_per_barrel": panel.regime.elevated_min_usd_per_barrel,
                "regimes_separated": panel.regime.separated,
            },
            "peak_dispersion": dispersion.as_dict(),
            "worldwide": by_id["worldwide"].as_dict() if "worldwide" in by_id else None,
            "evidence_groups": groups,
        },
        "series": {m.series.id: m.as_dict() for m in series_metrics},
        "countries": [m.series.id for m in countries],
        "category_review": [r.as_dict() for r in category_reviews],
        "interpretation_vocabulary": {
            "strength": [label for _, label in STRENGTH_BANDS],
            "robustness": ["fragile", "moderate", "robust"],
            "evidence_group": sorted(groups.keys()),
            "note": (
                "These are classification codes, not published prose. The content layer "
                "maps codes to wording; the analytical layer never stores editorial text."
            ),
        },
    }


def build_manifest_payload(
    *,
    source_hashes: dict[str, str],
    artifact_hashes: dict[str, str],
    coverage: dict[str, Any],
    generated_at: dt.datetime,
) -> dict[str, Any]:
    content_hash = hashlib.sha256(
        "".join(f"{name}:{digest}" for name, digest in sorted(artifact_hashes.items())).encode()
    ).hexdigest()

    return {
        "schema_version": SCHEMA_VERSION,
        "pipeline_version": _pipeline_version(),
        # RFC 3339 in UTC with a single 'Z' designator. Normalising to UTC and
        # dropping tzinfo before formatting avoids emitting '+00:00Z', which is
        # not a valid timestamp and would fail strict date parsing downstream.
        "generated_at": (
            generated_at.astimezone(dt.UTC).replace(microsecond=0, tzinfo=None).isoformat() + "Z"
        ),
        "_determinism_note": (
            "generated_at is the only non-reproducible field in any artifact. Compare "
            "content_hash to verify that two runs produced identical analytical output."
        ),
        "content_hash": content_hash,
        "sources": [
            {
                "id": s.id,
                "name": s.name,
                "publisher": s.publisher,
                "url": s.url,
                "series_id": s.series_id,
                "units": s.units,
                "frequency": s.frequency,
                "notes": s.notes,
            }
            for s in cfg.DATA_SOURCES
        ],
        "source_files": source_hashes,
        "artifacts": artifact_hashes,
        "coverage": coverage,
        "analytical_configuration": {
            "primary_lag_weeks": cfg.PRIMARY_LAG_WEEKS,
            "lag_window_weeks": [cfg.LAG_MIN_WEEKS, cfg.LAG_MAX_WEEKS],
            "confidence_level": cfg.CONFIDENCE_LEVEL,
            "bootstrap_iterations": cfg.BOOTSTRAP_ITERATIONS,
            "bootstrap_seed": cfg.BOOTSTRAP_SEED,
            "litres_per_barrel": cfg.LITRES_PER_BARREL,
            "regime_rule": cfg.REGIME_RULE,
            "trends_normalisation": cfg.TRENDS_NORMALISATION,
        },
        "claims_summary": summarise(CLAIMS),
    }


def _pipeline_version() -> str:
    from . import __version__

    return __version__


# ---------------------------------------------------------------------------
# Writer
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class WriteResult:
    directory: Path
    hashes: dict[str, str]
    content_hash: str


def write_artifacts(
    out_dir: Path,
    *,
    panel_payload: dict[str, Any],
    metrics_payload: dict[str, Any],
    countries_payload: dict[str, Any],
    claims_payload: dict[str, Any],
    source_hashes: dict[str, str],
    generated_at: dt.datetime | None = None,
) -> WriteResult:
    out_dir.mkdir(parents=True, exist_ok=True)

    documents = {
        ARTIFACT_PANEL: dumps(panel_payload),
        ARTIFACT_METRICS: dumps(metrics_payload),
        ARTIFACT_COUNTRIES: dumps(countries_payload),
        ARTIFACT_CLAIMS: dumps(claims_payload),
    }

    hashes: dict[str, str] = {}
    for name, text in documents.items():
        (out_dir / name).write_text(text, encoding="utf-8")
        hashes[name] = sha256_of_text(text)

    manifest = build_manifest_payload(
        source_hashes=source_hashes,
        artifact_hashes=hashes,
        coverage=panel_payload["coverage"],
        generated_at=generated_at or dt.datetime.now(dt.UTC),
    )
    manifest_text = dumps(manifest)
    (out_dir / ARTIFACT_MANIFEST).write_text(manifest_text, encoding="utf-8")

    return WriteResult(
        directory=out_dir,
        hashes={**hashes, ARTIFACT_MANIFEST: sha256_of_text(manifest_text)},
        content_hash=str(manifest["content_hash"]),
    )
