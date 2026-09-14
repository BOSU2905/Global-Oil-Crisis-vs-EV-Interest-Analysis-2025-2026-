"""Ingestion tests, including the regression lock for the skiprows=2 data loss."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from pipeline import config as cfg
from pipeline.ingest import (
    OilSeries,
    SchemaError,
    TrendsSeries,
    read_all_trends,
    read_oil_csv,
    read_trends_csv,
    sha256_of,
)
from pipeline.legacy import _read_legacy_trends

INDONESIA = cfg.series_by_id("indonesia")
WORLDWIDE = cfg.WORLDWIDE


# ---------------------------------------------------------------------------
# The regression the whole phase turns on
# ---------------------------------------------------------------------------


class TestSkiprowsRegression:
    """Locks out the original ``pd.read_csv(..., skiprows=2)`` data loss.

    The committed Google Trends exports have exactly ONE header row. Applying a
    hard-coded ``skiprows=2`` consumed the header and the first data row, then
    promoted the second data row to be the header -- destroying two
    observations from the worldwide series while leaving the five country
    series intact.
    """

    def test_corrected_reader_returns_every_observation(self) -> None:
        series = read_trends_csv(cfg.TRENDS_WORLDWIDE_CSV, WORLDWIDE)
        raw_lines = cfg.TRENDS_WORLDWIDE_CSV.read_text(encoding="utf-8-sig").strip().splitlines()
        # one header row + N data rows, and we must recover all N
        assert len(series) == len(raw_lines) - 1
        assert len(series) == 31

    def test_recovers_the_two_observations_the_bug_destroyed(self) -> None:
        series = read_trends_csv(cfg.TRENDS_WORLDWIDE_CSV, WORLDWIDE)
        recovered = {dt.date(2025, 8, 31), dt.date(2025, 9, 7)}
        assert recovered.issubset(set(series.dates))

    def test_old_behaviour_loses_exactly_two_observations(self) -> None:
        """Documents the bug quantitatively so the fix cannot silently regress."""
        buggy = _read_legacy_trends(cfg.TRENDS_WORLDWIDE_CSV, skiprows=2)
        correct = read_trends_csv(cfg.TRENDS_WORLDWIDE_CSV, WORLDWIDE)
        assert len(buggy) == 29
        assert len(correct) == 31
        assert len(correct) - len(buggy) == 2
        assert dt.date(2025, 8, 31) not in buggy
        assert dt.date(2025, 9, 7) not in buggy

    def test_header_detected_at_row_zero_not_row_two(self) -> None:
        series = read_trends_csv(cfg.TRENDS_WORLDWIDE_CSV, WORLDWIDE)
        assert series.header_row_index == 0
        assert series.preamble_rows == []

    def test_every_series_has_the_same_count(self) -> None:
        loaded = read_all_trends(cfg.PROCESSED_DIR, cfg.ALL_SERIES)
        assert {len(s) for s in loaded.values()} == {31}

    def test_dropped_values_were_above_the_pre_crisis_baseline(self) -> None:
        """The lost points were not neutral: both exceeded the later baseline,
        so discarding them inflated the apparent oil/interest relationship."""
        series = read_trends_csv(cfg.TRENDS_WORLDWIDE_CSV, WORLDWIDE)
        by_week = dict(zip(series.dates, series.values, strict=True))
        lost = [by_week[dt.date(2025, 8, 31)], by_week[dt.date(2025, 9, 7)]]
        pre_crisis = [
            value
            for week, value in by_week.items()
            if dt.date(2025, 9, 14) <= week < dt.date(2026, 3, 1)
        ]
        assert min(lost) > sum(pre_crisis) / len(pre_crisis)


# ---------------------------------------------------------------------------
# Header detection across export shapes
# ---------------------------------------------------------------------------


class TestHeaderDetection:
    def test_two_line_google_preamble(self, write_csv) -> None:
        path = write_csv(
            "preamble.csv",
            "Category: All categories\n\nWeek,electric car: (Worldwide)\n"
            "2025-08-31,60\n2025-09-07,56\n2025-09-14,52\n",
        )
        series = read_trends_csv(path, WORLDWIDE)
        assert len(series) == 3
        assert series.values == [60.0, 56.0, 52.0]
        assert series.detected_header == ["Week", "electric car: (Worldwide)"]

    def test_single_quoted_header_row(self, write_csv) -> None:
        path = write_csv(
            "quoted.csv",
            '"Time","Electric Car"\n"2025-08-31",60\n"2025-09-07",56\n"2025-09-14",52\n',
        )
        series = read_trends_csv(path, WORLDWIDE)
        assert len(series) == 3
        assert series.header_row_index == 0

    def test_no_header_at_all(self, write_csv) -> None:
        path = write_csv("bare.csv", "2025-08-31,60\n2025-09-07,56\n2025-09-14,52\n")
        series = read_trends_csv(path, WORLDWIDE)
        assert len(series) == 3
        assert series.header_row_index == -1
        assert series.detected_header == []

    def test_long_variable_preamble(self, write_csv) -> None:
        path = write_csv(
            "long.csv",
            "Category: All categories\nGeo: Worldwide\nTimeframe: custom\n\n"
            "Week,interest\n2025-08-31,60\n2025-09-07,56\n2025-09-14,52\n",
        )
        series = read_trends_csv(path, WORLDWIDE)
        assert len(series) == 3
        assert len(series.preamble_rows) == 3

    def test_sub_one_convention_is_handled(self, write_csv) -> None:
        path = write_csv(
            "subone.csv",
            '"Time","Electric Car"\n"2025-08-31",<1\n"2025-09-07",56\n"2025-09-14",52\n',
        )
        series = read_trends_csv(path, WORLDWIDE)
        assert series.sub_one_count == 1
        assert series.values[0] == 0.5


class TestTrendsSchemaValidation:
    def test_rejects_non_sunday_week_keys(self, write_csv) -> None:
        path = write_csv(
            "monday.csv",
            "Week,interest\n2025-09-01,60\n2025-09-08,56\n2025-09-15,52\n",
        )
        with pytest.raises(SchemaError, match="Sunday"):
            read_trends_csv(path, WORLDWIDE)

    def test_rejects_non_contiguous_weeks(self, write_csv) -> None:
        path = write_csv(
            "gap.csv",
            "Week,interest\n2025-08-31,60\n2025-09-14,52\n2025-09-21,53\n",
        )
        with pytest.raises(SchemaError, match="non-contiguous"):
            read_trends_csv(path, WORLDWIDE)

    def test_rejects_out_of_range_scores(self, write_csv) -> None:
        path = write_csv(
            "range.csv",
            "Week,interest\n2025-08-31,60\n2025-09-07,140\n2025-09-14,52\n",
        )
        with pytest.raises(SchemaError, match="0-100"):
            read_trends_csv(path, WORLDWIDE)

    def test_rejects_a_file_with_no_data_rows(self, write_csv) -> None:
        path = write_csv("empty.csv", "Category: All categories\n\nWeek,interest\n")
        with pytest.raises(SchemaError, match="no row matched"):
            read_trends_csv(path, WORLDWIDE)

    def test_rejects_descending_dates(self, write_csv) -> None:
        path = write_csv(
            "desc.csv",
            "Week,interest\n2025-09-14,52\n2025-09-07,56\n2025-08-31,60\n",
        )
        with pytest.raises(SchemaError, match="ascending"):
            read_trends_csv(path, WORLDWIDE)

    def test_rejects_mismatched_grids_across_series(self, tmp_path: Path) -> None:
        (tmp_path / WORLDWIDE.filename).write_text(
            "Week,interest\n2025-08-31,60\n2025-09-07,56\n2025-09-14,52\n", encoding="utf-8"
        )
        (tmp_path / INDONESIA.filename).write_text(
            "Week,interest\n2025-09-07,10\n2025-09-14,11\n2025-09-21,12\n", encoding="utf-8"
        )
        with pytest.raises(SchemaError, match="share one weekly grid"):
            read_all_trends(tmp_path, (WORLDWIDE, INDONESIA))


# ---------------------------------------------------------------------------
# Oil ingestion
# ---------------------------------------------------------------------------


class TestOilIngestion:
    def test_reads_the_full_daily_series(self, oil_series: OilSeries) -> None:
        assert len(oil_series) == 1305
        assert oil_series.first_date == dt.date(2021, 3, 23)
        assert oil_series.last_date == dt.date(2026, 3, 23)

    def test_forward_fills_and_counts_market_holidays(self, oil_series: OilSeries) -> None:
        assert oil_series.imputed_count == 41
        assert all(o.usd_per_barrel > 0 for o in oil_series.observations)

    def test_forward_fill_carries_the_previous_close(self, write_csv) -> None:
        path = write_csv(
            "oil.csv",
            "observation_date,DCOILBRENTEU\n2025-01-01,70.00\n2025-01-02,\n2025-01-03,72.00\n",
        )
        series = read_oil_csv(path)
        assert [o.usd_per_barrel for o in series.observations] == [70.0, 70.0, 72.0]
        assert [o.is_imputed for o in series.observations] == [False, True, False]

    def test_accepts_fred_dot_as_missing(self, write_csv) -> None:
        path = write_csv(
            "dot.csv",
            "observation_date,DCOILBRENTEU\n2025-01-01,70.00\n2025-01-02,.\n2025-01-03,72.00\n",
        )
        assert read_oil_csv(path).imputed_count == 1

    def test_only_weekdays_are_present(self, oil_series: OilSeries) -> None:
        assert {o.date.weekday() for o in oil_series.observations} == {0, 1, 2, 3, 4}

    def test_since_filters_inclusively(self, oil_series: OilSeries) -> None:
        subset = oil_series.since(dt.date(2025, 1, 1))
        assert len(subset) == 319
        assert subset[0].date == dt.date(2025, 1, 1)

    def test_rejects_leading_missing_value(self, write_csv) -> None:
        path = write_csv(
            "lead.csv", "observation_date,DCOILBRENTEU\n2025-01-01,\n2025-01-02,70.00\n"
        )
        with pytest.raises(SchemaError, match="nothing to forward-fill"):
            read_oil_csv(path)

    def test_rejects_bad_header(self, write_csv) -> None:
        path = write_csv("bad.csv", "date_col,price\n2025-01-01,70.00\n")
        with pytest.raises(SchemaError, match="observation_date"):
            read_oil_csv(path)

    def test_rejects_negative_price(self, write_csv) -> None:
        path = write_csv(
            "neg.csv", "observation_date,DCOILBRENTEU\n2025-01-01,-5.0\n2025-01-02,70.0\n"
        )
        with pytest.raises(SchemaError, match="non-positive"):
            read_oil_csv(path)

    def test_rejects_duplicate_dates(self, write_csv) -> None:
        path = write_csv(
            "dup.csv",
            "observation_date,DCOILBRENTEU\n2025-01-01,70.0\n2025-01-01,71.0\n2025-01-02,72.0\n",
        )
        with pytest.raises(SchemaError, match="duplicate"):
            read_oil_csv(path)


class TestProvenance:
    def test_source_hashes_are_recorded(
        self, oil_series: OilSeries, trends: dict[str, TrendsSeries]
    ) -> None:
        assert oil_series.source_sha256 == sha256_of(cfg.OIL_RAW_CSV)
        for series in trends.values():
            assert len(series.source_sha256) == 64

    def test_raw_input_is_never_modified(self, oil_series: OilSeries) -> None:
        """Guards the 'raw data remains untouched' requirement."""
        assert sha256_of(cfg.OIL_RAW_CSV) == oil_series.source_sha256
