import type { ReactNode } from "react";

import { EDITORIAL, sectionOrdinal, sectionTitleId } from "./contract.ts";

interface SectionHeaderProps {
  /** The owning section's id. The heading id is derived from it. */
  readonly sectionId: string;
  /**
   * Position in the reading order, rendered as `01`. Omit for a block that is
   * not a numbered section.
   */
  readonly index?: number;
  /** Eyebrow text. Title Case. Uppercased by CSS, never in the string. */
  readonly eyebrow: string;
  /** Title Case, like every editorial heading in the product. */
  readonly title: ReactNode;
  /** The analytical thesis for the section. One or two sentences, sentence case. */
  readonly lead?: ReactNode;
  /**
   * A short orientation that belongs with the title rather than the lead: why the section
   * is here. From `xl` it sits in the label column under the title, which is otherwise
   * empty beside a long lead (Batch 2 A2 left that space alone for every section, and this
   * is the one place it carries content, on request); below `xl` it follows the title.
   * Sentence case, plain prose, and never a claim the section's evidence does not make.
   * Omitted, the header renders exactly as it did before this prop existed.
   */
  readonly aside?: string;
  /**
   * Heading level. `1` is for the page's single top-level heading; everything
   * else is `2`. Restricting it to these two makes a skipped level impossible.
   */
  readonly headingLevel?: 1 | 2;
  /**
   * `split` puts the title in the editorial label column and the lead in the reading
   * column from `xl` (see `EDITORIAL`); `stacked` keeps them one above the other at
   * every width. Defaults to `split` for a section heading and `stacked` for the page
   * `h1`, and a header placed inside a narrower surface (a callout, a panel) should
   * pass `stacked` explicitly, because a grid inside a grid would split twice.
   */
  readonly layout?: "split" | "stacked";
  readonly className?: string;
}

/**
 * Eyebrow + title + optional lead, per docs/product-architecture.md §4.
 *
 * THE EDITORIAL CASE CONVENTION
 * `eyebrow` and `title` are **Title Case**; `lead` is prose and is sentence case.
 * That split is the whole convention, and it is worth stating because the eyebrow
 * hides one half of it: the eyebrow renders uppercase, so its source casing has no
 * visible effect and would drift unnoticed. It still matters, because CSS
 * `text-transform` does not change the accessible name — a screen reader reads the
 * DOM text, so "Analytical Foundation" is what is announced.
 *
 * Case is fixed in the CONTENT STRING, never computed. A runtime title-caser would
 * have to guess at "vs", "EV", "Cross-Market" and every future proper noun, and it
 * would silently mangle the one it guessed wrong. `tests/layout-contract.test.ts`
 * asserts the convention instead.
 *
 * The eyebrow is the ONLY uppercase in the product (design-system.md §3), and it
 * is uppercased with the `uppercase` utility rather than in the string, so a
 * screen reader reads "Observation Scope" instead of spelling out capitals.
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
  aside,
  headingLevel = 2,
  layout,
  className,
}: SectionHeaderProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const titleClass = headingLevel === 1 ? "text-display text-fg" : "text-h2 text-fg";
  const split = (layout ?? (headingLevel === 1 ? "stacked" : "split")) === "split";

  const classes: string[] = [];
  if (className !== undefined) classes.push(className);

  // In the split the title and the lead share one grid row, aligned on their first
  // baselines, so the lead reads as the title's argument rather than as a caption
  // floating beside it. Below `xl` every split class is inert and nothing moves.
  const row = split ? `${EDITORIAL.grid} xl:items-baseline` : undefined;
  const titleColumn = split ? ` ${EDITORIAL.label}` : "";
  const leadColumn = split ? ` ${EDITORIAL.reading} xl:mt-3` : "";

  // With an aside, the label column holds the title AND the aside, so the pair is wrapped
  // and the wrapper is the grid item: its first baseline is still the title's, so the
  // baseline alignment with the lead is unchanged. Without one, nothing is wrapped and the
  // markup is what it always was.
  const heading = (
    <Heading
      id={sectionTitleId(sectionId)}
      className={`mt-3 max-w-title ${titleClass}${aside === undefined ? titleColumn : ""}`}
    >
      {title}
    </Heading>
  );

  return (
    <div className={classes.join(" ")}>
      <p className="text-label uppercase text-fg-muted">
        {index === undefined ? null : (
          <>
            <span className="tabular">{sectionOrdinal(index)}</span>
            <span aria-hidden="true"> — </span>
          </>
        )}
        {eyebrow}
      </p>
      <div className={row}>
        {aside === undefined ? (
          heading
        ) : (
          <div className={titleColumn.trim() === "" ? undefined : titleColumn.trim()}>
            {heading}
            <p className="mt-4 max-w-reading text-pretty text-small text-fg-secondary">
              {aside}
            </p>
          </div>
        )}
        {lead === undefined ? null : (
          <p
            className={`mt-(--section-header-gap) max-w-reading text-lead text-fg-secondary${leadColumn}`}
          >
            {lead}
          </p>
        )}
      </div>
    </div>
  );
}
