/**
 * Chart contract tests — Phase 3C step 5 prototype.
 *
 * WHAT THESE PROTECT
 * A dual-axis chart is the easiest place in this product to mislead a reader, and
 * every way of doing so is invisible to `tsc`, to `eslint` and to a screenshot:
 *
 *   1. NEITHER SERIES MAY BE RESCALED. Oil is USD per barrel; interest is the 0-100
 *      index Google Trends already normalised per series. Normalising oil to 0-100,
 *      or the index a second time, would manufacture the co-movement the chart
 *      exists to let a reader judge. Asserted value-by-value against the artifact.
 *   2. EACH SERIES MUST BE BOUND TO ITS OWN AXIS. `yAxisIndex` is a bare number in
 *      an option object, and ECharts will happily plot a 0-100 index against a
 *      dollar scale without complaint.
 *   3. THE FRONTEND MAY NOT COMPUTE A STATISTIC. The same rule
 *      `analytical-safety.test.ts` enforces over `src/data/`, applied to the chart
 *      layer — which is the layer most tempted to smooth, average or trend-fit.
 *   4. EVERY ANNOTATION POSITION MUST BE AN ARTIFACT VALUE. A peak found by
 *      scanning for a maximum in JS is a second analytical source that can silently
 *      disagree with the published one.
 *
 * These run against the REAL artifacts, not fixtures. A fixture would let the
 * contract pass while the shipped data broke it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { loadArtifactBundle } from "../src/data/load-node.ts";
import {
  INTEREST_AXIS,
  oilAxisBounds,
  selectOilVsWorldwideInterest,
} from "../src/lib/oil-vs-interest.ts";
import {
  AXIS_INDEX,
  AXIS_TITLE,
  OIL_VS_INTEREST_A11Y,
  OIL_VS_INTEREST_INTERACTIONS,
  buildChartTableRows,
  formatWeek,
} from "../src/components/chart/contract.ts";
import {
  buildOilVsInterestOption,
  buildTooltipFormatter,
  lengthToPx,
  seriesName,
  type OptionObject,
} from "../src/components/chart/echarts-option.ts";
import {
  CHART_TOKENS,
  type ChartTheme,
  type ChartTokenName,
} from "../src/styles/chart-language.ts";

const webRoot = join(import.meta.dirname, "..");
const chartDir = join(webRoot, "src", "components", "chart");

const bundle = loadArtifactBundle();
const data = selectOilVsWorldwideInterest(bundle);

/** A stub theme: every token resolves to its own name, so bindings are traceable. */
const theme: ChartTheme = Object.fromEntries(
  (Object.keys(CHART_TOKENS) as ChartTokenName[]).map((key) => [key, tokenStub(key)]),
) as ChartTheme;

function tokenStub(key: ChartTokenName): string {
  // Length tokens return the units `tokens.css` actually uses: `rem` for type sizes,
  // `px` for strokes. A stub returning "2px" for a font size would not exercise the
  // rem conversion at all, and the rem path is where a measured bug lived.
  if (/Size$/.test(key)) return "0.8125rem";
  if (/Padding$/.test(key)) return "0.75rem";
  if (/Width$|Radius$/.test(key)) return "2px";
  if (key === "areaOpacity" || key === "dimmedOpacity" || key === "scatterOpacity")
    return "0.1";
  if (/Dash$/.test(key)) return "3 3";
  return `token(${key})`;
}

const resolveColour = (name: string): string => `colour(${name})`;

/** The browser default. The real root size travels from `getComputedStyle` at runtime. */
const ROOT_FONT_SIZE_PX = 16;

const option = (widthPx: number): OptionObject =>
  buildOilVsInterestOption({
    data,
    theme,
    resolveColour,
    widthPx,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
  });

/** Narrow an option value to an array of objects, failing the test if it is not. */
const asArray = (value: unknown, what: string): OptionObject[] => {
  assert.ok(Array.isArray(value), `${what} should be an array`);
  return value as OptionObject[];
};

const seriesById = (built: OptionObject, id: string): OptionObject => {
  const all = asArray(built["series"], "series");
  const match = all.find((entry) => entry["id"] === id);
  assert.ok(match !== undefined, `no series with id "${id}"`);
  return match;
};

// ---------------------------------------------------------------------------
// The chart receives the artifact shape, unaltered
// ---------------------------------------------------------------------------

