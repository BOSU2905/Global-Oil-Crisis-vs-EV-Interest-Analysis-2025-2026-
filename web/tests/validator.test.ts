/**
 * Rejection tests for the boundary validator.
 *
 * Each test deep-clones a real artifact, breaks exactly one thing, and asserts
 * the validator refuses it with a path that names the offending field. Failing
 * loudly at the boundary is the whole purpose: the original project's data bug
 * survived because a malformed read fell through silently.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { readRawArtifacts } from "../src/data/load-node.ts";
import { createArtifactBundle, ContractError, type RawArtifacts } from "../src/data/index.ts";
import {
  validateClaims,
  validateCountries,
  validateManifest,
  validateMetrics,
  validatePanel,
} from "../src/data/validate.ts";

const pristine = readRawArtifacts();

/** Deep clone so a mutation in one test cannot leak into another. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

function rawPanel(): Record<string, unknown> {
  return clone(pristine.panel) as Record<string, unknown>;
}
function rawMetrics(): Record<string, unknown> {
  return clone(pristine.metrics) as Record<string, unknown>;
}
function rawCountries(): Record<string, unknown> {
  return clone(pristine.countries) as Record<string, unknown>;
}
function rawClaims(): Record<string, unknown> {
  return clone(pristine.claims) as Record<string, unknown>;
}
function rawManifest(): Record<string, unknown> {
  return clone(pristine.manifest) as Record<string, unknown>;
}

/** Assert the validator throws a ContractError whose path contains `fragment`. */
function rejects(fn: () => unknown, fragment: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof ContractError, `expected ContractError, got ${String(error)}`);
    assert.ok(
      error.path.includes(fragment),
      `expected path to contain "${fragment}", got "${error.path}"`,
    );
    return true;
  });
}

// ---------------------------------------------------------------------------
// Baseline: the real artifacts pass
// ---------------------------------------------------------------------------

test("unmodified artifacts validate cleanly", () => {
  assert.doesNotThrow(() => createArtifactBundle(pristine));
});

// ---------------------------------------------------------------------------
// Missing required fields
// ---------------------------------------------------------------------------

test("rejects a missing top-level field", () => {
  const panel = rawPanel();
  delete panel["coverage"];
  rejects(() => validatePanel(panel), "panel.coverage");
});

test("rejects a missing nested field", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, Record<string, unknown>>;
  delete series["us"]!["primary"];
  rejects(() => validateMetrics(metrics), "metrics.series.us.primary");
});

test("rejects a missing field inside an array element", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as Record<string, unknown>[];
  delete rows[0]!["week_start"];
  rejects(() => validatePanel(panel), "panel.rows[0].week_start");
});

// ---------------------------------------------------------------------------
// Wrong primitive types
// ---------------------------------------------------------------------------

test("rejects a number where a string is required", () => {
  const panel = rawPanel();
  panel["schema_version"] = 1;
  rejects(() => validatePanel(panel), "panel.schema_version");
});

test("rejects a numeric string where a number is required", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, Record<string, Record<string, unknown>>>;
  series["us"]!["primary"]!["pearson_r"] = "0.7466";
  rejects(() => validateMetrics(metrics), "metrics.series.us.primary.pearson_r");
});

test("rejects a non-boolean where a boolean is required", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as { oil: Record<string, unknown> | null }[];
  const row = rows.find((r) => r.oil !== null)!;
  row.oil!["is_partial_week"] = "false";
  rejects(() => validatePanel(panel), "is_partial_week");
});

test("rejects an object where an array is required", () => {
  const panel = rawPanel();
  panel["rows"] = { nope: true };
  rejects(() => validatePanel(panel), "panel.rows");
});

test("rejects a non-integer where an integer is required", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, Record<string, Record<string, unknown>>>;
  series["us"]!["primary"]!["n"] = 30.5;
  rejects(() => validateMetrics(metrics), "metrics.series.us.primary.n");
});

