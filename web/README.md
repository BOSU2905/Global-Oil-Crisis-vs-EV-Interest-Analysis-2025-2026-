# web/

Presentation layer for the Oil vs EV analysis. **Phase 3C step 4: the shell, the
layout primitives and the content components exist. No charts and no narrative
sections yet.**

`npm run build` succeeds, `npm run test:e2e` passes in a browser, and the page
renders its own analytical scope read from the generated artifacts. What is _not_
here: the hero, the ten narrative sections, and every chart. Those are steps 5–8 of
[`../docs/product-architecture.md`](../docs/product-architecture.md) §10.

## Layout

```text
web/
├── package.json               dependency baseline; scripts below
├── package-lock.json          committed — `npm ci` reproduces the validated tree
├── tsconfig.json              strict; React-capable since Phase 3C
├── eslint.config.mjs          flat config; TS/Next rules scoped to .ts/.tsx
├── postcss.config.mjs         Tailwind v4 plugin registration
├── next.config.mjs            Next configuration
├── playwright.config.ts       chromium-only, runs against a production build
├── app/
│   ├── layout.tsx             the HTML document; delegates to AppShell
│   ├── page.tsx               foundation page — scope, not findings
│   └── globals.css            Tailwind entry + token→theme mapping
├── e2e/
│   ├── foundation.e2e.ts      8 browser smoke tests
│   ├── shell.e2e.ts           23 shell tests: nav, anchors, frame/spine, responsive, a11y
│   ├── typography.e2e.ts      16 type-contract tests (Geist stacks, roles, weight axis, self-hosting)
│   └── content.e2e.ts         15 content tests: cards, badges, callout, disclosure
├── src/
│   ├── components/layout/     AppShell Header Navigation Footer
│   │                          Container Section SectionHeader + contract.ts
│   ├── components/content/    Card MetricCard Badge StatHighlight
│   │                          SourceNote Callout ReadMore + contract.ts
│   ├── content/sections.ts    the section registry Navigation reads
│   ├── data/
│   │   ├── generated/         ← artifacts from pipeline/. DO NOT EDIT
│   │   ├── artifact-types.ts  TypeScript contract for all five artifacts
│   │   ├── validate.ts        Zod schemas + ContractError (exact failing path)
│   │   ├── artifacts.ts       typed accessors + cross-artifact integrity
│   │   ├── load-node.ts       Node fs loader (tests only — keeps node:fs out of the app)
│   │   └── index.ts           public surface — import from here
│   ├── lib/artifacts.ts       app-side loader: JSON → createArtifactBundle
│   └── styles/
│       ├── tokens.css         design tokens: colour, type, space, motion, chart
│       └── chart-language.ts  typed chart contract + DOM-free theme resolver
└── tests/                     160 tests
```

**One frame, shared by the shell and the page body.** `Header`, `Footer` and
`app/page.tsx` all use `Container width="page"`. They used not to — the shell was
1440px and the body 1120px, both centred, which inset the body's content 80px from
the header's left edge at 1280px and 160px at 1440px and above. Two centred frames of
different widths have no alignment spine, and that inset is what made a 1920px canvas
read as a narrow column floating in it. The frame is banded rather than fluid: 1120px
up to `2xl`, 1280px from 1536px, so a chart can take the full frame on a large display
while prose stays at `--width-reading`. A unit test asserts all three components
request `page`; an E2E test asserts they share one left edge at 375/1280/1440/1920.

**A statistic cannot be rendered without its caveat.** `MetricContent` in
`src/components/content/contract.ts` is a discriminated union: an `inferential`
metric cannot be constructed without a `specification` string and at least one
caveat, so KIRO.md §16 — a level correlation never appears without the
specification comparison — is a compile error rather than a review habit.
`assertMetricDisplayable()` covers the runtime case a type cannot, and the
foundation page still renders only `descriptive` metrics because the sections that
can carry the comparison are steps 6–7.

**Component tests are browser tests, and that is forced.** Node 22 cannot load
`.tsx` — importing one under `node --test` fails with `ERR_UNKNOWN_FILE_EXTENSION`,
because JSX is not TypeScript syntax. So `npm test` covers logic that lives in
`.ts` modules (including whether every navigation target is a section the page
actually renders), and `npm run test:e2e` covers anything that only exists once
rendered.

`src/lib/artifacts.ts` is outside `src/data/` on purpose:
`tests/analytical-safety.test.ts` asserts the exact set of files in the data layer,
and that guardrail is worth more than the tidier import path.

