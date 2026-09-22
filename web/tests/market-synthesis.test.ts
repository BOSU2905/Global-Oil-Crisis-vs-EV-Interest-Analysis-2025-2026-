/**
 * Market synthesis, country deep dive and reading-guide contract tests.
 *
 * WHAT THESE PROTECT
 * This is the layer where the product says what it found, so it is the layer where a
 * sentence can quietly become a claim the data does not support. Four risks, and every
 * one of them is a word rather than a type error:
 *
 *   1. A CLASSIFICATION THAT DISAGREES WITH THE ARTIFACT. Every evidence group, every
 *      robustness label and every peak week rendered must equal `metrics.json`. Asserted
 *      market by market, against the real artifacts.
 *   2. A RANKING. Each Google Trends series is rescaled to its own maximum, so "most
 *      interested market" is undefined rather than merely unfair — the original project's
 *      "Pasar paling antusias: Norway (60.7 avg)" is in `claims.json` with status
 *      `invalid_method`. No score, no rank, no superlative, no ordering by a value.
 *   3. "THE PROACTIVE SHIFT". Its `category_review` verdict is `not_supported`. It must
 *      appear nowhere in the market layer.
 *   4. SINGAPORE. The editorial grouping (Maturity Gap, with Norway) and the statistical
 *      grouping (`level_only_association`, with the United States) disagree, and both
 *      stand because they are different kinds of object. KIRO.md §19 rule 4: the product
 *      may never state or imply that Singapore shows no level association.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { loadArtifactBundle } from "../src/data/load-node.ts";
import { COUNTRY_IDS } from "../src/data/index.ts";
import {
  interestDirection,
  selectMarketSynthesis,
} from "../src/lib/market-synthesis.ts";
import {
  CAVEAT_LABEL,
  EDITORIAL_CATEGORIES,
  EVIDENCE_GROUP_LABEL,
  MARKET_READING_ORDER,
  MARKET_SYNTHESIS_WORDING_NOTE,
  ROBUSTNESS_LABEL,
  evidenceSentence,
  peakTimingPhrase,
} from "../src/content/markets.ts";
import {
  PROHIBITED_MARKET_LANGUAGE,
  assertNoRankingLanguage,
  countryFromHash,
  marketPanelId,
  marketTabId,
} from "../src/components/market/contract.ts";
import { HOW_TO_READ_ENTRIES, HOW_TO_READ_MARKER } from "../src/content/how-to-read.ts";
import { readMorePanelId, readMoreToggleId } from "../src/components/content/contract.ts";

const webRoot = join(import.meta.dirname, "..");
const marketDir = join(webRoot, "src", "components", "market");

const bundle = loadArtifactBundle();
const synthesis = selectMarketSynthesis(bundle);

/**
 * Source of a file, with every comment removed.
 *
 * JSX comment blocks are stripped as a block before the line filter, because their
 * continuation lines are plain prose and would otherwise be read as code — the reason a
 * comment explaining why Norway's detrended result must not be coloured green once failed
 * the "no country in a conditional" scan.
 */
const codeOf = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

/**
 * Market-layer files a content scan should read.
 *
 * `contract.ts` is excluded, and it is the only exclusion: it is the file that DEFINES
 * the prohibited vocabulary, so a scan for "score", "rank" or "Proactive Shift" finds the
 * ban list itself. Scanning it would force the guard to be written obfuscated, which is
 * worse than naming the exception here.
 */
const marketSources = (): readonly string[] =>
  readdirSync(marketDir)
    .filter((name) => name !== "contract.ts")
    .map((name) => join(marketDir, name));

// ---------------------------------------------------------------------------
// All five markets, once each
// ---------------------------------------------------------------------------

test("every market appears exactly once, so none can be quietly dropped", () => {
  const ids = synthesis.markets.map((market) => market.id);
  assert.equal(ids.length, COUNTRY_IDS.length);
  assert.deepEqual([...ids].sort(), [...COUNTRY_IDS].sort());
  assert.equal(new Set(ids).size, ids.length);
});

