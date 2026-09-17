/**
 * Layout contract tests — Phase 3C step 3.
 *
 * WHY THESE ARE SOURCE-LEVEL RATHER THAN RENDERED
 * Node 22's type stripping cannot load `.tsx`: importing one under `node --test`
 * fails with `ERR_UNKNOWN_FILE_EXTENSION`, because JSX is not TypeScript syntax
 * and the runtime has no transform for it. Rendering assertions therefore live in
 * the Playwright suite, which runs the real production build in a real browser —
 * a better place for them anyway. Adding a JSX transform to the unit-test
 * toolchain to render six presentational components would be dependency weight
 * without a payoff.
 *
 * What IS checkable here is the part that fails silently: whether the width
 * variants match the design system, and whether every navigation link points at a
 * section the page actually renders. A broken anchor is invisible in a build and
 * in a type check.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONTAINER_MAX_WIDTH,
  sectionOrdinal,
  sectionTitleId,
  type ContainerWidth,
} from "../src/components/layout/contract.ts";
import { SHELL_SECTIONS } from "../src/content/sections.ts";

// `import.meta.dirname`, not a slice of `import.meta.url` at the last "/":
// `fileURLToPath` returns backslashes on Windows, so `lastIndexOf("/")` is -1 there
// and the slice resolves to a path inside `tests/` instead of `web/`.
const webRoot = join(import.meta.dirname, "..");
const read = (...parts: string[]): string => readFileSync(join(webRoot, ...parts), "utf8");

const pageSource = read("app", "page.tsx");
const tokensCss = read("src", "styles", "tokens.css");

// ---------------------------------------------------------------------------
// Width variants
// ---------------------------------------------------------------------------

test("the five documented container widths are all present and distinct", () => {
  const expected: ContainerWidth[] = ["page", "chart", "content", "reading", "narrow"];
  assert.deepEqual(Object.keys(CONTAINER_MAX_WIDTH).sort(), [...expected].sort());
  const utilities = Object.values(CONTAINER_MAX_WIDTH);
  assert.equal(new Set(utilities).size, utilities.length, "two variants share a utility");
});

test("every container width resolves to a width token defined in tokens.css", () => {
  // `max-w-reading` exists because globals.css maps --width-reading onto
  // --container-reading. If the token were missing the utility would silently
  // produce no max-width at all.
  const missing = Object.keys(CONTAINER_MAX_WIDTH).filter(
    (variant) => !tokensCss.includes(`--width-${variant}:`),
  );
  assert.deepEqual(missing, []);
});

// ---------------------------------------------------------------------------
// Section identity helpers
// ---------------------------------------------------------------------------

test("section heading ids are derived, not hand-written", () => {
  assert.equal(sectionTitleId("scope"), "scope-title");
  assert.equal(sectionTitleId("comparability"), "comparability-title");
});

test("section ordinals are two digits", () => {
  assert.equal(sectionOrdinal(1), "01");
  assert.equal(sectionOrdinal(9), "09");
  assert.equal(sectionOrdinal(10), "10");
});

// ---------------------------------------------------------------------------
// Navigation cannot point at a section that does not exist
// ---------------------------------------------------------------------------

test("the section registry is non-empty and internally consistent", () => {
  assert.ok(SHELL_SECTIONS.length > 0);
  const ids = SHELL_SECTIONS.map((section) => section.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate section id");
  for (const section of SHELL_SECTIONS) {
    assert.match(section.id, /^[a-z][a-z0-9-]*$/, `${section.id} is not a usable anchor id`);
    assert.ok(section.navLabel.length > 0, `${section.id} has no nav label`);
  }
});

test("every navigation target is rendered as a Section on the page", () => {
  const missing = SHELL_SECTIONS.filter(
    (section) => !pageSource.includes(`<Section id="${section.id}"`),
  ).map((section) => section.id);
  assert.deepEqual(missing, [], "navigation would scroll to a non-existent anchor");
});

test("every Section on the page is reachable from the navigation", () => {
  const rendered = [...pageSource.matchAll(/<Section id="([a-z0-9-]+)"/g)].map(
    (match) => match[1],
  );
  const registered = new Set(SHELL_SECTIONS.map((section) => section.id));
  const unreachable = rendered.filter((id) => id === undefined || !registered.has(id));
  assert.deepEqual(unreachable, [], "a section exists that no navigation link reaches");
});

// ---------------------------------------------------------------------------
// Editorial titles are Title Case, and the case lives in the string
// ---------------------------------------------------------------------------

/**
 * Words that stay lowercase inside a title unless they lead it.
 *
 * Chicago-style rather than AP: articles, coordinating conjunctions and
 * prepositions of ANY length are lowercase. "vs" is here because Chicago lowercases
 * versus, and the hero renders it that way deliberately.
 */
