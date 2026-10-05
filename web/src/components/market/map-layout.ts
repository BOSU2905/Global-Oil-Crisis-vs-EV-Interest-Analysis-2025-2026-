/**
 * The hand-set half of the market stage: the sizes that must be the same for every market.
 *
 * `map-geometry.ts` (the world, for the locator) and `spotlight-geometry.ts` (five
 * silhouettes) are generated and say where the land is. This file is authored and says how
 * the markets are presented on it — and the analytical constraint lives here, because it is
 * a constraint on presentation:
 *
 *   EVERY MARKET IS DRAWN THE SAME. One plate depth, one beacon size. Every silhouette is
 *   fitted to the same frame, so drawn size says nothing about a market — on a true-scale
 *   map the United States covers thousands of times Singapore's area, and letting that
 *   show would turn land area into emphasis. The plates are one neutral material. Each
 *   market's identity colour sits on an equal-size beacon, in the market's own marker
 *   shape (the same shape it has in every chart), and reaches a plate only while the
 *   reader is looking at that market: interaction state, never data.
 *
 *   NOTHING HERE ORDERS THE MARKETS. The entrance runs in the editorial reading order the
 *   rest of the market layer uses, which `content/markets.ts` documents as carrying no
 *   ranking.
 */

/**
 * Height of every raised plate, in frame units (`SPOTLIGHT_VIEWBOX`): the side layers
 * drawn below the top face. A frame unit is ~0.3px on an overview tile and ~1.3–1.6px on
 * the spotlight, so the same plate reads as a thin slab small and a thick one large.
 */
export const PLATE_DEPTH = 5;

/** How far below its plate the blurred shadow sits, in frame units. */
export const SHADOW_OFFSET = 7;

/** Every beacon's marker glyph and stem, in frame units. */
export const BEACON = {
  /** The marker glyph's box. */
  size: 20,
  /** From the outline's surface to the bottom of the glyph. */
  stem: 13,
} as const;

/** The locator's marks, in world units (the 1000-wide viewBox of `map-geometry.ts`). */
export const LOCATOR = {
  /** A market that is not the one being read. */
  dot: 14,
  /** The market being read: its marker glyph, and the ring around it. */
  glyph: 54,
  ring: 42,
} as const;

/** Where a beacon's glyph centre is, given the point on the outline it stands on. */
export function glyphCentre(anchor: { readonly x: number; readonly y: number }): {
  readonly x: number;
  readonly y: number;
} {
  return { x: anchor.x, y: anchor.y - BEACON.stem - BEACON.size / 2 };
}

/** How long the pointer rests on a tile before the panel follows it, in ms. */
export const MAP_DWELL_MS = 110;

/**
 * After the stage returns to the overview, a resting pointer is ignored for this long.
 * The tiles appear under a pointer that has not moved, and the browser reports that as the
 * pointer entering one — which would select it again at once, so that the reader could
 * never let go while the pointer sat over the stage.
 */
export const MAP_QUIET_MS = 400;
