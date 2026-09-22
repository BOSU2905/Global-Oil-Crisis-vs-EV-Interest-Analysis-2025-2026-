/**
 * Shared vocabulary for the market layer — synthesis rows and country deep dives.
 *
 * Same reasoning as the other `contract.ts` files: several components must agree on
 * one set of ids and labels, and Node cannot load `.tsx`, so anything expressed here
 * is unit-testable while anything expressed in a component is only testable once
 * rendered.
 *
 * The market layer has one extra obligation, and it is the reason this file carries a
 * guard rather than only constants. Every prohibited way of presenting five markets is
 * a *word*: "best", "worst", "most", "rank", "score", "winner". None of them is a type
 * error and none of them is caught by a screenshot, so `assertNoRankingLanguage` exists
 * to make the ban executable and `tests/market-synthesis.test.ts` runs it over the
 * rendered content.
 */

import type { CountryId } from "../../data/artifact-types.ts";

/** Section anchors. Registered in `src/content/sections.ts`, which owns navigation. */
export const MARKET_SYNTHESIS_SECTION_ID = "market-synthesis";
export const COUNTRY_DEEP_DIVE_SECTION_ID = "country-deep-dives";

/**
 * Id of one market's tab button in the deep-dive panel.
 *
 * It is a real element id so the synthesis rows can link to it with an ordinary
 * anchor: the browser scrolls to it, and the panel's `hashchange` listener selects
 * that market. That is `docs/product-architecture.md` §1's requirement — country
 * selection reflected in the URL hash, no separate country routes — met with a link
 * rather than with a router.
 */
export function marketTabId(id: CountryId): string {
  return `market-${id}`;
}

/** The `market-` prefix back off a hash, or `null` if the hash is something else. */
export function countryFromHash(hash: string, known: readonly CountryId[]): CountryId | null {
  const bare = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!bare.startsWith("market-")) return null;
  const candidate = bare.slice("market-".length);
  return known.find((id) => id === candidate) ?? null;
}

/** Id of the panel a tab controls, for `aria-controls`. */
export function marketPanelId(id: CountryId): string {
  return `market-${id}-panel`;
}

/**
 * Words that must never describe a market in this product, and why.
 *
 * Each Google Trends series is normalised to its own maximum, so there is no scale on
 * which one market is higher than another. That makes every ranking word below not
 * merely unwise but undefined — and the original project's "most enthusiastic market:
 * Norway (60.7 avg)" claim is in `claims.json` with status `invalid_method` precisely
 * because it was one.
 *
 * A weak or absent correlation is also not a smaller impact: it is an absence of
 * measurable co-movement, and "suffered less" would be a causal claim about an effect
 * the analysis never established.
 */
export const PROHIBITED_MARKET_LANGUAGE: readonly string[] = [
  "most interested",
  "most enthusiastic",
  "most visionary",
  "most affected",
  "least affected",
  "best market",
  "worst market",
  "top market",
  "market ranking",
  "performance score",
  "suffered most",
  "suffered least",
  "winner",
  "out of 10",
  "/10",
  "proactive shift",
];

export const RANKING_LANGUAGE_MESSAGE =
  "cross-market ranking language is undefined for independently normalised series";

/**
 * Throw if a string ranks, scores or crowns a market.
 *
 * Case-insensitive, and applied to assembled content rather than to source code, so it
 * catches a phrase built from fragments as well as one typed whole.
 */
export function assertNoRankingLanguage(text: string, where: string): void {
  const lowered = text.toLowerCase();
  const found = PROHIBITED_MARKET_LANGUAGE.filter((phrase) => lowered.includes(phrase));
  if (found.length > 0) {
    throw new Error(`${where}: ${RANKING_LANGUAGE_MESSAGE} — found "${found.join('", "')}"`);
  }
}
