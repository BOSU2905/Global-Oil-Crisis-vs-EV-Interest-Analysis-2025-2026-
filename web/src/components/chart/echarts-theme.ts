/**
 * What two charts share, extracted once a second chart existed to compare against.
 *
 * WHY THIS FILE DID NOT EXIST BEFORE
 * KIRO.md §10 recorded the rule deliberately: "the prototype built no generic series
 * abstraction — the right time to decide what is shared is when a second chart exists
 * to compare against, not before." The five-market chart is that second chart, and the
 * comparison produced a short list. Everything below appeared identically in both
 * option builders; nothing below is speculative.
 *
 * WHAT IS *NOT* HERE, AND WHY
 * No generic `buildChart(series[])`. The two charts answer different questions and
 * their honesty constraints differ — the prototype's whole risk is two units on two
 * axes, and the five-market chart's whole risk is five independently normalised
 * series on ONE axis. A shared series abstraction would have to be told which risk it
 * is carrying on every call, which is worse than two explicit builders that share
 * their vocabulary.
 *
 * NO STATISTIC IS COMPUTED HERE, and `tests/chart-contract.test.ts` scans this file
 * along with the rest of the chart layer to keep it that way. Every function below is
 * a token-to-option translation.
 */

import type { ChartTheme } from "../../styles/chart-language.ts";
import { BREAKPOINTS } from "../../styles/chart-language.ts";

// ---------------------------------------------------------------------------
// Option shape
// ---------------------------------------------------------------------------

/**
 * Structural type for an ECharts option object.
 *
 * Deliberately loose rather than ECharts' `EChartsOption`: that type is a very
 * large union, and the value of typing here is that a test can read the shape back
 * and that a key cannot be misspelled silently. The library validates its own
 * option at runtime; `EChart.tsx` is the only place the real type matters.
 *
 * Functions are part of the union because ECharts formatters *are* functions. An
 * earlier draft kept the option JSON-serialisable so tests could snapshot it; that
 * was the wrong trade — it pushed formatters into the component and left sentinel
 * keys behind. A test can read `option.yAxis[0].min` perfectly well with functions
 * present, and can call the formatters directly.
 */
export type OptionValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ((...args: never[]) => unknown)
  | OptionObject
  | readonly OptionValue[];

export interface OptionObject {
  readonly [key: string]: OptionValue;
}

/**
 * Turns a `--color-*` variable into a concrete colour. Injected rather than read
 * here, so this module needs no DOM and a test can stub it — which is what makes
 * the series-to-colour binding assertable.
 */
export type ColourResolver = (cssVariableName: string) => string;

// ---------------------------------------------------------------------------
// Lengths: the measured rem bug, contained in one function
// ---------------------------------------------------------------------------

/**
 * Turn a length token into the number of pixels ECharts wants.
 *
 * Handles `rem` and `em` against the supplied root size, and bare numbers and `px`
 * directly. Anything unparseable becomes 0, which is visible as a missing element
 * rather than as a silently wrong one.
 *
 * This exists because of a measured bug. The type tokens are authored in `rem` —
 * `--chart-axis-label-size` is `0.8125rem` — and a custom property resolves to that
 * string verbatim. Canvas has no notion of `rem`, so `parseFloat` yielded a font
 * size of **0.8125 pixels**: axis ticks and legend labels were drawn sub-pixel,
 * invisible, and the canvas legend was consequently impossible to click.
 */
export function lengthToPx(value: string, rootFontSizePx: number): number {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return 0;
  // `em` on a canvas has no element to inherit from, so it is treated as `rem`.
  if (/r?em\s*$/.test(trimmed)) return parsed * rootFontSizePx;
  return parsed;
}

/** A length token converter bound to one root font size. */
export type PxConverter = (value: string) => number;

export const pxFor =
  (rootFontSizePx: number): PxConverter =>
  (value) =>
    lengthToPx(value, rootFontSizePx);

/** `"3 3"` (an SVG dash array) becomes `[3, 3]`; `"0"` becomes solid. */
export const dashArray = (value: string): number[] | "solid" => {
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  return parts.length > 0 ? parts : "solid";
};

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/**
 * Figure text: axis ticks and legend values, in the numeric face.
 *
 * `--chart-axis-label-font` resolves to `--font-numeric`, i.e. Geist Mono. Axis
 * ticks are a column of figures and must align, which is the same reason `.numeric`
 * and `.tabular` both carry tabular figures.
 */
