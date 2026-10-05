import type { CountryId } from "../../data/index.ts";
import { SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { MARKER_PATH } from "../chart/echarts-theme.ts";
import { BEACON, PLATE_DEPTH, SHADOW_OFFSET, glyphCentre } from "./map-layout.ts";
import {
  SPOTLIGHT_ANCHORS,
  SPOTLIGHT_PLATES,
  SPOTLIGHT_VIEWBOX,
} from "./spotlight-geometry.ts";

interface MarketPlateProps {
  readonly id: CountryId;
  /**
   * Where this plate is drawn. It is only a namespace: the same market is drawn as a small
   * tile in the overview and large as the spotlight, and the two never share a document id.
   */
  readonly variant: "tile" | "spotlight";
}

/**
 * One market's raised plate and beacon — the stage's only picture of a market.
 *
 * THE SAME PICTURE AT EVERY SIZE
 * The overview draws five of these as small tiles and the spotlight draws one large. The
 * SVG is identical and only its CSS size differs, so a market looks like itself in both,
 * and the plate recipe, the beacon and the entrance rules are written once.
 *
 * PSEUDO-3D, CHEAPLY (unchanged from the world map it replaces)
 * No WebGL and no CSS 3D: the outline is drawn `PLATE_DEPTH` times in the side colour, one
 * unit apart, under a top face, over a blurred copy for the shadow. The geometry is stored
 * once in `<defs>` and every layer is a `<use>`. Light comes from above.
 *
 * NOTHING HERE DEPENDS ON WHICH MARKET IT IS
 * Depth, beacon size and shadow are shared constants, and the outline, anchor and marker
 * shape are all looked up by id. Area, height and colour therefore carry no value from the
 * analysis: Singapore's plate is as thick as the United States' and both are fitted to the
 * same frame.
 */
export function MarketPlate({ id, variant }: MarketPlateProps) {
  const pathId = `market-plate-${variant}-${id}`;
  const blurId = `${pathId}-blur`;
  const anchor = SPOTLIGHT_ANCHORS[id];
  const glyph = glyphCentre(anchor);
  const marker = SERIES_IDENTITY[id].marker;

  return (
    <svg
      viewBox={`0 0 ${String(SPOTLIGHT_VIEWBOX.width)} ${String(SPOTLIGHT_VIEWBOX.height)}`}
      className="block h-full w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={blurId} x="-10%" y="-10%" width="120%" height="130%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <path id={pathId} d={SPOTLIGHT_PLATES[id]} />
      </defs>

      <g transform={`translate(0 ${String(SHADOW_OFFSET)})`}>
        <use href={`#${pathId}`} className="map-plate-shadow" filter={`url(#${blurId})`} />
      </g>
      <g className="map-plate-raised">
        {Array.from({ length: PLATE_DEPTH }, (_, layer) => (
          <use
            key={layer}
            href={`#${pathId}`}
            className="map-plate-side"
            transform={`translate(0 ${String(PLATE_DEPTH - layer)})`}
          />
        ))}
        <use href={`#${pathId}`} className="map-plate-top" />
      </g>

      <g className="map-beacon" data-beacon={id}>
        <ellipse className="map-beacon-foot" cx={anchor.x} cy={anchor.y} rx={7} ry={2.4} />
        <line
          className="map-beacon-stem"
          x1={anchor.x}
          y1={anchor.y}
          x2={glyph.x}
          y2={glyph.y + BEACON.size / 2}
        />
        <g
          transform={`translate(${String(glyph.x - BEACON.size / 2)} ${String(glyph.y - BEACON.size / 2)}) scale(${String(BEACON.size / 10)})`}
        >
          <path
            className="map-beacon-glyph"
            d={MARKER_PATH[marker === "none" ? "circle" : marker]}
          />
        </g>
      </g>
    </svg>
  );
}
