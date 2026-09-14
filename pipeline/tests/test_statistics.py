"""Validation of the stdlib statistical primitives against published values.

These tests are the justification for not depending on SciPy. Every reference
number below comes from a published source or is analytically exact:

* Anscombe's quartet set I -- Anscombe (1973), "Graphs in Statistical
  Analysis", The American Statistician 27(1). r = 0.816, slope = 0.500,
  intercept = 3.000, R^2 = 0.667 are the canonical published values.
* Student-t critical values t(0.975, df) from standard statistical tables.
* Standard-normal quantiles z(0.975) = 1.959964, z(0.995) = 2.575829.
* Incomplete beta identities that can be evaluated in closed form.
"""

from __future__ import annotations

import math

import pytest

from pipeline import statistics as st

# Anscombe quartet, set I
ANSCOMBE_X = [10.0, 8.0, 13.0, 9.0, 11.0, 14.0, 6.0, 4.0, 12.0, 7.0, 5.0]
ANSCOMBE_Y = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68]


class TestIncompleteBeta:
    def test_symmetry_point_of_arcsine_distribution(self) -> None:
        # I_{1/2}(1/2, 1/2) = 1/2 exactly, by symmetry.
        assert st.regularised_incomplete_beta(0.5, 0.5, 0.5) == pytest.approx(0.5, abs=1e-12)

    def test_closed_form_integer_parameters(self) -> None:
        # I_{1/2}(2, 3) = 11/16 exactly.
        assert st.regularised_incomplete_beta(2, 3, 0.5) == pytest.approx(0.6875, abs=1e-12)

    def test_boundaries(self) -> None:
        assert st.regularised_incomplete_beta(2, 3, 0.0) == 0.0
        assert st.regularised_incomplete_beta(2, 3, 1.0) == 1.0

    def test_rejects_out_of_range(self) -> None:
        with pytest.raises(ValueError):
            st.regularised_incomplete_beta(1, 1, 1.5)


class TestStudentT:
    @pytest.mark.parametrize(
        ("t_critical", "df"),
        [
            (2.3060041, 8),
            (2.0452296, 29),
            (1.9599640, 1_000_000),
            (2.7764451, 4),
            (2.0301079, 35),
        ],
    )
    def test_critical_values_give_alpha_five_percent(self, t_critical: float, df: int) -> None:
        """t(0.975, df) must map back to a two-sided p of exactly 0.05."""
        assert st.student_t_two_sided_p(t_critical, df) == pytest.approx(0.05, abs=1e-6)

    def test_zero_statistic_is_certain(self) -> None:
        assert st.student_t_two_sided_p(0.0, 10) == pytest.approx(1.0, abs=1e-12)

    def test_monotone_decreasing_in_t(self) -> None:
        values = [st.student_t_two_sided_p(t, 20) for t in (0.5, 1.0, 2.0, 4.0)]
        assert values == sorted(values, reverse=True)

    def test_rejects_bad_df(self) -> None:
        with pytest.raises(ValueError):
            st.student_t_two_sided_p(1.0, 0)


class TestNormalQuantile:
    @pytest.mark.parametrize(
        ("p", "expected"),
        [
            (0.975, 1.959963985),
            (0.995, 2.575829304),
            (0.025, -1.959963985),
            (0.5, 0.0),
            (0.84134474606, 1.0),
        ],
    )
    def test_reference_quantiles(self, p: float, expected: float) -> None:
        assert st.normal_quantile(p) == pytest.approx(expected, abs=1e-8)

    def test_round_trips_through_the_cdf(self) -> None:
        for p in (0.001, 0.01, 0.1, 0.3, 0.7, 0.9, 0.99, 0.999):
            x = st.normal_quantile(p)
            recovered = 0.5 * math.erfc(-x / math.sqrt(2.0))
            assert recovered == pytest.approx(p, abs=1e-12)

    def test_rejects_boundaries(self) -> None:
        for bad in (0.0, 1.0, -0.5):
            with pytest.raises(ValueError):
                st.normal_quantile(bad)


