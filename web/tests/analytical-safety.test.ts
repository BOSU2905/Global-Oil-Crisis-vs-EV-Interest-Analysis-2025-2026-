/**
 * ANALYTICAL SAFETY
 *
 * The hard rule of this architecture is that the presentation layer never
 * computes a statistic. This file enforces it three ways:
 *
 *   1. STATIC   -- the data layer's source contains no statistical computation.
 *   2. IDENTITY -- accessors return artifact values byte-for-byte.
 *   3. MUTATION -- changing an artifact number changes what the UI would show,
 *                  proving the value is read rather than derived.
 *
 * (3) is the strongest of the three: if any accessor recomputed a coefficient,
 * an absurd injected value could not survive the round trip.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readRawArtifacts } from "../src/data/load-node.ts";
import {
  COUNTRY_IDS,
  SERIES_IDS,
  createArtifactBundle,
  getCountryMetrics,
  getGlobalMetrics,
  getSeriesMetrics,
  type RawArtifacts,
} from "../src/data/index.ts";

const here = fileURLToPath(import.meta.url);
const webRoot = join(here.slice(0, here.lastIndexOf("/")), "..");
const dataLayerDir = join(webRoot, "src", "data");

const raw = readRawArtifacts();
const bundle = createArtifactBundle(raw);

// ---------------------------------------------------------------------------
// 1. Static: no statistical computation in the data layer source
// ---------------------------------------------------------------------------

function dataLayerSources(): { file: string; source: string }[] {
  return readdirSync(dataLayerDir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => ({ file: name, source: readFileSync(join(dataLayerDir, name), "utf8") }));
}

test("data layer source files exist and are readable", () => {
  const files = dataLayerSources()
    .map((f) => f.file)
    .sort();
  assert.deepEqual(files, [
    "artifact-types.ts",
    "artifacts.ts",
    "index.ts",
    "load-node.ts",
    "validate.ts",
  ]);
});

test("data layer contains no statistical function implementations", () => {
  // Names that would indicate a statistic being computed rather than read.
  const forbidden = [
    "Math.sqrt",
    "Math.pow",
    "Math.log",
    "Math.exp",
    "Math.abs",
    "Math.hypot",
    "pearsonr",
    "computePearson",
    "computeSpearman",
    "calculateCorrelation",
    "correlate(",
    "bootstrap(",
    "confidenceInterval(",
    "pValue(",
    "tDistribution",
    "linearRegression",
    "leastSquares",
    "detrend(",
    "firstDifference(",
    "classifySeries",
    "deriveClassification",
  ];
  const violations: string[] = [];
  for (const { file, source } of dataLayerSources()) {
    // Ignore comment lines: prose about statistics is expected and desirable.
    const code = source
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      })
      .join("\n");
    for (const needle of forbidden) {
      if (code.includes(needle)) violations.push(`${file}: ${needle}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("data layer performs no arithmetic on artifact statistics", () => {
  // Any of these identifiers appearing next to an arithmetic operator would
  // mean a displayed statistic is being derived in TypeScript.
  const statFields = [
    "pearson_r",
    "pearson_p",
    "spearman_rho",
    "spearman_p",
    "baseline_r",
    "delta_vs_primary",
    "r_squared",
    "slope",
    "onset_pct_change",
    "baseline_to_peak_pct_change",
    "baseline_to_elevated_pct_change",
  ];
  const arithmetic = /[+\-*/]\s*$|^\s*[+*/]/;
  const violations: string[] = [];
  for (const { file, source } of dataLayerSources()) {
    source.split("\n").forEach((line, index) => {
      const t = line.trim();
      if (t.startsWith("*") || t.startsWith("//") || t.startsWith("/*")) return;
      for (const stat of statFields) {
        if (!t.includes(stat)) continue;
        // Split around the field name and look for adjacent arithmetic.
        const parts = t.split(stat);
        for (let i = 0; i < parts.length - 1; i += 1) {
          const before = parts[i] ?? "";
          const after = parts[i + 1] ?? "";
          if (arithmetic.test(before) || /^\s*[+*/]/.test(after)) {
            violations.push(`${file}:${index + 1}: ${t}`);
          }
        }
      }
    });
  }
  assert.deepEqual(violations, []);
});

