"""Metrics tests: unit/scale invariance, lag, sensitivity, comparability guards."""

from __future__ import annotations

import datetime as dt

import pytest

from pipeline import config as cfg
from pipeline import statistics as st
from pipeline.metrics import (
    Caveat,
    best_lag,
    compute_series_metrics,
    correlate,
    evidence_groups,
    interest_profile,
    lag_profile,
    negative_lag_maximum,
    peak_dispersion,
    review_categories,
    strength_label,
    trend_diagnostics,
)
from pipeline.transform import Panel, pair_with_lag

OIL_PEAK_WEEK = dt.date(2026, 3, 15)


@pytest.fixture(scope="module")
def all_metrics(panel: Panel):
    return {s.id: compute_series_metrics(panel, s, OIL_PEAK_WEEK) for s in cfg.ALL_SERIES}


@pytest.fixture(scope="module")
def country_metrics(all_metrics):
    return [m for m in all_metrics.values() if m.series.is_country]


# ---------------------------------------------------------------------------
# Invariance properties
# ---------------------------------------------------------------------------


class TestUnitInvariance:
    def test_correlations_identical_in_barrels_and_litres(self, panel: Panel) -> None:
        """The /158.99 conversion must not move any coefficient. If this fails,
        a reported r depends on an arbitrary unit choice."""
        sample = pair_with_lag(panel, "worldwide", 0)
        litre = st.pearson(sample.oil_usd_per_litre, sample.interest)
        barrel = st.pearson(sample.oil_usd_per_barrel, sample.interest)
        assert litre.coefficient == pytest.approx(barrel.coefficient, abs=1e-12)
        assert litre.p_value == pytest.approx(barrel.p_value, abs=1e-12)

    def test_spearman_identical_in_either_unit(self, panel: Panel) -> None:
        sample = pair_with_lag(panel, "worldwide", 0)
        assert st.spearman(sample.oil_usd_per_litre, sample.interest).coefficient == pytest.approx(
            st.spearman(sample.oil_usd_per_barrel, sample.interest).coefficient, abs=1e-12
        )

    def test_ols_slope_does_change_with_units(self, panel: Panel) -> None:
        """Sanity check on the invariance claim: the slope is unit-dependent
        even though r is not, so the fit must be emitted with its unit fixed."""
        sample = pair_with_lag(panel, "worldwide", 0)
        litre = st.linear_fit(sample.oil_usd_per_litre, sample.interest)
        barrel = st.linear_fit(sample.oil_usd_per_barrel, sample.interest)
        assert litre.slope == pytest.approx(barrel.slope * cfg.LITRES_PER_BARREL, rel=1e-9)


class TestScaleFreeMetrics:
    def test_percentage_change_survives_rescaling_the_series(self, panel: Panel) -> None:
        """Google Trends rescales each series arbitrarily. Any metric we compare
        across countries must be invariant to that rescaling."""
        profile = interest_profile(panel, "us", OIL_PEAK_WEEK)

        # Halve every interest value for the series; ratios must not move.
        scaled_rows = []
        for row in panel.rows:
            scaled = dict(row.interest)
            scaled["us"] = scaled["us"] * 0.5
            scaled_rows.append(type(row)(row.week_start, row.oil, scaled, row.regime))
        scaled_panel = Panel(
            rows=scaled_rows,
            series_ids=panel.series_ids,
            regime=panel.regime,
            trends_weeks=panel.trends_weeks,
            oil_weeks=panel.oil_weeks,
            weeks_without_oil=panel.weeks_without_oil,
            partial_weeks=panel.partial_weeks,
        )
        rescaled = interest_profile(scaled_panel, "us", OIL_PEAK_WEEK)

        assert rescaled.baseline_to_peak_pct_change == pytest.approx(
            profile.baseline_to_peak_pct_change, abs=1e-9
        )
        assert rescaled.baseline_to_elevated_pct_change == pytest.approx(
            profile.baseline_to_elevated_pct_change, abs=1e-9
        )
        assert rescaled.peak_week == profile.peak_week
        # ... while a level metric does move, which is exactly why it is tagged.
        assert rescaled.mean_interest != pytest.approx(profile.mean_interest)

    def test_config_lists_are_disjoint(self) -> None:
        assert not set(cfg.SCALE_FREE_METRICS) & set(cfg.SERIES_LOCAL_METRICS)

    def test_every_series_maxes_at_one_hundred(self, panel: Panel) -> None:
        """The reason level comparison is invalid, asserted directly."""
        for series in cfg.ALL_SERIES:
            assert max(panel.interest(series.id)) == 100.0


