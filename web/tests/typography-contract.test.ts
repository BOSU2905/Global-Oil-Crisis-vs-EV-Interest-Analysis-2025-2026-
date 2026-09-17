/**
 * Typography and frame contract tests.
 *
 * WHY THESE EXIST
 * Three decisions here are the kind that rot silently, because nothing in `tsc`,
 * `eslint` or `next build` can see them:
 *
 *   1. THE TYPEFACE IS A DEPENDENCY, NOT AN ENVIRONMENT. Geist Sans and Geist Mono
 *      arrive through the `geist` npm package, are self-hosted out of the build, and
 *      are named in exactly one place. A stray `next/font/google` import, a
 *      committed `.woff2`, or a component naming a family would each quietly
 *      reintroduce a dependency on the viewing machine or on a third-party origin.
 *
 *   2. EVERY TYPE ROLE'S WEIGHT MUST BE A DECLARED STEP ON THE SCALE. This replaces
 *      the previous rule that no role may use 500. That rule was measured and
 *      correct while the typeface was OS-supplied — 500 was pixel-identical to 600
 *      on Segoe UI and collapsed to 400 on a 400/700-only face — but its premise was
 *      that the platform owned the face. A bundled variable font with a `100 900`
 *      axis interpolates every step itself, so the failure mode it guarded against
 *      cannot occur. What CAN still occur is a role reaching for a raw number or an
 *      undeclared weight, so that is what is now forbidden, and `e2e/typography.e2e.ts`
 *      proves each declared step renders as a genuinely distinct face.
 *
 *   3. THE SHELL AND THE PAGE BODY SHARE ONE FRAME. Two centred containers of
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
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// `import.meta.dirname`, not a slice of `import.meta.url`: `fileURLToPath` returns
// backslashes on Windows, so `lastIndexOf("/")` is -1 and the slice resolves one
// directory too deep.
const webRoot = join(import.meta.dirname, "..");
const read = (...parts: string[]): string => readFileSync(join(webRoot, ...parts), "utf8");

const tokensCss = read("src", "styles", "tokens.css");
const globalsCss = read("app", "globals.css");
const layoutTsx = read("app", "layout.tsx");
const packageJson = JSON.parse(read("package.json")) as {
  dependencies: Record<string, string>;
};
const sectionHeader = read("src", "components", "layout", "SectionHeader.tsx");

/** Strip CSS comments, so a rule quoted in prose is never mistaken for a decl. */
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

const tokens = withoutComments(tokensCss);
const globals = withoutComments(globalsCss);

/** Every component that renders type. Kept explicit so a new one must be listed. */
const COMPONENTS = [
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

/** Component source with comment lines removed: the rule is about what renders. */
const componentCode = (group: string, file: string): string =>
  read("src", "components", group, file)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

// ---------------------------------------------------------------------------
// The typeface ships with the application
// ---------------------------------------------------------------------------

test("geist is an exact-pinned runtime dependency", () => {
  const version = packageJson.dependencies["geist"];
  assert.ok(version !== undefined, "geist must be a runtime dependency, not a devDependency");
  assert.match(
    version,
    /^\d+\.\d+\.\d+$/,
    `geist must be exact-pinned (no ^ or ~); found "${version}"`,
  );
});

test("both Geist faces are loaded once, in the root layout", () => {
  assert.match(layoutTsx, /from "geist\/font\/sans"/, "GeistSans is not imported");
  assert.match(layoutTsx, /from "geist\/font\/mono"/, "GeistMono is not imported");

  // On <html>, not <body>: <html> IS `:root`, which is where tokens.css declares
  // the font tokens. A custom property set on <body> is invisible to a `var()` in a
  // `:root` rule, so the tokens would silently take their fallback chain.
  assert.match(
    layoutTsx,
    /<html[^>]*className=\{`\$\{GeistSans\.variable\} \$\{GeistMono\.variable\}`\}/,
    "the Geist font variables must be applied to <html>, which is :root",
  );
});

test("no font is fetched from a third party and none is committed here", () => {
  // Comment-stripped: this file's own prose explains that Google Fonts is not used
  // and that `@font-face` now comes from the package, so scanning the raw text would
  // match its own documentation.
  for (const css of [tokens, globals]) {
    assert.ok(
      !/fonts\.(googleapis|gstatic)\.com/.test(css),
      "a stylesheet references Google Fonts",
    );
    assert.ok(!/@import\s+url\(/.test(css), "a stylesheet imports a remote URL");
    // `@font-face` is emitted by next/font from the package. Hand-writing one here
    // would mean a font file had to live somewhere in this repository.
    assert.ok(!/@font-face/.test(css), "a stylesheet declares @font-face by hand");
  }

  assert.ok(
    !/next\/font\/google/.test(layoutTsx),
    "the layout imports next/font/google — the typeface must come from the package",
  );

  // Walk the source tree. A font binary anywhere here is the thing the decision
  // forbids: the package owns the files, so the repository never needs a copy.
  const skip = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report"]);
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(woff2?|ttf|otf|eot)$/i.test(entry))
        offenders.push(full.slice(webRoot.length));
    }
  };
  walk(webRoot);
  assert.deepEqual(
    offenders,
    [],
    "a font binary is committed in web/ — the package supplies it",
  );
});

