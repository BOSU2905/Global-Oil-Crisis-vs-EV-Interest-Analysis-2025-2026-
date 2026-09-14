/**
 * Boundary validation for the generated analytical artifacts.
 *
 * WHY HAND-ROLLED
 * The build environment has no package-registry access, so Zod cannot be
 * installed. This module is deliberately small: enough combinators to assert
 * the artifact contract with precise error paths, and nothing more. It is not a
 * general-purpose schema library and should not grow into one.
 *
 * MIGRATION PATH -- the conceptual architecture does not change:
 *
 *     hand-rolled validator          ->  Zod schema           ->  same typed accessors
 *     validate.ts                        schemas.ts               artifacts.ts
 *     validatePanel(raw): Panel          PanelSchema.parse(raw)   loadArtifacts()
 *
 * Replacing this file means swapping the body of each `validate*` function for
 * a `Schema.parse(raw)` call. `artifacts.ts` and every consumer stay untouched,
 * because they depend on the validated TYPES, not on how validation happens.
 *
 * WHAT THIS MODULE MUST NEVER DO
 * Compute anything. It checks shape and rejects malformed input. It does not
 * derive, aggregate, or infer a single value.
 */

import {
  COUNTRY_IDS,
  SERIES_IDS,
  type CategoryReview,
  type Claim,
  type ClaimsArtifact,
  type ClaimsSummary,
  type CorrelationBundle,
  type CountriesArtifact,
  type CountryId,
  type Coverage,
  type EvidenceGroup,
  type Interval,
  type IsoDate,
  type LagPoint,
  type ManifestAnalyticalConfiguration,
  type ManifestArtifact,
  type MetricsArtifact,
  type PanelArtifact,
  type PanelRow,
  type SeriesId,
  type SeriesMetrics,
  type Specification,
} from "./artifact-types.ts";

/** Thrown when an artifact violates the contract. Carries the failing path. */
export class ContractError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ContractError";
    this.path = path;
  }
}

// ---------------------------------------------------------------------------
// Primitive combinators
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(path: string, message: string): never {
  throw new ContractError(path, message);
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return typeof value;
}

export function obj(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, `expected object, got ${describe(value)}`);
  }
  return value as Record<string, unknown>;
}

function field(source: Record<string, unknown>, key: string, path: string): unknown {
  if (!(key in source)) fail(`${path}.${key}`, "required field is missing");
  return source[key];
}

export function str(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, `expected string, got ${describe(value)}`);
  return value;
}

/**
 * Finite number only. Rejects NaN and +/-Infinity explicitly: the pipeline
 * emits `null` for non-computable values, so a non-finite number here means
 * the artifact was produced or mutated by something other than the pipeline.
 */
export function num(value: unknown, path: string): number {
  if (typeof value !== "number") fail(path, `expected number, got ${describe(value)}`);
  if (Number.isNaN(value)) fail(path, "expected a finite number, got NaN");
  if (!Number.isFinite(value)) fail(path, `expected a finite number, got ${value}`);
  return value;
}

export function int(value: unknown, path: string): number {
  const n = num(value, path);
  if (!Number.isInteger(n)) fail(path, `expected an integer, got ${n}`);
  return n;
}

export function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, `expected boolean, got ${describe(value)}`);
  return value;
}

export function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, `expected array, got ${describe(value)}`);
  return value;
}

/** ISO `YYYY-MM-DD` that is also a real calendar date. */
export function isoDate(value: unknown, path: string): IsoDate {
  const s = str(value, path);
  if (!ISO_DATE.test(s)) fail(path, `expected an ISO date (YYYY-MM-DD), got "${s}"`);
  const parsed = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) fail(path, `not a valid calendar date: "${s}"`);
  if (parsed.toISOString().slice(0, 10) !== s) fail(path, `not a real calendar date: "${s}"`);
  return s;
}

export function oneOf<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
): T {
  const s = str(value, path);
  if (!(allowed as readonly string[]).includes(s)) {
    fail(path, `expected one of [${allowed.join(", ")}], got "${s}"`);
  }
  return s as T;
}

function nullable<T>(
  value: unknown,
  path: string,
  read: (v: unknown, p: string) => T,
): T | null {
  return value === null ? null : read(value, path);
}

function strings(value: unknown, path: string): string[] {
  return arr(value, path).map((v, i) => str(v, `${path}[${i}]`));
}

function isoDates(value: unknown, path: string): IsoDate[] {
  return arr(value, path).map((v, i) => isoDate(v, `${path}[${i}]`));
}

/** Record that must contain exactly the given keys, each mapped by `read`. */
function exactRecord<K extends string, V>(
  value: unknown,
  path: string,
  keys: readonly K[],
  read: (v: unknown, p: string) => V,
): Record<K, V> {
  const source = obj(value, path);
  const out = {} as Record<K, V>;
  for (const key of keys) {
    out[key] = read(field(source, key, path), `${path}.${key}`);
  }
  const unexpected = Object.keys(source).filter(
    (k) => !(keys as readonly string[]).includes(k),
  );
  if (unexpected.length > 0) {
    fail(path, `unexpected keys: [${unexpected.join(", ")}]`);
  }
  return out;
}

const seriesId = (v: unknown, p: string): SeriesId => oneOf(v, p, SERIES_IDS);
const countryId = (v: unknown, p: string): CountryId => oneOf(v, p, COUNTRY_IDS);

