"use client";

import { useEffect, useMemo, useState } from "react";

import type { CountryId } from "../../data/index.ts";
import type { MarketSynthesis } from "../../lib/market-synthesis.ts";
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
 * WHY NOT FIVE STACKED PANELS
 * Five deep dives rendered at once is five times the same headings, and a reader
 * comparing two markets would be scrolling between them rather than switching. One at a
 * time is also what makes the synthesis rows' links meaningful.
 *
 * THE TABS ARE A REAL TABLIST
 * `role="tablist"` with `aria-selected`, `aria-controls` and roving `tabIndex`, and
 * ←/→/Home/End move between tabs — the ARIA authoring-practice behaviour, because a
 * tab strip that only responds to Tab is a tab strip a keyboard user cannot navigate.
 * Each tab is 44px tall, per the accessibility contract.
 *
 * AND THE HASH IS AN INPUT, NOT JUST AN OUTPUT
 * `market-us` in the URL selects the United States on load and on every subsequent
 * `hashchange`, which is what makes `<a href="#market-us">` in a synthesis row work
 * without a router: the browser scrolls to the tab, and this selects it.
 *
 * The chart slot is left empty. A per-country chart needs its own accessibility
 * contract and its own fallback table, and building the structure that will host one is
 * this pass's job — a placeholder rectangle would not be.
 */
export function CountryDeepDivePanel({ synthesis, className }: CountryDeepDivePanelProps) {
  // Memoised so the effect below depends on a stable value. `synthesis` is selected on
  // the server and its identity does not change at runtime.
  const ids = useMemo(() => synthesis.markets.map((market) => market.id), [synthesis]);

  const [selected, setSelected] = useState<CountryId | null>(null);

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
  // than an initial id keeps the "nothing chosen yet" case out of the hash logic: a
  // reader who has not chosen is shown the first, and a reader who has is shown theirs.
  const active = selected ?? ids[0];
  const market = synthesis.markets.find((entry) => entry.id === active);
  if (market === undefined) {
    throw new Error("the synthesis contains no markets, so there is no deep dive to show");
  }

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
    setSelected(target);
    document.getElementById(marketTabId(target))?.focus();
  };

  const classes: string[] = [];
  if (className !== undefined) classes.push(className);

  return (
    <div className={classes.join(" ")}>
      <div
        role="tablist"
        aria-label="Markets"
        // Scrolls horizontally below `sm` rather than wrapping: five tabs on two rows
        // reads as two groups, and they are one.
        className="-mx-1 flex gap-1 overflow-x-auto sm:mx-0 sm:flex-wrap sm:overflow-visible"
      >
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
              onClick={() => setSelected(entry.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={[
                "inline-flex min-h-11 items-center whitespace-nowrap rounded-md border px-3",
                "text-small transition-colors duration-(--duration-fast) ease-out",
                isSelected
                  ? "border-border-strong bg-surface-raised text-fg"
                  : "border-transparent text-fg-muted hover:text-fg-secondary",
              ].join(" ")}
            >
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
        <CountryDeepDive market={market} />
      </div>
    </div>
  );
}