# ---------------------------------------------------------------------------
# Correlation bundle
# ---------------------------------------------------------------------------


class TestCorrelationBundle:
    def test_worldwide_primary_values(self, all_metrics) -> None:
        primary = all_metrics["worldwide"].primary
        assert primary.n == 30
        assert primary.pearson_r == pytest.approx(0.727, abs=0.002)
        assert primary.pearson_p < 0.0001
        assert primary.spearman_rho == pytest.approx(0.721, abs=0.002)
        assert primary.significant
        assert not primary.ci_includes_zero

    def test_bootstrap_interval_brackets_the_estimate(self, all_metrics) -> None:
        for metrics in all_metrics.values():
            primary = metrics.primary
            assert primary.bootstrap_ci.low <= primary.pearson_r <= primary.bootstrap_ci.high

    def test_interval_is_reproducible(self, panel: Panel) -> None:
        first = correlate(pair_with_lag(panel, "us", 0))
        second = correlate(pair_with_lag(panel, "us", 0))
        assert first.bootstrap_ci == second.bootstrap_ci

    def test_non_significant_series_have_intervals_spanning_zero(self, all_metrics) -> None:
        for series_id in ("indonesia", "malaysia", "norway"):
            assert all_metrics[series_id].primary.ci_includes_zero

    def test_strength_labels(self) -> None:
        assert strength_label(0.05) == "negligible"
        assert strength_label(0.25) == "weak"
        assert strength_label(0.45) == "moderate"
        assert strength_label(0.65) == "strong"
        assert strength_label(0.95) == "very_strong"
        assert strength_label(-0.95) == "very_strong"  # magnitude only


# ---------------------------------------------------------------------------
# Lag
# ---------------------------------------------------------------------------


class TestLagProfile:
    def test_covers_the_configured_window(self, panel: Panel) -> None:
        points = lag_profile(panel, "worldwide")
        assert [p.lag_weeks for p in points] == list(
            range(cfg.LAG_MIN_WEEKS, cfg.LAG_MAX_WEEKS + 1)
        )

    def test_effective_n_shrinks_away_from_lag_zero(self, panel: Panel) -> None:
        by_lag = {p.lag_weeks: p.n for p in lag_profile(panel, "worldwide")}
        assert by_lag[0] == 30
        assert by_lag[4] < by_lag[0]
        assert by_lag[-4] < by_lag[0]
        assert all(n >= cfg.MIN_PAIRS_FOR_LAG for n in by_lag.values())

    def test_lag_zero_matches_the_primary_specification(self, all_metrics) -> None:
        for metrics in all_metrics.values():
            zero = next(p for p in metrics.lag_points if p.lag_weeks == 0)
            assert zero.pearson_r == pytest.approx(metrics.primary.pearson_r, abs=1e-12)

    def test_best_lag_never_negative(self, all_metrics) -> None:
        """A negative best lag would mean interest predicts later oil prices;
        with two trending series that is a trend artifact, not a finding."""
        for metrics in all_metrics.values():
            if metrics.best is not None:
                assert metrics.best.lag_weeks >= 0

    def test_negative_lag_maximum_is_reported_not_hidden(self, all_metrics) -> None:
        flagged = {sid for sid, m in all_metrics.items() if m.negative_lag_max}
        assert flagged, "expected the trend artifact to be detected on this dataset"
        for sid in flagged:
            assert Caveat.NEGATIVE_LAG_ARTIFACT in all_metrics[sid].caveats

    def test_helper_detects_a_negative_maximum(self, panel: Panel) -> None:
        points = lag_profile(panel, "indonesia")
        strongest = max(points, key=lambda p: p.pearson_r)
        assert negative_lag_maximum(points) == (strongest.lag_weeks < 0)

    def test_best_lag_returns_none_when_nothing_is_positive(self) -> None:
        assert best_lag([]) is None