const EVIDENCE_GROUPS: readonly EvidenceGroup[] = [
  "no_detectable_association",
  "inconclusive",
  "level_only_association",
  "robust_positive_association",
  "robust_negative_association",
];

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

function readCoverage(value: unknown, path: string): Coverage {
  const o = obj(value, path);
  return {
    trends_weeks: int(field(o, "trends_weeks", path), `${path}.trends_weeks`),
    oil_weeks: int(field(o, "oil_weeks", path), `${path}.oil_weeks`),
    first_week: isoDate(field(o, "first_week", path), `${path}.first_week`),
    last_week: isoDate(field(o, "last_week", path), `${path}.last_week`),
    weeks_without_oil: isoDates(
      field(o, "weeks_without_oil", path),
      `${path}.weeks_without_oil`,
    ),
    partial_weeks: isoDates(field(o, "partial_weeks", path), `${path}.partial_weeks`),
  };
}

function readInterval(value: unknown, path: string): Interval {
  const o = obj(value, path);
  const low = num(field(o, "low", path), `${path}.low`);
  const high = num(field(o, "high", path), `${path}.high`);
  if (low > high) fail(path, `interval is inverted: low ${low} > high ${high}`);
  return {
    low,
    high,
    level: num(field(o, "level", path), `${path}.level`),
    method: str(field(o, "method", path), `${path}.method`),
  };
}

// ---------------------------------------------------------------------------
// panel.json
// ---------------------------------------------------------------------------

function readPanelRow(value: unknown, path: string): PanelRow {
  const o = obj(value, path);
  const rawOil = field(o, "oil", path);
  const regime = nullable(field(o, "regime", path), `${path}.regime`, (v, p) =>
    oneOf(v, p, ["baseline", "elevated"] as const),
  );

  const oil = nullable(rawOil, `${path}.oil`, (v, p) => {
    const oo = obj(v, p);
    const tradingDays = int(field(oo, "trading_days", p), `${p}.trading_days`);
    const isPartial = bool(field(oo, "is_partial_week", p), `${p}.is_partial_week`);
    if (isPartial !== tradingDays < 5) {
      fail(p, `is_partial_week (${isPartial}) contradicts trading_days (${tradingDays})`);
    }
    return {
      brent_usd_per_barrel: num(
        field(oo, "brent_usd_per_barrel", p),
        `${p}.brent_usd_per_barrel`,
      ),
      brent_usd_per_litre: num(field(oo, "brent_usd_per_litre", p), `${p}.brent_usd_per_litre`),
      brent_usd_per_barrel_exact: num(
        field(oo, "brent_usd_per_barrel_exact", p),
        `${p}.brent_usd_per_barrel_exact`,
      ),
      brent_usd_per_litre_exact: num(
        field(oo, "brent_usd_per_litre_exact", p),
        `${p}.brent_usd_per_litre_exact`,
      ),
      trading_days: tradingDays,
      imputed_days: int(field(oo, "imputed_days", p), `${p}.imputed_days`),
      is_partial_week: isPartial,
      min_usd_per_barrel: num(field(oo, "min_usd_per_barrel", p), `${p}.min_usd_per_barrel`),
      max_usd_per_barrel: num(field(oo, "max_usd_per_barrel", p), `${p}.max_usd_per_barrel`),
    };
  });

  // The pipeline guarantees regime is present exactly when oil is.
  if ((oil === null) !== (regime === null)) {
    fail(path, `regime and oil must both be null or both be present`);
  }

  const interest = exactRecord(
    field(o, "interest", path),
    `${path}.interest`,
    SERIES_IDS,
    (v, p) => {
      const score = num(v, p);
      if (score < 0 || score > 100) {
        fail(p, `Google Trends interest must lie in 0-100, got ${score}`);
      }
      return score;
    },
  );

  return {
    week_start: isoDate(field(o, "week_start", path), `${path}.week_start`),
    week_end: isoDate(field(o, "week_end", path), `${path}.week_end`),
    regime,
    oil,
    interest,
  };
}

export function validatePanel(raw: unknown): PanelArtifact {
  const path = "panel";
  const o = obj(raw, path);
  const units = obj(field(o, "units", path), `${path}.units`);
  const conventions = obj(field(o, "conventions", path), `${path}.conventions`);
  const rows = arr(field(o, "rows", path), `${path}.rows`).map((r, i) =>
    readPanelRow(r, `${path}.rows[${i}]`),
  );

  if (rows.length === 0) fail(`${path}.rows`, "panel contains no rows");

  const coverage = readCoverage(field(o, "coverage", path), `${path}.coverage`);
  if (coverage.trends_weeks !== rows.length) {
    fail(
      `${path}.coverage.trends_weeks`,
      `declared ${coverage.trends_weeks} weeks but rows contains ${rows.length}`,
    );
  }

  return {
    schema_version: str(field(o, "schema_version", path), `${path}.schema_version`),
    units: {
      brent_usd_per_barrel: str(
        field(units, "brent_usd_per_barrel", `${path}.units`),
        `${path}.units.brent_usd_per_barrel`,
      ),
      brent_usd_per_litre: str(
        field(units, "brent_usd_per_litre", `${path}.units`),
        `${path}.units.brent_usd_per_litre`,
      ),
      interest: str(field(units, "interest", `${path}.units`), `${path}.units.interest`),
    },
    conventions: {
      week_key: str(
        field(conventions, "week_key", `${path}.conventions`),
        `${path}.conventions.week_key`,
      ),
      oil_aggregation: str(
        field(conventions, "oil_aggregation", `${path}.conventions`),
        `${path}.conventions.oil_aggregation`,
      ),
      missing_daily_values: str(
        field(conventions, "missing_daily_values", `${path}.conventions`),
        `${path}.conventions.missing_daily_values`,
      ),
      rows_without_oil: str(
        field(conventions, "rows_without_oil", `${path}.conventions`),
        `${path}.conventions.rows_without_oil`,
      ),
    },
    coverage,
    rows,
  };
}

