/**
 * The market stage (Revision 7, reworked in Batch 3) — what can be decided without a browser.
 *
 * The stage is an editorial picture, and the risk it carries is the one every picture of
 * five markets carries: that something about how a market is DRAWN gets read as a
 * statement about that market. On a true-scale map the United States covers thousands of
 * times Singapore's area; here every outline is fitted to one frame, so Singapore's island
 * looks as large as the United States. These tests hold the rules that keep area, height,
 * colour and order from saying anything the analysis does not:
 *
 *   1. every market has an outline, an anchor on it, and the same frame;
 *   2. every market is drawn the same way — one plate depth, one beacon size — and the
 *      components branch on no market;
 *   3. identity colour reaches a plate only in the active state;
 *   4. the locator is a locator: display-only, neutral until a market is read;
 *   5. the geometry is plain path data, and nothing in it is computed at runtime;
 *   6. the caption says what the drawing leaves out.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { COUNTRY_IDS } from "../src/data/index.ts";
import { MARKET_READOUT, MARKET_STAGE_NOTE } from "../src/content/markets.ts";
import {
  GRATICULE_PATH,
  LAND_PATH,
  MAP_VIEWBOX,
  MARKET_ANCHORS,
  MARKET_PLATES,
  OUTLINE_PATH,
} from "../src/components/market/map-geometry.ts";
import {
  SPOTLIGHT_ANCHORS,
  SPOTLIGHT_EXTENTS,
  SPOTLIGHT_FIT,
  SPOTLIGHT_PLATES,
  SPOTLIGHT_VIEWBOX,
} from "../src/components/market/spotlight-geometry.ts";
import {
  BEACON,
  LOCATOR,
  PLATE_DEPTH,
  SHADOW_OFFSET,
  glyphCentre,
} from "../src/components/market/map-layout.ts";

const webRoot = join(import.meta.dirname, "..");
const read = (...parts: string[]): string => readFileSync(join(webRoot, ...parts), "utf8");
const marketComponent = (name: string): string => read("src", "components", "market", name);

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

type Point = readonly [number, number];

/**
 * The rings of a path in the generator's format — `M x y l dx dy …z`, relative after the
 * first point — as absolute points. Only what `pathOf` in the generator writes.
 */
function ringsOf(d: string): Point[][] {
  return d
    .split("z")
    .filter((part) => part.trim() !== "")
    .map((part) => {
      const [move = "", lines = ""] = part.replace(/^M/, "").split("l");
      const numbers = (text: string): number[] =>
        (text.match(/-?\d*\.?\d+/g) ?? []).map((token) => Number(token));
      const start = numbers(move);
      let x = start[0] ?? 0;
      let y = start[1] ?? 0;
      const ring: Point[] = [[x, y]];
      const steps = numbers(lines);
      for (let i = 0; i + 1 < steps.length; i += 2) {
        x += steps[i] ?? 0;
        y += steps[i + 1] ?? 0;
        ring.push([x, y]);
      }
      return ring;
    });
}

/** Ray casting. The rings here never touch the probe point exactly. */
function inside(ring: readonly Point[], [px, py]: Point): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (a === undefined || b === undefined) continue;
    const crosses =
      a[1] > py !== b[1] > py && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) hit = !hit;
  }
  return hit;
}

// ---------------------------------------------------------------------------
// 1. Every market, in the same frame, with its beacon on it
// ---------------------------------------------------------------------------

test("every market has a silhouette, and nothing else does", () => {
  assert.deepEqual(Object.keys(SPOTLIGHT_PLATES).sort(), [...COUNTRY_IDS].sort());
  assert.deepEqual(Object.keys(SPOTLIGHT_ANCHORS).sort(), [...COUNTRY_IDS].sort());
  assert.deepEqual(Object.keys(SPOTLIGHT_EXTENTS).sort(), [...COUNTRY_IDS].sort());
});

test("every outline fills the SAME frame in at least one dimension, and none overflows it", () => {
  // The rule that keeps drawn size from meaning anything: Singapore's island is fitted to
  // the box the United States is fitted to. A dimension of 1 means it touches the box.
  for (const id of COUNTRY_IDS) {
    const { width, height } = SPOTLIGHT_EXTENTS[id];
    const fillW = width / SPOTLIGHT_FIT.width;
    const fillH = height / SPOTLIGHT_FIT.height;
    assert.ok(
      Math.max(fillW, fillH) >= 0.995,
      `${id} fills only ${String(Math.max(fillW, fillH))}`,
    );
    assert.ok(fillW <= 1.001 && fillH <= 1.001, `${id} overflows its frame`);
  }
});

