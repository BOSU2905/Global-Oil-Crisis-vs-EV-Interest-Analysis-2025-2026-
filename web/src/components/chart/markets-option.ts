/**
 * The option builder for "EV Interest Across Five Markets".
 *
 * WHAT THE HONESTY RISK IS HERE, AND WHY IT IS NOT THE PROTOTYPE'S RISK
 * The oil-vs-interest chart's risk is two units on two axes: pick the scales badly
 * and you manufacture a relationship. This chart has ONE unit and one axis, and its
 * risk is the opposite shape — five series that look directly comparable and are not.
 * Each Google Trends export is an independent query rescaled so its own maximum week
 * equals 100, so every line touches 100 somewhere and a line at 90 says nothing about
 * a line at 70.
 *
 * Three things in this file exist only to contain that:
 *
 *   1. **The axis names the normalisation.** `MARKETS_AXIS_TITLE` is
 *      "Search interest index (0–100, per market)" rather than "Search interest". The
 *      axis is where the misreading starts, so it is where the qualification goes.
 *   2. **The axis is the measure's domain, 0-100, never the sample's range.** Five
 *      auto-scaled lines would each be stretched by a different factor, which makes
 *      even the shapes incomparable.
 *   3. **No series is an aggregate.** There is no mean line, no combined index and no
 *      ordering by value. Series order is the registry's order, and the z-order
 *      follows it, so nothing is drawn "on top" as a matter of importance.
 *
 * FIVE LINES AND THE COLOURBLIND PAIR
 * `SERIES_IDENTITY` gives every market a colour, a dash pattern and a marker shape,
 * and this builder uses all three. That is not belt-and-braces: cyan (Singapore) and
 * blue (United States) are the closest hues in the palette, so the dash is what tells
 * them apart when the colour does not.
 *
 * PEAK ANNOTATION, DELIBERATELY QUIET
 * Five labelled peaks on one plot collide at every width — the two February peaks are
 * the same week. So each market's peak is a small hollow marker with no label, the
 * tooltip tags the peak week when the reader is on it, the legend states each peak
 * date without any hover at all, and the fallback table names them per row. The
 * information is never hover-only, and the plot is never a label pile.
 */

import type { CountryId } from "../../data/index.ts";
import type { MarketsChartData } from "../../lib/interest-across-markets.ts";
import { MARKET_INTEREST_AXIS } from "../../lib/interest-across-markets.ts";
import type { ChartTheme } from "../../styles/chart-language.ts";
import { SERIES_IDENTITY, axisTickBudget } from "../../styles/chart-language.ts";
import {
  CHART_TOOLTIP_CLASS as TOOLTIP_CLASS,
  formatWeek,
  formatWeekShort,
} from "./contract.ts";
import {
  AXIS_LABEL_MARGIN,
  GRID_PADDING,
  animationOptions,
  annotationLabelsFit,
  axisCommon,
  dashArray,
  figureText,
  insideZoom,
  proseText,
  pxFor,
  seriesAnimation,
  sliderZoom,
  splitLine,
  type ColourResolver,
  type OptionObject,
  type OptionValue,
} from "./echarts-theme.ts";
import { MARKETS_AXIS_TITLE, formatMarketIndex } from "./markets-contract.ts";

export interface BuildMarketsOptionArgs {
  readonly data: MarketsChartData;
  readonly theme: ChartTheme;
  readonly resolveColour: ColourResolver;
  /** Rendered width in px. Decides tick density and legend/slider room. */
  readonly widthPx: number;
  /** Computed `font-size` of `:root`, in px. See `lengthToPx` for why. */
  readonly rootFontSizePx: number;
  /**
   * Markets the reader has hidden through the legend.
   *
   * Filtered into the option rather than dispatched through `legendToggleSelect`, for
   * the same measured reason as the prototype: with the canvas legend off it is the
   * legend component that would have applied the selection, so the action updated the
   * model and changed nothing on screen. The axis domain is fixed at 0-100, so hiding
   * a market cannot rescale the rest.
   */
  readonly hiddenMarkets?: readonly CountryId[];
  /** True exactly once per mount. False under `prefers-reduced-motion`. */
  readonly animate?: boolean;
}

/** One entry from ECharts' `trigger: "axis"` callback. */
interface AxisTooltipParam {
  readonly axisValue?: string;
}

