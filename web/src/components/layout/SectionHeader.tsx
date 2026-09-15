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
 *
 * THREE MEASURES, NOT ONE
 * The wrapper used to cap eyebrow, title and lead together at `max-w-reading`.
 * That is right for the lead and wrong for the title: `--width-reading` is a
 * measure for 16px prose, and applying it to a 60px display heading confined the
 * page's largest element to 586px — a third of a 1920px viewport — and broke the
 * h1 after "EV". Each role now carries the measure that belongs to it:
 *
 *   eyebrow  none        it is a few words; a measure would never apply
 *   title    max-w-title `--width-title` is 22ch, resolved against the HEADING's
 *                        own font size, so it tracks the fluid display scale with
 *                        no breakpoint logic. It must sit on the heading element
 *                        rather than a wrapper for that reason
 *   lead     max-w-reading  unchanged: prose never exceeds the measure
 *
 * The wrapper therefore takes the width of whatever container it is placed in,
 * which is what lets the eyebrow, the title and the section body below share one
 * left edge with the shell.
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

  const classes: string[] = [];
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
      <Heading id={sectionTitleId(sectionId)} className={`mt-3 max-w-title ${titleClass}`}>
        {title}
      </Heading>
      {lead === undefined ? null : (
        <p className="mt-(--section-header-gap) max-w-reading text-lead text-fg-secondary">
          {lead}
        </p>
      )}
    </div>
  );
}