test("the selector returns one point per panel row, in order", () => {
  assert.equal(data.points.length, bundle.panel.rows.length);
  assert.equal(data.points.length, bundle.panel.coverage.trends_weeks);

  for (const [index, row] of bundle.panel.rows.entries()) {
    const point = data.points[index];
    assert.ok(point !== undefined);
    assert.equal(point.weekStart, row.week_start, `row ${String(index)} week_start`);
    assert.equal(point.weekEnd, row.week_end, `row ${String(index)} week_end`);
  }
});

test("oil values are the artifact's exact USD-per-barrel figures, verbatim", () => {
  // `_exact` rather than the 2dp display value: plotting the rounded one visibly
  // steps the line. Compared with `strictEqual`, so any arithmetic on the way in
  // fails — including a division that happens to be nearly lossless.
  for (const [index, row] of bundle.panel.rows.entries()) {
    const point = data.points[index];
    assert.ok(point !== undefined);
    const expected = row.oil === null ? null : row.oil.brent_usd_per_barrel_exact;
    assert.equal(point.oilUsdPerBarrel, expected, `row ${String(index)} oil`);
  }
});

test("interest values are the artifact's worldwide index, verbatim", () => {
  for (const [index, row] of bundle.panel.rows.entries()) {
    const point = data.points[index];
    assert.ok(point !== undefined);
    assert.equal(point.interestIndex, row.interest.worldwide, `row ${String(index)} interest`);
  }
});

test("a week with no oil observation stays null and is never filled", () => {
  // The Brent extract stops one week short of the Trends grid. A zero would be read
  // as a price of nothing; a carried-forward value would be an invented observation.
  const missing = bundle.panel.coverage.weeks_without_oil;
  assert.ok(missing.length > 0, "the fixture no longer exercises the missing-oil case");

  for (const week of missing) {
    const point = data.points.find((entry) => entry.weekStart === week);
    assert.ok(point !== undefined, `${week} is not in the selected points`);
    assert.equal(point.oilUsdPerBarrel, null, `${week} oil should be null`);
    // The interest observation for that week DOES exist and must survive.
    assert.equal(typeof point.interestIndex, "number");
  }
});

test("the partial week is flagged from the artifact, not inferred from a date", () => {
  const partial = bundle.panel.coverage.partial_weeks;
  assert.ok(partial.length > 0, "the fixture no longer exercises the partial-week case");

  for (const point of data.points) {
    const expected = partial.includes(point.weekStart);
    assert.equal(point.isPartialWeek, expected, `${point.weekStart} partial flag`);
  }
});

// ---------------------------------------------------------------------------
// Units and axes
// ---------------------------------------------------------------------------

test("oil is bound to the left axis and interest to the right", () => {
  const built = option(1280);

  assert.equal(seriesById(built, "oil")["yAxisIndex"], AXIS_INDEX.oil);
  assert.equal(seriesById(built, "interest")["yAxisIndex"], AXIS_INDEX.interest);
  // The provisional overlay is a treatment of the oil line, so it shares oil's axis.
  assert.equal(seriesById(built, "oil-provisional")["yAxisIndex"], AXIS_INDEX.oil);
});

test("the oil axis is in dollars per barrel and is never 0-100", () => {
  const axes = asArray(option(1280)["yAxis"], "yAxis");
  const oilAxis = axes[AXIS_INDEX.oil];
  assert.ok(oilAxis !== undefined);

  assert.equal(oilAxis["name"], AXIS_TITLE.oil);
  assert.match(String(oilAxis["name"]), /USD/, "the oil axis must name its unit");
  assert.match(String(oilAxis["name"]), /barrel/, "the oil axis must name its denominator");
  assert.equal(oilAxis["position"], "left");

  // The giveaway for an accidental renormalisation: a 0-100 dollar axis.
  const isZeroToHundred = oilAxis["min"] === 0 && oilAxis["max"] === 100;
  assert.ok(!isZeroToHundred, "the oil axis has been normalised to 0-100");

  // It must actually contain the data.
  const observed = data.points
    .map((point) => point.oilUsdPerBarrel)
    .filter((value): value is number => value !== null);
  assert.ok(Number(oilAxis["min"]) <= Math.min(...observed), "oil axis min clips the data");
  assert.ok(Number(oilAxis["max"]) >= Math.max(...observed), "oil axis max clips the data");
});

