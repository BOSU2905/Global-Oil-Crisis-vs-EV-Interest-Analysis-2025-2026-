/**
 * Shared vocabulary for the layout primitives.
 *
 * WHY THIS IS NOT INSIDE THE COMPONENTS
 * Two reasons, both practical:
 *
 *   1. `Container`, `Section` and `SectionHeader` all need to agree on the width
 *      variants and on how a section's heading id is derived. Agreement by
 *      convention breaks silently; agreement by shared module does not.
 *   2. Node 22's type stripping cannot parse `.tsx` (verified: importing one
 *      under `node --test` fails with `ERR_UNKNOWN_FILE_EXTENSION`). Logic kept
 *      in a `.ts` module is therefore unit-testable without adding a JSX
 *      transform to the test toolchain; behaviour that only exists once rendered
 *      is covered by the Playwright suite instead.
 *
 * No component may invent a width. The five variants below are exactly the five
 * in docs/design-system.md §4, and `--width-*` is defined once in `tokens.css`.
 */

/** The five documented content widths. There is no sixth. */
export type ContainerWidth = "page" | "chart" | "content" | "reading" | "narrow";

/**
 * Variant → Tailwind utility. The utilities exist because `globals.css` maps
 * `--width-*` onto `--container-*`, so `max-w-reading` *is* `--width-reading`.
 */
export const CONTAINER_MAX_WIDTH: Readonly<Record<ContainerWidth, string>> = {
  page: "max-w-page",
  chart: "max-w-chart",
  content: "max-w-content",
  reading: "max-w-reading",
  narrow: "max-w-narrow",
};

/**
 * Id of the heading that names a section.
 *
 * `Section` points `aria-labelledby` at this, and `SectionHeader` puts it on the
 * heading element. Deriving both from one function is what makes the landmark
 * label correct without either component knowing about the other.
 */
export function sectionTitleId(sectionId: string): string {
  return `${sectionId}-title`;
}

/**
 * Two-digit ordinal for a section eyebrow: `01`, `02`, …
 *
 * The eyebrow reads `01 — OBSERVATION SCOPE` (docs/product-architecture.md §4).
 * Padding is presentational only; it carries no meaning and no analysis.
 */
export function sectionOrdinal(index: number): string {
  return String(index).padStart(2, "0");
}
