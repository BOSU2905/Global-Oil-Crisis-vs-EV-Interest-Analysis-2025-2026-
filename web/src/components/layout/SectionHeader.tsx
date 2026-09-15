import type { ReactNode } from "react";

import { sectionOrdinal, sectionTitleId } from "./contract.ts";

interface SectionHeaderProps {
  /** The owning section's id. The heading id is derived from it. */
  readonly sectionId: string;
  /**
   * Position in the reading order, rendered as `01`. Omit for a block that is
   * not a numbered section.
   */
  readonly index?: number;
  /** Eyebrow text. Uppercased by CSS, never in the string. */
  readonly eyebrow: string;
  readonly title: ReactNode;
  /** The analytical thesis for the section. One or two sentences. */
  readonly lead?: ReactNode;
  /**
   * Heading level. `1` is for the page's single top-level heading; everything
   * else is `2`. Restricting it to these two makes a skipped level impossible.
   */
  readonly headingLevel?: 1 | 2;
  readonly className?: string;
}

/**
 * Eyebrow + title + optional lead, per docs/product-architecture.md §4.
 *
 * The eyebrow is the ONLY uppercase in the product (design-system.md §3), and it
 * is uppercased with the `uppercase` utility rather than in the string, so a
 * screen reader reads "Observation scope" instead of spelling out capitals.
 *
 * The heading carries `sectionTitleId(sectionId)` because `Section` points
 * `aria-labelledby` at exactly that id.
 */
export function SectionHeader({
  sectionId,
  index,
  eyebrow,
  title,
  lead,
  headingLevel = 2,
  className,
}: SectionHeaderProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const titleClass = headingLevel === 1 ? "text-display text-fg" : "text-h2 text-fg";

  const classes = ["max-w-reading"];
  if (className !== undefined) classes.push(className);

  return (
    <div className={classes.join(" ")}>
      <p className="text-label uppercase text-fg-muted">
        {index === undefined ? null : (
          <>
            <span className="numeric">{sectionOrdinal(index)}</span>
            <span aria-hidden="true"> — </span>
          </>
        )}
        {eyebrow}
      </p>
      <Heading id={sectionTitleId(sectionId)} className={`mt-3 ${titleClass}`}>
        {title}
      </Heading>
      {lead === undefined ? null : (
        <p className="mt-(--section-header-gap) text-lead text-fg-secondary">{lead}</p>
      )}
    </div>
  );
}