// ---------------------------------------------------------------------------
// Non-finite numbers
// ---------------------------------------------------------------------------

test("rejects NaN", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, Record<string, Record<string, unknown>>>;
  series["worldwide"]!["primary"]!["pearson_r"] = Number.NaN;
  rejects(() => validateMetrics(metrics), "metrics.series.worldwide.primary.pearson_r");
});

test("rejects positive Infinity", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, Record<string, Record<string, unknown>>>;
  series["worldwide"]!["primary"]!["spearman_rho"] = Number.POSITIVE_INFINITY;
  rejects(() => validateMetrics(metrics), "spearman_rho");
});

test("rejects negative Infinity", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as { oil: Record<string, unknown> | null }[];
  const row = rows.find((r) => r.oil !== null)!;
  row.oil!["brent_usd_per_barrel_exact"] = Number.NEGATIVE_INFINITY;
  rejects(() => validatePanel(panel), "brent_usd_per_barrel_exact");
});

test("NaN is reported as NaN, not as a generic type error", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as { interest: Record<string, unknown> }[];
  rows[0]!.interest["us"] = Number.NaN;
  assert.throws(
    () => validatePanel(panel),
    (error: unknown) => error instanceof ContractError && /NaN/.test(error.message),
  );
});

// ---------------------------------------------------------------------------
// Malformed dates
// ---------------------------------------------------------------------------

test("rejects a wrongly formatted date", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as Record<string, unknown>[];
  rows[0]!["week_start"] = "31/08/2025";
  rejects(() => validatePanel(panel), "panel.rows[0].week_start");
});

test("rejects a date that does not exist on the calendar", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as Record<string, unknown>[];
  rows[0]!["week_start"] = "2026-02-30";
  rejects(() => validatePanel(panel), "panel.rows[0].week_start");
});

test("rejects a datetime where a plain date is required", () => {
  const metrics = rawMetrics();
  const global = metrics["global"] as Record<string, Record<string, unknown>>;
  global["regime"]!["onset_week"] = "2026-03-01T00:00:00Z";
  rejects(() => validateMetrics(metrics), "onset_week");
});

test("rejects a manifest timestamp with a doubled timezone designator", () => {
  const manifest = rawManifest();
  manifest["generated_at"] = "2026-09-14T16:30:28+00:00Z";
  rejects(() => validateManifest(manifest), "manifest.generated_at");
});

// ---------------------------------------------------------------------------
// Invalid identifiers
// ---------------------------------------------------------------------------

test("rejects a non-canonical country id in the country list", () => {
  const metrics = rawMetrics();
  metrics["countries"] = ["indonesia", "malaysia", "norway", "singapore", "usa"];
  rejects(() => validateMetrics(metrics), "metrics.countries[4]");
});

test("rejects an unknown series key in the metrics map", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, unknown>;
  series["france"] = series["us"];
  rejects(() => validateMetrics(metrics), "metrics.series");
});

test("rejects a missing series in the metrics map", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, unknown>;
  delete series["norway"];
  rejects(() => validateMetrics(metrics), "metrics.series.norway");
});

test("rejects an unknown series id in the registry", () => {
  const countries = rawCountries();
  const series = countries["series"] as Record<string, unknown>[];
  series[0]!["id"] = "atlantis";
  rejects(() => validateCountries(countries), "countries.series[0].id");
});

test("rejects an unknown country id in peak dispersion", () => {
  const metrics = rawMetrics();
  const global = metrics["global"] as Record<string, Record<string, unknown>>;
  const peaks = global["peak_dispersion"]!["peaks"] as Record<string, unknown>;
  peaks["america"] = peaks["us"];
  delete peaks["us"];
  rejects(() => validateMetrics(metrics), "peak_dispersion.peaks");
});

test("rejects an unknown interest key on a panel row", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as { interest: Record<string, unknown> }[];
  rows[0]!.interest["china"] = 42;
  rejects(() => validatePanel(panel), "panel.rows[0].interest");
});

