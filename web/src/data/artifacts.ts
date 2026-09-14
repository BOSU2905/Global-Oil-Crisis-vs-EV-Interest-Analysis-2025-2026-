/**
 * Typed accessors over the validated analytical artifacts.
 *
 * ANALYTICAL SAFETY -- the whole point of this module
 * Every function here performs one of: lookup, filter, or integrity assertion.
 * None derives a value. There is no arithmetic on artifact numbers anywhere in
 * this file, and there must never be. Specifically, the presentation layer must
 * never compute correlations, p-values, confidence intervals, peak dates,
 * baseline or peak changes, regime classification, lag statistics, country
 * classifications, or significance. All of those are read from the artifacts
 * produced by `pipeline/`.
 *
 * Ordering and formatting are deliberately NOT provided here. Sorting a list of
 * countries by correlation is a presentation decision, and formatting a number
 * for display is a view concern; keeping both out of this module keeps the
 * "retrieval only" boundary unambiguous.
 */

import {
  ARTIFACT_FILENAMES,
  COUNTRY_IDS,
  SERIES_IDS,
  type ArtifactBundle,
  type ArtifactName,
  type CategoryReview,
  type Claim,
  type Comparability,
  type CountryId,
  type EvidenceGroup,
  type GlobalMetrics,
  type PanelRow,
  type SeriesId,
  type SeriesMetrics,
  type SeriesRegistryEntry,
} from "./artifact-types.ts";
import {
  ContractError,
  validateClaims,
  validateCountries,
  validateManifest,
  validateMetrics,
  validatePanel,
} from "./validate.ts";

/** Raw, unvalidated artifact payloads keyed by artifact name. */
export type RawArtifacts = Readonly<Record<ArtifactName, unknown>>;

// ---------------------------------------------------------------------------
// Bundle construction
// ---------------------------------------------------------------------------

/**
 * Validate all five artifacts and assert they agree with each other.
 *
 * This is the single boundary between untyped JSON and the typed application.
 * It throws `ContractError` with a precise path on any violation, so a
 * pipeline/frontend drift fails loudly at build time rather than rendering a
 * wrong or blank number in production.
 */
export function createArtifactBundle(raw: RawArtifacts): ArtifactBundle {
  const bundle: ArtifactBundle = {
    panel: validatePanel(raw.panel),
    countries: validateCountries(raw.countries),
    metrics: validateMetrics(raw.metrics),
    claims: validateClaims(raw.claims),
    manifest: validateManifest(raw.manifest),
  };
  assertCrossArtifactIntegrity(bundle);
  return bundle;
}

/**
 * Cross-artifact consistency. These are assertions about agreement between
 * independently emitted files -- not derivations.
 */
