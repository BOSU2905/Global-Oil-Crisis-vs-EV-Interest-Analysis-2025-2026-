/**
 * The market view model: one shape that serves the synthesis rows AND the country
 * deep dives.
 *
 * WHY ONE SELECTOR FOR BOTH
 * Because they are the same evidence at two depths. A synthesis row shows a market's
 * classification, direction, peak and one sentence; a deep dive shows the same four
 * plus the caveat list, the specification comparison and the limitations. Building them
 * separately would mean two places where a classification is read, and two places for
 * them to disagree — which is the exact failure mode the original project had between
 * its summary tab and its country tabs.
 *
 * WHAT IT SELECTS AND WHAT IT REFUSES TO
 *
 *   Reads:   classification.evidence_group, classification.robustness,
 *            classification.caveats, profile.scale_free.peak_week,
 *            profile.scale_free.peak_lag_weeks,
 *            profile.scale_free.baseline_to_peak_pct_change,
 *            trend_diagnostics.specifications[].significant_at_alpha,
 *            trend_diagnostics.both_series_trend_same_direction,
 *            metrics.category_review[]
 *
 *   Never touches: profile.series_local. That block holds `mean_interest`,
 *            `median_interest` and `peak_value`, carries
 *            `_comparable_across_series: false`, and is the source of every ranking
 *            this product must not make. Not reading it is stronger than reading it
 *            carefully, and a unit test asserts the string is absent from this file.
 *
 *   Computes: nothing. The one derivation is the SIGN of a published percentage
 *            change, used to say "rose" or "fell" — see `interestDirection`.
 *
 * NO SCORE EXISTS IN THIS FILE. There is no composite, no index, no weighting, no
 * ordering by a measured value and no superlative. Row order is
 * `MARKET_READING_ORDER`, which is editorial and documented as carrying no ranking.
 */

import type {
  ArtifactBundle,
  CaveatCode,
  CategoryVerdict,
  CountryId,
  EvidenceGroup,
  IsoDate,
  Robustness,
  SpecificationId,
} from "../data/index.ts";
import {
  getCategoryReviews,
  getCountryMetrics,
  getGlobalMetrics,
  getSeriesLabel,
} from "../data/index.ts";
import type { EditorialCategoryId, InterestDirection } from "../content/markets.ts";
import {
  EDITORIAL_CATEGORIES,
  EVIDENCE_GROUP_LABEL,
  INTEREST_DIRECTION_LABEL,
  MARKET_READING_ORDER,
  ROBUSTNESS_LABEL,
  evidenceSentence,
} from "../content/markets.ts";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** An editorial panel, joined to whatever the pipeline reviewed about it. */
export interface EditorialCategoryView {
  readonly id: EditorialCategoryId;
  readonly label: string;
  readonly members: readonly CountryId[];
  readonly basis: string;
  /**
   * `category_review.verdict` where the pipeline reviewed this panel, else `null`.
   *
   * `null` is not a missing value: two of the four panels did not exist in the original
   * project's framework, so there is nothing to have been reviewed. The UI shows
   * "editorial" for those rather than inventing a verdict.
   */
  readonly verdict: CategoryVerdict | null;
  /**
   * `category_review.requires_external_evidence`. True for every reviewed panel, and
   * treated as true for the unreviewed ones — a panel name that asserts a mechanism
   * always needs evidence this dataset does not contain.
   *
   * `docs/product-architecture.md` §3 rule 3 requires this to be displayed.
   */
  readonly requiresExternalEvidence: boolean;
}

/** The specification comparison, as flags. Coefficients stay in the pipeline. */
export interface SpecificationView {
  readonly levelsSignificant: boolean;
  readonly firstDifferencesSignificant: boolean;
  readonly linearDetrendedSignificant: boolean;
  readonly bothSeriesTrendSameDirection: boolean;
}

/**
 * Everything a synthesis row or a deep dive needs about one market.
 *
 * Note what is NOT here: no coefficient, no p-value, no interval and no composite
 * figure. A row that rendered `r` would need the specification comparison beside it
 * (KIRO.md §16), and `MetricContent`'s `inferential` variant is the component that
 * enforces that — which is where the Robustness section will read these from.
 */
export interface MarketEvidence {
  readonly id: CountryId;
  readonly label: string;
  readonly category: EditorialCategoryView;
  readonly direction: InterestDirection;
  readonly directionLabel: string;
  readonly peakWeek: IsoDate;
  readonly evidenceGroup: EvidenceGroup;
  readonly evidenceGroupLabel: string;
  readonly robustness: Robustness;
  readonly robustnessLabel: string;
  /** `peak_lag_weeks`: negative = before the crude-price peak. */
  readonly peakLagWeeks: number;
  readonly caveats: readonly CaveatCode[];
  readonly specification: SpecificationView;
  /** One concise sentence, assembled from the flags above. */
  readonly evidenceStatement: string;
}

export interface MarketSynthesis {
  /** Editorial reading order. Carries no ranking — see `MARKET_READING_ORDER`. */
  readonly markets: readonly MarketEvidence[];
  readonly categories: readonly EditorialCategoryView[];
  /** The crude-price peak every `peakLagWeeks` is measured against. */
  readonly oilPeakWeek: IsoDate;
  /** Peak dispersion, so a section can state the finding without recomputing it. */
  readonly peakSpread: {
    readonly distinctWeeks: number;
    readonly distinctMonths: readonly string[];
    readonly spanWeeks: number;
    readonly synchronisedWithinOneMonth: boolean;
  };
}

