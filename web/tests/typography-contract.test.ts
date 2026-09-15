/**
 * Typography and frame contract tests — Phase 3C visual refinement pass.
 *
 * WHY THESE EXIST
 * Two decisions made in this pass are the kind that rot silently, because nothing
 * in `tsc`, `eslint` or `next build` can see them and a browser only shows the
 * symptom on one operating system:
 *
 *   1. NO TYPE ROLE MAY REQUEST FONT-WEIGHT 500. It is not a distinct face in the
 *      system stacks this product uses — measured on Windows/Segoe UI, 500 and 600
 *      render to an identical pixel digest and an identical 707.06px advance, while
 *      a Linux face shipping only 400/700 renders 500 as 400. A role set to 500
 *      therefore reads as emphasised on one machine and as body text on another.
 *      The symptom is invisible to the author of the change, which is exactly why
 *      it needs a test rather than a review habit.
 *
 *   2. THE SHELL AND THE PAGE BODY SHARE ONE FRAME. Two centred containers of
 *      different widths have no alignment spine: with the header at 1440px and the
 *      body at 1120px, the body's content sat 160px inside the header's at 1440px
 *      and above. Nothing failed — it just looked like a narrow column floating in
 *      a wider one.
 *
 * These are source-level assertions for the same reason `layout-contract.test.ts`
 * is: Node cannot load `.tsx` (`ERR_UNKNOWN_FILE_EXTENSION`), so what is checkable
 * here is the declaration, and the rendered consequence is checked in Playwright.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `import.meta.dirname`, not a slice of `import.meta.url`: `fileURLToPath` returns
// backslashes on Windows, so `lastIndexOf("/")` is -1 and the slice resolves one
// directory too deep.
const webRoot = join(import.meta.dirname, "..");
const read = (...parts: string[]): string => readFileSync(join(webRoot, ...parts), "utf8");

const tokensCss = read("src", "styles", "tokens.css");
const globalsCss = read("app", "globals.css");
const sectionHeader = read("src", "components", "layout", "SectionHeader.tsx");

/** Strip CSS comments, so a rule quoted in prose is never mistaken for a decl. */
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

const tokens = withoutComments(tokensCss);

// ---------------------------------------------------------------------------
// Weight 500 is not a face the OS reliably supplies
// ---------------------------------------------------------------------------

test("no type role resolves to --weight-medium", () => {
  // Matches `--text-<role>-weight: <value>;` declarations only.
  const roles = [...tokens.matchAll(/--text-([a-z0-9-]+)-weight:\s*([^;]+);/g)].map(
    (match) => ({
      role: match[1] ?? "",
      value: (match[2] ?? "").trim(),
    }),
  );

  assert.ok(roles.length > 0, "no --text-*-weight roles found — did the token names change?");

  const offenders = roles.filter((entry) => entry.value.includes("--weight-medium"));
  assert.deepEqual(
    offenders,
    [],
    "a type role requests weight 500, which is not a distinct face on Segoe UI " +
      "and collapses to 400 on a Linux face shipping only 400/700",
  );
});

test("no component asks Tailwind for font-weight 500 either", () => {
  // `font-medium` is the utility form of the same mistake, and it bypasses the
  // token check above entirely.
  const components = [
    ["layout", "AppShell.tsx"],
    ["layout", "Container.tsx"],
    ["layout", "Footer.tsx"],
    ["layout", "Header.tsx"],
    ["layout", "Navigation.tsx"],
    ["layout", "Section.tsx"],
    ["layout", "SectionHeader.tsx"],
    ["content", "Badge.tsx"],
    ["content", "Callout.tsx"],
    ["content", "Card.tsx"],
    ["content", "MetricCard.tsx"],
    ["content", "ReadMore.tsx"],
    ["content", "SourceNote.tsx"],
    ["content", "StatHighlight.tsx"],
  ] as const;

  const offenders: string[] = [];
  for (const [group, file] of components) {
    const source = read("src", "components", group, file);
    // Class lists only: the rule is about what is rendered, not what a comment says.
    const code = source
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*")
        );
      })
      .join("\n");
    if (/\bfont-medium\b/.test(code)) offenders.push(`${group}/${file}`);
  }

  assert.deepEqual(offenders, [], "font-medium is weight 500 — use font-semibold");
});

test("the weight scale still documents why medium is unused", () => {
  // The token is retained as a scale value. If someone deletes the rationale, the
  // next person will reasonably assume it is free to use.
  assert.match(tokensCss, /--weight-medium/);
  assert.match(
    tokensCss,
    /500 and 600 IDENTICALLY/,
    "the measured reason no role uses weight 500 is no longer recorded in tokens.css",
  );
});

