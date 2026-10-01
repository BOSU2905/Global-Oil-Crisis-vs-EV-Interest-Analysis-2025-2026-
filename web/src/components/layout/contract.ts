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
 * THE EDITORIAL SPLIT — how a section uses a wide frame without widening its prose.
 *
 * From `xl` (1280px) a section is a 12-column grid: a LABEL column (5) carrying the
 * eyebrow and title, and a READING column (7) carrying the lead and any prose body.
 * Evidence — a chart, the market map, a deep dive — spans all twelve. Below `xl` every
 * class here is inert and the section stacks exactly as before.
 *
 * Why this rather than a wider prose column: the 68ch measure is what keeps prose
 * readable, and it does not change. What the large desktop frame gains is a place for
 * the heading to sit BESIDE its argument instead of above it, so the space beside a
 * 700px paragraph is used by structure rather than left as a void — the defect a
 * 1920×1080 screenshot showed on every text section.
 *
 * One decision, one place: `SectionHeader` and `app/page.tsx` both read these, so the
 * label and reading columns line up across every section on the page.
 */
export const EDITORIAL = {
  /** The grid itself. Only exists from `xl`. */
  grid: "xl:grid xl:grid-cols-12 xl:gap-x-(--editorial-gap)",
  /** Eyebrow + title. */
  label: "xl:col-span-5",
  /** Lead and prose bodies. Prose inside still carries `max-w-reading`. */
  reading: "xl:col-span-7 xl:col-start-6",
  /** Evidence that takes the whole frame. */
  full: "xl:col-span-12",
} as const;

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
