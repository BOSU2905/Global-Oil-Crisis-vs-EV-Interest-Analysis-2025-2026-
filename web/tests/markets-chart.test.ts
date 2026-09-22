/**
 * Five-market chart contract tests.
 *
 * WHAT THESE PROTECT, AND WHY IT IS A DIFFERENT RISK FROM THE PROTOTYPE'S
 * `chart-contract.test.ts` guards a dual-axis chart, where the danger is two units on
 * two scales manufacturing a relationship. This chart has one axis and five series, and
 * its danger is the opposite shape: five independently normalised series that LOOK
 * directly comparable.
 *
 *   1. NO SERIES MAY BE RESCALED, and the axis must be the measure's own 0-100 domain.
 *      Five lines auto-scaled to their own sample ranges would each be stretched by a
 *      different factor, which destroys even the shape comparison the chart is for.
 *   2. NOTHING MAY RANK OR AGGREGATE THE MARKETS. No mean across markets, no combined
 *      index, no ordering by a measured value, and no reference to the series-local
 *      block where `mean_interest` and `peak_value` live.
 *   3. EVERY PEAK MUST BE AN ARTIFACT VALUE. A peak found by scanning for a maximum in
 *      JavaScript is a second analytical source, and it would disagree with the
 *      published one wherever a peak is tied.
 *   4. THE NORMALISATION CAVEAT MUST TRAVEL WITH THE CHART. Axis title, visible
 *      description, long description and tooltip — a reader must not be able to see the
 *      five lines without it.
 *   5. THE TABLE MUST BE THE SAME DATA. Column headers and cells line up, five markets
 *      in the same order as the legend.
 *
 * These run against the REAL artifacts, not fixtures. A fixture would let the contract
 * pass while the shipped data broke it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadArtifactBundle } from "../src/data/load-node.ts";
import { COUNTRY_IDS } from "../src/data/index.ts";
import {
  MARKET_INTEREST_AXIS,
  selectInterestAcrossMarkets,
} from "../src/lib/interest-across-markets.ts";
import {
  MARKETS_AXIS_TITLE,
  MARKETS_INTERACTIONS,
  NORMALISATION_CAVEAT,
  buildMarketTableRows,
  buildMarketsA11y,
  toMarketTableCells,
} from "../src/components/chart/markets-contract.ts";
import {
  buildMarketsOption,
  buildMarketsTooltipFormatter,
  marketSeriesName,
} from "../src/components/chart/markets-option.ts";
import type { OptionObject } from "../src/components/chart/echarts-theme.ts";
import { AXIS_LABEL_MARGIN, GRID_PADDING } from "../src/components/chart/echarts-theme.ts";
import { SERIES_IDENTITY } from "../src/styles/chart-language.ts";
import { CHART_TOKENS, type ChartTheme, type ChartTokenName } from "../src/styles/chart-language.ts";

const webRoot = join(import.meta.dirname, "..");

const bundle = loadArtifactBundle();
const data = selectInterestAcrossMarkets(bundle);
const a11y = buildMarketsA11y(data);

/** A stub theme: every token resolves to its own name, so bindings are traceable. */
const theme: ChartTheme = Object.fromEntries(
  (Object.keys(CHART_TOKENS) as ChartTokenName[]).map((key) => [key, tokenStub(key)]),
) as ChartTheme;

function tokenStub(key: ChartTokenName): string {
  if (/Size$/.test(key)) return "0.8125rem";
  if (/Padding$/.test(key)) return "0.75rem";
  if (/Width$|Radius$/.test(key)) return "2px";
  if (key === "areaOpacity" || key === "dimmedOpacity" || key === "scatterOpacity") return "0.1";
  if (/Dash$/.test(key)) return "3 3";
  return `token(${key})`;
}

const resolveColour = (name: string): string => `colour(${name})`;
const ROOT_FONT_SIZE_PX = 16;