export function assertCrossArtifactIntegrity(bundle: ArtifactBundle): void {
  const { panel, countries, metrics, manifest } = bundle;

  const fail = (path: string, message: string): never => {
    throw new ContractError(path, message);
  };

  // 1. Country list agrees with the canonical set.
  const declared = [...metrics.countries].sort();
  const canonical = [...COUNTRY_IDS].sort();
  if (declared.join(",") !== canonical.join(",")) {
    fail(
      "metrics.countries",
      `expected [${canonical.join(", ")}], got [${declared.join(", ")}]`,
    );
  }

  // 2. Registry covers exactly the series metrics describes.
  const registryIds = new Set(countries.series.map((entry) => entry.id));
  for (const id of SERIES_IDS) {
    if (!registryIds.has(id)) {
      fail("countries.series", `registry is missing "${id}" but metrics.series defines it`);
    }
  }

  // 3. Panel coverage agrees with manifest coverage.
  const a = panel.coverage;
  const b = manifest.coverage;
  for (const key of ["trends_weeks", "oil_weeks", "first_week", "last_week"] as const) {
    if (a[key] !== b[key]) {
      fail(
        `manifest.coverage.${key}`,
        `manifest reports ${String(b[key])} but panel reports ${String(a[key])}`,
      );
    }
  }

  // 4. Manifest lists a digest for every analytical artifact except itself.
  for (const name of Object.keys(ARTIFACT_FILENAMES) as ArtifactName[]) {
    if (name === "manifest") continue;
    const filename = ARTIFACT_FILENAMES[name];
    if (!(filename in manifest.artifacts)) {
      fail("manifest.artifacts", `missing digest for "${filename}"`);
    }
  }

  // 5. Weeks flagged in coverage really exist in the panel, with matching state.
  const rowsByWeek = new Map(panel.rows.map((row) => [row.week_start, row]));
  for (const week of a.partial_weeks) {
    const row = rowsByWeek.get(week);
    if (row === undefined)
      fail("panel.coverage.partial_weeks", `week ${week} is not a panel row`);
    else if (row.oil === null || !row.oil.is_partial_week) {
      fail("panel.coverage.partial_weeks", `week ${week} is not flagged partial on its row`);
    }
  }
  for (const week of a.weeks_without_oil) {
    const row = rowsByWeek.get(week);
    if (row === undefined) {
      fail("panel.coverage.weeks_without_oil", `week ${week} is not a panel row`);
    } else if (row.oil !== null) {
      fail("panel.coverage.weeks_without_oil", `week ${week} unexpectedly has oil data`);
    }
  }

  // 6. Every reported peak week is a real week in the panel. Catches the class
  //    of drift where metrics are regenerated but the panel is not.
  for (const id of SERIES_IDS) {
    const peak = metrics.series[id].profile.scale_free.peak_week;
    if (!rowsByWeek.has(peak)) {
      fail(`metrics.series.${id}.profile.scale_free.peak_week`, `${peak} is not a panel week`);
    }
  }
  for (const [country, week] of Object.entries(metrics.global.peak_dispersion.peaks)) {
    if (!rowsByWeek.has(week)) {
      fail(`metrics.global.peak_dispersion.peaks.${country}`, `${week} is not a panel week`);
    }
  }

  // 7. Regime onset is a real week.
  const onset = metrics.global.regime.onset_week;
  if (!rowsByWeek.has(onset)) {
    fail("metrics.global.regime.onset_week", `${onset} is not a panel week`);
  }
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getSeriesMetrics(bundle: ArtifactBundle, id: SeriesId): SeriesMetrics {
  return bundle.metrics.series[id];
}

export function getCountryMetrics(bundle: ArtifactBundle, id: CountryId): SeriesMetrics {
  return bundle.metrics.series[id];
}

/** Every country's metrics, in the canonical registry order. */
export function getAllCountryMetrics(bundle: ArtifactBundle): readonly SeriesMetrics[] {
  return bundle.metrics.countries.map((id) => bundle.metrics.series[id]);
}

export function getWorldwideMetrics(bundle: ArtifactBundle): SeriesMetrics {
  return bundle.metrics.series.worldwide;
}

export function getGlobalMetrics(bundle: ArtifactBundle): GlobalMetrics {
  return bundle.metrics.global;
}

export function getRegistryEntry(bundle: ArtifactBundle, id: SeriesId): SeriesRegistryEntry {
  const entry = bundle.countries.series.find((s) => s.id === id);
  if (entry === undefined) {
    throw new ContractError(`countries.series`, `no registry entry for "${id}"`);
  }
  return entry;
}

/** Display label for a series. The UI must use this, never a hard-coded string. */
export function getSeriesLabel(bundle: ArtifactBundle, id: SeriesId): string {
  return getRegistryEntry(bundle, id).label;
}

export function getPanelRows(bundle: ArtifactBundle): readonly PanelRow[] {
  return bundle.panel.rows;
}

/** Only rows that have an oil observation. A filter, not a computation. */
export function getPanelRowsWithOil(bundle: ArtifactBundle): readonly PanelRow[] {
  return bundle.panel.rows.filter((row) => row.oil !== null);
}

export function getPanelRow(bundle: ArtifactBundle, weekStart: string): PanelRow | undefined {
  return bundle.panel.rows.find((row) => row.week_start === weekStart);
}

export function getCategoryReviews(bundle: ArtifactBundle): readonly CategoryReview[] {
  return bundle.metrics.category_review;
}

export function getComparability(bundle: ArtifactBundle): Comparability {
  return bundle.countries.comparability;
}

export function getEvidenceGroup(
  bundle: ArtifactBundle,
  group: EvidenceGroup,
): readonly CountryId[] {
  return bundle.metrics.global.evidence_groups[group] ?? [];
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export function getClaims(bundle: ArtifactBundle): readonly Claim[] {
  return bundle.claims.claims;
}

export function getClaim(bundle: ArtifactBundle, id: string): Claim | undefined {
  return bundle.claims.claims.find((claim) => claim.id === id);
}

/**
 * Claims the UI may render as factual statements.
 *
 * The gate is owned by the pipeline (`publishable_as_fact`). This helper exists
 * so component code never has to re-derive the rule and never accidentally
 * inverts it.
 */
export function getPublishableClaims(bundle: ArtifactBundle): readonly Claim[] {
  return bundle.claims.claims.filter((claim) => claim.publishable_as_fact);
}

/** Claims that must be shown as unsourced context, or not at all. */
export function getClaimsRequiringCitation(bundle: ArtifactBundle): readonly Claim[] {
  return bundle.claims.claims.filter((claim) => claim.disposition === "requires_citation");
}

// ---------------------------------------------------------------------------
// Comparability guards
// ---------------------------------------------------------------------------

/**
 * True when a metric id may be compared across series.
 *
 * Reads the allow-list from the artifact rather than hard-coding it, so the
 * pipeline stays the single source of truth for what is comparable.
 */
export function isScaleFreeMetric(bundle: ArtifactBundle, metricId: string): boolean {
  return bundle.countries.comparability.scale_free_metrics.includes(metricId);
}

export function isSeriesLocalMetric(bundle: ArtifactBundle, metricId: string): boolean {
  return bundle.countries.comparability.series_local_metrics.includes(metricId);
}

/**
 * Throw if a metric is about to be used in a cross-series comparison when the
 * artifact says it must not be. Intended for use in chart/table builders in
 * Phase 3B, so the invalid comparison the original project made cannot come
 * back silently.
 */
export function assertComparableAcrossSeries(bundle: ArtifactBundle, metricId: string): void {
  if (isSeriesLocalMetric(bundle, metricId)) {
    throw new ContractError(
      "countries.comparability",
      `"${metricId}" is a series-local metric and must not be compared across series; ` +
        `each Google Trends series is normalised to its own maximum`,
    );
  }
}
