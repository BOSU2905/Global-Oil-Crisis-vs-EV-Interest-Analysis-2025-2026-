/**
 * Wheel-zoom gesture mapping and CSS time parsing — the pure half of the zoom fix.
 *
 * THE DEFECT THESE GUARD AGAINST
 * ECharts' own wheel handler turned every wheel event into a fixed ≥10% zoom step,
 * whatever its size, and tweened each step over 100ms while new ones arrived every
 * 20ms. A slow, gentle trackpad pinch — many tiny events, some with the sign flipped as
 * the fingers settle — made the plot lurch back and forth. `EChart.tsx` now owns the
 * wheel, and these functions are the decisions it makes:
 *
 *   1. the zoom is PROPORTIONAL to the gesture, so a gentle pinch is a gentle zoom;
 *   2. zooming in and back out by the same distance returns EXACTLY to the start;
 *   3. the week under the pointer stays under the pointer;
 *   4. a tremor near a week boundary cannot flip the drawn window back and forth.
 *
 * The browser half — that a plain wheel scrolls the page, that a slow pinch never
 * reverses, that reset animates — is in `e2e/chart.e2e.ts`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LINE_HIT_PX,
  WEEK_SNAP_HYSTERESIS,
  WHEEL_STEP_LIMIT_PX,
  cssTimeToMs,
  nearestLine,
  optionWithout,
  settleWindowEdge,
  squaredDistanceToSegment,
  wheelDeltaPx,
  wheelZoomFactor,
  zoomCategoryWindow,
} from "../src/components/chart/echarts-theme.ts";

const INTERVALS = 30; // 31 weekly observations
const MIN_SPAN = 2.4; // 8% of the domain, the keyboard's own floor

// ---------------------------------------------------------------------------
// CSS time
// ---------------------------------------------------------------------------

test("cssTimeToMs reads both units, including the serialisation that broke reset", () => {
  // The production CSS serialises `--duration-slow: 360ms` as `.36s`.
  assert.equal(cssTimeToMs(".36s"), 360);
  assert.equal(cssTimeToMs("0.36s"), 360);
  assert.equal(cssTimeToMs("360ms"), 360);
  // Reduced motion collapses every duration to 1ms; it must stay 1ms, not 1000.
  assert.equal(cssTimeToMs("1ms"), 1);
  assert.equal(cssTimeToMs(" 200ms "), 200);
});

test("cssTimeToMs refuses what it cannot read rather than returning zero", () => {
  assert.ok(Number.isNaN(cssTimeToMs("")));
  assert.ok(Number.isNaN(cssTimeToMs("fast")));
  // Unitless is not a CSS <time>; guessing a unit would hide a renamed token.
  assert.ok(Number.isNaN(cssTimeToMs("360")));
});

// ---------------------------------------------------------------------------
// Delta and factor
// ---------------------------------------------------------------------------

test("wheel deltas are normalised to pixels for every deltaMode", () => {
  assert.equal(wheelDeltaPx(-0.6, 0), -0.6);
  assert.equal(wheelDeltaPx(3, 1), 48);
  assert.equal(wheelDeltaPx(1, 2), 400);
  assert.equal(wheelDeltaPx(Number.NaN, 0), 0);
});

test("wheel up zooms in, wheel down zooms out, and zero does nothing", () => {
  assert.ok(wheelZoomFactor(-5) > 1);
  assert.ok(wheelZoomFactor(5) < 1);
  assert.equal(wheelZoomFactor(0), 1);
});

test("the zoom is proportional: a gentle pinch tick is a small fraction of a notch", () => {
  // The defect: ECharts gave a 0.6px tick the same 9% step as a 100px notch.
  const tick = wheelZoomFactor(-0.6) - 1;
  const notch = wheelZoomFactor(-120) - 1;
  assert.ok(tick > 0 && tick < 0.01, `a 0.6px tick zoomed ${String(tick)}`);
  assert.ok(notch > 0.15 && notch < 0.3, `a mouse notch zoomed ${String(notch)}`);
  assert.ok(notch / tick > 25, "a notch must be far larger than a pinch tick");
});

test("thirty gentle ticks zoom gently, where ECharts went from 100% to 5.7%", () => {
  let factor = 1;
  for (let i = 0; i < 30; i += 1) factor *= wheelZoomFactor(-0.6);
  const span = 100 / factor;
  assert.ok(span > 80 && span < 90, `thirty 0.6px ticks left ${String(span)}% in view`);
});

test("one mouse notch is clamped to a modest step instead of a lurch", () => {
  assert.equal(wheelZoomFactor(-120), wheelZoomFactor(-WHEEL_STEP_LIMIT_PX));
  assert.equal(wheelZoomFactor(-1000), wheelZoomFactor(-WHEEL_STEP_LIMIT_PX));
});

test("in and back out by the same distance returns exactly to the start", () => {
  for (const delta of [0.3, 1, 7.5, WHEEL_STEP_LIMIT_PX]) {
    const roundTrip = wheelZoomFactor(-delta) * wheelZoomFactor(delta);
    assert.ok(
      Math.abs(roundTrip - 1) < 1e-12,
      `delta ${String(delta)} drifted ${String(roundTrip)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

test("zooming about an anchor keeps the anchor at the same place on screen", () => {
  const before = { start: 4, end: 24 };
  const anchor = 9; // a quarter of the way across
  const after = zoomCategoryWindow(before, anchor, 1.25, INTERVALS, MIN_SPAN);
  const fractionBefore = (anchor - before.start) / (before.end - before.start);
  const fractionAfter = (anchor - after.start) / (after.end - after.start);
  assert.ok(Math.abs(fractionBefore - fractionAfter) < 1e-12);
  assert.ok(after.end - after.start < before.end - before.start);
});

test("the window never leaves the domain and never narrows below the floor", () => {
  const out = zoomCategoryWindow({ start: 2, end: 12 }, 3, 0.2, INTERVALS, MIN_SPAN);
  assert.deepEqual(out, { start: 0, end: INTERVALS });

  const shifted = zoomCategoryWindow({ start: 20, end: 30 }, 29, 0.8, INTERVALS, MIN_SPAN);
  assert.ok(shifted.end <= INTERVALS && shifted.start >= 0);
  // Pushed back rather than squashed: the requested span survives the edge.
  assert.ok(Math.abs(shifted.end - shifted.start - 12.5) < 1e-9);

  const floor = zoomCategoryWindow({ start: 10, end: 14 }, 12, 100, INTERVALS, MIN_SPAN);
  assert.ok(Math.abs(floor.end - floor.start - MIN_SPAN) < 1e-9);
});

test("a degenerate factor or window is returned unchanged", () => {
  const window = { start: 3, end: 9 };
  assert.equal(zoomCategoryWindow(window, 5, 0, INTERVALS, MIN_SPAN), window);
  assert.equal(zoomCategoryWindow(window, 5, Number.NaN, INTERVALS, MIN_SPAN), window);
  const empty = { start: 4, end: 4 };
  assert.equal(zoomCategoryWindow(empty, 4, 2, INTERVALS, MIN_SPAN), empty);
});

// ---------------------------------------------------------------------------
// Week snapping
// ---------------------------------------------------------------------------

test("a drawn edge moves only once the intent is clearly past the halfway point", () => {
  const threshold = 0.5 + WEEK_SNAP_HYSTERESIS;
  assert.equal(settleWindowEdge(5 + threshold - 0.01, 5), 5);
  assert.equal(settleWindowEdge(5 + threshold + 0.01, 5), 6);
  assert.equal(settleWindowEdge(5 - threshold - 0.01, 5), 4);
  // A long way past jumps straight to the nearest week, not one at a time.
  assert.equal(settleWindowEdge(8.2, 5), 8);
});

test("a tremor around a week boundary cannot flip the drawn edge back and forth", () => {
  // The intent wobbles ±0.2 of a week around 5.6 — the shape a near-stationary pinch has.
  let drawn = 5;
  const changes: number[] = [];
  for (const intent of [5.5, 5.7, 5.68, 5.45, 5.72, 5.5, 5.66, 5.42, 5.7]) {
    const next = settleWindowEdge(intent, drawn);
    if (next !== drawn) changes.push(next);
    drawn = next;
  }
  // It may move forward once; it must never come back.
  assert.ok(changes.length <= 1, `the edge changed ${String(changes.length)} times`);
});

// ---------------------------------------------------------------------------
// Line hit-testing and in-place updates — Revision 5
// ---------------------------------------------------------------------------

test("squared distance to a segment: perpendicular, beyond the ends, degenerate", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };
  assert.equal(squaredDistanceToSegment({ x: 5, y: 3 }, a, b), 9);
  // Beyond an end, the distance is to that end, not to the infinite line.
  assert.equal(squaredDistanceToSegment({ x: 13, y: 4 }, a, b), 25);
  assert.equal(squaredDistanceToSegment({ x: 3, y: 4 }, a, a), 25);
});

test("the nearest line within the band wins; nothing outside the band is hit", () => {
  const lines = [
    {
      id: "low",
      vertices: [
        { x: 0, y: 100 },
        { x: 40, y: 100 },
      ],
    },
    {
      id: "high",
      vertices: [
        { x: 0, y: 90 },
        { x: 40, y: 90 },
      ],
    },
  ];
  assert.equal(nearestLine({ x: 20, y: 97 }, lines), "low");
  assert.equal(nearestLine({ x: 20, y: 93 }, lines), "high");
  // Equidistant: the earlier line, i.e. registry order.
  assert.equal(nearestLine({ x: 20, y: 95 }, lines), "low");
  assert.equal(nearestLine({ x: 20, y: 100 + LINE_HIT_PX + 1 }, lines), null);
  assert.equal(nearestLine({ x: 20, y: 100 }, []), null);
});

test("a sloped segment is hit along its length, not only near its vertices", () => {
  const lines = [
    {
      id: "rising",
      vertices: [
        { x: 0, y: 100 },
        { x: 100, y: 0 },
      ],
    },
  ];
  assert.equal(nearestLine({ x: 52, y: 52 }, lines), "rising");
  assert.equal(nearestLine({ x: 70, y: 70 }, lines), null);
});

test("an update leaves the zoom window alone by dropping dataZoom from the merge", () => {
  const option = { series: [], dataZoom: [{ start: 0, end: 100 }], grid: {} };
  const merged = optionWithout(option, ["dataZoom"]);
  assert.deepEqual(Object.keys(merged).sort(), ["grid", "series"]);
  // The original is untouched.
  assert.ok("dataZoom" in option);
});