const option = (widthPx: number, hidden?: readonly (typeof COUNTRY_IDS)[number][]): OptionObject =>
  buildMarketsOption({
    data,
    theme,
    resolveColour,
    widthPx,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
    ...(hidden === undefined ? {} : { hiddenMarkets: hidden }),
  });

const asArray = (value: unknown, what: string): OptionObject[] => {
  assert.ok(Array.isArray(value), `${what} should be an array`);
  return value as OptionObject[];
};

const seriesById = (built: OptionObject, id: string): OptionObject => {
  const match = asArray(built["series"], "series").find((entry) => entry["id"] === id);
  assert.ok(match !== undefined, `no series with id "${id}"`);
  return match;
};

// ---------------------------------------------------------------------------
// All five markets, and only the five
// ---------------------------------------------------------------------------

test("the selector returns exactly the five canonical markets, in registry order", () => {
  assert.deepEqual(
    data.series.map((market) => market.id),
    [...COUNTRY_IDS],
    "series order must be the registry's, so it cannot be read as a ranking",
  );
});

test("the chart draws one line per market and no aggregate", () => {
  const built = option(1280);
  const ids = asArray(built["series"], "series").map((entry) => entry["id"]);
  assert.deepEqual([...ids].sort(), [...COUNTRY_IDS].sort());
  // No worldwide series: it is an aggregate of a different scope and putting it beside
  // the five would invite exactly the level comparison the normalisation forbids.
  assert.ok(!ids.includes("worldwide"), "the worldwide aggregate must not appear here");
});

test("every series name is the market's registry label", () => {
  const names = marketSeriesName(data);
  for (const market of data.series) {
    assert.equal(names[market.id], market.label);
    assert.equal(seriesById(option(1280), market.id)["name"], market.label);
  }
});

