"""Single source of truth for paths, conventions and analytical parameters.

Nothing in this pipeline hard-codes a path, a country name, a threshold or a
statistical parameter. Everything lives here so that the analytical
configuration can be serialised into the artifact manifest and audited.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from pathlib import Path
from typing import Final

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# pipeline/src/pipeline/config.py -> repository root
REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[3]

DATA_DIR: Final[Path] = REPO_ROOT / "data"
RAW_DIR: Final[Path] = DATA_DIR / "raw"
PROCESSED_DIR: Final[Path] = DATA_DIR / "processed"

#: Daily Brent crude spot price, FRED series DCOILBRENTEU. IMMUTABLE INPUT.
OIL_RAW_CSV: Final[Path] = RAW_DIR / "DCOILBRENTEU.csv"

#: Committed derived artifact from the original project. Not an input to this
#: pipeline -- we derive the same series from OIL_RAW_CSV instead. It is used
#: only by tests/test_transform.py as a provenance check (we prove we can
#: reproduce it, which resolves the "orphan artifact" finding from the audit).
OIL_FILTERED_CSV_LEGACY: Final[Path] = PROCESSED_DIR / "DCOILBRENTEU_2025_filtered.csv"

#: Google Trends exports. NOTE: these are *raw* source data that happen to
#: live under data/processed/ in the original repository layout. They are read
#: read-only and left in place; relocating them to data/raw/trends/ is a
#: deliberate Phase 3 task (a `git mv`, so history is preserved).
TRENDS_WORLDWIDE_CSV: Final[Path] = PROCESSED_DIR / "EV Trends.csv"

#: Output directory for generated artifacts consumed by the future frontend.
GENERATED_DIR: Final[Path] = REPO_ROOT / "web" / "src" / "data" / "generated"

#: Where the human-readable validation report is written.
REPORTS_DIR: Final[Path] = REPO_ROOT / "reports"


# ---------------------------------------------------------------------------
# Series registry
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Series:
    """A single Google Trends interest series."""

    id: str
    """Canonical machine identifier. Used as the JSON key everywhere."""

    label: str
    """Display label. The frontend must use this and never invent its own."""

    short: str
    """Three-letter code for compact chart labelling."""

    filename: str
    """File name inside PROCESSED_DIR."""

    legacy_column: str
    """Column name used in the original notebook / final_data.csv. Retained so
    the Phase 2A legacy reproduction can be byte-compared."""

    is_country: bool = True
    """False for the aggregate worldwide series."""


WORLDWIDE: Final[Series] = Series(
    id="worldwide",
    label="Worldwide",
    short="WLD",
    filename="EV Trends.csv",
    legacy_column="Worldwide Trends",
    is_country=False,
)

COUNTRIES: Final[tuple[Series, ...]] = (
    Series("indonesia", "Indonesia", "IDN", "Indonesia_EV_Trends.csv", "Indonesia EV Trends"),
    Series("malaysia", "Malaysia", "MYS", "Malaysia_EV_Trends.csv", "Malaysia EV Trends"),
    Series("norway", "Norway", "NOR", "Norway_EV_Trends.csv", "Norway EV Trends"),
    Series("singapore", "Singapore", "SGP", "Singapore_EV_Trends.csv", "Singapore EV Trends"),
    # The file is named US_*, the original app column said "USA", and the prose
    # said "United States"/"America". One canonical id, one label, forever.
    Series("us", "United States", "USA", "US_EV_Trends.csv", "USA EV Trends"),
)

ALL_SERIES: Final[tuple[Series, ...]] = (WORLDWIDE, *COUNTRIES)


def series_by_id(series_id: str) -> Series:
    for s in ALL_SERIES:
        if s.id == series_id:
            return s
    raise KeyError(f"Unknown series id: {series_id!r}")


# ---------------------------------------------------------------------------
# Unit conversion
# ---------------------------------------------------------------------------

#: One US petroleum barrel in litres (42 US gallons x 3.785411784 L).
#: The original project used the rounded value 159; we keep the exact figure.
#: Correlation results are mathematically invariant to this constant because
#: the conversion is a positive linear rescale -- it affects displayed values
#: only. See METHODOLOGY.md.
LITRES_PER_BARREL: Final[float] = 158.987294928

#: The rounded divisor used by the original notebook, kept for legacy replay.
LEGACY_LITRES_PER_BARREL: Final[int] = 159

#: The original notebook rounded $/litre to 2 decimal places *before*
#: analysis, quantising a 0.38-0.75 range into ~37 distinct values. The
#: corrected pipeline never rounds analytical inputs; rounding is a
#: presentation concern applied at emit time only.
DISPLAY_DECIMALS_PER_LITRE: Final[int] = 4
DISPLAY_DECIMALS_PER_BARREL: Final[int] = 2


# ---------------------------------------------------------------------------
# Weekly alignment convention  (Phase 2C)
# ---------------------------------------------------------------------------
#
# Google Trends weekly exports label each week by its FIRST day, which is a
# Sunday. Verified in tests: every date in every Trends export is a Sunday.
#
# FRED DCOILBRENTEU is a DAILY series with one row per weekday (Mon-Fri).
# Market holidays appear as rows with an empty value.
#
# The original notebook used pandas `resample('W-SUN')`, which labels each bin
# by the Sunday that *ends* it (bin = Mon..Sun). Joining that to a Trends key
# that means "week starting Sunday" silently paired oil from the PRECEDING
# week with each interest observation -- an accidental 1-week lag.
#
# CANONICAL CONVENTION (this pipeline):
#   week_start = the Sunday that BEGINS the week containing a date.
#   A weekly oil value is the mean of all daily observations whose date falls
#   in [week_start, week_start + 6 days].
#   This makes the oil week and the Trends week cover exactly the same 7 days.
#
# Legacy behaviour is therefore reproducible as lag = +1 (see LAG_* below).
# ---------------------------------------------------------------------------

WEEK_START_WEEKDAY: Final[int] = 6  # Python date.weekday(): Monday=0 ... Sunday=6


def week_start(day: dt.date) -> dt.date:
    """Return the Sunday that begins the week containing ``day``."""
    return day - dt.timedelta(days=(day.weekday() + 1) % 7)


#: Expected number of trading days (Mon-Fri) in a complete week.
TRADING_DAYS_PER_COMPLETE_WEEK: Final[int] = 5


# ---------------------------------------------------------------------------
# Lag analysis  (Phase 2G)
# ---------------------------------------------------------------------------
#
# SIGN CONVENTION: lag = k pairs the oil price of week (t - k) with the EV
# interest of week t.
#
#   k =  0  contemporaneous (both series describe the same 7 days)
#   k > 0  oil LEADS interest by k weeks
#   k < 0  interest LEADS oil by |k| weeks (included as a sanity check; a
#          strong negative-lag result would suggest a spurious or reversed
#          relationship rather than an oil-driven one)
#
# The original notebook's accidental alignment corresponds to k = +1.
# ---------------------------------------------------------------------------

PRIMARY_LAG_WEEKS: Final[int] = 0
LAG_MIN_WEEKS: Final[int] = -4
LAG_MAX_WEEKS: Final[int] = 4

#: Refuse to report a lag correlation computed on fewer pairs than this.
#: With ~30 weekly observations, |lag| = 4 still leaves 26 pairs.
MIN_PAIRS_FOR_LAG: Final[int] = 20


# ---------------------------------------------------------------------------
# Statistical parameters  (Phase 2F)
# ---------------------------------------------------------------------------

CONFIDENCE_LEVEL: Final[float] = 0.95
BOOTSTRAP_ITERATIONS: Final[int] = 10_000
BOOTSTRAP_SEED: Final[int] = 20260329
"""Fixed seed => bit-for-bit reproducible confidence intervals. Chosen as the
date of the final observation in the dataset; it carries no analytical meaning."""

#: Conventional threshold used only to *label* results in the artifacts. It is
#: never used to select, filter or promote a finding.
SIGNIFICANCE_ALPHA: Final[float] = 0.05


# ---------------------------------------------------------------------------
# Regime / event window  (Phase 2H)
# ---------------------------------------------------------------------------
#
# The regime split is derived from the data by ONE documented rule with no
# tunable parameters, decided before looking at any correlation:
#
#   onset week = the week with the largest week-over-week percentage increase
#                in the weekly mean Brent price.
#   baseline   = every week before the onset week.
#   elevated   = the onset week and every week after it.
#
# The split is only reported as a valid regime comparison if the elevated
# minimum exceeds the baseline maximum (i.e. the two regimes do not overlap in
# level). That guard is asserted in transform.py, so a future data update that
# breaks the assumption fails loudly instead of silently producing a
# meaningless "crisis window".
# ---------------------------------------------------------------------------

REGIME_RULE: Final[str] = "max_week_over_week_pct_increase"


# ---------------------------------------------------------------------------
# Analysis-set policy  (Phase 2E)
# ---------------------------------------------------------------------------
#
# The final oil week in the source data is incomplete (fewer than 5 trading
# days) because the FRED extract ends mid-week. Two defensible choices:
#   (a) drop it            -> loses information
#   (b) keep it and flag it -> retains information, requires disclosure
#
# We choose (b): the week is included in the primary analysis set and carries
# `is_partial_week = true` in every artifact, and a dedicated sensitivity
# result reports what happens when partial weeks are excluded.
# ---------------------------------------------------------------------------

INCLUDE_PARTIAL_WEEKS_IN_PRIMARY: Final[bool] = True


# ---------------------------------------------------------------------------
# Cross-country comparability  (Phase 2I)
# ---------------------------------------------------------------------------
#
# Each Google Trends export is an INDEPENDENT query, each rescaled so that its
# own maximum week = 100. All six series therefore contain a 100 and live on
# six different scales.
#
# Consequences, encoded into the artifacts as machine-readable metadata so the
# frontend cannot re-introduce the error:
#   * comparing means/levels ACROSS series is invalid
#   * "most enthusiastic country" cannot be derived from these data
#   * valid cross-series comparisons are scale-free only: correlation, lag,
#     peak timing, and within-series relative change
# ---------------------------------------------------------------------------

TRENDS_NORMALISATION: Final[str] = "per_series_max_100_independent_queries"

#: Metric ids that may legitimately be compared across series.
SCALE_FREE_METRICS: Final[tuple[str, ...]] = (
    "pearson_r",
    "spearman_rho",
    "peak_week",
    "peak_lag_weeks",
    "baseline_to_peak_pct_change",
    "baseline_to_elevated_pct_change",
    "best_lag_weeks",
)

#: Metric ids that must NEVER be compared across series. Emitted so the
#: frontend can assert on it.
SERIES_LOCAL_METRICS: Final[tuple[str, ...]] = (
    "mean_interest",
    "median_interest",
    "peak_value",
    "baseline_mean_interest",
    "elevated_mean_interest",
    "min_interest",
)


# ---------------------------------------------------------------------------
# Source provenance  (Phase 2L)
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class DataSource:
    id: str
    name: str
    publisher: str
    url: str
    series_id: str | None
    units: str
    frequency: str
    notes: str


DATA_SOURCES: Final[tuple[DataSource, ...]] = (
    DataSource(
        id="fred_dcoilbrenteu",
        name="Crude Oil Prices: Brent - Europe",
        publisher=(
            "U.S. Energy Information Administration, via FRED (Federal Reserve Bank of St. Louis)"
        ),
        url="https://fred.stlouisfed.org/series/DCOILBRENTEU",
        series_id="DCOILBRENTEU",
        units="U.S. dollars per barrel",
        frequency="daily (business days)",
        notes=(
            "Spot price, not seasonally adjusted. Market holidays are present as "
            "empty values and are forward-filled by this pipeline. This is a CRUDE "
            "benchmark price and is not a retail pump price."
        ),
    ),
    DataSource(
        id="google_trends_electric_car",
        name='Google Trends: search interest for "Electric Car"',
        publisher="Google Trends",
        url="https://trends.google.com/trends/",
        series_id=None,
        units="relative search interest (0-100, rescaled per query)",
        frequency="weekly (week beginning Sunday)",
        notes=(
            "Six independent exports: Worldwide, Indonesia, Malaysia, Norway, "
            "Singapore, United States. Each export is independently rescaled so its "
            "own maximum week equals 100, so LEVELS ARE NOT COMPARABLE ACROSS "
            "EXPORTS. Exact query terms, category and retrieval date were not "
            "recorded by the original project and are listed as an open provenance "
            "gap in reports/VALIDATION_REPORT.md."
        ),
    ),
)
