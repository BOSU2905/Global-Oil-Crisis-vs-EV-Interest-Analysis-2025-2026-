"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, PointerEvent } from "react";

import type { CountryId } from "../../data/index.ts";
import { MARKET_STAGE_NOTE } from "../../content/markets.ts";
import { SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { MAP_DWELL_MS, MAP_QUIET_MS } from "./map-layout.ts";
import { MarketLocator } from "./MarketLocator.tsx";
import { MarketPlate } from "./MarketPlate.tsx";

interface MarketStageProps {
  /** The five markets, in the editorial reading order. */
  readonly markets: readonly { readonly id: CountryId; readonly label: string }[];
  /** The market being read, or `null` for none. */
  readonly active: CountryId | null;
  /** Called after a short rest on a market, or at once on a click or tap. */
  readonly onSelect: (id: CountryId) => void;
  /** False until the reader has changed the selection, so the first render has no entrance. */
  readonly changed: boolean;
  readonly className?: string;
}

const identityStyle = (id: CountryId, index?: number): CSSProperties =>
  ({
    "--market-colour": `var(${SERIES_IDENTITY[id].colorVariable})`,
    ...(index === undefined ? {} : { "--i": index }),
  }) as CSSProperties;

/**
 * The markets as a picture: five silhouettes by default, one large when the reader chooses.
 *
 * A SPOTLIGHT, NOT A WORLD
 * The old map drew the whole world and the five markets were specks on it — Singapore was
 * 3px on a phone. The stage draws the markets themselves: every market as a raised plate,
 * all five the same size and depth, in the editorial reading order; or, once one is chosen,
 * that market alone, large, beside the evidence panel. A small locator in the corner says
 * where it is. The raised-plate material, the beacon and the identity rules are the ones
 * the world map had — see `MarketPlate` and `map-layout.ts`.
 *
 * NOTHING IS EMPHASISED UNTIL THE READER CHOOSES
 * By default no market is selected: the five tiles are identical and the panel beside them
 * lists all five classifications, so the page singles out none. A market is in the
 * spotlight only when the reader rests on it, taps it, or presses it in the key.
 *
 * INTERACTION
 * The tiles take the pointer and are decorative to assistive technology (`aria-hidden`):
 * the key and the panel carry the same information and the same control, reachable by
 * keyboard. Resting a mouse on a tile for `MAP_DWELL_MS` selects it — long enough that
 * sweeping across the row does not flick the stage — and a click or tap selects at once.
 * A touch does not start the rest timer: there is no hover on a screen that is scrolled
 * by dragging, and a finger crossing a row of large tiles must not choose one. Nothing
 * reverts on leave, so the pointer can travel to the panel's link. The spotlight and the
 * locator take no pointer events — see `MarketLocator` for why.
 *
 * THE ENTRANCE
 * Once, when the stage scrolls into view: the tiles' plates rise and their beacons drop in
 * reading order, staggered by `--stagger`, and the locator follows. The state is set on the
 * DOM node rather than rendered, for two reasons: without JavaScript the stage is simply
 * shown in its final state, and a stage already on screen at load (a deep link) is never
 * hidden and replayed. When the entrance has finished the state becomes `done`, so tiles
 * that come back after a spotlight do not replay it; they fade in like the panel does.
 */
export function MarketStage({
  markets,
  active,
  onSelect,
  changed,
  className,
}: MarketStageProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const dwell = useRef<number | undefined>(undefined);
  const quietUntil = useRef(0);

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
        // Hand the entrance back once every animation under the stage has finished (or been
        // cancelled by a selection): `getAnimations` flushes style, so the ones this
        // attribute just started are already in the list.
        void Promise.allSettled(
          root.getAnimations({ subtree: true }).map((animation) => animation.finished),
        ).then(() => {
          root.dataset["intro"] = "done";
        });
      },
      { threshold: 0.3 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(dwell.current), []);

  // Back on the overview: a pointer resting where the tiles reappear is not a choice.
  useEffect(() => {
    if (active === null) quietUntil.current = window.performance.now() + MAP_QUIET_MS;
  }, [active]);

  const rest = (id: CountryId, event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    if (window.performance.now() < quietUntil.current) return;
    window.clearTimeout(dwell.current);
    dwell.current = window.setTimeout(() => onSelect(id), MAP_DWELL_MS);
  };
  const leave = () => window.clearTimeout(dwell.current);
  const choose = (id: CountryId) => {
    window.clearTimeout(dwell.current);
    onSelect(id);
  };

  const classes = ["market-map @container"];
  if (className !== undefined) classes.push(className);

  return (
    <figure
      ref={rootRef}
      className={classes.join(" ")}
      data-has-active={active === null ? "false" : "true"}
      data-active-market={active ?? ""}
    >
      {/*
        The stage. Its ground is the land tone, so the white plates stand out of it, and it
        is the SAME size in both states, so choosing a market never moves what is below. The
        size follows the stage's own width (a container query, not the viewport): 4:3 on a
        phone, 3:2 from `@xl`, and a fixed height once it is wide enough that 3:2 would be
        taller than the picture needs.
      */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-(--map-land)">
        <div className="relative aspect-4/3 @xl:aspect-3/2 @4xl:aspect-auto @4xl:h-[26rem]">
          {active === null ? (
            <div
              key="overview"
              aria-hidden="true"
              data-panel-enter={changed ? "true" : undefined}
              className="map-tiles absolute inset-0 flex flex-wrap content-center justify-center"
            >
              {/* Three and two, in the reading order, centred: five tiles never fit one
                  row at a size worth drawing. The grid stops widening at 40rem, so a
                  wide stage gets margin rather than bigger silhouettes. */}
              <div className="flex w-full max-w-[40rem] flex-wrap justify-center">
                {markets.map(({ id, label }, index) => (
                  <div
                    key={id}
                    data-market={id}
                    data-active="false"
                    style={identityStyle(id, index)}
                    onPointerEnter={(event) => rest(id, event)}
                    onPointerLeave={leave}
                    onClick={() => choose(id)}
                    className="map-tile group flex basis-1/3 cursor-pointer flex-col items-center gap-1 px-1 py-2"
                  >
                    <div className="w-full">
                      <MarketPlate id={id} variant="tile" />
                    </div>
                    <span className="text-meta text-fg-secondary transition-colors duration-(--duration-fast) ease-out group-hover:text-fg">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              key={active}
              aria-hidden="true"
              data-market={active}
              data-active="true"
              data-panel-enter={changed ? "true" : undefined}
              style={identityStyle(active)}
              className="map-spotlight absolute inset-0 p-3"
            >
              <MarketPlate id={active} variant="spotlight" />
            </div>
          )}
        </div>
      </div>

      {/*
        The locator and the caption, together: a small map says where, and the words say
        what the drawing is and what it leaves out. The locator sits here and not over a
        corner of the stage because every corner is somebody's coastline — Florida, the
        Lindesnes coast, Peninsular Malaysia — and a silhouette should not be cut to make
        room for its own key.
      */}
      <figcaption className="mt-3 flex items-start gap-4">
        <MarketLocator
          markets={markets}
          active={active}
          className="w-32 shrink-0 rounded-md border border-border @xl:w-52"
        />
        <p className="max-w-reading text-meta text-fg-muted">{MARKET_STAGE_NOTE}</p>
      </figcaption>
    </figure>
  );
}