// ---------------------------------------------------------------------------
// The one derivation, stated plainly
// ---------------------------------------------------------------------------

/**
 * Which way a market's own interest moved, from the SIGN of a published figure.
 *
 * `profile.scale_free.baseline_to_peak_pct_change` is computed by the pipeline and
 * listed in `countries.json` under `scale_free_metrics`. This function does not
 * recompute it, round it or compare it with another market's — it reports whether the
 * published number is above or below zero, which is what turns a figure into the words
 * "rose" or "fell".
 *
 * That is the only derivation in this module, and it is deliberately a named, exported,
 * unit-tested function rather than an inline `> 0` so that it is visible in review.
 */
export function interestDirection(baselineToPeakPctChange: number): InterestDirection {
  if (baselineToPeakPctChange > 0) return "rose";
  if (baselineToPeakPctChange < 0) return "fell";
  return "unchanged";
}

// ---------------------------------------------------------------------------
// The selector
// ---------------------------------------------------------------------------

const specificationFlag = (
  bundle: ArtifactBundle,
  id: CountryId,
  specification: SpecificationId,
): boolean => {
  const specs = getCountryMetrics(bundle, id).trend_diagnostics.specifications;
  const match = specs.find((spec) => spec.id === specification);
  if (match === undefined) {
    throw new Error(`metrics.json has no "${specification}" specification for ${id}`);
  }
  return match.significant_at_alpha;
};

/**
 * Join the editorial panels to the pipeline's review of them.
 *
 * `category_review` entries whose verdict is `not_supported` are not represented here,
 * and that is data-driven rather than a hard-coded exclusion: "The Proactive Shift"
 * carries `not_supported` because Malaysia is inconclusive and the United States is
 * level-only, so it has no panel in `EDITORIAL_CATEGORIES` to join to. If the pipeline
 * ever supported it, this function would still not invent a panel — a new panel is an
 * editorial decision, not an automatic consequence.
 */
function buildCategories(bundle: ArtifactBundle): readonly EditorialCategoryView[] {
  const reviews = getCategoryReviews(bundle);

  return EDITORIAL_CATEGORIES.map((category) => {
    const review =
      category.reviewId === null
        ? undefined
        : reviews.find((entry) => entry.id === category.reviewId);

    if (review !== undefined && review.verdict === "not_supported") {
      throw new Error(
        `editorial panel "${category.label}" maps to category_review "${review.id}", ` +
          `whose verdict is not_supported. A panel the data contradicts must not be ` +
          `rendered — remove it from EDITORIAL_CATEGORIES.`,
      );
    }

    return {
      id: category.id,
      label: category.label,
      // Membership comes from the artifact where the pipeline reviewed the panel, so a
      // reclassification moves a market rather than leaving the UI stale.
      members: review === undefined ? category.members : review.data_supported_members,
      basis: category.basis,
      verdict: review === undefined ? null : review.verdict,
      // True for a reviewed panel because the artifact says so; true for an unreviewed
      // one because the panel name asserts a mechanism either way.
      requiresExternalEvidence: review === undefined ? true : review.requires_external_evidence,
    };
  });
}

export function selectMarketSynthesis(bundle: ArtifactBundle): MarketSynthesis {
  const global = getGlobalMetrics(bundle);
  const categories = buildCategories(bundle);

  const markets: readonly MarketEvidence[] = MARKET_READING_ORDER.map((id) => {
    const metrics = getCountryMetrics(bundle, id);
    const scaleFree = metrics.profile.scale_free;
    const direction = interestDirection(scaleFree.baseline_to_peak_pct_change);
    const category = categories.find((entry) => entry.members.includes(id));

    if (category === undefined) {
      throw new Error(
        `no editorial panel contains "${id}". Every market must appear exactly once ` +
          `in the synthesis, or a reader would find a market missing without knowing it.`,
      );
    }

    const specification: SpecificationView = {
      levelsSignificant: specificationFlag(bundle, id, "levels"),
      firstDifferencesSignificant: specificationFlag(bundle, id, "first_differences"),
      linearDetrendedSignificant: specificationFlag(bundle, id, "linear_detrended"),
      bothSeriesTrendSameDirection: metrics.trend_diagnostics.both_series_trend_same_direction,
    };

    return {
      id,
      label: getSeriesLabel(bundle, id),
      category,
      direction,
      directionLabel: INTEREST_DIRECTION_LABEL[direction],
      peakWeek: scaleFree.peak_week,
      evidenceGroup: metrics.classification.evidence_group,
      evidenceGroupLabel: EVIDENCE_GROUP_LABEL[metrics.classification.evidence_group],
      robustness: metrics.classification.robustness,
      robustnessLabel: ROBUSTNESS_LABEL[metrics.classification.robustness],
      peakLagWeeks: scaleFree.peak_lag_weeks,
      caveats: metrics.classification.caveats,
      specification,
      evidenceStatement: evidenceSentence({
        direction,
        evidenceGroup: metrics.classification.evidence_group,
        peakLagWeeks: scaleFree.peak_lag_weeks,
        caveats: metrics.classification.caveats,
      }),
    };
  });

  return {
    markets,
    categories,
    oilPeakWeek: global.oil.max_week,
    peakSpread: {
      distinctWeeks: global.peak_dispersion.distinct_weeks,
      distinctMonths: global.peak_dispersion.distinct_months,
      spanWeeks: global.peak_dispersion.span_weeks,
      synchronisedWithinOneMonth: global.peak_dispersion.synchronised_within_one_month,
    },
  };
}
