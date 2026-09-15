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
│   ├── shell.e2e.ts           15 shell tests: nav, anchors, responsive, a11y
│   ├── typography.e2e.ts      9 type-contract tests (stacks, roles, zero fonts)
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
└── tests/                     140 tests
```

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
npm run test          # node --test      (120 tests)
npm run format        # prettier --write
npm run format:check  # prettier --check
npm run verify        # typecheck + lint + test + format:check

npm run test:e2e      # playwright test  (32 tests, chromium)
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

## Typography is OS-supplied, on purpose

There is no webfont here. No `.woff2` in the repository, no `@font-face`, no
`next/font`, and a page load makes **zero** font requests. `--font-sans` and
`--font-mono` in `src/styles/tokens.css` are system stacks — the decision in
[`../docs/design-system.md`](../docs/design-system.md) §3.

The consequence is that **the typeface differs between machines**: `system-ui`
resolves to Segoe UI on Windows (with Consolas for `.numeric`) and to whatever
fontconfig supplies on Linux. Sizes, line-heights, tracking, weights and tabular
figures are identical everywhere and are asserted by `e2e/typography.e2e.ts`; the
face is not, so that suite records it as an annotation instead. Two knock-on
effects are documented in design-system §3: `font-weight: 500` is not a distinct
face on Segoe UI, and `--width-reading: 68ch` is a different physical width per
face, so paragraph wrapping legitimately differs per machine.

Do not "fix" this by installing a font locally. Making it fully deterministic
means the project shipping a typeface, which is a product decision.

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

## Next step — Phase 3C step 5

Step 4 is **done**: the content components exist in `src/components/content/`.
`SourceNote` was extracted from `Footer`, which now composes it; `Callout` replaced
the inline warning surface on the comparability block; and `MetricCard` makes the
§16 caveat slot structural rather than optional.

Next: `EChart`, `ChartFrame`, `ChartControls`, `ChartTableFallback` and the ECharts
theme adapter — step 5 of
[`../docs/product-architecture.md`](../docs/product-architecture.md) §10, with each
component's responsibility in §4 and the chart accessibility requirements in §5.
Three things already exist to build on: `echarts` 6.1.0 is installed and unused,
`src/styles/chart-language.ts` is the typed theme contract (its `CHART_TOKENS` are
already asserted against `tokens.css`), and `ChartFrame` is a `Card` with slots
rather than a new surface — so it must not float either. The decided chart visual
language and interaction/motion direction are recorded in `../KIRO.md` §10.
