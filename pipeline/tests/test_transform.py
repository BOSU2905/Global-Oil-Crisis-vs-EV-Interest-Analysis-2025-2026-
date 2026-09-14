"""Weekly aggregation, unit conversion, alignment, partial weeks, regime split."""

from __future__ import annotations

import csv
import datetime as dt

import pytest

from pipeline import config as cfg
from pipeline.ingest import OilObservation, OilSeries, TrendsSeries
from pipeline.legacy import legacy_week_label
from pipeline.transform import (
    AlignmentError,
    Panel,
    aggregate_oil_weekly,
    build_panel,
    detect_regime,
    pair_with_lag,
)


def daily(
    entries: list[tuple[str, float]], imputed: set[str] | None = None
) -> list[OilObservation]:
    imputed = imputed or set()
    return [
        OilObservation(dt.date.fromisoformat(day), value, day in imputed) for day, value in entries
    ]


# ---------------------------------------------------------------------------
# Week-start convention
# ---------------------------------------------------------------------------


class TestWeekStartConvention:
    @pytest.mark.parametrize(
        ("day", "expected"),
        [
            ("2026-03-01", "2026-03-01"),  # Sunday maps to itself
            ("2026-03-02", "2026-03-01"),  # Monday
            ("2026-03-06", "2026-03-01"),  # Friday
            ("2026-03-07", "2026-03-01"),  # Saturday
            ("2026-03-08", "2026-03-08"),  # next Sunday
        ],
    )
    def test_week_start_is_the_preceding_sunday(self, day: str, expected: str) -> None:
        assert cfg.week_start(dt.date.fromisoformat(day)) == dt.date.fromisoformat(expected)

    def test_differs_from_the_legacy_end_label_by_exactly_one_week(self) -> None:
        """The original bug in one assertion: pandas W-SUN labels the week END,
        Google Trends labels the week START, so joining them shifts by 7 days."""
        for offset in range(14):
            day = dt.date(2026, 3, 2) + dt.timedelta(days=offset)
            if day.weekday() == 6:  # Sunday: both conventions coincide
                assert legacy_week_label(day) == cfg.week_start(day)
            else:
                assert (legacy_week_label(day) - cfg.week_start(day)).days == 7


# ---------------------------------------------------------------------------
# Aggregation, units, partial weeks
# ---------------------------------------------------------------------------


class TestWeeklyAggregation:
    def test_mean_of_the_week_and_trading_day_count(self) -> None:
        weeks = aggregate_oil_weekly(
            daily(
                [
                    ("2026-03-02", 80.0),
                    ("2026-03-03", 82.0),
                    ("2026-03-04", 84.0),
                    ("2026-03-05", 86.0),
                    ("2026-03-06", 88.0),
                ]
            )
        )
        assert len(weeks) == 1
        week = weeks[0]
        assert week.week_start == dt.date(2026, 3, 1)
        assert week.week_end == dt.date(2026, 3, 7)
        assert week.usd_per_barrel == pytest.approx(84.0)
        assert week.trading_days == 5
        assert not week.is_partial_week
        assert (week.min_usd_per_barrel, week.max_usd_per_barrel) == (80.0, 88.0)

    def test_unit_conversion_uses_the_exact_constant(self) -> None:
        week = aggregate_oil_weekly(daily([("2026-03-02", 158.987294928)]))[0]
        assert week.usd_per_litre == pytest.approx(1.0, abs=1e-12)

    def test_conversion_is_a_pure_rescale(self) -> None:
        weeks = aggregate_oil_weekly(
            daily([("2026-03-02", 60.0), ("2026-03-09", 90.0), ("2026-03-16", 120.0)])
        )
        ratios = [w.usd_per_barrel / w.usd_per_litre for w in weeks]
        assert all(r == pytest.approx(cfg.LITRES_PER_BARREL) for r in ratios)

    def test_partial_week_is_flagged(self) -> None:
        weeks = aggregate_oil_weekly(daily([("2026-03-02", 80.0), ("2026-03-03", 82.0)]))
        assert weeks[0].trading_days == 2
        assert weeks[0].is_partial_week

    def test_imputed_days_are_counted_per_week(self) -> None:
        weeks = aggregate_oil_weekly(
            daily(
                [("2026-03-02", 80.0), ("2026-03-03", 80.0), ("2026-03-04", 84.0)],
                imputed={"2026-03-03"},
            )
        )
        assert weeks[0].imputed_days == 1

    def test_weeks_are_returned_in_order(self) -> None:
        weeks = aggregate_oil_weekly(
            daily([("2026-03-16", 100.0), ("2026-03-02", 80.0), ("2026-03-09", 90.0)])
        )
        assert [w.week_start for w in weeks] == sorted(w.week_start for w in weeks)