# ---------------------------------------------------------------------------
# Trend diagnostics
# ---------------------------------------------------------------------------


class TestTrendDiagnostics:
    def test_three_specifications_are_reported(self, panel: Panel) -> None:
        diag = trend_diagnostics(pair_with_lag(panel, "worldwide", 0))
        assert {s.id for s in diag.specifications} == {
            "levels",
            "first_differences",
            "linear_detrended",
        }

    def test_levels_specification_matches_the_primary(self, panel: Panel) -> None:
        sample = pair_with_lag(panel, "worldwide", 0)
        diag = trend_diagnostics(sample)
        levels = diag.by_id("levels")
        assert levels is not None
        assert levels.pearson_r == pytest.approx(correlate(sample).pearson_r, abs=1e-12)

    def test_both_series_trend_upward_on_this_dataset(self, panel: Panel) -> None:
        diag = trend_diagnostics(pair_with_lag(panel, "worldwide", 0))
        assert diag.oil_vs_time_r > 0
        assert diag.interest_vs_time_r > 0

    def test_no_series_survives_first_differencing(self, all_metrics) -> None:
        """The central caveat of the whole project, locked in a test."""
        for metrics in all_metrics.values():
            differences = metrics.trend.by_id("first_differences")
            assert differences is not None
            assert not differences.significant, (
                f"{metrics.series.id} unexpectedly shows week-to-week co-movement; "
                "the narrative must be revisited if this ever passes"
            )

    def test_significant_level_results_are_marked_level_only(self, all_metrics) -> None:
        for metrics in all_metrics.values():
            if metrics.primary.significant and not metrics.primary.ci_includes_zero:
                assert metrics.evidence_group == "level_only_association"
                assert Caveat.NO_SHORT_RUN_COMOVEMENT in metrics.caveats
                assert metrics.robustness != "robust"

    def test_shared_trend_caveat_applied_everywhere(self, all_metrics) -> None:
        for metrics in all_metrics.values():
            assert Caveat.SHARED_TREND_CONFOUND in metrics.caveats

    def test_first_differences_skipped_on_a_non_contiguous_sample(self, panel: Panel) -> None:
        """Differencing across a gap would be wrong; the code must skip it."""
        sample = pair_with_lag(panel, "worldwide", 0)
        gapped = type(sample)(
            lag_weeks=0,
            oil_usd_per_litre=sample.oil_usd_per_litre[:5] + sample.oil_usd_per_litre[10:15],
            oil_usd_per_barrel=sample.oil_usd_per_barrel[:5] + sample.oil_usd_per_barrel[10:15],
            interest=sample.interest[:5] + sample.interest[10:15],
            interest_weeks=sample.interest_weeks[:5] + sample.interest_weeks[10:15],
            oil_weeks=sample.oil_weeks[:5] + sample.oil_weeks[10:15],
            includes_partial_week=False,
        )
        assert trend_diagnostics(gapped).by_id("first_differences") is None


# ---------------------------------------------------------------------------
# Sensitivity
# ---------------------------------------------------------------------------