/**
 * Room below the plot for the zoom slider, in pixels.
 *
 * The slider is 26px tall and sits at `bottom: 0`, so the grid has to end above it or
 * the week labels are drawn over the track.
 */
const SLIDER_RESERVE = 46;

/**
 * Series names are plain market labels.
 *
 * The prototype appends a unit to each name because its two series are on different
 * scales and the legend is where a reader learns which. Here all five are on the same
 * axis, so repeating "Search interest index" five times would add noise and no
 * information — the axis title carries it once, and carries the normalisation with it.
 */
export const marketSeriesName = (data: MarketsChartData): Readonly<Record<string, string>> => {
  const names: Record<string, string> = {};
  for (const market of data.series) names[market.id] = market.label;
  return names;
};

// ---------------------------------------------------------------------------
// Tooltip — the synchronised weekly readout
// ---------------------------------------------------------------------------

/**
 * One week, five markets, in one readout.
 *
 * This is what makes the chart answer its question. A reader comparing timing needs
 * all five values for the same week side by side; five separate hovers would make
 * them compare from memory.
 *
 * WHAT IS NOT IN IT: classifications. No evidence group, no robustness, no
 * coefficient. Those belong to the synthesis rows and to the robustness section,
 * where the specification comparison can sit beside them. A tooltip that tried to
 * carry them would be a statistics panel that happens to follow the pointer.
 */
