import type { ReactNode } from "react";

import { sectionTitleId } from "./contract.ts";

interface SectionProps {
  /** Anchor id. Must match an entry in `src/content/sections.ts`. */
  readonly id: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * One narrative section: a labelled landmark with rhythm and a correct anchor
 * offset.
 *
 * TWO DECISIONS WORTH KNOWING
 *
 * Rhythm is a MARGIN, not padding. `scroll-margin-top` positions the element's
 * border box, and a margin sits outside it — so deep-linking to `#scope` lands
 * with the heading just below the header, whereas top padding would have left a
 * `--section-spacing` void above it. Same visual rhythm, correct anchor.
 *
 * `scroll-mt-(--header-height)` is what stops the sticky header from covering the
 * heading a reader just navigated to. The token lives in `tokens.css` and changes
 * at the `lg` breakpoint, where the header collapses from two rows to one; an E2E
 * test measures the rendered header and asserts the token still clears it, so the
 * two cannot drift apart silently.
 *
 * The section is named by its own heading through `aria-labelledby`, so a screen
 * reader announcing the landmark says "Observation scope, region" rather than
 * "region".
 */
export function Section({ id, className, children }: SectionProps) {
  const classes = ["mt-(--section-spacing) scroll-mt-(--header-height)"];
  if (className !== undefined) classes.push(className);

  return (
    <section id={id} aria-labelledby={sectionTitleId(id)} className={classes.join(" ")}>
      {children}
    </section>
  );
}
