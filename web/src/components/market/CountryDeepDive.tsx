import type { ReactNode } from "react";

import { CAVEAT_LABEL } from "../../content/markets.ts";
import type { MarketEvidence } from "../../lib/market-synthesis.ts";
import { Badge } from "../content/Badge.tsx";
import { Callout } from "../content/Callout.tsx";
import { MarketEvidenceRow } from "./MarketEvidenceRow.tsx";

interface CountryDeepDiveProps {
  readonly market: MarketEvidence;
  /**
   * The market's own chart.
   *
   * A slot rather than a component, and empty for now. A per-country chart is a real
   * piece of work — its own accessibility contract, its own fallback table — and this
   * pass builds the structure that will host it rather than a placeholder that pretends
   * to be it. When the chart exists it drops in here and nothing else changes.
   */
  readonly chart?: ReactNode;
  readonly className?: string;
}

/**
 * One market's deep dive, rendered from the view model.
 *
 * WHY THERE IS ONE OF THESE AND NOT FIVE
 * Because five hand-written country blocks is how the original project ended up with
 * five different opinions about the same data: a claim edited in one tab and missed in
 * the other four. Everything below is read from `MarketEvidence`, which comes from
 * `selectMarketSynthesis()`, which reads `metrics.json`. There is no country name in a
 * conditional, no per-country prose branch, and no way for one market to say something
 * the others structurally cannot.
 *
 * WHAT A DEEP DIVE OWES A READER, IN ORDER
 *
 *   1. the evidence row, unchanged from the synthesis, so the two cannot disagree
 *   2. the editorial panel's basis — what kind of claim the panel name is making
 *   3. the specification comparison, as words: levels, first differences, detrended
 *   4. the caveats the pipeline attached, in words rather than as codes
 *   5. the chart, when one exists
 *   6. what this cannot support
 *
 * STEP 3 IS THE ONE THAT MATTERS MOST
 * KIRO.md §16: zero of six series survive first differencing as a positive
 * relationship, so a level association shown alone misleads. This renders the
 * comparison — which specifications hold and which do not — and **no coefficient**. A
 * coefficient needs `MetricContent`'s `inferential` variant, which cannot be
 * constructed without the specification comparison beside it, and that is the
 * Robustness section's job rather than a country panel's.
 *
 * THE INTERPRETATION IS DELIBERATELY SHORT
 * The final per-market narrative is the owner's to write. What is here is the evidence
 * and the limits, which are read from the artifacts and do not need an author.
 */
export function CountryDeepDive({ market, chart, className }: CountryDeepDiveProps) {
  const classes = ["flex flex-col gap-6"];
  if (className !== undefined) classes.push(className);

  const specifications: readonly {
    readonly label: string;
    readonly significant: boolean;
  }[] = [
    { label: "Levels", significant: market.specification.levelsSignificant },
    {
      label: "First differences",
      significant: market.specification.firstDifferencesSignificant,
    },
    {
      label: "Linear detrended",
      significant: market.specification.linearDetrendedSignificant,
    },
  ];

  // Codes the reader is shown, in the artifact's own order. Unmapped codes are dropped
  // rather than printed raw: a bare `loo_sign_flip` on screen is worse than silence,
  // and the deep dive is not the complete methodology.
  const caveats = market.caveats
    .map((code) => ({ code, label: CAVEAT_LABEL[code] }))
    .filter(
      (entry): entry is { code: typeof entry.code; label: string } => entry.label !== undefined,
    );

  return (
    <div className={classes.join(" ")}>
      <MarketEvidenceRow market={market} as="div" showDeepDiveLink={false} />

      <div>
        <h4 className="text-label uppercase text-fg-muted">The editorial reading</h4>
        <p className="mt-2 max-w-reading text-small text-fg-secondary">
          <span className="text-fg">{market.category.label}.</span> {market.category.basis}
          {market.category.verdict === null
            ? " The pipeline reviews no equivalent grouping, so this panel is editorial only."
            : ` The pipeline's review of the original grouping returned "${market.category.verdict.replace(/_/g, " ")}".`}
        </p>
      </div>

      <div>
        <h4 className="text-label uppercase text-fg-muted">Specification comparison</h4>
        {/*
          Three specifications, no coefficients. §16's requirement is that the
          comparison is visible, not that the numbers are — and the numbers need a
          component that cannot render them without this comparison beside them.

          EVERY BADGE IS NEUTRAL, AND THAT IS A CORRECTION. An earlier draft coloured a
          significant specification green and a non-significant one amber, which reads as
          good news and bad news. It is not: Norway's detrended correlation is
          significant and NEGATIVE, so a green "holds" would have told a reader the
          opposite of what the number says. Significance is about distinguishability from
          no relationship, and it carries no direction — so the badge states the test
          result in the artifact's own terms and the sentence below says what that
          excludes.
        */}
        <ul className="mt-2 flex flex-wrap gap-2">
          {specifications.map((specification) => (
            <li key={specification.label}>
              <Badge>
                {specification.label}:{" "}
                {specification.significant ? "significant" : "not significant"}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-reading text-small text-fg-secondary">
          A relationship that appears in levels and disappears in week-to-week changes is
          consistent with two series drifting upward together
          {market.specification.bothSeriesTrendSameDirection
            ? ", which both of these do over this window"
            : ""}
          . Neither check is decisive alone, so all three are reported and their disagreement is
          treated as the finding.
        </p>
        <p className="mt-2 max-w-reading text-meta text-fg-muted">
          Significance here means a relationship is distinguishable from none. It says nothing
          about direction or size — in some markets the specification that does reach
          significance is a negative one.
        </p>
      </div>

      {caveats.length === 0 ? null : (
        <div>
          <h4 className="text-label uppercase text-fg-muted">
            Caveats attached by the pipeline
          </h4>
          <ul className="mt-2 flex flex-col gap-1">
            {caveats.map((caveat) => (
              <li key={caveat.code} className="max-w-reading text-small text-fg-secondary">
                {caveat.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {chart === undefined ? null : <div>{chart}</div>}

      <Callout tone="warning" kind="Limits" className="max-w-reading">
        <p className="mt-3 text-small text-fg-secondary">
          This is a weekly benchmark crude price against a relative search index — not sales,
          not registrations and not intent. Nothing here identifies a cause: the study window is
          short, the elevated-price episode is only a few weeks long, and a search index cannot
          separate buying interest from news-driven curiosity.
        </p>
        <p className="mt-3 text-small text-fg-secondary">
          The level of this market&rsquo;s index cannot be compared with another market&rsquo;s.
          Each series is a separate Google Trends query rescaled to its own maximum, so every
          market contains a 100 and the heights are not on one scale.
        </p>
      </Callout>
    </div>
  );
}
