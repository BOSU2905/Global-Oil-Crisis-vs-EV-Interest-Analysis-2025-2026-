/**
 * Tests for the chart visual-language contract.
 *
 * The point of these is that the design language is enforceable rather than
 * aspirational: token completeness, redundant (non-colour) encoding, the
 * reserved oil colour, and the responsive/interaction invariants are all
 * checkable without a charting library.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SERIES_IDS } from "../src/data/index.ts";
import {
  BREAKPOINTS,
  CHART_HEIGHT_TOKENS,
  CHART_TOKENS,
  NO_INTERACTIONS,
  OIL_IDENTITY,
  SERIES_IDENTITY,
  assertInteractionsCoherent,
  axisTickBudget,
  chartTokenVar,
  dualAxisLayout,
  resolveChartTheme,
  seriesIdentity,
  type ChartInteractionCapabilities,
  type ChartTokenName,
} from "../src/styles/chart-language.ts";

// `import.meta.dirname`, not a slice of `import.meta.url` at the last "/":
// `fileURLToPath` returns backslashes on Windows, so `lastIndexOf("/")` is -1 there
// and the slice resolves to a path inside `tests/` instead of `web/`.
const webRoot = join(import.meta.dirname, "..");
const tokensCss = readFileSync(join(webRoot, "src", "styles", "tokens.css"), "utf8");

// ---------------------------------------------------------------------------
// Tokens actually exist in the stylesheet
// ---------------------------------------------------------------------------

test("every chart token is defined in tokens.css", () => {
  const missing = Object.entries(CHART_TOKENS)
    .filter(([, variable]) => !tokensCss.includes(`${variable}:`))
    .map(([key, variable]) => `${key} (${variable})`);
  assert.deepEqual(missing, []);
});

test("every chart height token is defined in tokens.css", () => {
  const missing = Object.values(CHART_HEIGHT_TOKENS).filter(
    (v) => !tokensCss.includes(`${v}:`),
  );
  assert.deepEqual(missing, []);
});

test("every series colour variable is defined in tokens.css", () => {
  const missing = SERIES_IDS.map((id) => SERIES_IDENTITY[id].colorVariable).filter(
    (v) => !tokensCss.includes(`${v}:`),
  );
  assert.deepEqual(missing, []);
  assert.ok(tokensCss.includes(`${OIL_IDENTITY.colorVariable}:`));
  assert.ok(tokensCss.includes(`${OIL_IDENTITY.fillVariable}:`));
});

test("breakpoints in the contract match the values recorded in tokens.css", () => {
  const pairs: [string, number][] = [
    ["--breakpoint-sm", BREAKPOINTS.sm],
    ["--breakpoint-md", BREAKPOINTS.md],
    ["--breakpoint-lg", BREAKPOINTS.lg],
    ["--breakpoint-xl", BREAKPOINTS.xl],
    ["--breakpoint-2xl", BREAKPOINTS.xxl],
  ];
  for (const [variable, expected] of pairs) {
    assert.ok(
      tokensCss.includes(`${variable}: ${expected}px`),
      `${variable} should be ${expected}px in tokens.css`,
    );
  }
});

test("both light and dark themes define every colour token that charts read", () => {
  // Dark mode must not silently fall back to a light value.
  const darkBlock = tokensCss.slice(tokensCss.indexOf('[data-theme="dark"]'));
  for (const variable of [
    "--color-oil",
    "--color-series-worldwide",
    "--color-country-indonesia",
    "--color-country-malaysia",
    "--color-country-norway",
    "--color-country-singapore",
    "--color-country-us",
    "--color-uncertainty",
    "--color-zero-line",
    "--color-provisional",
  ]) {
    assert.ok(darkBlock.includes(`${variable}:`), `dark theme is missing ${variable}`);
  }
});

// ---------------------------------------------------------------------------
// Redundant encoding: colour is never the only cue
// ---------------------------------------------------------------------------

test("every series has a distinct colour variable", () => {
  const colors = SERIES_IDS.map((id) => SERIES_IDENTITY[id].colorVariable);
  assert.equal(new Set(colors).size, colors.length);
});

test("every series has a distinct marker shape", () => {
  const markers = SERIES_IDS.map((id) => SERIES_IDENTITY[id].marker);
  assert.equal(new Set(markers).size, markers.length, "marker shapes must be unique");
});

test("the five countries have distinct dash patterns", () => {
  const countries = SERIES_IDS.filter((id) => !SERIES_IDENTITY[id].isAggregate);
  const dashes = countries.map((id) => JSON.stringify(SERIES_IDENTITY[id].dash));
  assert.equal(new Set(dashes).size, dashes.length, "dash patterns must be unique");
});

test("the closest colour pair is separated by dash pattern", () => {
  // Cyan (Singapore) and blue (United States) are the nearest hues in the
  // palette, so they must not both be solid lines.
  const singapore = seriesIdentity("singapore");
  const us = seriesIdentity("us");
  assert.notDeepEqual(singapore.dash, us.dash);
  assert.notEqual(singapore.marker, us.marker);
});

test("exactly one series is an aggregate", () => {
  const aggregates = SERIES_IDS.filter((id) => SERIES_IDENTITY[id].isAggregate);
  assert.deepEqual(aggregates, ["worldwide"]);
});

test("oil colour is reserved and never assigned to a series", () => {
  const seriesColors = SERIES_IDS.map((id) => SERIES_IDENTITY[id].colorVariable);
  assert.ok(!seriesColors.includes(OIL_IDENTITY.colorVariable));
});

test("no country is assigned the negative/red status colour", () => {
  // Guards the rule that country colours carry no sentiment: without red in the
  // palette, the set cannot be read as good-versus-bad.
  const countryColors = SERIES_IDS.filter((id) => !SERIES_IDENTITY[id].isAggregate).map(
    (id) => SERIES_IDENTITY[id].colorVariable,
  );
  for (const banned of ["--color-negative", "--color-positive", "--color-warning"]) {
    assert.ok(!countryColors.includes(banned as `--${string}`));
  }
});

// ---------------------------------------------------------------------------
// Theme resolution
// ---------------------------------------------------------------------------

test("resolveChartTheme resolves every token through the injected reader", () => {
  const requested: string[] = [];
  const theme = resolveChartTheme((name) => {
    requested.push(name);
    return `resolved(${name})`;
  });

  const tokenNames = Object.keys(CHART_TOKENS) as ChartTokenName[];
  assert.equal(requested.length, tokenNames.length);
  for (const key of tokenNames) {
    assert.equal(theme[key], `resolved(${CHART_TOKENS[key]})`);
  }
});

test("resolveChartTheme trims whitespace, as getComputedStyle returns it", () => {
  const theme = resolveChartTheme(() => "   #c2410c  ");
  assert.equal(theme.axisLabelColor, "#c2410c");
});

test("resolveChartTheme throws when tokens.css was not loaded", () => {
  assert.throws(
    () => resolveChartTheme(() => ""),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /tokens\.css/);
      return true;
    },
  );
});

test("resolveChartTheme names every unset variable, not just the first", () => {
  try {
    resolveChartTheme((name) => (name === CHART_TOKENS.gridColor ? "" : "x"));
    assert.fail("expected a throw");
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.match(error.message, /--chart-grid-color/);
  }
});

test("chartTokenVar produces a usable css var() reference", () => {
  assert.equal(chartTokenVar("gridColor"), "var(--chart-grid-color)");
  assert.equal(chartTokenVar("regimeFill"), "var(--chart-regime-fill)");
});

// ---------------------------------------------------------------------------
// Responsive contract
// ---------------------------------------------------------------------------

test("dual-axis charts split into stacked panels below the md breakpoint", () => {
  assert.equal(dualAxisLayout(1440), "dual-axis");
  assert.equal(dualAxisLayout(BREAKPOINTS.md), "dual-axis");
  assert.equal(dualAxisLayout(BREAKPOINTS.md - 1), "stacked-panels");
  assert.equal(dualAxisLayout(375), "stacked-panels");
});

test("axis tick budget increases monotonically with width", () => {
  const widths = [360, 700, 900, 1200, 1600];
  const budgets = widths.map(axisTickBudget);
  assert.deepEqual(
    budgets,
    [...budgets].sort((a, b) => a - b),
  );
  assert.equal(axisTickBudget(360), 4, "mobile must thin labels aggressively");
});

// ---------------------------------------------------------------------------
// Interaction contract
// ---------------------------------------------------------------------------

test("the default capability set is inspection only", () => {
  assert.equal(NO_INTERACTIONS.inspect, true);
  assert.equal(NO_INTERACTIONS.zoom, false);
  assert.equal(NO_INTERACTIONS.pan, false);
  assert.equal(NO_INTERACTIONS.brush, false);
  assert.doesNotThrow(() => assertInteractionsCoherent(NO_INTERACTIONS));
});

test("zoom or pan without reset is rejected", () => {
  const zoomNoReset: ChartInteractionCapabilities = { ...NO_INTERACTIONS, zoom: true };
  assert.throws(() => assertInteractionsCoherent(zoomNoReset), /reset/);

  const panNoReset: ChartInteractionCapabilities = { ...NO_INTERACTIONS, pan: true };
  assert.throws(() => assertInteractionsCoherent(panNoReset), /reset/);

  const withReset: ChartInteractionCapabilities = {
    ...NO_INTERACTIONS,
    zoom: true,
    pan: true,
    reset: true,
  };
  assert.doesNotThrow(() => assertInteractionsCoherent(withReset));
});

test("brush without hover inspection is rejected", () => {
  const brushOnly: ChartInteractionCapabilities = {
    ...NO_INTERACTIONS,
    brush: true,
    inspect: false,
  };
  assert.throws(() => assertInteractionsCoherent(brushOnly), /feedback/);
});