const LOWERCASE_IN_TITLE = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "v",
  "vs",
  "with",
]);

/**
 * Is this token capitalised acceptably for an editorial title?
 *
 * Deliberately permissive about what "capitalised" means, because the alternative
 * is a test that fights the content. `EV`, `US`, `Cross-Market` and `2025–2026` are
 * all correct and none of them is plain `Xxxxx`. The rule enforced is narrow and is
 * the one that actually drifts: **a principal word must not start lowercase.**
 */
const startsCapitalised = (token: string): boolean => {
  // Hyphenated compounds: every significant element is capitalised, so check each.
  if (token.includes("-")) {
    return token
      .split("-")
      .filter((part) => part.length > 0)
      .every((part) => startsCapitalised(part) || LOWERCASE_IN_TITLE.has(part.toLowerCase()));
  }
  const first = token.replace(/^[^\p{L}\p{N}]+/u, "").charAt(0);
  // A token that is entirely punctuation or a numeral carries no case to check.
  if (first === "" || /\p{N}/u.test(first)) return true;
  return first === first.toUpperCase();
};

/** Offending tokens in a title, or an empty array. */
const titleCaseOffenders = (title: string): string[] => {
  const tokens = title.split(/\s+/).filter((token) => token.length > 0);
  return tokens.filter((token, index) => {
    const bare = token.replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase();
    // First and last words are always capitalised, even a preposition.
    const isEdge = index === 0 || index === tokens.length - 1;
    if (!isEdge && LOWERCASE_IN_TITLE.has(bare)) return false;
    return !startsCapitalised(token);
  });
};

test("the title-case helper accepts the product's real titles and rejects drift", () => {
  // The helper is the thing the next two tests trust, so it is checked first
  // against strings whose correctness is not in question.
  for (const good of [
    "Observation Scope",
    "Comparability Constraint",
    "Narrative Structure",
    "Cross-Market Comparison",
    "Global Oil Crisis vs EV Interest Analysis",
    "Oil Prices vs EV Interest",
    "Country Deep Dives",
    "EV Interest",
    "Sources",
    "Robustness",
  ]) {
    assert.deepEqual(titleCaseOffenders(good), [], `rejected a correct title: "${good}"`);
  }

  for (const [bad, expected] of [
    ["Observation scope", ["scope"]],
    ["Narrative structure", ["structure"]],
    ["Cross-market comparison", ["Cross-market", "comparison"]],
    // A trailing preposition is still capitalised.
    ["Data to Look at", ["at"]],
  ] as const) {
    assert.deepEqual(titleCaseOffenders(bad), [...expected], `accepted a sentence-case title`);
  }
});

