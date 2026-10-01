/**
 * The market map (Revision 7) — what can be decided without a browser.
 *
 * The map is an editorial picture, and the risk it carries is the one every picture of
 * five markets carries: that something about how a market is DRAWN gets read as a
 * statement about that market. On a true-scale map the United States covers thousands
 * of times Singapore's area. These tests hold the rules that keep area, height, colour
 * and order from saying anything the analysis does not:
 *
 *   1. every market is present, with an anchor inside the map;
 *   2. every market is drawn the same way — one plate depth, one beacon size — and the
 *      component branches on no market;
 *   3. identity colour reaches a plate only in the active state;
 *   4. no two beacons overlap, so no market is hidden behind another;
 *   5. the geometry is plain path data, and nothing in it is computed at runtime.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { COUNTRY_IDS } from "../src/data/index.ts";
import {
  GRATICULE_PATH,
  LAND_PATH,
  MAP_VIEWBOX,
  MARKET_ANCHORS,
  MARKET_PLATES,
  OUTLINE_PATH,
} from "../src/components/market/map-geometry.ts";
import {
  BEACON,
  LABEL_PLACEMENT,
  PLATE_DEPTH,
  glyphCentre,
} from "../src/components/market/map-layout.ts";

const webRoot = join(import.meta.dirname, "..");
const read = (...parts: string[]): string => readFileSync(join(webRoot, ...parts), "utf8");

/** Source with comments removed, the same way the market-layer scans read it. */
const codeOf = (source: string): string =>
  source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

// ---------------------------------------------------------------------------
// 1. Every market, inside the map
// ---------------------------------------------------------------------------

test("every market has an anchor, and every anchor is inside the map", () => {
  assert.deepEqual(Object.keys(MARKET_ANCHORS).sort(), [...COUNTRY_IDS].sort());
  for (const id of COUNTRY_IDS) {
    const { x, y } = MARKET_ANCHORS[id];
    assert.ok(x > 0 && x < MAP_VIEWBOX.width, `${id} anchor x=${String(x)} is off the map`);
    assert.ok(y > 0 && y < MAP_VIEWBOX.height, `${id} anchor y=${String(y)} is off the map`);
  }
});

test("only markets have plates, and only a market too small to outline lacks one", () => {
  const plated = Object.keys(MARKET_PLATES);
  for (const id of plated) assert.ok((COUNTRY_IDS as readonly string[]).includes(id));
  // Singapore (728 km²) is not in the 1:110m source and would be sub-pixel anyway; it is
  // the one market drawn by its beacon alone. Every other market has its outline.
  assert.deepEqual(plated.sort(), ["indonesia", "malaysia", "norway", "us"]);
});

test("the geometry is plain path data and nothing else", () => {
  for (const [name, d] of Object.entries({
    LAND_PATH,
    OUTLINE_PATH,
    GRATICULE_PATH,
    ...MARKET_PLATES,
  })) {
    assert.ok(typeof d === "string" && d.startsWith("M"), `${name} is not path data`);
    assert.match(d, /^[MmLlZz0-9.\s-]+$/, `${name} contains something other than path data`);
  }
});

// ---------------------------------------------------------------------------
// 2. Every market is drawn the same way
// ---------------------------------------------------------------------------

test("one plate depth and one beacon size, shared by every market", () => {
  assert.equal(typeof PLATE_DEPTH, "number");
  assert.ok(PLATE_DEPTH > 0);
  assert.ok(BEACON.size > 0 && BEACON.hit > BEACON.size / 2);
  // No per-market override of depth or size can exist: the placement table carries
  // only label offsets and a lean.
  for (const id of COUNTRY_IDS) {
    assert.deepEqual(
      Object.keys(LABEL_PLACEMENT[id]).filter(
        (key) => !["dx", "dy", "anchor", "leader", "lean"].includes(key),
      ),
      [],
      `${id} carries a presentation property beyond its label placement`,
    );
  }
});

