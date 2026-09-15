import type { ReactNode } from "react";

import { BADGE_TONE_CLASS, type BadgeTone } from "./contract.ts";

interface BadgeProps {
  /** The badge's meaning, in words. Never omitted, never replaced by an icon. */
  readonly children: ReactNode;
  readonly tone?: BadgeTone;
  /** Longer explanation, surfaced as a native tooltip and to assistive tech. */
  readonly title?: string;
  readonly className?: string;
}

/**
 * A caveat code, evidence group or verdict.
 *
 * TEXT AND SHAPE, NEVER COLOUR ALONE (product-architecture.md §4, §5)
 * Three cues carry the meaning and only one of them is colour: the word itself,
 * the pill outline, and the tone. Remove the colour — in a greyscale print, in a
 * forced-colours mode, for a reader with deuteranopia — and the badge still reads
 * correctly. That is why `tone` is optional and defaults to `neutral`: reaching
 * for a colour must be a deliberate act, and the text must already be sufficient.
 *
 * The type is `--text-label`, the same role as a section eyebrow, which is the
 * only uppercase in the product (design-system.md §3). Uppercasing happens in CSS
 * so a screen reader reads "not robust" rather than spelling out capitals.
 */
export function Badge({ children, tone = "neutral", title, className }: BadgeProps) {
  const classes = [
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-label uppercase",
    BADGE_TONE_CLASS[tone],
  ];
  if (className !== undefined) classes.push(className);

  return (
    <span className={classes.join(" ")} title={title}>
      {children}
    </span>
  );
}
