"""Standard-library statistical primitives.

Implemented here rather than pulled from SciPy because the pipeline is
dependency-free by design (see pyproject.toml). Every function is validated in
tests/test_statistics.py against published reference values, and
tests/test_statistics_scipy.py cross-checks them against SciPy whenever SciPy
happens to be installed.

Definitions follow the same conventions as SciPy:
  * ``pearson``  -> scipy.stats.pearsonr
  * ``spearman`` -> scipy.stats.spearmanr (average ranks for ties, t-approximation
                    for the p-value)
"""

from __future__ import annotations

import math
import random
from collections.abc import Sequence
from dataclasses import dataclass

Number = float


# ---------------------------------------------------------------------------
# Special functions
# ---------------------------------------------------------------------------


def _betacf(a: float, b: float, x: float) -> float:
    """Continued-fraction expansion for the incomplete beta function.

    Modified Lentz's method. Follows Numerical Recipes, 3rd ed., sec. 6.4.
    """
    tiny = 1e-300
    max_iter = 500
    eps = 3e-16

    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < tiny:
        d = tiny
    d = 1.0 / d
    h = d

    for m in range(1, max_iter + 1):
        m2 = 2 * m

        # even step
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        h *= d * c

        # odd step
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta

        if abs(delta - 1.0) < eps:
            return h

    raise ArithmeticError(f"betacf failed to converge for a={a}, b={b}, x={x}")


def regularised_incomplete_beta(a: float, b: float, x: float) -> float:
    """Regularised incomplete beta function ``I_x(a, b)``."""
    if not 0.0 <= x <= 1.0:
        raise ValueError(f"x must lie in [0, 1], got {x}")
    if x == 0.0:
        return 0.0
    if x == 1.0:
        return 1.0

    log_prefactor = (
        math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log1p(-x)
    )
    prefactor = math.exp(log_prefactor)

    # Use the expansion that converges quickly, and the symmetry relation
    # I_x(a, b) = 1 - I_{1-x}(b, a) otherwise.
    if x < (a + 1.0) / (a + b + 2.0):
        return prefactor * _betacf(a, b, x) / a
    return 1.0 - prefactor * _betacf(b, a, 1.0 - x) / b


def student_t_two_sided_p(t: float, df: float) -> float:
    """Two-sided p-value for a Student-t statistic with ``df`` degrees of freedom.

    Uses the identity  P(|T| > t) = I_{df/(df + t^2)}(df/2, 1/2).
    """
    if df <= 0:
        raise ValueError(f"degrees of freedom must be positive, got {df}")
    if math.isinf(t):
        return 0.0
    return regularised_incomplete_beta(df / 2.0, 0.5, df / (df + t * t))


