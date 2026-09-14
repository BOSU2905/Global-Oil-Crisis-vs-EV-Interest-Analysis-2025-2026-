/**
 * Contract tests against the REAL generated artifacts.
 *
 * These assert that the committed artifacts satisfy the contract and that the
 * accessors return exactly what the artifacts contain. They intentionally do
 * NOT assert specific analytical values beyond identity checks -- pinning
 * coefficients here would duplicate the Python test suite, which already owns
 * that, and would make an intentional pipeline change fail in two places.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { loadArtifactBundle, readRawArtifacts } from "../src/data/load-node.ts";
import {
  ARTIFACT_FILENAMES,
  COUNTRY_IDS,
  SERIES_IDS,
  getAllCountryMetrics,
  getCategoryReviews,
  getClaim,
  getClaims,
  getClaimsRequiringCitation,
  getComparability,
  getCountryMetrics,
  getEvidenceGroup,
  getGlobalMetrics,
  getPanelRow,
  getPanelRows,
  getPanelRowsWithOil,
  getPublishableClaims,
  getRegistryEntry,
  getSeriesLabel,
  getSeriesMetrics,
  getWorldwideMetrics,
  type ArtifactName,
} from "../src/data/index.ts";

const bundle = loadArtifactBundle();
const raw = readRawArtifacts();

// ---------------------------------------------------------------------------
// The artifacts load
// ---------------------------------------------------------------------------

test("all five artifacts are present, parse, and validate", () => {
  const names: ArtifactName[] = ["panel", "countries", "metrics", "claims", "manifest"];
  for (const name of names) {
    assert.ok(raw[name], `${ARTIFACT_FILENAMES[name]} did not parse`);
  }
  assert.ok(bundle.panel);
  assert.ok(bundle.countries);
  assert.ok(bundle.metrics);
  assert.ok(bundle.claims);
  assert.ok(bundle.manifest);
});

test("panel row count agrees with declared coverage", () => {
  assert.equal(getPanelRows(bundle).length, bundle.panel.coverage.trends_weeks);
});

test("every panel week key is a Sunday, ascending, exactly 7 days apart", () => {
  const rows = getPanelRows(bundle);
  let previous: number | null = null;
  for (const row of rows) {
    const day = new Date(`${row.week_start}T00:00:00Z`);
    assert.equal(day.getUTCDay(), 0, `${row.week_start} is not a Sunday`);
    const time = day.getTime();
    if (previous !== null) {
      assert.equal(
        time - previous,
        7 * 86_400_000,
        `gap before ${row.week_start} is not 7 days`,
      );
    }
    previous = time;
  }
});

test("week_end is always six days after week_start", () => {
  for (const row of getPanelRows(bundle)) {
    const start = new Date(`${row.week_start}T00:00:00Z`).getTime();
    const end = new Date(`${row.week_end}T00:00:00Z`).getTime();
    assert.equal(end - start, 6 * 86_400_000, `bad span on ${row.week_start}`);
  }
});

test("every numeric value in every artifact is finite", () => {
  const offenders: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) offenders.push(`${path} = ${String(value)}`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`);
    }
  };
  for (const name of Object.keys(raw) as ArtifactName[]) walk(raw[name], name);
  assert.deepEqual(offenders, []);
});

// ---------------------------------------------------------------------------
// Canonical identifiers
// ---------------------------------------------------------------------------

test("canonical country ids are preserved across all artifacts", () => {
  assert.deepEqual([...bundle.metrics.countries].sort(), [...COUNTRY_IDS].sort());
  assert.deepEqual(Object.keys(bundle.metrics.series).sort(), [...SERIES_IDS].sort());
  assert.deepEqual(Object.keys(bundle.panel.rows[0]!.interest).sort(), [...SERIES_IDS].sort());
  assert.deepEqual(
    Object.keys(bundle.metrics.global.peak_dispersion.peaks).sort(),
    [...COUNTRY_IDS].sort(),
  );
});

test("the United States uses the canonical id and label", () => {
  assert.equal(getSeriesLabel(bundle, "us"), "United States");
  assert.equal(getRegistryEntry(bundle, "us").id, "us");
  // The original project used US_/USA/America interchangeably.
  const labels = bundle.countries.series.map((entry) => entry.label);
  assert.ok(!labels.includes("USA"));
  assert.ok(!labels.includes("America"));
});

test("registry marks exactly one non-country series", () => {
  const aggregates = bundle.countries.series.filter((entry) => !entry.is_country);
  assert.equal(aggregates.length, 1);
  assert.equal(aggregates[0]!.id, "worldwide");
});

// ---------------------------------------------------------------------------
// Accessors return artifact values unchanged
// ---------------------------------------------------------------------------

test("accessors return the artifact value, not a recomputed one", () => {
  const rawMetrics = raw.metrics as {
    series: Record<string, { primary: Record<string, number> }>;
  };
  for (const id of SERIES_IDS) {
    const viaAccessor = getSeriesMetrics(bundle, id).primary;
    const viaRawJson = rawMetrics.series[id]!.primary;
    assert.equal(viaAccessor.pearson_r, viaRawJson.pearson_r);
    assert.equal(viaAccessor.pearson_p, viaRawJson.pearson_p);
    assert.equal(viaAccessor.spearman_rho, viaRawJson.spearman_rho);
    assert.equal(viaAccessor.n, viaRawJson.n);
  }
});

test("country accessors cover every country in registry order", () => {
  const all = getAllCountryMetrics(bundle);
  assert.equal(all.length, COUNTRY_IDS.length);
  assert.deepEqual(
    all.map((m) => m.id),
    [...bundle.metrics.countries],
  );
  for (const id of COUNTRY_IDS) {
    assert.equal(getCountryMetrics(bundle, id).id, id);
  }
});

test("worldwide is reachable and flagged as not a country", () => {
  assert.equal(getWorldwideMetrics(bundle).id, "worldwide");
  assert.equal(getWorldwideMetrics(bundle).is_country, false);
});

test("panel lookups behave", () => {
  const first = getPanelRows(bundle)[0]!;
  assert.equal(getPanelRow(bundle, first.week_start)?.week_start, first.week_start);
  assert.equal(getPanelRow(bundle, "1999-01-03"), undefined);
});

// ---------------------------------------------------------------------------
// Nullability the UI must handle
// ---------------------------------------------------------------------------

test("weeks without oil are retained rather than dropped", () => {
  const withoutOil = getPanelRows(bundle).filter((row) => row.oil === null);
  assert.equal(withoutOil.length, bundle.panel.coverage.weeks_without_oil.length);
  assert.deepEqual(
    withoutOil.map((row) => row.week_start),
    [...bundle.panel.coverage.weeks_without_oil],
  );
  // Interest is still present on those rows -- that is the point of keeping them.
  for (const row of withoutOil) {
    for (const id of SERIES_IDS) {
      assert.equal(typeof row.interest[id], "number");
    }
  }
});

test("regime is null exactly when oil is null", () => {
  for (const row of getPanelRows(bundle)) {
    assert.equal(row.oil === null, row.regime === null, `mismatch on ${row.week_start}`);
  }
});

test("partial weeks are flagged and consistent with trading_days", () => {
  const flagged = getPanelRowsWithOil(bundle).filter((row) => row.oil!.is_partial_week);
  assert.deepEqual(
    flagged.map((row) => row.week_start),
    [...bundle.panel.coverage.partial_weeks],
  );
  for (const row of flagged) {
    assert.ok(row.oil!.trading_days < 5);
  }
});

test("best_lag may be null and that is representable", () => {
  const nullable = SERIES_IDS.map((id) => getSeriesMetrics(bundle, id).best_lag);
  assert.ok(nullable.some((value) => value === null || value !== null));
  for (const id of SERIES_IDS) {
    const best = getSeriesMetrics(bundle, id).best_lag;
    if (best !== null) {
      assert.ok(best.lag_weeks >= 0, `${id}: best lag must not be negative`);
    }
  }
});

test("sensitivity variants carry statistics only when computable", () => {
  for (const id of SERIES_IDS) {
    for (const variant of getSeriesMetrics(bundle, id).sensitivity.variants) {
      if (variant.computable) {
        assert.equal(typeof variant.pearson_r, "number");
        assert.equal(variant.reason, null);
      } else {
        assert.equal(variant.pearson_r, null);
        assert.equal(typeof variant.reason, "string");
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Comparability contract
// ---------------------------------------------------------------------------

test("series-local metrics are flagged as not comparable across series", () => {
  for (const id of SERIES_IDS) {
    const profile = getSeriesMetrics(bundle, id).profile;
    assert.equal(profile.series_local._comparable_across_series, false);
    assert.equal(profile.scale_free._comparable_across_series, true);
  }
});

test("comparability rules are present and non-empty", () => {
  const c = getComparability(bundle);
  assert.ok(c.scale_free_metrics.length > 0);
  assert.ok(c.series_local_metrics.length > 0);
  assert.ok(c.forbidden_comparisons.length > 0);
  // The two lists must not overlap, or the guard is meaningless.
  const overlap = c.scale_free_metrics.filter((m) => c.series_local_metrics.includes(m));
  assert.deepEqual(overlap, []);
});

test("every series maxes at 100, which is why levels are not comparable", () => {
  for (const id of SERIES_IDS) {
    assert.equal(getSeriesMetrics(bundle, id).profile.series_local.peak_value, 100);
  }
});

// ---------------------------------------------------------------------------
// Claims gate
// ---------------------------------------------------------------------------

test("claims requiring citation are never publishable and carry no sources", () => {
  const needCitation = getClaimsRequiringCitation(bundle);
  assert.ok(needCitation.length > 0);
  for (const claim of needCitation) {
    assert.equal(claim.publishable_as_fact, false);
    assert.deepEqual([...claim.sources], []);
  }
});

test("publishable claims all carry evidence or a source", () => {
  for (const claim of getPublishableClaims(bundle)) {
    assert.ok(
      claim.evidence.length > 0 || claim.sources.length > 0,
      `${claim.id} is publishable with no backing`,
    );
  }
});

test("claim summary total matches the claim list", () => {
  assert.equal(bundle.claims.summary.total, getClaims(bundle).length);
});

test("claims are addressable by id", () => {
  const first = getClaims(bundle)[0]!;
  assert.equal(getClaim(bundle, first.id)?.id, first.id);
  assert.equal(getClaim(bundle, "no-such-claim"), undefined);
});

// ---------------------------------------------------------------------------
// Editorial framework inputs
// ---------------------------------------------------------------------------

test("category reviews always require external evidence for their mechanism", () => {
  const reviews = getCategoryReviews(bundle);
  assert.ok(reviews.length > 0);
  for (const review of reviews) {
    assert.equal(review.requires_external_evidence, true);
  }
});

test("evidence groups partition the countries exactly once", () => {
  const groups = getGlobalMetrics(bundle).evidence_groups;
  const assigned = Object.values(groups).flatMap((ids) => [...(ids ?? [])]);
  assert.deepEqual(assigned.sort(), [...COUNTRY_IDS].sort());
  assert.equal(new Set(assigned).size, assigned.length, "a country appears in two groups");
});

test("unknown evidence group reads as empty rather than throwing", () => {
  assert.deepEqual([...getEvidenceGroup(bundle, "robust_negative_association")], []);
});

test("each country's classification group matches its evidence group membership", () => {
  const groups = getGlobalMetrics(bundle).evidence_groups;
  for (const id of COUNTRY_IDS) {
    const group = getCountryMetrics(bundle, id).classification.evidence_group;
    assert.ok(
      (groups[group] ?? []).includes(id),
      `${id} is classified ${group} but not listed under it`,
    );
  }
});