// ---------------------------------------------------------------------------
// Malformed metric structures
// ---------------------------------------------------------------------------

test("rejects a correlation outside [-1, 1]", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, Record<string, Record<string, unknown>>>;
  series["us"]!["primary"]!["pearson_r"] = 1.4;
  rejects(() => validateMetrics(metrics), "pearson_r");
});

test("rejects a p-value outside [0, 1]", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, Record<string, Record<string, unknown>>>;
  series["us"]!["primary"]!["pearson_p"] = 1.5;
  rejects(() => validateMetrics(metrics), "pearson_p");
});

test("rejects an inverted confidence interval", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<
    string,
    Record<string, Record<string, Record<string, unknown>>>
  >;
  series["us"]!["primary"]!["bootstrap_ci"]!["low"] = 0.99;
  series["us"]!["primary"]!["bootstrap_ci"]!["high"] = 0.1;
  rejects(() => validateMetrics(metrics), "bootstrap_ci");
});

test("rejects an unknown evidence group", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, Record<string, Record<string, unknown>>>;
  series["us"]!["classification"]!["evidence_group"] = "very_strong_causation";
  rejects(() => validateMetrics(metrics), "evidence_group");
});

test("rejects an unknown caveat code", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<string, Record<string, Record<string, unknown>>>;
  series["us"]!["classification"]!["caveats"] = ["small_sample", "totally_made_up"];
  rejects(() => validateMetrics(metrics), "caveats[1]");
});

test("rejects an unknown specification id", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<
    string,
    Record<string, Record<string, Record<string, unknown>[]>>
  >;
  series["us"]!["trend_diagnostics"]!["specifications"]![0]!["id"] = "magic";
  rejects(() => validateMetrics(metrics), "specifications[0].id");
});

test("rejects an interest score outside 0-100", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as { interest: Record<string, unknown> }[];
  rows[0]!.interest["norway"] = 140;
  rejects(() => validatePanel(panel), "panel.rows[0].interest.norway");
});

test("rejects is_partial_week contradicting trading_days", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as { oil: Record<string, unknown> | null }[];
  const row = rows.find((r) => r.oil !== null && r.oil["trading_days"] === 5)!;
  row.oil!["is_partial_week"] = true;
  rejects(() => validatePanel(panel), "panel.rows");
});

test("rejects a row where oil is present but regime is null", () => {
  const panel = rawPanel();
  const rows = panel["rows"] as Record<string, unknown>[];
  const row = rows.find((r) => r["oil"] !== null)!;
  row["regime"] = null;
  rejects(() => validatePanel(panel), "panel.rows");
});

test("rejects a non-computable variant that still reports a coefficient", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<
    string,
    Record<string, Record<string, Record<string, unknown>[]>>
  >;
  const variant = series["us"]!["sensitivity"]!["variants"]![0]!;
  variant["computable"] = false;
  rejects(() => validateMetrics(metrics), "pearson_r");
});

test("rejects a computable variant reporting a null coefficient", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<
    string,
    Record<string, Record<string, Record<string, unknown>[]>>
  >;
  const variant = series["us"]!["sensitivity"]!["variants"]![0]!;
  variant["pearson_r"] = null;
  rejects(() => validateMetrics(metrics), "pearson_r");
});

test("rejects a flipped comparability flag on series-local metrics", () => {
  const metrics = rawMetrics();
  const series = metrics["series"] as Record<
    string,
    Record<string, Record<string, Record<string, unknown>>>
  >;
  series["us"]!["profile"]!["series_local"]!["_comparable_across_series"] = true;
  rejects(() => validateMetrics(metrics), "_comparable_across_series");
});

// ---------------------------------------------------------------------------
// Claims and manifest integrity
// ---------------------------------------------------------------------------

