/**
 * The chart visual language, as a typed contract.
 *
 * WHY THIS EXISTS BEFORE ANY CHART
 * Charts drift. The original project used two arbitrary hex literals and no
 * shared axis, tooltip or annotation treatment, so its visualisations did not
 * look like one product. Defining the language first means every chart built in
 * Phase 3B consumes the same tokens, and none invents its own styling.
 *
 * WHAT THIS FILE IS NOT
 * There is no charting library here, and no ECharts option object. It contains
 * the token names, the per-series visual identity, and a DOM-free resolver. The
 * ECharts adapter that turns a resolved theme into a library option object is
 * Phase 3B work and cannot be written or verified without the dependency.
 *
 * COLOUR IS NEVER THE ONLY CUE
 * Every series carries a colour, a dash pattern and a marker shape. Cyan
 * (Singapore) and blue (United States) are the closest pair in the palette, so
 * the redundant encoding is a requirement, not a nicety.
 */

import type { SeriesId } from "../data/artifact-types.ts";

// ---------------------------------------------------------------------------
// CSS variable names
// ---------------------------------------------------------------------------

/**
 * Every chart token, mapped to the CSS custom property that defines it in
 * `tokens.css`. The chart layer resolves these at runtime, which is how charts
 * inherit light/dark theming instead of hard-coding colour.
 */
export const CHART_TOKENS = {
  axisLabelColor: "--chart-axis-label-color",
  axisLabelSize: "--chart-axis-label-size",
  axisLabelFont: "--chart-axis-label-font",
  axisLineColor: "--chart-axis-line-color",
  axisTitleColor: "--chart-axis-title-color",
  axisTitleSize: "--chart-axis-title-size",

  gridColor: "--chart-grid-color",
  gridWidth: "--chart-grid-width",

  tooltipBg: "--chart-tooltip-bg",
  tooltipBorder: "--chart-tooltip-border",
  tooltipFg: "--chart-tooltip-fg",
  tooltipMutedFg: "--chart-tooltip-muted-fg",
  tooltipRadius: "--chart-tooltip-radius",
  tooltipShadow: "--chart-tooltip-shadow",
  tooltipPadding: "--chart-tooltip-padding",

  lineWidth: "--chart-line-width",
  lineWidthEmphasis: "--chart-line-width-emphasis",
  pointRadius: "--chart-point-radius",
  pointRadiusEmphasis: "--chart-point-radius-emphasis",
  scatterOpacity: "--chart-scatter-opacity",
  areaOpacity: "--chart-area-opacity",

  legendFg: "--chart-legend-fg",
  legendSize: "--chart-legend-size",
  legendInactiveFg: "--chart-legend-inactive-fg",

  annotationFg: "--chart-annotation-fg",
  annotationSize: "--chart-annotation-size",
  annotationLine: "--chart-annotation-line",
  referenceLineColor: "--chart-reference-line-color",
  referenceLineDash: "--chart-reference-line-dash",
  zeroLineColor: "--chart-zero-line-color",
  zeroLineWidth: "--chart-zero-line-width",
  regimeFill: "--chart-regime-fill",
  regimeEdge: "--chart-regime-edge",
  regimeLabelFg: "--chart-regime-label-fg",

  uncertaintyFill: "--chart-uncertainty-fill",
  uncertaintyStroke: "--chart-uncertainty-stroke",
  uncertaintyWhiskerWidth: "--chart-uncertainty-whisker-width",

  hoverBg: "--chart-hover-bg",
  crosshairColor: "--chart-crosshair-color",
  crosshairDash: "--chart-crosshair-dash",
  selectedOutline: "--chart-selected-outline",
  dimmedOpacity: "--chart-dimmed-opacity",

  provisionalColor: "--chart-provisional-color",
  provisionalDash: "--chart-provisional-dash",
} as const satisfies Record<string, `--${string}`>;

export type ChartTokenName = keyof typeof CHART_TOKENS;

/** Resolved token values, keyed identically to `CHART_TOKENS`. */
export type ChartTheme = Readonly<Record<ChartTokenName, string>>;

/** Reads one CSS custom property. Injected so this module needs no DOM types. */
export type CssVariableReader = (cssVariableName: string) => string;

/**
 * Resolve every chart token through the supplied reader.
 *
 * Phase 3B passes a reader backed by `getComputedStyle`, called ONCE per theme
 * change rather than per render: canvas cannot consume `var()`, so values must
 * be resolved to concrete strings before building a chart option object.
 *
 * Throws when a token resolves to empty, which means `tokens.css` was not
 * loaded or a token was renamed. Failing loudly beats charts silently rendering
 * with transparent lines.
 */
