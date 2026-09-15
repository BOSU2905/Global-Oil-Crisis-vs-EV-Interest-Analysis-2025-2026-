# web/

Presentation layer for the Oil vs EV analysis. **Phase 3C step 1: the App Router
scaffold runs and the design tokens are wired into Tailwind. No components,
charts or narrative sections yet.**

`npm run build` succeeds, `npm run test:e2e` passes in a browser, and the page
renders its own analytical scope read from the generated artifacts. What is _not_
here: `components/`, `content/`, the hero, the ten narrative sections, and every
chart. Those are steps 3–8 of
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
│   ├── layout.tsx             root layout: landmarks, skip link, metadata
│   ├── page.tsx               foundation page — scope, not findings
│   └── globals.css            Tailwind entry + token→theme mapping
├── e2e/foundation.e2e.ts      8 browser smoke tests
├── src/
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
└── tests/                     109 tests
```

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
npm run test          # node --test      (109 tests)
npm run format        # prettier --write
npm run format:check  # prettier --check
npm run verify        # typecheck + lint + test + format:check

npm run test:e2e      # playwright test  (8 tests, chromium)
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

## Next step — Phase 3C step 3

Step 2 is **done**: `src/data/validate.ts` is now Zod 4.6.5. The schemas are the
contract, `ContractError` still names the exact failing JSON path, `index.ts`'s
exports did not change, and `tests/validator.test.ts` passed unedited. Error
paths were compared field by field against the old implementation across 52
mutations and are identical in all 52.

Next: `AppShell`, `Container`, `Section`, `SectionHeader`, `Header`, `Navigation`
— step 3 of [`../docs/product-architecture.md`](../docs/product-architecture.md)
§10. Note that `app/layout.tsx` currently inlines a rudimentary header and footer;
step 3 should extract them into the contracted `Header`/`AppShell` components
rather than grow them in place.