export function buildMarketsTooltipFormatter(
  args: BuildMarketsOptionArgs,
): (weekStart: string) => string {
  const { data, theme, resolveColour } = args;
  const byWeek = new Map(data.weeks.map((week) => [week.weekStart, week]));
  const hidden = new Set(args.hiddenMarkets ?? []);

  const swatch = (colour: string, dash: readonly number[] | null): string =>
    `<span style="display:inline-block;width:12px;height:0;border-top:2px ` +
    `${dash === null ? "solid" : "dashed"} ${colour};vertical-align:middle;` +
    `margin-right:8px"></span>`;

  return (weekStart: string): string => {
    const week = byWeek.get(weekStart);
    if (week === undefined) return "";

    const heading =
      `<div style="color:${theme.tooltipFg};font-weight:500">Week of ` +
      `${formatWeek(week.weekStart)}</div>` +
      `<div style="color:${theme.tooltipMutedFg};font-size:11px;margin-top:2px">` +
      `${formatWeek(week.weekStart)} – ${formatWeek(week.weekEnd)}</div>`;

    const rows: string[] = [];
    for (const market of data.series) {
      if (hidden.has(market.id)) continue;
      const identity = SERIES_IDENTITY[market.id];
      const colour = resolveColour(identity.colorVariable);
      const isPeak = market.peakWeek === week.weekStart;
      rows.push(
        `<div style="display:flex;align-items:baseline;justify-content:space-between;` +
          `gap:16px;margin-top:6px"><span style="color:${theme.tooltipMutedFg}">` +
          `${swatch(colour, identity.dash)}${market.label}</span>` +
          `<span style="color:${theme.tooltipFg};font-variant-numeric:tabular-nums">` +
          `${formatMarketIndex(week.values[market.id])}` +
          (isPeak ? `<span style="color:${theme.tooltipMutedFg}"> · own peak</span>` : "") +
          `</span></div>`,
      );
    }

    // Notes in words, never colour alone.
    const notes: string[] = [];
    if (week.regime === "elevated") notes.push("Elevated crude-price window");
    if (week.isPartialWeek) notes.push("Partial week — fewer than five trading days");
    notes.push("Each market is scaled to its own maximum");
    const note =
      `<div style="color:${theme.tooltipMutedFg};font-size:11px;margin-top:8px;` +
      `padding-top:6px;border-top:1px solid ${theme.tooltipBorder}">` +
      `${notes.join(" · ")}</div>`;

    return `<div style="min-width:240px">${heading}${rows.join("")}${note}</div>`;
  };
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

/**
 * One market's line, with its peak marked and nothing else added.
 *
 * `connectNulls: false` for the same reason as everywhere else in this layer: the
 * panel has no missing interest observations today, and a builder that would join
 * across one if it appeared is a builder that will eventually draw a segment the data
 * does not contain.
 */
function marketSeries(
  args: BuildMarketsOptionArgs,
  market: MarketsChartData["series"][number],
  index: number,
): OptionObject {
  const { data, theme, resolveColour } = args;
  const px = pxFor(args.rootFontSizePx);
  const identity = SERIES_IDENTITY[market.id];
  const colour = resolveColour(identity.colorVariable);
  const motion = { animate: args.animate !== false };
  const names = marketSeriesName(data);

  return {
    id: market.id,
    name: names[market.id],
    type: "line",
    xAxisIndex: 0,
    yAxisIndex: 0,
    // Verbatim. Already 0-100 from Google Trends; normalising again is forbidden.
    data: data.weeks.map((week) => week.values[market.id]),
    connectNulls: false,
    showSymbol: false,
    symbol: identity.marker === "none" ? "circle" : identity.marker,
    symbolSize: px(theme.pointRadius) * 2,
    lineStyle: {
      color: colour,
      width: px(theme.lineWidth),
      // Redundant encoding #1. Cyan and blue are the closest pair in the palette.
      type: identity.dash === null ? "solid" : [...identity.dash],
    },
    itemStyle: { color: colour },
    emphasis: {
      focus: "none",
      lineStyle: { width: px(theme.lineWidthEmphasis) },
      itemStyle: { borderWidth: 0 },
    },
    // The peak, marked and not labelled. A hollow marker at the artifact's own peak
    // week: visible without a hover, and incapable of colliding with four others.
    markPoint: {
      silent: true,
      symbol: "circle",
      symbolSize: px(theme.pointRadiusEmphasis) * 2,
      itemStyle: {
        color: "transparent",
        borderColor: colour,
        borderWidth: px(theme.lineWidth),
      },
      label: { show: false },
      data: [{ xAxis: market.peakWeek, yAxis: peakValue(data, market.id) }],
    },
    ...seriesAnimation(motion, index),
    z: 2 + index,
  };
}

/**
 * The plotted value at a market's peak week, read from the panel row.
 *
 * NOT a maximum scan. `metrics.global.peak_dispersion.peaks` says which week the peak
 * is in; this looks up the value the chart is already drawing at that week, so the
 * marker sits on the line rather than near it. Scanning the series for its largest
 * value would be a second analytical source — and one that would silently disagree
 * with the artifact wherever the peak is tied.
 */
function peakValue(data: MarketsChartData, id: CountryId): number {
  const peakWeek = data.series.find((market) => market.id === id)?.peakWeek;
  const week = data.weeks.find((entry) => entry.weekStart === peakWeek);
  return week === undefined ? MARKET_INTEREST_AXIS.max : week.values[id];
}

/**
 * The elevated crude-price window, as a band behind the lines.
 *
 * It is CONTEXT, not a second measure: the chart plots no price. The band answers
 * "where was the price shock relative to these turns", which is the question a reader
 * comparing timing will ask, and the label says "Elevated crude price" rather than
 * anything implying the two are linked.
 *
 * Suppressed entirely when `regimes_separated` is false. An artifact that says "do not
 * present this as a distinct regime" is honoured by drawing nothing, not by drawing it
 * more faintly.
 */
function regimeBand(args: BuildMarketsOptionArgs): OptionObject {
  const { data, theme, resolveColour } = args;
  const px = pxFor(args.rootFontSizePx);
  const { oilContext } = data;
  if (!oilContext.regimesSeparated) return {};

  return {
    markArea: {
      silent: true,
      itemStyle: {
        color: resolveColour("--chart-regime-fill"),
        borderColor: resolveColour("--chart-regime-edge"),
        borderWidth: 1,
      },
      label: {
        // The band still draws below `md`; only its text is withheld, because at 300px
        // across five lines the label lands on the data. The note under the chart names
        // the window's start and end weeks in words.
        show: annotationLabelsFit(args.widthPx),
        position: "insideTop",
        formatter: "Elevated crude price",
        ...proseText(theme.regimeLabelFg, theme.annotationSize, px),
      },
      data: [[{ xAxis: oilContext.onsetWeek }, { xAxis: oilContext.lastOilWeek }]],
    },
  };
}

// ---------------------------------------------------------------------------
// The option
// ---------------------------------------------------------------------------

export function buildMarketsOption(args: BuildMarketsOptionArgs): OptionObject {
  const { data, theme, widthPx } = args;
  const px = pxFor(args.rootFontSizePx);
  const weeks = data.weeks.map((week) => week.weekStart);
  const hidden = new Set(args.hiddenMarkets ?? []);
  const motion = { animate: args.animate !== false };
  const names = marketSeriesName(data);
  const formatWeekTooltip = buildMarketsTooltipFormatter(args);

  const tickInterval = Math.max(1, Math.ceil(weeks.length / axisTickBudget(widthPx)) - 1);

  const visible = data.series.filter((market) => !hidden.has(market.id));

  const series: OptionObject[] = visible.map((market, index) => {
    const built = marketSeries(args, market, index);
    // The band belongs to the plot, not to a market, so it is attached to whichever
    // series draws first. Attaching it to all five would draw it five times over.
    return index === 0 ? { ...built, ...regimeBand(args) } : built;
  });

  return {
    ...animationOptions(motion),
    backgroundColor: "transparent",
    grid: {
      top: GRID_PADDING.top,
      left: GRID_PADDING.left,
      right: GRID_PADDING.right,
      // Room for the visible zoom slider below the week labels.
      bottom: SLIDER_RESERVE,
      containLabel: true,
    },
    // Declared but not drawn: ECharts needs a legend model, and `ChartLegend` renders
    // the operable control as real buttons. See the prototype's note.
    legend: {
      show: false,
      data: data.series.map((market) => names[market.id]),
      selectedMode: true,
    },
    tooltip: {
      trigger: "axis",
      triggerOn: "mousemove|click",
      enterable: false,
      // Keeps the readout inside the chart box, which is what stops a five-row
      // tooltip running off the side of a 375px viewport.
      confine: true,
      className: TOOLTIP_CLASS,
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      borderWidth: 1,
      padding: px(theme.tooltipPadding),
      extraCssText: `border-radius:${theme.tooltipRadius};box-shadow:${theme.tooltipShadow}`,
      textStyle: { color: theme.tooltipFg, fontSize: 12 },
      axisPointer: {
        type: "line",
        lineStyle: {
          color: theme.crosshairColor,
          width: 1,
          type: dashArray(theme.crosshairDash),
        },
        // Snap to the observation: the data is weekly, and a pointer floating between
        // two weeks points at nothing.
        snap: true,
        label: { show: false },
      },
      formatter: (params: readonly AxisTooltipParam[] | AxisTooltipParam): string => {
        const first = Array.isArray(params) ? params[0] : params;
        const week = first?.axisValue;
        return week === undefined ? "" : formatWeekTooltip(week);
      },
    },
    /*
      TWO ZOOM COMPONENTS, ONE AXIS.

      The slider is the PRIMARY control: it is visible, it shows how much of the
      period is in view, and it needs no modifier key. The inside component is the
      accelerator — drag inside the plot to pan, pinch on a trackpad to zoom — and it
      keeps the plain wheel scrolling the page, because a chart in a long-scroll
      article that swallows the wheel is worse than one that does not zoom.

      Both target xAxis 0, so ECharts links them: a reset dispatched at index 0
      returns both. `EChart` relies on that.
    */
    dataZoom: [
      insideZoom([0]),
      sliderZoom(theme, args.resolveColour, [0], px),
    ] as readonly OptionValue[],
    xAxis: [
      {
        type: "category",
        data: weeks,
        boundaryGap: false,
        ...axisCommon(theme, px, "center"),
        axisLabel: {
          ...figureText(theme, theme.axisLabelColor, theme.axisLabelSize, px),
          // Breathing room from the value column beside it: with `boundaryGap: false`
          // the first week label is centred on the y-axis line.
          margin: AXIS_LABEL_MARGIN.category,
          interval: tickInterval,
          hideOverlap: true,
          formatter: (value: string): string => formatWeekShort(value),
        },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        type: "value",
        // The axis title carries the normalisation, because the axis is where the
        // misreading starts.
        name: MARKETS_AXIS_TITLE,
        nameLocation: "end",
        nameGap: 12,
        min: MARKET_INTEREST_AXIS.min,
        max: MARKET_INTEREST_AXIS.max,
        interval: MARKET_INTEREST_AXIS.interval,
        // Left-anchored: this title is long by design, and centring it on the axis put
        // its first word outside the canvas.
        ...axisCommon(theme, px, "left"),
        axisLabel: {
          ...figureText(theme, theme.axisLabelColor, theme.axisLabelSize, px),
          margin: AXIS_LABEL_MARGIN.value,
        },
        splitLine: splitLine(theme, px),
      },
    ],
    series,
  };
}
