/**
 * Boundary validation for the generated analytical artifacts.
 *
 * Zod owns the runtime structural contract. `ContractError` owns how a failure
 * is reported. The two are deliberately separate: callers never see a
 * `ZodError`, and the error they do see names the exact JSON path that failed,
 * because a silent malformed read is the specific bug class that let the
 * original project publish wrong numbers.
 *
 * WHY THIS FILE CHANGED (Phase 3C step 2)
 * The previous implementation was a hand-rolled combinator library, written
 * only because the Phase 3A environment had no package-registry access. Zod
 * 4.6.5 is now installed, so the combinators are gone and the schemas below are
 * the contract. The public surface is unchanged: the same five `validate*`
 * functions, the same `ContractError`, the same paths.
 *
 * FOUR ZOD BEHAVIOURS THIS FILE DEPENDS ON, each verified against 4.6.5 rather
 * than assumed, because the error contract breaks quietly if any is wrong:
 *
 *   1. `.nullable()` preserves inner issue paths. A `z.union([schema, z.null()])`
 *      does NOT -- it collapses to one `invalid_union` issue at the union's own
 *      path, which would report `panel.rows[3].oil` instead of
 *      `panel.rows[3].oil.brent_usd_per_barrel_exact`. Every nullable field here
 *      therefore uses `.nullable()`, never a union.
 *   2. `z.record(z.enum(IDS), value)` is an EXACT record: every id must be
 *      present, and an unrecognised key is rejected at the record's own path.
 *      That is precisely the old `exactRecord` contract, derived from
 *      `SERIES_IDS`/`COUNTRY_IDS` instead of restating them.
 *   3. Refinements do not run when the base parse of the same schema failed, so
 *      a cross-field invariant never fires on a value that is already the wrong
 *      type. This keeps the old fail-fast ordering.
 *   4. `z.number()` rejects `NaN` and `+/-Infinity`, and says which one it got.
 *      The pipeline emits `null` for non-computable values, so a non-finite
 *      number means the artifact was produced or mutated by something other
 *      than the pipeline.
 *
 * WHAT WENT AWAY, AND WHY THAT IS SAFE
 * The old module also exported its combinators -- `obj`, `str`, `num`, `int`,
 * `bool`, `arr`, `isoDate`, `oneOf`. Nothing imported them: not `artifacts.ts`,
 * not `index.ts`, not any test. They were the hand-rolled library's internals,
 * they have no Zod analogue, and keeping them would mean keeping the library
 * this step exists to delete. `index.ts` only ever re-exported `ContractError`,
 * so the public surface of the data layer is unchanged.
 *
 * One semantic difference is deliberate: `z.int()` also requires a SAFE integer
 * (|n| <= 2^53-1), where the old `int()` accepted any integer-valued float. Every
 * integer in these artifacts is a count, an index or a week offset over 31
 * observations, so the added bound cannot reject a legitimate value.
 *
 * WHAT THIS MODULE MUST NEVER DO
 * Compute anything. It checks shape and rejects malformed input. It does not
 * derive, aggregate, or infer a single value. The cross-field checks below are
 * assertions about internal agreement, never derivations: they compare two
 * values the pipeline already emitted and refuse the artifact when those two
 * disagree.
 */

import { z } from "zod";