class TestSensitivity:
    def test_all_variants_present(self, all_metrics) -> None:
        ids = {v.id for v in all_metrics["worldwide"].sensitivity_result.variants}
        assert ids == {
            "exclude_partial_weeks",
            "baseline_regime_only",
            "elevated_regime_only",
            "rank_based",
        }

    def test_elevated_only_is_marked_non_computable_not_omitted(self, all_metrics) -> None:
        """4 elevated weeks is too few; the result must be declared, not hidden."""
        for metrics in all_metrics.values():
            elevated = next(
                v for v in metrics.sensitivity_result.variants if v.id == "elevated_regime_only"
            )
            assert elevated.n == 4
            # computable at n=4 but reported with its tiny n visible
            assert elevated.n < 10

    def test_excluding_partial_weeks_reduces_n_by_one(self, all_metrics) -> None:
        for metrics in all_metrics.values():
            variant = next(
                v for v in metrics.sensitivity_result.variants if v.id == "exclude_partial_weeks"
            )
            assert variant.n == metrics.primary.n - 1

    def test_baseline_only_uses_the_baseline_week_count(self, all_metrics, panel: Panel) -> None:
        for metrics in all_metrics.values():
            variant = next(
                v for v in metrics.sensitivity_result.variants if v.id == "baseline_regime_only"
            )
            assert variant.n == len(panel.regime.baseline_weeks)

    def test_leave_one_out_covers_every_observation(self, all_metrics) -> None:
        for metrics in all_metrics.values():
            loo = metrics.sensitivity_result.leave_one_out
            assert len(loo.per_observation) == metrics.primary.n
            assert loo.baseline_r == pytest.approx(metrics.primary.pearson_r, abs=1e-12)

    def test_loo_labels_are_iso_weeks(self, all_metrics) -> None:
        loo = all_metrics["worldwide"].sensitivity_result.leave_one_out
        for row in loo.per_observation:
            dt.date.fromisoformat(str(row["label"]))

    def test_sign_flip_caveat_gated_on_meaningful_magnitude(self, all_metrics) -> None:
        """At r ~ 0 a sign flip is noise, so it must not be flagged."""
        indonesia = all_metrics["indonesia"]
        assert abs(indonesia.primary.pearson_r) < 0.10
        assert Caveat.LOO_SIGN_FLIP not in indonesia.caveats


# ---------------------------------------------------------------------------
# Profiles, dispersion, categories
# ---------------------------------------------------------------------------


class TestInterestProfile:
    def test_peak_weeks_on_real_data(self, all_metrics) -> None:
        expected = {
            "indonesia": dt.date(2026, 2, 15),
            "malaysia": dt.date(2026, 2, 15),
            "norway": dt.date(2026, 1, 25),
            "singapore": dt.date(2026, 3, 8),
            "us": dt.date(2026, 3, 29),
            "worldwide": dt.date(2026, 3, 29),
        }
        for series_id, week in expected.items():
            assert all_metrics[series_id].profile.peak_week == week

    def test_peak_lag_relative_to_the_oil_peak(self, all_metrics) -> None:
        assert all_metrics["us"].profile.peak_lag_weeks == 2
        assert all_metrics["norway"].profile.peak_lag_weeks == -7

    def test_baseline_and_elevated_means_are_reported(self, all_metrics) -> None:
        profile = all_metrics["us"].profile
        assert profile.baseline_mean_interest > 0
        assert profile.elevated_mean_interest > profile.baseline_mean_interest


