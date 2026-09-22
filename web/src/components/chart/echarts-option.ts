/**
 * The option builder for the oil-price / worldwide-interest chart.
 *
 * WHY THIS IS A `.ts` MODULE AND NOT PART OF A COMPONENT
 * Because it is where the chart's honesty lives, and honesty should be testable
 * without a browser. `node --test` can call `buildOilVsInterestOption()` and assert
 * that oil is bound to the left axis in dollars, that interest is bound to the
 * right axis on a fixed 0-100 domain, that neither series' values were touched on
 * the way in, and that every annotation position equals an artifact field. None of
 * that needs a canvas, and all of it is the kind of thing that breaks silently.
 *
 * WHAT MOVED OUT OF HERE
 * The token-to-option translation shared with the five-market chart now lives in
 * `echarts-theme.ts`: length conversion, text styles, axis/grid treatment, the zoom
 * components and the motion switches. This file kept everything specific to *this*
 * chart's argument. `lengthToPx` is re-exported because it is part of the tested
 * surface and its home is now the shared module.
 *
 * THE DUAL-AXIS OBLIGATION
 * Two measures with different units on one chart can manufacture a relationship out
 * of nothing more than the scales chosen for them. Three rules contain that, and
 * all three are asserted:
 *
 *   1. Neither series is rescaled. Oil is plotted in USD per barrel; interest is
 *      plotted on the 0-100 index Google Trends published.
 *   2. The interest axis is fixed to 0-100 — the domain of the measure, not the
 *      range of this sample. Auto-scaling it to 40-100 would stretch the line to
 *      fill the plot and overstate its movement.
 *   3. Both axes carry the same number of gridlines, so the plot has one grid
 *      rather than two overlapping ones, and each axis is named with its unit.
 *
 * BELOW `md` THE CHART STOPS BEING DUAL-AXIS
 * `dualAxisLayout()` in `chart-language.ts` states the rule: two y-axes become
 * unreadable under roughly 768px because tick density collapses and a reader cannot
 * tell which line belongs to which axis. The documented adaptation is two stacked
 * single-axis panels sharing one x-domain — not a shrunken dual-axis chart. That is
 * what this builder emits at mobile width, with a linked axis pointer so one hover
 * still reads both panels.
 */

import type { OilInterestChartData } from "../../lib/oil-vs-interest.ts";
import { INTEREST_AXIS } from "../../lib/oil-vs-interest.ts";
import type { ChartTheme } from "../../styles/chart-language.ts";
import {
  OIL_IDENTITY,
  SERIES_IDENTITY,
  axisTickBudget,
  dualAxisLayout,
} from "../../styles/chart-language.ts";
import {
  AXIS_INDEX,
  AXIS_TITLE,
  CHART_TOOLTIP_CLASS as TOOLTIP_CLASS,
  formatInterestIndex,
  formatUsdPerBarrel,
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
  lengthToPx,
  proseText,
  pxFor,
  seriesAnimation,
  splitLine,
  type ColourResolver,
  type OptionObject,
  type OptionValue,
  type PxConverter,
} from "./echarts-theme.ts";

export { lengthToPx };
export type { ColourResolver, OptionObject, OptionValue, PxConverter };

export interface BuildOptionArgs {
  readonly data: OilInterestChartData;
  readonly theme: ChartTheme;
  readonly resolveColour: ColourResolver;
  /** Rendered width in px. Decides the dual-axis / stacked-panel band. */
  readonly widthPx: number;
  /**
   * Computed `font-size` of `:root`, in px.
   *
   * Required, not defaulted, because the type tokens are authored in `rem` and
   * canvas has no `rem` — see `lengthToPx` for the measured consequence.
   */
  readonly rootFontSizePx: number;
  /**
   * Series the reader has hidden through the legend.
   *
   * Visibility is rebuilt into the option rather than dispatched to ECharts, and that
   * is a measured decision. `legendToggleSelect` is the obvious route, but it is the
   * *legend component* that applies the resulting selection while it renders — with
   * the canvas legend switched off (see the legend block below) the action updated the
   * model and changed nothing on screen. Filtering here works regardless of whether a
   * legend is drawn, and it is checkable in a unit test.
   *
   * Both y-axes carry fixed domains, so removing a series cannot rescale the other.
   */
  readonly hiddenSeries?: readonly SeriesKey[];
  /**
   * Whether this build is the chart's entrance.
   *
   * `true` exactly once per mount, and `false` under `prefers-reduced-motion` and for
   * every rebuild after the first — a legend toggle or a band change must update in
   * place rather than redraw the line from the left edge. Defaults to `true` so a
   * test that does not care about motion still exercises the animated option.
   */
  readonly animate?: boolean;
}