test("the reading order is the editorial one, not a sort of any value", () => {
  assert.deepEqual(
    synthesis.markets.map((market) => market.id),
    [...MARKET_READING_ORDER],
  );
  // If it were sorted by a measured value it would coincide with one of these.
  const byPeak = [...synthesis.markets].sort((a, b) => a.peakWeek.localeCompare(b.peakWeek));
  const byLabel = [...synthesis.markets].sort((a, b) => a.label.localeCompare(b.label));
  assert.notDeepEqual(
    synthesis.markets.map((m) => m.id),
    byPeak.map((m) => m.id),
  );
  assert.notDeepEqual(
    synthesis.markets.map((m) => m.id),
    byLabel.map((m) => m.id),
  );
});

// ---------------------------------------------------------------------------
// The classifications are the artifact's, verbatim
// ---------------------------------------------------------------------------

test("every evidence group, robustness and peak week equals metrics.json", () => {
  for (const market of synthesis.markets) {
    const metrics = bundle.metrics.series[market.id];
    assert.ok(metrics !== undefined, `${market.id} missing from metrics.json`);
    assert.equal(market.evidenceGroup, metrics.classification.evidence_group);
    assert.equal(market.robustness, metrics.classification.robustness);
    assert.equal(market.peakWeek, metrics.profile.scale_free.peak_week);
    assert.equal(market.peakLagWeeks, metrics.profile.scale_free.peak_lag_weeks);
    assert.deepEqual([...market.caveats], [...metrics.classification.caveats]);
  }
});

test("the peak weeks also match the global peak-dispersion map", () => {
  const peaks = bundle.metrics.global.peak_dispersion.peaks;
  for (const market of synthesis.markets) {
    assert.equal(market.peakWeek, peaks[market.id]);
  }
});

test("the authoritative classifications are exactly what the report renders", () => {
  // Spelled out rather than derived, because this is the one place a reader of the test
  // suite should be able to check the five classifications against the decision record
  // without opening a JSON file. If the pipeline output ever changed, this fails loudly
  // and the change is reviewed rather than absorbed.
  const expected: Readonly<Record<string, { group: string; robustness: string; peak: string }>> = {
    indonesia: {
      group: "no_detectable_association",
      robustness: "fragile",
      peak: "2026-02-15",
    },
    us: { group: "level_only_association", robustness: "moderate", peak: "2026-03-29" },
    singapore: { group: "level_only_association", robustness: "moderate", peak: "2026-03-08" },
    malaysia: { group: "inconclusive", robustness: "fragile", peak: "2026-02-15" },
    norway: { group: "no_detectable_association", robustness: "fragile", peak: "2026-01-25" },
  };

  for (const market of synthesis.markets) {
    const want = expected[market.id];
    assert.ok(want !== undefined, `no expectation recorded for ${market.id}`);
    assert.equal(market.evidenceGroup, want.group, `${market.id} evidence group`);
    assert.equal(market.robustness, want.robustness, `${market.id} robustness`);
    assert.equal(market.peakWeek, want.peak, `${market.id} peak week`);
  }
});

test("no market reaches a robust association, and the UI cannot claim one", () => {
  for (const market of synthesis.markets) {
    assert.notEqual(market.evidenceGroup, "robust_positive_association");
    assert.notEqual(market.evidenceGroup, "robust_negative_association");
    assert.notEqual(market.robustness, "robust");
  }
});

test("no series survives first differencing, and the flags say so", () => {
  for (const market of synthesis.markets) {
    assert.equal(
      market.specification.firstDifferencesSignificant,
      false,
      `${market.id} would be the first market to survive first differencing — verify the pipeline`,
    );
  }
});

// ---------------------------------------------------------------------------
// The one derivation
// ---------------------------------------------------------------------------

test("interest direction is the sign of a published figure, nothing more", () => {
  assert.equal(interestDirection(300), "rose");
  assert.equal(interestDirection(-12.5), "fell");
  assert.equal(interestDirection(0), "unchanged");
});

