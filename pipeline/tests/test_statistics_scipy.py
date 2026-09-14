"""Optional cross-validation of the stdlib statistics against SciPy.

Skipped automatically when SciPy is unavailable, which is the case in the
offline sandbox this pipeline was developed in. Install the extra to activate:

    uv pip install -e 'pipeline[validate]'

These tests exist so the decision to drop the SciPy dependency is verifiable
rather than merely asserted: in any networked environment they prove the
hand-written Pearson, Spearman, t-distribution and OLS implementations agree
with the reference library to floating-point tolerance.
"""

from __future__ import annotations

import pytest

from pipeline import statistics as st

scipy_stats = pytest.importorskip(
    "scipy.stats",
    reason="SciPy not installed; stdlib implementations validated against published values instead",
)

X = [10.0, 8.0, 13.0, 9.0, 11.0, 14.0, 6.0, 4.0, 12.0, 7.0, 5.0]
Y = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68]
TIED_X = [1.0, 2.0, 2.0, 3.0, 4.0, 4.0, 4.0, 5.0]
TIED_Y = [2.0, 1.0, 3.0, 3.0, 5.0, 4.0, 6.0, 5.0]


def test_pearson_matches_scipy() -> None:
    ours = st.pearson(X, Y)
    theirs = scipy_stats.pearsonr(X, Y)
    assert ours.coefficient == pytest.approx(theirs.statistic, abs=1e-12)
    assert ours.p_value == pytest.approx(theirs.pvalue, abs=1e-12)


def test_spearman_matches_scipy_with_ties() -> None:
    ours = st.spearman(TIED_X, TIED_Y)
    theirs = scipy_stats.spearmanr(TIED_X, TIED_Y)
    assert ours.coefficient == pytest.approx(theirs.statistic, abs=1e-12)
    assert ours.p_value == pytest.approx(theirs.pvalue, abs=1e-10)


def test_average_ranks_match_scipy_rankdata() -> None:
    assert st.average_ranks(TIED_X) == pytest.approx(
        list(scipy_stats.rankdata(TIED_X, method="average"))
    )


@pytest.mark.parametrize("df", [3, 8, 29, 100])
@pytest.mark.parametrize("t", [0.25, 1.0, 2.5, 5.0])
def test_t_distribution_tail_matches_scipy(t: float, df: int) -> None:
    expected = 2.0 * scipy_stats.t.sf(t, df)
    assert st.student_t_two_sided_p(t, df) == pytest.approx(expected, abs=1e-12)


@pytest.mark.parametrize("p", [0.005, 0.025, 0.1, 0.5, 0.9, 0.975, 0.995])
def test_normal_quantile_matches_scipy(p: float) -> None:
    assert st.normal_quantile(p) == pytest.approx(scipy_stats.norm.ppf(p), abs=1e-9)


def test_incomplete_beta_matches_scipy() -> None:
    special = pytest.importorskip("scipy.special")
    for a, b, x in ((0.5, 0.5, 0.3), (2.0, 3.0, 0.5), (14.5, 0.5, 0.8)):
        assert st.regularised_incomplete_beta(a, b, x) == pytest.approx(
            special.betainc(a, b, x), abs=1e-12
        )


def test_linear_fit_matches_scipy_linregress() -> None:
    ours = st.linear_fit(X, Y)
    theirs = scipy_stats.linregress(X, Y)
    assert ours.slope == pytest.approx(theirs.slope, abs=1e-12)
    assert ours.intercept == pytest.approx(theirs.intercept, abs=1e-12)
    assert ours.r_squared == pytest.approx(theirs.rvalue**2, abs=1e-12)
    assert ours.slope_stderr == pytest.approx(theirs.stderr, abs=1e-12)