test("one week per panel row, in order, with every market's own value", () => {
  assert.equal(data.weeks.length, bundle.panel.rows.length);
  data.weeks.forEach((week, index) => {
    const row = bundle.panel.rows[index];
    assert.ok(row !== undefined);
    assert.equal(week.weekStart, row.week_start);
    for (const id of COUNTRY_IDS) {
      assert.equal(week.values[id], row.interest[id], `${id} at ${row.week_start}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Values are verbatim and the axis is the measure's domain
// ---------------------------------------------------------------------------

test("plotted values are the artifact's own index values, untouched", () => {
  const built = option(1280);
  for (const market of data.series) {
    const plotted = seriesById(built, market.id)["data"];
    assert.ok(Array.isArray(plotted));
    assert.deepEqual(
      plotted,
      bundle.panel.rows.map((row) => row.interest[market.id]),
      `${market.id} was rescaled on the way into the chart`,
    );
  }
});

test("the single y-axis is the measure's 0-100 domain, not the sample's range", () => {
  const axis = asArray(option(1280)["yAxis"], "yAxis")[0];
  assert.ok(axis !== undefined);
  assert.equal(axis["min"], 0);
  assert.equal(axis["max"], 100);
  assert.equal(axis["min"], MARKET_INTEREST_AXIS.min);
  assert.equal(axis["max"], MARKET_INTEREST_AXIS.max);

  // The sample's own range is narrower than 0-100 for at least one market, so an
  // auto-scaled axis would visibly differ. That is what makes this assertion load-bearing.
  const lowest = Math.min(...COUNTRY_IDS.map((id) => Math.min(...data.weeks.map((w) => w.values[id]))));
  assert.ok(lowest > 0, "fixture check: some market never reaches 0, so 0 is not the sample min");
});

test("the axis title names the per-market normalisation", () => {
  const axis = asArray(option(1280)["yAxis"], "yAxis")[0];
  assert.ok(axis !== undefined);
  assert.equal(axis["name"], MARKETS_AXIS_TITLE);
  assert.match(String(axis["name"]), /per market/i);
});

test("hiding a market removes its line and cannot rescale the others", () => {
  const built = option(1280, ["norway"]);
  const ids = asArray(built["series"], "series").map((entry) => entry["id"]);
  assert.ok(!ids.includes("norway"));
  assert.equal(ids.length, COUNTRY_IDS.length - 1);

  const axis = asArray(built["yAxis"], "yAxis")[0];
  assert.ok(axis !== undefined);
  assert.equal(axis["min"], 0);
  assert.equal(axis["max"], 100);
});

// ---------------------------------------------------------------------------
// Colour is never the only cue
// ---------------------------------------------------------------------------

test("each market carries its own colour, dash and marker from the identity table", () => {
  const built = option(1280);
  const dashes: string[] = [];
  for (const market of data.series) {
    const identity = SERIES_IDENTITY[market.id];
    const series = seriesById(built, market.id);
    const lineStyle = series["lineStyle"] as OptionObject;
    assert.equal(lineStyle["color"], `colour(${identity.colorVariable})`);
    dashes.push(JSON.stringify(lineStyle["type"]));
    assert.equal(series["symbol"], identity.marker);
  }
  assert.equal(new Set(dashes).size, dashes.length, "two markets share a dash pattern");
});

test("the closest colour pair is separated by dash, in the built option", () => {
  const built = option(1280);
  const singapore = (seriesById(built, "singapore")["lineStyle"] as OptionObject)["type"];
  const us = (seriesById(built, "us")["lineStyle"] as OptionObject)["type"];
  assert.notDeepEqual(singapore, us, "cyan and blue must not both be solid");
});

// ---------------------------------------------------------------------------
// Peaks are artifact values, marked but not labelled
// ---------------------------------------------------------------------------

test("every peak marker sits on the artifact's own peak week for that market", () => {
  const dispersion = bundle.metrics.global.peak_dispersion.peaks;
  const built = option(1280);

  for (const market of data.series) {
    assert.equal(market.peakWeek, dispersion[market.id], `${market.id} peak week`);
    const markPoint = seriesById(built, market.id)["markPoint"] as OptionObject;
    const points = asArray(markPoint["data"], "markPoint.data");
    assert.equal(points.length, 1, "one peak marker per market, no more");
    assert.equal(points[0]?.["xAxis"], dispersion[market.id]);
  }
});

test("a peak marker sits ON the line, at the value the chart draws that week", () => {
  const built = option(1280);
  for (const market of data.series) {
    const markPoint = seriesById(built, market.id)["markPoint"] as OptionObject;
    const point = asArray(markPoint["data"], "markPoint.data")[0];
    const week = data.weeks.find((entry) => entry.weekStart === market.peakWeek);
    assert.ok(week !== undefined);
    assert.equal(point?.["yAxis"], week.values[market.id]);
  }
});

test("peak markers carry no text label, so five of them cannot collide", () => {
  const built = option(1280);
  for (const market of data.series) {
    const markPoint = seriesById(built, market.id)["markPoint"] as OptionObject;
    const label = markPoint["label"] as OptionObject;
    assert.equal(label["show"], false, `${market.id}'s peak must not be labelled on the plot`);
  }
});

test("the peak dates are stated without interaction, in the accessible description", () => {
  for (const market of data.series) {
    // Rendered as "15 Feb 2026" rather than as an ISO string, so the assertion is on the
    // day and year rather than on the format.
    const [year, , day] = market.peakWeek.split("-");
    assert.ok(year !== undefined && day !== undefined);
    assert.ok(
      a11y.longDescription.includes(`${String(Number(day))} `),
      `${market.id}'s peak day is missing from the long description`,
    );
    assert.ok(a11y.longDescription.includes(market.label));
  }
});

// ---------------------------------------------------------------------------
// No ranking, no aggregation, no series-local metric
// ---------------------------------------------------------------------------

test("the selector never reads the series-local profile", () => {
  const source = readFileSync(join(webRoot, "src", "lib", "interest-across-markets.ts"), "utf8");
  const code = source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

  for (const forbidden of [
    "series_local",
    "mean_interest",
    "median_interest",
    "peak_value",
    "min_interest",
  ]) {
    assert.ok(
      !code.includes(forbidden),
      `the selector reads "${forbidden}", which is not comparable across series`,
    );
  }
});

test("nothing in the markets chart layer sorts or aggregates the markets", () => {
  for (const relative of [
    join("src", "lib", "interest-across-markets.ts"),
    join("src", "components", "chart", "markets-option.ts"),
    join("src", "components", "chart", "markets-contract.ts"),
  ]) {
    const code = readFileSync(join(webRoot, relative), "utf8")
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
      })
      .join("\n");

    for (const forbidden of [".sort(", ".reverse(", "average", "Math.max(...", "Math.min(..."]) {
      assert.ok(!code.includes(forbidden), `${relative} contains "${forbidden}"`);
    }
  }
});

test("the comparability constraint travels with the selected data", () => {
  assert.equal(data.comparability.explanation, bundle.countries.comparability.explanation);
  assert.equal(data.comparability.remedy, bundle.countries.comparability.remedy);
  assert.deepEqual(
    data.comparability.forbiddenComparisons,
    bundle.countries.comparability.forbidden_comparisons,
  );
  assert.ok(data.comparability.forbiddenComparisons.length > 0);
});

// ---------------------------------------------------------------------------
// The caveat is unmissable, and the description states the finding
// ---------------------------------------------------------------------------

test("the normalisation caveat is one string, used verbatim wherever it appears", () => {
  assert.match(NORMALISATION_CAVEAT, /normalised independently within each market/);
  assert.match(NORMALISATION_CAVEAT, /shape and timing/);
  assert.match(NORMALISATION_CAVEAT, /not the absolute height/);
});

test("the visible description tells the reader what to compare and what not to", () => {
  assert.match(a11y.description, /scaled to its own maximum/);
  assert.match(a11y.description, /not at how high one sits against another/);
});

test("the long description states the peak dispersion as the finding", () => {
  const spread = bundle.metrics.global.peak_dispersion;
  assert.ok(a11y.longDescription.includes(String(spread.distinct_weeks)));
  assert.ok(a11y.longDescription.includes(String(spread.span_weeks)));
  assert.ok(
    a11y.longDescription.includes(spread.synchronised_within_one_month ? "synchronised" : "not synchronised"),
    "the long description must state the synchronisation finding either way",
  );
});

test("no causal language appears in the chart's own copy", () => {
  const causal = [
    " caused",
    " causes",
    " drove ",
    " drives ",
    " led to ",
    " triggered",
    " because of ",
    " due to ",
    " resulted in ",
    " impact of ",
    " effect of ",
  ];
  const sentences = [a11y.title, a11y.description, a11y.longDescription, NORMALISATION_CAVEAT]
    .join(" ")
    .split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    const lowered = ` ${sentence.toLowerCase()} `;
    // A sentence carrying a negation is the required DENIAL, not a claim — "Nothing here
    // establishes that oil prices caused any of these movements" must be allowed.
    if (/\b(no|not|nothing|never|cannot|neither)\b/.test(lowered)) continue;
    for (const phrase of causal) {
      assert.ok(!lowered.includes(phrase), `causal phrase "${phrase.trim()}" in: ${sentence}`);
    }
  }
});

