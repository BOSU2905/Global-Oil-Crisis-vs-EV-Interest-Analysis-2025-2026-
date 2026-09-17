/**
 * Content contract tests — Phase 3C step 4.
 *
 * WHY THESE ARE SOURCE-LEVEL RATHER THAN RENDERED
 * The same forced split as `layout-contract.test.ts`: Node cannot load `.tsx`
 * (`ERR_UNKNOWN_FILE_EXTENSION` — JSX is not TypeScript syntax), so rendering
 * assertions live in `e2e/content.e2e.ts` against the real production build, and
 * everything expressible in a `.ts` module is asserted here.
 *
 * The centre of this file is the §16 gate. `MetricCard` and `StatHighlight` are the
 * first components that render a statistic, and KIRO.md §16 forbids showing a level
 * correlation without the specification comparison beside it. That rule is encoded
 * in `MetricContent` as a discriminated union, so the compiler enforces it; the
 * tests below cover the runtime half, which is what catches an empty string
 * arriving from an artifact field.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  assertMetricDisplayable,
  BADGE_TONE_CLASS,
  CALLOUT_BADGE_TONE,
  CALLOUT_TONE_CLASS,
  MISSING_CAVEAT_MESSAGE,
  MISSING_SPECIFICATION_MESSAGE,
  READ_LESS_LABEL,
  READ_MORE_LABEL,
  readMorePanelId,
  readMoreToggleId,
  type BadgeTone,
  type CalloutTone,
  type InferentialMetric,
  type MetricContent,
} from "../src/components/content/contract.ts";

// `import.meta.dirname`, not a slice of `import.meta.url` at the last "/":
// `fileURLToPath` returns backslashes on Windows, so `lastIndexOf("/")` is -1 there
// and the slice resolves to a path inside `tests/` instead of `web/`.
const webRoot = join(import.meta.dirname, "..");
const contentDir = join(webRoot, "src", "components", "content");
const read = (...parts: string[]): string => readFileSync(join(webRoot, ...parts), "utf8");
const readContent = (file: string): string => readFileSync(join(contentDir, file), "utf8");

const pageSource = read("app", "page.tsx");

// ---------------------------------------------------------------------------
// The §16 gate
// ---------------------------------------------------------------------------

const validInferential: InferentialMetric = {
  kind: "inferential",
  label: "Worldwide level correlation",
  value: "0.727",
  specification: "first-difference -0.116 · detrended 0.527",
  caveats: [
    {
      code: "Not robust",
      detail: "Does not survive first differencing.",
    },
  ],
};

test("a well-formed inferential metric is displayable", () => {
  assert.doesNotThrow(() => assertMetricDisplayable(validInferential));
});

test("an inferential metric with a blank specification is rejected", () => {
  // The type cannot catch this: `specification` is present, just empty. A blank
  // string would render "Other specifications." followed by nothing, which is
  // exactly the unqualified coefficient §16 forbids.
  const blank: InferentialMetric = { ...validInferential, specification: "   " };
  assert.throws(() => assertMetricDisplayable(blank), {
    message: new RegExp(
      MISSING_SPECIFICATION_MESSAGE.replaceAll("(", "\\(").replaceAll(")", "\\)"),
    ),
  });
});

test("an inferential metric whose caveats are all blank codes is rejected", () => {
  const blank = {
    ...validInferential,
    caveats: [{ code: "  ", detail: "" }],
  } as InferentialMetric;
  assert.throws(() => assertMetricDisplayable(blank), {
    message: new RegExp(MISSING_CAVEAT_MESSAGE.replaceAll("(", "\\(").replaceAll(")", "\\)")),
  });
});

test("a descriptive metric needs no specification and no caveat", () => {
  // Coverage counts and dates are observations, not inferences. Requiring a caveat
  // on them would train readers to ignore caveats.
  const descriptive: MetricContent = {
    kind: "descriptive",
    label: "Weekly Observations",
    value: "31",
  };
  assert.doesNotThrow(() => assertMetricDisplayable(descriptive));
});

test("MetricCard renders the specification without a branch that can hide it", () => {
  const source = readContent("MetricCard.tsx");
  assert.match(source, /kind === "inferential"/, "the inferential branch should exist");
  assert.match(source, /Other specifications\./);
  // No prop may suppress it. If one is ever added, this fails.
  for (const escape of ["hideSpecification", "showSpecification", "withoutCaveats"]) {
    assert.ok(!source.includes(escape), `MetricCard must not offer ${escape}`);
  }
  assert.match(source, /assertMetricDisplayable\(metric\)/, "runtime gate must be called");
});

// ---------------------------------------------------------------------------
// Tones: semantic tokens only, and no meaning carried by colour alone
// ---------------------------------------------------------------------------

test("every badge tone maps to a distinct set of semantic-token utilities", () => {
  const tones: BadgeTone[] = ["neutral", "info", "warning", "caution", "positive"];
  assert.deepEqual(Object.keys(BADGE_TONE_CLASS).sort(), [...tones].sort());
  const values = Object.values(BADGE_TONE_CLASS);
  assert.equal(new Set(values).size, values.length, "two tones share a class list");
});

test("no tone reaches for a raw colour or a Tailwind palette class", () => {
  // globals.css removes Tailwind's default palette, so `bg-red-500` would silently
  // produce nothing. Asserting it here names the reason rather than leaving a
  // future developer to wonder why their colour did not apply.
  const all = [...Object.values(BADGE_TONE_CLASS), ...Object.values(CALLOUT_TONE_CLASS)];
  for (const classes of all) {
    assert.ok(!/#[0-9a-f]{3,8}/i.test(classes), `hex literal in "${classes}"`);
    assert.ok(
      !/\b(?:bg|text|border)-(?:red|blue|green|sky|amber|slate|gray|grey|zinc|neutral|stone)-\d{2,3}\b/.test(
        classes,
      ),
      `Tailwind palette class in "${classes}"`,
    );
  }
});

test("every callout tone has a badge tone, so surface and badge cannot disagree", () => {
  const tones: CalloutTone[] = ["info", "warning", "caution", "positive"];
  assert.deepEqual(Object.keys(CALLOUT_TONE_CLASS).sort(), [...tones].sort());
  assert.deepEqual(Object.keys(CALLOUT_BADGE_TONE).sort(), [...tones].sort());
  for (const tone of tones) {
    assert.ok(
      CALLOUT_BADGE_TONE[tone] in BADGE_TONE_CLASS,
      `callout tone ${tone} maps to a badge tone that does not exist`,
    );
  }
});

test("Badge always renders its children, so colour is never the only cue", () => {
  const source = readContent("Badge.tsx");
  assert.match(source, /\{children\}/, "Badge must render its text");
  assert.match(source, /tone = "neutral"/, "tone must default to neutral");
});

// ---------------------------------------------------------------------------
// ReadMore
// ---------------------------------------------------------------------------

test("the panel and toggle ids are derived from one id and cannot drift", () => {
  assert.equal(readMorePanelId("robustness"), "robustness-detail");
  assert.equal(readMoreToggleId("robustness"), "robustness-toggle");
  assert.notEqual(readMorePanelId("x"), readMoreToggleId("x"));
});

test("the toggle label changes with state, so the control is never icon-only", () => {
  assert.notEqual(READ_MORE_LABEL, READ_LESS_LABEL);
  assert.ok(READ_MORE_LABEL.trim().length > 0);
  assert.ok(READ_LESS_LABEL.trim().length > 0);
});

test("ReadMore wires aria-expanded and aria-controls to the derived ids", () => {
  const source = readContent("ReadMore.tsx");
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /aria-controls=\{panelId\}/);
  assert.match(source, /readMorePanelId\(id\)/);
  assert.match(source, /readMoreToggleId\(id\)/);
  // §6: Escape closes when open, and focus is never trapped.
  assert.match(source, /event\.key === "Escape"/);
  // §7 / accessibility contract: 44px minimum tap target.
  assert.match(source, /min-h-11/);
  assert.match(source, /"use client"/, "it holds state, so it must be a client component");
});

// ---------------------------------------------------------------------------
// Design-system rules that a component could quietly break
// ---------------------------------------------------------------------------

test("Card does not float", () => {
  // design-system.md §1 and §4: elevation is border + background delta. Shadow is
  // for overlays only, and `globals.css` deliberately generates no card shadow.
  const source = readContent("Card.tsx");
  assert.match(source, /shadow-none/);
  assert.ok(!/shadow-overlay/.test(source), "a card must never use the overlay shadow");
  assert.match(source, /p-\(--card-padding\)/, "padding must come from the responsive token");
  assert.match(source, /rounded-lg/);
});

test("no content component invents a width or a radius above xl", () => {
  for (const file of readdirSync(contentDir)) {
    const source = readContent(file);
    assert.ok(!/rounded-(?:2xl|3xl|4xl)/.test(source), `${file} exceeds the radius cap`);
    assert.ok(
      !/max-w-\[/.test(source),
      `${file} hard-codes a width instead of using a variant`,
    );
  }
});

test("SourceNote reads every field from the manifest and hard-codes no URL", () => {
  const source = readContent("SourceNote.tsx");
  assert.ok(!/https?:\/\//.test(source), "SourceNote must not contain a URL");
  assert.match(source, /source\.url/);
  assert.match(source, /rel="noreferrer noopener"/);
});

test("Footer composes SourceNote instead of keeping its own copy of the list", () => {
  // Step 4 moved the list out. If it grows back, the two will drift.
  const footer = read("src", "components", "layout", "Footer.tsx");
  assert.match(footer, /<SourceNote/);
  assert.ok(!footer.includes("source.url"), "Footer should no longer render sources itself");
});

// ---------------------------------------------------------------------------
// Analytical safety, extended to the content layer
// ---------------------------------------------------------------------------

test("no statistic is computed by the content components", () => {
  // The rule analytical-safety.test.ts enforces for src/data and
  // layout-contract.test.ts enforces for the layout components, now applied to the
  // components that actually render statistics — which is where it matters most.
  const forbidden = [
    "Math.sqrt",
    "Math.pow",
    "Math.log",
    "Math.exp",
    "Math.hypot",
    "pearson",
    "spearman",
    "computePearson",
    "correlate(",
    "confidenceInterval(",
    "linearRegression",
    "toFixed(",
    "toPrecision(",
  ];

  const violations: string[] = [];
  for (const file of readdirSync(contentDir)) {
    const code = readContent(file)
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

test("MetricCard takes its value as a string, so it cannot round a statistic", () => {
  // `toFixed` on a coefficient is a presentational decision that belongs in the
  // pipeline or an accessor. Typing the value as a string removes the temptation
  // and makes arithmetic on the way to the screen impossible.
  const contract = readContent("contract.ts");
  assert.match(contract, /readonly value: string/);
  assert.match(contract, /readonly interval\?: string/);
});

// ---------------------------------------------------------------------------
// The page still shows no inferential statistic
// ---------------------------------------------------------------------------

test("every metric the foundation page renders is descriptive", () => {
  // Steps 6–7 introduce the sections that can carry a specification comparison.
  // Until then a coefficient on this page would have nowhere to be qualified,
  // which is the original project's error.
  assert.ok(
    !pageSource.includes('kind: "inferential"'),
    "the foundation page must not render an inferential metric yet",
  );
  assert.match(pageSource, /kind: "descriptive"/);
});

test("the comparability guardrail is a Callout and is not inside a ReadMore", () => {
  // §6 hard rule: cross-market non-comparability must be visible without
  // interaction. It is the guardrail the original project broke.
  assert.match(pageSource, /<Callout/);
  assert.match(pageSource, /comparability\.explanation/);
  const calloutStart = pageSource.indexOf("<Callout");
  const readMoreStart = pageSource.indexOf("<ReadMore");
  assert.ok(readMoreStart !== -1, "the page should exercise ReadMore somewhere");
  assert.ok(
    readMoreStart < calloutStart,
    "the ReadMore must not wrap the comparability Callout",
  );
});
