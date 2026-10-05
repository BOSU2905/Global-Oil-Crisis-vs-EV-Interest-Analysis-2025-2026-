"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { CountryId } from "../../data/index.ts";
import type { MarketSynthesis } from "../../lib/market-synthesis.ts";
import { MARKET_SYNTHESIS_WORDING_NOTE } from "../../content/markets.ts";
import { SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { Card } from "../content/Card.tsx";
import { EDITORIAL } from "../layout/contract.ts";
import { MarketEvidenceRow } from "./MarketEvidenceRow.tsx";
import { MarketStage } from "./MarketStage.tsx";

interface MarketSynthesisMapProps {
  readonly synthesis: MarketSynthesis;
  readonly className?: string;
}

const PANEL_ID = "market-synthesis-panel";

/**
 * "Five markets, one oil shock, five different patterns" — the synthesis as a picture.
 *
 * THE MAP IS THE NAVIGATION (the refinement after Batch 3)
 * The list of market buttons that used to sit under the picture is gone: each plate on the
 * stage is itself the button (see `MarketStage`). Five markets stay on the stage at all times;
 * hovering previews one, choosing one focuses it, and Back returns to all five.
 *
 * NOTHING IS EMPHASISED UNTIL THE READER CHOOSES
 * By default no market is selected: every tile is the same size and depth, every beacon
 * the same size, and the panel shows all five markets' relationships at once — so the
 * classification of every market is visible without any interaction (§5 rule 5), and no
 * market is singled out by the page's own choice. The panel is the detail: it renders the
 * same `MarketEvidenceRow` the deep dives use, read from the same view model, so the two
 * can never disagree, and it changes only when the reader chooses — never on hover.
 *
 * LEAVING A SELECTION
 * Pressing the chosen tile again, the Back control in the stage's readout, or Escape anywhere
 * in the section lets go. Focus goes back to the tile that was chosen, so a keyboard reader
 * is not dropped at the top of the page when the Back button they just pressed disappears.
 *
 * WHAT STAYS VISIBLE REGARDLESS
 * The finding above the stage — interest rose in all five, the peaks did not coincide, no
 * market reaches a robust positive association — is plain text, outside every control,
 * because `product-architecture.md` §6 forbids a finding that lives behind interaction.
 *
 * SINGAPORE
 * Its editorial grouping (Maturity Gap) is only ever shown inside `MarketEvidenceRow`,
 * beside its evidence group (level-only association) — KIRO.md §19 rule 3, structurally.
 */
export function MarketSynthesisMap({ synthesis, className }: MarketSynthesisMapProps) {
  const [active, setActive] = useState<CountryId | null>(null);
  /** False until the reader changes the panel, so the first render has no entrance. */
  const [changed, setChanged] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const market = synthesis.markets.find((entry) => entry.id === active) ?? null;
  const { peakSpread } = synthesis;

  const show = (id: CountryId | null) => {
    setChanged(true);
    setActive(id);
  };

  /** Choosing the chosen market again lets go of it, as the key's toggle used to. */
  const select = (id: CountryId) => show(id === active ? null : id);

  const release = () => {
    const previous = active;
    if (previous === null) return;
    // The tiles are the same elements in every state, so this one exists right now; focusing
    // it before the Back button unmounts means focus never falls to the document.
    rootRef.current
      ?.querySelector<HTMLElement>(`.map-tile[data-market="${previous}"]`)
      ?.focus({ preventScroll: true });
    show(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      release();
    }
  };

  const classes = ["flex flex-col gap-(--grid-gap)"];
  if (className !== undefined) classes.push(className);

  return (
    <div ref={rootRef} className={classes.join(" ")} onKeyDown={onKeyDown}>
      {/*
        The finding, before the map, in plain text. "The peaks were not synchronised" is
        the claim the original project got exactly backwards.
      */}
      <div className={EDITORIAL.grid}>
        <p className={`max-w-reading text-small text-fg-secondary ${EDITORIAL.reading}`}>
          Interest rose in all five markets, and they did not turn together. The five peak weeks
          fall in <span className="tabular">{peakSpread.distinctWeeks}</span> distinct weeks
          across <span className="tabular">{peakSpread.distinctMonths.length}</span> calendar
          months and span <span className="tabular">{peakSpread.spanWeeks}</span> weeks
          {peakSpread.synchronisedWithinOneMonth
            ? "."
            : ", so they are not synchronised within a single month."}{" "}
          No market reaches a robust positive association.
        </p>
      </div>

      <div className={`${EDITORIAL.grid} gap-y-(--grid-gap)`}>
        <div className="xl:col-span-7">
          <MarketStage
            markets={synthesis.markets}
            active={active}
            onSelect={select}
            onBack={release}
            panelId={PANEL_ID}
          />
        </div>

        <div id={PANEL_ID} className="xl:col-span-5">
          {/* Announced, so a keyboard reader hears what the panel now shows. */}
          <p className="sr-only" aria-live="polite">
            {market === null ? "Showing all five markets." : `Showing ${market.label}.`}
          </p>

          <div key={market?.id ?? "all"} data-panel-enter={changed ? "true" : undefined}>
            {market === null ? (
              <Card>
                <h3 className="text-h4 text-fg">All Five Markets</h3>
                <p className="mt-2 text-meta text-fg-muted">
                  The pipeline&rsquo;s classification of each market&rsquo;s association with
                  crude prices. Select a market on the map to read its evidence.
                </p>
                <ul className="mt-4 flex flex-col divide-y divide-border">
                  {synthesis.markets.map((entry) => (
                    <li key={entry.id} className="py-2.5">
                      <p className="flex items-center gap-2 text-small text-fg">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: `var(${SERIES_IDENTITY[entry.id].colorVariable})`,
                          }}
                        />
                        {entry.label}
                      </p>
                      <p className="mt-0.5 pl-4 text-meta text-fg-secondary">
                        {entry.evidenceGroupLabel}
                        <span className="text-fg-muted"> · {entry.robustnessLabel}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <MarketEvidenceRow market={market} as="div" />
            )}
          </div>
        </div>
      </div>

      <div className={EDITORIAL.grid}>
        <p className={`max-w-reading text-meta text-fg-muted ${EDITORIAL.reading}`}>
          <span className="text-fg-secondary">Wording still in progress.</span>{" "}
          {MARKET_SYNTHESIS_WORDING_NOTE}
        </p>
      </div>
    </div>
  );
}
