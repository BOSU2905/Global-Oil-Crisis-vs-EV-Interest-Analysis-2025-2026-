"use client";

import { useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import type { CountryId } from "../../data/index.ts";
import type { MarketSynthesis } from "../../lib/market-synthesis.ts";
import { MARKET_SYNTHESIS_WORDING_NOTE } from "../../content/markets.ts";
import { SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { Card } from "../content/Card.tsx";
import { EDITORIAL } from "../layout/contract.ts";
import { MarketEvidenceRow } from "./MarketEvidenceRow.tsx";
import { MarketMap } from "./MarketMap.tsx";

interface MarketSynthesisMapProps {
  readonly synthesis: MarketSynthesis;
  readonly className?: string;
}

const PANEL_ID = "market-synthesis-panel";

/**
 * "Five markets, one oil shock, five different patterns" — the synthesis as a map.
 *
 * WHAT CHANGED, AND WHAT DID NOT (Revision 7)
 * The five stacked evidence cards became one map, one key and one panel. The EVIDENCE did
 * not change: the panel renders the same `MarketEvidenceRow` the deep dives use, read from
 * the same view model, so the two can never disagree.
 *
 * NOTHING IS EMPHASISED UNTIL THE READER CHOOSES
 * By default no market is selected: every plate is the same neutral height, every beacon
 * the same size, and the panel shows all five markets' relationships at once — so the
 * classification of every market is visible without any interaction (§5 rule 5), and no
 * market is singled out by the page's own choice. A market lifts when the reader rests on
 * it, taps it, or presses it in the key; pressing it again, Escape, or "Show all five
 * markets" returns to the overview.
 *
 * WHAT STAYS VISIBLE REGARDLESS
 * The finding above the map — interest rose in all five, the peaks did not coincide, no
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

  const market = synthesis.markets.find((entry) => entry.id === active) ?? null;
  const { peakSpread } = synthesis;

  const show = (id: CountryId | null) => {
    setChanged(true);
    setActive(id);
  };

  const onKeyKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      show(null);
    }
  };

  const classes = ["flex flex-col gap-(--grid-gap)"];
  if (className !== undefined) classes.push(className);

  return (
    <div className={classes.join(" ")}>
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
        <div className="xl:col-span-8">
          <MarketMap
            markets={synthesis.markets}
            active={active}
            onSelect={(id) => {
              if (id !== active) show(id);
            }}
          />

          {/*
            The key: the map's legend, and its keyboard and touch control. Real buttons —
            each one does something — so they look like buttons, unlike the inert pills
            that used to sit in the scope section.
          */}
          <ul
            aria-label="Markets on the map"
            className="mt-3 flex flex-wrap gap-2"
            onKeyDown={onKeyKeyDown}
          >
            {synthesis.markets.map((entry) => {
              const pressed = entry.id === active;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    aria-controls={PANEL_ID}
                    onClick={() => show(pressed ? null : entry.id)}
                    style={
                      {
                        "--market-colour": `var(${SERIES_IDENTITY[entry.id].colorVariable})`,
                      } as CSSProperties
                    }
                    className={[
                      "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-small",
                      "transition-[color,background-color,border-color] duration-(--duration-fast) ease-out",
                      pressed
                        ? "border-[color-mix(in_srgb,var(--market-colour)_40%,transparent)] bg-[color-mix(in_srgb,var(--market-colour)_10%,transparent)] text-fg"
                        : "border-border text-fg-secondary hover:border-border-interactive hover:text-fg",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full bg-(--market-colour)"
                    />
                    {entry.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div id={PANEL_ID} className="xl:col-span-4">
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
                  crude prices. Choose a market on the map, or below it, to read its evidence.
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
              <>
                <MarketEvidenceRow market={market} as="div" />
                <button
                  type="button"
                  onClick={() => show(null)}
                  className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md text-small text-fg-secondary underline decoration-border-strong underline-offset-4 transition-colors duration-(--duration-fast) ease-out hover:text-fg hover:decoration-fg-muted"
                >
                  <span aria-hidden="true">←</span> Show all five markets
                </button>
              </>
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