// ---------------------------------------------------------------------------
// countries.json
// ---------------------------------------------------------------------------

export function validateCountries(raw: unknown): CountriesArtifact {
  const path = "countries";
  const o = obj(raw, path);
  const c = obj(field(o, "comparability", path), `${path}.comparability`);
  const cp = `${path}.comparability`;

  const series = arr(field(o, "series", path), `${path}.series`).map((entry, i) => {
    const p = `${path}.series[${i}]`;
    const e = obj(entry, p);
    return {
      id: seriesId(field(e, "id", p), `${p}.id`),
      label: str(field(e, "label", p), `${p}.label`),
      short: str(field(e, "short", p), `${p}.short`),
      is_country: bool(field(e, "is_country", p), `${p}.is_country`),
      source_file: str(field(e, "source_file", p), `${p}.source_file`),
      legacy_column: str(field(e, "legacy_column", p), `${p}.legacy_column`),
    };
  });

  const ids = series.map((s) => s.id);
  for (const expected of SERIES_IDS) {
    if (!ids.includes(expected)) {
      fail(`${path}.series`, `registry is missing series "${expected}"`);
    }
  }

  return {
    schema_version: str(field(o, "schema_version", path), `${path}.schema_version`),
    series,
    comparability: {
      trends_normalisation: str(
        field(c, "trends_normalisation", cp),
        `${cp}.trends_normalisation`,
      ),
      explanation: str(field(c, "explanation", cp), `${cp}.explanation`),
      scale_free_metrics: strings(
        field(c, "scale_free_metrics", cp),
        `${cp}.scale_free_metrics`,
      ),
      series_local_metrics: strings(
        field(c, "series_local_metrics", cp),
        `${cp}.series_local_metrics`,
      ),
      forbidden_comparisons: strings(
        field(c, "forbidden_comparisons", cp),
        `${cp}.forbidden_comparisons`,
      ),
      remedy: str(field(c, "remedy", cp), `${cp}.remedy`),
    },
  };
}

// ---------------------------------------------------------------------------
// metrics.json
// ---------------------------------------------------------------------------

function readLagPoint(value: unknown, path: string): LagPoint {
  const o = obj(value, path);
  return {
    lag_weeks: int(field(o, "lag_weeks", path), `${path}.lag_weeks`),
    n: int(field(o, "n", path), `${path}.n`),
    pearson_r: num(field(o, "pearson_r", path), `${path}.pearson_r`),
    pearson_p: num(field(o, "pearson_p", path), `${path}.pearson_p`),
    spearman_rho: num(field(o, "spearman_rho", path), `${path}.spearman_rho`),
  };
}

function readCorrelationBundle(value: unknown, path: string): CorrelationBundle {
  const o = obj(value, path);
  const fitPath = `${path}.fit`;
  const f = obj(field(o, "fit", path), fitPath);

  const r = num(field(o, "pearson_r", path), `${path}.pearson_r`);
  if (r < -1 || r > 1) fail(`${path}.pearson_r`, `correlation out of range: ${r}`);
  const p = num(field(o, "pearson_p", path), `${path}.pearson_p`);
  if (p < 0 || p > 1) fail(`${path}.pearson_p`, `p-value out of range: ${p}`);

  return {
    lag_weeks: int(field(o, "lag_weeks", path), `${path}.lag_weeks`),
    n: int(field(o, "n", path), `${path}.n`),
    pearson_r: r,
    pearson_p: p,
    spearman_rho: num(field(o, "spearman_rho", path), `${path}.spearman_rho`),
    spearman_p: num(field(o, "spearman_p", path), `${path}.spearman_p`),
    bootstrap_ci: readInterval(field(o, "bootstrap_ci", path), `${path}.bootstrap_ci`),
    fisher_ci: readInterval(field(o, "fisher_ci", path), `${path}.fisher_ci`),
    fit: {
      slope: num(field(f, "slope", fitPath), `${fitPath}.slope`),
      intercept: num(field(f, "intercept", fitPath), `${fitPath}.intercept`),
      r_squared: num(field(f, "r_squared", fitPath), `${fitPath}.r_squared`),
      slope_stderr: num(field(f, "slope_stderr", fitPath), `${fitPath}.slope_stderr`),
      n: int(field(f, "n", fitPath), `${fitPath}.n`),
    },
    significant_at_alpha: bool(
      field(o, "significant_at_alpha", path),
      `${path}.significant_at_alpha`,
    ),
    alpha: num(field(o, "alpha", path), `${path}.alpha`),
    ci_includes_zero: bool(field(o, "ci_includes_zero", path), `${path}.ci_includes_zero`),
    strength_label: oneOf(field(o, "strength_label", path), `${path}.strength_label`, [
      "negligible",
      "weak",
      "moderate",
      "strong",
      "very_strong",
    ] as const),
    direction: oneOf(field(o, "direction", path), `${path}.direction`, [
      "positive",
      "negative",
    ] as const),
    includes_partial_week: bool(
      field(o, "includes_partial_week", path),
      `${path}.includes_partial_week`,
    ),
  };
}