test("the chart copy explicitly denies causation", () => {
  assert.match(
    a11y.longDescription,
    /Nothing here establishes that oil prices caused/,
    "the denial must be present, or the negation skip above could hide its deletion",
  );
});

// ---------------------------------------------------------------------------
// Interaction: slider, inside zoom, reset
// ---------------------------------------------------------------------------

test("the declared interactions are coherent and include a reset", () => {
  assert.equal(MARKETS_INTERACTIONS.zoom, true);
  assert.equal(MARKETS_INTERACTIONS.pan, true);
  assert.equal(MARKETS_INTERACTIONS.reset, true);
  assert.equal(MARKETS_INTERACTIONS.legendToggle, true);
  // Off, deliberately: with five series, dimming four on every hover is motion the
  // reader did not ask for.
  assert.equal(MARKETS_INTERACTIONS.highlight, false);
});

test("a visible zoom slider is declared alongside the inside-zoom accelerator", () => {
  const zooms = asArray(option(1280)["dataZoom"], "dataZoom");
  const types = zooms.map((zoom) => zoom["type"]);
  assert.deepEqual(types, ["inside", "slider"], "the slider is the primary visible control");

  const slider = zooms[1];
  assert.ok(slider !== undefined);
  assert.equal(slider["start"], 0);
  assert.equal(slider["end"], 100);
  // No observation may be filtered out by a viewport.
  assert.equal(slider["filterMode"], "none");
  // The floating value bubble covers the plot at exactly the moment a reader is reading it.
  assert.equal(slider["showDetail"], false);
});