export function resolveChartTheme(read: CssVariableReader): ChartTheme {
  const resolved: Partial<Record<ChartTokenName, string>> = {};
  const missing: string[] = [];

  for (const key of Object.keys(CHART_TOKENS) as ChartTokenName[]) {
    const variable = CHART_TOKENS[key];
    const value = read(variable).trim();
    if (value === "") {
      missing.push(variable);
      continue;
    }
    resolved[key] = value;
  }

  if (missing.length > 0) {
    throw new Error(
      `chart theme could not be resolved; unset CSS variables: ${missing.join(", ")}. ` +
        `Ensure src/styles/tokens.css is loaded before a chart mounts.`,
    );
  }

  return resolved as ChartTheme;
}

/** `chartTokenVar("gridColor")` -> `"var(--chart-grid-color)"`, for use in CSS. */
export function chartTokenVar(token: ChartTokenName): string {
  return `var(${CHART_TOKENS[token]})`;
}

// ---------------------------------------------------------------------------
// Per-series visual identity
// ---------------------------------------------------------------------------

/**
 * Dash pattern in px, as alternating dash/gap lengths. `null` means solid.
 * Length is not fixed at two: a dash-dot pattern needs four entries.
 */
export type DashPattern = readonly number[] | null;

/**
 * `"none"` is reserved for the worldwide aggregate, which is drawn as a plain
 * ink line without point markers so it visually subordinates to the five
 * markets rather than competing with them.
 */
export type MarkerShape = "none" | "circle" | "square" | "triangle" | "diamond" | "cross";

export interface SeriesVisualIdentity {
  /** CSS custom property holding this series' colour. */
  readonly colorVariable: `--${string}`;
  /** Redundant encoding #1, so colour is never load-bearing alone. */
  readonly dash: DashPattern;
  /** Redundant encoding #2, for scatter and legend swatches. */
  readonly marker: MarkerShape;
  /**
   * Whether this series is an aggregate rather than one of the five markets.
   * Aggregates are drawn in near-ink and should not compete with countries.
   */
  readonly isAggregate: boolean;
}

/**
 * Fixed visual identity per series. Assignment is arbitrary and encodes NO
 * ranking, quality or sentiment -- these are identifiers only. Once shipped it
 * must not change, because a reader who learns "violet is Malaysia" in one
 * chart carries that to every other chart.
 */
export const SERIES_IDENTITY: Readonly<Record<SeriesId, SeriesVisualIdentity>> = {
  worldwide: {
    colorVariable: "--color-series-worldwide",
    dash: null,
    marker: "none",
    isAggregate: true,
  },
  us: {
    colorVariable: "--color-country-us",
    dash: null,
    marker: "circle",
    isAggregate: false,
  },
  singapore: {
    // Cyan sits closest to the US blue, so it takes the most distinct dash.
    colorVariable: "--color-country-singapore",
    dash: [6, 3],
    marker: "square",
    isAggregate: false,
  },
  malaysia: {
    colorVariable: "--color-country-malaysia",
    dash: [2, 3],
    marker: "triangle",
    isAggregate: false,
  },
  indonesia: {
    colorVariable: "--color-country-indonesia",
    dash: [9, 4],
    marker: "diamond",
    isAggregate: false,
  },
  norway: {
    colorVariable: "--color-country-norway",
    // Dash-dot: four entries, distinct from every other pattern at a glance.
    dash: [4, 3, 1, 3],
    marker: "cross",
    isAggregate: false,
  },
};

/**
 * The oil price series. Held separately from `SERIES_IDENTITY` because oil is
 * not an interest series and its colour is reserved: a rust line always means
 * price, in every chart, and no country may use it.
 */
export const OIL_IDENTITY = {
  colorVariable: "--color-oil",
  fillVariable: "--color-oil-fill",
  dash: null,
  marker: "circle",
} as const;

export function seriesIdentity(id: SeriesId): SeriesVisualIdentity {
  return SERIES_IDENTITY[id];
}

// ---------------------------------------------------------------------------
// Responsive contract
// ---------------------------------------------------------------------------