test("every SectionHeader eyebrow and title on the page is Title Case", () => {
  // The eyebrow renders uppercase, so its source casing is invisible and would
  // drift unnoticed — but CSS `text-transform` does not change the accessible name,
  // so it is what a screen reader announces. Both props are checked.
  //
  // This exists because steps 6-7 add ten more section headers. Case fixed in the
  // content string cannot be enforced by `tsc` or by the browser, and a runtime
  // title-caser would have to guess at "vs", "EV" and every future proper noun.
  const props = [...pageSource.matchAll(/\b(eyebrow|title)="([^"]+)"/g)].map((match) => ({
    prop: match[1] ?? "",
    value: match[2] ?? "",
  }));

  assert.ok(props.length > 0, "no eyebrow/title props found — did the page structure change?");

  const violations = props
    .map((entry) => ({ ...entry, offenders: titleCaseOffenders(entry.value) }))
    .filter((entry) => entry.offenders.length > 0)
    .map((entry) => `${entry.prop}="${entry.value}" → ${entry.offenders.join(", ")}`);

  assert.deepEqual(
    violations,
    [],
    "an editorial title is not Title Case. Fix the content string, not with a runtime transform",
  );
});

test("metric-card labels are Title Case, and leads are left alone", () => {
  // A metric label is the card's title, so it follows the heading convention. A
  // `lead` is prose and must NOT be title-cased — asserting that keeps a future
  // over-correction from turning the section thesis into a headline.
  const labels = [...pageSource.matchAll(/\blabel:\s*"([^"]+)"/g)].map((m) => m[1] ?? "");
  assert.ok(labels.length > 0, "no metric labels found");

  const violations = labels
    .map((label) => ({ label, offenders: titleCaseOffenders(label) }))
    .filter((entry) => entry.offenders.length > 0)
    .map((entry) => `label: "${entry.label}" → ${entry.offenders.join(", ")}`);
  assert.deepEqual(violations, [], "a metric-card label is not Title Case");

  const leads = [...pageSource.matchAll(/\blead="([^"]+)"/g)].map((m) => m[1] ?? "");
  for (const lead of leads) {
    assert.ok(
      titleCaseOffenders(lead).length > 0,
      `a lead reads as Title Case: "${lead.slice(0, 48)}…". Leads are sentence-case prose`,
    );
  }
});

// ---------------------------------------------------------------------------
// The anchor offset depends on a token, not a magic number
// ---------------------------------------------------------------------------

test("the header height token exists at both breakpoint values", () => {
  assert.ok(tokensCss.includes("--header-height:"), "--header-height is not defined");
  assert.ok(
    tokensCss.includes("--header-height-narrow:"),
    "--header-height-narrow is not defined",
  );
});

test("Section offsets its anchor by the header height token", () => {
  // A literal pixel value here would drift the moment the header's padding
  // changed, and the symptom would be a heading hidden under the sticky header.
  const sectionSource = read("src", "components", "layout", "Section.tsx");
  assert.match(sectionSource, /scroll-mt-\(--header-height\)/);
});

// ---------------------------------------------------------------------------
// The shell must not grow back into the layout file
// ---------------------------------------------------------------------------

test("app/layout.tsx delegates the shell instead of inlining it", () => {
  const layout = read("app", "layout.tsx");
  assert.match(layout, /<AppShell>/, "layout should render AppShell");
  for (const inlined of ["<header", "<footer", "Skip to content"]) {
    assert.ok(
      !layout.includes(inlined),
      `layout.tsx still inlines ${inlined} — step 3 extracted it into the shell`,
    );
  }
});

test("no statistic is rendered by the layout components", () => {
  // The same rule analytical-safety.test.ts enforces for src/data, applied to the
  // component layer: presentation reads artifact values, it never derives one.
  const forbidden = [
    "Math.sqrt",
    "Math.pow",
    "Math.log",
    "Math.exp",
    "Math.hypot",
    "pearson",
    "computePearson",
    "correlate(",
    "confidenceInterval(",
    "linearRegression",
  ];
  const files = [
    "AppShell.tsx",
    "Container.tsx",
    "Footer.tsx",
    "Header.tsx",
    "Navigation.tsx",
    "Section.tsx",
    "SectionHeader.tsx",
    "contract.ts",
  ];
  const violations: string[] = [];
  for (const file of files) {
    const source = read("src", "components", "layout", file);
    const code = source
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*")
        );
      })
      .join("\n");
    for (const needle of forbidden) {
      if (code.includes(needle)) violations.push(`${file}: ${needle}`);
    }
  }
  assert.deepEqual(violations, []);
});
