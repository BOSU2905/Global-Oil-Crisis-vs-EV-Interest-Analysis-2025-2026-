import { Badge } from "../content/Badge.tsx";
import { Card } from "../content/Card.tsx";
import { formatWeek } from "../chart/contract.ts";
import type { MarketEvidence } from "../../lib/market-synthesis.ts";
import { marketTabId } from "./contract.ts";

interface MarketEvidenceRowProps {
  readonly market: MarketEvidence;
  /** `li` when the rows sit in a list, which they do in the synthesis. */
  readonly as?: "li" | "div";
  /**
   * Whether to offer the deep-dive link.
   *
   * Off inside a deep dive, where the link would point at the thing the reader is
   * already reading.
   */
  readonly showDeepDiveLink?: boolean;
  readonly className?: string | undefined;
}

/**
 * One market's evidence, as a row. The unit both the synthesis and the deep dives are
 * built from.
 *
 * DESCRIPTIVE, NOT EVALUATIVE — AND THAT IS THE DESIGN, NOT A DISCLAIMER
 * There is no figure on this row that could be compared with another row's to decide
 * which market did better. Four fields, and each is either a direction within one
 * market, a date, or a classification code turned into a phrase:
 *
 *   EV interest    rose / fell, from this market's own baseline to its own peak
 *   Peak week      a date, read from `metrics.global.peak_dispersion.peaks`
 *   Relationship   the evidence group, which is a KIND of pattern and not a quantity
 *   Robustness     fragile / moderate / robust, the artifact's own three-step scale
 *
 * No score, no rank, no ordering by value, no superlative. The reason is not taste:
 * each Google Trends series is rescaled to its own maximum, so a cross-market
 * comparison of level is undefined rather than merely unfair, and a weak correlation is
 * an absence of measurable co-movement rather than a smaller impact.
 *
 * THE PANEL NAME IS MARKED AS EDITORIAL EVERY TIME IT APPEARS
 * `docs/product-architecture.md` §3 rule 3 requires `requires_external_evidence` to be
 * displayed wherever a panel is, because the names assert mechanisms — subsidy
 * buffering, market maturity — that a price series and a search index cannot establish.
 * So the category badge is followed by the word "editorial", and the panel's basis line
 * says what kind of claim it is.
 *
 * AND SINGAPORE'S EVIDENCE GROUP IS IN THE SAME VIEW AS ITS PANEL
 * KIRO.md §19 rule 3: wherever Singapore is rendered inside the Maturity Gap, its
 * evidence group must be visible in the same view. It is, structurally — every row
 * renders its own `evidenceGroupLabel`, so the two groupings can never be shown apart.
 *
 * A `<dl>` rather than a table: these are label/value pairs about one subject, and a
 * screen reader announces "Relationship, level-only association" instead of reading a
 * grid position.
 */
export function MarketEvidenceRow({
  market,
  as = "li",
  showDeepDiveLink = true,
  className,
}: MarketEvidenceRowProps) {
  const fields: readonly {
    readonly label: string;
    readonly value: string;
    readonly tabular?: boolean;
  }[] = [
    { label: "EV interest", value: market.directionLabel },
    { label: "Peak week", value: formatWeek(market.peakWeek), tabular: true },
    { label: "Relationship", value: market.evidenceGroupLabel },
    { label: "Robustness", value: market.robustnessLabel },
  ];

  return (
    <Card as={as} className={className}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h3 className="text-h4 text-fg">{market.label}</h3>
        <Badge tone="info">{market.category.label}</Badge>
        {/* Not decoration. The panel names assert mechanisms this data cannot test. */}
        {market.category.requiresExternalEvidence ? <Badge>Editorial</Badge> : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-label uppercase text-fg-muted">{field.label}</dt>
            <dd
              className={`mt-1 text-small text-fg${field.tabular === true ? " tabular" : ""}`}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 max-w-reading border-t border-border pt-3 text-small text-fg-secondary">
        {market.evidenceStatement}
      </p>

      {showDeepDiveLink ? (
        // An ordinary anchor to the market's own tab. The deep-dive panel reads the
        // hash, so one click both scrolls and selects — no router, no separate route,
        // and the selection is in the URL where it can be shared.
        <p className="mt-3">
          <a
            href={`#${marketTabId(market.id)}`}
            className="inline-flex min-h-11 items-center text-small text-fg underline decoration-border-strong underline-offset-4 transition-colors duration-(--duration-fast) ease-out hover:decoration-fg-muted"
          >
            Open the {market.label} deep dive
          </a>
        </p>
      ) : null}
    </Card>
  );
}