test("every market's direction matches the sign of its own baseline-to-peak change", () => {
  for (const market of synthesis.markets) {
    const published = bundle.metrics.series[market.id]?.profile.scale_free
      .baseline_to_peak_pct_change;
    assert.ok(published !== undefined);
    assert.equal(market.direction, interestDirection(published));
  }
});

test("interest rose in all five markets, which is the descriptive finding", () => {
  for (const market of synthesis.markets) {
    assert.equal(market.direction, "rose", `${market.id} no longer rose — the copy must change`);
  }
});

// ---------------------------------------------------------------------------
// The evidence sentence
// ---------------------------------------------------------------------------

test("every sentence names its own classification and reads as prose", () => {
  for (const market of synthesis.markets) {
    const sentence = market.evidenceStatement;
    // Two sentences, both ending in a full stop, neither a comma splice.
    assert.match(sentence, /^EV interest (rose|fell|broadly flat)/, `${market.id}: ${sentence}`);
    assert.ok(sentence.endsWith("."), `${market.id} sentence is unterminated`);
    assert.ok(!sentence.includes("ev interest"), "EV must not be lowercased");
    assert.ok(sentence.split(". ").length >= 2, `${market.id} should be two sentences`);
  }
});

test("a level-only market affirms the association before qualifying it", () => {
  for (const market of synthesis.markets) {
    if (market.evidenceGroup !== "level_only_association") continue;
    const sentence = market.evidenceStatement;
    const affirm = sentence.indexOf("A level association");
    assert.ok(affirm >= 0, `${market.id} does not affirm its level association`);
    // KIRO.md §19 rule 4: nothing may imply this market shows no level association.
    assert.ok(
      !/no (detectable )?association/i.test(sentence),
      `${market.id}'s sentence denies an association it has`,
    );
  }
});

test("Singapore's level association is affirmed and its limit is stated", () => {
  const singapore = synthesis.markets.find((market) => market.id === "singapore");
  assert.ok(singapore !== undefined);
  assert.equal(singapore.evidenceGroup, "level_only_association");
  assert.match(singapore.evidenceStatement, /A level association with crude prices is present/);
  assert.match(singapore.evidenceStatement, /does not survive removing the elevated-price weeks/);
});

test("Singapore's evidence group travels in the same object as its editorial panel", () => {
  // §19 rule 3: wherever Singapore appears inside the Maturity Gap, its evidence group
  // must be visible in the same view. Structural rather than editorial — the row renders
  // both fields from one object, so they cannot be shown apart.
  const singapore = synthesis.markets.find((market) => market.id === "singapore");
  assert.ok(singapore !== undefined);
  assert.equal(singapore.category.label, "Maturity Gap");
  assert.equal(singapore.evidenceGroupLabel, EVIDENCE_GROUP_LABEL.level_only_association);
  assert.equal(singapore.category.requiresExternalEvidence, true);
});

test("Norway and Singapore are in one editorial panel and are not statistical peers", () => {
  const norway = synthesis.markets.find((market) => market.id === "norway");
  const singapore = synthesis.markets.find((market) => market.id === "singapore");
  assert.ok(norway !== undefined && singapore !== undefined);
  assert.equal(norway.category.id, singapore.category.id);
  assert.notEqual(norway.evidenceGroup, singapore.evidenceGroup);
});

test("the peak-timing phrase reads the artifact's sign convention correctly", () => {
  assert.equal(peakTimingPhrase(0), "peaked in the same week as the crude-price peak");
  assert.match(peakTimingPhrase(-4), /four weeks before/);
  assert.match(peakTimingPhrase(2), /two weeks after/);
  assert.match(peakTimingPhrase(-1), /one week before/);
});

test("the sentence changes when the flags change, so it cannot go stale", () => {
  const base = {
    direction: "rose",
    peakLagWeeks: -2,
    caveats: [],
  } as const;
  const detectable = evidenceSentence({ ...base, evidenceGroup: "level_only_association" });
  const notDetectable = evidenceSentence({ ...base, evidenceGroup: "no_detectable_association" });
  assert.notEqual(detectable, notDetectable);
  assert.match(detectable, /level association/);
  assert.match(notDetectable, /No association/);
});