test("plain wheel still scrolls the page; the modifier is an accelerator", () => {
  const inside = asArray(option(1280)["dataZoom"], "dataZoom")[0];
  assert.ok(inside !== undefined);
  assert.equal(inside["zoomOnMouseWheel"], "ctrl");
  assert.equal(inside["moveOnMouseWheel"], false);
  assert.equal(inside["moveOnMouseMove"], true);
  assert.equal(inside["filterMode"], "none");
});

test("the canvas legend is off, because the HTML one is the operable control", () => {
  const legend = option(1280)["legend"] as OptionObject;
  assert.equal(legend["show"], false);
  assert.deepEqual(legend["data"], data.series.map((market) => market.label));
});

// ---------------------------------------------------------------------------
// Tooltip: one week, five markets
// ---------------------------------------------------------------------------

test("the tooltip names the week and every visible market with its value", () => {
  const format = buildMarketsTooltipFormatter({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
  });
  const week = data.weeks[10];
  assert.ok(week !== undefined);

  const html = format(week.weekStart);
  assert.match(html, /Week of/);
  for (const market of data.series) {
    assert.ok(html.includes(market.label), `${market.label} missing from the tooltip`);
    assert.ok(
      html.includes(String(week.values[market.id])),
      `${market.label}'s value missing from the tooltip`,
    );
  }
  // The constraint is repeated in the readout, because the readout is where five numbers
  // sit closest together and look most comparable.
  assert.match(html, /scaled to its own maximum/);
});

test("the tooltip tags a market's own peak week and no other", () => {
  const format = buildMarketsTooltipFormatter({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
  });
  const norway = data.series.find((market) => market.id === "norway");
  assert.ok(norway !== undefined);

  const atPeak = format(norway.peakWeek);
  assert.match(atPeak, /own peak/);

  const notPeak = data.weeks.find(
    (week) => !data.series.some((market) => market.peakWeek === week.weekStart),
  );
  assert.ok(notPeak !== undefined);
  assert.ok(!format(notPeak.weekStart).includes("own peak"));
});

test("the tooltip carries no classification, coefficient or p-value", () => {
  const format = buildMarketsTooltipFormatter({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
  });
  const html = data.weeks.map((week) => format(week.weekStart)).join(" ");
  for (const forbidden of [
    "r =",
    "p =",
    "pearson",
    "level_only",
    "no_detectable",
    "inconclusive",
    "fragile",
    "robust",
  ]) {
    assert.ok(!html.toLowerCase().includes(forbidden.toLowerCase()), `tooltip contains "${forbidden}"`);
  }
});

test("a hidden market disappears from the tooltip too", () => {
  const format = buildMarketsTooltipFormatter({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
    hiddenMarkets: ["malaysia"],
  });
  const week = data.weeks[10];
  assert.ok(week !== undefined);
  const html = format(week.weekStart);
  assert.ok(!html.includes("Malaysia"));
  assert.ok(html.includes("Norway"));
});