test("exactly one place names a font family", () => {
  // The tokens are the single declaration site. A component naming `GeistSans`, or
  // reaching for the package's raw `--font-geist-*` variable, bypasses the roles.
  const offenders: string[] = [];
  for (const [group, file] of COMPONENTS) {
    const code = componentCode(group, file);
    if (/Geist|font-geist|font-family/i.test(code)) offenders.push(`${group}/${file}`);
  }
  assert.deepEqual(
    offenders,
    [],
    "a component names a typeface directly — use a semantic role or `.numeric` / `.tabular`",
  );

  assert.match(tokens, /--font-display:\s*var\(--font-geist-sans/);
  assert.match(tokens, /--font-sans:\s*var\(--font-display\)/);
  assert.match(tokens, /--font-mono:\s*\n?\s*var\(\s*\n?\s*--font-geist-mono/);
  assert.match(tokens, /--font-numeric:\s*var\(--font-mono\)/);
});

test("the sans chain terminates in a generic family", () => {
  // Measured, not assumed: the package's `--font-geist-sans` is only
  // `"GeistSans", "GeistSans Fallback"`, and that metric fallback is Arial-based, so
  // it reports `status: "error"` on a machine without Arial. Without an explicit tail
  // the chain runs out and the page takes the UA default.
  const declaration = /--font-display:([^;]+);/.exec(tokens)?.[1] ?? "";
  assert.ok(declaration !== "", "--font-display not found");
  assert.match(
    declaration,
    /sans-serif\s*$/,
    "--font-display must end in `sans-serif`; the geist package's own chain does not",
  );

  const mono = /--font-mono:([^;]+);/.exec(tokens)?.[1] ?? "";
  assert.match(mono, /monospace\s*\)?\s*$/, "--font-mono must end in `monospace`");
});

// ---------------------------------------------------------------------------
// Every role weight is a declared step on the scale
// ---------------------------------------------------------------------------

test("the weight scale declares exactly the four steps the roles may use", () => {
  const steps = [...tokens.matchAll(/--weight-([a-z]+):\s*(\d+);/g)].map((m) => ({
    name: m[1] ?? "",
    value: Number(m[2]),
  }));

  assert.deepEqual(
    steps,
    [
      { name: "regular", value: 400 },
      { name: "medium", value: 500 },
      { name: "semibold", value: 600 },
      { name: "bold", value: 700 },
    ],
    "the weight scale changed — every role's weight is decided against these steps",
  );
});

test("no type role uses a raw number or an undeclared weight", () => {
  const declared = new Set(
    [...tokens.matchAll(/--weight-([a-z]+):\s*\d+;/g)].map((m) => `--weight-${m[1] ?? ""}`),
  );

  const roles = [...tokens.matchAll(/--text-([a-z0-9-]+)-weight:\s*([^;]+);/g)].map(
    (match) => ({
      role: match[1] ?? "",
      value: (match[2] ?? "").trim(),
    }),
  );

  assert.ok(roles.length > 0, "no --text-*-weight roles found — did the token names change?");

  const offenders = roles.filter((entry) => {
    const token = /var\((--weight-[a-z]+)\)/.exec(entry.value)?.[1];
    return token === undefined || !declared.has(token);
  });

  assert.deepEqual(
    offenders,
    [],
    "a type role declares a weight that is not a step on the scale. A raw number " +
      "cannot be retuned in one place, and an undeclared token resolves to nothing",
  );
});

test("every role that renders on the page declares its own weight", () => {
  // A role without a weight inherits the body's, which is a hierarchy that happened
  // rather than one that was decided. `data` is exempt: it is a chart-tick role and
  // the chart layer sets weight through `--chart-*` tokens.
  const sized = [...tokens.matchAll(/--text-([a-z0-9-]+)-size:/g)].map((m) => m[1] ?? "");
  const weighted = new Set(
    [...tokens.matchAll(/--text-([a-z0-9-]+)-weight:/g)].map((m) => m[1] ?? ""),
  );

  const missing = sized.filter((role) => role !== "data" && !weighted.has(role));
  assert.deepEqual(missing, [], "these roles have a size but no weight, so they inherit one");
});

test("the mapping is documented against measured ink coverage, not asserted", () => {
  // The weights were chosen from the share of each string's bounding box that is ink
  // at the role's own size, because that is what "looks bold" means and a weight
  // number does not carry it. If the table goes, the next person has only opinion.
  assert.match(
    tokensCss,
    /THE MAPPING IS AUDITED, NOT INHERITED/,
    "the audited-mapping rationale is gone from tokens.css",
  );
  assert.match(
    tokensCss,
    /display\s+60px\s+23\.72%\s+28\.27%\s+31\.73%\s+34\.71%/,
    "the measured ink-coverage table is no longer recorded in tokens.css",
  );
  assert.match(
    tokensCss,
    /THE LARGER THE TYPE, THE LIGHTER THE WEIGHT IT NEEDS/,
    "the reason `display` is lighter than `h2` is no longer recorded, so it reads as a bug",
  );
});

test("the retired weight-500 rule is recorded as retired, with its premise", () => {
  // Deleting it silently would invite someone to reinstate it from the git history,
  // or to assume 500 is unsafe here. It is unsafe with an OS-supplied face and safe
  // with a bundled variable one, and the distinction is the whole point.
  assert.match(
    tokensCss,
    /707\.06px advance/,
    "the Segoe UI measurement that justified the old no-500 rule is gone",
  );
  assert.match(
    tokensCss,
    /is therefore RETIRED/,
    "tokens.css no longer explains that the no-500 rule was retired and why",
  );
});

// ---------------------------------------------------------------------------
// Two figure treatments: human-facing figures and technical identifiers
// ---------------------------------------------------------------------------

test("both figure utilities carry tabular figures; only one sets a family", () => {
  // design-system §3: tabular figures are non-negotiable. Measured on this build,
  // Geist Sans's figures are genuinely proportional — "111111" is 80px against
  // "000000" at 162px at 400/40px — so `tabular-nums` is load-bearing, not decorative.
  const tabular = /\.tabular,\s*\[data-tabular\]\s*\{([^}]+)\}/.exec(tokens)?.[1] ?? "";
  const numeric = /\.numeric,\s*\[data-numeric\]\s*\{([^}]+)\}/.exec(tokens)?.[1] ?? "";

  assert.ok(tabular !== "", ".tabular utility not found");
  assert.ok(numeric !== "", ".numeric utility not found");

  for (const [name, body] of [
    ["tabular", tabular],
    ["numeric", numeric],
  ] as const) {
    assert.match(body, /font-variant-numeric:\s*tabular-nums/, `.${name} lost tabular figures`);
    assert.match(body, /font-feature-settings:\s*"tnum"\s*1/, `.${name} lost the tnum feature`);
  }

  assert.ok(
    !/font-family/.test(tabular),
    ".tabular must not set a family — human-facing figures stay in the surrounding face",
  );
  assert.match(
    numeric,
    /font-family:\s*var\(--font-numeric\)/,
    ".numeric must set the mono face — it marks a string as one to transcribe exactly",
  );
});