function readSpecification(value: unknown, path: string): Specification {
  const o = obj(value, path);
  return {
    id: oneOf(field(o, "id", path), `${path}.id`, [
      "levels",
      "first_differences",
      "linear_detrended",
    ] as const),
    description: str(field(o, "description", path), `${path}.description`),
    n: int(field(o, "n", path), `${path}.n`),
    pearson_r: num(field(o, "pearson_r", path), `${path}.pearson_r`),
    pearson_p: num(field(o, "pearson_p", path), `${path}.pearson_p`),
    significant_at_alpha: bool(
      field(o, "significant_at_alpha", path),
      `${path}.significant_at_alpha`,
    ),
  };
}

function readSeriesMetrics(value: unknown, path: string): SeriesMetrics {
  const o = obj(value, path);

  const td = obj(field(o, "trend_diagnostics", path), `${path}.trend_diagnostics`);
  const tdp = `${path}.trend_diagnostics`;
  const sens = obj(field(o, "sensitivity", path), `${path}.sensitivity`);
  const sp = `${path}.sensitivity`;
  const loo = obj(field(sens, "leave_one_out", sp), `${sp}.leave_one_out`);
  const lp = `${sp}.leave_one_out`;
  const prof = obj(field(o, "profile", path), `${path}.profile`);
  const pp = `${path}.profile`;
  const local = obj(field(prof, "series_local", pp), `${pp}.series_local`);
  const free = obj(field(prof, "scale_free", pp), `${pp}.scale_free`);
  const cls = obj(field(o, "classification", path), `${path}.classification`);
  const cp = `${path}.classification`;

  // These flags are the guard rails the presentation layer relies on.
  const localComparable = bool(
    field(local, "_comparable_across_series", `${pp}.series_local`),
    `${pp}.series_local._comparable_across_series`,
  );
  if (localComparable !== false) {
    fail(
      `${pp}.series_local._comparable_across_series`,
      "series-local metrics must be flagged as NOT comparable across series",
    );
  }
  const freeComparable = bool(
    field(free, "_comparable_across_series", `${pp}.scale_free`),
    `${pp}.scale_free._comparable_across_series`,
  );
  if (freeComparable !== true) {
    fail(
      `${pp}.scale_free._comparable_across_series`,
      "scale-free metrics must be flagged as comparable across series",
    );
  }

  return {
    id: seriesId(field(o, "id", path), `${path}.id`),
    label: str(field(o, "label", path), `${path}.label`),
    short: str(field(o, "short", path), `${path}.short`),
    is_country: bool(field(o, "is_country", path), `${path}.is_country`),
    primary: readCorrelationBundle(field(o, "primary", path), `${path}.primary`),
    lag_profile: arr(field(o, "lag_profile", path), `${path}.lag_profile`).map((v, i) =>
      readLagPoint(v, `${path}.lag_profile[${i}]`),
    ),
    best_lag: nullable(field(o, "best_lag", path), `${path}.best_lag`, readLagPoint),
    unrestricted_lag_maximum_is_negative: bool(
      field(o, "unrestricted_lag_maximum_is_negative", path),
      `${path}.unrestricted_lag_maximum_is_negative`,
    ),
    trend_diagnostics: {
      oil_vs_time_r: num(field(td, "oil_vs_time_r", tdp), `${tdp}.oil_vs_time_r`),
      interest_vs_time_r: num(
        field(td, "interest_vs_time_r", tdp),
        `${tdp}.interest_vs_time_r`,
      ),
      both_series_trend_same_direction: bool(
        field(td, "both_series_trend_same_direction", tdp),
        `${tdp}.both_series_trend_same_direction`,
      ),
      specifications: arr(field(td, "specifications", tdp), `${tdp}.specifications`).map(
        (v, i) => readSpecification(v, `${tdp}.specifications[${i}]`),
      ),
      agreement: oneOf(field(td, "agreement", tdp), `${tdp}.agreement`, [
        "consistent",
        "significance_disagreement",
        "sign_disagreement",
      ] as const),
      note: str(field(td, "note", tdp), `${tdp}.note`),
    },
    sensitivity: {
      leave_one_out: {
        baseline_r: num(field(loo, "baseline_r", lp), `${lp}.baseline_r`),
        min_r: num(field(loo, "min_r", lp), `${lp}.min_r`),
        max_r: num(field(loo, "max_r", lp), `${lp}.max_r`),
        max_abs_delta: num(field(loo, "max_abs_delta", lp), `${lp}.max_abs_delta`),
        most_influential_index: int(
          field(loo, "most_influential_index", lp),
          `${lp}.most_influential_index`,
        ),
        sign_flips: bool(field(loo, "sign_flips", lp), `${lp}.sign_flips`),
        per_observation: arr(field(loo, "per_observation", lp), `${lp}.per_observation`).map(
          (v, i) => {
            const p = `${lp}.per_observation[${i}]`;
            const row = obj(v, p);
            return {
              index: int(field(row, "index", p), `${p}.index`),
              label: nullable(field(row, "label", p), `${p}.label`, isoDate),
              r_without: num(field(row, "r_without", p), `${p}.r_without`),
              delta: num(field(row, "delta", p), `${p}.delta`),
            };
          },
        ),
      },
      variants: arr(field(sens, "variants", sp), `${sp}.variants`).map((v, i) => {
        const p = `${sp}.variants[${i}]`;
        const variant = obj(v, p);
        const computable = bool(field(variant, "computable", p), `${p}.computable`);
        const readStat = (key: string): number | null =>
          nullable(field(variant, key, p), `${p}.${key}`, num);
        const pearsonR = readStat("pearson_r");
        // A non-computable variant must not carry statistics, and a computable
        // one must. Either violation means the artifact is internally wrong.
        if (computable && pearsonR === null) {
          fail(`${p}.pearson_r`, "computable variant must report a coefficient");
        }
        if (!computable && pearsonR !== null) {
          fail(`${p}.pearson_r`, "non-computable variant must report null");
        }
        return {
          id: oneOf(field(variant, "id", p), `${p}.id`, [
            "exclude_partial_weeks",
            "baseline_regime_only",
            "elevated_regime_only",
            "rank_based",
          ] as const),
          description: str(field(variant, "description", p), `${p}.description`),
          n: int(field(variant, "n", p), `${p}.n`),
          pearson_r: pearsonR,
          pearson_p: readStat("pearson_p"),
          delta_vs_primary: readStat("delta_vs_primary"),
          computable,
          reason: nullable(field(variant, "reason", p), `${p}.reason`, str),
        };
      }),
    },
    profile: {
      series_local: {
        mean_interest: num(
          field(local, "mean_interest", `${pp}.series_local`),
          `${pp}.series_local.mean_interest`,
        ),
        median_interest: num(
          field(local, "median_interest", `${pp}.series_local`),
          `${pp}.series_local.median_interest`,
        ),
        min_interest: num(
          field(local, "min_interest", `${pp}.series_local`),
          `${pp}.series_local.min_interest`,
        ),
        peak_value: num(
          field(local, "peak_value", `${pp}.series_local`),
          `${pp}.series_local.peak_value`,
        ),
        baseline_mean_interest: num(
          field(local, "baseline_mean_interest", `${pp}.series_local`),
          `${pp}.series_local.baseline_mean_interest`,
        ),
        elevated_mean_interest: num(
          field(local, "elevated_mean_interest", `${pp}.series_local`),
          `${pp}.series_local.elevated_mean_interest`,
        ),
        _comparable_across_series: false,
      },
      scale_free: {
        peak_week: isoDate(
          field(free, "peak_week", `${pp}.scale_free`),
          `${pp}.scale_free.peak_week`,
        ),
        peak_week_ties: int(
          field(free, "peak_week_ties", `${pp}.scale_free`),
          `${pp}.scale_free.peak_week_ties`,
        ),
        baseline_to_peak_pct_change: num(
          field(free, "baseline_to_peak_pct_change", `${pp}.scale_free`),
          `${pp}.scale_free.baseline_to_peak_pct_change`,
        ),
        baseline_to_elevated_pct_change: num(
          field(free, "baseline_to_elevated_pct_change", `${pp}.scale_free`),
          `${pp}.scale_free.baseline_to_elevated_pct_change`,
        ),
        peak_lag_weeks: int(
          field(free, "peak_lag_weeks", `${pp}.scale_free`),
          `${pp}.scale_free.peak_lag_weeks`,
        ),
        _comparable_across_series: true,
      },
    },
    classification: {
      strength: oneOf(field(cls, "strength", cp), `${cp}.strength`, [
        "negligible",
        "weak",
        "moderate",
        "strong",
        "very_strong",
      ] as const),
      direction: oneOf(field(cls, "direction", cp), `${cp}.direction`, [
        "positive",
        "negative",
      ] as const),
      significance: oneOf(field(cls, "significance", cp), `${cp}.significance`, [
        "significant",
        "not_significant",
      ] as const),
      robustness: oneOf(field(cls, "robustness", cp), `${cp}.robustness`, [
        "fragile",
        "moderate",
        "robust",
      ] as const),
      evidence_group: oneOf(
        field(cls, "evidence_group", cp),
        `${cp}.evidence_group`,
        EVIDENCE_GROUPS,
      ),
      caveats: arr(field(cls, "caveats", cp), `${cp}.caveats`).map((v, i) =>
        oneOf(v, `${cp}.caveats[${i}]`, [
          "small_sample",
          "few_elevated_observations",
          "includes_partial_week",
          "ci_includes_zero",
          "loo_sign_flip",
          "leverage_dependent",
          "not_significant",
          "series_local_scale",
          "loses_significance_without_elevated_regime",
          "no_short_run_comovement",
          "shared_trend_confound_possible",
          "specification_sensitive",
          "regime_sensitive",
          "negative_lag_maximum",
        ] as const),
      ),
    },
  };
}