test("the interest axis is the measure's own 0-100 domain, not the sample's range", () => {
  const axes = asArray(option(1280)["yAxis"], "yAxis");
  const interestAxis = axes[AXIS_INDEX.interest];
  assert.ok(interestAxis !== undefined);

  assert.equal(interestAxis["name"], AXIS_TITLE.interest);
  assert.match(
    String(interestAxis["name"]),
    /index/i,
    "the interest axis must say it is an index",
  );
  assert.equal(interestAxis["position"], "right");

  // Fixed, not fitted. Auto-scaling to the observed 56-100 would stretch the line to
  // fill the plot and overstate how far the index actually moved.
  assert.equal(interestAxis["min"], 0);
  assert.equal(interestAxis["max"], 100);
  assert.equal(INTEREST_AXIS.min, 0);
  assert.equal(INTEREST_AXIS.max, 100);

  const observed = data.points.map((point) => point.interestIndex);
  assert.ok(Math.min(...observed) > 0, "the fixture would not detect a fitted axis");
});

test("both axes carry the same number of gridlines", () => {
  // Two axes with different split counts draw two grids through one plot. Equal
  // interval counts are what make the single grid honest as well as tidy.
  const axes = asArray(option(1280)["yAxis"], "yAxis");
  const oilAxis = axes[AXIS_INDEX.oil];
  const interestAxis = axes[AXIS_INDEX.interest];
  assert.ok(oilAxis !== undefined && interestAxis !== undefined);

  const intervals = (axis: OptionObject): number =>
    (Number(axis["max"]) - Number(axis["min"])) / Number(axis["interval"]);

  assert.equal(intervals(oilAxis), intervals(interestAxis));
  // Only the left axis draws the grid; the right one would double every line.
  assert.equal((interestAxis["splitLine"] as OptionObject)["show"], false);
  assert.equal((oilAxis["splitLine"] as OptionObject)["show"], true);
});

test("the oil axis bounds are derived from the artifact's own min and max", () => {
  const oil = bundle.metrics.global.oil;
  assert.deepEqual(
    data.oilAxis,
    oilAxisBounds(oil.min_usd_per_barrel, oil.max_usd_per_barrel),
    "the axis bounds no longer come from metrics.global.oil",
  );
  // Rounded outward to a round step, never inward: an axis that clips an
  // observation is a chart that hides one.
  assert.ok(data.oilAxis.min <= oil.min_usd_per_barrel);
  assert.ok(data.oilAxis.max >= oil.max_usd_per_barrel);
});

test("axis bound rounding is presentation, and stays on round numbers", () => {
  assert.deepEqual(oilAxisBounds(60.826, 111.398), { min: 60, max: 120, interval: 15 });
  assert.deepEqual(oilAxisBounds(0, 100), { min: 0, max: 100, interval: 25 });
  // Widened until the span divides evenly, so every gridline is readable.
  const odd = oilAxisBounds(61, 95);
  assert.equal(odd.min, 60);
  assert.equal((odd.max - odd.min) % 4, 0);
  assert.ok(odd.max >= 95);
});

test("rem-based type tokens are converted to pixels, not parsed as pixels", () => {
  // A measured bug, kept as a test. `--chart-axis-label-size` is `0.8125rem`, and a
  // custom property resolves to that string verbatim rather than to a pixel value.
  // `parseFloat` on it gives 0.8125, so axis ticks and legend labels were drawn at
  // less than one pixel: invisible, and the legend was consequently impossible to
  // click. Nothing else in the suite would have caught it — the option was structurally
  // correct and the chart rendered without error.
  assert.equal(lengthToPx("0.8125rem", 16), 13);
  assert.equal(lengthToPx(".75rem", 16), 12);
  assert.equal(lengthToPx("2px", 16), 2);
  assert.equal(lengthToPx("1", 16), 1);
  assert.equal(lengthToPx("nonsense", 16), 0);
  // A different root size scales with it, which is the point of using rem at all.
  assert.equal(lengthToPx("1rem", 20), 20);
});