test("the monospace face is reserved for technical identifiers", () => {
  // Not every number is monospace. `.numeric` means "identifier a reader copies";
  // `.tabular` means "figure a reader reads". A metric card, a date range or an
  // ordinal in mono is the console-output look this split exists to prevent.
  const humanFacing = [
    ["layout", "Header.tsx"],
    ["content", "MetricCard.tsx"],
    ["content", "StatHighlight.tsx"],
    ["layout", "SectionHeader.tsx"],
  ] as const;

  for (const [group, file] of humanFacing) {
    const code = componentCode(group, file);
    assert.ok(
      !/\bnumeric\b/.test(code),
      `${group}/${file} renders a human-facing figure in the mono face — use \`.tabular\``,
    );
  }

  // And the identifiers keep it, so the split cannot collapse in the other direction.
  assert.match(
    componentCode("content", "SourceNote.tsx"),
    /className="numeric/,
    "the FRED series id is no longer marked as a technical identifier",
  );
  assert.match(
    componentCode("layout", "Footer.tsx"),
    /className="numeric/,
    "the pipeline version and content hash are no longer marked as identifiers",
  );
});

// ---------------------------------------------------------------------------
// Roles reach the page through Tailwind, not through a component's own CSS
// ---------------------------------------------------------------------------

test("every weighted role is mapped to a Tailwind font-weight", () => {
  // A role can declare a weight token and still render at 400 if `globals.css` never
  // maps it — which is exactly what happened to `small` and `meta` before this pass.
  const weighted = [...tokens.matchAll(/--text-([a-z0-9-]+)-weight:/g)].map((m) => m[1] ?? "");
  const missing = weighted.filter(
    (role) =>
      !new RegExp(`--text-${role}--font-weight:\\s*var\\(--text-${role}-weight\\)`).test(
        globals,
      ),
  );
  assert.deepEqual(
    missing,
    [],
    "these roles declare a weight that globals.css never maps, so it never renders",
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
  assert.match(globals, /--container-title:\s*var\(--width-title\)/);
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
  // The face is identical on every machine now, so a greedy break would at least be
  // consistent — but the display size is fluid across a clamp range, so a greedy
  // break still lands somewhere different at every viewport. Balance makes it depend
  // on line count instead.
  assert.match(globals, /text-wrap:\s*balance/);
});