class TestRealDataShape:
    def test_thirty_weekly_oil_observations_in_the_trends_window(self, panel: Panel) -> None:
        assert panel.trends_weeks == 31
        assert panel.oil_weeks == 30

    def test_the_final_trends_week_has_no_oil_and_is_retained(self, panel: Panel) -> None:
        assert panel.weeks_without_oil == (dt.date(2026, 3, 29),)
        last = panel.rows[-1]
        assert last.week_start == dt.date(2026, 3, 29)
        assert last.oil is None
        assert last.interest["worldwide"] == 100.0  # the peak is not dropped

    def test_exactly_one_partial_week(self, panel: Panel) -> None:
        assert panel.partial_weeks == (dt.date(2026, 3, 22),)
        row = next(r for r in panel.rows if r.week_start == dt.date(2026, 3, 22))
        assert row.oil is not None
        assert row.oil.trading_days == 1

    def test_only_holiday_weeks_carry_imputed_days(self, panel: Panel) -> None:
        imputed = {
            row.week_start.isoformat(): row.oil.imputed_days
            for row in panel.rows
            if row.oil is not None and row.oil.imputed_days
        }
        assert imputed == {"2025-12-21": 2, "2025-12-28": 1}

    def test_reproduces_the_committed_orphan_intermediate(self, oil_series: OilSeries) -> None:
        """Resolves the audit's 'orphan artifact' finding: the committed
        DCOILBRENTEU_2025_filtered.csv is exactly the forward-filled 2025+
        subset of the raw file, so its provenance is now established in code."""
        with cfg.OIL_FILTERED_CSV_LEGACY.open(newline="", encoding="utf-8-sig") as handle:
            committed = [row for row in csv.reader(handle) if row][1:]
        derived = oil_series.since(dt.date(2025, 1, 1))
        assert len(committed) == len(derived)
        for (raw_date, raw_value), observation in zip(committed, derived, strict=True):
            assert dt.date.fromisoformat(raw_date) == observation.date
            assert float(raw_value) == pytest.approx(observation.usd_per_barrel)


# ---------------------------------------------------------------------------
# Lag pairing
# ---------------------------------------------------------------------------


class TestLagPairing:
    def test_lag_zero_pairs_the_same_week(self, panel: Panel) -> None:
        sample = pair_with_lag(panel, "worldwide", 0)
        assert sample.interest_weeks == sample.oil_weeks
        assert len(sample) == 30

    def test_positive_lag_takes_oil_from_earlier_weeks(self, panel: Panel) -> None:
        sample = pair_with_lag(panel, "worldwide", 1)
        assert all(
            (interest - oil).days == 7
            for interest, oil in zip(sample.interest_weeks, sample.oil_weeks, strict=True)
        )

    def test_negative_lag_takes_oil_from_later_weeks(self, panel: Panel) -> None:
        sample = pair_with_lag(panel, "worldwide", -2)
        assert all(
            (oil - interest).days == 14
            for interest, oil in zip(sample.interest_weeks, sample.oil_weeks, strict=True)
        )

    def test_lag_one_reproduces_the_legacy_alignment(self, panel: Panel) -> None:
        """Legacy joined oil from the preceding week; that is lag +1 here."""
        sample = pair_with_lag(panel, "worldwide", 1)
        assert dt.date(2026, 3, 29) in sample.interest_weeks
        index = sample.interest_weeks.index(dt.date(2026, 3, 29))
        assert sample.oil_weeks[index] == dt.date(2026, 3, 22)

    def test_excluding_partial_weeks_drops_one_pair(self, panel: Panel) -> None:
        with_partial = pair_with_lag(panel, "worldwide", 0, include_partial_weeks=True)
        without = pair_with_lag(panel, "worldwide", 0, include_partial_weeks=False)
        assert len(with_partial) - len(without) == 1
        assert with_partial.includes_partial_week
        assert not without.includes_partial_week

    def test_unknown_series_is_rejected(self, panel: Panel) -> None:
        with pytest.raises(KeyError):
            pair_with_lag(panel, "atlantis", 0)

    def test_pair_counts_by_lag(self, panel: Panel) -> None:
        """Counts are asymmetric around zero, and deliberately so.

        There are 31 interest weeks but only 30 oil weeks, because the oil
        extract stops one week short. At lag +1 the oil series is shifted
        forward, which supplies a value for the otherwise-uncovered final
        interest week -- so lag 0 and lag +1 both yield 30 pairs. This is
        precisely the coincidence that let the original notebook's accidental
        +1 alignment go unnoticed.
        """
        counts = {lag: len(pair_with_lag(panel, "worldwide", lag)) for lag in range(-4, 5)}
        assert counts == {-4: 26, -3: 27, -2: 28, -1: 29, 0: 30, 1: 30, 2: 29, 3: 28, 4: 27}

    def test_pair_counts_never_exceed_the_grid(self, panel: Panel) -> None:
        for lag in range(-4, 5):
            assert len(pair_with_lag(panel, "worldwide", lag)) <= panel.oil_weeks


