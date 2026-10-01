"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { CountryId } from "../../data/index.ts";
import type { MarketSynthesis } from "../../lib/market-synthesis.ts";
import { SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { CountryDeepDive } from "./CountryDeepDive.tsx";
import { countryFromHash, marketPanelId, marketTabId } from "./contract.ts";

interface CountryDeepDivePanelProps {
  readonly synthesis: MarketSynthesis;
  readonly className?: string;
}

/**
 * The five deep dives behind one selector.
 *
 * WHY NOT FIVE ROUTES
 * `docs/product-architecture.md` §1 rules them out for an analytical reason rather than
 * a technical one: a separate country page lets a reader reach a country conclusion
 * without the evidence that qualifies it — the normalisation constraint, the
 * specification comparison, the fact that none of the five reaches a robust association.
 * Country analysis therefore lives inside the narrative, selected in place, with the
 * selection reflected in the URL hash so it is still shareable.
 *
 * THE TABS ARE A REAL TABLIST
 * `role="tablist"` with `aria-selected`, `aria-controls` and roving `tabIndex`, and
 * ←/→/Home/End move between tabs — the ARIA authoring-practice behaviour. Each tab is
 * 44px tall, per the accessibility contract.
 *
 * ONE PILL THAT TRAVELS (Revision 8)
 * The selection is a single translucent pill that glides to the chosen tab
 * (`--duration-glide`, `--ease-glide`: fast start, soft landing, no overshoot) rather
 * than five backgrounds switching on and off. Its tint is the selected market's identity
 * colour — the colour its line has in every chart, and nothing more. Position and size
 * are measured from the selected tab and written to CSS custom properties, so moving it
 * costs no React render; a `ResizeObserver` on the tabs re-measures when the webfont
 * swaps in or the strip wraps. The selected tab is also marked by `aria-selected` and by
 * its text, so the state is never colour alone.
 *
 * The panel below fades and rises 6px when the selection changes — the content is
 * re-keyed on the market, so this is an entrance, not a slide across. Under
 * `prefers-reduced-motion` both durations collapse to 1ms in `tokens.css`.
 *
 * AND THE HASH IS AN INPUT, NOT JUST AN OUTPUT
 * `market-us` in the URL selects the United States on load and on every subsequent
 * `hashchange`, which is what makes `<a href="#market-us">` elsewhere on the page work
 * without a router.
 */
export function CountryDeepDivePanel({ synthesis, className }: CountryDeepDivePanelProps) {
  // Memoised so the effect below depends on a stable value. `synthesis` is selected on
  // the server and its identity does not change at runtime.
  const ids = useMemo(() => synthesis.markets.map((market) => market.id), [synthesis]);

  const [selected, setSelected] = useState<CountryId | null>(null);
  /** False until the reader changes market, so the first render has no entrance. */
  const [changed, setChanged] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => {
      const fromHash = countryFromHash(window.location.hash, ids);
      if (fromHash !== null) setSelected(fromHash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [ids]);

  // The first market in the editorial reading order is the default. `null` state rather
  // than an initial id keeps the "nothing chosen yet" case out of the hash logic.
  const active = selected ?? ids[0];
  const market = synthesis.markets.find((entry) => entry.id === active);
  if (market === undefined) {
    throw new Error("the synthesis contains no markets, so there is no deep dive to show");
  }

  // --- the pill: measured from the selected tab, before paint ----------------
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) return;

    const place = () => {
      const tab = document.getElementById(marketTabId(market.id));
      if (tab === null) return;
      list.style.setProperty("--pill-x", `${String(tab.offsetLeft)}px`);
      list.style.setProperty("--pill-y", `${String(tab.offsetTop)}px`);
      list.style.setProperty("--pill-w", `${String(tab.offsetWidth)}px`);
      list.style.setProperty("--pill-h", `${String(tab.offsetHeight)}px`);
      list.style.setProperty(
        "--pill-colour",
        `var(${SERIES_IDENTITY[market.id].colorVariable})`,
      );

      // Below `sm` the strip scrolls sideways, and a deep-linked or arrow-keyed tab can
      // sit off its edge (measured at 375px: Singapore half-clipped on load). Scroll the
      // STRIP, never the page — `scrollIntoView` would also move the page vertically.
      if (list.scrollWidth > list.clientWidth) {
        const margin = 8;
        const left = tab.offsetLeft - margin;
        const right = tab.offsetLeft + tab.offsetWidth + margin;
        const target =
          left < list.scrollLeft
            ? left
            : right > list.scrollLeft + list.clientWidth
              ? right - list.clientWidth
              : list.scrollLeft;
        if (target !== list.scrollLeft) {
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          list.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
        }
      }
    };
    place();

    // Transitions switch on only after the first placement has been painted.
    const frame =
      list.dataset["pillReady"] === "true"
        ? 0
        : requestAnimationFrame(() => {
            list.dataset["pillReady"] = "true";
          });

    const observer = new ResizeObserver(place);
    for (const tab of list.querySelectorAll('[role="tab"]')) observer.observe(tab);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [market.id]);

  const choose = (id: CountryId) => {
    if (id !== active) setChanged(true);
    setSelected(id);
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % ids.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + ids.length) % ids.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ids.length - 1;
    else return;

    event.preventDefault();
    const target = ids[next];
    if (target === undefined) return;
    choose(target);
    document.getElementById(marketTabId(target))?.focus();
  };

  const classes: string[] = [];
  if (className !== undefined) classes.push(className);

  return (
    <div className={classes.join(" ")}>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Markets"
        data-selected={market.id}
        // Scrolls horizontally below `sm` rather than wrapping: five tabs on two rows
        // reads as two groups, and they are one. `relative` so the pill is positioned
        // against the strip and scrolls with it. `p-1` with `-m-1`: a scroll container
        // clips outlines, and the 2px focus ring at a 2px offset needs 4px of room on
        // every side — at 375px it was clipped to a sliver. The negative margin keeps
        // the tabs on the content edge.
        className="relative -m-1 flex gap-1 overflow-x-auto p-1 sm:flex-wrap sm:overflow-visible"
      >
        <span
          aria-hidden="true"
          data-pill
          className="pointer-events-none absolute top-0 left-0 rounded-md border"
        />
        {synthesis.markets.map((entry, index) => {
          const isSelected = entry.id === market.id;
          return (
            <button
              key={entry.id}
              id={marketTabId(entry.id)}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={marketPanelId(entry.id)}
              // Roving tabIndex: one stop for the whole strip, arrows move within it.
              tabIndex={isSelected ? 0 : -1}
              onClick={() => choose(entry.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={[
                "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3",
                "text-small whitespace-nowrap transition-colors duration-(--duration-fast) ease-out",
                isSelected ? "text-fg" : "text-fg-muted hover:text-fg-secondary",
              ].join(" ")}
            >
              {/* Identity only: the colour of this market's line in every chart. */}
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: `var(${SERIES_IDENTITY[entry.id].colorVariable})` }}
              />
              {entry.label}
            </button>
          );
        })}
      </div>

      <div
        id={marketPanelId(market.id)}
        role="tabpanel"
        aria-labelledby={marketTabId(market.id)}
        tabIndex={0}
        className="mt-(--section-header-gap)"
      >
        {/* Re-keyed on the market, so a change of selection is a fresh entrance. */}
        <div key={market.id} data-panel-enter={changed ? "true" : undefined}>
          <CountryDeepDive market={market} />
        </div>
      </div>
    </div>
  );
}