## Commands

Run from `web/`. Requires Node ≥22.6 (the tests import `.ts` directly and rely on
Node's native type stripping). Install with `npm ci` to reproduce the exact tree
the gates below were validated against.

```bash
npm run dev           # next dev
npm run build         # next build
npm run start         # next start  (after a build)

npm run typecheck     # tsc --noEmit, strict
npm run lint          # eslint
npm run test          # node --test      (160 tests)
npm run format        # prettier --write
npm run format:check  # prettier --check
npm run verify        # typecheck + lint + test + format:check

npm run test:e2e      # playwright test  (62 tests, chromium)
```

`verify` is the fast gate. `test:e2e` is separate because it builds the app and
starts a server; it runs against the **production** build, since the CSS pipeline
and server-component rendering both differ in development. It needs the browser
binary once:

```bash
npx playwright install chromium
```

If `node` fails with `MODULE_NOT_FOUND` for `proxy-bootstrap.js`, the environment
has a stale `NODE_OPTIONS`. Prefix commands with `NODE_OPTIONS= ` to clear it.

## Typography ships with the application

**Geist Sans and Geist Mono, self-hosted from the `geist` npm package.** No font
file is committed here, nothing is installed at the operating-system level, and no
request goes to Google Fonts or any other third party. The typeface is a dependency:

```tsx
// app/layout.tsx — the only file that names a face
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

<html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
```

The class goes on `<html>` rather than `<body>` because `<html>` **is** `:root`,
which is where `tokens.css` declares `--font-display`, `--font-sans`, `--font-mono`
and `--font-numeric`. A custom property set on `<body>` is invisible to a `var()` in
a `:root` rule, so the tokens would silently take their fallback chain.

`next/font/local` inside the package emits the `@font-face` rules, copies two
variable `.woff2` files into `/_next/static/media/` at build time, and serves them
same-origin. So a page load makes **exactly two** font requests, both from this
origin — where it used to make zero. That reversal is deliberate, and
`e2e/typography.e2e.ts` asserts the new rule instead of dropping the old one: every
font byte must come from `/_next/static/media/`, nothing may come from a font
provider, and every `@font-face` family must match `/^Geist/`.

**The per-machine typeface difference is resolved.** This README previously recorded
that the face was OS-supplied and therefore differed between machines. It no longer
does: the same bytes render everywhere, and the E2E suite asserts the face rather
than annotating it.

**Not every number is monospace.** Two figure treatments, both carrying
`tabular-nums`, differing only in face:

| Class      | Face                   | For                                                                                                                                                                 |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.tabular` | Geist Sans (inherited) | figures a reader **reads** — observation period, weekly observation count, market count, metric-card figures, intervals, narrative ordinals, inline `StatHighlight` |
| `.numeric` | Geist Mono             | identifiers a reader **copies** — FRED series ids, content hashes, pipeline versions, filenames                                                                     |

The alignment is load-bearing rather than decorative: Geist Sans's figures are
proportional by default, so at 400/40px `"111111"` is 80px against `"000000"` at
162px. With `tabular-nums` both are 144px.

**The weight rule changed, and it got stricter.** "No role may request weight 500"
is retired. That rule was measured and correct while the face came from the OS — 500
was pixel-identical to 600 on Segoe UI and collapsed to 400 on a 400/700-only face —
but its premise was that the platform owned the face. Both Geist files carry a
`100 900` variable axis, so every step is interpolated from the same bytes on every
machine; drawing one string at 100…900 gives **nine distinct pixel digests** per
face. The replacement rules, all enforced: every `--text-*-weight` must resolve to a
declared step (400/500/600/700), every sized role must declare a weight, no element
may compute a weight off the scale, no role at 20px or below may exceed 500, and each
declared step must render as a genuinely distinct face.

**The weight mapping was audited, not carried over.** A weight number does not tell
you how bold something looks, so the measure used was ink coverage at each role's own
size. `display` 600 → **500** (31.73% → 28.27%, against 700's 34.71%), `h4` and
`label` and `stat-small` 600 → **500**, and `small`/`meta` given an explicit 400.
`display` ends up a step lighter than `h2`, which is optical sizing rather than an
inverted hierarchy: the hero is nearly twice the size and does not need to be darker
too. Full table in [`../docs/design-system.md`](../docs/design-system.md) §3.

Two measured caveats remain, neither blocking:

- `next/font`'s metric-adjusted `GeistSans Fallback` face reports
  `status: "error"` on a machine without Arial, so there is no size-adjusted
  fallback during the `font-display: swap` window there.
- The package's `--font-geist-sans` is only `"GeistSans", "GeistSans Fallback"` and
  does not terminate in a generic family, so `tokens.css` appends an explicit tail
  ending in `sans-serif`. A unit test asserts it. Geist Mono needs no tail.

Headings carry `text-wrap: balance`. The face is identical everywhere now, but the
display size is fluid across a `clamp()` range, so a greedy break would still land
differently at every viewport.

Two portability notes for Windows, both already fixed in the repository:
`.gitattributes` pins the working tree to LF (with `core.autocrlf=true` the
checkout was CRLF, which failed `format:check` on 37 files), and paths are derived
from `import.meta.dirname` rather than by slicing `import.meta.url` at `"/"`, which
resolved one directory too deep on a backslash path.

## Rules for the frontend

1. **Never compute a statistic.** Every number rendered must come from the
   artifacts. No Pearson, Spearman, mean, percentage change or peak detection in
   component code. Enforced by `tests/analytical-safety.test.ts`, which fails if
   the data layer gains statistical code or arithmetic on a statistic.
2. **Never compare interest levels across series.** Each Google Trends export is
   normalised to its own maximum. Use `assertComparableAcrossSeries()`.
3. **Never render a claim as fact unless `publishable_as_fact` is true.**
4. **Never call the crude price a pump price.** `brent_usd_per_litre` is a
   benchmark cost per litre of crude.

Full contract: [`../docs/frontend-data-contract.md`](../docs/frontend-data-contract.md).
Design tokens: [`../docs/design-system.md`](../docs/design-system.md).
Product/IA/a11y contracts: [`../docs/product-architecture.md`](../docs/product-architecture.md).

## Generated artifacts

`src/data/generated/*.json` is produced by the Python pipeline and committed so
the web build never needs a Python toolchain. It is excluded from Prettier —
formatting is owned by `pipeline/src/pipeline/emit.py`, which guarantees
byte-stable output.

```bash
cd ../pipeline
PYTHONPATH=src python -m pipeline.build          # regenerate
PYTHONPATH=src python -m pipeline.build --check  # fail if stale
```

## Resolved Phase 3A workarounds

Both stopgaps that Phase 3A carried because the registry was unreachable are gone:

**`types/node-minimal.d.ts` — deleted.** Real `@types/node` (22.20.2, tracking the
Node 22 runtime rather than the registry `latest`) now supplies `node:test`,
`node:assert/strict`, `node:fs`, `node:path`, `node:url` and `structuredClone`.
`tsconfig.json` declares `"types": ["node", "react", "react-dom"]` explicitly,
because TypeScript 6 no longer auto-includes every package under
`node_modules/@types`.

**ESLint — installed.** `eslint.config.mjs` is a flat config with the
TypeScript and Next.js rule sets scoped to `.ts`/`.tsx`, and
`src/data/generated/**` ignored so lint can never rewrite a pipeline-owned
artifact. `tsc --strict`, ESLint and Prettier now all gate the tree.

## Next step — Phase 3C step 5 proper

Step 4 is **done**: the content components exist in `src/components/content/`.
`SourceNote` was extracted from `Footer`, which now composes it; `Callout` replaced
the inline warning surface on the comparability block; and `MetricCard` makes the
§16 caveat slot structural rather than optional.

A **step 5 chart prototype** is also done and committed — ONE chart, Brent crude
against worldwide EV search interest, at `#oil-vs-interest` on `/`. It is the
reference implementation for everything step 5 adds after it:
`src/components/chart/` holds `EChart`, `ChartFrame`, `ChartControls`, `ChartLegend`,
`ChartTableFallback`, the option builder and the theme adapter; `src/lib/oil-vs-interest.ts`
is the selector. 43 unit tests and 24 browser tests cover it, and
`tests/chart-contract.test.ts` carries the chart layer's own no-statistic scan.

Next: the remaining charts and the narrative sections that host them — step 5 of
[`../docs/product-architecture.md`](../docs/product-architecture.md) §10, with each
component's responsibility in §4 and the chart accessibility requirements in §5.
`src/styles/chart-language.ts` is the typed theme contract (its `CHART_TOKENS` are
already asserted against `tokens.css`), and `ChartFrame` is a `Card` with slots
rather than a new surface — so it must not float either. The decided chart visual
language and interaction/motion direction are recorded in `../KIRO.md` §10, together
with what the prototype already settled and what deliberately stays unbuilt.
