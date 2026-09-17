/**
 * The sections that exist on the page, in reading order.
 *
 * WHAT THIS IS FOR
 * The information architecture in docs/product-architecture.md §1 is one
 * long-scroll page navigated by anchor. `Navigation` needs the list of anchors,
 * and the page needs the same list to render them. One registry means a nav link
 * cannot point at a section that was renamed or removed — `tests/layout-contract.test.ts`
 * asserts every id below appears as a `<Section id=…>` in `app/page.tsx`.
 *
 * WHAT THIS IS NOT
 * Not the ten-section narrative from §1. Those sections do not exist yet: the
 * hero is step 6, the narrative bodies are steps 6–7, and listing them here
 * would produce navigation links that scroll nowhere. The registry describes the
 * page as it *is*, and grows as sections are actually built.
 *
 * Nav labels are deliberately shorter than section titles. §1 permits that
 * explicitly ("Navigation labels may be shortened for the header"); the reading
 * order is what must not change.
 */

export interface NavSection {
  /** Anchor id. Also the deep-link target, so it is part of the public URL. */
  readonly id: string;
  /** Short label for the header rail. */
  readonly navLabel: string;
}

export const SHELL_SECTIONS: readonly NavSection[] = [
  { id: "scope", navLabel: "Scope" },
  { id: "comparability", navLabel: "Comparability" },
  { id: "oil-vs-interest", navLabel: "Oil vs Interest" },
  { id: "structure", navLabel: "Structure" },
];