// ---------------------------------------------------------------------------
// 2. Identity: accessors return exactly what the JSON contains
// ---------------------------------------------------------------------------

test("every displayed statistic is identical to the artifact value", () => {
  const rawMetrics = raw.metrics as {
    series: Record<
      string,
      {
        primary: {
          pearson_r: number;
          pearson_p: number;
          spearman_rho: number;
          spearman_p: number;
          bootstrap_ci: { low: number; high: number };
          fisher_ci: { low: number; high: number };
          fit: { slope: number; intercept: number; r_squared: number };
        };
        profile: { scale_free: { peak_week: string; peak_lag_weeks: number } };
        classification: { evidence_group: string; robustness: string };
      }
    >;
  };

  for (const id of SERIES_IDS) {
    const got = getSeriesMetrics(bundle, id);
    const want = rawMetrics.series[id]!;

    assert.equal(got.primary.pearson_r, want.primary.pearson_r);
    assert.equal(got.primary.pearson_p, want.primary.pearson_p);
    assert.equal(got.primary.spearman_rho, want.primary.spearman_rho);
    assert.equal(got.primary.spearman_p, want.primary.spearman_p);
    assert.equal(got.primary.bootstrap_ci.low, want.primary.bootstrap_ci.low);
    assert.equal(got.primary.bootstrap_ci.high, want.primary.bootstrap_ci.high);
    assert.equal(got.primary.fisher_ci.low, want.primary.fisher_ci.low);
    assert.equal(got.primary.fisher_ci.high, want.primary.fisher_ci.high);
    assert.equal(got.primary.fit.slope, want.primary.fit.slope);
    assert.equal(got.primary.fit.r_squared, want.primary.fit.r_squared);
    assert.equal(got.profile.scale_free.peak_week, want.profile.scale_free.peak_week);
    assert.equal(got.profile.scale_free.peak_lag_weeks, want.profile.scale_free.peak_lag_weeks);
    assert.equal(got.classification.evidence_group, want.classification.evidence_group);
    assert.equal(got.classification.robustness, want.classification.robustness);
  }
});

test("global metrics are passed through unchanged", () => {
  const rawGlobal = (raw.metrics as { global: Record<string, Record<string, unknown>> }).global;
  const got = getGlobalMetrics(bundle);
  assert.equal(got.regime.onset_week, rawGlobal["regime"]!["onset_week"]);
  assert.equal(got.regime.onset_pct_change, rawGlobal["regime"]!["onset_pct_change"]);
  assert.equal(got.oil.max_usd_per_barrel, rawGlobal["oil"]!["max_usd_per_barrel"]);
  assert.equal(got.oil.max_week, rawGlobal["oil"]!["max_week"]);
  assert.equal(
    got.peak_dispersion.synchronised_within_one_month,
    rawGlobal["peak_dispersion"]!["synchronised_within_one_month"],
  );
});

// ---------------------------------------------------------------------------
// 3. Mutation: injected values survive, proving nothing is recomputed
// ---------------------------------------------------------------------------

function withInjectedMetrics(
  mutate: (series: Record<string, Record<string, Record<string, unknown>>>) => void,
): RawArtifacts {
  const cloned = structuredClone(raw) as {
    metrics: { series: Record<string, Record<string, Record<string, unknown>>> };
  };
  mutate(cloned.metrics.series);
  return cloned as unknown as RawArtifacts;
}

test("an injected correlation is returned verbatim, not recalculated", () => {
  // 0.111 is not the real US coefficient. If anything recomputed it from the
  // panel, this assertion would fail.
  const injected = withInjectedMetrics((series) => {
    series["us"]!["primary"]!["pearson_r"] = 0.111;
  });
  const mutated = createArtifactBundle(injected);
  assert.equal(getCountryMetrics(mutated, "us").primary.pearson_r, 0.111);
  // And the pristine bundle is unaffected -- no shared mutable state.
  assert.notEqual(getCountryMetrics(bundle, "us").primary.pearson_r, 0.111);
});

