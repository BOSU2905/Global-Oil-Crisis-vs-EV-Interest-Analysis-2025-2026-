import type { ElementType } from "react";

import { Badge } from "./Badge.tsx";
import { Card } from "./Card.tsx";
import { assertMetricDisplayable, type MetricContent } from "./contract.ts";

interface MetricCardProps {
  readonly metric: MetricContent;
  /** Passed through to `Card`. `li` when the cards sit in a list. */
  readonly as?: ElementType | undefined;
  readonly className?: string | undefined;
}

/**
 * One statistic: label, value in tabular figures, unit, optional interval, and —
 * for anything inferential — the specification comparison and its caveats.
 *
 * THE CAVEAT SLOT IS STRUCTURAL, NOT DECORATIVE
 * KIRO.md §16 is the project's most important presentational rule: zero of six
 * series survive first differencing, so a level correlation shown on its own
 * misleads, and the specification comparison must sit beside it rather than in a
 * methodology footnote. This component does not offer that as an option.
 *
 *   - `MetricContent` is a discriminated union. An `inferential` metric cannot be
 *     constructed without `specification` and at least one caveat; `tsc` rejects
 *     it. See `contract.ts`.
 *   - `assertMetricDisplayable` re-checks at runtime, because a type cannot catch
 *     an empty string arriving from an artifact field.
 *   - The specification line renders unconditionally for an inferential metric.
 *     There is no prop that hides it.
 *
 * NO STATISTIC IS COMPUTED OR EVEN FORMATTED HERE
 * `value`, `unit`, `interval` and `specification` are strings the caller read from
 * the artifacts. This component performs no arithmetic, no rounding and no
 * comparison — `tests/content-contract.test.ts` scans the file to keep it that
 * way.
 *
 * `.tabular` supplies `tabular-nums` without changing the face, so a column of these
 * cards aligns digit-for-digit (design-system.md §3: tabular figures are
 * non-negotiable) while the figure stays in Geist Sans. Nothing on a metric card is a
 * technical identifier — a date range, a count and a confidence interval are values a
 * reader reads — so `.numeric`, which is Geist Mono, is deliberately not used here.
 */
export function MetricCard({ metric, as, className }: MetricCardProps) {
  assertMetricDisplayable(metric);

  const caveats = metric.caveats ?? [];

  return (
    <Card as={as} className={className}>
      <p className="text-meta text-fg-muted">{metric.label}</p>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="tabular text-stat-small text-fg">{metric.value}</span>
        {metric.unit === undefined ? null : (
          <span className="text-meta text-fg-muted">{metric.unit}</span>
        )}
      </p>

      {metric.interval === undefined ? null : (
        <p className="tabular mt-1 text-meta text-fg-muted">{metric.interval}</p>
      )}

      {metric.kind === "inferential" ? (
        // Unconditional by design. §16 forbids the coefficient standing alone, so
        // there is no branch in which this line is absent.
        <p className="mt-3 border-t border-border pt-3 text-meta text-fg-secondary">
          <span className="text-fg">Other specifications.</span>{" "}
          <span className="tabular">{metric.specification}</span>
        </p>
      ) : null}

      {caveats.length === 0 ? null : (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {caveats.map((caveat) => (
              <li key={caveat.code}>
                <Badge tone="warning" title={caveat.detail}>
                  {caveat.code}
                </Badge>
              </li>
            ))}
          </ul>
          {/* The badge is a summary; the sentence is the caveat. A badge alone
              would make the qualification depend on a hover, which the
              accessibility contract does not allow. */}
          <ul className="mt-2 flex flex-col gap-1">
            {caveats.map((caveat) => (
              <li key={caveat.code} className="text-meta text-fg-secondary">
                {caveat.detail}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
