/**
 * Editorial words for the market synthesis, and nothing else.
 *
 * THE SPLIT THIS FILE EXISTS TO HOLD
 * `metrics.json` stores classification CODES — `level_only_association`,
 * `fragile`, `inconclusive` — and its own `interpretation_vocabulary.note` says why:
 * "These are classification codes, not published prose. The content layer maps codes
 * to wording; the analytical layer never stores editorial text." This is that content
 * layer. Every map below turns one artifact code into one English phrase, and nothing
 * below decides what a market's classification IS.
 *
 * THE FOUR PANEL NAMES ARE EDITORIAL, AND THAT IS A HARD RULE
 * "Subsidized Buffer", "Maturity Gap", "Co-Movement Case" and the separate
 * inconclusive case are interpretive groupings layered on top of the machine
 * classifications. They are NOT statistical results, and all three named panels carry
 * `requires_external_evidence: true` in the artifact — because the names assert
 * mechanisms (subsidy buffering, market maturity) that a price series and a search
 * index cannot establish. `docs/product-architecture.md` §3 rule 3 requires that flag
 * to be displayed wherever a panel is.
 *
 * "THE PROACTIVE SHIFT" MUST NEVER APPEAR
 * Its `category_review` verdict is `not_supported`: Malaysia is inconclusive and the
 * United States is level-only, so the panel's claim — that both pivot quickly and
 * strongly — is contradicted. It is absent from `EDITORIAL_CATEGORIES` by construction
 * rather than filtered at render time, and `tests/market-synthesis.test.ts` asserts the
 * string appears nowhere in the market layer.
 *
 * SINGAPORE IS THE CASE THAT NEEDS WATCHING
 * The editorial grouping (Maturity Gap, with Norway) and the statistical grouping
 * (`level_only_association`, with the United States) genuinely disagree, and both
 * stand — because they are different kinds of object. KIRO.md §19 makes five rules
 * binding, and the one this file must serve is that the product may never state or
 * imply Singapore shows no level association. So the evidence sentence for a
 * level-only market says the association is real and says what limits it, in that
 * order.
 *
 * NO RANKING, NO SCORE, NO SUPERLATIVE. There is no "best market", no performance
 * figure and no ordering by any measured value. `MARKET_READING_ORDER` is an editorial
 * reading order and says so.
 */

import type {
  CaveatCode,
  CountryId,
  EvidenceGroup,
  Robustness,
} from "../data/artifact-types.ts";

// ---------------------------------------------------------------------------
// Code → prose
// ---------------------------------------------------------------------------

/**
 * Evidence groups, in words a reader can act on.
 *
 * "No detectable contemporaneous association" rather than "no association": the
 * measurement is of the same seven-day window (k = 0), and saying more than that would
 * overstate what was tested.
 */
export const EVIDENCE_GROUP_LABEL: Readonly<Record<EvidenceGroup, string>> = {
  no_detectable_association: "No detectable contemporaneous association",
  inconclusive: "Inconclusive association",
  level_only_association: "Level-only association",
  robust_positive_association: "Robust positive association",
  robust_negative_association: "Robust negative association",
};

/** Robustness, in words. The scale is the artifact's: fragile, moderate, robust. */
export const ROBUSTNESS_LABEL: Readonly<Record<Robustness, string>> = {
  fragile: "Fragile",
  moderate: "Moderate",
  robust: "Robust",
};

/**
 * Which way a market's own search interest moved across the period.
 *
 * A WITHIN-MARKET statement, and only ever that. "Rose" compares a market's baseline
 * to its own peak, which `countries.json` lists under `scale_free_metrics`; it says
 * nothing about another market and cannot be read as "more interest than".
 */
export type InterestDirection = "rose" | "fell" | "unchanged";

export const INTEREST_DIRECTION_LABEL: Readonly<Record<InterestDirection, string>> = {
  rose: "EV interest rose",
  fell: "EV interest fell",
  unchanged: "EV interest broadly flat",
};

/**
 * Caveat codes, in words.
 *
 * Only the codes the synthesis rows surface are mapped. The full set is longer, and a
 * row that listed ten caveats would communicate nothing — the deep dive is where the
 * complete list belongs.
 */