test("an injected p-value and interval are returned verbatim", () => {
  const injected = withInjectedMetrics((series) => {
    series["norway"]!["primary"]!["pearson_p"] = 0.5;
    (series["norway"]!["primary"]!["bootstrap_ci"] as Record<string, unknown>)["low"] = -0.9;
    (series["norway"]!["primary"]!["bootstrap_ci"] as Record<string, unknown>)["high"] = 0.9;
  });
  const mutated = createArtifactBundle(injected);
  const primary = getCountryMetrics(mutated, "norway").primary;
  assert.equal(primary.pearson_p, 0.5);
  assert.equal(primary.bootstrap_ci.low, -0.9);
  assert.equal(primary.bootstrap_ci.high, 0.9);
});

test("an injected classification is returned verbatim, not re-derived", () => {
  const injected = withInjectedMetrics((series) => {
    series["indonesia"]!["classification"]!["robustness"] = "robust";
    series["indonesia"]!["classification"]!["evidence_group"] = "robust_positive_association";
  });
  const mutated = createArtifactBundle(injected);
  const classification = getCountryMetrics(mutated, "indonesia").classification;
  assert.equal(classification.robustness, "robust");
  assert.equal(classification.evidence_group, "robust_positive_association");
});

test("an injected peak week is returned verbatim (only integrity-checked)", () => {
  // Must remain a real panel week, because cross-artifact integrity checks it.
  const realWeek = bundle.panel.rows[3]!.week_start;
  const injected = withInjectedMetrics((series) => {
    (series["malaysia"]!["profile"]!["scale_free"] as Record<string, unknown>)["peak_week"] =
      realWeek;
  });
  const mutated = createArtifactBundle(injected);
  assert.equal(getCountryMetrics(mutated, "malaysia").profile.scale_free.peak_week, realWeek);
});

test("the layer never re-derives a peak from the panel", () => {
  // Confirm the reported peak is simply the artifact's value: deliberately point
  // it at a week whose interest is NOT the maximum, and see it survive.
  const rows = bundle.panel.rows;
  const country = "singapore" as const;
  const peakValue = getCountryMetrics(bundle, country).profile.series_local.peak_value;
  const notThePeak = rows.find((row) => row.interest[country] < peakValue)!;
  const injected = withInjectedMetrics((series) => {
    (series[country]!["profile"]!["scale_free"] as Record<string, unknown>)["peak_week"] =
      notThePeak.week_start;
  });
  const mutated = createArtifactBundle(injected);
  assert.equal(
    getCountryMetrics(mutated, country).profile.scale_free.peak_week,
    notThePeak.week_start,
    "a recomputed peak would have overridden the injected value",
  );
});

// ---------------------------------------------------------------------------
// Guard rails the presentation layer will depend on
// ---------------------------------------------------------------------------

test("no accessor exposes a cross-series ranking", () => {
  // A ranking helper would be the natural place for the invalid comparison the
  // original project made, so the module must not offer one.
  const surface = readFileSync(join(dataLayerDir, "index.ts"), "utf8");
  for (const banned of ["rank", "mostEnthusiastic", "sortByInterest", "topCountry", "leader"]) {
    assert.ok(!surface.includes(banned), `public surface exposes "${banned}"`);
  }
});

test("assertComparableAcrossSeries rejects a series-local metric", async () => {
  const { assertComparableAcrossSeries } = await import("../src/data/index.ts");
  assert.throws(() => assertComparableAcrossSeries(bundle, "mean_interest"));
  assert.doesNotThrow(() => assertComparableAcrossSeries(bundle, "pearson_r"));
});

test("all five countries are present so no market can be quietly dropped", () => {
  assert.equal(COUNTRY_IDS.length, 5);
  for (const id of COUNTRY_IDS) {
    assert.ok(getCountryMetrics(bundle, id));
  }
});
