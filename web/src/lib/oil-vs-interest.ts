/**
 * Chart data selector for the oil-price / worldwide-interest prototype.
 *
 * WHY THIS IS A `.ts` MODULE OUTSIDE THE COMPONENTS
 * Two reasons, both practical:
 *
 *   1. Node 22 cannot load `.tsx` (`ERR_UNKNOWN_FILE_EXTENSION`), so anything
 *      expressed here is unit-testable under `node --test` while anything in a
 *      component is only testable once rendered. The rules this file must not
 *      break — no arithmetic on a statistic, no renormalisation, correct units —
 *      are exactly the rules worth asserting without a browser.
 *   2. `tests/analytical-safety.test.ts` asserts the exact file list of
 *      `src/data/`, so a new module there would require weakening a guardrail.
 *      `src/lib/` is where `artifacts.ts` already lives for the same reason.
 *
 * WHAT THIS FILE DOES, AND THE ONE THING IT MUST NEVER DO
 * It SELECTS. Every number it returns is copied out of an artifact field by name.
 * There is no mean, no scaling, no interpolation, no gap filling, no percentage
 * change and no correlation anywhere below — those all exist already, computed
 * once in Python, and the frontend's job is to read them.
 *
 * Two consequences that look like omissions and are not:
 *
 *   - `oilUsdPerBarrel` is `null` for the final week, because `panel.rows` really
 *     carries `oil: null` there (the Brent extract stops one week short of the
 *     Trends grid). The chart must draw a GAP, not a line to zero and not an
 *     interpolated segment. `connectNulls` is off downstream for this reason.
 *   - the oil and interest values are returned in their own units and are never
 *     brought onto a common scale. Oil is USD per barrel; interest is a 0-100
 *     index that Google Trends already normalised per series. Rescaling either
 *     one would manufacture a visual relationship, which is the single most
 *     misleading thing a dual-axis chart can do.
 */

import type {
  ArtifactBundle,
  EvidenceGroup,
  IsoDate,
  Regime,
  SpecificationId,
} from "../data/index.ts";
import { getGlobalMetrics, getSeriesLabel, getSeriesMetrics } from "../data/index.ts";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** One weekly observation, in its own units. */
export interface OilInterestPoint {
  readonly weekStart: IsoDate;
  readonly weekEnd: IsoDate;
  /**
   * `panel.rows[].oil.brent_usd_per_barrel_exact`, verbatim. USD per barrel of
   * Brent crude — a benchmark spot price, never a retail pump price.
   *
   * `null` where the artifact has no oil observation for the week. Not zero, and
   * not carried forward.
   */
  readonly oilUsdPerBarrel: number | null;
  /**
   * `panel.rows[].interest.worldwide`, verbatim. Google Trends relative search
   * interest on its own 0-100 scale.
   */
  readonly interestIndex: number;
  /** `oil.is_partial_week` — fewer than five trading days contributed. */
  readonly isPartialWeek: boolean;
  /** `null` exactly when the week has no oil observation. */
  readonly regime: Regime | null;
}

/**
 * Annotation positions, every one of them an authoritative artifact value.
 *
 * Nothing here is a threshold this file decided. `oilPeakWeek` is
 * `metrics.global.oil.max_week`; `regimeOnsetWeek` is
 * `metrics.global.regime.onset_week`. Recomputing either in JS — by scanning for
 * a maximum or by applying the regime rule — would create a second analytical
 * source that could silently disagree with the published one.
 */
export interface OilInterestAnnotations {
  readonly oilPeakWeek: IsoDate;
  readonly oilPeakUsdPerBarrel: number;
  readonly regimeOnsetWeek: IsoDate;
  /**
   * `metrics.global.regime.regimes_separated`. When false the split must NOT be
   * drawn as a distinct regime, so the band is suppressed rather than styled
   * differently.
   */
  readonly regimesSeparated: boolean;
  /** Last week with an oil observation: where the elevated band has to stop. */
  readonly lastOilWeek: IsoDate;
}

/**
 * The specification comparison, as flags rather than coefficients.
 *
 * KIRO.md §16: a level association may never be shown without the comparison
 * beside it. This prototype renders **no coefficient at all** — the foundation
 * page is asserted to contain no `r =`, no `p =` and no "pearson", and that
 * assertion is kept — so the comparison travels as booleans the copy is
 * conditioned on. If the pipeline output ever changed, the wording changes with
 * it instead of going stale.
 */
export interface SpecificationFlags {
  readonly evidenceGroup: EvidenceGroup;
  readonly levelsSignificant: boolean;
  readonly firstDifferencesSignificant: boolean;
  readonly linearDetrendedSignificant: boolean;
  /** `true` when both series trend the same way — the confound worth naming. */
  readonly bothSeriesTrendSameDirection: boolean;
}