import {
  COUNTRY_IDS,
  SERIES_IDS,
  type ClaimsArtifact,
  type CountriesArtifact,
  type ManifestArtifact,
  type MetricsArtifact,
  type PanelArtifact,
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
// Zod issue -> ContractError
// ---------------------------------------------------------------------------

/**
 * Render a Zod issue path as the dotted/bracketed JSON path the tests and error
 * messages use: `panel.rows[0].interest.norway`.
 *
 * Zod reports array indices as numbers and object keys as strings, which is the
 * only distinction needed. The root segment is the artifact name, so a failure
 * on the artifact itself reports `panel` rather than an empty string.
 */
function formatPath(root: string, segments: readonly PropertyKey[]): string {
  let path = root;
  for (const segment of segments) {
    path += typeof segment === "number" ? `[${segment}]` : `.${String(segment)}`;
  }
  return path;
}

/**
 * Parse against a schema, converting the first Zod issue into a `ContractError`.
 *
 * Zod collects every issue; the first is reported because that is the failure a
 * reader should fix first, and because it matches the old validator's throw-on-
 * first-violation behaviour. Nested issues are reported at their own depth, so
 * the path is as specific as the artifact allows.
 */
function parseArtifact<Schema extends z.ZodType>(
  schema: Schema,
  raw: unknown,
  root: string,
): z.output<Schema> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;

  const [issue] = result.error.issues;
  if (issue === undefined) {
    throw new ContractError(root, "failed validation without a reported issue");
  }
  throw new ContractError(formatPath(root, issue.path), issue.message);
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Render the offending value for an error message.
 *
 * Zod's default messages report the received TYPE; several of the checks below
 * are only actionable with the received VALUE, so those pass a message builder
 * that calls this. Strings are quoted so `"31/08/2025"` cannot be mistaken for
 * a description.
 */
function received(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** Finite number. Rejects NaN and +/-Infinity, naming which one it received. */
const finite = z.number();

/** Finite integer. Counts, indices, week offsets and observation totals. */
const integer = z.int();

const text = z.string();

const flag = z.boolean();

/**
 * ISO `YYYY-MM-DD` that is also a real calendar date.
 *
 * `z.iso.date()` validates both the format and the calendar, verified against
 * 4.6.5: `2026-02-30` and `2025-02-29` are refused while `2024-02-29` is
 * accepted. It reports one issue for both failure modes, so the message names
 * both rather than claiming to know which one occurred.
 *
 * The message is only overridden for a string input. Returning `undefined`
 * defers to Zod's default, so a missing or non-string field still reports
 * "expected string, received undefined" rather than a misleading date
 * complaint.
 */
const isoDate = z.iso.date({
  error: (issue) =>
    typeof issue.input === "string"
      ? `expected a real ISO calendar date (YYYY-MM-DD), got ${received(issue.input)}`
      : undefined,
});

const isoDates = z.array(isoDate);

const textList = z.array(text);

const seriesId = z.enum(SERIES_IDS);

const countryId = z.enum(COUNTRY_IDS);

const countryIds = z.array(countryId);

/** Google Trends index. Each series is scaled to its OWN maximum of 100. */
const interestScore = finite
  .min(0, {
    error: (issue) => `Google Trends interest must lie in 0-100, got ${received(issue.input)}`,
  })
  .max(100, {
    error: (issue) => `Google Trends interest must lie in 0-100, got ${received(issue.input)}`,
  });

const outOfRange = (what: string) => ({
  error: (issue: { readonly input: unknown }) =>
    `${what} out of range: ${received(issue.input)}`,
});

const correlation = finite.min(-1, outOfRange("correlation")).max(1, outOfRange("correlation"));

const probability = finite.min(0, outOfRange("p-value")).max(1, outOfRange("p-value"));

const sha256 = text.regex(/^[0-9a-f]{64}$/, {
  error: (issue) => `expected a lowercase hex SHA-256 digest, got ${received(issue.input)}`,
});

const evidenceGroup = z.enum([
  "no_detectable_association",
  "inconclusive",
  "level_only_association",
  "robust_positive_association",
  "robust_negative_association",
]);

const strengthLabel = z.enum(["negligible", "weak", "moderate", "strong", "very_strong"]);

const direction = z.enum(["positive", "negative"]);

/** Exact per-series record: all six ids required, no others accepted. */
function bySeries<Value extends z.ZodType>(value: Value) {
  return z.record(seriesId, value);
}

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

const coverageSchema = z.object({
  trends_weeks: integer,
  oil_weeks: integer,
  first_week: isoDate,
  last_week: isoDate,
  weeks_without_oil: isoDates,
  partial_weeks: isoDates,
});

const intervalSchema = z
  .object({
    low: finite,
    high: finite,
    level: finite,
    method: text,
  })
  .superRefine((interval, ctx) => {
    if (interval.low > interval.high) {
      ctx.addIssue({
        code: "custom",
        message: `interval is inverted: low ${String(interval.low)} > high ${String(interval.high)}`,
      });
    }
  });

const claimsSummarySchema = z.object({
  total: integer,
  by_disposition: z.record(text, textList),
  by_status: z.record(text, textList),
  requiring_citation: textList,
  unsourced_count: integer,
});

// ---------------------------------------------------------------------------
// panel.json
// ---------------------------------------------------------------------------

const oilWeekSchema = z
  .object({
    brent_usd_per_barrel: finite,
    brent_usd_per_litre: finite,
    brent_usd_per_barrel_exact: finite,
    brent_usd_per_litre_exact: finite,
    trading_days: integer,
    imputed_days: integer,
    is_partial_week: flag,
    min_usd_per_barrel: finite,
    max_usd_per_barrel: finite,
  })
  .superRefine((oil, ctx) => {
    // Both values come from the pipeline. This asserts they agree; it does not
    // decide which is right, and it does not recompute either.
    if (oil.is_partial_week !== oil.trading_days < 5) {
      ctx.addIssue({
        code: "custom",
        message:
          `is_partial_week (${String(oil.is_partial_week)}) contradicts ` +
          `trading_days (${String(oil.trading_days)})`,
      });
    }
  });

const panelRowSchema = z
  .object({
    week_start: isoDate,
    week_end: isoDate,
    regime: z.enum(["baseline", "elevated"]).nullable(),
    oil: oilWeekSchema.nullable(),
    interest: bySeries(interestScore),
  })
  .superRefine((row, ctx) => {
    // The pipeline guarantees regime is present exactly when oil is.
    if ((row.oil === null) !== (row.regime === null)) {
      ctx.addIssue({
        code: "custom",
        message: "regime and oil must both be null or both be present",
      });
    }
  });

const panelSchema = z
  .object({
    schema_version: text,
    units: z.object({
      brent_usd_per_barrel: text,
      brent_usd_per_litre: text,
      interest: text,
    }),
    conventions: z.object({
      week_key: text,
      oil_aggregation: text,
      missing_daily_values: text,
      rows_without_oil: text,
    }),
    rows: z.array(panelRowSchema).min(1, "panel contains no rows"),
    coverage: coverageSchema,
  })
  .superRefine((panel, ctx) => {
    if (panel.coverage.trends_weeks !== panel.rows.length) {
      ctx.addIssue({
        code: "custom",
        path: ["coverage", "trends_weeks"],
        message:
          `declared ${String(panel.coverage.trends_weeks)} weeks but ` +
          `rows contains ${String(panel.rows.length)}`,
      });
    }
  });

export function validatePanel(raw: unknown): PanelArtifact {
  return parseArtifact(panelSchema, raw, "panel");
}

// ---------------------------------------------------------------------------
// countries.json
// ---------------------------------------------------------------------------

const countriesSchema = z
  .object({
    schema_version: text,
    series: z.array(
      z.object({
        id: seriesId,
        label: text,
        short: text,
        is_country: flag,
        source_file: text,
        legacy_column: text,
      }),
    ),
    comparability: z.object({
      trends_normalisation: text,
      explanation: text,
      scale_free_metrics: textList,
      series_local_metrics: textList,
      forbidden_comparisons: textList,
      remedy: text,
    }),
  })
  .superRefine((countries, ctx) => {
    const present = new Set(countries.series.map((entry) => entry.id));
    for (const expected of SERIES_IDS) {
      if (!present.has(expected)) {
        ctx.addIssue({
          code: "custom",
          path: ["series"],
          message: `registry is missing series "${expected}"`,
        });
      }
    }
  });

export function validateCountries(raw: unknown): CountriesArtifact {
  return parseArtifact(countriesSchema, raw, "countries");
}

// ---------------------------------------------------------------------------
// metrics.json
// ---------------------------------------------------------------------------

const lagPointSchema = z.object({
  lag_weeks: integer,
  n: integer,
  pearson_r: finite,
  pearson_p: finite,
  spearman_rho: finite,
});

const correlationBundleSchema = z.object({
  lag_weeks: integer,
  n: integer,
  pearson_r: correlation,
  pearson_p: probability,
  spearman_rho: finite,
  spearman_p: finite,
  bootstrap_ci: intervalSchema,
  fisher_ci: intervalSchema,
  fit: z.object({
    slope: finite,
    intercept: finite,
    r_squared: finite,
    slope_stderr: finite,
    n: integer,
  }),
  significant_at_alpha: flag,
  alpha: finite,
  ci_includes_zero: flag,
  strength_label: strengthLabel,
  direction: direction,
  includes_partial_week: flag,
});

const specificationSchema = z.object({
  id: z.enum(["levels", "first_differences", "linear_detrended"]),
  description: text,
  n: integer,
  pearson_r: finite,
  pearson_p: finite,
  significant_at_alpha: flag,
});

const sensitivityVariantSchema = z
  .object({
    id: z.enum([
      "exclude_partial_weeks",
      "baseline_regime_only",
      "elevated_regime_only",
      "rank_based",
    ]),
    description: text,
    n: integer,
    pearson_r: finite.nullable(),
    pearson_p: finite.nullable(),
    delta_vs_primary: finite.nullable(),
    computable: flag,
    reason: text.nullable(),
  })
  .superRefine((variant, ctx) => {
    // A non-computable variant must not carry statistics, and a computable one
    // must. Either violation means the artifact is internally wrong.
    if (variant.computable && variant.pearson_r === null) {
      ctx.addIssue({
        code: "custom",
        path: ["pearson_r"],
        message: "computable variant must report a coefficient",
      });
    }
    if (!variant.computable && variant.pearson_r !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["pearson_r"],
        message: "non-computable variant must report null",
      });
    }
  });