function readCategoryReview(value: unknown, path: string): CategoryReview {
  const o = obj(value, path);
  return {
    id: str(field(o, "id", path), `${path}.id`),
    original_title: str(field(o, "original_title", path), `${path}.original_title`),
    original_members: arr(field(o, "original_members", path), `${path}.original_members`).map(
      (v, i) => countryId(v, `${path}.original_members[${i}]`),
    ),
    data_supported_members: arr(
      field(o, "data_supported_members", path),
      `${path}.data_supported_members`,
    ).map((v, i) => countryId(v, `${path}.data_supported_members[${i}]`)),
    unsupported_members: arr(
      field(o, "unsupported_members", path),
      `${path}.unsupported_members`,
    ).map((v, i) => countryId(v, `${path}.unsupported_members[${i}]`)),
    verdict: oneOf(field(o, "verdict", path), `${path}.verdict`, [
      "supported",
      "partially_supported",
      "not_supported",
    ] as const),
    requires_external_evidence: bool(
      field(o, "requires_external_evidence", path),
      `${path}.requires_external_evidence`,
    ),
    basis: str(field(o, "basis", path), `${path}.basis`),
  };
}

/** Reproducibility subset recorded in `manifest.analytical_configuration`. */
function readManifestAnalyticalConfiguration(
  value: unknown,
  path: string,
): ManifestAnalyticalConfiguration {
  const o = obj(value, path);
  return {
    primary_lag_weeks: int(field(o, "primary_lag_weeks", path), `${path}.primary_lag_weeks`),
    lag_window_weeks: arr(field(o, "lag_window_weeks", path), `${path}.lag_window_weeks`).map(
      (v, i) => int(v, `${path}.lag_window_weeks[${i}]`),
    ),
    confidence_level: num(field(o, "confidence_level", path), `${path}.confidence_level`),
    bootstrap_iterations: int(
      field(o, "bootstrap_iterations", path),
      `${path}.bootstrap_iterations`,
    ),
    bootstrap_seed: int(field(o, "bootstrap_seed", path), `${path}.bootstrap_seed`),
    litres_per_barrel: num(field(o, "litres_per_barrel", path), `${path}.litres_per_barrel`),
    regime_rule: str(field(o, "regime_rule", path), `${path}.regime_rule`),
    trends_normalisation: str(
      field(o, "trends_normalisation", path),
      `${path}.trends_normalisation`,
    ),
  };
}

