"""Weekly aggregation, unit conversion, explicit alignment and panel assembly.

This module owns the two corrections that change published numbers most:

1. **Alignment** (Phase 2C). Oil weeks and Trends weeks are both keyed by the
   Sunday that *begins* the week, so a lag of 0 means "the same seven days".
   The original notebook keyed oil by the Sunday that *ends* the week, which
   silently paired each interest observation with the preceding week's oil.

2. **Precision** (Phase 2D). Analytical values are never rounded. The original
   notebook rounded $/litre to 2 decimals before analysis, quantising a
   0.38-0.75 range into roughly 37 distinct levels.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from .config import (
    LITRES_PER_BARREL,
    REGIME_RULE,
    TRADING_DAYS_PER_COMPLETE_WEEK,
    week_start,
)
from .ingest import OilObservation, TrendsSeries
from .statistics import mean


class AlignmentError(ValueError):
    """Raised when the weekly grids cannot be reconciled."""


# ---------------------------------------------------------------------------
# Weekly oil aggregation
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class OilWeek:
    week_start: dt.date
    usd_per_barrel: float
    """Mean of the daily Brent closes falling inside this week."""
    usd_per_litre: float
    """Derived: usd_per_barrel / LITRES_PER_BARREL. Crude benchmark cost per
    litre -- NOT a retail pump price."""
    trading_days: int
    """Number of daily source rows contributing to this weekly mean."""
    imputed_days: int
    """How many of those rows were forward-filled market holidays."""
    is_partial_week: bool
    """True when fewer than 5 trading days contributed."""
    min_usd_per_barrel: float
    max_usd_per_barrel: float

    @property
    def week_end(self) -> dt.date:
        return self.week_start + dt.timedelta(days=6)


def aggregate_oil_weekly(
    observations: Iterable[OilObservation],
    *,
    litres_per_barrel: float = LITRES_PER_BARREL,
) -> list[OilWeek]:
    """Group daily Brent observations into Sunday-start weeks.

    A weekly value is the arithmetic mean of every daily observation whose date
    falls in ``[week_start, week_start + 6]``, which is exactly the span a
    Google Trends week with the same key covers.
    """
    buckets: dict[dt.date, list[OilObservation]] = {}
    for observation in observations:
        buckets.setdefault(week_start(observation.date), []).append(observation)

    weeks: list[OilWeek] = []
    for key in sorted(buckets):
        rows = buckets[key]
        prices = [row.usd_per_barrel for row in rows]
        barrel = mean(prices)
        weeks.append(
            OilWeek(
                week_start=key,
                usd_per_barrel=barrel,
                usd_per_litre=barrel / litres_per_barrel,
                trading_days=len(rows),
                imputed_days=sum(1 for row in rows if row.is_imputed),
                is_partial_week=len(rows) < TRADING_DAYS_PER_COMPLETE_WEEK,
                min_usd_per_barrel=min(prices),
                max_usd_per_barrel=max(prices),
            )
        )
    return weeks


# ---------------------------------------------------------------------------
# Regime detection
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Regime:
    rule: str
    onset_week: dt.date
    onset_pct_change: float
    baseline_weeks: tuple[dt.date, ...]
    elevated_weeks: tuple[dt.date, ...]
    baseline_max_usd_per_barrel: float
    elevated_min_usd_per_barrel: float
    separated: bool
    """True when the elevated regime's minimum exceeds the baseline maximum, so
    the two regimes do not overlap in level. When False the split is reported
    but must not be described as a distinct price regime."""

    def classify(self, week: dt.date) -> str:
        return "elevated" if week >= self.onset_week else "baseline"


def detect_regime(weeks: Sequence[OilWeek]) -> Regime:
    """Split the series into baseline / elevated by ONE parameter-free rule.

    Onset is the week with the largest week-over-week percentage increase in
    weekly mean Brent. There is nothing to tune, so the split cannot be
    reverse-engineered to improve a correlation.
    """
    if len(weeks) < 4:
        raise ValueError("need at least 4 weeks to detect a regime change")

    changes = [
        (weeks[i].week_start, weeks[i].usd_per_barrel / weeks[i - 1].usd_per_barrel - 1.0)
        for i in range(1, len(weeks))
    ]
    onset_week, onset_change = max(changes, key=lambda pair: pair[1])

    baseline = tuple(w.week_start for w in weeks if w.week_start < onset_week)
    elevated = tuple(w.week_start for w in weeks if w.week_start >= onset_week)
    baseline_max = max(w.usd_per_barrel for w in weeks if w.week_start in baseline)
    elevated_min = min(w.usd_per_barrel for w in weeks if w.week_start in elevated)

    return Regime(
        rule=REGIME_RULE,
        onset_week=onset_week,
        onset_pct_change=onset_change,
        baseline_weeks=baseline,
        elevated_weeks=elevated,
        baseline_max_usd_per_barrel=baseline_max,
        elevated_min_usd_per_barrel=elevated_min,
        separated=elevated_min > baseline_max,
    )


# ---------------------------------------------------------------------------
# Panel assembly
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PanelRow:
    week_start: dt.date
    oil: OilWeek | None
    """None when the Trends grid extends beyond the oil extract."""
    interest: dict[str, float]
    regime: str | None
    """'baseline' | 'elevated' | None when there is no oil observation."""

    @property
    def has_oil(self) -> bool:
        return self.oil is not None


@dataclass(frozen=True, slots=True)
class Panel:
    rows: list[PanelRow]
    series_ids: tuple[str, ...]
    regime: Regime
    trends_weeks: int
    oil_weeks: int
    weeks_without_oil: tuple[dt.date, ...]
    partial_weeks: tuple[dt.date, ...]

    def __len__(self) -> int:
        return len(self.rows)

    @property
    def week_starts(self) -> list[dt.date]:
        return [row.week_start for row in self.rows]

    def interest(self, series_id: str) -> list[float]:
        return [row.interest[series_id] for row in self.rows]

    def rows_with_oil(self) -> list[PanelRow]:
        return [row for row in self.rows if row.has_oil]


def build_panel(
    oil_weeks: Sequence[OilWeek],
    trends: dict[str, TrendsSeries],
    *,
    regime: Regime | None = None,
) -> Panel:
    """Assemble the analytical panel on the Trends weekly grid.

    The Trends grid is authoritative for the row set: every Trends week becomes
    a row, and ``oil`` is None where the oil extract does not reach. That keeps
    the artifact honest -- an inner join would silently delete the final week,
    which happens to be the worldwide and US interest peak.
    """
    if not trends:
        raise AlignmentError("no Trends series supplied")

    grids = {sid: tuple(series.dates) for sid, series in trends.items()}
    reference = next(iter(grids.values()))
    if any(grid != reference for grid in grids.values()):
        raise AlignmentError("Trends series do not share a weekly grid")

    oil_by_week = {week.week_start: week for week in oil_weeks}
    covered = [w for w in reference if w in oil_by_week]
    if not covered:
        raise AlignmentError(
            "no overlap between the oil weeks and the Trends weekly grid; check "
            "that both use Sunday week-start keys"
        )

    effective_regime = regime or detect_regime([oil_by_week[w] for w in covered])

    rows = [
        PanelRow(
            week_start=week,
            oil=oil_by_week.get(week),
            interest={sid: series.values[i] for sid, series in trends.items()},
            regime=effective_regime.classify(week) if week in oil_by_week else None,
        )
        for i, week in enumerate(reference)
    ]

    return Panel(
        rows=rows,
        series_ids=tuple(trends.keys()),
        regime=effective_regime,
        trends_weeks=len(reference),
        oil_weeks=len(covered),
        weeks_without_oil=tuple(w for w in reference if w not in oil_by_week),
        partial_weeks=tuple(w for w in covered if oil_by_week[w].is_partial_week),
    )


# ---------------------------------------------------------------------------
# Explicit lag pairing
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PairedSample:
    lag_weeks: int
    oil_usd_per_litre: list[float]
    oil_usd_per_barrel: list[float]
    interest: list[float]
    interest_weeks: list[dt.date]
    oil_weeks: list[dt.date]
    includes_partial_week: bool

    def __len__(self) -> int:
        return len(self.interest)

    @property
    def labels(self) -> list[str]:
        return [week.isoformat() for week in self.interest_weeks]


def pair_with_lag(
    panel: Panel,
    series_id: str,
    lag_weeks: int,
    *,
    include_partial_weeks: bool = True,
) -> PairedSample:
    """Pair oil from week ``t - lag`` with interest at week ``t``.

    ``lag_weeks > 0`` means oil leads interest. ``lag_weeks == 0`` is
    contemporaneous. The original notebook's accidental alignment is ``+1``.
    """
    if series_id not in panel.series_ids:
        raise KeyError(f"unknown series id {series_id!r}")

    by_week = {row.week_start: row for row in panel.rows}
    offset = dt.timedelta(weeks=lag_weeks)

    oil_litre: list[float] = []
    oil_barrel: list[float] = []
    interest: list[float] = []
    interest_weeks: list[dt.date] = []
    oil_weeks: list[dt.date] = []
    partial = False

    for row in panel.rows:
        source = by_week.get(row.week_start - offset)
        if source is None or source.oil is None:
            continue
        if source.oil.is_partial_week and not include_partial_weeks:
            continue
        oil_litre.append(source.oil.usd_per_litre)
        oil_barrel.append(source.oil.usd_per_barrel)
        interest.append(row.interest[series_id])
        interest_weeks.append(row.week_start)
        oil_weeks.append(source.week_start)
        partial = partial or source.oil.is_partial_week

    return PairedSample(
        lag_weeks=lag_weeks,
        oil_usd_per_litre=oil_litre,
        oil_usd_per_barrel=oil_barrel,
        interest=interest,
        interest_weeks=interest_weeks,
        oil_weeks=oil_weeks,
        includes_partial_week=partial,
    )