/**
 * Breakpoints, mirroring section 8 of tokens.css. Duplicated here because CSS
 * custom properties cannot be read inside `@media`, and chart code needs the
 * numbers in JS. tokens.css is the documented source of truth for the values.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const satisfies Record<string, number>;

export type Breakpoint = keyof typeof BREAKPOINTS;

/** Chart size band. Charts change layout by band, not by scaling down. */
export type ChartSizeBand = "mobile" | "compact" | "standard" | "hero";

export const CHART_HEIGHT_TOKENS = {
  hero: "--chart-height-hero",
  standard: "--chart-height-standard",
  compact: "--chart-height-compact",
  mobile: "--chart-height-mobile",
  sparkline: "--chart-height-sparkline",
} as const satisfies Record<string, `--${string}`>;

/**
 * Layout decision for a dual-axis chart at a given width.
 *
 * Two y-axes become unreadable below roughly the `md` breakpoint: tick density
 * collapses and the reader cannot tell which axis a line belongs to. Below that
 * width the correct adaptation is to split into two stacked single-axis panels
 * sharing one x-domain -- not to shrink the dual-axis chart.
 */
export function dualAxisLayout(widthPx: number): "dual-axis" | "stacked-panels" {
  return widthPx >= BREAKPOINTS.md ? "dual-axis" : "stacked-panels";
}

/** Approximate number of x-axis tick labels that fit at a given width. */
export function axisTickBudget(widthPx: number): number {
  if (widthPx < BREAKPOINTS.sm) return 4;
  if (widthPx < BREAKPOINTS.md) return 5;
  if (widthPx < BREAKPOINTS.lg) return 7;
  if (widthPx < BREAKPOINTS.xl) return 9;
  return 12;
}

// ---------------------------------------------------------------------------
// Interaction contract
// ---------------------------------------------------------------------------

/**
 * Interactions a chart may support. Phase 3B must enable only the ones that
 * answer an analytical question for that specific chart -- not the full set
 * because the library offers it.
 */
export interface ChartInteractionCapabilities {
  /** Wheel/pinch zoom on the x-domain. Time series only. */
  readonly zoom: boolean;
  /** Drag to pan the x-domain. Must not hijack vertical page scroll. */
  readonly pan: boolean;
  /** Visible control returning to the full domain. Required whenever zoom is on. */
  readonly reset: boolean;
  /** Hover/focus inspection with a shared crosshair. */
  readonly inspect: boolean;
  /** Legend click to show/hide a series. */
  readonly legendToggle: boolean;
  /** Hovering one series dims the others. */
  readonly highlight: boolean;
  /** A brush that publishes a selected range to sibling charts. */
  readonly brush: boolean;
  /** Download the underlying rows for this chart. */
  readonly exportData: boolean;
}

/** Inspection-only. The correct default: interaction is opt-in per chart. */
export const NO_INTERACTIONS: ChartInteractionCapabilities = {
  zoom: false,
  pan: false,
  reset: false,
  inspect: true,
  legendToggle: false,
  highlight: false,
  brush: false,
  exportData: false,
};

/**
 * Invariants the chart layer must uphold. Asserted here so a violation is a
 * type/test failure rather than a review comment.
 */
export function assertInteractionsCoherent(caps: ChartInteractionCapabilities): void {
  if ((caps.zoom || caps.pan) && !caps.reset) {
    throw new Error(
      "a zoomable or pannable chart must expose a reset control, " +
        "or a reader can get stranded in a sub-range",
    );
  }
  if (caps.brush && !caps.inspect) {
    throw new Error("brush selection without hover inspection gives no feedback");
  }
}

// ---------------------------------------------------------------------------
// Accessibility contract
// ---------------------------------------------------------------------------

/**
 * Metadata every chart must supply. This is a required argument in Phase 3B,
 * not an optional prop, so a chart cannot ship without its accessible
 * equivalent.
 */
export interface ChartAccessibilityContract {
  /** Short, specific title. Not "Chart 1". */
  readonly title: string;
  /** One sentence naming what the reader should look for. */
  readonly description: string;
  /**
   * Longer text description of the pattern, for screen readers and for readers
   * who cannot interpret the visual encoding. Must state the finding, not just
   * describe the axes.
   */
  readonly longDescription: string;
  /**
   * Column headers for the tabular fallback. Every chart has a table twin; it
   * is a first-class representation, not a hidden afterthought.
   */
  readonly tableColumns: readonly string[];
  /** Source attribution line. */
  readonly source: string;
  /** True when the chart contains provisional data needing a visible note. */
  readonly hasProvisionalData: boolean;
}