# ---------------------------------------------------------------------------
# Regime detection
# ---------------------------------------------------------------------------


class TestRegimeDetection:
    def test_onset_is_the_largest_week_over_week_rise(self) -> None:
        weeks = aggregate_oil_weekly(
            daily(
                [
                    ("2026-01-05", 60.0),
                    ("2026-01-12", 61.0),
                    ("2026-01-19", 62.0),
                    ("2026-01-26", 90.0),  # +45%
                    ("2026-02-02", 92.0),
                ]
            )
        )
        regime = detect_regime(weeks)
        assert regime.onset_week == dt.date(2026, 1, 25)
        assert regime.onset_pct_change == pytest.approx(90.0 / 62.0 - 1.0)
        assert len(regime.baseline_weeks) == 3
        assert len(regime.elevated_weeks) == 2
        assert regime.separated

    def test_overlapping_regimes_are_flagged_not_separated(self) -> None:
        """A spike that falls back below the baseline maximum is not a regime.

        The guard exists so a future data update cannot silently produce a
        meaningless 'crisis window' that the narrative would then lean on.
        """
        weeks = aggregate_oil_weekly(
            daily(
                [
                    ("2026-01-05", 60.0),
                    ("2026-01-12", 70.0),
                    ("2026-01-19", 90.0),  # onset: largest week-over-week rise
                    ("2026-01-26", 65.0),  # falls back under the baseline max of 70
                ]
            )
        )
        regime = detect_regime(weeks)
        assert regime.onset_week == dt.date(2026, 1, 18)
        assert regime.elevated_min_usd_per_barrel < regime.baseline_max_usd_per_barrel
        assert not regime.separated

    def test_real_data_regime(self, panel: Panel) -> None:
        regime = panel.regime
        assert regime.rule == cfg.REGIME_RULE
        assert regime.onset_week == dt.date(2026, 3, 1)
        assert regime.onset_pct_change == pytest.approx(0.195, abs=0.005)
        assert (len(regime.baseline_weeks), len(regime.elevated_weeks)) == (26, 4)
        assert regime.separated
        assert regime.elevated_min_usd_per_barrel > regime.baseline_max_usd_per_barrel

    def test_classification_of_individual_weeks(self, panel: Panel) -> None:
        assert panel.regime.classify(dt.date(2026, 2, 22)) == "baseline"
        assert panel.regime.classify(dt.date(2026, 3, 1)) == "elevated"
        assert panel.regime.classify(dt.date(2026, 3, 15)) == "elevated"

    def test_needs_enough_weeks(self) -> None:
        weeks = aggregate_oil_weekly(daily([("2026-01-05", 60.0), ("2026-01-12", 61.0)]))
        with pytest.raises(ValueError, match="at least 4 weeks"):
            detect_regime(weeks)


class TestPanelAssembly:
    def test_rejects_empty_trends(self) -> None:
        with pytest.raises(AlignmentError, match="no Trends series"):
            build_panel([], {})

    def test_rejects_a_grid_with_no_oil_overlap(self, trends: dict[str, TrendsSeries]) -> None:
        far_future = aggregate_oil_weekly(daily([("2030-01-07", 80.0), ("2030-01-14", 81.0)]))
        with pytest.raises(AlignmentError, match="no overlap"):
            build_panel(far_future, trends)

    def test_every_trends_week_becomes_a_row(self, panel: Panel) -> None:
        assert len(panel.rows) == panel.trends_weeks
        assert len(panel.rows_with_oil()) == panel.oil_weeks

    def test_regime_is_null_where_oil_is_missing(self, panel: Panel) -> None:
        assert panel.rows[-1].regime is None
        assert all(row.regime is not None for row in panel.rows_with_oil())