export const figureText = (
  theme: ChartTheme,
  colour: string,
  size: string,
  px: PxConverter,
): OptionObject => ({
  color: colour,
  fontSize: px(size),
  fontFamily: theme.axisLabelFont,
});

/** Prose text: axis titles and annotation labels, in the sans face. */
export const proseText = (colour: string, size: string, px: PxConverter): OptionObject => ({
  color: colour,
  fontSize: px(size),
});

// ---------------------------------------------------------------------------
// Axis and grid spacing — measured, named, and asserted
// ---------------------------------------------------------------------------

/**
 * Distance in pixels between an axis line and its own labels.
 *
 * ECharts defaults both to 8, which is where the reported crowding came from: with
 * `boundaryGap: false` the first week label is centred ON the y-axis line, so at 8px
 * the date sat directly against the dollar column and the two figure runs read as one
 * string. Pushing the week labels 14px below the axis and the value labels 10px away
 * from it separates them without moving the plot.
 *
 * These are chart-local layout numbers, deliberately NOT design tokens: nothing else
 * in the product has an axis, and `--space-*` would have been borrowed rather than
 * used. design-system.md §5 records the values; a unit test asserts the option
 * carries them.
 */
export const AXIS_LABEL_MARGIN = {
  /** Category (week) axis: labels sit below the axis line. */
  category: 14,
  /** Value axis: labels sit beside the axis line. */
  value: 10,
} as const;

/**
 * Padding between the plot's label box and the frame, per `containLabel: true`.
 *
 * `containLabel` reserves room for the labels themselves, so these numbers are the
 * gap AROUND that reserved box. The left and right values are what stop the first
 * and last week labels from being clipped at the frame edge once they are no longer
 * tucked under the y-axis.
 */
export const GRID_PADDING = {
  /** Room for the axis-title line that sits above the plot. */
  top: 30,
  left: 10,
  right: 12,
  bottom: 6,
} as const;

/**
 * Axis line, tick and title treatment shared by every axis in the product.
 *
 * Ticks are off: the label already marks the position, and a tick mark beside it is
 * a second cue for one fact. design-system §5 calls for subtle axes.
 *
 * `nameAlign` is not cosmetic. With `nameLocation: "end"` ECharts centres a vertical
 * axis's title on the axis position, which puts half of a long title outside the
 * canvas — measured: "Search interest index" on a right-hand axis rendered as
 * "Search interest inde", and the five-market chart's title lost its first word.
 * Anchoring the title's near edge to the axis keeps it inside the plot at every width.
 */
export const axisCommon = (
  theme: ChartTheme,
  px: PxConverter,
  nameAlign: "left" | "right" | "center" = "left",
): OptionObject => ({
  axisLine: { show: true, lineStyle: { color: theme.axisLineColor, width: 1 } },
  axisTick: { show: false },
  nameTextStyle: {
    ...proseText(theme.axisTitleColor, theme.axisTitleSize, px),
    align: nameAlign,
    padding: [0, 0, 6, 0],
  },
});

/** Horizontal gridlines only. Vertical lines add noise to a time series. */
export const splitLine = (theme: ChartTheme, px: PxConverter): OptionObject => ({
  show: true,
  lineStyle: { color: theme.gridColor, width: px(theme.gridWidth), type: "solid" },
});

/**
 * Whether an annotation may carry a visible text label at this width.
 *
 * Below `md` the plot is roughly 300px wide and an annotation label — "Elevated crude
 * price", "Oil peak" — lands on top of the data it is annotating. The band and the
 * reference line still draw, because they are part of the argument; only the text is
 * withheld, and the notes under every chart state the same dates in words. That keeps
 * the information available at every width without the label pile.
 */
export const annotationLabelsFit = (widthPx: number): boolean => widthPx >= BREAKPOINTS.md;

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------

/**
 * Wheel/drag zoom inside the plot.
 *
 * `zoomOnMouseWheel: "ctrl"` is two decisions in one value:
 *
 *   - plain wheel keeps scrolling the PAGE. A chart inside a long-scroll article
 *     that swallows the wheel is worse than one that does not zoom at all.
 *   - trackpad pinch arrives as ctrl+wheel in every major browser, so pinch-to-zoom
 *     works with no modifier pressed. The modifier is an accelerator for a mouse,
 *     not a requirement for a trackpad.
 *
 * `filterMode: "none"` zooms the view and keeps every point. `"filter"` would drop
 * observations outside the window, and a series that loses points to a viewport is a
 * different series.
 */