test("every rendered font size is at least readable, given rem tokens", () => {
  // The end-to-end consequence of the conversion above, asserted on the built option
  // rather than on the helper: any font size under 8px is a label nobody can read.
  const built = option(1280);
  const sizes: number[] = [];

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "fontSize" && typeof child === "number") sizes.push(child);
      else walk(child);
    }
  };
  walk(built);

  assert.ok(sizes.length > 0, "no fontSize appears in the option");
  const tooSmall = sizes.filter((size) => size < 8);
  assert.deepEqual(tooSmall, [], "a font size resolved sub-readable");
});

test("the plotted values are the selected values, with nothing applied", () => {
  const built = option(1280);
  assert.deepEqual(
    seriesById(built, "interest")["data"],
    data.points.map((point) => point.interestIndex),
  );
  assert.deepEqual(
    seriesById(built, "oil")["data"],
    data.points.map((point) => point.oilUsdPerBarrel),
  );
});

test("the oil line breaks at a missing observation rather than joining across it", () => {
  const built = option(1280);
  assert.equal(seriesById(built, "oil")["connectNulls"], false);
  assert.equal(seriesById(built, "interest")["connectNulls"], false);
});

test("every series name carries its unit", () => {
  // The cheapest part of the dual-axis obligation: the legend and the tooltip
  // heading then state which scale a line is on, so a reader never has to infer it
  // from which side the line happens to sit closer to.
  const names = seriesName(data);
  assert.match(names.oil, /USD \/ barrel/);
  assert.match(names.interest, /index/i);

  const legend = option(1280)["legend"] as OptionObject;
  assert.deepEqual(legend["data"], [names.oil, names.interest]);
  // The provisional overlay is a treatment, not a third measure.
  assert.equal(asArray(legend["data"], "legend.data").length, 2);
});

// ---------------------------------------------------------------------------
// Annotations come from the artifacts
// ---------------------------------------------------------------------------

test("the oil peak marker sits on metrics.global.oil.max_week", () => {
  const markLine = seriesById(option(1280), "oil")["markLine"] as OptionObject;
  const entries = asArray(markLine["data"], "markLine.data");
  assert.equal(entries[0]?.["xAxis"], bundle.metrics.global.oil.max_week);
  assert.equal(data.annotations.oilPeakWeek, bundle.metrics.global.oil.max_week);
});

test("the elevated band spans the artifact's onset week to the last oil week", () => {
  const regime = bundle.metrics.global.regime;
  assert.ok(regime.regimes_separated, "the fixture no longer exercises the banded case");

  const markArea = seriesById(option(1280), "oil")["markArea"] as OptionObject;
  const span = asArray(markArea["data"], "markArea.data")[0];
  const bounds = asArray(span, "markArea span");
  assert.equal(bounds[0]?.["xAxis"], regime.onset_week);
  assert.equal(bounds[1]?.["xAxis"], bundle.metrics.global.oil.last_week);
});

test("the band is suppressed entirely when the artifact says regimes are not separated", () => {
  // `regimes_separated: false` means "do not present this as a distinct regime".
  // Honoured by drawing nothing, not by drawing it more faintly.
  const notSeparated = {
    ...data,
    annotations: { ...data.annotations, regimesSeparated: false },
  };
  const built = buildOilVsInterestOption({
    data: notSeparated,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
  });
  const oil = seriesById(built, "oil");
  assert.equal(oil["markArea"], undefined, "the regime band must not be drawn");
  // The peak marker is unrelated to the regime split and stays.
  assert.ok(oil["markLine"] !== undefined);
});

test("no annotation position is a literal in the chart layer", () => {
  // A hardcoded week is a second analytical source. Scan the chart layer for any
  // ISO date literal; the only dates that may appear are in the long description,
  // which is prose about the finding rather than a plotted position.
  const offenders: string[] = [];
  for (const file of readdirSync(chartDir)) {
    const source = readFileSync(join(chartDir, file), "utf8");
    const code = source
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*")
        );
      })
      .join("\n");
    for (const match of code.matchAll(/\d{4}-\d{2}-\d{2}/g)) {
      offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], "an ISO date is hardcoded in the chart layer");
});

// ---------------------------------------------------------------------------
// No statistic is computed in the chart layer
// ---------------------------------------------------------------------------