// ---------------------------------------------------------------------------
// Layout and responsive configuration
// ---------------------------------------------------------------------------

test("the grid reserves room for the slider and the axis labels", () => {
  const grid = option(1280)["grid"] as OptionObject;
  assert.equal(grid["containLabel"], true);
  assert.equal(grid["top"], GRID_PADDING.top);
  assert.equal(grid["left"], GRID_PADDING.left);
  assert.equal(grid["right"], GRID_PADDING.right);
  // Below the week labels, or the slider track is drawn over them.
  assert.ok(Number(grid["bottom"]) > 40, "the slider needs vertical room of its own");
});

test("axis labels keep their documented distance from the axis line", () => {
  const built = option(1280);
  const xAxis = asArray(built["xAxis"], "xAxis")[0];
  const yAxis = asArray(built["yAxis"], "yAxis")[0];
  assert.ok(xAxis !== undefined && yAxis !== undefined);
  assert.equal((xAxis["axisLabel"] as OptionObject)["margin"], AXIS_LABEL_MARGIN.category);
  assert.equal((yAxis["axisLabel"] as OptionObject)["margin"], AXIS_LABEL_MARGIN.value);
  // ECharts' default is 8 for both, which is what put the first week label against the
  // value column.
  assert.ok(AXIS_LABEL_MARGIN.category > 8 && AXIS_LABEL_MARGIN.value > 8);
});

test("the axis title is anchored so a long name cannot leave the canvas", () => {
  const yAxis = asArray(option(1280)["yAxis"], "yAxis")[0];
  assert.ok(yAxis !== undefined);
  assert.equal((yAxis["nameTextStyle"] as OptionObject)["align"], "left");
});

test("x-axis tick density falls with width so labels cannot collide", () => {
  const densities = [375, 768, 1280, 1920].map((width) => {
    const xAxis = asArray(option(width)["xAxis"], "xAxis")[0];
    assert.ok(xAxis !== undefined);
    return Number((xAxis["axisLabel"] as OptionObject)["interval"]);
  });
  // A larger interval means fewer labels. Narrow viewports must not show more.
  for (let i = 1; i < densities.length; i += 1) {
    assert.ok(
      (densities[i] ?? 0) <= (densities[i - 1] ?? 0),
      `tick interval grew with width: ${densities.join(", ")}`,
    );
  }
});

test("annotation labels are withheld below md but the band still draws", () => {
  const narrow = seriesById(option(375), "indonesia")["markArea"] as OptionObject;
  const wide = seriesById(option(1280), "indonesia")["markArea"] as OptionObject;
  assert.ok(narrow !== undefined && wide !== undefined, "the band draws at both widths");
  assert.equal((narrow["label"] as OptionObject)["show"], false);
  assert.equal((wide["label"] as OptionObject)["show"], true);
  // Same span at both widths: only the text changes.
  assert.deepEqual(narrow["data"], wide["data"]);
});

test("the elevated band spans the artifact's onset week to the last oil week", () => {
  const markArea = seriesById(option(1280), "indonesia")["markArea"] as OptionObject;
  const span = asArray(markArea["data"], "markArea.data")[0];
  assert.ok(Array.isArray(span));
  const [from, to] = span as OptionObject[];
  assert.equal(from?.["xAxis"], bundle.metrics.global.regime.onset_week);
  assert.equal(to?.["xAxis"], bundle.metrics.global.oil.last_week);
});

test("the band is attached once, not once per market", () => {
  const built = option(1280);
  const withBand = asArray(built["series"], "series").filter(
    (entry) => entry["markArea"] !== undefined,
  );
  assert.equal(withBand.length, 1, "five overlaid bands would darken the plot fivefold");
});

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

