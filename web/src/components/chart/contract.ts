/**
 * Shared vocabulary for the chart layer.
 *
 * Same reasoning as `layout/contract.ts` and `content/contract.ts`: several
 * components must agree on one set of ids, labels and capabilities, and Node
 * cannot load `.tsx`, so anything expressed here is unit-testable while anything
 * expressed in a component is only testable once rendered.
 *
 * SCOPE: this exists for ONE chart. `docs/product-architecture.md` §4 names four
 * chart components and a theme adapter; this file holds what those four need to
 * agree on and nothing more. No registry of future charts, no generic series
 * abstraction, no option-builder framework — those would be speculative
 * abstractions for charts that do not exist, which §4's "deliberately not built"
 * list rules out.
 */

import type { OilInterestChartData } from "../../lib/oil-vs-interest.ts";
import type { ChartAccessibilityContract } from "../../styles/chart-language.ts";
import { assertInteractionsCoherent } from "../../styles/chart-language.ts";
import type { ChartInteractionCapabilities } from "../../styles/chart-language.ts";

/** Stable id for the prototype. Used for element ids and the fallback's labels. */
export const OIL_VS_INTEREST_CHART_ID = "oil-vs-interest-chart";

/**
 * Class placed on the ECharts tooltip element.
 *
 * ECharts renders its tooltip into a bare `div` with inline styles and no hook, which
 * makes "is the readout showing, and what does it say" unanswerable from the DOM. A
 * named class turns that into a direct query, and it is what the E2E suite uses
 * instead of scanning every `div` on the page for matching text.
 */
export const CHART_TOOLTIP_CLASS = "oil-ev-chart-tooltip";

/**
 * Which axis a series belongs to, as a named constant rather than a bare index.
 *
 * `yAxisIndex: 0` scattered through an option object is exactly how a series ends
 * up on the wrong axis — silently, because ECharts will happily plot a 0-100 index
 * against a dollar scale. Naming it makes the binding assertable.
 */
export const AXIS_INDEX = {
  /** Left axis. USD per barrel. */
  oil: 0,
  /** Right axis. Google Trends index, 0-100. */
  interest: 1,
} as const;

/**
 * Axis titles. Short enough to sit on the axis, explicit enough that a reader
 * cannot mistake one unit for the other — which is the whole obligation of a
 * dual-axis chart.
 */
export const AXIS_TITLE = {
  oil: "USD / barrel",
  interest: "Search interest index",
} as const;

/**
 * Interactions this chart declares. Deliberately not the full capability set:
 * `chart-language.ts` requires each one to answer an analytical question.
 *
 *   zoom / pan       31 weekly points is few, but the elevated regime is four of
 *                    them, and reading that window closely is a real question
 *   reset            mandatory whenever zoom or pan is on
 *   inspect          the per-week readout is the chart's main affordance
 *   legendToggle     with two units on two axes, isolating one series is how a
 *                    reader checks a shape without the other line in the way
 *   highlight        off: with two series, dimming one adds motion for no gain
 *   brush            off: nothing to publish a range to yet
 *   exportData       off: the tabular fallback already exposes every row
 */
export const OIL_VS_INTEREST_INTERACTIONS: ChartInteractionCapabilities = {
  zoom: true,
  pan: true,
  reset: true,
  inspect: true,
  legendToggle: true,
  highlight: false,
  brush: false,
  exportData: false,
};

// Fails the module import — and therefore the build and the test run — rather
// than shipping a zoomable chart a reader can get stranded inside.
assertInteractionsCoherent(OIL_VS_INTEREST_INTERACTIONS);

/**
 * The accessibility contract for the prototype.
 *
 * `ChartAccessibilityContract` makes title, description, long description, table
 * columns, source and the provisional flag REQUIRED, so a chart cannot ship
 * without them. The long description states the finding rather than describing the
 * axes, per §5 rule 3.
 *
 * WHAT THE WORDING MAY AND MAY NOT SAY
 * No causal language. The two series are described as moving together over the
 * period, and the sentence that follows says the association does not hold once
 * week-to-week changes are compared — both of which are `metrics.json`
 * classifications, not readings of the chart. "Rose alongside" is co-movement;
 * "drove" would be a mechanism this data cannot establish.
 */