const seriesMetricsSchema = z.object({
  id: seriesId,
  label: text,
  short: text,
  is_country: flag,
  primary: correlationBundleSchema,
  lag_profile: z.array(lagPointSchema),
  best_lag: lagPointSchema.nullable(),
  unrestricted_lag_maximum_is_negative: flag,
  trend_diagnostics: z.object({
    oil_vs_time_r: finite,
    interest_vs_time_r: finite,
    both_series_trend_same_direction: flag,
    specifications: z.array(specificationSchema),
    agreement: z.enum(["consistent", "significance_disagreement", "sign_disagreement"]),
    note: text,
  }),
  sensitivity: z.object({
    leave_one_out: z.object({
      baseline_r: finite,
      min_r: finite,
      max_r: finite,
      max_abs_delta: finite,
      most_influential_index: integer,
      sign_flips: flag,
      per_observation: z.array(
        z.object({
          index: integer,
          label: isoDate.nullable(),
          r_without: finite,
          delta: finite,
        }),
      ),
    }),
    variants: z.array(sensitivityVariantSchema),
  }),
  profile: z.object({
    // The two literals are the guard rails the presentation layer relies on:
    // series-local metrics must be flagged NOT comparable across series, and
    // scale-free metrics must be flagged comparable. A flipped flag would let
    // the invalid cross-market level comparison back in.
    series_local: z.object({
      mean_interest: finite,
      median_interest: finite,
      min_interest: finite,
      peak_value: finite,
      baseline_mean_interest: finite,
      elevated_mean_interest: finite,
      _comparable_across_series: z.literal(false, {
        error: "series-local metrics must be flagged as NOT comparable across series",
      }),
    }),
    scale_free: z.object({
      peak_week: isoDate,
      peak_week_ties: integer,
      baseline_to_peak_pct_change: finite,
      baseline_to_elevated_pct_change: finite,
      peak_lag_weeks: integer,
      _comparable_across_series: z.literal(true, {
        error: "scale-free metrics must be flagged as comparable across series",
      }),
    }),
  }),
  classification: z.object({
    strength: strengthLabel,
    direction: direction,
    significance: z.enum(["significant", "not_significant"]),
    robustness: z.enum(["fragile", "moderate", "robust"]),
    evidence_group: evidenceGroup,
    caveats: z.array(
      z.enum([
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
      ]),
    ),
  }),
});