/** Full configuration recorded in `metrics.configuration`. */
function readAnalyticalConfiguration(
  value: unknown,
  path: string,
): MetricsArtifact["configuration"] {
  const o = obj(value, path);
  return {
    primary_lag_weeks: int(field(o, "primary_lag_weeks", path), `${path}.primary_lag_weeks`),
    lag_window_weeks: arr(field(o, "lag_window_weeks", path), `${path}.lag_window_weeks`).map(
      (v, i) => int(v, `${path}.lag_window_weeks[${i}]`),
    ),
    min_pairs_for_lag: int(field(o, "min_pairs_for_lag", path), `${path}.min_pairs_for_lag`),
    confidence_level: num(field(o, "confidence_level", path), `${path}.confidence_level`),
    bootstrap_iterations: int(
      field(o, "bootstrap_iterations", path),
      `${path}.bootstrap_iterations`,
    ),
    bootstrap_seed: int(field(o, "bootstrap_seed", path), `${path}.bootstrap_seed`),
    significance_alpha: num(field(o, "significance_alpha", path), `${path}.significance_alpha`),
    litres_per_barrel: num(field(o, "litres_per_barrel", path), `${path}.litres_per_barrel`),
    include_partial_weeks_in_primary: bool(
      field(o, "include_partial_weeks_in_primary", path),
      `${path}.include_partial_weeks_in_primary`,
    ),
    regime_rule: str(field(o, "regime_rule", path), `${path}.regime_rule`),
    lag_sign_convention: str(
      field(o, "lag_sign_convention", path),
      `${path}.lag_sign_convention`,
    ),
  };
}