export const OIL_VS_INTEREST_A11Y: ChartAccessibilityContract = {
  title: "Brent Crude Price and Worldwide EV Search Interest, by Week",
  description:
    "Two measures on their own scales over the same 31 weeks: Brent crude in US dollars " +
    "per barrel on the left, worldwide electric-car search interest as a 0–100 index on " +
    "the right.",
  longDescription:
    "Brent crude opens the period near 67 dollars a barrel, drifts down to a low in " +
    "mid-December, then climbs steeply through February and March to a peak of 111 dollars " +
    "in the week of 15 March 2026. Worldwide electric-car search interest starts at 60 on " +
    "its own 0–100 index and reaches 100 in the final week, two weeks after the oil peak. " +
    "The two lines rise together across the period. That co-movement is in levels only: " +
    "comparing week-to-week changes instead of levels leaves no detectable relationship, " +
    "and both series also trend upward over time, which alone can produce the pattern. " +
    "Nothing here establishes that one measure caused the other. The 22 March week rests " +
    "on fewer than five trading days and is drawn dashed; the 29 March week has search " +
    "interest but no oil observation, so the price line stops one week early.",
  tableColumns: ["Week", "Brent crude (USD / barrel)", "Search interest (index 0–100)", "Note"],
  source: "FRED (DCOILBRENTEU) and Google Trends",
  hasProvisionalData: true,
} as const;

/**
 * One row of the tabular fallback.
 *
 * `oil` is a string so the formatter runs once, in a testable `.ts` module, rather
 * than in the component — and so a missing observation is rendered as words rather
 * than as an empty cell a reader might read as zero.
 */
export interface ChartTableRow {
  readonly week: string;
  readonly oil: string;
  readonly interest: string;
  readonly note: string;
}

/**
 * The shape `ChartTableFallback` renders, shared by every chart.
 *
 * WHY A SECOND SHAPE EXISTS
 * Because the two charts have different numbers of measures — two here, five in the
 * five-market chart — and one table component is better than two. So each chart keeps
 * a named row type that says what its columns MEAN, and converts to this positional
 * shape in a pure function a unit test can call. The conversion is the only place the
 * column order is decided, and `a11y.tableColumns` is asserted against it.
 *
 * `values` are figures and take `.tabular`; `note` is prose and must not.
 */
export interface ChartTableCellRow {
  /** The observation's identity, rendered as a row header. */
  readonly header: string;
  /** Figures, in the same order as `tableColumns` after the first. */
  readonly values: readonly string[];
  /** Caveats in words: provisional, missing, elevated. Never colour alone. */
  readonly note: string;
}

/** Fixed-precision display, so a column of figures reads as a column. */
export const formatUsdPerBarrel = (value: number): string => value.toFixed(2);
export const formatInterestIndex = (value: number): string => value.toFixed(0);

/** Human week label, e.g. `31 Aug 2025`. Formatting only; the date is verbatim. */
export function formatWeek(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const index = Number(month) - 1;
  const name = months[index];
  if (year === undefined || day === undefined || name === undefined) return isoDate;
  return `${String(Number(day))} ${name} ${year}`;
}

/** Short axis-tick label, e.g. `31 Aug`. The year is in the range caption. */
export function formatWeekShort(isoDate: string): string {
  return formatWeek(isoDate).split(" ").slice(0, 2).join(" ");
}

/**
 * Build the tabular fallback's rows from the same selected data the chart draws.
 *
 * ONE SOURCE, TWO REPRESENTATIONS. The table is not a second dataset assembled
 * alongside the chart — it is the same `OilInterestChartData`, formatted. That
 * matters more than it sounds: a fallback built from its own query is a fallback
 * that can disagree with the chart, and the disagreement would appear only to the
 * readers who depend on the table.
 *
 * Two cells are words rather than numbers, deliberately:
 *
 *   - a week with no oil observation reads "No observation", not an empty cell a
 *     reader could take for zero;
 *   - the note column carries the partial-week and elevated-regime flags as text,
 *     because §5 rule 7 forbids colour as the only cue and a table has no other way
 *     to mark a row.
 *
 * Lives in `.ts` rather than in the component so `node --test` can assert that the
 * table and the chart consume the same values.
 */
export function buildChartTableRows(data: OilInterestChartData): readonly ChartTableRow[] {
  const partial = new Set(data.coverage.partialWeeks);

  return data.points.map((point) => {
    const notes: string[] = [];
    if (partial.has(point.weekStart)) notes.push("Partial week");
    if (point.oilUsdPerBarrel === null) notes.push("Oil series ends earlier");
    if (point.regime === "elevated") notes.push("Elevated");

    return {
      week: formatWeek(point.weekStart),
      oil:
        point.oilUsdPerBarrel === null
          ? "No observation"
          : formatUsdPerBarrel(point.oilUsdPerBarrel),
      interest: formatInterestIndex(point.interestIndex),
      note: notes.length === 0 ? "—" : notes.join(", "),
    };
  });
}

/**
 * Positional rows for `ChartTableFallback`.
 *
 * The column order here is the contract: it must match `OIL_VS_INTEREST_A11Y`'s
 * `tableColumns` after the week, and a unit test asserts exactly that. Keeping the
 * conversion in this module rather than in the component is what makes that assertion
 * possible without a browser.
 */
export function toTableCells(rows: readonly ChartTableRow[]): readonly ChartTableCellRow[] {
  return rows.map((row) => ({
    header: row.week,
    values: [row.oil, row.interest],
    note: row.note,
  }));
}