test("the map component renders from data and branches on no market", () => {
  const code = codeOf(read("src", "components", "market", "MarketMap.tsx"));
  for (const id of COUNTRY_IDS) {
    assert.ok(
      !new RegExp(`["']${id}["']`).test(code),
      `MarketMap branches on "${id}" instead of rendering from data`,
    );
  }
  // The depth and the beacon size come from the shared constants, once.
  assert.match(code, /PLATE_DEPTH/);
  assert.match(code, /BEACON\.size/);
});

// ---------------------------------------------------------------------------
// 3. Colour is identity, and reaches a plate only when active
// ---------------------------------------------------------------------------

test("plates are one neutral material; identity colour tints only the active one", () => {
  const css = read("app", "globals.css");
  const rule = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    assert.ok(start !== -1, `no rule for ${selector}`);
    return css.slice(start, css.indexOf("}", start));
  };
  assert.match(rule(".market-map .map-plate-top"), /fill:\s*var\(--map-plate\)/);
  assert.doesNotMatch(rule(".market-map .map-plate-top"), /--market-colour/);
  assert.match(
    rule('.market-map [data-market][data-active="true"] .map-plate-top'),
    /--market-colour/,
  );
  // The beacon is where identity lives by default, in every market's own colour.
  assert.match(rule(".market-map .map-beacon-glyph"), /fill:\s*var\(--market-colour\)/);
});

test("the map's material tokens exist in the light theme and in both dark blocks", () => {
  const tokens = read("src", "styles", "tokens.css");
  for (const token of [
    "--map-sea",
    "--map-land",
    "--map-plate",
    "--map-plate-side",
    "--map-plate-edge",
    "--map-shadow",
  ]) {
    const count = tokens.split(`${token}:`).length - 1;
    assert.equal(count, 3, `${token} is declared ${String(count)} times, expected 3`);
  }
});

// ---------------------------------------------------------------------------
// 4. No beacon hides another
// ---------------------------------------------------------------------------

test("no two beacon glyphs overlap", () => {
  // The first render put Singapore's glyph on top of Malaysia's; the lean fixed it.
  const centres = COUNTRY_IDS.map((id) => ({
    id,
    ...glyphCentre(MARKET_ANCHORS[id], LABEL_PLACEMENT[id].lean),
  }));
  for (let i = 0; i < centres.length; i += 1) {
    for (let j = i + 1; j < centres.length; j += 1) {
      const a = centres[i];
      const b = centres[j];
      if (a === undefined || b === undefined) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      assert.ok(
        dx * dx + dy * dy >= BEACON.size * BEACON.size,
        `${a.id} and ${b.id} glyphs overlap`,
      );
    }
  }
});

test("every label sits inside the map", () => {
  for (const id of COUNTRY_IDS) {
    const place = LABEL_PLACEMENT[id];
    const glyph = glyphCentre(MARKET_ANCHORS[id], place.lean);
    const x = glyph.x + place.dx;
    const y = glyph.y + place.dy;
    assert.ok(x > 0 && x < MAP_VIEWBOX.width, `${id} label x is off the map`);
    assert.ok(y > 10 && y < MAP_VIEWBOX.height - 10, `${id} label y is off the map`);
  }
});

// ---------------------------------------------------------------------------
// 5. The entrance is quiet, and gives way to reduced motion
// ---------------------------------------------------------------------------

test("the entrance staggers by a token that reduced motion sets to zero", () => {
  const tokens = read("src", "styles", "tokens.css");
  assert.match(tokens, /--stagger:\s*\d+ms/);
  const reduced = tokens.slice(tokens.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /--stagger:\s*0ms/);
  const css = read("app", "globals.css");
  assert.match(css, /animation-delay:\s*calc\(var\(--i, 0\) \* var\(--stagger\)\)/);
  // `backwards`, so a finished entrance never pins the hover lift underneath it.
  assert.doesNotMatch(css, /map-plate-rise[^;]*\bboth\b/);
});
