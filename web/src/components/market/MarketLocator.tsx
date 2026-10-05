import type { CSSProperties } from "react";

import type { CountryId } from "../../data/index.ts";
import { SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { MARKER_PATH } from "../chart/echarts-theme.ts";
import {
  LAND_PATH,
  MAP_VIEWBOX,
  MARKET_ANCHORS,
  MARKET_PLATES,
  OUTLINE_PATH,
} from "./map-geometry.ts";
import { LOCATOR } from "./map-layout.ts";

interface MarketLocatorProps {
  /** The five markets, in the editorial reading order. */
  readonly markets: readonly { readonly id: CountryId; readonly label: string }[];
  /** The market being read, or `null` for none. */
  readonly active: CountryId | null;
  readonly className?: string;
}

/**
 * The world, small, with the five markets on it — where the silhouette is.
 *
 * A LOCATOR, NOT A CONTROL
 * It answers "where is this?" and nothing else. It is `aria-hidden` and takes no pointer
 * events, and that is a measured decision rather than a shortcut: at the size of an inset,
 * Malaysia's and Singapore's anchors are about 2.7px apart, so no pointer could choose
 * between them. The key under the stage (44px targets) is the control, and the equivalent
 * one — WCAG 2.5.8 accepts a different control on the same page for a target that cannot
 * be made big enough.
 *
 * THE SAME WORLD AS THE MAP IT REPLACES
 * Equal Earth, so this is also the one place where relative SIZE can honestly be read: the
 * silhouettes are each fitted to one frame and say nothing about size, while here the
 * United States is the continent it is and Singapore has no outline at all.
 *
 * COLOUR IS INTERACTION STATE
 * By default every market is the same small neutral dot. When one is being read its plate
 * takes its identity tint and its marker — the shape it has in every chart — stands in a
 * ring, drawn last so it sits on top of its neighbours. The three Southeast Asian markets
 * overlap at this scale; the ring is what says which one is meant.
 */
export function MarketLocator({ markets, active, className }: MarketLocatorProps) {
  const ordered = [
    ...markets.filter((m) => m.id !== active),
    ...markets.filter((m) => m.id === active),
  ];
  const classes = ["map-locator block h-auto"];
  if (className !== undefined) classes.push(className);

  return (
    <svg
      viewBox={`0 0 ${String(MAP_VIEWBOX.width)} ${String(MAP_VIEWBOX.height)}`}
      className={classes.join(" ")}
      aria-hidden="true"
      focusable="false"
    >
      <path className="map-sea" d={OUTLINE_PATH} />
      <path className="map-land" d={LAND_PATH} />

      {ordered.map(({ id }) => {
        const d = MARKET_PLATES[id];
        return d === undefined ? null : (
          <path
            key={id}
            className="map-locator-plate"
            data-locates={id}
            data-active={active === id ? "true" : "false"}
            style={
              {
                "--market-colour": `var(${SERIES_IDENTITY[id].colorVariable})`,
              } as CSSProperties
            }
            d={d}
          />
        );
      })}

      {ordered.map(({ id }) => {
        const anchor = MARKET_ANCHORS[id];
        const isActive = active === id;
        const marker = SERIES_IDENTITY[id].marker;
        return (
          <g
            key={id}
            className="map-locator-mark"
            data-locates={id}
            data-active={isActive ? "true" : "false"}
            style={
              {
                "--market-colour": `var(${SERIES_IDENTITY[id].colorVariable})`,
              } as CSSProperties
            }
          >
            {isActive ? (
              <>
                <circle
                  className="map-locator-ring"
                  cx={anchor.x}
                  cy={anchor.y}
                  r={LOCATOR.ring}
                />
                <g
                  transform={`translate(${String(anchor.x - LOCATOR.glyph / 2)} ${String(anchor.y - LOCATOR.glyph / 2)}) scale(${String(LOCATOR.glyph / 10)})`}
                >
                  <path
                    className="map-locator-glyph"
                    d={MARKER_PATH[marker === "none" ? "circle" : marker]}
                  />
                </g>
              </>
            ) : (
              <circle className="map-locator-dot" cx={anchor.x} cy={anchor.y} r={LOCATOR.dot} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
