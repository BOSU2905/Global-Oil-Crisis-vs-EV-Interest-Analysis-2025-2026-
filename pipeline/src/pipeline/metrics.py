"""Domain metrics: correlations, intervals, lag profiles, sensitivity, grouping.

Every number the frontend will ever display is produced here. Two rules govern
this module:

* **Scale discipline.** Google Trends exports are independently rescaled to
  their own maximum, so any metric that compares *levels* between series is
  invalid. Cross-series metrics are restricted to correlation, timing and
  within-series relative change. Series-local metrics are still emitted (they
  are meaningful *within* a series) but are tagged so the presentation layer
  cannot mistake them for comparable quantities.

* **No promotion.** Significance labels and strength labels are descriptive
  only. Nothing here selects, filters or reorders findings to make them look
  stronger.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from dataclasses import dataclass, field

from . import statistics as st
from .config import (
    BOOTSTRAP_ITERATIONS,
    BOOTSTRAP_SEED,
    CONFIDENCE_LEVEL,
    LAG_MAX_WEEKS,
    LAG_MIN_WEEKS,
    MIN_PAIRS_FOR_LAG,
    PRIMARY_LAG_WEEKS,
    SIGNIFICANCE_ALPHA,
    Series,
)
from .transform import PairedSample, Panel, pair_with_lag

# ---------------------------------------------------------------------------
# Descriptive label vocabularies (conventions, not tests)
# ---------------------------------------------------------------------------

#: Conventional |r| bands used purely for labelling. These are a communication
#: aid, not a statistical decision rule.
STRENGTH_BANDS: tuple[tuple[float, str], ...] = (
    (0.20, "negligible"),
    (0.40, "weak"),
    (0.60, "moderate"),
    (0.80, "strong"),
    (1.01, "very_strong"),
)


def strength_label(r: float) -> str:
    magnitude = abs(r)
    for upper, label in STRENGTH_BANDS:
        if magnitude < upper:
            return label
    return "very_strong"


class Caveat:
    """Machine-readable caveat codes.

    Codes, not sentences: the analytical layer states *what* is limiting, the
    content layer decides how to word it. This keeps facts separate from prose.
    """

    SMALL_SAMPLE = "small_sample"
    FEW_ELEVATED_OBSERVATIONS = "few_elevated_observations"
    INCLUDES_PARTIAL_WEEK = "includes_partial_week"
    CI_INCLUDES_ZERO = "ci_includes_zero"
    LOO_SIGN_FLIP = "loo_sign_flip"
    LEVERAGE_DEPENDENT = "leverage_dependent"
    NOT_SIGNIFICANT = "not_significant"
    SERIES_LOCAL_SCALE = "series_local_scale"
    LOSES_SIGNIFICANCE_WITHOUT_ELEVATED = "loses_significance_without_elevated_regime"
    NO_SHORT_RUN_COMOVEMENT = "no_short_run_comovement"
    """The level correlation does not survive first-differencing: week-to-week
    changes in the two series show no detectable relationship."""
    SHARED_TREND_CONFOUND = "shared_trend_confound_possible"
    """Both series trend in the same direction across the window, so a level
    correlation cannot be separated from coincident trends."""
    SPECIFICATION_SENSITIVE = "specification_sensitive"
    """Levels, first differences and detrended residuals do not agree on the
    sign or the significance of the association."""
    REGIME_SENSITIVE = "regime_sensitive"
    """The association differs materially between the baseline and elevated
    price regimes."""
    NEGATIVE_LAG_ARTIFACT = "negative_lag_maximum"
    """The lag scan peaks where interest would lead oil, which with two trending
    series indicates a trend artifact rather than a lead-lag relationship."""


#: Below this many observations we always attach SMALL_SAMPLE.
SMALL_SAMPLE_THRESHOLD = 40
#: Leave-one-out delta above which a result is called leverage-dependent.
LEVERAGE_DELTA_THRESHOLD = 0.15
ROBUST_DELTA_THRESHOLD = 0.10


# ---------------------------------------------------------------------------
# Correlation bundle
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class CorrelationBundle:
    lag_weeks: int
    n: int
    pearson_r: float
    pearson_p: float
    spearman_rho: float
    spearman_p: float
    bootstrap_ci: st.Interval
    fisher_ci: st.Interval
    fit: st.LinearFit
    includes_partial_week: bool

    @property
    def significant(self) -> bool:
        return self.pearson_p < SIGNIFICANCE_ALPHA

    @property
    def ci_includes_zero(self) -> bool:
        return self.bootstrap_ci.low <= 0.0 <= self.bootstrap_ci.high

    def as_dict(self) -> dict[str, object]:
        return {
            "lag_weeks": self.lag_weeks,
            "n": self.n,
            "pearson_r": self.pearson_r,
            "pearson_p": self.pearson_p,
            "spearman_rho": self.spearman_rho,
            "spearman_p": self.spearman_p,
            "bootstrap_ci": self.bootstrap_ci.as_dict(),
            "fisher_ci": self.fisher_ci.as_dict(),
            "fit": self.fit.as_dict(),
            "significant_at_alpha": self.significant,
            "alpha": SIGNIFICANCE_ALPHA,
            "ci_includes_zero": self.ci_includes_zero,
            "strength_label": strength_label(self.pearson_r),
            "direction": "positive" if self.pearson_r >= 0 else "negative",
            "includes_partial_week": self.includes_partial_week,
        }


def correlate(sample: PairedSample) -> CorrelationBundle:
    """Full correlation bundle for one paired sample.

    Oil is expressed in $/litre here. Because the barrel->litre conversion is a
    positive linear rescale, Pearson r, Spearman rho and both p-values are
    identical whichever unit is used; only the OLS slope changes. Asserted in
    tests/test_metrics.py.
    """
    x, y = sample.oil_usd_per_litre, sample.interest
    pearson = st.pearson(x, y)
    spearman = st.spearman(x, y)
    return CorrelationBundle(
        lag_weeks=sample.lag_weeks,
        n=len(sample),
        pearson_r=pearson.coefficient,
        pearson_p=pearson.p_value,
        spearman_rho=spearman.coefficient,
        spearman_p=spearman.p_value,
        bootstrap_ci=st.bootstrap_pearson_interval(
            x,
            y,
            iterations=BOOTSTRAP_ITERATIONS,
            seed=BOOTSTRAP_SEED,
            level=CONFIDENCE_LEVEL,
        ),
        fisher_ci=st.fisher_z_interval(pearson.coefficient, len(sample), CONFIDENCE_LEVEL),
        fit=st.linear_fit(x, y),
        includes_partial_week=sample.includes_partial_week,
    )


# ---------------------------------------------------------------------------
# Lag profile
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class LagPoint:
    lag_weeks: int
    n: int
    pearson_r: float
    pearson_p: float
    spearman_rho: float

    def as_dict(self) -> dict[str, object]:
        return {
            "lag_weeks": self.lag_weeks,
            "n": self.n,
            "pearson_r": self.pearson_r,
            "pearson_p": self.pearson_p,
            "spearman_rho": self.spearman_rho,
        }


def lag_profile(panel: Panel, series_id: str) -> list[LagPoint]:
    """Correlation as a function of lag, over the configured window.

    EXPLORATORY. Scanning a lag window is a multiple-comparison procedure: the
    best lag is selected post hoc and its p-value is not corrected. It answers
    "does the association look contemporaneous or delayed?" and nothing more.
    It is never evidence of causation.
    """
    points: list[LagPoint] = []
    for lag in range(LAG_MIN_WEEKS, LAG_MAX_WEEKS + 1):
        sample = pair_with_lag(panel, series_id, lag)
        if len(sample) < MIN_PAIRS_FOR_LAG:
            continue
        pearson = st.pearson(sample.oil_usd_per_litre, sample.interest)
        spearman = st.spearman(sample.oil_usd_per_litre, sample.interest)
        points.append(
            LagPoint(
                lag_weeks=lag,
                n=len(sample),
                pearson_r=pearson.coefficient,
                pearson_p=pearson.p_value,
                spearman_rho=spearman.coefficient,
            )
        )
    return points


def best_lag(points: Sequence[LagPoint]) -> LagPoint | None:
    """Largest positive Pearson r among NON-NEGATIVE lags.

    Restricted to k >= 0 deliberately. The research question is whether oil
    pressure precedes or coincides with EV interest; a maximum at negative lag
    would mean interest predicts later oil prices, which is not a coherent
    answer to that question. With two series that both trend upward, negative
    lags routinely produce the largest coefficients purely as a trend artifact,
    so reporting the unrestricted maximum would be actively misleading.

    Whether the unrestricted maximum falls at a negative lag is reported
    separately by :func:`negative_lag_maximum`.
    """
    candidates = [p for p in points if p.pearson_r > 0 and p.lag_weeks >= 0]
    return max(candidates, key=lambda p: p.pearson_r) if candidates else None


def negative_lag_maximum(points: Sequence[LagPoint]) -> bool:
    """True when the unrestricted lag maximum sits at a negative lag."""
    if not points:
        return False
    strongest = max(points, key=lambda p: p.pearson_r)
    return strongest.lag_weeks < 0


# ---------------------------------------------------------------------------
# Specification checks: is a level correlation more than a shared trend?
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Specification:
    id: str
    description: str
    n: int
    pearson_r: float
    pearson_p: float

    @property
    def significant(self) -> bool:
        return self.pearson_p < SIGNIFICANCE_ALPHA

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "description": self.description,
            "n": self.n,
            "pearson_r": self.pearson_r,
            "pearson_p": self.pearson_p,
            "significant_at_alpha": self.significant,
        }


@dataclass(frozen=True, slots=True)
class TrendDiagnostics:
    oil_vs_time_r: float
    interest_vs_time_r: float
    specifications: list[Specification]
    agreement: str
    """'consistent' | 'significance_disagreement' | 'sign_disagreement'"""

    def by_id(self, spec_id: str) -> Specification | None:
        return next((s for s in self.specifications if s.id == spec_id), None)

    def as_dict(self) -> dict[str, object]:
        return {
            "oil_vs_time_r": self.oil_vs_time_r,
            "interest_vs_time_r": self.interest_vs_time_r,
            "both_series_trend_same_direction": (
                (self.oil_vs_time_r > 0) == (self.interest_vs_time_r > 0)
            ),
            "specifications": [s.as_dict() for s in self.specifications],
            "agreement": self.agreement,
            "note": (
                "Two series that both trend upward across a window will correlate in "
                "levels whether or not they are related. First differences test "
                "week-to-week co-movement; detrended residuals remove a linear trend "
                "only, which models a flat-then-step price path poorly. Neither check is "
                "decisive on its own, so all three specifications are reported and their "
                "disagreement is treated as a finding rather than resolved by choosing "
                "a favourite."
            ),
        }


def _difference(values: Sequence[float]) -> list[float]:
    return [values[i] - values[i - 1] for i in range(1, len(values))]


def _detrend(values: Sequence[float]) -> list[float]:
    time_index = list(range(len(values)))
    fit = st.linear_fit(time_index, values)
    return [v - (fit.intercept + fit.slope * t) for t, v in zip(time_index, values, strict=True)]


def trend_diagnostics(sample: PairedSample) -> TrendDiagnostics:
    """Run the level / first-difference / detrended specifications.

    First differencing requires adjacent weeks; the primary sample is a
    contiguous weekly grid, which is asserted here rather than assumed.
    """
    x, y = sample.oil_usd_per_litre, sample.interest
    weeks = sample.interest_weeks
    contiguous = all((weeks[i] - weeks[i - 1]).days == 7 for i in range(1, len(weeks)))

    time_index = list(range(len(x)))
    specs = [
        Specification(
            id="levels",
            description="Weekly levels, as published. The primary specification.",
            n=len(x),
            pearson_r=st.pearson(x, y).coefficient,
            pearson_p=st.pearson(x, y).p_value,
        )
    ]

    if contiguous and len(x) > 4:
        dx, dy = _difference(x), _difference(y)
        diff_result = st.pearson(dx, dy)
        specs.append(
            Specification(
                id="first_differences",
                description=(
                    "Week-over-week changes. Removes any shared trend, but is noisy "
                    "and has low power when the true relationship operates on levels."
                ),
                n=len(dx),
                pearson_r=diff_result.coefficient,
                pearson_p=diff_result.p_value,
            )
        )

    rx, ry = _detrend(x), _detrend(y)
    detrended = st.pearson(rx, ry)
    specs.append(
        Specification(
            id="linear_detrended",
            description=(
                "Residuals after removing a linear time trend from each series. Only a "
                "straight line is removed, so a flat-then-step price path is not fully "
                "detrended by this specification."
            ),
            n=len(rx),
            pearson_r=detrended.coefficient,
            pearson_p=detrended.p_value,
        )
    )

    significances = {s.significant for s in specs}
    signs = {s.pearson_r >= 0 for s in specs if s.significant}
    if len(signs) > 1:
        agreement = "sign_disagreement"
    elif len(significances) > 1:
        agreement = "significance_disagreement"
    else:
        agreement = "consistent"

    return TrendDiagnostics(
        oil_vs_time_r=st.pearson(time_index, x).coefficient,
        interest_vs_time_r=st.pearson(time_index, y).coefficient,
        specifications=specs,
        agreement=agreement,
    )


# ---------------------------------------------------------------------------
# Sensitivity
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class SensitivityVariant:
    id: str
    description: str
    n: int
    pearson_r: float
    pearson_p: float
    delta_vs_primary: float
    computable: bool = True
    reason: str | None = None

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "description": self.description,
            "n": self.n,
            "pearson_r": self.pearson_r,
            "pearson_p": self.pearson_p,
            "delta_vs_primary": self.delta_vs_primary,
            "computable": self.computable,
            "reason": self.reason,
        }


@dataclass(frozen=True, slots=True)
class Sensitivity:
    leave_one_out: st.LeaveOneOutResult
    variants: list[SensitivityVariant]

    def as_dict(self) -> dict[str, object]:
        return {
            "leave_one_out": self.leave_one_out.as_dict(),
            "variants": [v.as_dict() for v in self.variants],
        }


def _variant(
    variant_id: str,
    description: str,
    x: Sequence[float],
    y: Sequence[float],
    primary_r: float,
) -> SensitivityVariant:
    if len(x) < 3:
        return SensitivityVariant(
            id=variant_id,
            description=description,
            n=len(x),
            pearson_r=float("nan"),
            pearson_p=float("nan"),
            delta_vs_primary=float("nan"),
            computable=False,
            reason=f"only {len(x)} observations remain; a correlation needs at least 3",
        )
    result = st.pearson(x, y)
    return SensitivityVariant(
        id=variant_id,
        description=description,
        n=len(x),
        pearson_r=result.coefficient,
        pearson_p=result.p_value,
        delta_vs_primary=result.coefficient - primary_r,
    )


def sensitivity(panel: Panel, series_id: str, primary: CorrelationBundle) -> Sensitivity:
    """Robustness checks appropriate to a ~30-observation dataset."""
    sample = pair_with_lag(panel, series_id, PRIMARY_LAG_WEEKS)
    loo = st.leave_one_out_pearson(sample.oil_usd_per_litre, sample.interest, sample.labels)

    variants: list[SensitivityVariant] = []

    # 1. Exclude the incomplete final oil week.
    no_partial = pair_with_lag(panel, series_id, PRIMARY_LAG_WEEKS, include_partial_weeks=False)
    variants.append(
        _variant(
            "exclude_partial_weeks",
            "Weeks whose oil mean came from fewer than 5 trading days are removed.",
            no_partial.oil_usd_per_litre,
            no_partial.interest,
            primary.pearson_r,
        )
    )

    # 2. Baseline regime only -- does the association survive without the
    #    high-price episode that dominates the range of the oil variable?
    onset = panel.regime.onset_week
    baseline_idx = [i for i, w in enumerate(sample.oil_weeks) if w < onset]
    variants.append(
        _variant(
            "baseline_regime_only",
            f"Only weeks before the price-regime onset ({onset.isoformat()}) are used.",
            [sample.oil_usd_per_litre[i] for i in baseline_idx],
            [sample.interest[i] for i in baseline_idx],
            primary.pearson_r,
        )
    )

    # 3. Elevated regime only -- usually too few weeks to compute; reported as
    #    non-computable rather than silently omitted.
    elevated_idx = [i for i, w in enumerate(sample.oil_weeks) if w >= onset]
    variants.append(
        _variant(
            "elevated_regime_only",
            f"Only weeks from the price-regime onset ({onset.isoformat()}) onward are used.",
            [sample.oil_usd_per_litre[i] for i in elevated_idx],
            [sample.interest[i] for i in elevated_idx],
            primary.pearson_r,
        )
    )

    # 4. Spearman on the full sample: resistance to the leverage of a few
    #    extreme price weeks.
    variants.append(
        SensitivityVariant(
            id="rank_based",
            description="Spearman rank correlation, which limits the leverage of extreme values.",
            n=primary.n,
            pearson_r=primary.spearman_rho,
            pearson_p=primary.spearman_p,
            delta_vs_primary=primary.spearman_rho - primary.pearson_r,
        )
    )

    return Sensitivity(leave_one_out=loo, variants=variants)


# ---------------------------------------------------------------------------
# Series-local descriptives and scale-free change metrics
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class InterestProfile:
    # --- series-local: NEVER comparable across series -------------------
    mean_interest: float
    median_interest: float
    min_interest: float
    peak_value: float
    baseline_mean_interest: float
    elevated_mean_interest: float
    # --- scale-free: safe to compare across series ---------------------
    peak_week: dt.date
    peak_week_ties: int
    baseline_to_peak_pct_change: float
    baseline_to_elevated_pct_change: float
    peak_lag_weeks: int
    """Weeks between the oil peak week and this series' interest peak week.
    Positive means interest peaked after oil."""

    def as_dict(self) -> dict[str, object]:
        return {
            "series_local": {
                "mean_interest": self.mean_interest,
                "median_interest": self.median_interest,
                "min_interest": self.min_interest,
                "peak_value": self.peak_value,
                "baseline_mean_interest": self.baseline_mean_interest,
                "elevated_mean_interest": self.elevated_mean_interest,
                "_comparable_across_series": False,
            },
            "scale_free": {
                "peak_week": self.peak_week.isoformat(),
                "peak_week_ties": self.peak_week_ties,
                "baseline_to_peak_pct_change": self.baseline_to_peak_pct_change,
                "baseline_to_elevated_pct_change": self.baseline_to_elevated_pct_change,
                "peak_lag_weeks": self.peak_lag_weeks,
                "_comparable_across_series": True,
            },
        }


def interest_profile(panel: Panel, series_id: str, oil_peak_week: dt.date) -> InterestProfile:
    """Descriptives for one interest series.

    ``baseline_to_*_pct_change`` are ratios of two quantities from the *same*
    series, so the per-series normalisation constant cancels and they are
    genuinely comparable across countries.
    """
    values = panel.interest(series_id)
    weeks = panel.week_starts
    onset = panel.regime.onset_week

    peak_value = max(values)
    peak_indices = [i for i, v in enumerate(values) if v == peak_value]
    peak_week = weeks[peak_indices[0]]

    baseline = [v for w, v in zip(weeks, values, strict=True) if w < onset]
    elevated = [v for w, v in zip(weeks, values, strict=True) if w >= onset]
    baseline_mean = st.mean(baseline) if baseline else float("nan")
    elevated_mean = st.mean(elevated) if elevated else float("nan")

    def pct_change(new: float) -> float:
        if not baseline or baseline_mean == 0:
            return float("nan")
        return (new - baseline_mean) / baseline_mean * 100.0

    return InterestProfile(
        mean_interest=st.mean(values),
        median_interest=st.median(values),
        min_interest=min(values),
        peak_value=peak_value,
        baseline_mean_interest=baseline_mean,
        elevated_mean_interest=elevated_mean,
        peak_week=peak_week,
        peak_week_ties=len(peak_indices),
        baseline_to_peak_pct_change=pct_change(peak_value),
        baseline_to_elevated_pct_change=pct_change(elevated_mean),
        peak_lag_weeks=(peak_week - oil_peak_week).days // 7,
    )


# ---------------------------------------------------------------------------
# Per-series assembly
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class SeriesMetrics:
    series: Series
    primary: CorrelationBundle
    lag_points: list[LagPoint]
    best: LagPoint | None
    negative_lag_max: bool
    trend: TrendDiagnostics
    sensitivity_result: Sensitivity
    profile: InterestProfile
    caveats: list[str] = field(default_factory=list)
    robustness: str = "unknown"
    evidence_group: str = "unclassified"

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.series.id,
            "label": self.series.label,
            "short": self.series.short,
            "is_country": self.series.is_country,
            "primary": self.primary.as_dict(),
            "lag_profile": [p.as_dict() for p in self.lag_points],
            "best_lag": self.best.as_dict() if self.best else None,
            "unrestricted_lag_maximum_is_negative": self.negative_lag_max,
            "trend_diagnostics": self.trend.as_dict(),
            "sensitivity": self.sensitivity_result.as_dict(),
            "profile": self.profile.as_dict(),
            "classification": {
                "strength": strength_label(self.primary.pearson_r),
                "direction": "positive" if self.primary.pearson_r >= 0 else "negative",
                "significance": "significant" if self.primary.significant else "not_significant",
                "robustness": self.robustness,
                "evidence_group": self.evidence_group,
                "caveats": self.caveats,
            },
        }


def _classify(
    primary: CorrelationBundle,
    sens: Sensitivity,
    trend: TrendDiagnostics,
    panel: Panel,
    negative_lag_max: bool,
) -> tuple[str, str, list[str]]:
    """Derive robustness, evidence group and caveat codes from the numbers.

    Nothing here is tuned to produce a flattering answer: the thresholds are
    fixed in module constants and applied identically to every series.
    """
    caveats: list[str] = [Caveat.SERIES_LOCAL_SCALE]

    if primary.n < SMALL_SAMPLE_THRESHOLD:
        caveats.append(Caveat.SMALL_SAMPLE)
    if len(panel.regime.elevated_weeks) < 8:
        caveats.append(Caveat.FEW_ELEVATED_OBSERVATIONS)
    if primary.includes_partial_week:
        caveats.append(Caveat.INCLUDES_PARTIAL_WEEK)
    if primary.ci_includes_zero:
        caveats.append(Caveat.CI_INCLUDES_ZERO)
    if not primary.significant:
        caveats.append(Caveat.NOT_SIGNIFICANT)

    loo = sens.leave_one_out
    # A sign flip is only informative when there is a sign to flip; at r ~ 0 it
    # is noise, and the CI_INCLUDES_ZERO caveat already covers that case.
    if loo.sign_flips and abs(loo.baseline_r) >= 0.10:
        caveats.append(Caveat.LOO_SIGN_FLIP)
    if loo.max_abs_delta > LEVERAGE_DELTA_THRESHOLD:
        caveats.append(Caveat.LEVERAGE_DEPENDENT)

    baseline_variant = next(
        (v for v in sens.variants if v.id == "baseline_regime_only" and v.computable), None
    )
    if (
        primary.significant
        and baseline_variant is not None
        and baseline_variant.pearson_p >= SIGNIFICANCE_ALPHA
    ):
        caveats.append(Caveat.LOSES_SIGNIFICANCE_WITHOUT_ELEVATED)
    if baseline_variant is not None and abs(baseline_variant.pearson_r - primary.pearson_r) > 0.30:
        caveats.append(Caveat.REGIME_SENSITIVE)

    # --- trend confound -------------------------------------------------
    differences = trend.by_id("first_differences")
    levels = trend.by_id("levels")
    if trend.oil_vs_time_r > 0 and trend.interest_vs_time_r > 0:
        caveats.append(Caveat.SHARED_TREND_CONFOUND)
    if (
        levels is not None
        and levels.significant
        and differences is not None
        and not differences.significant
    ):
        caveats.append(Caveat.NO_SHORT_RUN_COMOVEMENT)
    if trend.agreement != "consistent":
        caveats.append(Caveat.SPECIFICATION_SENSITIVE)
    if negative_lag_max:
        caveats.append(Caveat.NEGATIVE_LAG_ARTIFACT)

    # --- robustness -----------------------------------------------------
    survives_differencing = differences is not None and differences.significant
    if loo.sign_flips or primary.ci_includes_zero:
        robustness = "fragile"
    elif not survives_differencing:
        # A level-only association cannot be called robust, however large r is.
        robustness = "moderate" if primary.significant else "fragile"
    elif loo.max_abs_delta <= ROBUST_DELTA_THRESHOLD and primary.significant:
        robustness = "robust"
    else:
        robustness = "moderate"

    # --- evidence group: statistical pattern only, no mechanism implied --
    if primary.ci_includes_zero and abs(primary.pearson_r) < 0.20:
        group = "no_detectable_association"
    elif primary.ci_includes_zero or not primary.significant:
        group = "inconclusive"
    elif survives_differencing:
        direction = "positive" if primary.pearson_r > 0 else "negative"
        group = f"robust_{direction}_association"
    else:
        # Significant in levels, absent in week-to-week changes: the two series
        # moved together over the window without a detectable short-run link.
        group = "level_only_association"

    return robustness, group, caveats


def compute_series_metrics(panel: Panel, series: Series, oil_peak_week: dt.date) -> SeriesMetrics:
    sample = pair_with_lag(panel, series.id, PRIMARY_LAG_WEEKS)
    primary = correlate(sample)
    points = lag_profile(panel, series.id)
    negative_max = negative_lag_maximum(points)
    trend = trend_diagnostics(sample)
    sens = sensitivity(panel, series.id, primary)
    robustness, group, caveats = _classify(primary, sens, trend, panel, negative_max)

    return SeriesMetrics(
        series=series,
        primary=primary,
        lag_points=points,
        best=best_lag(points),
        negative_lag_max=negative_max,
        trend=trend,
        sensitivity_result=sens,
        profile=interest_profile(panel, series.id, oil_peak_week),
        caveats=caveats,
        robustness=robustness,
        evidence_group=group,
    )


# ---------------------------------------------------------------------------
# Peak dispersion  (Phase 2M)
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PeakDispersion:
    peaks: dict[str, dt.date]
    distinct_weeks: int
    distinct_months: tuple[str, ...]
    span_weeks: int
    synchronised_within_one_month: bool

    def as_dict(self) -> dict[str, object]:
        return {
            "peaks": {sid: day.isoformat() for sid, day in self.peaks.items()},
            "distinct_weeks": self.distinct_weeks,
            "distinct_months": list(self.distinct_months),
            "span_weeks": self.span_weeks,
            "synchronised_within_one_month": self.synchronised_within_one_month,
        }


def peak_dispersion(country_metrics: Sequence[SeriesMetrics]) -> PeakDispersion:
    """Test the original 'synchronised peak in a single month' claim.

    The claim is evaluated, not assumed: ``synchronised_within_one_month`` is
    True only if every country's peak week falls in the same calendar month.
    """
    peaks = {m.series.id: m.profile.peak_week for m in country_metrics}
    weeks = sorted(peaks.values())
    months = sorted({f"{d.year:04d}-{d.month:02d}" for d in weeks})
    return PeakDispersion(
        peaks=peaks,
        distinct_weeks=len(set(weeks)),
        distinct_months=tuple(months),
        span_weeks=(weeks[-1] - weeks[0]).days // 7 if weeks else 0,
        synchronised_within_one_month=len(months) == 1,
    )


# ---------------------------------------------------------------------------
# Review of the original executive-summary categories  (Phase 2K)
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class CategoryReview:
    id: str
    original_title: str
    original_members: tuple[str, ...]
    data_supported_members: tuple[str, ...]
    unsupported_members: tuple[str, ...]
    verdict: str
    """'supported' | 'partially_supported' | 'not_supported'"""
    requires_external_evidence: bool
    basis: str
    """Which statistical pattern, if any, the grouping corresponds to."""

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "original_title": self.original_title,
            "original_members": list(self.original_members),
            "data_supported_members": list(self.data_supported_members),
            "unsupported_members": list(self.unsupported_members),
            "verdict": self.verdict,
            "requires_external_evidence": self.requires_external_evidence,
            "basis": self.basis,
        }


#: The original assignments, reproduced so the review is auditable. Each member
#: carries the set of measured patterns that would be consistent with what the
#: category asserts about it. Expectations were written from the original prose
#: before the corrected metrics were computed.
ORIGINAL_CATEGORIES: tuple[tuple[str, str, dict[str, frozenset[str]], str], ...] = (
    (
        "subsidized_buffer",
        "The Subsidized Buffer",
        {"indonesia": frozenset({"no_detectable_association"})},
        "Asserts that Indonesian interest is insulated from oil-price movement, which "
        "predicts no detectable association.",
    ),
    (
        "proactive_shift",
        "The Proactive Shift",
        {
            "malaysia": frozenset({"robust_positive_association"}),
            "us": frozenset({"robust_positive_association"}),
        },
        "Asserts that both markets pivot quickly and strongly with oil-price pressure, "
        "which predicts a positive association that survives differencing.",
    ),
    (
        "maturity_gap",
        "The Maturity Gap",
        {
            "norway": frozenset({"no_detectable_association"}),
            "singapore": frozenset({"robust_positive_association", "level_only_association"}),
        },
        "Asserts Norwegian saturation (no association) alongside Singaporean "
        "responsiveness constrained by adoption barriers (a positive association).",
    ),
)

GROUP_BASIS: dict[str, str] = {
    "no_detectable_association": (
        "Bootstrap interval for r includes zero and |r| < 0.20: no association detectable "
        "at this sample size."
    ),
    "inconclusive": (
        "Bootstrap interval for r includes zero, so the direction of any association is "
        "undetermined."
    ),
    "level_only_association": (
        "Significant positive correlation in weekly levels that does not survive first "
        "differencing: the series moved together across the window without a detectable "
        "week-to-week relationship."
    ),
    "robust_positive_association": (
        "Significant positive correlation in levels that also survives first differencing."
    ),
    "robust_negative_association": (
        "Significant negative correlation in levels that also survives first differencing."
    ),
}


def review_categories(metrics_by_id: dict[str, SeriesMetrics]) -> list[CategoryReview]:
    """Re-evaluate each original category against the corrected metrics.

    A member counts as data-supported only when its measured statistical pattern
    is one the category's own wording predicts. Mechanism claims -- subsidies,
    proactive policy, market maturity -- are not derivable from a crude price
    series and a search index, so every category is flagged as requiring
    external evidence regardless of how its statistical half performs.
    """
    reviews: list[CategoryReview] = []

    for cat_id, title, expectations, assertion in ORIGINAL_CATEGORIES:
        supported: list[str] = []
        unsupported: list[str] = []

        for member, accepted in expectations.items():
            group = metrics_by_id[member].evidence_group
            (supported if group in accepted else unsupported).append(member)

        if not unsupported:
            verdict = "supported"
        elif supported:
            verdict = "partially_supported"
        else:
            verdict = "not_supported"

        observed = ", ".join(
            f"{member} measured as '{metrics_by_id[member].evidence_group}'"
            for member in expectations
        )

        reviews.append(
            CategoryReview(
                id=cat_id,
                original_title=title,
                original_members=tuple(expectations),
                data_supported_members=tuple(supported),
                unsupported_members=tuple(unsupported),
                verdict=verdict,
                requires_external_evidence=True,
                basis=f"{assertion} Observed: {observed}.",
            )
        )

    return reviews


def evidence_groups(country_metrics: Sequence[SeriesMetrics]) -> dict[str, list[str]]:
    """Group countries by measured statistical pattern only.

    This is the data-derived alternative to the original mechanism-named
    categories. It carries no explanation, because these two series cannot
    supply one.
    """
    groups: dict[str, list[str]] = {}
    for m in country_metrics:
        groups.setdefault(m.evidence_group, []).append(m.series.id)
    return groups