// ---------------------------------------------------------------------------
// One frame, shared by the shell and the page body
// ---------------------------------------------------------------------------

test("the shell and the page body request the same container width", () => {
  const frames = {
    "Header.tsx": read("src", "components", "layout", "Header.tsx"),
    "Footer.tsx": read("src", "components", "layout", "Footer.tsx"),
    "page.tsx": read("app", "page.tsx"),
  };

  for (const [file, source] of Object.entries(frames)) {
    assert.match(
      source,
      /width="page"/,
      `${file} must use the shared frame — a second centred width has no alignment spine`,
    );
    assert.ok(
      !/width="content"/.test(source),
      `${file} nests a narrower centred container inside the frame, which insets its ` +
        `content from the header's left edge`,
    );
  }
});

test("the frame is banded at the documented 2xl breakpoint, not at a new one", () => {
  assert.match(tokens, /--width-page:\s*1120px/, "--width-page base value changed");

  assert.match(
    tokens,
    /@media\s*\(min-width:\s*1536px\)\s*\{\s*:root\s*\{[^}]*--width-page:\s*1280px/,
    "the frame does not grow to --width-chart at 1536px",
  );

  // 1536px is `--breakpoint-2xl`. A hand-picked boundary here would be a sixth
  // breakpoint that no other part of the system knows about.
  assert.match(tokens, /--breakpoint-2xl:\s*1536px/);
});

test("the frame never exceeds the widest thing it can contain", () => {
  // `--width-chart` is the widest a chart may be. A frame narrower than that at
  // some viewport is fine (the chart is capped by the frame); a frame WIDER than
  // it would be dead space no content variant can ever fill.
  const chart = /--width-chart:\s*(\d+)px/.exec(tokens)?.[1];
  const pageBase = /--width-page:\s*(\d+)px/.exec(tokens)?.[1];
  const pageBanded = /min-width:\s*1536px\)\s*\{\s*:root\s*\{\s*--width-page:\s*(\d+)px/.exec(
    tokens,
  )?.[1];

  assert.ok(chart !== undefined && pageBase !== undefined && pageBanded !== undefined);
  assert.ok(Number(pageBase) <= Number(chart), "the base frame is wider than --width-chart");
  assert.ok(
    Number(pageBanded) <= Number(chart),
    "the banded frame is wider than --width-chart",
  );
});

// ---------------------------------------------------------------------------
// Display type does not borrow the prose measure
// ---------------------------------------------------------------------------

test("the title measure exists, is character-based, and is mapped to a utility", () => {
  assert.match(tokens, /--width-title:\s*\d+ch/, "--width-title must be in ch");
  // `ch` resolves against the element's own font size, which is the whole reason
  // this token can track the fluid display scale with no breakpoint logic.
  assert.match(withoutComments(globalsCss), /--container-title:\s*var\(--width-title\)/);
});

test("the reading measure stays purely character-based", () => {
  assert.match(tokens, /--width-reading:\s*68ch\s*;/, "--width-reading must be exactly 68ch");
  // A `min(68ch, <rem>)` ceiling was tried and rejected: `ch` scales with the
  // element's font size and `rem` does not, so one ceiling binds on the 19px lead
  // and is inert on 16px body copy — the token would mean different things per role.
  assert.ok(
    !/--width-reading:\s*min\(/.test(tokens),
    "--width-reading has a px/rem ceiling again; it resolves differently per role",
  );
});

test("SectionHeader applies each measure to the element that owns the role", () => {
  // The wrapper must NOT carry a measure: a wrapper capped at the prose measure
  // clamps the heading inside it, which is what confined a 60px display heading to
  // 586px and broke the h1 mid-phrase.
  assert.match(
    sectionHeader,
    /<Heading[^>]*max-w-title/s,
    "the heading does not carry max-w-title",
  );
  assert.match(
    sectionHeader,
    /max-w-reading text-lead/,
    "the lead does not carry max-w-reading",
  );
  assert.ok(
    !/const classes = \["max-w-reading"\]/.test(sectionHeader),
    "the SectionHeader wrapper caps its children at the prose measure again",
  );
});

test("headings wrap by balance rather than greedily", () => {
  // With an OS-supplied typeface the same heading occupies a different number of
  // pixels per machine, so a greedy break lands somewhere different on each one.
  assert.match(withoutComments(globalsCss), /text-wrap:\s*balance/);
});
