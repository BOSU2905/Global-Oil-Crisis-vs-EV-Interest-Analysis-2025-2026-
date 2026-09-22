/**
 * Chart data selector for "EV Interest Across Five Markets".
 *
 * THE QUESTION THIS CHART ANSWERS, AND THE ONE IT MUST NOT
 *   Answers: when did EV search interest rise in each market, and how did the
 *            TIMING and SHAPE differ between them?
 *   Refuses: which market has more EV search interest.
 *
 * That second line is not editorial caution, it is the data's own constraint.
 * `countries.json` records it: each Google Trends export is an independent query
 * rescaled so its own maximum week equals 100. Every series therefore contains a
 * 100, and one market's 90 has no defined relationship to another market's 70. The
 * artifact even names the forbidden comparisons — ranking by mean interest, ranking
 * by peak value, "describing one market as having more search interest than another"
 * — and this module reads that list rather than restating it.
 *
 * HOW THE CONSTRAINT IS ENFORCED HERE RATHER THAN REMEMBERED
 *   1. Nothing below touches `profile.series_local`. The series-local block is where
 *      `mean_interest`, `median_interest` and `peak_value` live; it carries
 *      `_comparable_across_series: false`, and not reading it at all is stronger than
 *      reading it carefully.
 *   2. `peak_week` IS comparable — the artifact lists it under `scale_free_metrics` —
 *      and `assertComparableAcrossSeries` is called on it, so if the pipeline ever
 *      reclassified it the build would fail instead of the chart quietly lying.
 *   3. The comparability explanation and remedy travel WITH the data, so the
 *      component cannot render the chart without having the caveat to hand.
 *   4. There is no aggregate. No mean across markets, no combined index, no ranking
 *      and no ordering by any value. Series order is the registry's order.
 *
 * WHAT IT DOES: it SELECTS. Every number returned is copied out of an artifact field
 * by name. No mean, no scaling, no interpolation, no percentage change, no peak
 * detection — the peaks are read from `metrics.global.peak_dispersion.peaks`, because
 * a peak found by scanning in JavaScript is a second analytical source that can
 * disagree with the published one.
 */

import type {
  ArtifactBundle,
  CountryId,
  EvidenceGroup,
  IsoDate,
  Regime,
  Robustness,
} from "../data/index.ts";
import {
  COUNTRY_IDS,
  assertComparableAcrossSeries,
  getCountryMetrics,
  getGlobalMetrics,
  getSeriesLabel,
} from "../data/index.ts";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** One weekly observation, carrying every market's own index value verbatim. */
export interface MarketWeek {
  readonly weekStart: IsoDate;
  readonly weekEnd: IsoDate;
  /**
   * `panel.rows[].interest[country]`, verbatim. Google Trends relative search
   * interest, 0-100, **rescaled independently per market**.
   */
  readonly values: Readonly<Record<CountryId, number>>;
  /** `null` exactly when the week has no oil observation. */
  readonly regime: Regime | null;
  /** `oil.is_partial_week` — carried so the table can mark the week in words. */
  readonly isPartialWeek: boolean;
}

/**
 * One market's identity for this chart.
 *
 * `peakWeek`, `evidenceGroup` and `robustness` are read, never derived. They are
 * here because the legend and the tabular fallback both need to name a market's peak
 * without a hover, and because the same view model feeds the market-synthesis rows.
 */
export interface MarketSeriesMeta {
  readonly id: CountryId;
  readonly label: string;
  readonly peakWeek: IsoDate;
  readonly evidenceGroup: EvidenceGroup;
  readonly robustness: Robustness;
}

/** The oil-price context this chart shows as a band, not as a second measure. */
export interface OilContext {
  readonly onsetWeek: IsoDate;
  readonly lastOilWeek: IsoDate;
  /** `metrics.global.regime.regimes_separated`. False suppresses the band entirely. */
  readonly regimesSeparated: boolean;
}

/** Peak dispersion, read from the artifact. The claim the original project got wrong. */
export interface PeakSpread {
  readonly distinctWeeks: number;
  readonly distinctMonths: readonly string[];
  readonly spanWeeks: number;
  /** Currently false. "Synchronised in a single month" is NOT supported. */
  readonly synchronisedWithinOneMonth: boolean;
}