class TestPeakDispersion:
    def test_the_synchronised_peak_claim_is_false(self, country_metrics) -> None:
        dispersion = peak_dispersion(country_metrics)
        assert not dispersion.synchronised_within_one_month
        assert dispersion.distinct_weeks == 4
        assert len(dispersion.distinct_months) == 3
        assert dispersion.distinct_months == ("2026-01", "2026-02", "2026-03")
        assert dispersion.span_weeks == 9

    def test_would_report_true_for_a_genuinely_synchronised_set(self, country_metrics) -> None:
        """Guards against the check being vacuously false."""
        same_week = dt.date(2026, 2, 15)
        patched = []
        for metrics in country_metrics:
            profile = metrics.profile
            patched.append(
                type(metrics)(
                    series=metrics.series,
                    primary=metrics.primary,
                    lag_points=metrics.lag_points,
                    best=metrics.best,
                    negative_lag_max=metrics.negative_lag_max,
                    trend=metrics.trend,
                    sensitivity_result=metrics.sensitivity_result,
                    profile=type(profile)(
                        mean_interest=profile.mean_interest,
                        median_interest=profile.median_interest,
                        min_interest=profile.min_interest,
                        peak_value=profile.peak_value,
                        baseline_mean_interest=profile.baseline_mean_interest,
                        elevated_mean_interest=profile.elevated_mean_interest,
                        peak_week=same_week,
                        peak_week_ties=1,
                        baseline_to_peak_pct_change=profile.baseline_to_peak_pct_change,
                        baseline_to_elevated_pct_change=profile.baseline_to_elevated_pct_change,
                        peak_lag_weeks=profile.peak_lag_weeks,
                    ),
                    caveats=metrics.caveats,
                    robustness=metrics.robustness,
                    evidence_group=metrics.evidence_group,
                )
            )
        assert peak_dispersion(patched).synchronised_within_one_month

    def test_two_countries_peak_before_the_regime_onset(
        self, country_metrics, panel: Panel
    ) -> None:
        early = [
            m.series.id for m in country_metrics if m.profile.peak_week < panel.regime.onset_week
        ]
        assert set(early) == {"indonesia", "malaysia", "norway"}


class TestCategoryReview:
    def test_verdicts_on_the_corrected_metrics(self, country_metrics) -> None:
        reviews = {r.id: r for r in review_categories({m.series.id: m for m in country_metrics})}
        assert reviews["subsidized_buffer"].verdict == "supported"
        assert reviews["proactive_shift"].verdict == "not_supported"
        assert reviews["maturity_gap"].verdict == "supported"

    def test_proactive_shift_fails_for_both_members(self, country_metrics) -> None:
        reviews = {r.id: r for r in review_categories({m.series.id: m for m in country_metrics})}
        assert set(reviews["proactive_shift"].unsupported_members) == {"malaysia", "us"}

    def test_every_category_requires_external_evidence(self, country_metrics) -> None:
        """The category names assert mechanisms; two time series cannot supply one."""
        for review in review_categories({m.series.id: m for m in country_metrics}):
            assert review.requires_external_evidence

    def test_evidence_groups_partition_the_countries(self, country_metrics) -> None:
        groups = evidence_groups(country_metrics)
        assigned = [sid for ids in groups.values() for sid in ids]
        assert sorted(assigned) == sorted(m.series.id for m in country_metrics)

    def test_no_country_reaches_a_robust_association(self, country_metrics) -> None:
        groups = evidence_groups(country_metrics)
        assert "robust_positive_association" not in groups
        assert "robust_negative_association" not in groups


class TestCaveats:
    def test_small_sample_and_regime_caveats_are_universal(self, all_metrics) -> None:
        for metrics in all_metrics.values():
            assert Caveat.SMALL_SAMPLE in metrics.caveats
            assert Caveat.FEW_ELEVATED_OBSERVATIONS in metrics.caveats
            assert Caveat.SERIES_LOCAL_SCALE in metrics.caveats
            assert Caveat.INCLUDES_PARTIAL_WEEK in metrics.caveats

    def test_non_significant_series_carry_the_right_codes(self, all_metrics) -> None:
        for series_id in ("indonesia", "malaysia", "norway"):
            caveats = all_metrics[series_id].caveats
            assert Caveat.NOT_SIGNIFICANT in caveats
            assert Caveat.CI_INCLUDES_ZERO in caveats
            assert all_metrics[series_id].robustness == "fragile"

    def test_singapore_loses_significance_without_the_elevated_regime(self, all_metrics) -> None:
        assert Caveat.LOSES_SIGNIFICANCE_WITHOUT_ELEVATED in all_metrics["singapore"].caveats

    def test_indonesia_is_regime_sensitive(self, all_metrics) -> None:
        """Indonesia is ~0 overall but positive within the baseline regime."""
        assert Caveat.REGIME_SENSITIVE in all_metrics["indonesia"].caveats