test("no statistical or smoothing operation appears in the chart layer", () => {
  const forbidden = [
    "Math.sqrt",
    "Math.pow",
    "Math.log",
    "Math.exp",
    "Math.hypot",
    "pearson",
    "spearman",
    "correlate(",
    "confidenceInterval(",
    "linearRegression",
    "movingAverage",
    "rollingMean",
    "interpolate(",
    "normalise(",
    "normalize(",
    "rescale(",
    "toPrecision(",
    // Reductions over the plotted values: a mean or sum here is a derived statistic.
    ".reduce(",
    "cumulative",
    // Note the parenthesis. `detrend(` is an operation; `linear_detrended` is an
    // artifact field name the selector reads, and banning the bare word would
    // forbid reading the specification the §16 caveat depends on.
    "detrend(",
  ];

  const violations: string[] = [];
  const files: readonly string[] = [
    ...readdirSync(chartDir).map((name) => join(chartDir, name)),
    join(webRoot, "src", "lib", "oil-vs-interest.ts"),
  ];

  for (const path of files) {
    const source = readFileSync(path, "utf8");
    const code = source
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*")
        );
      })
      .join("\n");
    for (const needle of forbidden) {
      if (code.includes(needle)) violations.push(`${path.slice(webRoot.length)}: ${needle}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("the selector does no arithmetic on a plotted value", () => {
  const source = readFileSync(join(webRoot, "src", "lib", "oil-vs-interest.ts"), "utf8");
  const code = source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

  // The only arithmetic permitted is axis rounding, and it is confined to
  // `oilAxisBounds`. Anything dividing or multiplying a series value would show up
  // as an operator applied to a `point.` or `row.` expression.
  assert.ok(
    !/(point|row)\.[A-Za-z_.]*\s*[*/+-]\s*\d/.test(code),
    "a plotted value is being scaled or shifted in the selector",
  );
  assert.ok(
    !/Math\.(min|max)\(\.\.\./.test(code),
    "the selector scans the series for an extreme",
  );
});

// ---------------------------------------------------------------------------
// Tooltip: both measures, both units, no hover-only critical information
// ---------------------------------------------------------------------------

test("the tooltip names the week and both measures with their units", () => {
  const format = buildTooltipFormatter({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
  });
  const complete = data.points.find(
    (point) => point.oilUsdPerBarrel !== null && !point.isPartialWeek,
  );
  assert.ok(complete !== undefined);

  const html = format(complete.weekStart);
  assert.match(html, /Week of/);
  assert.ok(html.includes(formatWeek(complete.weekStart)), "the tooltip omits the week");
  assert.match(html, /\/ barrel/, "the oil unit is missing");
  assert.match(html, /\/ 100 index/, "the interest unit is missing");
  assert.ok(
    html.includes(complete.oilUsdPerBarrel!.toFixed(2)),
    "the tooltip does not show the artifact's oil value",
  );
  assert.ok(
    html.includes(complete.interestIndex.toFixed(0)),
    "the tooltip does not show the artifact's interest value",
  );
});

test("a week with no oil observation says so rather than showing a blank", () => {
  const format = buildTooltipFormatter({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
  });
  const missing = data.points.find((point) => point.oilUsdPerBarrel === null);
  assert.ok(missing !== undefined);

  const html = format(missing.weekStart);
  assert.match(html, /no observation/i);
  // The interest reading for that week still exists and must still be shown.
  assert.ok(html.includes(missing.interestIndex.toFixed(0)));
});

test("the partial week is marked in words, never by colour alone", () => {
  const format = buildTooltipFormatter({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
  });
  const partial = data.points.find((point) => point.isPartialWeek);
  assert.ok(partial !== undefined);
  assert.match(format(partial.weekStart), /Partial week/);
});

// ---------------------------------------------------------------------------
// Responsive: the documented band change, not a shrunken dual-axis chart
// ---------------------------------------------------------------------------

test("below md the chart becomes two stacked single-axis panels", () => {
  const mobile = option(375);
  const grids = asArray(mobile["grid"], "grid");
  assert.equal(grids.length, 2, "mobile should use two grids");

  const xAxes = asArray(mobile["xAxis"], "xAxis");
  assert.equal(xAxes.length, 2, "each panel needs its own category axis");
  // One x-domain: both axes carry the same weeks.
  assert.deepEqual(xAxes[0]?.["data"], xAxes[1]?.["data"]);

  const yAxes = asArray(mobile["yAxis"], "yAxis");
  assert.equal(yAxes[0]?.["gridIndex"], 0, "oil belongs to the upper panel");
  assert.equal(yAxes[1]?.["gridIndex"], 1, "interest belongs to the lower panel");
  // Units survive the layout change — that is the whole point of not shrinking.
  assert.equal(yAxes[0]?.["name"], AXIS_TITLE.oil);
  assert.equal(yAxes[1]?.["name"], AXIS_TITLE.interest);
  assert.equal(yAxes[1]?.["min"], 0);
  assert.equal(yAxes[1]?.["max"], 100);

  // One hover must read both panels, or they are two charts side by side.
  const pointer = mobile["axisPointer"] as OptionObject;
  assert.ok(pointer !== undefined, "the stacked layout needs a linked axis pointer");
  assert.deepEqual(pointer["link"], [{ xAxisIndex: [0, 1] }]);
});

test("at and above md the chart is a single grid with two y-axes", () => {
  for (const width of [768, 1280, 1920]) {
    const built = option(width);
    assert.ok(!Array.isArray(built["grid"]), `${String(width)}px should use one grid`);
    assert.equal(asArray(built["xAxis"], "xAxis").length, 1);
    assert.equal(asArray(built["yAxis"], "yAxis").length, 2);
  }
});

test("neither layout drops an observation", () => {
  // `filterMode: "none"` on the zoom, and the full series in both bands. A series
  // that loses points to a viewport is a different series.
  for (const width of [375, 1280]) {
    const built = option(width);
    assert.equal(
      asArray(seriesById(built, "oil")["data"], "oil data").length,
      data.points.length,
    );
    const zoom = asArray(built["dataZoom"], "dataZoom")[0];
    assert.equal(zoom?.["filterMode"], "none", "zoom must not filter the data");
  }
});

test("x-axis tick density falls with width so labels cannot collide", () => {
  const interval = (widthPx: number): number => {
    const built = option(widthPx);
    const axes = asArray(built["xAxis"], "xAxis");
    // The labelled axis is the last one: in the stacked layout the upper panel's
    // labels are hidden.
    const labelled = axes[axes.length - 1];
    return Number((labelled?.["axisLabel"] as OptionObject)["interval"]);
  };
  assert.ok(interval(375) > interval(1920), "mobile should skip more ticks than desktop");
});

// ---------------------------------------------------------------------------
// Zoom, pan and reset
// ---------------------------------------------------------------------------

test("wheel zoom requires a modifier so the page can still scroll", () => {
  const zoom = asArray(option(1280)["dataZoom"], "dataZoom")[0];
  assert.ok(zoom !== undefined);
  assert.equal(zoom["zoomOnMouseWheel"], "ctrl");
  assert.equal(zoom["moveOnMouseWheel"], false);
  // A chart inside a long-scroll article that swallows the wheel is worse than one
  // that does not zoom at all.
  assert.equal(zoom["preventDefaultMouseMove"], false);
});

test("the declared interactions are coherent and include a reset", () => {
  // `assertInteractionsCoherent` throws at module load if they are not, so reaching
  // this line already proves it. Asserted explicitly so the intent is readable.
  assert.equal(OIL_VS_INTEREST_INTERACTIONS.zoom, true);
  assert.equal(OIL_VS_INTEREST_INTERACTIONS.reset, true);
  assert.equal(OIL_VS_INTEREST_INTERACTIONS.legendToggle, true);
  assert.equal(OIL_VS_INTEREST_INTERACTIONS.inspect, true);
});

test("the canvas legend is off, because the HTML one is the operable control", () => {
  // ECharts' legend is painted into the canvas, so it cannot be tabbed to, focused or
  // announced — §5 rule 6 requires every control to be keyboard-operable. `ChartLegend`
  // renders real buttons instead. The legend MODEL stays declared so the two series
  // names are registered, and it names only those two: the provisional overlay is a
  // treatment of the oil line and must not be independently hideable.
  const legend = option(1280)["legend"] as OptionObject;
  assert.equal(legend["show"], false);
  const names = seriesName(data);
  assert.deepEqual(legend["data"], [names.oil, names.interest]);
});

test("hiding a series removes it from the option and from the tooltip", () => {
  const base = { data, theme, resolveColour, rootFontSizePx: ROOT_FONT_SIZE_PX };

  const withoutOil = buildOilVsInterestOption({
    ...base,
    widthPx: 1280,
    hiddenSeries: ["oil"],
  });
  const ids = asArray(withoutOil["series"], "series").map((entry) => entry["id"]);
  assert.ok(!ids.includes("oil"), "the oil series should be gone");
  // The dashed provisional run is a treatment of the oil line, so it goes with it.
  assert.ok(!ids.includes("oil-provisional"), "the provisional overlay should go too");
  assert.ok(ids.includes("interest"), "the other series must be untouched");

  // Axis semantics survive: both axes keep their fixed domains, so the remaining
  // series is not silently rescaled to fill the plot.
  const axes = asArray(withoutOil["yAxis"], "yAxis");
  assert.equal(axes[AXIS_INDEX.interest]?.["min"], 0);
  assert.equal(axes[AXIS_INDEX.interest]?.["max"], 100);
  assert.equal(axes[AXIS_INDEX.oil]?.["min"], data.oilAxis.min);

  const format = buildTooltipFormatter({
    ...base,
    widthPx: 1280,
    hiddenSeries: ["oil"],
  });
  const complete = data.points.find((point) => point.oilUsdPerBarrel !== null);
  assert.ok(complete !== undefined);
  const html = format(complete.weekStart);
  assert.ok(!html.includes("/ barrel"), "a hidden series must not appear in the tooltip");
  assert.match(html, /\/ 100 index/, "the visible series must still be reported");

  const withoutInterest = buildOilVsInterestOption({
    ...base,
    widthPx: 1280,
    hiddenSeries: ["interest"],
  });
  const remaining = asArray(withoutInterest["series"], "series").map((entry) => entry["id"]);
  assert.ok(!remaining.includes("interest"));
  assert.ok(remaining.includes("oil"));
});

// ---------------------------------------------------------------------------
// The tabular fallback is the same data
// ---------------------------------------------------------------------------

test("the fallback table has one row per observation, from the same selected data", () => {
  const rows = buildChartTableRows(data);
  assert.equal(rows.length, data.points.length);
  assert.equal(rows.length, bundle.panel.coverage.trends_weeks);

  for (const [index, point] of data.points.entries()) {
    const row = rows[index];
    assert.ok(row !== undefined);
    assert.equal(row.week, formatWeek(point.weekStart));
    assert.equal(
      row.oil,
      point.oilUsdPerBarrel === null ? "No observation" : point.oilUsdPerBarrel.toFixed(2),
      `row ${String(index)} oil cell`,
    );
    assert.equal(row.interest, point.interestIndex.toFixed(0), `row ${String(index)} interest`);
  }
});

test("the fallback marks provisional and missing rows in words", () => {
  const rows = buildChartTableRows(data);
  const partialWeek = bundle.panel.coverage.partial_weeks[0];
  const missingWeek = bundle.panel.coverage.weeks_without_oil[0];
  assert.ok(partialWeek !== undefined && missingWeek !== undefined);

  const partialRow = rows.find((row) => row.week === formatWeek(partialWeek));
  assert.ok(partialRow !== undefined);
  assert.match(partialRow.note, /Partial week/);

  const missingRow = rows.find((row) => row.week === formatWeek(missingWeek));
  assert.ok(missingRow !== undefined);
  assert.equal(missingRow.oil, "No observation");
});

test("the fallback column headers name both units", () => {
  const columns = OIL_VS_INTEREST_A11Y.tableColumns;
  assert.equal(columns.length, 4);
  assert.ok(
    columns.some((column) => /USD/.test(column) && /barrel/.test(column)),
    "no column names the oil unit",
  );
  assert.ok(
    columns.some((column) => /index/i.test(column)),
    "no column names the interest unit",
  );
});

// ---------------------------------------------------------------------------
// Accessibility contract
// ---------------------------------------------------------------------------

test("the chart declares a specific title, a description and a finding", () => {
  const a11y = OIL_VS_INTEREST_A11Y;
  assert.ok(a11y.title.length > 0);
  assert.ok(!/^(figure|chart)\s*\d/i.test(a11y.title), "the title must be specific");
  // The description tells a reader where to look; the long description states the
  // finding. A long description that only names the axes fails §5 rule 3.
  assert.ok(a11y.description.length > 40);
  assert.ok(a11y.longDescription.length > 200);
  assert.equal(a11y.hasProvisionalData, bundle.panel.coverage.partial_weeks.length > 0);
  assert.match(a11y.source, /Google Trends/);
});

test("the long description names both units and the specification caveat", () => {
  const text = OIL_VS_INTEREST_A11Y.longDescription.toLowerCase();
  assert.ok(text.includes("barrel"), "the oil unit is missing from the long description");
  assert.ok(text.includes("index"), "the interest unit is missing");
  // §16: the level co-movement may not be described without its qualification.
  assert.ok(
    text.includes("week-to-week") || text.includes("first differenc"),
    "the specification comparison is missing from the long description",
  );
  assert.ok(text.includes("trend"), "the shared-trend confound is not named");
});

test("no causal language appears in the chart's own copy", () => {
  /**
   * The artifacts classify the worldwide association as `level_only_association`,
   * and a chart of two rising lines is exactly where causal wording creeps in.
   *
   * WHY THIS IS PER-SENTENCE AND NOT A SUBSTRING BAN
   * A blanket ban on "caused" was tried first and it failed on the honest sentence
   * "Nothing here establishes that one measure caused the other" — which is not a
   * causal claim, it is the required denial of one. Banning the vocabulary would have
   * forced the copy to talk around the point, which is worse than the risk it guards
   * against. So the check skips sentences that carry a negation, and flags a causal
   * verb only where it is being asserted.
   */
  const negations = [
    "nothing",
    "does not",
    "do not",
    "did not",
    "cannot",
    "no evidence",
    "not evidence",
    "never",
    "rather than",
    "not establish",
  ];
  const causal = [
    "caused",
    "causes",
    "drove",
    "drives",
    "driven by",
    "because of",
    "led to",
    "resulted in",
    "due to",
    "in response to",
    "impact of",
    "effect of",
    "proves",
  ];

  const sentences = [
    OIL_VS_INTEREST_A11Y.title,
    OIL_VS_INTEREST_A11Y.description,
    OIL_VS_INTEREST_A11Y.longDescription,
  ]
    .join(" ")
    .split(/(?<=[.!?])\s+/);

  const violations: string[] = [];
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (negations.some((marker) => lower.includes(marker))) continue;
    for (const phrase of causal) {
      if (lower.includes(phrase)) violations.push(`"${sentence.trim()}" → ${phrase}`);
    }
  }

  assert.deepEqual(violations, [], "a causal claim is asserted in chart copy");
});

test("the chart copy explicitly denies causation somewhere", () => {
  // The other half of the rule above. Skipping negated sentences means the suite
  // would also pass if the denial were simply deleted, so its presence is asserted.
  const text = OIL_VS_INTEREST_A11Y.longDescription.toLowerCase();
  assert.ok(
    /nothing here establishes|does not establish|not evidence/.test(text),
    "the long description no longer states that the chart does not establish causation",
  );
});

test("the specification flags come from the artifact, not from prose", () => {
  const specs = bundle.metrics.series.worldwide.trend_diagnostics.specifications;
  const levels = specs.find((spec) => spec.id === "levels");
  const differences = specs.find((spec) => spec.id === "first_differences");
  assert.ok(levels !== undefined && differences !== undefined);

  assert.equal(data.specification.levelsSignificant, levels.significant_at_alpha);
  assert.equal(
    data.specification.firstDifferencesSignificant,
    differences.significant_at_alpha,
  );
  assert.equal(
    data.specification.evidenceGroup,
    bundle.metrics.series.worldwide.classification.evidence_group,
  );
  // The condition the on-page caveat renders under. If this ever flipped, the copy
  // would change with it rather than going stale.
  assert.equal(data.specification.levelsSignificant, true);
  assert.equal(data.specification.firstDifferencesSignificant, false);
});

test("the unit strings shown to a reader are the artifact's own", () => {
  assert.equal(data.units.oil, bundle.panel.units.brent_usd_per_barrel);
  assert.equal(data.units.interest, bundle.panel.units.interest);
  // The interest unit must keep saying the levels are not comparable between series.
  assert.match(data.units.interest, /not comparable/i);
});

test("the interest series label is read from the registry", () => {
  const entry = bundle.countries.series.find((series) => series.id === "worldwide");
  assert.ok(entry !== undefined);
  assert.equal(data.labels.interest, entry.label);
});