test("the frame leaves room for the beacon above an outline and the plate below it", () => {
  const { height } = SPOTLIGHT_VIEWBOX;
  // Below: depth and the shadow's offset. The blur spills further, and the SVG is
  // `overflow: visible`, but the plate itself must never be cut.
  assert.ok(SPOTLIGHT_FIT.y + SPOTLIGHT_FIT.height + SHADOW_OFFSET + PLATE_DEPTH <= height);
  // Above: a beacon stands on an anchor, so the glyph's top must be inside the frame.
  for (const id of COUNTRY_IDS) {
    const top = glyphCentre(SPOTLIGHT_ANCHORS[id]).y - BEACON.size / 2;
    assert.ok(top >= 0, `${id}'s beacon starts above the frame (${String(top)})`);
  }
});

test("every beacon stands ON its market's outline, not merely inside the box around it", () => {
  for (const id of COUNTRY_IDS) {
    const anchor = SPOTLIGHT_ANCHORS[id];
    const rings = ringsOf(SPOTLIGHT_PLATES[id]);
    assert.ok(rings.length > 0, `${id} has no rings`);
    assert.ok(
      rings.some((ring) => inside(ring, [anchor.x, anchor.y])),
      `${id}'s anchor (${String(anchor.x)}, ${String(anchor.y)}) is not on its outline`,
    );
  }
});

test("Singapore's outline has real detail — the reason the silhouettes read 1:10m", () => {
  // At 1:50m Singapore is a 9-vertex polygon, a visible wedge at this size; at 1:10m it is
  // 40 vertices before simplification. Fewer than 25 after it means the coarse source came
  // back, and the island would be drawn as a plainly angular blob.
  const vertices = ringsOf(SPOTLIGHT_PLATES.singapore).reduce((n, ring) => n + ring.length, 0);
  assert.ok(vertices >= 25, `Singapore has only ${String(vertices)} vertices`);
});

test("every market has an anchor on the world map too, inside it, for the locator", () => {
  assert.deepEqual(Object.keys(MARKET_ANCHORS).sort(), [...COUNTRY_IDS].sort());
  for (const id of COUNTRY_IDS) {
    const { x, y } = MARKET_ANCHORS[id];
    assert.ok(x > 0 && x < MAP_VIEWBOX.width, `${id} anchor x=${String(x)} is off the map`);
    assert.ok(y > 0 && y < MAP_VIEWBOX.height, `${id} anchor y=${String(y)} is off the map`);
  }
});

test("on the world map only a market too small to outline lacks a plate", () => {
  const plated = Object.keys(MARKET_PLATES);
  for (const id of plated) assert.ok((COUNTRY_IDS as readonly string[]).includes(id));
  // Singapore (728 km²) is not in the 1:110m source and would be sub-pixel anyway; it is
  // the one market the locator draws by its mark alone.
  assert.deepEqual(plated.sort(), ["indonesia", "malaysia", "norway", "us"]);
});

// ---------------------------------------------------------------------------
// 2. Every market is drawn the same way
// ---------------------------------------------------------------------------

test("one plate depth, one shadow, one beacon size, shared by every market", () => {
  assert.ok(Number.isInteger(PLATE_DEPTH) && PLATE_DEPTH > 0);
  assert.ok(SHADOW_OFFSET > 0);
  assert.ok(BEACON.size > 0 && BEACON.stem > 0);
  // The layout module carries sizes and timings and nothing keyed by market: there is no
  // per-market table through which one market could be drawn differently.
  for (const value of [PLATE_DEPTH, SHADOW_OFFSET, BEACON, LOCATOR]) {
    assert.notEqual(typeof value, "function");
  }
  const code = codeOf(read("src", "components", "market", "map-layout.ts"));
  for (const id of COUNTRY_IDS) {
    assert.ok(!new RegExp(`\\b${id}\\b`).test(code), `map-layout.ts names "${id}"`);
  }
});