export const CAVEAT_LABEL: Readonly<Partial<Record<CaveatCode, string>>> = {
  loses_significance_without_elevated_regime: "Carried by the elevated-price window",
  no_short_run_comovement: "No week-to-week co-movement",
  regime_sensitive: "Changes when elevated weeks are removed",
  specification_sensitive: "Depends on the specification",
  small_sample: "Small sample",
  few_elevated_observations: "Few elevated-price weeks",
  negative_lag_maximum: "Strongest alignment at a negative lag",
  shared_trend_confound_possible: "Shared upward trend possible",
  ci_includes_zero: "Interval includes zero",
  series_local_scale: "Scale is local to this market",
};

// ---------------------------------------------------------------------------
// The editorial framework
// ---------------------------------------------------------------------------

export type EditorialCategoryId =
  "subsidized_buffer" | "maturity_gap" | "co_movement_case" | "separate_inconclusive_case";

export interface EditorialCategoryContent {
  readonly id: EditorialCategoryId;
  /** The panel name, Title Case. Editorial, never a discovered cluster. */
  readonly label: string;
  /** Markets the panel groups. Verified against the artifact where one exists. */
  readonly members: readonly CountryId[];
  /**
   * `category_review` id this panel corresponds to, or `null` where the panel is
   * purely editorial and the artifact reviews no equivalent.
   *
   * Two of the four have one: `subsidized_buffer` and `maturity_gap`. The Co-Movement
   * Case and the separate inconclusive case were not in the original project's
   * framework, so there is nothing for the pipeline to have reviewed — and the
   * selector marks them as editorial rather than inventing a verdict.
   */
  readonly reviewId: string | null;
  /** One line, stating what kind of claim the panel is. Sentence case. */
  readonly basis: string;
}

/**
 * The four panels, exactly as KIRO.md §19 records them.
 *
 * It is a 3 + 1 composition and the asymmetry is honest: Malaysia does not fit the
 * other three and must not be forced into one (`product-architecture.md` §3 rule 2).
 * Designing for symmetry here would misrepresent the analysis.
 */
export const EDITORIAL_CATEGORIES: readonly EditorialCategoryContent[] = [
  {
    id: "subsidized_buffer",
    label: "Subsidized Buffer",
    members: ["indonesia"],
    reviewId: "subsidized_buffer",
    basis:
      "An editorial reading: interest that moves independently of crude prices. The " +
      "mechanism it names cannot be tested with a price series and a search index.",
  },
  {
    id: "maturity_gap",
    label: "Maturity Gap",
    members: ["norway", "singapore"],
    reviewId: "maturity_gap",
    basis:
      "An editorial grouping, not a measured cluster. These two markets are not " +
      "statistical peers — their evidence groups differ, and both are shown below.",
  },
  {
    id: "co_movement_case",
    label: "Co-Movement Case",
    members: ["us"],
    reviewId: null,
    basis:
      "An editorial reading: the clearest level co-movement in the data, and the " +
      "clearest illustration of why level co-movement is not enough.",
  },
  {
    id: "separate_inconclusive_case",
    label: "Separate Inconclusive Case",
    members: ["malaysia"],
    reviewId: null,
    basis:
      "Not a panel so much as a refusal to make one. Interest rose sharply and this " +
      "data cannot attribute that to crude prices either way.",
  },
];

/**
 * Reading order for the synthesis rows.
 *
 * EDITORIAL, AND CARRYING NO RANKING. It follows the executive summary's order so the
 * three named panels read in sequence and the separate case closes. It is not sorted
 * by any measured value, and nothing in the product may present position in this list
 * as a score, a rank or a judgement.
 */
export const MARKET_READING_ORDER: readonly CountryId[] = [
  "indonesia",
  "us",
  "singapore",
  "malaysia",
  "norway",
];

// ---------------------------------------------------------------------------
// The evidence sentence
// ---------------------------------------------------------------------------

/** Flags the sentence is assembled from. Every one is read from an artifact field. */
export interface EvidenceFlags {
  readonly direction: InterestDirection;
  readonly evidenceGroup: EvidenceGroup;
  /** `profile.scale_free.peak_lag_weeks`. Negative = before the crude-price peak. */
  readonly peakLagWeeks: number;
  readonly caveats: readonly CaveatCode[];
}

/** `2` → `"two"`, for a count inside a sentence. Falls back to the numeral. */
const WORD_FOR: Readonly<Record<string, string>> = {
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
};

/**
 * How a market's peak sits against the crude-price peak, in words.
 *
 * `peak_lag_weeks` is defined by the artifact as "weeks between the oil peak week and
 * this series' peak; + = after oil", so the sign is read rather than interpreted. The
 * magnitude is `Math.abs`, which is the one arithmetic operation here and is a
 * presentation of the sign rather than a new quantity.
 */