class TestPearson:
    def test_anscombe_published_values(self) -> None:
        result = st.pearson(ANSCOMBE_X, ANSCOMBE_Y)
        assert result.coefficient == pytest.approx(0.81642052, abs=1e-7)
        assert result.p_value == pytest.approx(0.00216963, abs=1e-7)
        assert result.n == 11
        assert result.method == "pearson"

    def test_perfect_positive_and_negative(self) -> None:
        assert st.pearson([1, 2, 3, 4], [2, 4, 6, 8]).coefficient == pytest.approx(1.0)
        assert st.pearson([1, 2, 3, 4], [-2, -4, -6, -8]).coefficient == pytest.approx(-1.0)

    def test_invariant_under_positive_linear_rescale(self) -> None:
        """The barrel -> litre conversion must not move any coefficient."""
        base = st.pearson(ANSCOMBE_X, ANSCOMBE_Y)
        scaled = st.pearson([v / 158.987294928 for v in ANSCOMBE_X], ANSCOMBE_Y)
        assert scaled.coefficient == pytest.approx(base.coefficient, abs=1e-12)
        assert scaled.p_value == pytest.approx(base.p_value, abs=1e-12)

    def test_coefficient_never_exceeds_unit_interval(self) -> None:
        r = st.pearson([1e9, 1e9 + 1, 1e9 + 2], [1e9, 1e9 + 1, 1e9 + 2]).coefficient
        assert -1.0 <= r <= 1.0

    def test_rejects_constant_series(self) -> None:
        with pytest.raises(ValueError, match="constant"):
            st.pearson([1, 1, 1, 1], [1, 2, 3, 4])

    def test_rejects_length_mismatch_and_tiny_samples(self) -> None:
        with pytest.raises(ValueError, match="length mismatch"):
            st.pearson([1, 2, 3], [1, 2])
        with pytest.raises(ValueError, match="at least 3"):
            st.pearson([1, 2], [1, 2])


class TestSpearman:
    def test_average_ranks_handles_ties(self) -> None:
        assert st.average_ranks([7, 7, 3, 9]) == [2.5, 2.5, 1.0, 4.0]
        assert st.average_ranks([5, 5, 5]) == [2.0, 2.0, 2.0]

    def test_monotone_relationships(self) -> None:
        assert st.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]).coefficient == pytest.approx(-1.0)
        # Monotone but not linear: Spearman is 1 where Pearson is not.
        x, y = [1, 2, 3, 4], [1, 4, 9, 100]
        assert st.spearman(x, y).coefficient == pytest.approx(1.0)
        assert st.pearson(x, y).coefficient < 0.95

    def test_ties_do_not_break_perfect_monotonicity(self) -> None:
        assert st.spearman([1, 2, 2, 3], [10, 20, 20, 30]).coefficient == pytest.approx(1.0)

    def test_reports_original_sample_size(self) -> None:
        assert st.spearman(ANSCOMBE_X, ANSCOMBE_Y).n == 11


class TestIntervals:
    def test_bootstrap_is_deterministic_for_a_fixed_seed(self) -> None:
        first = st.bootstrap_pearson_interval(
            ANSCOMBE_X, ANSCOMBE_Y, iterations=500, seed=7, level=0.95
        )
        second = st.bootstrap_pearson_interval(
            ANSCOMBE_X, ANSCOMBE_Y, iterations=500, seed=7, level=0.95
        )
        assert first == second

    def test_bootstrap_seed_changes_the_interval(self) -> None:
        a = st.bootstrap_pearson_interval(
            ANSCOMBE_X, ANSCOMBE_Y, iterations=500, seed=1, level=0.95
        )
        b = st.bootstrap_pearson_interval(
            ANSCOMBE_X, ANSCOMBE_Y, iterations=500, seed=2, level=0.95
        )
        assert (a.low, a.high) != (b.low, b.high)

    def test_bootstrap_brackets_the_point_estimate(self) -> None:
        r = st.pearson(ANSCOMBE_X, ANSCOMBE_Y).coefficient
        interval = st.bootstrap_pearson_interval(
            ANSCOMBE_X, ANSCOMBE_Y, iterations=2000, seed=42, level=0.95
        )
        assert interval.low < r < interval.high
        assert interval.method.startswith("percentile_bootstrap")

    def test_wider_confidence_level_gives_a_wider_interval(self) -> None:
        narrow = st.fisher_z_interval(0.6, 30, 0.80)
        wide = st.fisher_z_interval(0.6, 30, 0.99)
        assert wide.low < narrow.low and wide.high > narrow.high

    def test_fisher_interval_brackets_r_and_stays_in_range(self) -> None:
        interval = st.fisher_z_interval(0.727, 30, 0.95)
        assert interval.low < 0.727 < interval.high
        assert interval.low >= -1.0 and interval.high <= 1.0

    def test_fisher_interval_degenerates_at_perfect_correlation(self) -> None:
        interval = st.fisher_z_interval(1.0, 30, 0.95)
        assert interval.low == interval.high == 1.0