export const insideZoom = (xAxisIndex: readonly number[]): OptionObject => ({
  type: "inside",
  xAxisIndex,
  zoomOnMouseWheel: "ctrl",
  moveOnMouseWheel: false,
  moveOnMouseMove: true,
  preventDefaultMouseMove: false,
  filterMode: "none",
  start: 0,
  end: 100,
});

/**
 * The visible zoom slider.
 *
 * WHY A CHART GETS ONE AT ALL
 * Because a gesture nobody can see is not a control. `insideZoom` is discoverable
 * only by being told about it, which is acceptable as an accelerator and not
 * acceptable as the only way to zoom. The slider states that the x-domain is
 * adjustable, shows how much of it is currently in view, and needs no modifier key.
 *
 * WHAT IT IS NOT: a keyboard control. ECharts paints the slider into the canvas, so
 * its handles cannot be tabbed to — the same reason the legend is HTML. The keyboard
 * equivalent is on the chart region itself (`+` / `-` to zoom, arrows to step, and
 * the reset button), and the tabular fallback exposes every value regardless.
 *
 * `showDetail: false` suppresses the floating value bubble ECharts draws while
 * dragging: the week is already in the tooltip and on the axis, and the bubble
 * covers the plot at exactly the moment a reader is looking at it.
 */
export const sliderZoom = (
  theme: ChartTheme,
  resolveColour: ColourResolver,
  xAxisIndex: readonly number[],
  px: PxConverter,
): OptionObject => ({
  type: "slider",
  xAxisIndex,
  filterMode: "none",
  start: 0,
  end: 100,
  height: 26,
  bottom: 0,
  showDetail: false,
  showDataShadow: false,
  brushSelect: false,
  backgroundColor: resolveColour("--chart-slider-bg"),
  borderColor: resolveColour("--chart-slider-border"),
  borderRadius: 4,
  fillerColor: resolveColour("--chart-slider-selected-fill"),
  handleStyle: {
    color: resolveColour("--chart-slider-handle"),
    borderColor: resolveColour("--chart-slider-border"),
    borderWidth: 1,
  },
  moveHandleStyle: { color: resolveColour("--chart-slider-handle") },
  dataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
  selectedDataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
  textStyle: figureText(theme, theme.axisLabelColor, theme.axisLabelSize, px),
});

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/**
 * Entrance motion for a line series, and the rule that keeps it an entrance.
 *
 * ECharts draws a line series in by animating a clip rectangle from left to right,
 * which is exactly the "line draws left-to-right" the motion contract asks for — no
 * custom animation is needed, only a duration.
 *
 * `animate: false` returns `animation: false` rather than a zero duration, because
 * the two differ: a zero-duration animation still schedules a frame per element,
 * and `prefers-reduced-motion` should stop the work rather than speed it up.
 *
 * THE ENTRANCE HAPPENS ONCE. Every subsequent `setOption` passes `animate: false`,
 * so a legend toggle, a resize or a theme change updates in place instead of
 * redrawing the line from the left edge. KIRO.md §10: the data stays still.
 */
export const ENTRANCE_DURATION_MS = 900;

/** Delay before a second series starts drawing, so the pair reads as a sequence. */
export const ENTRANCE_STAGGER_MS = 120;

export interface MotionArgs {
  /** False under `prefers-reduced-motion`, and false for every update after the first. */
  readonly animate: boolean;
}

/** Option-level animation switches. */
export const animationOptions = (motion: MotionArgs): OptionObject =>
  motion.animate
    ? {
        animation: true,
        animationDuration: ENTRANCE_DURATION_MS,
        animationEasing: "cubicOut",
        // Updates are instant. An update that animates is an update that moves the
        // data, and the data must not move once it is drawn.
        animationDurationUpdate: 0,
      }
    : { animation: false };

/** Per-series animation, staggered by position so series arrive in order. */
export const seriesAnimation = (motion: MotionArgs, index: number): OptionObject =>
  motion.animate
    ? {
        animationDuration: ENTRANCE_DURATION_MS,
        animationDelay: index * ENTRANCE_STAGGER_MS,
        animationEasing: "cubicOut",
        animationDurationUpdate: 0,
      }
    : { animation: false };