export interface MarketsChartData {
  readonly weeks: readonly MarketWeek[];
  /** Registry order. Not sorted by any value — see the header. */
  readonly series: readonly MarketSeriesMeta[];
  readonly unit: string;
  readonly oilContext: OilContext;
  readonly peakSpread: PeakSpread;
  readonly coverage: {
    readonly firstWeek: IsoDate;
    readonly lastWeek: IsoDate;
    readonly trendsWeeks: number;
    readonly partialWeeks: readonly IsoDate[];
    readonly weeksWithoutOil: readonly IsoDate[];
  };
  /** From `countries.json`, so the caveat cannot be paraphrased in a component. */
  readonly comparability: {
    readonly explanation: string;
    readonly remedy: string;
    readonly forbiddenComparisons: readonly string[];
  };
}

// ---------------------------------------------------------------------------
// The axis is the measure's own domain
// ---------------------------------------------------------------------------

/**
 * Google Trends publishes a 0-100 index, so the axis is 0-100 for every market.
 *
 * This matters more here than on the two-series chart. Five lines auto-scaled to
 * their own sample ranges would each fill the plot, and the reader would be looking
 * at five differently-stretched pictures laid on top of each other. One shared 0-100
 * domain at least makes the *shapes* comparable, which is the only comparison the
 * normalisation permits.
 */
export const MARKET_INTEREST_AXIS = { min: 0, max: 100, interval: 25 } as const;

// ---------------------------------------------------------------------------
// The selector
// ---------------------------------------------------------------------------

export function selectInterestAcrossMarkets(bundle: ArtifactBundle): MarketsChartData {
  const { panel } = bundle;
  const global = getGlobalMetrics(bundle);
  const { comparability } = bundle.countries;

  // The one cross-market comparison this chart makes is of peak TIMING. The artifact
  // is the authority on whether that is permitted; ask it rather than assume.
  assertComparableAcrossSeries(bundle, "peak_week");

  const weeks: readonly MarketWeek[] = panel.rows.map((row) => ({
    weekStart: row.week_start,
    weekEnd: row.week_end,
    // Verbatim, per market. `panel.rows[].interest` is already the published index.
    values: {
      indonesia: row.interest.indonesia,
      malaysia: row.interest.malaysia,
      norway: row.interest.norway,
      singapore: row.interest.singapore,
      us: row.interest.us,
    },
    regime: row.regime,
    isPartialWeek: row.oil?.is_partial_week ?? false,
  }));

  const series: readonly MarketSeriesMeta[] = COUNTRY_IDS.map((id) => {
    const metrics = getCountryMetrics(bundle, id);
    return {
      id,
      label: getSeriesLabel(bundle, id),
      // `metrics.global.peak_dispersion.peaks` and the per-series scale-free profile
      // agree by construction; the global map is used because it is the artifact's
      // own cross-market view of exactly this comparison.
      peakWeek: global.peak_dispersion.peaks[id],
      evidenceGroup: metrics.classification.evidence_group,
      robustness: metrics.classification.robustness,
    };
  });

  return {
    weeks,
    series,
    unit: panel.units.interest,
    oilContext: {
      onsetWeek: global.regime.onset_week,
      lastOilWeek: global.oil.last_week,
      regimesSeparated: global.regime.regimes_separated,
    },
    peakSpread: {
      distinctWeeks: global.peak_dispersion.distinct_weeks,
      distinctMonths: global.peak_dispersion.distinct_months,
      spanWeeks: global.peak_dispersion.span_weeks,
      synchronisedWithinOneMonth: global.peak_dispersion.synchronised_within_one_month,
    },
    coverage: {
      firstWeek: panel.coverage.first_week,
      lastWeek: panel.coverage.last_week,
      trendsWeeks: panel.coverage.trends_weeks,
      partialWeeks: panel.coverage.partial_weeks,
      weeksWithoutOil: panel.coverage.weeks_without_oil,
    },
    comparability: {
      explanation: comparability.explanation,
      remedy: comparability.remedy,
      forbiddenComparisons: comparability.forbidden_comparisons,
    },
  };
}
