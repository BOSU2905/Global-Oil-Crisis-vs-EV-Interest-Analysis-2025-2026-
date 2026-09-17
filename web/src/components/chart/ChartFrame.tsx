import type { ReactNode } from "react";

import type { DataSource } from "../../data/index.ts";
import { Card } from "../content/Card.tsx";
import { SourceNote } from "../content/SourceNote.tsx";
import type { ChartAccessibilityContract } from "../../styles/chart-language.ts";

interface ChartFrameProps {
  /** Everything a chart must declare before it can ship. */
  readonly a11y: ChartAccessibilityContract;
  /** Eyebrow above the title. Title Case, uppercased by CSS. */
  readonly eyebrow: string;
  /** `manifest.sources[]`. Never a hard-coded URL. */
  readonly sources: readonly DataSource[];
  /** The chart itself. */
  readonly children: ReactNode;
  /** Interaction controls. Reset is mandatory whenever zoom or pan is enabled. */
  readonly controls?: ReactNode;
  /** The tabular twin plus its toggle. */
  readonly fallback?: ReactNode;
  /** Caveats and footnotes — provisional weeks, missing observations, specification. */
  readonly notes?: ReactNode;
  /** Id the chart region points `aria-describedby` at. */
  readonly descriptionId: string;
  /**
   * `| undefined` is explicit because `tsconfig.json` sets
   * `exactOptionalPropertyTypes`: this component is designed to be wrapped, so a
   * caller must be able to forward a possibly-undefined `className` straight through
   * without inventing a default it does not want. Same reasoning as `Card`.
   */
  readonly className?: string | undefined;
}

/**
 * The card shell around a visualisation, per `docs/product-architecture.md` §4:
 * eyebrow, title, a one-line "what to look for", the chart slot, controls, source,
 * and the fallback toggle.
 *
 * IT IS A `Card`, SO IT MUST NOT FLOAT
 * `ChartFrame` composes `Card` rather than building a second surface, which is what
 * keeps a chart looking like the rest of the product. `Card` writes `shadow-none`
 * explicitly and `globals.css` does not generate a card-sized shadow utility, so the
 * rule holds here for free — design-system §1: elevation is border plus background
 * delta, and shadow belongs to genuinely overlaid surfaces.
 *
 * THE THREE TEXT SLOTS ARE NOT INTERCHANGEABLE
 * §5 requires a meaningful title, a contextual description naming what to look for,
 * and a long description stating the finding. They are different jobs:
 *
 *   title            names the chart. Specific, never "Figure 1"
 *   description      one sentence, visible, telling a reader where to look
 *   longDescription  the finding, in prose, for a reader who cannot use the visual
 *                    encoding at all. Rendered visually hidden and wired to the
 *                    chart region via `aria-describedby`
 *
 * The long description is `sr-only` rather than absent because a canvas is opaque to
 * assistive technology. It is not a substitute for the tabular fallback — that
 * carries the values, this carries the reading.
 *
 * LOADING AND EMPTY STATES ARE DELIBERATELY NOT HERE
 * §4 assigns them to this component, and they are not implemented because this
 * chart cannot have them: the artifacts are imported at build time and validated
 * before render, so there is no fetch to be pending and no empty result to show. A
 * spinner for data that is already in the bundle would be theatre. When a chart
 * arrives that genuinely loads asynchronously, this is where its states belong.
 */
export function ChartFrame({
  a11y,
  eyebrow,
  sources,
  children,
  controls,
  fallback,
  notes,
  descriptionId,
  className,
}: ChartFrameProps) {
  const classes: string[] = [];
  if (className !== undefined) classes.push(className);

  return (
    <Card as="figure" className={classes.join(" ")}>
      <p className="text-label uppercase text-fg-muted">{eyebrow}</p>

      <h3 className="mt-3 max-w-title text-h3 text-fg">{a11y.title}</h3>

      {/* What to look for. Visible, because §5 makes it a requirement rather than a
          tooltip: a reader should not have to work out why a chart is here. */}
      <p className="mt-2 max-w-reading text-small text-fg-secondary">{a11y.description}</p>

      {/* The finding, for a reader who cannot use the visual encoding. Hidden
          visually because the chart and the table already say it to everyone else. */}
      <p id={descriptionId} className="sr-only">
        {a11y.longDescription}
      </p>

      {controls === undefined ? null : <div className="mt-5">{controls}</div>}

      <div className="mt-4">{children}</div>

      {notes === undefined ? null : (
        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3">{notes}</div>
      )}

      {fallback === undefined ? null : <div className="mt-4">{fallback}</div>}

      {/* `figcaption` last in the DOM but semantically the caption: it carries the
          attribution, which is the part a reader cites. */}
      <figcaption className="mt-6 border-t border-border pt-4">
        <SourceNote sources={sources} heading="Source" headingLevel={3} />
      </figcaption>
    </Card>
  );
}