// ---------------------------------------------------------------------------
// The editorial framework
// ---------------------------------------------------------------------------

test("every editorial panel is marked as requiring external evidence", () => {
  for (const category of synthesis.categories) {
    assert.equal(
      category.requiresExternalEvidence,
      true,
      `${category.label} would render without the flag §3 rule 3 requires`,
    );
  }
});

test("a reviewed panel takes its membership and verdict from the artifact", () => {
  const reviews = bundle.metrics.category_review;
  for (const source of EDITORIAL_CATEGORIES) {
    if (source.reviewId === null) continue;
    const review = reviews.find((entry) => entry.id === source.reviewId);
    assert.ok(review !== undefined, `category_review has no "${source.reviewId}"`);
    const view = synthesis.categories.find((entry) => entry.id === source.id);
    assert.ok(view !== undefined);
    assert.deepEqual([...view.members], [...review.data_supported_members]);
    assert.equal(view.verdict, review.verdict);
  }
});

test("an unreviewed panel is marked editorial rather than given a verdict", () => {
  for (const source of EDITORIAL_CATEGORIES) {
    if (source.reviewId !== null) continue;
    const view = synthesis.categories.find((entry) => entry.id === source.id);
    assert.ok(view !== undefined);
    assert.equal(view.verdict, null, `${view.label} invented a verdict`);
  }
});

test("Malaysia stands alone and is not forced into another panel", () => {
  const malaysia = synthesis.markets.find((market) => market.id === "malaysia");
  assert.ok(malaysia !== undefined);
  assert.deepEqual([...malaysia.category.members], ["malaysia"]);
  assert.equal(malaysia.evidenceGroup, "inconclusive");
});

test('"The Proactive Shift" is not_supported in the artifact and absent from the layer', () => {
  const review = bundle.metrics.category_review.find((entry) => entry.id === "proactive_shift");
  assert.ok(review !== undefined, "the artifact should still carry the review");
  assert.equal(review.verdict, "not_supported");

  assert.ok(
    !EDITORIAL_CATEGORIES.some((category) => category.reviewId === "proactive_shift"),
    "an editorial panel maps to a not_supported review",
  );

  const files = [
    ...marketSources(),
    join(webRoot, "src", "content", "markets.ts"),
    join(webRoot, "src", "lib", "market-synthesis.ts"),
    join(webRoot, "app", "page.tsx"),
  ];
  for (const path of files) {
    const code = codeOf(path);
    assert.ok(
      !/proactive[ _]shift/i.test(code),
      `${path.slice(webRoot.length)} references the Proactive Shift`,
    );
  }
});

// ---------------------------------------------------------------------------
// No ranking, no score, no superlative
// ---------------------------------------------------------------------------

test("the guard rejects every prohibited phrase and accepts honest copy", () => {
  for (const phrase of PROHIBITED_MARKET_LANGUAGE) {
    assert.throws(
      () => assertNoRankingLanguage(`This is the ${phrase} of the five.`, "fixture"),
      /ranking language is undefined/,
      `"${phrase}" should be rejected`,
    );
  }
  assert.doesNotThrow(() =>
    assertNoRankingLanguage(
      "EV interest rose and peaked four weeks before the crude-price peak.",
      "fixture",
    ),
  );
});

test("no rendered synthesis string ranks, scores or crowns a market", () => {
  const rendered = [
    MARKET_SYNTHESIS_WORDING_NOTE,
    ...synthesis.markets.flatMap((market) => [
      market.label,
      market.directionLabel,
      market.evidenceGroupLabel,
      market.robustnessLabel,
      market.evidenceStatement,
      market.category.label,
      market.category.basis,
    ]),
    ...Object.values(EVIDENCE_GROUP_LABEL),
    ...Object.values(ROBUSTNESS_LABEL),
    ...Object.values(CAVEAT_LABEL).filter((label): label is string => label !== undefined),
  ];
  for (const text of rendered) {
    assertNoRankingLanguage(text, "synthesis content");
  }
});

