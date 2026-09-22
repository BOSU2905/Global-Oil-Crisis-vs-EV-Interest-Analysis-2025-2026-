import type { MarketSynthesis } from "../../lib/market-synthesis.ts";
import { MARKET_SYNTHESIS_WORDING_NOTE } from "../../content/markets.ts";
import { MarketEvidenceRow } from "./MarketEvidenceRow.tsx";

interface MarketSynthesisListProps {
  readonly synthesis: MarketSynthesis;
  readonly className?: string;
}

/**
 * The five markets, as evidence rows.
 *
 * WHAT THE SECTION IS FOR
 * One question: what did the shock reveal across the five markets? The answer the data
 * supports is about PATTERN and TIMING — the peaks are spread across three calendar
 * months, three of the five markets show no detectable or inconclusive association, and
 * none of them reaches a robust one. That is a finding about heterogeneity, and it is
 * the reason the rows are a list rather than a leaderboard.
 *
 * WHY THIS IS NOT A KPI GRID
 * A market-research interface is the right register — dense, labelled, scannable — and
 * a scorecard is the wrong one. The difference is whether the rows can be ordered. These
 * cannot: each Google Trends series is rescaled to its own maximum, so there is no
 * common scale on which one market sits above another, and a weak correlation is an
 * absence of measurable co-movement rather than a smaller effect. Every field on a row
 * is a direction within one market, a date, or a classification.
 *
 * ONE VISIBLE NOTE ABOUT WHAT IS FINISHED
 * The evidence is final because it is read from the artifacts. The interpretive
 * narrative around it is not written yet, and the note says so rather than letting a
 * reader assume the synthesis prose is missing by accident.
 */
export function MarketSynthesisList({ synthesis, className }: MarketSynthesisListProps) {
  const classes: string[] = [];
  if (className !== undefined) classes.push(className);

  const { peakSpread } = synthesis;

  return (
    <div className={classes.join(" ")}>
      {/*
        The finding, before the rows. `product-architecture.md` §6 forbids a critical
        conclusion living behind a disclosure, and "the peaks were not synchronised" is
        the claim the original project got exactly backwards.
      */}
      <p className="max-w-reading text-small text-fg-secondary">
        Interest rose in all five markets, and they did not turn together. The five peak weeks
        fall in <span className="tabular">{peakSpread.distinctWeeks}</span> distinct weeks
        across <span className="tabular">{peakSpread.distinctMonths.length}</span> calendar
        months and span <span className="tabular">{peakSpread.spanWeeks}</span> weeks
        {peakSpread.synchronisedWithinOneMonth
          ? "."
          : ", so they are not synchronised within a single month."}{" "}
        No market reaches a robust positive association.
      </p>

      <ul className="mt-(--grid-gap) grid list-none gap-(--grid-gap)">
        {synthesis.markets.map((market) => (
          <MarketEvidenceRow key={market.id} market={market} as="li" />
        ))}
      </ul>

      <p className="mt-6 max-w-reading text-meta text-fg-muted">
        <span className="text-fg-secondary">Wording still in progress.</span>{" "}
        {MARKET_SYNTHESIS_WORDING_NOTE}
      </p>
    </div>
  );
}