export function peakTimingPhrase(peakLagWeeks: number): string {
  if (peakLagWeeks === 0) return "peaked in the same week as the crude-price peak";
  const magnitude = Math.abs(peakLagWeeks);
  const count = WORD_FOR[String(magnitude)] ?? String(magnitude);
  const unit = magnitude === 1 ? "week" : "weeks";
  return peakLagWeeks < 0
    ? `peaked ${count} ${unit} before the crude-price peak`
    : `peaked ${count} ${unit} after the crude-price peak`;
}

/**
 * The association clause, per evidence group. Sentence-initial, because it opens the
 * second sentence.
 *
 * The level-only wording is the one that matters. KIRO.md §19 rule 4 forbids implying
 * that Singapore shows no level association, so a level-only market's sentence AFFIRMS
 * the association first and qualifies it second. Reversing those two clauses would be
 * the error that rule exists to prevent.
 */
const ASSOCIATION_CLAUSE: Readonly<Record<EvidenceGroup, string>> = {
  no_detectable_association: "No association with crude prices is detectable in the same week",
  inconclusive: "This data can neither establish nor rule out a relationship",
  level_only_association: "A level association with crude prices is present",
  robust_positive_association: "A positive association survives the specification checks",
  robust_negative_association: "A negative association survives the specification checks",
};

/**
 * One concise, evidence-oriented statement per market, assembled from artifact flags.
 *
 * TWO SENTENCES, AND THE SPLIT IS DELIBERATE
 * The first describes the market's own series — direction and timing — and the second
 * describes the relationship. Joining them with a comma produced a splice, and worse, it
 * read as though the timing were evidence for the association. They are separate facts.
 *
 * WHY IT IS ASSEMBLED RATHER THAN WRITTEN
 * Five hand-written sentences would be five places for the pipeline's output to drift
 * away from the prose. Assembling from flags means a reclassification changes the
 * wording, and a unit test can assert that every market's sentence still names its own
 * classification.
 *
 * THE QUALIFIER IS CHOSEN BY PRIORITY, NOT BY ORDER OF APPEARANCE
 * A market can carry several of these caveats at once, and one sentence can carry one.
 * The order is what a reader most needs to know: an association that vanishes without
 * the price spike is more limiting than one that merely shifts, and the absence of
 * week-to-week co-movement is the project's central robustness finding (KIRO.md §16), so
 * it outranks a general regime sensitivity.
 *
 * WHAT IT DELIBERATELY OMITS: coefficients, p-values and intervals. Those belong in
 * the Robustness section, which can carry the specification comparison beside them —
 * KIRO.md §16 forbids a coefficient appearing without it, and a one-line row has no
 * room for the comparison.
 *
 * FINAL EDITORIAL WORDING IS STILL THE OWNER'S. This is evidence copy, not the
 * finished synthesis narrative; `MARKET_SYNTHESIS_WORDING_NOTE` says so on the page.
 */
export function evidenceSentence(flags: EvidenceFlags): string {
  // No `toLowerCase()`: "EV" is an initialism and lowercasing the label produced "ev
  // interest rose". The label is already correctly cased for a sentence opening.
  const own = `${INTEREST_DIRECTION_LABEL[flags.direction]} and ${peakTimingPhrase(flags.peakLagWeeks)}.`;

  const qualifier = flags.caveats.includes("loses_significance_without_elevated_regime")
    ? ", and it does not survive removing the elevated-price weeks"
    : flags.caveats.includes("no_short_run_comovement")
      ? ", and week-to-week changes show no co-movement"
      : flags.caveats.includes("regime_sensitive")
        ? ", and the result changes once the elevated-price weeks are removed"
        : "";

  return `${own} ${ASSOCIATION_CLAUSE[flags.evidenceGroup]}${qualifier}.`;
}

/**
 * The note that says the finished synthesis narrative is still to be written.
 *
 * Rendered visibly rather than left as a code comment, because a reader is entitled to
 * know which parts of a report are settled. The evidence in the rows is final — it is
 * read from the artifacts — and the interpretive prose around it is not.
 */
export const MARKET_SYNTHESIS_WORDING_NOTE =
  "The evidence in each row is read from the generated artifacts and is final. The " +
  "interpretive narrative that will surround it — the argument each panel makes — is " +
  "still being written, and the panel names remain editorial readings rather than " +
  "findings.";