def normal_quantile(p: float) -> float:
    """Inverse standard-normal CDF (probit).

    Acklam's rational approximation refined by one Halley step, giving roughly
    full double precision across the open interval (0, 1).
    """
    if not 0.0 < p < 1.0:
        raise ValueError(f"p must lie in (0, 1), got {p}")

    a = (
        -3.969683028665376e01,
        2.209460984245205e02,
        -2.759285104469687e02,
        1.383577518672690e02,
        -3.066479806614716e01,
        2.506628277459239e00,
    )
    b = (
        -5.447609879822406e01,
        1.615858368580409e02,
        -1.556989798598866e02,
        6.680131188771972e01,
        -1.328068155288572e01,
    )
    c = (
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e00,
        -2.549732539343734e00,
        4.374664141464968e00,
        2.938163982698783e00,
    )
    d = (7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e00, 3.754408661907416e00)

    p_low, p_high = 0.02425, 1.0 - 0.02425
    if p < p_low:
        q = math.sqrt(-2.0 * math.log(p))
        x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / (
            (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0
        )
    elif p <= p_high:
        q = p - 0.5
        r = q * q
        x = (
            (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5])
            * q
            / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0)
        )
    else:
        q = math.sqrt(-2.0 * math.log1p(-p))
        x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / (
            (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0
        )

    # One Halley refinement against the true CDF.
    e = 0.5 * math.erfc(-x / math.sqrt(2.0)) - p
    u = e * math.sqrt(2.0 * math.pi) * math.exp(x * x / 2.0)
    return x - u / (1.0 + x * u / 2.0)


# ---------------------------------------------------------------------------
# Descriptive helpers
# ---------------------------------------------------------------------------


def mean(values: Sequence[Number]) -> float:
    if not values:
        raise ValueError("mean of an empty sequence")
    return math.fsum(values) / len(values)


def median(values: Sequence[Number]) -> float:
    if not values:
        raise ValueError("median of an empty sequence")
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2 == 1:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2.0


def sample_stdev(values: Sequence[Number]) -> float:
    n = len(values)
    if n < 2:
        raise ValueError("sample standard deviation needs at least 2 values")
    mu = mean(values)
    return math.sqrt(math.fsum((v - mu) ** 2 for v in values) / (n - 1))


def average_ranks(values: Sequence[Number]) -> list[float]:
    """Ranks with ties assigned the average of the tied positions (1-based)."""
    n = len(values)
    order = sorted(range(n), key=lambda i: values[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and values[order[j + 1]] == values[order[i]]:
            j += 1
        shared = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[order[k]] = shared
        i = j + 1
    return ranks


# ---------------------------------------------------------------------------
# Correlation
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class CorrelationResult:
    coefficient: float
    p_value: float
    n: int
    method: str

    def as_dict(self) -> dict[str, object]:
        return {
            "coefficient": self.coefficient,
            "p_value": self.p_value,
            "n": self.n,
            "method": self.method,
        }


def _validate_pair(x: Sequence[Number], y: Sequence[Number]) -> int:
    if len(x) != len(y):
        raise ValueError(f"length mismatch: {len(x)} vs {len(y)}")
    if len(x) < 3:
        raise ValueError(f"need at least 3 observations, got {len(x)}")
    return len(x)


def pearson(x: Sequence[Number], y: Sequence[Number]) -> CorrelationResult:
    """Pearson product-moment correlation with a two-sided t-test p-value."""
    n = _validate_pair(x, y)
    mx, my = mean(x), mean(y)
    dx = [xi - mx for xi in x]
    dy = [yi - my for yi in y]
    sx = math.sqrt(math.fsum(d * d for d in dx))
    sy = math.sqrt(math.fsum(d * d for d in dy))
    if sx == 0.0 or sy == 0.0:
        raise ValueError("cannot correlate a constant series")

    r = math.fsum(a * b for a, b in zip(dx, dy, strict=True)) / (sx * sy)
    r = max(-1.0, min(1.0, r))  # guard against float drift past +/-1

    if abs(r) == 1.0:
        p = 0.0
    else:
        t = r * math.sqrt((n - 2) / (1.0 - r * r))
        p = student_t_two_sided_p(abs(t), n - 2)
    return CorrelationResult(r, p, n, "pearson")


def spearman(x: Sequence[Number], y: Sequence[Number]) -> CorrelationResult:
    """Spearman rank correlation (average ranks for ties, t-approximation p)."""
    n = _validate_pair(x, y)
    result = pearson(average_ranks(x), average_ranks(y))
    return CorrelationResult(result.coefficient, result.p_value, n, "spearman")


# ---------------------------------------------------------------------------
# Confidence intervals
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Interval:
    low: float
    high: float
    level: float
    method: str

    def as_dict(self) -> dict[str, object]:
        return {"low": self.low, "high": self.high, "level": self.level, "method": self.method}


def fisher_z_interval(r: float, n: int, level: float) -> Interval:
    """Analytic CI for Pearson r via the Fisher z-transformation.

    Assumes approximate bivariate normality. Reported alongside the bootstrap
    interval because with n ~ 30 the two disagreeing is itself informative.
    """
    if n < 4:
        raise ValueError("Fisher z interval needs at least 4 observations")
    if abs(r) >= 1.0:
        return Interval(r, r, level, "fisher_z")

    z = math.atanh(r)
    se = 1.0 / math.sqrt(n - 3)
    crit = normal_quantile(0.5 + level / 2.0)
    return Interval(math.tanh(z - crit * se), math.tanh(z + crit * se), level, "fisher_z")


def bootstrap_pearson_interval(
    x: Sequence[Number],
    y: Sequence[Number],
    *,
    iterations: int,
    seed: int,
    level: float,
) -> Interval:
    """Percentile bootstrap CI for Pearson r, resampling (x, y) PAIRS.

    Deterministic: seeded ``random.Random`` and a fixed iteration count, so the
    interval is bit-for-bit reproducible across runs and machines.

    Resamples that produce a constant series (possible with small n) are
    skipped rather than silently counted, and the number actually used is
    reflected in the returned interval's method string.
    """
    n = _validate_pair(x, y)
    rng = random.Random(seed)
    coefficients: list[float] = []

    for _ in range(iterations):
        idx = [rng.randrange(n) for _ in range(n)]
        xs = [x[i] for i in idx]
        ys = [y[i] for i in idx]
        try:
            coefficients.append(pearson(xs, ys).coefficient)
        except ValueError:
            continue  # degenerate resample (constant series)

    if len(coefficients) < iterations // 2:
        raise ArithmeticError("too many degenerate bootstrap resamples to form an interval")

    coefficients.sort()
    alpha = (1.0 - level) / 2.0
    return Interval(
        low=_percentile(coefficients, alpha),
        high=_percentile(coefficients, 1.0 - alpha),
        level=level,
        method=f"percentile_bootstrap(iterations={len(coefficients)},seed={seed})",
    )


def _percentile(sorted_values: Sequence[float], q: float) -> float:
    """Linear-interpolation percentile of an already-sorted sequence."""
    if not sorted_values:
        raise ValueError("percentile of an empty sequence")
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    pos = q * (len(sorted_values) - 1)
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return float(sorted_values[int(pos)])
    frac = pos - lo
    return sorted_values[lo] * (1.0 - frac) + sorted_values[hi] * frac


# ---------------------------------------------------------------------------
# Ordinary least squares (fit line for later chart rendering)
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class LinearFit:
    slope: float
    intercept: float
    r_squared: float
    slope_stderr: float
    n: int

    def as_dict(self) -> dict[str, object]:
        return {
            "slope": self.slope,
            "intercept": self.intercept,
            "r_squared": self.r_squared,
            "slope_stderr": self.slope_stderr,
            "n": self.n,
        }


def linear_fit(x: Sequence[Number], y: Sequence[Number]) -> LinearFit:
    """Simple OLS fit of y on x.

    Emitted so the frontend can draw a regression line without ever computing
    one -- the analytical layer stays the sole source of truth.
    """
    n = _validate_pair(x, y)
    mx, my = mean(x), mean(y)
    sxx = math.fsum((xi - mx) ** 2 for xi in x)
    if sxx == 0.0:
        raise ValueError("cannot fit a line to a constant x series")
    sxy = math.fsum((xi - mx) * (yi - my) for xi, yi in zip(x, y, strict=True))

    slope = sxy / sxx
    intercept = my - slope * mx
    residuals = [yi - (intercept + slope * xi) for xi, yi in zip(x, y, strict=True)]
    ss_res = math.fsum(r * r for r in residuals)
    ss_tot = math.fsum((yi - my) ** 2 for yi in y)
    r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else float("nan")

    stderr = math.sqrt(ss_res / (n - 2) / sxx) if n > 2 else float("nan")
    return LinearFit(slope, intercept, r_squared, stderr, n)


# ---------------------------------------------------------------------------
# Sensitivity
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class LeaveOneOutObservation:
    index: int
    label: str | None
    r_without: float
    delta: float

    def as_dict(self) -> dict[str, object]:
        return {
            "index": self.index,
            "label": self.label,
            "r_without": self.r_without,
            "delta": self.delta,
        }

    def __getitem__(self, key: str) -> object:
        """Mapping-style access, kept so tests and report code can read rows
        uniformly with the rest of the JSON-shaped payloads."""
        return self.as_dict()[key]


@dataclass(frozen=True, slots=True)
class LeaveOneOutResult:
    baseline_r: float
    min_r: float
    max_r: float
    max_abs_delta: float
    most_influential_index: int
    sign_flips: bool
    per_observation: list[LeaveOneOutObservation]

    def as_dict(self) -> dict[str, object]:
        return {
            "baseline_r": self.baseline_r,
            "min_r": self.min_r,
            "max_r": self.max_r,
            "max_abs_delta": self.max_abs_delta,
            "most_influential_index": self.most_influential_index,
            "sign_flips": self.sign_flips,
            "per_observation": [row.as_dict() for row in self.per_observation],
        }


def leave_one_out_pearson(
    x: Sequence[Number],
    y: Sequence[Number],
    labels: Sequence[str] | None = None,
) -> LeaveOneOutResult:
    """Recompute Pearson r with each observation removed in turn.

    With n ~ 30 and a short high-price episode, this is the single most
    informative robustness check available: it shows directly how much of a
    headline correlation rests on a handful of weeks.
    """
    n = _validate_pair(x, y)
    baseline = pearson(x, y).coefficient

    per_observation: list[LeaveOneOutObservation] = []
    for i in range(n):
        xs = list(x[:i]) + list(x[i + 1 :])
        ys = list(y[:i]) + list(y[i + 1 :])
        r_i = pearson(xs, ys).coefficient
        per_observation.append(
            LeaveOneOutObservation(
                index=i,
                label=labels[i] if labels is not None else None,
                r_without=r_i,
                delta=r_i - baseline,
            )
        )

    deltas = [abs(row.delta) for row in per_observation]
    r_values = [row.r_without for row in per_observation]
    worst = deltas.index(max(deltas))

    return LeaveOneOutResult(
        baseline_r=baseline,
        min_r=min(r_values),
        max_r=max(r_values),
        max_abs_delta=max(deltas),
        most_influential_index=worst,
        sign_flips=any((r < 0) != (baseline < 0) for r in r_values),
        per_observation=per_observation,
    )