test("the entrance animates once and updates do not", () => {
  const entering = buildMarketsOption({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
    animate: true,
  });
  assert.equal(entering["animation"], true);
  assert.ok(Number(entering["animationDuration"]) > 0);
  // The data must not move once drawn: an update is instant.
  assert.equal(entering["animationDurationUpdate"], 0);
});

test("reduced motion switches animation off rather than shortening it", () => {
  const still = buildMarketsOption({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
    animate: false,
  });
  assert.equal(still["animation"], false);
  for (const market of data.series) {
    assert.equal(seriesById(still, market.id)["animation"], false);
  }
});

test("series enter in sequence, so five lines do not arrive at once", () => {
  const built = buildMarketsOption({
    data,
    theme,
    resolveColour,
    widthPx: 1280,
    rootFontSizePx: ROOT_FONT_SIZE_PX,
    animate: true,
  });
  const delays = data.series.map((market) => Number(seriesById(built, market.id)["animationDelay"]));
  for (let i = 1; i < delays.length; i += 1) {
    assert.ok((delays[i] ?? 0) > (delays[i - 1] ?? 0), "series delays must increase");
  }
});

// ---------------------------------------------------------------------------
// The tabular twin
// ---------------------------------------------------------------------------

test("the fallback has one row per week and one cell per market", () => {
  const rows = buildMarketTableRows(data);
  assert.equal(rows.length, data.weeks.length);
  for (const row of rows) {
    assert.equal(row.values.length, data.series.length);
  }
});

test("the fallback's columns line up with its cells and with the legend order", () => {
  const cells = toMarketTableCells(buildMarketTableRows(data));
  // Week + five markets + note.
  assert.equal(a11y.tableColumns.length, data.series.length + 2);
  assert.deepEqual(a11y.tableColumns.slice(1, -1), data.series.map((market) => market.label));

  const first = cells[0];
  assert.ok(first !== undefined);
  assert.equal(first.values.length, a11y.tableColumns.length - 2);
});

test("the fallback carries the same values the chart draws", () => {
  const rows = buildMarketTableRows(data);
  data.weeks.forEach((week, index) => {
    const row = rows[index];
    assert.ok(row !== undefined);
    data.series.forEach((market, column) => {
      assert.equal(row.values[column], String(week.values[market.id]));
    });
  });
});

test("the fallback names each peak week in words, so it is never hover-only", () => {
  const rows = buildMarketTableRows(data);
  for (const market of data.series) {
    const index = data.weeks.findIndex((week) => week.weekStart === market.peakWeek);
    assert.ok(index >= 0);
    const note = rows[index]?.note ?? "";
    assert.match(note, /Peak:/);
    assert.ok(note.includes(market.label), `${market.label}'s peak is not named in its row`);
  }
});

test("the fallback marks the elevated window and the partial week in words", () => {
  const rows = buildMarketTableRows(data);
  const elevatedIndex = data.weeks.findIndex((week) => week.regime === "elevated");
  assert.ok(elevatedIndex >= 0);
  assert.match(rows[elevatedIndex]?.note ?? "", /Elevated crude price/);

  const partial = data.coverage.partialWeeks[0];
  assert.ok(partial !== undefined);
  const partialIndex = data.weeks.findIndex((week) => week.weekStart === partial);
  assert.match(rows[partialIndex]?.note ?? "", /Partial week/);
});

// ---------------------------------------------------------------------------
// Fonts, because a measured bug lived here
// ---------------------------------------------------------------------------

test("no rendered font size is sub-pixel, given rem-valued tokens", () => {
  const sizes: number[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === "fontSize" && typeof entry === "number") sizes.push(entry);
      else walk(entry);
    }
  };
  walk(option(1280));

  assert.ok(sizes.length > 0, "no font sizes found — did the option shape change?");
  for (const size of sizes) {
    assert.ok(size >= 8, `a font size of ${String(size)}px would be invisible`);
  }
});