export function validateMetrics(raw: unknown): MetricsArtifact {
  const path = "metrics";
  const o = obj(raw, path);

  const g = obj(field(o, "global", path), `${path}.global`);
  const gp = `${path}.global`;
  const oil = obj(field(g, "oil", gp), `${gp}.oil`);
  const op = `${gp}.oil`;
  const regime = obj(field(g, "regime", gp), `${gp}.regime`);
  const rp = `${gp}.regime`;
  const disp = obj(field(g, "peak_dispersion", gp), `${gp}.peak_dispersion`);
  const dp = `${gp}.peak_dispersion`;
  const groups = obj(field(g, "evidence_groups", gp), `${gp}.evidence_groups`);
  const vocab = obj(
    field(o, "interpretation_vocabulary", path),
    `${path}.interpretation_vocabulary`,
  );
  const vp = `${path}.interpretation_vocabulary`;

  const series = exactRecord(
    field(o, "series", path),
    `${path}.series`,
    SERIES_IDS,
    readSeriesMetrics,
  );
  for (const id of SERIES_IDS) {
    const entry = series[id];
    if (entry.id !== id) {
      fail(`${path}.series.${id}.id`, `series key "${id}" disagrees with id "${entry.id}"`);
    }
  }

  const evidenceGroups: Partial<Record<EvidenceGroup, readonly CountryId[]>> = {};
  for (const [key, value] of Object.entries(groups)) {
    const group = oneOf(key, `${gp}.evidence_groups`, EVIDENCE_GROUPS);
    evidenceGroups[group] = arr(value, `${gp}.evidence_groups.${key}`).map((v, i) =>
      countryId(v, `${gp}.evidence_groups.${key}[${i}]`),
    );
  }

  return {
    schema_version: str(field(o, "schema_version", path), `${path}.schema_version`),
    configuration: readAnalyticalConfiguration(
      field(o, "configuration", path),
      `${path}.configuration`,
    ),
    global: {
      oil: {
        weeks: int(field(oil, "weeks", op), `${op}.weeks`),
        first_week: isoDate(field(oil, "first_week", op), `${op}.first_week`),
        last_week: isoDate(field(oil, "last_week", op), `${op}.last_week`),
        mean_usd_per_barrel: num(
          field(oil, "mean_usd_per_barrel", op),
          `${op}.mean_usd_per_barrel`,
        ),
        median_usd_per_barrel: num(
          field(oil, "median_usd_per_barrel", op),
          `${op}.median_usd_per_barrel`,
        ),
        min_usd_per_barrel: num(
          field(oil, "min_usd_per_barrel", op),
          `${op}.min_usd_per_barrel`,
        ),
        min_week: isoDate(field(oil, "min_week", op), `${op}.min_week`),
        max_usd_per_barrel: num(
          field(oil, "max_usd_per_barrel", op),
          `${op}.max_usd_per_barrel`,
        ),
        max_week: isoDate(field(oil, "max_week", op), `${op}.max_week`),
        max_usd_per_litre: num(field(oil, "max_usd_per_litre", op), `${op}.max_usd_per_litre`),
        total_pct_change_first_to_max: num(
          field(oil, "total_pct_change_first_to_max", op),
          `${op}.total_pct_change_first_to_max`,
        ),
        partial_weeks: isoDates(field(oil, "partial_weeks", op), `${op}.partial_weeks`),
        weeks_with_imputed_days: arr(
          field(oil, "weeks_with_imputed_days", op),
          `${op}.weeks_with_imputed_days`,
        ).map((v, i) => {
          const p = `${op}.weeks_with_imputed_days[${i}]`;
          const row = obj(v, p);
          return {
            week_start: isoDate(field(row, "week_start", p), `${p}.week_start`),
            imputed_days: int(field(row, "imputed_days", p), `${p}.imputed_days`),
          };
        }),
      },
      regime: {
        rule: str(field(regime, "rule", rp), `${rp}.rule`),
        onset_week: isoDate(field(regime, "onset_week", rp), `${rp}.onset_week`),
        onset_pct_change: num(field(regime, "onset_pct_change", rp), `${rp}.onset_pct_change`),
        baseline_weeks: int(field(regime, "baseline_weeks", rp), `${rp}.baseline_weeks`),
        elevated_weeks: int(field(regime, "elevated_weeks", rp), `${rp}.elevated_weeks`),
        baseline_max_usd_per_barrel: num(
          field(regime, "baseline_max_usd_per_barrel", rp),
          `${rp}.baseline_max_usd_per_barrel`,
        ),
        elevated_min_usd_per_barrel: num(
          field(regime, "elevated_min_usd_per_barrel", rp),
          `${rp}.elevated_min_usd_per_barrel`,
        ),
        regimes_separated: bool(
          field(regime, "regimes_separated", rp),
          `${rp}.regimes_separated`,
        ),
      },
      peak_dispersion: {
        peaks: exactRecord(field(disp, "peaks", dp), `${dp}.peaks`, COUNTRY_IDS, isoDate),
        distinct_weeks: int(field(disp, "distinct_weeks", dp), `${dp}.distinct_weeks`),
        distinct_months: strings(field(disp, "distinct_months", dp), `${dp}.distinct_months`),
        span_weeks: int(field(disp, "span_weeks", dp), `${dp}.span_weeks`),
        synchronised_within_one_month: bool(
          field(disp, "synchronised_within_one_month", dp),
          `${dp}.synchronised_within_one_month`,
        ),
      },
      worldwide: nullable(field(g, "worldwide", gp), `${gp}.worldwide`, readSeriesMetrics),
      evidence_groups: evidenceGroups,
    },
    series,
    countries: arr(field(o, "countries", path), `${path}.countries`).map((v, i) =>
      countryId(v, `${path}.countries[${i}]`),
    ),
    category_review: arr(field(o, "category_review", path), `${path}.category_review`).map(
      (v, i) => readCategoryReview(v, `${path}.category_review[${i}]`),
    ),
    interpretation_vocabulary: {
      strength: strings(field(vocab, "strength", vp), `${vp}.strength`),
      robustness: strings(field(vocab, "robustness", vp), `${vp}.robustness`),
      evidence_group: strings(field(vocab, "evidence_group", vp), `${vp}.evidence_group`),
      note: str(field(vocab, "note", vp), `${vp}.note`),
    },
  };
}

// ---------------------------------------------------------------------------
// claims.json
// ---------------------------------------------------------------------------

function readClaimsSummary(value: unknown, path: string): ClaimsSummary {
  const o = obj(value, path);
  const record = (key: string): Record<string, readonly string[]> => {
    const source = obj(field(o, key, path), `${path}.${key}`);
    const out: Record<string, readonly string[]> = {};
    for (const [k, v] of Object.entries(source)) {
      out[k] = strings(v, `${path}.${key}.${k}`);
    }
    return out;
  };
  return {
    total: int(field(o, "total", path), `${path}.total`),
    by_disposition: record("by_disposition"),
    by_status: record("by_status"),
    requiring_citation: strings(
      field(o, "requiring_citation", path),
      `${path}.requiring_citation`,
    ),
    unsourced_count: int(field(o, "unsourced_count", path), `${path}.unsourced_count`),
  };
}

