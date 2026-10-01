/**
 * The hand-placed half of the market map: where each label sits, and the sizes that
 * must be the same for every market.
 *
 * `map-geometry.ts` is generated and says where the land is. This file is authored and
 * says how the five markets are presented on it — and the analytical constraint lives
 * here, because it is a constraint on presentation:
 *
 *   EVERY MARKET IS DRAWN THE SAME. One plate depth, one beacon size, one label size.
 *   On a true-scale map the United States covers thousands of times Singapore's area,
 *   so the plates stay neutral — area is geography, and colour on it would turn land
 *   area into emphasis. Each market's identity colour sits on an equal-size beacon, in
 *   the market's own marker shape (the same shape it has in every chart). Colour reaches
 *   a plate only while the reader is looking at that market: interaction state, never
 *   data.
 *
 *   NOTHING HERE ORDERS THE MARKETS. The entrance runs in the editorial reading order
 *   the rest of the market layer uses, which `content/markets.ts` documents as carrying
 *   no ranking.
 */

import type { CountryId } from "../../data/artifact-types.ts";

/** Height of every raised plate, in viewBox units: the side layers drawn below the top. */
export const PLATE_DEPTH = 4;

/** Every beacon's marker glyph, stem and hit area, in viewBox units. */
export const BEACON = {
  /** The marker glyph's box. */
  size: 12,
  /** From the ground to the bottom of the glyph. */
  stem: 9,
  /** Radius of the invisible pointer target around the glyph. */
  hit: 16,
} as const;

export interface LabelPlacement {
  /** Offset of the label from the beacon's glyph centre, in viewBox units. */
  readonly dx: number;
  readonly dy: number;
  readonly anchor: "start" | "middle" | "end";
  /** Draw a leader line from the glyph to the label. Off where the label sits on top. */
  readonly leader: boolean;
  /**
   * Horizontal lean of the beacon's stem, in viewBox units. Zero stands the glyph
   * straight above its point. Singapore's stands 10 units from Malaysia's, so its stem
   * leans right and the two glyphs do not overlap — measured in the first render.
   */
  readonly lean?: number;
}

/**
 * Label placement, tuned against the rendered map. The three Southeast Asian markets
 * stand within a few millimetres of each other, so their labels fan out over open water
 * on leader lines rather than stacking on the land.
 */
export const LABEL_PLACEMENT: Readonly<Record<CountryId, LabelPlacement>> = {
  indonesia: { dx: 16, dy: 30, anchor: "start", leader: true },
  us: { dx: 0, dy: -14, anchor: "middle", leader: false },
  singapore: { dx: -58, dy: 30, anchor: "end", leader: true, lean: 12 },
  malaysia: { dx: -34, dy: -18, anchor: "end", leader: true },
  norway: { dx: -26, dy: -8, anchor: "end", leader: true },
};

/** Where a beacon's glyph centre is, given the point it stands on and its lean. */
export function glyphCentre(
  anchor: { readonly x: number; readonly y: number },
  lean = 0,
): { readonly x: number; readonly y: number } {
  return { x: anchor.x + lean, y: anchor.y - BEACON.stem - BEACON.size / 2 };
}

/** How long the pointer rests on a market before the panel follows it, in ms. */
export const MAP_DWELL_MS = 110;