export interface OilInterestChartData {
  readonly points: readonly OilInterestPoint[];
  readonly annotations: OilInterestAnnotations;
  readonly specification: SpecificationFlags;
  /** Unit strings from `panel.units`, not retyped here. */
  readonly units: {
    readonly oil: string;
    readonly interest: string;
  };
  /** Display labels, read from the series registry. */
  readonly labels: {
    readonly oil: string;
    readonly interest: string;
  };
  readonly coverage: {
    readonly firstWeek: IsoDate;
    readonly lastWeek: IsoDate;
    readonly trendsWeeks: number;
    readonly oilWeeks: number;
    readonly partialWeeks: readonly IsoDate[];
    readonly weeksWithoutOil: readonly IsoDate[];
  };
  /**
   * Rounded axis bounds for the oil axis, derived from the artifact's own min and
   * max. This is the ONE derived pair of numbers in this module, and it is axis
   * scaling rather than analysis: it never touches a plotted value. It exists so
   * both y-axes can carry the same number of gridlines, because two axes with
   * different split counts draw a second set of lines through the plot.
   */
  readonly oilAxis: {
    readonly min: number;
    readonly max: number;
    readonly interval: number;
  };
}

// ---------------------------------------------------------------------------
// The interest axis is fixed, and that is a decision worth stating
// ---------------------------------------------------------------------------

/**
 * Google Trends publishes a 0-100 index, so the axis is 0-100 — not the data's
 * own range.
 *
 * Auto-scaling this axis to, say, 40-100 would stretch the interest line to fill
 * the plot and make its shape look far more dramatic than the index warrants. The
 * domain is a property of the measure, not of this sample.
 */
export const INTEREST_AXIS = { min: 0, max: 100, interval: 25 } as const;

/** Gridline count shared by both axes. Four intervals, five lines. */
const AXIS_INTERVALS = 4;

/**
 * Round an artifact-supplied range outward to a tidy step.
 *
 * Presentation only: `docs/frontend-data-contract.md` permits axis ranges and tick
 * formatting in the frontend, and this touches neither a plotted value nor a
 * statistic. The inputs are `metrics.global.oil.min_usd_per_barrel` and
 * `max_usd_per_barrel` — read, not scanned for.
 */
export function oilAxisBounds(
  minUsdPerBarrel: number,
  maxUsdPerBarrel: number,
): { min: number; max: number; interval: number } {
  const step = 10;
  const min = Math.floor(minUsdPerBarrel / step) * step;
  const max = Math.ceil(maxUsdPerBarrel / step) * step;
  // Widen to the next step until the span divides into equal whole intervals, so
  // every gridline lands on a round number a reader can read off the axis.
  let span = max - min;
  let top = max;
  while (span % AXIS_INTERVALS !== 0) {
    top += step;
    span = top - min;
  }
  return { min, max: top, interval: span / AXIS_INTERVALS };
}

// ---------------------------------------------------------------------------
// The selector
// ---------------------------------------------------------------------------

const specificationFlag = (bundle: ArtifactBundle, id: SpecificationId): boolean => {
  const specs = getSeriesMetrics(bundle, "worldwide").trend_diagnostics.specifications;
  const match = specs.find((spec) => spec.id === id);
  if (match === undefined) {
    throw new Error(`metrics.json has no "${id}" specification for the worldwide series`);
  }
  return match.significant_at_alpha;
};

/**
 * Everything the prototype chart needs, read from the bundle.
 *
 * Throws rather than degrading when an expected artifact value is absent: a chart
 * that quietly drops its annotations is worse than a build that fails.
 */
export function selectOilVsWorldwideInterest(bundle: ArtifactBundle): OilInterestChartData {
  const { panel } = bundle;
  const global = getGlobalMetrics(bundle);

  const points: readonly OilInterestPoint[] = panel.rows.map((row) => ({
    weekStart: row.week_start,
    weekEnd: row.week_end,
    // `_exact` rather than the 2dp display value: the rounded one exists for
    // rendering a figure in text, and plotting it would visibly step the line.
    oilUsdPerBarrel: row.oil === null ? null : row.oil.brent_usd_per_barrel_exact,
    interestIndex: row.interest.worldwide,
    isPartialWeek: row.oil?.is_partial_week ?? false,
    regime: row.regime,
  }));

  return {
    points,
    annotations: {
      oilPeakWeek: global.oil.max_week,
      oilPeakUsdPerBarrel: global.oil.max_usd_per_barrel,
      regimeOnsetWeek: global.regime.onset_week,
      regimesSeparated: global.regime.regimes_separated,
      lastOilWeek: global.oil.last_week,
    },
    specification: {
      evidenceGroup: getSeriesMetrics(bundle, "worldwide").classification.evidence_group,
      levelsSignificant: specificationFlag(bundle, "levels"),
      firstDifferencesSignificant: specificationFlag(bundle, "first_differences"),
      linearDetrendedSignificant: specificationFlag(bundle, "linear_detrended"),
      bothSeriesTrendSameDirection: getSeriesMetrics(bundle, "worldwide").trend_diagnostics
        .both_series_trend_same_direction,
    },
    units: {
      oil: panel.units.brent_usd_per_barrel,
      interest: panel.units.interest,
    },
    labels: {
      // The oil series has no registry entry (it is not an interest series), so
      // its label is product copy. The interest label is read.
      oil: "Brent crude",
      interest: getSeriesLabel(bundle, "worldwide"),
    },
    coverage: {
      firstWeek: panel.coverage.first_week,
      lastWeek: panel.coverage.last_week,
      trendsWeeks: panel.coverage.trends_weeks,
      oilWeeks: panel.coverage.oil_weeks,
      partialWeeks: panel.coverage.partial_weeks,
      weeksWithoutOil: panel.coverage.weeks_without_oil,
    },
    oilAxis: oilAxisBounds(global.oil.min_usd_per_barrel, global.oil.max_usd_per_barrel),
  };
}
