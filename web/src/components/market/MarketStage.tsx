"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { CountryId } from "../../data/index.ts";
import type { MarketEvidence } from "../../lib/market-synthesis.ts";
import { MARKET_READOUT, MARKET_STAGE_NOTE } from "../../content/markets.ts";
import { SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { marketPreview } from "./contract.ts";
import { MarketLocator } from "./MarketLocator.tsx";
import { MarketPlate } from "./MarketPlate.tsx";

interface MarketStageProps {
  /** The five markets, in the editorial reading order. */
  readonly markets: readonly MarketEvidence[];
  /** The market being read, or `null` for none. */
  readonly active: CountryId | null;
  /** The reader chose a market (or chose the chosen one again, which lets go of it). */
  readonly onSelect: (id: CountryId) => void;
  /** The reader asked to go back to all five. */
  readonly onBack: () => void;
  /** Id of the panel the tiles control, for `aria-controls`. */
  readonly panelId: string;
  readonly className?: string;
}

const identityStyle = (id: CountryId, index?: number): CSSProperties =>
  ({
    "--market-colour": `var(${SERIES_IDENTITY[id].colorVariable})`,
    ...(index === undefined ? {} : { "--i": index }),
  }) as CSSProperties;

/** The readout while a market is under the pointer or focus: who, what the pipeline found, and when. */
function Preview({ market }: { readonly market: MarketEvidence }) {
  const preview = marketPreview(market);
  return (
    <div data-panel-enter="true" style={identityStyle(market.id)}>
      <p className="text-small text-fg">
        <span
          aria-hidden="true"
          className="mr-2 inline-block h-2 w-2 rounded-full bg-(--market-colour) align-middle"
        />
        {preview.label}
        <span className="ml-2 text-fg-secondary">{preview.relationship}</span>
      </p>
      <p className="mt-0.5 hidden text-meta text-fg-muted @xl:block">{preview.timing}</p>
    </div>
  );
}

/**
 * The markets as a picture that is also the way in: five raised plates, each one a button.
 *
 * THE MAP IS THE NAVIGATION
 * There is no separate list of countries under it. Each silhouette is a real `<button>`
 * named by its label, in the reading order, so the picture is reachable by keyboard and
 * announced by a screen reader exactly like the key it replaced; the SVG inside is hidden
 * from assistive technology because the button's name already says what it is.
 *
 * ALL FIVE STAY ON THE STAGE, WHATEVER THE READER DOES
 *   - At rest every tile is the same size and depth, and nothing is singled out.
 *   - HOVER (a mouse or pen) or keyboard FOCUS lifts one tile and shows a short preview in the
 *     readout under the tiles. It never selects: looking is not choosing, and sweeping the
 *     pointer across the stage changes nothing but the preview.
 *   - CLICK (or Enter / Space, or a tap) focuses a market: its plate takes its identity tint
 *     and rises, the other four step back in place (dimmed, not removed, so the arrangement
 *     and the way to any other market are still there), and the panel beside the stage shows
 *     its evidence. Choosing another tile moves the focus; choosing the focused one again, the
 *     Back control in the readout, or Escape returns to the overview.
 * A touch has no hover, so it neither previews nor leaves a sticky one behind a tap.
 *
 * THE READOUT
 * One line of the stage, the same height in every state so nothing below it moves: a hint at
 * rest, the preview while a market is under the pointer or focus, and — once a market is
 * chosen — the Back control. The preview is assembled from strings the panel already renders
 * (`marketPreview`), so it can never say something the panel does not.
 *
 * THE ENTRANCE
 * Once, when the stage scrolls into view: the tiles' plates rise and their beacons drop in
 * reading order, staggered by `--stagger`, and the locator follows. The state is set on the
 * DOM node rather than rendered, for two reasons: without JavaScript the stage is simply
 * shown in its final state, and a stage already on screen at load (a deep link) is never
 * hidden and replayed. When the entrance has finished the state becomes `done`.
 */
export function MarketStage({
  markets,
  active,
  onSelect,
  onBack,
  panelId,
  className,
}: MarketStageProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  /** The market under a mouse or pen. A touch never sets it. */
  const [hovered, setHovered] = useState<CountryId | null>(null);
  /** The market a keyboard has reached (`:focus-visible` only; a click's focus is not a preview). */
  const [focusPreview, setFocusPreview] = useState<CountryId | null>(null);

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

  const previewId = hovered ?? focusPreview;
  const previewing =
    active === null ? markets.find((entry) => entry.id === previewId) : undefined;
  // The locator follows the reader's attention: the focused market, else the one previewed.
  const highlight = active ?? previewing?.id ?? null;

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
        The stage. Its ground is the land tone, so the white plates stand out of it. It is
        sized by its content (three tiles and two, then the readout), and the readout keeps
        one height in every state, so the stage is the same size whatever is chosen.
      */}
      <div className="rounded-lg border border-border bg-(--map-land)">
        <ul
          aria-label="Markets on the map"
          className="map-tiles mx-auto flex max-w-[40rem] flex-wrap justify-center px-3 pb-1 pt-4"
        >
          {/* Three and two, in the reading order, centred: five tiles never fit one row at a
              size worth drawing. The grid stops widening at 40rem, so a wide stage gets margin
              rather than bigger silhouettes. */}
          {markets.map(({ id, label }, index) => {
            const isActive = id === active;
            return (
              <li key={id} className="min-w-0 basis-1/3">
                <button
                  type="button"
                  data-market={id}
                  data-active={isActive ? "true" : "false"}
                  data-dim={active !== null && !isActive ? "true" : "false"}
                  aria-pressed={isActive}
                  aria-controls={panelId}
                  style={identityStyle(id, index)}
                  onClick={() => onSelect(id)}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") setHovered(id);
                  }}
                  onPointerLeave={() =>
                    setHovered((current) => (current === id ? null : current))
                  }
                  onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible")) setFocusPreview(id);
                  }}
                  onBlur={() => setFocusPreview((current) => (current === id ? null : current))}
                  className="map-tile group flex w-full cursor-pointer flex-col items-center gap-1 rounded-md px-1 py-2"
                >
                  <span className="map-tile-plate block w-full">
                    <MarketPlate id={id} />
                  </span>
                  <span className="map-tile-label flex items-center gap-1.5 text-meta text-fg-secondary">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full bg-(--market-colour)"
                    />
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="map-readout min-h-[4.75rem] border-t border-border px-4 py-3">
          {active !== null ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md text-small text-fg-secondary underline decoration-border-strong underline-offset-4 transition-colors duration-(--duration-fast) ease-out hover:text-fg hover:decoration-fg-muted"
              >
                <span aria-hidden="true">←</span> {MARKET_READOUT.back}
              </button>
              <p className="hidden text-meta text-fg-muted @xl:block">
                {MARKET_READOUT.focused}
              </p>
            </div>
          ) : previewing === undefined ? (
            <p className="text-meta text-fg-muted">
              <span className="map-hint-pointer">{MARKET_READOUT.hintPointer}</span>
              <span className="map-hint-touch">{MARKET_READOUT.hintTouch}</span>
            </p>
          ) : (
            <Preview key={previewing.id} market={previewing} />
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
          active={highlight}
          className="w-32 shrink-0 rounded-md border border-border @xl:w-52"
        />
        <p className="max-w-reading text-meta text-fg-muted">{MARKET_STAGE_NOTE}</p>
      </figcaption>
    </figure>
  );
}
