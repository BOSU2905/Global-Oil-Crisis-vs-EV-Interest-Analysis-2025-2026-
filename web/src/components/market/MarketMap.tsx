"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

import type { CountryId } from "../../data/index.ts";
import { SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { MARKER_PATH } from "../chart/echarts-theme.ts";
import {
  GRATICULE_PATH,
  LAND_PATH,
  MAP_VIEWBOX,
  MARKET_ANCHORS,
  MARKET_PLATES,
  OUTLINE_PATH,
} from "./map-geometry.ts";
import {
  BEACON,
  LABEL_PLACEMENT,
  MAP_DWELL_MS,
  PLATE_DEPTH,
  glyphCentre,
} from "./map-layout.ts";

interface MarketMapProps {
  /** The five markets, in the editorial reading order. */
  readonly markets: readonly { readonly id: CountryId; readonly label: string }[];
  /** The market being read, or `null` for none. */
  readonly active: CountryId | null;
  /** Called after a short dwell on a market, or at once on a click or tap. */
  readonly onSelect: (id: CountryId) => void;
  readonly className?: string;
}

/** Ids for the shared `<defs>`. There is one map on the page, so they are fixed. */
const PLATE_ID = (id: CountryId) => `market-map-plate-${id}`;
const BLUR_ID = "market-map-blur";

/**
 * The five markets on a world map — an editorial picture, not a choropleth.
 *
 * WHAT IS ENCODED, AND WHAT IS DELIBERATELY NOT
 * Location only. The land is a quiet ground; the four markets large enough to outline
 * stand on it as raised plates, all of ONE neutral material at ONE height
 * (`PLATE_DEPTH`); every market — Singapore included, which is too small to outline —
 * has a beacon of ONE size in its identity colour and its chart marker shape. So area,
 * height and colour carry no value from the analysis: the United States is not "more"
 * than Singapore here, it is only bigger land. Colour reaches a plate only while the
 * reader is looking at that market.
 *
 * PSEUDO-3D, CHEAPLY
 * No WebGL and no CSS 3D: each plate is its outline drawn `PLATE_DEPTH` times in the side
 * colour, one unit apart, under a top face, over a blurred copy for the shadow — the
 * geometry is stored once in `<defs>` and every layer is a `<use>`. Light comes from
 * above. The active plate lifts 2 units and its shadow deepens.
 *
 * INTERACTION
 * Pointer only, and decorative to assistive technology (`aria-hidden`): the key and the
 * panel beside the map carry the same information and the same control, reachable by
 * keyboard. Resting the pointer on a market for `MAP_DWELL_MS` selects it — long enough
 * that sweeping across the map does not flick the panel — and a click or tap selects it
 * at once. Nothing reverts on leave, so the pointer can travel to the panel's link.
 *
 * THE ENTRANCE
 * Once, when the map scrolls into view: the plates rise and the beacons drop in, in the
 * reading order, staggered by `--stagger`. The state is set on the DOM node rather than
 * rendered, for two reasons: without JavaScript the map is simply shown in its final
 * state, and a map already on screen at load (a deep link) is never hidden and replayed.
 */
export function MarketMap({ markets, active, onSelect, className }: MarketMapProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dwell = useRef<number | undefined>(undefined);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const box = root.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;

    root.dataset["intro"] = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        root.dataset["intro"] = "play";
        observer.disconnect();
      },
      { threshold: 0.3 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(dwell.current), []);

  const rest = (id: CountryId) => {
    window.clearTimeout(dwell.current);
    dwell.current = window.setTimeout(() => onSelect(id), MAP_DWELL_MS);
  };
  const leave = () => window.clearTimeout(dwell.current);

  const classes = ["market-map relative overflow-hidden rounded-lg border border-border"];
  if (className !== undefined) classes.push(className);

  return (
    <div
      ref={rootRef}
      className={classes.join(" ")}
      data-has-active={active === null ? "false" : "true"}
      data-active-market={active ?? ""}
    >
      <svg
        viewBox={`0 0 ${String(MAP_VIEWBOX.width)} ${String(MAP_VIEWBOX.height)}`}
        className="block h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter id={BLUR_ID} x="-10%" y="-10%" width="120%" height="130%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          {markets.map(({ id }) => {
            const d = MARKET_PLATES[id];
            return d === undefined ? null : <path key={id} id={PLATE_ID(id)} d={d} />;
          })}
        </defs>

        <path className="map-sea" d={OUTLINE_PATH} />
        <path className="map-graticule" d={GRATICULE_PATH} />
        <path className="map-land" d={LAND_PATH} />

        {markets.map(({ id, label }, index) => {
          const anchor = MARKET_ANCHORS[id];
          const place = LABEL_PLACEMENT[id];
          const glyph = glyphCentre(anchor, place.lean);
          const labelX = glyph.x + place.dx;
          const labelY = glyph.y + place.dy;
          const leaderEnd = place.anchor === "end" ? labelX + 4 : labelX - 4;
          const hasPlate = MARKET_PLATES[id] !== undefined;
          const style = {
            "--market-colour": `var(${SERIES_IDENTITY[id].colorVariable})`,
            "--i": index,
            cursor: "pointer",
          } as CSSProperties;

          return (
            <g
              key={id}
              data-market={id}
              data-active={active === id ? "true" : "false"}
              style={style}
              onPointerEnter={() => rest(id)}
              onPointerLeave={leave}
              onClick={() => {
                window.clearTimeout(dwell.current);
                onSelect(id);
              }}
            >
              {hasPlate ? (
                <>
                  <g transform="translate(0 4)">
                    <use
                      href={`#${PLATE_ID(id)}`}
                      className="map-plate-shadow"
                      filter={`url(#${BLUR_ID})`}
                    />
                  </g>
                  <g className="map-plate-raised">
                    {Array.from({ length: PLATE_DEPTH }, (_, layer) => (
                      <use
                        key={layer}
                        href={`#${PLATE_ID(id)}`}
                        className="map-plate-side"
                        transform={`translate(0 ${String(PLATE_DEPTH - layer)})`}
                      />
                    ))}
                    <use href={`#${PLATE_ID(id)}`} className="map-plate-top" />
                  </g>
                </>
              ) : null}

              <g className="map-beacon" data-beacon={id}>
                <ellipse
                  className="map-beacon-foot"
                  cx={anchor.x}
                  cy={anchor.y}
                  rx={4.5}
                  ry={1.5}
                />
                <line
                  className="map-beacon-stem"
                  x1={anchor.x}
                  y1={anchor.y}
                  x2={glyph.x}
                  y2={glyph.y + BEACON.size / 2}
                />
                {place.leader ? (
                  <path
                    className="map-leader"
                    d={`M${String(glyph.x)} ${String(glyph.y)}L${String(leaderEnd)} ${String(labelY)}`}
                  />
                ) : null}
                <g
                  transform={`translate(${String(glyph.x - BEACON.size / 2)} ${String(glyph.y - BEACON.size / 2)}) scale(${String(BEACON.size / 10)})`}
                >
                  <path
                    className="map-beacon-glyph"
                    d={
                      MARKER_PATH[
                        SERIES_IDENTITY[id].marker === "none"
                          ? "circle"
                          : SERIES_IDENTITY[id].marker
                      ]
                    }
                  />
                </g>
                <text
                  className="map-label"
                  x={labelX}
                  y={labelY}
                  textAnchor={place.anchor}
                  dominantBaseline="middle"
                >
                  {label}
                </text>
                <circle cx={glyph.x} cy={glyph.y} r={BEACON.hit} fill="transparent" />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