test("the market layer computes no statistic and exposes no score", () => {
  const forbidden = [
    "Math.sqrt",
    "Math.pow",
    "Math.log",
    "Math.exp",
    "pearson",
    "spearman",
    "toFixed(",
    "toPrecision(",
    ".reduce(",
    "score",
    "rank",
    "weight",
    "mean_interest",
    "peak_value",
    // The PROPERTY, not the word. `series_local_scale` is a caveat CODE the content layer
    // must be able to label — "Scale is local to this market" is the sentence a reader
    // needs. What is forbidden is reading `profile.series_local`, which is where
    // `mean_interest` and `peak_value` live and where every cross-market ranking starts.
    "profile.series_local",
    ".series_local",
  ];
  const files = [
    ...marketSources(),
    join(webRoot, "src", "content", "markets.ts"),
    join(webRoot, "src", "lib", "market-synthesis.ts"),
  ];

  const violations: string[] = [];
  for (const path of files) {
    const code = codeOf(path);
    for (const needle of forbidden) {
      if (code.includes(needle)) violations.push(`${path.slice(webRoot.length)}: ${needle}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("the view model carries no numeric field a reader could rank markets by", () => {
  for (const market of synthesis.markets) {
    const numericKeys = Object.entries(market)
      .filter(([, value]) => typeof value === "number")
      .map(([key]) => key);
    // `peakLagWeeks` is the only number, and it is a position in time relative to one
    // shared event — not a magnitude of anything.
    assert.deepEqual(numericKeys, ["peakLagWeeks"], `${market.id} exposes ${numericKeys.join(", ")}`);
  }
});

test("no causal language appears in the synthesis copy", () => {
  const causal = [" caused", " causes", " drove ", " led to ", " triggered", " resulted in "];
  const sentences = synthesis.markets
    .flatMap((market) => [market.evidenceStatement, market.category.basis])
    .concat(MARKET_SYNTHESIS_WORDING_NOTE)
    .join(" ")
    .split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    const lowered = ` ${sentence.toLowerCase()} `;
    if (/\b(no|not|nothing|never|cannot|neither)\b/.test(lowered)) continue;
    for (const phrase of causal) {
      assert.ok(!lowered.includes(phrase), `causal phrase "${phrase.trim()}" in: ${sentence}`);
    }
  }
});

// ---------------------------------------------------------------------------
// The deep-dive selector and its anchors
// ---------------------------------------------------------------------------

test("tab and panel ids are derived, so aria-controls cannot drift", () => {
  for (const id of COUNTRY_IDS) {
    assert.equal(marketTabId(id), `market-${id}`);
    assert.equal(marketPanelId(id), `market-${id}-panel`);
    assert.notEqual(marketTabId(id), marketPanelId(id));
  }
});

test("a market hash selects that market, and anything else selects nothing", () => {
  assert.equal(countryFromHash("#market-us", COUNTRY_IDS), "us");
  assert.equal(countryFromHash("market-norway", COUNTRY_IDS), "norway");
  assert.equal(countryFromHash("#market-atlantis", COUNTRY_IDS), null);
  assert.equal(countryFromHash("#scope", COUNTRY_IDS), null);
  assert.equal(countryFromHash("", COUNTRY_IDS), null);
});

test("the deep dive renders from the view model, with no country in a conditional", () => {
  const code = codeOf(join(marketDir, "CountryDeepDive.tsx"));
  for (const id of COUNTRY_IDS) {
    assert.ok(
      !new RegExp(`["']${id}["']`).test(code),
      `CountryDeepDive branches on "${id}" instead of rendering from data`,
    );
  }
  for (const label of ["Indonesia", "Malaysia", "Norway", "Singapore", "United States"]) {
    assert.ok(!code.includes(label), `CountryDeepDive hard-codes "${label}"`);
  }
});

test("the deep dive renders the specification comparison and no coefficient", () => {
  const code = codeOf(join(marketDir, "CountryDeepDive.tsx"));
  assert.match(code, /levelsSignificant/);
  assert.match(code, /firstDifferencesSignificant/);
  assert.match(code, /linearDetrendedSignificant/);
  // §16: a coefficient may not appear without the specification comparison beside it, and
  // the component that can carry that pairing is `MetricCard`'s inferential variant. This
  // panel renders the comparison and leaves the numbers to the Robustness section.
  for (const pattern of [/\br\s*=/, /\bp\s*=/, /pearson/i, /spearman/i, /toFixed\(/]) {
    assert.ok(!pattern.test(code), `the deep dive renders a coefficient: ${String(pattern)}`);
  }
});

test("significance is not presented as good or bad news", () => {
  // Norway's detrended correlation is significant AND negative, so a green "holds" badge
  // would tell a reader the opposite of what the number says.
  const code = codeOf(join(marketDir, "CountryDeepDive.tsx"));
  assert.ok(!/tone=\{[^}]*positive/.test(code), "a specification badge is coloured positive");
  assert.match(code, /not significant/);
});

// ---------------------------------------------------------------------------
// The reading guide
// ---------------------------------------------------------------------------

test("the guide answers the seven questions the brief names", () => {
  assert.equal(HOW_TO_READ_ENTRIES.length, 7);
  const questions = HOW_TO_READ_ENTRIES.map((entry) => entry.question.toLowerCase()).join(" ");
  for (const topic of [
    "question",
    "data",
    "charts",
    "height",
    "cause",
    "specification",
    "different patterns",
  ]) {
    assert.ok(questions.includes(topic), `no entry covers "${topic}"`);
  }
});

test("guide ids are unique and derive their toggle and panel ids", () => {
  const ids = HOW_TO_READ_ENTRIES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.notEqual(readMoreToggleId(id), readMorePanelId(id));
    assert.match(readMorePanelId(id), /-detail$/);
  }
});

test("every answer is non-empty and every question is a question", () => {
  for (const entry of HOW_TO_READ_ENTRIES) {
    assert.ok(entry.answer.length > 0, `${entry.id} has no answer`);
    for (const paragraph of entry.answer) assert.ok(paragraph.trim().length > 40);
    assert.ok(entry.question.endsWith("?"), `${entry.id} is not phrased as a question`);
  }
});

test("draft copy is marked, and the marker is only used for draft copy", () => {
  const drafts = HOW_TO_READ_ENTRIES.filter((entry) => entry.status === "draft");
  assert.ok(drafts.length > 0, "nothing is marked draft — is the guide really finished?");
  const component = codeOf(join(webRoot, "src", "components", "content", "HowToRead.tsx"));
  assert.match(component, /status === "draft"/);
  assert.ok(component.includes("HOW_TO_READ_MARKER"));
  assert.match(HOW_TO_READ_MARKER, /awaiting final wording/i);
});

test("the guide states the constraints rather than hiding them behind its toggles", () => {
  // §6's hard rule is about the PAGE, not this component: the five must be visible
  // without interaction, and they are, in the section lead and beside the charts. What is
  // asserted here is that the guide's answers still contain the explanations, so a reader
  // who opens them finds the reasoning rather than a restatement.
  const answers = HOW_TO_READ_ENTRIES.flatMap((entry) => entry.answer).join(" ").toLowerCase();
  assert.ok(answers.includes("first differenc"), "no answer explains first differencing");
  assert.ok(answers.includes("own highest week equals 100"), "no answer explains normalisation");
  assert.ok(answers.includes("pump price"), "no answer distinguishes crude from pump price");
  assert.ok(answers.includes("causing") || answers.includes("cause"), "no answer addresses causation");
});

test("the guide's page lead states the four constraints without interaction", () => {
  const page = readFileSync(join(webRoot, "app", "page.tsx"), "utf8");
  const lead = page.slice(page.indexOf('title="How to Read This Analysis"'));
  const sentence = lead.slice(0, lead.indexOf("/>"));
  assert.match(sentence, /establishes no cause/);
  assert.match(sentence, /cannot be compared by height/);
  assert.match(sentence, /do not survive comparing week-to-week changes/);
});
