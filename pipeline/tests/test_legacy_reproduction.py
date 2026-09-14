"""Phase 2A gate: the legacy replay must reproduce the committed CSV exactly.

This is the checkpoint that makes every later correction attributable. If the
replay drifts, a difference in the corrected output can no longer be
distinguished from a porting mistake, and the before/after table in the
validation report becomes meaningless.
"""

from __future__ import annotations

import datetime as dt

import pytest

from pipeline import config as cfg
from pipeline import statistics as st
from pipeline.legacy import (
    LEGACY_COLUMN_ORDER,
    legacy_week_label,
    reproduce_legacy_final_data,
)
from pipeline.report import legacy_correlations

COMMITTED_CSV = cfg.PROCESSED_DIR / "final_data.csv"

#: SHA-256 of data/processed/final_data.csv as committed by the original project.
COMMITTED_SHA256 = "e653ad8c6521dd35ddf19523277181fd68db3558aeb314d84b1696ba086d0d61"


@pytest.fixture(scope="module")
def replay():
    return reproduce_legacy_final_data(
        cfg.OIL_RAW_CSV, cfg.PROCESSED_DIR, cfg.COUNTRIES, cfg.WORLDWIDE
    )


class TestByteIdenticalReplay:
    def test_output_is_byte_identical(self, replay) -> None:
        assert replay.to_csv_text() == COMMITTED_CSV.read_text(encoding="utf-8-sig")

    def test_digest_matches_the_committed_file(self, replay) -> None:
        from pipeline.emit import sha256_of_text

        assert sha256_of_text(replay.to_csv_text()) == COMMITTED_SHA256

    def test_row_count_is_the_truncated_twenty_nine(self, replay) -> None:
        """29, not 31: the skiprows bug is faithfully reproduced here."""
        assert len(replay) == 29

    def test_column_order_preserved(self, replay) -> None:
        header = COMMITTED_CSV.read_text(encoding="utf-8-sig").splitlines()[0]
        assert header.split(",") == list(LEGACY_COLUMN_ORDER)

    def test_window_starts_two_weeks_late(self, replay) -> None:
        assert replay.rows[0]["Observation Date"] == dt.date(2025, 9, 14)
        assert replay.rows[-1]["Observation Date"] == dt.date(2026, 3, 29)


class TestLegacyDefectsAreReproduced:
    def test_price_is_rounded_to_two_decimals(self, replay) -> None:
        for row in replay.rows:
            value = float(row["Price($)/Litre"])
            assert value == round(value, 2)

    def test_rounding_quantises_the_oil_variable(self, replay) -> None:
        """Why the rounding mattered: a 0.38-0.70 range collapses to a handful
        of distinct levels, coarsening every correlation computed from it."""
        distinct = {float(row["Price($)/Litre"]) for row in replay.rows}
        assert len(distinct) <= 15

    def test_week_label_is_the_end_of_the_bin(self) -> None:
        # Monday 2026-03-02 belongs to the bin labelled Sunday 2026-03-08.
        assert legacy_week_label(dt.date(2026, 3, 2)) == dt.date(2026, 3, 8)

    def test_legacy_divisor_was_the_rounded_constant(self) -> None:
        assert cfg.LEGACY_LITRES_PER_BARREL == 159
        assert cfg.LITRES_PER_BARREL != cfg.LEGACY_LITRES_PER_BARREL


class TestBeforeAfterDeltas:
    """Locks the 'before' column of the validation report.

    These are the numbers the original project would have published. They are
    reproduced from code so the before/after comparison cannot be fudged.
    """

    def test_legacy_correlations_match_the_original_analysis(self) -> None:
        before = legacy_correlations()
        expected = {
            "worldwide": 0.772,
            "indonesia": -0.093,
            "malaysia": 0.251,
            "norway": -0.081,
            "singapore": 0.447,
            "us": 0.772,
        }
        for series_id, value in expected.items():
            assert before[series_id]["pearson_r"] == pytest.approx(value, abs=0.002)
            assert before[series_id]["n"] == 29

    def test_legacy_norway_was_negative_and_corrected_is_positive(self, panel) -> None:
        """A sign change caused purely by fixing alignment and precision --
        exactly the kind of shift that must be disclosed, not absorbed."""
        from pipeline.transform import pair_with_lag

        before = legacy_correlations()["norway"]["pearson_r"]
        sample = pair_with_lag(panel, "norway", 0)
        after = st.pearson(sample.oil_usd_per_litre, sample.interest).coefficient
        assert before < 0 < after

    def test_worldwide_correlation_weakens_after_correction(self, panel) -> None:
        """Recovering the two dropped observations lowers the headline r, which
        is the expected direction: both were above the pre-crisis baseline."""
        from pipeline.transform import pair_with_lag

        before = legacy_correlations()["worldwide"]["pearson_r"]
        sample = pair_with_lag(panel, "worldwide", 0)
        after = st.pearson(sample.oil_usd_per_litre, sample.interest).coefficient
        assert after < before