class TestLinearFit:
    def test_anscombe_published_values(self) -> None:
        fit = st.linear_fit(ANSCOMBE_X, ANSCOMBE_Y)
        assert fit.slope == pytest.approx(0.50009, abs=1e-5)
        assert fit.intercept == pytest.approx(3.00009, abs=1e-5)
        assert fit.r_squared == pytest.approx(0.66654, abs=1e-5)
        assert fit.n == 11

    def test_r_squared_equals_r_squared(self) -> None:
        r = st.pearson(ANSCOMBE_X, ANSCOMBE_Y).coefficient
        assert st.linear_fit(ANSCOMBE_X, ANSCOMBE_Y).r_squared == pytest.approx(r * r, abs=1e-12)

    def test_exact_line_recovered(self) -> None:
        fit = st.linear_fit([0, 1, 2, 3], [1, 3, 5, 7])
        assert fit.slope == pytest.approx(2.0)
        assert fit.intercept == pytest.approx(1.0)
        assert fit.r_squared == pytest.approx(1.0)


class TestLeaveOneOut:
    def test_reports_baseline_and_bounds(self) -> None:
        loo = st.leave_one_out_pearson(ANSCOMBE_X, ANSCOMBE_Y)
        assert loo.baseline_r == pytest.approx(0.81642052, abs=1e-7)
        assert len(loo.per_observation) == 11
        assert loo.min_r <= loo.baseline_r <= loo.max_r
        assert not loo.sign_flips

    def test_detects_a_single_dominating_observation(self) -> None:
        # Nine near-uncorrelated points plus one extreme leverage point.
        x = [1, 2, 1, 2, 1, 2, 1, 2, 1, 100]
        y = [1, 2, 2, 1, 1, 2, 2, 1, 1, 100]
        loo = st.leave_one_out_pearson(x, y)
        assert loo.baseline_r == pytest.approx(0.99977, abs=1e-4)
        # Removing the single leverage point collapses r from ~1.0 to ~0.1.
        assert loo.max_abs_delta == pytest.approx(0.8998, abs=1e-3)
        assert loo.most_influential_index == 9
        assert loo.per_observation[9]["r_without"] == pytest.approx(0.1, abs=1e-9)

    def test_labels_are_passed_through(self) -> None:
        labels = [f"w{i}" for i in range(11)]
        loo = st.leave_one_out_pearson(ANSCOMBE_X, ANSCOMBE_Y, labels)
        assert [row["label"] for row in loo.per_observation] == labels

    def test_detects_sign_flip(self) -> None:
        x = [1, 2, 3, 4, 5, 20]
        y = [5, 4, 3, 2, 1, 40]
        loo = st.leave_one_out_pearson(x, y)
        assert loo.sign_flips


class TestDescriptives:
    def test_median_odd_and_even(self) -> None:
        assert st.median([3, 1, 2]) == 2.0
        assert st.median([4, 1, 3, 2]) == 2.5

    def test_sample_stdev_known_value(self) -> None:
        assert st.sample_stdev([2, 4, 4, 4, 5, 5, 7, 9]) == pytest.approx(2.13809, abs=1e-5)

    def test_empty_inputs_rejected(self) -> None:
        with pytest.raises(ValueError):
            st.mean([])
        with pytest.raises(ValueError):
            st.median([])
        with pytest.raises(ValueError):
            st.sample_stdev([1])
