/**
 * The sections that exist on the page, in reading order.
 *
 * WHAT THIS IS FOR
 * The information architecture in docs/product-architecture.md §1 is one
 * long-scroll page navigated by anchor. `Navigation` needs the list of anchors,
 * and the page needs the same list to render them. One registry means a nav link
 * cannot point at a section that was renamed or removed — `tests/layout-contract.test.ts`
 * asserts every id below appears as a `<Section id=…>` in `app/page.tsx`, and that every
 * `<Section>` on the page appears below.
 *
 * WHAT THIS IS NOT
 * Not the full narrative from §1. The hero, the Oil Shock section, Robustness,
 * Interpretation, Limitations, About and Creator do not exist yet, and listing them here
 * would produce navigation links that scroll nowhere. The registry describes the page as
 * it *is*, and grows as sections are actually built. The `structure` section is where the
 * unbuilt sections are named, as intent rather than as navigation.
 *
 * READING ORDER, AND THE ONE CONSTRAINT ON IT
 * The narrative order is Context → Oil Shock → EV Interest → Global Relationship →
 * Robustness → Market Synthesis → Country Deep Dives, and the order below follows it for
 * the sections that exist. The one deviation is `comparability`, which sits before every
 * chart rather than where a methodology note would naturally fall: the constraint that
 * interest levels are series-local has to be read BEFORE a reader sees five interest
 * lines side by side, or the chart has already done its damage.
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
  { id: "how-to-read", navLabel: "How to Read" },
  { id: "comparability", navLabel: "Comparability" },
  { id: "ev-interest-markets", navLabel: "Markets" },
  { id: "oil-vs-interest", navLabel: "Oil vs Interest" },
  { id: "market-synthesis", navLabel: "Synthesis" },
  { id: "country-deep-dives", navLabel: "Deep Dives" },
  { id: "structure", navLabel: "Structure" },
];
