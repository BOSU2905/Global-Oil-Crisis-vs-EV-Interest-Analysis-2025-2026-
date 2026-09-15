/**
 * Shared vocabulary for the content components.
 *
 * WHY THIS IS NOT INSIDE THE COMPONENTS
 * The same two reasons as `layout/contract.ts`: several components must agree on
 * one set of tones and ids, and Node cannot load `.tsx`, so anything expressed
 * here is unit-testable while anything expressed in a component is only testable
 * once rendered.
 *
 * The important thing in this file is not the tone maps — it is `MetricContent`.
 * KIRO.md §16 requires that a level correlation never appear without the
 * specification comparison beside it. That rule has been enforced by review until
 * now. `MetricCard` and `StatHighlight` are the first components that render a
 * statistic, so the rule is expressed as a type here instead: an `inferential`
 * metric cannot be constructed without a `specification` string and at least one
 * caveat, and `tsc` rejects the attempt. A structural caveat slot is one the
 * compiler enforces, not one a developer remembers.
 */

// ---------------------------------------------------------------------------
// Tones
// ---------------------------------------------------------------------------

/**
 * Badge tones. `neutral` is the default because a badge's meaning must come from
 * its text: design-system.md §2 and the accessibility contract both forbid colour
 * as the sole carrier of information, so a tone only ever reinforces a word that
 * is already there.
 */
export type BadgeTone = "neutral" | "info" | "warning" | "caution" | "positive";

/** Badge tone → utilities. Semantic tokens only; no palette literal appears. */
export const BADGE_TONE_CLASS: Readonly<Record<BadgeTone, string>> = {
  neutral: "border-border-strong bg-surface-raised text-fg-secondary",
  info: "border-border-strong bg-info-surface text-info",
  warning: "border-border-strong bg-warning-surface text-warning",
  caution: "border-border-strong bg-negative-surface text-negative",
  positive: "border-border-strong bg-positive-surface text-positive",
};

/**
 * Callout tones. Deliberately the same four status surfaces the tokens define —
 * a fifth tone would mean a fifth meaning the design system has not decided.
 */
export type CalloutTone = "info" | "warning" | "caution" | "positive";

export const CALLOUT_TONE_CLASS: Readonly<Record<CalloutTone, string>> = {
  info: "border-border bg-info-surface",
  warning: "border-border bg-warning-surface",
  caution: "border-border bg-negative-surface",
  positive: "border-border bg-positive-surface",
};

/** Callout tone → badge tone, so a callout's badge cannot contradict its surface. */
export const CALLOUT_BADGE_TONE: Readonly<Record<CalloutTone, BadgeTone>> = {
  info: "info",
  warning: "warning",
  caution: "caution",
  positive: "positive",
};

// ---------------------------------------------------------------------------
// The §16 gate: a statistic and the caveat it cannot be shown without
// ---------------------------------------------------------------------------

/** One caveat. `code` is the badge text; `detail` is the sentence beside it. */
export interface MetricCaveat {
  /** Short, upper-cased by CSS. Read as a word, never as a colour. */
  readonly code: string;
  readonly detail: string;
}

interface MetricBase {
  readonly label: string;
  /**
   * The value as it should appear, ALREADY FORMATTED.
   *
   * A string, not a number, on purpose: rounding a coefficient is a
   * presentational decision that must be made once, in the pipeline or in an
   * accessor, not per component. Passing a string also makes it impossible for a
   * component to do arithmetic on a statistic on its way to the screen.
   */
  readonly value: string;
  readonly unit?: string;
  /** Confidence interval, pre-formatted by the pipeline. */
  readonly interval?: string;
}

/**
 * A count, a date range, a coverage figure — something the pipeline observed
 * rather than inferred. Caveats are optional because there may be nothing to
 * qualify.
 */
export interface DescriptiveMetric extends MetricBase {
  readonly kind: "descriptive";
  readonly caveats?: readonly MetricCaveat[];
}

/**
 * A coefficient, p-value or interval — anything inferential.
 *
 * `specification` and a non-empty `caveats` are REQUIRED, which is KIRO.md §16
 * expressed as a type. §16 exists because the project's central finding is that
 * zero of six series survive first differencing: a level correlation shown
 * without that comparison is the original project's error, and this is the type
 * that makes repeating it a compile error.
 */
export interface InferentialMetric extends MetricBase {
  readonly kind: "inferential";
  /** The specification comparison, e.g. "first-difference r = -0.116". */
  readonly specification: string;
  /** At least one. The tuple type is what makes "at least one" checkable. */
  readonly caveats: readonly [MetricCaveat, ...MetricCaveat[]];
}

export type MetricContent = DescriptiveMetric | InferentialMetric;

export const MISSING_SPECIFICATION_MESSAGE =
  "An inferential statistic must carry its specification comparison (KIRO.md §16)";
export const MISSING_CAVEAT_MESSAGE =
  "An inferential statistic must carry at least one caveat (KIRO.md §16)";

/**
 * Runtime half of the same gate.
 *
 * The type stops a missing field; it cannot stop an empty string arriving from a
 * template literal or an artifact field that happens to be blank. Both halves are
 * needed, and this one is unit-testable.
 */
export function assertMetricDisplayable(metric: MetricContent): void {
  if (metric.kind !== "inferential") return;
  if (metric.specification.trim() === "") {
    throw new Error(`${MISSING_SPECIFICATION_MESSAGE}: ${metric.label}`);
  }
  if (metric.caveats.length === 0 || metric.caveats.every((c) => c.code.trim() === "")) {
    throw new Error(`${MISSING_CAVEAT_MESSAGE}: ${metric.label}`);
  }
}

// ---------------------------------------------------------------------------
// ReadMore ids
// ---------------------------------------------------------------------------

/**
 * `aria-controls` on the button must name the panel, and the panel must carry
 * exactly that id. Deriving both from one function is what stops them drifting —
 * the same argument as `sectionTitleId`.
 */
export function readMorePanelId(id: string): string {
  return `${id}-detail`;
}

export function readMoreToggleId(id: string): string {
  return `${id}-toggle`;
}

/** Closed and open labels. The label changes, so the control is never icon-only. */
export const READ_MORE_LABEL = "Read more";
export const READ_LESS_LABEL = "Show less";