const categoryReviewSchema = z.object({
  id: text,
  original_title: text,
  original_members: countryIds,
  data_supported_members: countryIds,
  unsupported_members: countryIds,
  verdict: z.enum(["supported", "partially_supported", "not_supported"]),
  requires_external_evidence: flag,
  basis: text,
});

/**
 * Full configuration recorded in `metrics.configuration`.
 *
 * `manifest.analytical_configuration` is a DIFFERENT, smaller shape. Modelling
 * them as one schema is a mistake this file exists to catch.
 */
const metricsConfigurationSchema = z.object({
  primary_lag_weeks: integer,
  lag_window_weeks: z.array(integer),
  min_pairs_for_lag: integer,
  confidence_level: finite,
  bootstrap_iterations: integer,
  bootstrap_seed: integer,
  significance_alpha: finite,
  litres_per_barrel: finite,
  include_partial_weeks_in_primary: flag,
  regime_rule: text,
  lag_sign_convention: text,
});

const metricsSchema = z
  .object({
    schema_version: text,
    configuration: metricsConfigurationSchema,
    global: z.object({
      oil: z.object({
        weeks: integer,
        first_week: isoDate,
        last_week: isoDate,
        mean_usd_per_barrel: finite,
        median_usd_per_barrel: finite,
        min_usd_per_barrel: finite,
        min_week: isoDate,
        max_usd_per_barrel: finite,
        max_week: isoDate,
        max_usd_per_litre: finite,
        total_pct_change_first_to_max: finite,
        partial_weeks: isoDates,
        weeks_with_imputed_days: z.array(
          z.object({ week_start: isoDate, imputed_days: integer }),
        ),
      }),
      regime: z.object({
        rule: text,
        onset_week: isoDate,
        onset_pct_change: finite,
        baseline_weeks: integer,
        elevated_weeks: integer,
        baseline_max_usd_per_barrel: finite,
        elevated_min_usd_per_barrel: finite,
        regimes_separated: flag,
      }),
      peak_dispersion: z.object({
        peaks: z.record(countryId, isoDate),
        distinct_weeks: integer,
        distinct_months: textList,
        span_weeks: integer,
        synchronised_within_one_month: flag,
      }),
      worldwide: seriesMetricsSchema.nullable(),
      // A subset of the evidence groups: only groups with members appear.
      evidence_groups: z.partialRecord(evidenceGroup, countryIds),
    }),
    series: bySeries(seriesMetricsSchema),
    countries: countryIds,
    category_review: z.array(categoryReviewSchema),
    interpretation_vocabulary: z.object({
      strength: textList,
      robustness: textList,
      evidence_group: textList,
      note: text,
    }),
  })
  .superRefine((metrics, ctx) => {
    for (const [id, entry] of Object.entries(metrics.series)) {
      if (entry.id !== id) {
        ctx.addIssue({
          code: "custom",
          path: ["series", id, "id"],
          message: `series key "${id}" disagrees with id "${entry.id}"`,
        });
      }
    }
  });