test("the stage components render from data and branch on no market", () => {
  for (const file of ["MarketStage.tsx", "MarketPlate.tsx", "MarketLocator.tsx"]) {
    const code = codeOf(marketComponent(file));
    for (const id of COUNTRY_IDS) {
      assert.ok(
        !new RegExp(`["']${id}["']`).test(code),
        `${file} branches on "${id}" instead of rendering from data`,
      );
    }
  }
  // The depth and the beacon size come from the shared constants, once.
  const plate = codeOf(marketComponent("MarketPlate.tsx"));
  assert.match(plate, /PLATE_DEPTH/);
  assert.match(plate, /BEACON\.size/);
  assert.match(plate, /SHADOW_OFFSET/);
});

test("the overview draws the same component for every market, in the reading order it is given", () => {
  const stage = codeOf(marketComponent("MarketStage.tsx"));
  // One `MarketPlate` per market, from the list the parent passes in: the stage holds no
  // order of its own, so it cannot sort the markets by anything.
  assert.match(stage, /markets\.map\(/);
  assert.doesNotMatch(stage, /\.sort\(|\.toSorted\(|\.reverse\(/);
  assert.match(stage, /<MarketPlate id=\{id\} \/>/);
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
  // Nothing about a tile's resting look is keyed by market.
  assert.doesNotMatch(rule(".market-map .map-plate-side"), /--market-colour/);
});

test("the tint and the dimming each follow ONE attribute on the tile, computed in one place", () => {
  const stage = codeOf(marketComponent("MarketStage.tsx"));
  // `data-active` is true for at most one tile (the chosen one) and `data-dim` only for the
  // others while something is chosen: both are derived from `active`, never set per market,
  // so the tint cannot reach two markets at once and nothing can be dimmed by default.
  assert.equal((stage.match(/data-active=/g) ?? []).length, 1);
  assert.match(stage, /const isActive = id === active;/);
  assert.match(stage, /data-active=\{isActive \? "true" : "false"\}/);
  assert.match(stage, /data-dim=\{active !== null && !isActive \? "true" : "false"\}/);
});

test("the other four are dimmed IN PLACE, and resting on one brings it back", () => {
  const css = read("app", "globals.css");
  const rule = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    assert.ok(start !== -1, `no rule for ${selector}`);
    return css.slice(start, css.indexOf("}", start));
  };
  // Dimmed, not removed: still on the stage, still clickable.
  const dim = rule('.market-map .map-tile[data-dim="true"] .map-tile-plate');
  const opacity = Number(/opacity:\s*([0-9.]+)/.exec(dim)?.[1]);
  assert.ok(opacity > 0.2 && opacity < 0.7, `a dimmed plate is ${String(opacity)} opaque`);
  assert.doesNotMatch(dim, /display:\s*none|visibility:\s*hidden|pointer-events:\s*none/);
  // Hovering or keyboard-focusing a dimmed tile is the invitation to switch to it.
  assert.match(
    rule('.market-map .map-tile[data-dim="true"]:hover .map-tile-plate'),
    /opacity:\s*0\.[6-9]/,
  );
  assert.match(
    rule('.market-map .map-tile[data-dim="true"]:focus-visible .map-tile-plate'),
    /opacity:\s*0\.[6-9]/,
  );
  // The old spotlight is gone from the stylesheet.
  assert.doesNotMatch(css, /\.map-spotlight/);
});

test("a dimmed market keeps a readable name: only the picture recedes, never the label", () => {
  const css = read("app", "globals.css");
  // The tile is a button whose name is its label. Dimming the whole tile measured 1.8:1 for
  // that name; dimming the plate alone leaves the name at the ordinary secondary colour.
  assert.doesNotMatch(css, /\.map-tile\[data-dim="true"\]\s*\{[^}]*opacity/);
  assert.doesNotMatch(css, /\.map-tile\[data-dim="true"\]\s+\.map-tile-label\s*\{[^}]*opacity/);
  // Both pieces exist in the markup: the plate wrapper that fades, and the label that does not.
  const stage = codeOf(marketComponent("MarketStage.tsx"));
  assert.match(stage, /map-tile-plate/);
  assert.match(stage, /map-tile-label/);
});

test("a keyboard gets the lift a mouse gets", () => {
  const css = read("app", "globals.css");
  assert.match(css, /\.map-tile:hover \.map-plate-raised/);
  assert.match(css, /\.map-tile:focus-visible \.map-plate-raised/);
  // The hover rules only run where there is hover; the focus ones always do.
  const hoverMedia = css.indexOf("@media (hover: hover)");
  assert.ok(hoverMedia !== -1);
  assert.ok(css.indexOf(".map-tile:hover .map-plate-raised") > hoverMedia);
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
// 4. The locator is a locator
// ---------------------------------------------------------------------------

test("the locator is display-only: hidden from assistive technology, with no handlers", () => {
  const code = codeOf(marketComponent("MarketLocator.tsx"));
  assert.match(code, /aria-hidden="true"/);
  // At inset size Malaysia and Singapore are ~2.7px apart; a control nobody can aim is
  // worse than none. The key is the equivalent control.
  assert.doesNotMatch(code, /\bon[A-Z][A-Za-z]+=/);
  assert.doesNotMatch(code, /tabIndex|role=/);
});

test("the locator's resting mark is neutral, and only the active one carries identity", () => {
  const css = read("app", "globals.css");
  const rule = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    assert.ok(start !== -1, `no rule for ${selector}`);
    return css.slice(start, css.indexOf("}", start));
  };
  assert.doesNotMatch(rule(".market-map .map-locator-dot"), /--market-colour/);
  // The resting dot says WHERE, so it needs 3:1 against the land. `--color-fg-subtle` measured
  // 2.41:1 in the light theme; `--color-fg-muted` is the quietest token that clears it.
  assert.match(rule(".market-map .map-locator-dot"), /fill:\s*var\(--color-fg-muted\)/);
  assert.doesNotMatch(rule(".market-map .map-locator-plate"), /--market-colour/);
  assert.match(rule('.market-map .map-locator-plate[data-active="true"]'), /--market-colour/);
  assert.match(rule(".market-map .map-locator-ring"), /--market-colour/);
  // The ring encloses the marker, and the resting dot is smaller than either.
  assert.ok(LOCATOR.ring > LOCATOR.glyph / 2);
  assert.ok(LOCATOR.dot < LOCATOR.ring);
});

test("the active market is drawn last in the locator, so it is never hidden behind a neighbour", () => {
  // Malaysia, Singapore and Indonesia overlap at inset size; the ring is what says which
  // one is meant, and it only can if it is on top.
  const code = codeOf(marketComponent("MarketLocator.tsx"));
  assert.match(
    code,
    /filter\(\(m\) => m\.id !== active\),\s*\.\.\.markets\.filter\(\(m\) => m\.id === active\)/,
  );
});

// ---------------------------------------------------------------------------
// 5. The geometry is data, not computation
// ---------------------------------------------------------------------------

test("the geometry is plain path data and nothing else", () => {
  for (const [name, d] of Object.entries({
    LAND_PATH,
    OUTLINE_PATH,
    GRATICULE_PATH,
    ...MARKET_PLATES,
    ...SPOTLIGHT_PLATES,
  })) {
    assert.ok(typeof d === "string" && d.startsWith("M"), `${name} is not path data`);
    assert.match(d, /^[MmLlZz0-9.\s-]+$/, `${name} contains something other than path data`);
  }
});

test("the generated geometry stays within its size budget", () => {
  // Five outlines at 1:10m are ~32 KB. A silent tenfold growth (a looser tolerance, a
  // dropped noise floor) would ship as page weight nobody chose.
  const bytes = read("src", "components", "market", "spotlight-geometry.ts").length;
  assert.ok(bytes < 45_000, `spotlight-geometry.ts is ${String(bytes)} bytes`);
});

test("the generated files record their source, so a different one shows in the diff", () => {
  assert.match(
    read("src", "components", "market", "spotlight-geometry.ts"),
    /countries-10m\.json\s+sha256 [0-9a-f]{64}/,
  );
  assert.match(
    read("src", "components", "market", "map-geometry.ts"),
    /countries-110m\.json\s+sha256 [0-9a-f]{64}/,
  );
});

// ---------------------------------------------------------------------------
// 6. The caption says what the drawing leaves out
// ---------------------------------------------------------------------------

test("the caption says size is not information, and names what the outlines omit", () => {
  // Every outline is fitted to one frame, so without this a reader would take Singapore's
  // island for a large country; and the United States and Norway are not drawn whole.
  assert.match(MARKET_STAGE_NOTE, /fill its frame/);
  assert.match(MARKET_STAGE_NOTE, /says nothing about a market/);
  for (const omitted of ["Alaska", "Hawaii", "Svalbard"]) {
    assert.match(MARKET_STAGE_NOTE, new RegExp(omitted));
  }
  assert.match(codeOf(marketComponent("MarketStage.tsx")), /MARKET_STAGE_NOTE/);
});

// ---------------------------------------------------------------------------
// 7. Interaction and the entrance
// ---------------------------------------------------------------------------

test("hovering previews and never selects: no timer, and no select call from a pointer handler", () => {
  const stage = codeOf(marketComponent("MarketStage.tsx"));
  // The 110ms rest that used to choose a market is gone, with the timer and its quiet period.
  assert.doesNotMatch(stage, /setTimeout|clearTimeout|MAP_DWELL_MS|MAP_QUIET_MS/);
  // Pointer and focus handlers only move the PREVIEW; choosing happens on click alone.
  for (const handler of ["onPointerEnter", "onPointerLeave", "onFocus", "onBlur"]) {
    const start = stage.indexOf(`${handler}=`);
    assert.ok(start !== -1, `no ${handler}`);
    const body = stage.slice(start, stage.indexOf("\n", stage.indexOf("}", start)) + 1);
    assert.doesNotMatch(body, /onSelect|onBack/, `${handler} must not choose a market`);
  }
  assert.match(stage, /onClick=\{\(\) => onSelect\(id\)\}/);
});

test("a touch neither previews nor leaves a sticky hover, and keyboard focus previews", () => {
  const stage = codeOf(marketComponent("MarketStage.tsx"));
  assert.match(stage, /event\.pointerType !== "touch"/);
  // A mouse click also focuses the button; only `:focus-visible` (a keyboard) is a preview.
  assert.match(stage, /matches\(":focus-visible"\)/);
  // The preview belongs to the overview: once a market is chosen, the readout is the way back.
  assert.match(stage, /active === null \? markets\.find/);
});

test("each plate is a real button that names its market and controls the panel", () => {
  const stage = codeOf(marketComponent("MarketStage.tsx"));
  assert.match(stage, /<button\s+type="button"\s+data-market=\{id\}/);
  assert.match(stage, /aria-pressed=\{isActive\}/);
  assert.match(stage, /aria-controls=\{panelId\}/);
  // The silhouette inside is hidden from assistive technology: the label is the name.
  assert.match(codeOf(marketComponent("MarketPlate.tsx")), /aria-hidden="true"/);
  // The tiles are one labelled list, in the reading order they are given.
  assert.match(stage, /aria-label="Markets on the map"/);
});

test("the separate country list is gone: the synthesis renders no market button of its own", () => {
  const synthesis = codeOf(marketComponent("MarketSynthesisMap.tsx"));
  assert.doesNotMatch(synthesis, /<button/);
  assert.doesNotMatch(synthesis, /Markets on the map/);
  // Escape anywhere in the section goes back, and focus returns to the tile that was chosen.
  assert.match(synthesis, /event\.key === "Escape"/);
  assert.match(synthesis, /\.map-tile\[data-market=/);
  assert.match(synthesis, /\.focus\(/);
  // The panel never changes on hover, only on a choice.
  assert.doesNotMatch(synthesis, /onPointer|onMouse|hover/i);
});

test("the way back is in the readout, is named, and is only there while a market is chosen", () => {
  assert.equal(MARKET_READOUT.back, "Back to all markets");
  const stage = codeOf(marketComponent("MarketStage.tsx"));
  assert.match(stage, /active !== null \? \(/);
  assert.match(stage, /onClick=\{onBack\}/);
  assert.match(stage, /MARKET_READOUT\.back/);
});

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

test("the entrance hands itself back when it has finished, so it cannot replay", () => {
  const stage = codeOf(marketComponent("MarketStage.tsx"));
  assert.match(stage, /dataset\["intro"\] = "pending"/);
  assert.match(stage, /dataset\["intro"\] = "play"/);
  assert.match(stage, /dataset\["intro"\] = "done"/);
  // The CSS keys on `pending` and `play` only: a `done` stage matches no entrance rule.
  const css = read("app", "globals.css");
  assert.doesNotMatch(css, /data-intro="done"/);
});
