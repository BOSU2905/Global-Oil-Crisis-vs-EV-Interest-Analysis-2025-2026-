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