export function validateMetrics(raw: unknown): MetricsArtifact {
  return parseArtifact(metricsSchema, raw, "metrics");
}

// ---------------------------------------------------------------------------
// claims.json
// ---------------------------------------------------------------------------

const claimSchema = z
  .object({
    id: text,
    origin: text,
    original_text: text,
    status: z.enum([
      "supported_by_data",
      "overstated_relative_to_data",
      "contradicted_by_data",
      "invalid_method",
      "external_unverifiable_from_dataset",
      "beyond_data_window",
      "describes_work_not_present",
    ]),
    disposition: z.enum(["retain", "rewrite", "remove", "requires_citation"]),
    reason: text,
    evidence: textList,
    suggested_statement: text.nullable(),
    sources: textList,
    publishable_as_fact: flag,
  })
  .superRefine((claim, ctx) => {
    // The publishability gate the UI depends on, asserted at the boundary: a
    // claim with neither evidence nor a source must never be publishable.
    if (
      claim.publishable_as_fact &&
      claim.evidence.length === 0 &&
      claim.sources.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["publishable_as_fact"],
        message: "claim has no evidence and no sources, so it cannot be publishable as fact",
      });
    }
  });

const claimsSchema = z
  .object({
    schema_version: text,
    summary: claimsSummarySchema,
    policy: z.object({
      unverifiable_external_claims: text,
      publishable_rule: text,
    }),
    claims: z.array(claimSchema),
  })
  .superRefine((artifact, ctx) => {
    if (artifact.summary.total !== artifact.claims.length) {
      ctx.addIssue({
        code: "custom",
        path: ["summary", "total"],
        message:
          `summary declares ${String(artifact.summary.total)} claims but ` +
          `the list contains ${String(artifact.claims.length)}`,
      });
    }
  });

export function validateClaims(raw: unknown): ClaimsArtifact {
  return parseArtifact(claimsSchema, raw, "claims");
}

// ---------------------------------------------------------------------------
// manifest.json
// ---------------------------------------------------------------------------

/** RFC 3339 UTC with a single trailing `Z`. `...+00:00Z` is malformed. */
const rfc3339Utc = text.regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
  "expected RFC 3339 UTC with a single 'Z' (YYYY-MM-DDTHH:MM:SSZ)",
);

/**
 * Reproducibility subset recorded in `manifest.analytical_configuration`.
 * Deliberately not identical to `metrics.configuration`.
 */
const manifestConfigurationSchema = z.object({
  primary_lag_weeks: integer,
  lag_window_weeks: z.array(integer),
  confidence_level: finite,
  bootstrap_iterations: integer,
  bootstrap_seed: integer,
  litres_per_barrel: finite,
  regime_rule: text,
  trends_normalisation: text,
});

const manifestSchema = z.object({
  schema_version: text,
  pipeline_version: text,
  generated_at: rfc3339Utc,
  _determinism_note: text,
  content_hash: sha256,
  sources: z.array(
    z.object({
      id: text,
      name: text,
      publisher: text,
      url: text,
      series_id: text.nullable(),
      units: text,
      frequency: text,
      notes: text,
    }),
  ),
  source_files: z.record(text, sha256),
  artifacts: z.record(text, sha256),
  coverage: coverageSchema,
  analytical_configuration: manifestConfigurationSchema,
  claims_summary: claimsSummarySchema,
});

export function validateManifest(raw: unknown): ManifestArtifact {
  return parseArtifact(manifestSchema, raw, "manifest");
}
