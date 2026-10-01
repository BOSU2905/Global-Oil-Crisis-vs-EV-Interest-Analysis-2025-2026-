import type { ReactNode } from "react";

import type { DescriptiveMetric } from "./contract.ts";

/** One cell: a descriptive figure, and optionally what qualifies or itemises it. */
export interface CoverageItem {
  /** DESCRIPTIVE only, by type: a count, a date range — never an inference. */
  readonly metric: DescriptiveMetric;
  /** A list or a sentence under the figure, e.g. the five market names. */
  readonly detail?: ReactNode;
}

interface CoverageSummaryProps {
  readonly items: readonly CoverageItem[];
  readonly className?: string;
}

/**
 * "What does this analysis cover?", answered in one panel.
 *
 * WHAT IT REPLACES, AND WHY
 * Three metric cards and a row of five country pills. The cards were three surfaces for
 * three short facts, and the pills were the problem the final-polish brief named: they
 * were rounded, bordered and uppercase — the shape of a filter chip — and clicking them
 * did nothing. That is fake interactivity, and the fix is not to give them an invented
 * job but to stop them looking like controls. Market names are now plain text, each with
 * its identity dot — the same colour as its line in every chart, which is the one thing a
 * reader can usefully learn here.
 *
 * ONE SURFACE, HAIRLINE CELLS
 * A single bordered panel whose cells are separated by 1px gaps over the border colour —
 * the technique the narrative-structure list already uses — so it reads as one answer
 * with four parts rather than four answers. One column on a phone, two on a tablet, four
 * from `xl`, where it spans the frame.
 *
 * Typed to `DescriptiveMetric`, so an inferential figure cannot reach this component at
 * all: a coefficient here would have no specification comparison beside it (KIRO.md §16).
 * Caveats keep MetricCard's rule — a word AND a sentence, never a colour alone.
 */
export function CoverageSummary({ items, className }: CoverageSummaryProps) {
  const classes = [
    "grid gap-px overflow-hidden rounded-lg border border-border bg-border",
    "md:grid-cols-2 xl:grid-cols-4",
  ];
  if (className !== undefined) classes.push(className);

  return (
    <dl className={classes.join(" ")}>
      {items.map(({ metric, detail }) => (
        <div key={metric.label} className="bg-surface p-(--card-padding)">
          <dt className="text-meta text-fg-muted">{metric.label}</dt>
          <dd className="mt-2">
            <p className="flex items-baseline gap-1.5">
              <span className="tabular text-stat-small text-fg">{metric.value}</span>
              {metric.unit === undefined ? null : (
                <span className="text-meta text-fg-muted">{metric.unit}</span>
              )}
            </p>
            {(metric.caveats ?? []).map((caveat) => (
              <p key={caveat.code} className="mt-2 text-meta text-fg-secondary">
                <span className="mr-2 text-label uppercase text-warning">{caveat.code}</span>
                {caveat.detail}
              </p>
            ))}
            {detail === undefined ? null : <div className="mt-3">{detail}</div>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