test("rejects an uncited claim marked publishable as fact", () => {
  const claims = rawClaims();
  const list = claims["claims"] as Record<string, unknown>[];
  const uncited = list.find(
    (c) =>
      (c["sources"] as unknown[]).length === 0 && (c["evidence"] as unknown[]).length === 0,
  )!;
  uncited["publishable_as_fact"] = true;
  rejects(() => validateClaims(claims), "publishable_as_fact");
});

test("rejects a claim summary total that disagrees with the list", () => {
  const claims = rawClaims();
  const summary = claims["summary"] as Record<string, unknown>;
  summary["total"] = 999;
  rejects(() => validateClaims(claims), "claims.summary.total");
});

test("rejects an unknown claim disposition", () => {
  const claims = rawClaims();
  const list = claims["claims"] as Record<string, unknown>[];
  list[0]!["disposition"] = "publish_anyway";
  rejects(() => validateClaims(claims), "disposition");
});

test("rejects a malformed sha256 digest", () => {
  const manifest = rawManifest();
  const artifacts = manifest["artifacts"] as Record<string, unknown>;
  artifacts["panel.json"] = "not-a-digest";
  rejects(() => validateManifest(manifest), "manifest.artifacts");
});

test("rejects coverage that disagrees with the panel row count", () => {
  const panel = rawPanel();
  const coverage = panel["coverage"] as Record<string, unknown>;
  coverage["trends_weeks"] = 99;
  rejects(() => validatePanel(panel), "panel.coverage.trends_weeks");
});

// ---------------------------------------------------------------------------
// Cross-artifact integrity
// ---------------------------------------------------------------------------

test("rejects a manifest whose coverage disagrees with the panel", () => {
  const raw = clone(pristine) as { manifest: Record<string, Record<string, unknown>> };
  raw.manifest["coverage"]!["oil_weeks"] = 12;
  rejects(() => createArtifactBundle(raw as unknown as RawArtifacts), "manifest.coverage");
});

test("rejects a peak week that is not a real panel week", () => {
  const raw = clone(pristine) as {
    metrics: { series: Record<string, { profile: { scale_free: Record<string, unknown> } }> };
  };
  raw.metrics.series["us"]!.profile.scale_free["peak_week"] = "2030-01-06";
  rejects(() => createArtifactBundle(raw as unknown as RawArtifacts), "peak_week");
});

test("rejects a regime onset that is not a real panel week", () => {
  const raw = clone(pristine) as {
    metrics: { global: { regime: Record<string, unknown> } };
  };
  raw.metrics.global.regime["onset_week"] = "2030-01-06";
  rejects(() => createArtifactBundle(raw as unknown as RawArtifacts), "onset_week");
});

test("rejects a partial week listed in coverage but not flagged on its row", () => {
  const raw = clone(pristine) as {
    panel: { coverage: Record<string, unknown>; rows: Record<string, unknown>[] };
  };
  const complete = raw.panel.rows.find(
    (r) => r["oil"] !== null && (r["oil"] as Record<string, unknown>)["trading_days"] === 5,
  )!;
  raw.panel.coverage["partial_weeks"] = [complete["week_start"]];
  rejects(() => createArtifactBundle(raw as unknown as RawArtifacts), "partial_weeks");
});

// ---------------------------------------------------------------------------
// Error quality
// ---------------------------------------------------------------------------

test("errors are ContractError and name the failing path", () => {
  const panel = rawPanel();
  delete panel["rows"];
  try {
    validatePanel(panel);
    assert.fail("expected a throw");
  } catch (error) {
    assert.ok(error instanceof ContractError);
    assert.equal(error.name, "ContractError");
    assert.equal(error.path, "panel.rows");
    assert.match(error.message, /panel\.rows/);
  }
});

test("rejects a null artifact outright", () => {
  rejects(() => validatePanel(null), "panel");
  rejects(() => validateMetrics(undefined), "metrics");
  rejects(() => validateClaims("nope"), "claims");
  rejects(() => validateCountries([]), "countries");
  rejects(() => validateManifest(42), "manifest");
});