/** The two real series. The provisional overlay is a treatment, not a series. */
export type SeriesKey = "oil" | "interest";

/** One entry from ECharts' `trigger: "axis"` callback. */
interface AxisTooltipParam {
  readonly axisValue?: string;
}

// ---------------------------------------------------------------------------
// Legend labels — where the unit becomes unmissable
// ---------------------------------------------------------------------------

/**
 * Series names carry their unit.
 *
 * This is the cheapest and most effective part of the dual-axis obligation: the
 * legend, the tooltip heading and the accessible series name all then state which
 * scale a line is on, so a reader never has to infer it from which side the line
 * happens to sit closer to.
 */
export const seriesName = (data: OilInterestChartData) =>
  ({
    oil: `${data.labels.oil} — ${AXIS_TITLE.oil}`,
    interest: `${data.labels.interest} — ${AXIS_TITLE.interest}`,
  }) as const;

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

/**
 * The tooltip markup, as a formatter closed over the resolved theme.
 *
 * A custom formatter rather than ECharts' default rows, because the default puts
 * both values in one undifferentiated list — which for two different units is
 * exactly the confusion a dual-axis chart has to avoid. Each row carries its unit,
 * and a week with no oil observation says so in words rather than showing a blank a
 * reader might read as zero.
 */
export function buildTooltipFormatter(args: BuildOptionArgs): (weekStart: string) => string {
  const { data, theme, resolveColour } = args;
  const byWeek = new Map(data.points.map((point) => [point.weekStart, point]));
  const oilColour = resolveColour(OIL_IDENTITY.colorVariable);
  const interestColour = resolveColour(SERIES_IDENTITY.worldwide.colorVariable);
  const hidden = new Set(args.hiddenSeries ?? []);

  const swatch = (colour: string): string =>
    `<span style="display:inline-block;width:10px;height:2px;background:${colour};` +
    `vertical-align:middle;margin-right:8px"></span>`;

  const row = (colour: string, label: string, value: string, unit: string): string =>
    `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;` +
    `margin-top:6px"><span style="color:${theme.tooltipMutedFg}">` +
    `${swatch(colour)}${label}</span>` +
    `<span style="color:${theme.tooltipFg};font-variant-numeric:tabular-nums">${value}` +
    `<span style="color:${theme.tooltipMutedFg}"> ${unit}</span></span></div>`;

  return (weekStart: string): string => {
    const point = byWeek.get(weekStart);
    if (point === undefined) return "";

    const heading =
      `<div style="color:${theme.tooltipFg};font-weight:500">Week of ` +
      `${formatWeek(point.weekStart)}</div>` +
      `<div style="color:${theme.tooltipMutedFg};font-size:11px;margin-top:2px">` +
      `${formatWeek(point.weekStart)} – ${formatWeek(point.weekEnd)}</div>`;

    const oil = hidden.has("oil")
      ? ""
      : point.oilUsdPerBarrel === null
        ? `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:6px">` +
          `<span style="color:${theme.tooltipMutedFg}">${swatch(oilColour)}` +
          `${data.labels.oil}</span><span style="color:${theme.tooltipMutedFg}">` +
          `no observation</span></div>`
        : row(
            oilColour,
            data.labels.oil,
            `$${formatUsdPerBarrel(point.oilUsdPerBarrel)}`,
            "/ barrel",
          );

    const interest = hidden.has("interest")
      ? ""
      : row(
          interestColour,
          data.labels.interest,
          formatInterestIndex(point.interestIndex),
          "/ 100 index",
        );

    // Provisional, missing-oil and regime notes are words, never colour alone.
    const notes: string[] = [];
    if (point.isPartialWeek && !hidden.has("oil")) {
      notes.push("Partial week — fewer than five trading days");
    }
    if (point.oilUsdPerBarrel === null && !hidden.has("oil")) {
      notes.push("Oil series ends one week earlier");
    }
    if (point.regime === "elevated") notes.push("Elevated price window");
    const note =
      notes.length === 0
        ? ""
        : `<div style="color:${theme.tooltipMutedFg};font-size:11px;margin-top:8px;` +
          `padding-top:6px;border-top:1px solid ${theme.tooltipBorder}">` +
          `${notes.join(" · ")}</div>`;

    return `<div style="min-width:210px">${heading}${oil}${interest}${note}</div>`;
  };
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

/**
 * The oil line, in USD per barrel.
 *
 * `connectNulls: false` is load-bearing rather than a default: the final week has
 * no oil observation, and joining across it would draw a segment the data does not
 * contain. The line stops, and the frame footnotes why.
 */
function oilSeries(args: BuildOptionArgs, gridIndex: 0 | 1, yAxisIndex: number): OptionObject {
  const { data, theme, resolveColour } = args;
  const px = pxFor(args.rootFontSizePx);
  const colour = resolveColour(OIL_IDENTITY.colorVariable);
  const motion = { animate: args.animate !== false };

  return {
    id: "oil",
    name: seriesName(data).oil,
    type: "line",
    xAxisIndex: gridIndex,
    yAxisIndex,
    // Verbatim artifact values: no scaling, no fill-forward, no interpolation.
    data: data.points.map((point) => point.oilUsdPerBarrel),
    connectNulls: false,
    showSymbol: false,
    symbol: "circle",
    symbolSize: px(theme.pointRadius) * 2,
    lineStyle: { color: colour, width: px(theme.lineWidth) },
    itemStyle: { color: colour },
    // A very light fill marks oil as the primary series without competing with the
    // interest line. `--chart-area-opacity` is 0.1.
    areaStyle: {
      color: resolveColour(OIL_IDENTITY.fillVariable),
      opacity: Number(theme.areaOpacity),
    },
    emphasis: {
      focus: "none",
      lineStyle: { width: px(theme.lineWidthEmphasis) },
      itemStyle: { borderWidth: 0 },
    },
    // Entrance only: ECharts draws a line in by animating a clip rectangle from left
    // to right. KIRO §10 — the data stays still, the interface breathes — so this
    // animates the line's appearance and never its values.
    ...seriesAnimation(motion, 0),
    z: 2,
  };
}

/**
 * The dashed overlay for the partial week.
 *
 * §5 rule 8: provisional data is dashed AND footnoted, never distinguished by
 * colour alone. ECharts cannot dash one segment of a line, so the segment is a
 * second series carrying only the points that bracket a partial week. It is silent,
 * tooltip-suppressed and absent from the legend, so it reads as a treatment of the
 * oil line rather than as a third measure.
 */
function provisionalOverlay(
  args: BuildOptionArgs,
  gridIndex: 0 | 1,
  yAxisIndex: number,
): OptionObject | null {
  const { data, theme, resolveColour } = args;
  const px = pxFor(args.rootFontSizePx);
  if (data.coverage.partialWeeks.length === 0) return null;

  const partial = new Set(data.coverage.partialWeeks);
  // Include the point before each partial week, so the dashed run connects to the
  // solid line instead of floating.
  const segment = data.points.map((point, index) => {
    const next = data.points[index + 1];
    const isPartial = partial.has(point.weekStart);
    const precedesPartial = next !== undefined && partial.has(next.weekStart);
    return isPartial || precedesPartial ? point.oilUsdPerBarrel : null;
  });

  return {
    id: "oil-provisional",
    name: "provisional",
    type: "line",
    xAxisIndex: gridIndex,
    yAxisIndex,
    data: segment,
    connectNulls: false,
    showSymbol: false,
    silent: true,
    tooltip: { show: false },
    lineStyle: {
      color: resolveColour("--chart-provisional-color"),
      width: px(theme.lineWidthEmphasis),
      type: dashArray(theme.provisionalDash),
    },
    z: 3,
  };
}

/**
 * The worldwide interest line, on the 0-100 index axis.
 *
 * `SERIES_IDENTITY.worldwide` gives it near-ink colour, no dash and no marker,
 * because it is an aggregate rather than a peer of the five markets and must not
 * compete with them for attention in the charts that come later.
 */
function interestSeries(
  args: BuildOptionArgs,
  gridIndex: 0 | 1,
  yAxisIndex: number,
): OptionObject {
  const { data, theme, resolveColour } = args;
  const px = pxFor(args.rootFontSizePx);
  const colour = resolveColour(SERIES_IDENTITY.worldwide.colorVariable);
  const motion = { animate: args.animate !== false };

  return {
    id: "interest",
    name: seriesName(data).interest,
    type: "line",
    xAxisIndex: gridIndex,
    yAxisIndex,
    // Verbatim. Already 0-100 from Google Trends; normalising again is forbidden.
    data: data.points.map((point) => point.interestIndex),
    connectNulls: false,
    showSymbol: false,
    symbol: "circle",
    symbolSize: px(theme.pointRadius) * 2,
    lineStyle: { color: colour, width: px(theme.lineWidth) },
    itemStyle: { color: colour },
    emphasis: {
      focus: "none",
      lineStyle: { width: px(theme.lineWidthEmphasis) },
      itemStyle: { borderWidth: 0 },
    },
    ...seriesAnimation(motion, 1),
    z: 4,
  };
}

// ---------------------------------------------------------------------------
// Annotations — every position is an artifact value
// ---------------------------------------------------------------------------

/**
 * The elevated-price window and the oil peak, both read from `metrics.json`.
 *
 * Attached to the oil series because both are properties of the price path. The
 * band is suppressed entirely when `regimes_separated` is false: the artifact saying
 * "do not present this as a distinct regime" is honoured by drawing nothing, not by
 * drawing it more faintly.
 */
function oilAnnotations(args: BuildOptionArgs): OptionObject {
  const { data, theme, resolveColour } = args;
  const px = pxFor(args.rootFontSizePx);
  const { annotations } = data;
  const showLabels = annotationLabelsFit(args.widthPx);
  const result: Record<string, OptionValue> = {};

  if (annotations.regimesSeparated) {
    result["markArea"] = {
      silent: true,
      itemStyle: {
        color: resolveColour("--chart-regime-fill"),
        borderColor: resolveColour("--chart-regime-edge"),
        borderWidth: 1,
      },
      label: {
        // The band still draws below `md`; only its text is withheld, because at 300px
        // the label lands on the data. The notes under the chart carry the dates.
        show: showLabels,
        position: "insideTop",
        formatter: "Elevated",
        ...proseText(theme.regimeLabelFg, theme.annotationSize, px),
      },
      data: [[{ xAxis: annotations.regimeOnsetWeek }, { xAxis: annotations.lastOilWeek }]],
    };
  }

  result["markLine"] = {
    silent: true,
    symbol: "none",
    lineStyle: {
      color: resolveColour("--chart-annotation-line"),
      width: 1,
      type: dashArray(theme.referenceLineDash),
    },
    label: {
      show: showLabels,
      position: "end",
      formatter: "Oil peak",
      ...proseText(theme.annotationFg, theme.annotationSize, px),
    },
    data: [{ xAxis: annotations.oilPeakWeek }],
  };

  return result;
}

// ---------------------------------------------------------------------------
// The option
// ---------------------------------------------------------------------------

/**
 * Build the full ECharts option.
 *
 * Emits one of two layouts depending on width, per `dualAxisLayout()`: a single
 * grid with two y-axes, or two stacked grids each with one y-axis and a linked
 * axis pointer.
 */
export function buildOilVsInterestOption(args: BuildOptionArgs): OptionObject {
  const { data, theme, widthPx } = args;
  const px = pxFor(args.rootFontSizePx);
  const layout = dualAxisLayout(widthPx);
  const weeks = data.points.map((point) => point.weekStart);
  const names = seriesName(data);
  const formatWeekTooltip = buildTooltipFormatter(args);
  const hidden = new Set(args.hiddenSeries ?? []);
  const motion = { animate: args.animate !== false };
  /** Drop hidden series. The axes have fixed domains, so nothing rescales. */
  const shown = (entries: readonly (OptionObject | null)[]): OptionObject[] =>
    entries.filter((entry): entry is OptionObject => entry !== null);

  // One label per N weeks, so ticks never collide. `axisTickBudget` owns the
  // density decision per breakpoint band.
  const tickInterval = Math.max(1, Math.ceil(weeks.length / axisTickBudget(widthPx)) - 1);

  const tooltip: OptionObject = {
    trigger: "axis",
    // Persists while the pointer is inside the plot and follows it across
    // observations, which is the interaction KIRO §10 specifies.
    triggerOn: "mousemove|click",
    enterable: false,
    confine: true,
    // A stable class on the tooltip element. ECharts renders the tooltip into a bare
    // `div` with inline styles, which leaves no way to distinguish it from the frame's
    // own markup — so the E2E suite could only find it by scanning every `div` for
    // matching text, and picked up the heading rather than the whole readout. Naming
    // it makes "is the tooltip showing, and what does it say" a direct query.
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
  };

  /**
   * THE LEGEND IS HTML, NOT CANVAS.
   *
   * ECharts' own legend is drawn into the canvas, and that fails two requirements at
   * once. §5 rule 6 says every control must be reachable and operable by keyboard: a
   * shape painted on a canvas cannot be tabbed to, focused or announced. And it is
   * untestable except by guessing pixel coordinates — measured, clicks across the
   * whole legend strip toggled nothing detectable.
   *
   * `ChartLegend` renders real `<button>`s instead, and visibility is filtered in this
   * builder rather than dispatched. The canvas legend is therefore off, and the grid
   * reclaims the space it held.
   */
  const legend: OptionObject = {
    // Off, but still declared: ECharts needs a legend MODEL for
    // `legendToggleSelect` to have something to address, and naming the two series
    // here keeps the provisional overlay out of it — that overlay is a treatment of
    // the oil line, not a third measure, and must not be independently hideable.
    show: false,
    data: [names.oil, names.interest],
    selectedMode: true,
  };

  const dataZoom: readonly OptionValue[] = [insideZoom(layout === "dual-axis" ? [0] : [0, 1])];

  const weekAxisLabel: OptionObject = {
    ...figureText(theme, theme.axisLabelColor, theme.axisLabelSize, px),
    // Breathing room between the week labels and the value column beside them. With
    // `boundaryGap: false` the first week label is centred on the y-axis line, so at
    // ECharts' default 8px the date sat directly against the dollar figures.
    margin: AXIS_LABEL_MARGIN.category,
    interval: tickInterval,
    hideOverlap: true,
    formatter: (value: string): string => formatWeekShort(value),
  };

  const usdAxisLabel: OptionObject = {
    ...figureText(theme, theme.axisLabelColor, theme.axisLabelSize, px),
    margin: AXIS_LABEL_MARGIN.value,
    formatter: (value: number): string => `$${String(value)}`,
  };

  const oilAxis = (gridIndex: 0 | 1 | undefined): OptionObject => ({
    // LEFT (or upper panel): oil, in dollars per barrel. Never 0-100.
    type: "value",
    name: AXIS_TITLE.oil,
    nameLocation: "end",
    nameGap: 12,
    ...(gridIndex === undefined ? { position: "left" } : { gridIndex }),
    min: data.oilAxis.min,
    max: data.oilAxis.max,
    interval: data.oilAxis.interval,
    // Left-hand axis: the title's left edge is anchored to the axis, so a long title
    // grows into the plot rather than off the canvas.
    ...axisCommon(theme, px, "left"),
    axisLabel: usdAxisLabel,
    splitLine: splitLine(theme, px),
  });

  const interestAxis = (gridIndex: 0 | 1 | undefined, showGrid: boolean): OptionObject => ({
    // RIGHT (or lower panel): the Google Trends index, on the measure's own domain.
    type: "value",
    name: AXIS_TITLE.interest,
    nameLocation: "end",
    nameGap: 12,
    ...(gridIndex === undefined ? { position: "right" } : { gridIndex }),
    min: INTEREST_AXIS.min,
    max: INTEREST_AXIS.max,
    interval: INTEREST_AXIS.interval,
    // Right-hand in the dual-axis layout, left-hand in the stacked one, and the title
    // anchors to whichever side it sits on.
    ...axisCommon(theme, px, gridIndex === undefined ? "right" : "left"),
    axisLabel: {
      ...figureText(theme, theme.axisLabelColor, theme.axisLabelSize, px),
      margin: AXIS_LABEL_MARGIN.value,
    },
    // In the dual-axis layout the left axis already draws the grid; a second set
    // would double every line.
    splitLine: showGrid ? splitLine(theme, px) : { show: false },
  });

  if (layout === "dual-axis") {
    const oil = { ...oilSeries(args, 0, AXIS_INDEX.oil), ...oilAnnotations(args) };
    const provisional = provisionalOverlay(args, 0, AXIS_INDEX.oil);

    return {
      ...animationOptions(motion),
      backgroundColor: "transparent",
      // Room for both axis titles, and enough left/right padding that the first and
      // last week labels are not clipped at the frame edge.
      grid: {
        top: GRID_PADDING.top,
        left: GRID_PADDING.left,
        right: GRID_PADDING.right,
        bottom: GRID_PADDING.bottom,
        containLabel: true,
      },
      legend,
      tooltip,
      dataZoom,
      xAxis: [
        {
          type: "category",
          data: weeks,
          boundaryGap: false,
          ...axisCommon(theme, px),
          axisLabel: weekAxisLabel,
          splitLine: { show: false },
        },
      ],
      yAxis: [oilAxis(undefined), interestAxis(undefined, false)],
      series: shown([
        hidden.has("oil") ? null : oil,
        // The dashed provisional run is a treatment of the oil line, so it goes with it.
        hidden.has("oil") ? null : provisional,
        hidden.has("interest") ? null : interestSeries(args, 0, AXIS_INDEX.interest),
      ]),
    };
  }

  // Stacked panels: one x-domain, one y-axis each, pointer linked across both.
  const oil = { ...oilSeries(args, 0, 0), ...oilAnnotations(args) };
  const provisional = provisionalOverlay(args, 0, 0);

  return {
    ...animationOptions(motion),
    backgroundColor: "transparent",
    grid: [
      {
        top: GRID_PADDING.top - 6,
        left: GRID_PADDING.left - 4,
        right: GRID_PADDING.right - 4,
        height: "34%",
        containLabel: true,
      },
      {
        top: "60%",
        left: GRID_PADDING.left - 4,
        right: GRID_PADDING.right - 4,
        bottom: GRID_PADDING.bottom,
        containLabel: true,
      },
    ],
    legend,
    tooltip,
    // One hover reads both panels, which is what keeps them one chart rather than
    // two charts that happen to be adjacent.
    axisPointer: { link: [{ xAxisIndex: [0, 1] }], snap: true },
    dataZoom,
    xAxis: [
      {
        type: "category",
        data: weeks,
        boundaryGap: false,
        gridIndex: 0,
        ...axisCommon(theme, px),
        // Only the lower panel carries week labels: repeating them would spend
        // vertical space at the width that has least of it.
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      {
        type: "category",
        data: weeks,
        boundaryGap: false,
        gridIndex: 1,
        ...axisCommon(theme, px),
        axisLabel: weekAxisLabel,
        splitLine: { show: false },
      },
    ],
    yAxis: [oilAxis(0), interestAxis(1, true)],
    series: shown([
      hidden.has("oil") ? null : oil,
      hidden.has("oil") ? null : provisional,
      hidden.has("interest") ? null : interestSeries(args, 1, 1),
    ]),
  };
}
