/**
 * Shared vocabulary for the five-market chart.
 *
 * WHY IT IS A SEPARATE FILE FROM `contract.ts`
 * `contract.ts` is the oil-vs-interest chart's contract, and its own header says it
 * exists for one chart. Rather than swell it into a registry of every chart, each
 * chart keeps its own ids, accessibility contract and capability set, and the two
 * share only what is genuinely shared: the week formatters and the tooltip class,
 * imported from there, and the token-to-option translation in `echarts-theme.ts`.
 *
 * THE ACCESSIBILITY CONTRACT IS BUILT, NOT DECLARED
 * The prototype's is a `const`, because its two series have fixed names. This one is
 * a function of the selected data, and that is the point: five market labels, five
 * peak dates and the peak spread all have to appear in the long description, and
 * every one of them must be READ from the artifacts. A hand-written contract would
 * be five dates and a span typed into a component — which is exactly the class of
 * literal the chart layer's ISO-date scan exists to forbid.
 */

import type { MarketsChartData } from "../../lib/interest-across-markets.ts";
import type { ChartAccessibilityContract } from "../../styles/chart-language.ts";
import { assertInteractionsCoherent } from "../../styles/chart-language.ts";
import type { ChartInteractionCapabilities } from "../../styles/chart-language.ts";
import { formatWeek } from "./contract.ts";
import type { ChartTableCellRow } from "./contract.ts";

/** Stable id. Used for element ids and the fallback's labels. */
export const MARKETS_CHART_ID = "ev-interest-markets-chart";

/** The single y-axis title. It names the normalisation, because the axis is the lie. */
export const MARKETS_AXIS_TITLE = "Search interest index (0–100, per market)";

/**
 * Interactions this chart declares.
 *
 *   zoom / pan     31 weekly points across five markets, and the question is timing —
 *                  reading a four-week window closely is the whole job
 *   reset          mandatory whenever zoom or pan is on
 *   inspect        the synchronised weekly readout is the chart's main affordance:
 *                  five values for one week is what makes the comparison possible
 *   legendToggle   five lines is the most a reader can hold at once; isolating two
 *                  of them is how a shape gets checked without the others in the way
 *   highlight      off: with five series, dimming four on every hover is motion the
 *                  reader did not ask for, and the tooltip already names all five
 *   brush          off: nothing to publish a range to yet
 *   exportData     off: the tabular fallback already exposes every row
 */
export const MARKETS_INTERACTIONS: ChartInteractionCapabilities = {
  zoom: true,
  pan: true,
  reset: true,
  inspect: true,
  legendToggle: true,
  highlight: false,
  brush: false,
  exportData: false,
};

// Fails the module import — and therefore the build and the test run — rather than
// shipping a zoomable chart a reader can get stranded inside.
assertInteractionsCoherent(MARKETS_INTERACTIONS);

/**
 * The sentence that has to sit beside this chart, in the reader's words.
 *
 * It is exported rather than inlined because three places need exactly the same
 * claim — the chart's visible description, its long description, and the callout in
 * the section around it — and three paraphrases of a guardrail is how a guardrail
 * gets softened.
 */
export const NORMALISATION_CAVEAT =
  "Google Trends is normalised independently within each market. Compare the shape " +
  "and timing of each country's series, not the absolute height of one country's " +
  "line against another.";

/**
 * Build the accessibility contract from the selected data.
 *
 * §5 rule 3: the long description must state the FINDING, not the axes. The finding
 * here is the peak dispersion — the markets did not turn at the same time — plus the
 * constraint that makes the obvious alternative reading invalid. Every date, label
 * and count below is read; none is typed.
 *
 * WHAT THE WORDING MAY NOT SAY
 * No causal language, and no cross-market level comparison. The denial of causation
 * is explicit rather than implied, because the chart puts five rising lines beside an
 * elevated-price band and a reader is entitled to assume that is the argument. It is
 * not: `metrics.json` classifies three of these five markets as having no detectable
 * or inconclusive association, and none of the six series in the project survives
 * first differencing as a positive relationship.
 */