function readClaim(value: unknown, path: string): Claim {
  const o = obj(value, path);
  const evidence = strings(field(o, "evidence", path), `${path}.evidence`);
  const sources = strings(field(o, "sources", path), `${path}.sources`);
  const disposition = oneOf(field(o, "disposition", path), `${path}.disposition`, [
    "retain",
    "rewrite",
    "remove",
    "requires_citation",
  ] as const);
  const publishable = bool(
    field(o, "publishable_as_fact", path),
    `${path}.publishable_as_fact`,
  );

  // The publishability gate the UI depends on, asserted at the boundary: a claim
  // with neither evidence nor a source must never be marked publishable.
  if (publishable && evidence.length === 0 && sources.length === 0) {
    fail(
      `${path}.publishable_as_fact`,
      "claim has no evidence and no sources, so it cannot be publishable as fact",
    );
  }

  return {
    id: str(field(o, "id", path), `${path}.id`),
    origin: str(field(o, "origin", path), `${path}.origin`),
    original_text: str(field(o, "original_text", path), `${path}.original_text`),
    status: oneOf(field(o, "status", path), `${path}.status`, [
      "supported_by_data",
      "overstated_relative_to_data",
      "contradicted_by_data",
      "invalid_method",
      "external_unverifiable_from_dataset",
      "beyond_data_window",
      "describes_work_not_present",
    ] as const),
    disposition,
    reason: str(field(o, "reason", path), `${path}.reason`),
    evidence,
    suggested_statement: nullable(
      field(o, "suggested_statement", path),
      `${path}.suggested_statement`,
      str,
    ),
    sources,
    publishable_as_fact: publishable,
  };
}

export function validateClaims(raw: unknown): ClaimsArtifact {
  const path = "claims";
  const o = obj(raw, path);
  const policy = obj(field(o, "policy", path), `${path}.policy`);
  const claims = arr(field(o, "claims", path), `${path}.claims`).map((v, i) =>
    readClaim(v, `${path}.claims[${i}]`),
  );
  const summary = readClaimsSummary(field(o, "summary", path), `${path}.summary`);

  if (summary.total !== claims.length) {
    fail(
      `${path}.summary.total`,
      `summary declares ${summary.total} claims but the list contains ${claims.length}`,
    );
  }

  return {
    schema_version: str(field(o, "schema_version", path), `${path}.schema_version`),
    summary,
    policy: {
      unverifiable_external_claims: str(
        field(policy, "unverifiable_external_claims", `${path}.policy`),
        `${path}.policy.unverifiable_external_claims`,
      ),
      publishable_rule: str(
        field(policy, "publishable_rule", `${path}.policy`),
        `${path}.policy.publishable_rule`,
      ),
    },
    claims,
  };
}

// ---------------------------------------------------------------------------
// manifest.json
// ---------------------------------------------------------------------------

const SHA256 = /^[0-9a-f]{64}$/;
const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function hashRecord(value: unknown, path: string): Record<string, string> {
  const source = obj(value, path);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    const digest = str(v, `${path}.${k}`);
    if (!SHA256.test(digest)) {
      fail(`${path}.${k}`, `expected a lowercase hex SHA-256 digest, got "${digest}"`);
    }
    out[k] = digest;
  }
  return out;
}

export function validateManifest(raw: unknown): ManifestArtifact {
  const path = "manifest";
  const o = obj(raw, path);

  const generatedAt = str(field(o, "generated_at", path), `${path}.generated_at`);
  if (!RFC3339_UTC.test(generatedAt)) {
    fail(
      `${path}.generated_at`,
      `expected RFC 3339 UTC with a single 'Z' (YYYY-MM-DDTHH:MM:SSZ), got "${generatedAt}"`,
    );
  }

  const contentHash = str(field(o, "content_hash", path), `${path}.content_hash`);
  if (!SHA256.test(contentHash)) {
    fail(`${path}.content_hash`, `expected a SHA-256 digest, got "${contentHash}"`);
  }

  return {
    schema_version: str(field(o, "schema_version", path), `${path}.schema_version`),
    pipeline_version: str(field(o, "pipeline_version", path), `${path}.pipeline_version`),
    generated_at: generatedAt,
    _determinism_note: str(field(o, "_determinism_note", path), `${path}._determinism_note`),
    content_hash: contentHash,
    sources: arr(field(o, "sources", path), `${path}.sources`).map((v, i) => {
      const p = `${path}.sources[${i}]`;
      const s = obj(v, p);
      return {
        id: str(field(s, "id", p), `${p}.id`),
        name: str(field(s, "name", p), `${p}.name`),
        publisher: str(field(s, "publisher", p), `${p}.publisher`),
        url: str(field(s, "url", p), `${p}.url`),
        series_id: nullable(field(s, "series_id", p), `${p}.series_id`, str),
        units: str(field(s, "units", p), `${p}.units`),
        frequency: str(field(s, "frequency", p), `${p}.frequency`),
        notes: str(field(s, "notes", p), `${p}.notes`),
      };
    }),
    source_files: hashRecord(field(o, "source_files", path), `${path}.source_files`),
    artifacts: hashRecord(field(o, "artifacts", path), `${path}.artifacts`),
    coverage: readCoverage(field(o, "coverage", path), `${path}.coverage`),
    analytical_configuration: readManifestAnalyticalConfiguration(
      field(o, "analytical_configuration", path),
      `${path}.analytical_configuration`,
    ),
    claims_summary: readClaimsSummary(
      field(o, "claims_summary", path),
      `${path}.claims_summary`,
    ),
  };
}