export function buildMarketsA11y(data: MarketsChartData): ChartAccessibilityContract {
  const peakSentence = data.series
    .map((market) => `${market.label} in the week of ${formatWeek(market.peakWeek)}`)
    .join(", ");

  const spread = data.peakSpread;

  return {
    title: "EV Search Interest Across Five Markets, by Week",
    description:
      "Five Google Trends series over the same weeks, each scaled to its own maximum. " +
      "Look at when each line turns and how steeply, not at how high one sits against " +
      "another.",
    longDescription:
      `Five markets over ${String(data.coverage.trendsWeeks)} weeks, from the week of ` +
      `${formatWeek(data.coverage.firstWeek)} to the week of ` +
      `${formatWeek(data.coverage.lastWeek)}. Each series is a separate Google Trends ` +
      `query rescaled so its own highest week equals 100, so every line reaches 100 ` +
      `somewhere and the heights cannot be compared between markets. What can be ` +
      `compared is timing, and the timing differs: interest peaked at ${peakSentence}. ` +
      `Those peaks fall in ${String(spread.distinctWeeks)} distinct weeks across ` +
      `${String(spread.distinctMonths.length)} calendar months and span ` +
      `${String(spread.spanWeeks)} weeks, so they are ` +
      `${spread.synchronisedWithinOneMonth ? "synchronised" : "not synchronised"} within a ` +
      `single month. The shaded band marks the elevated crude-price window, shown as ` +
      `context for the timing rather than as an explanation of it. Nothing here ` +
      `establishes that oil prices caused any of these movements.`,
    tableColumns: ["Week", ...data.series.map((market) => market.label), "Note"],
    source: "Google Trends, with the elevated-price window from FRED (DCOILBRENTEU)",
    hasProvisionalData: data.coverage.partialWeeks.length > 0,
  };
}

/**
 * One row of the tabular fallback: a week, five values, and a note in words.
 *
 * `values` is an array aligned with `data.series`, not a map, because the table
 * renders columns in the same order as the legend and a map would let the two drift.
 */
export interface MarketTableRow {
  readonly week: string;
  readonly values: readonly string[];
  readonly note: string;
}

/** Fixed-precision display, so a column of figures reads as a column. */
export const formatMarketIndex = (value: number): string => value.toFixed(0);

/**
 * Build the fallback rows from the same selected data the chart draws.
 *
 * ONE SOURCE, TWO REPRESENTATIONS. A fallback built from its own query is a fallback
 * that can disagree with the chart, and the disagreement would appear only to the
 * readers who depend on the table.
 *
 * The note column carries three facts in words, because §5 rule 7 forbids colour as
 * the only cue and a table has no other way to mark a row: which markets peak that
 * week, whether the week is inside the elevated crude-price window, and whether the
 * week is partial.
 */
export function buildMarketTableRows(data: MarketsChartData): readonly MarketTableRow[] {
  const partial = new Set(data.coverage.partialWeeks);

  return data.weeks.map((week) => {
    const notes: string[] = [];

    const peaking: string[] = [];
    for (const market of data.series) {
      if (market.peakWeek === week.weekStart) peaking.push(market.label);
    }
    if (peaking.length > 0) notes.push(`Peak: ${peaking.join(", ")}`);
    if (week.regime === "elevated") notes.push("Elevated crude price");
    if (partial.has(week.weekStart)) notes.push("Partial week");

    return {
      week: formatWeek(week.weekStart),
      values: data.series.map((market) => formatMarketIndex(week.values[market.id])),
      note: notes.length === 0 ? "—" : notes.join(" · "),
    };
  });
}

/**
 * Positional rows for `ChartTableFallback`.
 *
 * The values are already in `data.series` order, which is the order
 * `buildMarketsA11y` uses for `tableColumns` and the order `ChartLegend` renders. One
 * order, decided in the selector, carried through every representation — a unit test
 * asserts the column headers and the cells still line up.
 */
export function toMarketTableCells(
  rows: readonly MarketTableRow[],
): readonly ChartTableCellRow[] {
  return rows.map((row) => ({
    header: row.week,
    values: row.values,
    note: row.note,
  }));
}
