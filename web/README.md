# web/

Presentation layer for the Oil vs EV analysis. **Phase 3B bootstrap: dependencies
installed and validated; no Next.js app, React components or charts yet.**

The framework-independent foundation — typed data contract, boundary validation,
accessors, design tokens, chart-language contract — is complete and green. The
dependency baseline (Next.js, React, ECharts, Zod, TypeScript, ESLint, Prettier,
Tailwind, Playwright) is installed and locked, but no UI has been written against
it. There is no `app/`, no `components/` and no `content/` yet.

## Layout

```text
web/
├── package.json               dependency baseline; scripts below
├── package-lock.json          committed — `npm ci` reproduces the validated tree
├── tsconfig.json              strict, nodenext, verbatimModuleSyntax
├── eslint.config.mjs          flat config; TS/Next rules scoped to .ts/.tsx
├── postcss.config.mjs         Tailwind v4 plugin registration
├── src/
│   ├── data/
│   │   ├── generated/         ← artifacts from pipeline/. DO NOT EDIT
│   │   ├── artifact-types.ts  TypeScript contract for all five artifacts
│   │   ├── validate.ts        boundary validator (Zod replacement path documented)
│   │   ├── artifacts.ts       typed accessors + cross-artifact integrity
│   │   ├── load-node.ts       Node fs loader (tests and build scripts only)
│   │   └── index.ts           public surface — import from here
│   └── styles/
│       ├── tokens.css         design tokens: colour, type, space, motion, chart
│       └── chart-language.ts  typed chart contract + DOM-free theme resolver
└── tests/                     109 tests
```

## Commands

Run from `web/`. Requires Node ≥22.6 (the tests import `.ts` directly and rely on
Node's native type stripping). Install with `npm ci` to reproduce the exact tree
the gates below were validated against.

```bash
npm run typecheck     # tsc --noEmit, strict
npm run lint          # eslint
npm run test          # node --test  (109 tests)
npm run format        # prettier --write
npm run format:check  # prettier --check
npm run verify        # typecheck + lint + test + format:check

npm run dev           # next dev    ── needs app/, added in the UI phase
npm run build         # next build  ── needs app/, added in the UI phase
npm run start         # next start  ── needs a completed build
```

`dev`, `build` and `start` are wired but cannot succeed yet: `next build` fails
with "Couldn't find any `pages` or `app` directory" until the UI phase creates the
App Router entrypoint. That failure is expected at this stage and confirms the
Next.js toolchain itself resolves and runs.

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
cd ../pipeline/src
python -m pipeline.build          # regenerate
python -m pipeline.build --check  # fail if stale
```

## Resolved Phase 3A workarounds

Both stopgaps that Phase 3A carried because the registry was unreachable are gone:

**`types/node-minimal.d.ts` — deleted.** Real `@types/node` (22.20.2, tracking the
Node 22 runtime rather than the registry `latest`) now supplies `node:test`,
`node:assert/strict`, `node:fs`, `node:path`, `node:url` and `structuredClone`.
`tsconfig.json` declares `"types": ["node"]` explicitly, because TypeScript 6 no
longer auto-includes every package under `node_modules/@types`.

**ESLint — installed.** `eslint.config.mjs` is a flat config with the
TypeScript and Next.js rule sets scoped to `.ts`/`.tsx`, and
`src/data/generated/**` ignored so lint can never rewrite a pipeline-owned
artifact. `tsc --strict`, ESLint and Prettier now all gate the tree.

## Next phase — UI implementation

Follows `../docs/product-architecture.md` §10, starting at step 1: the Next.js
App Router scaffold plus the Tailwind `@theme` mapping of
`src/styles/tokens.css`. `tsconfig.json` will need `jsx`, the DOM lib, `@types/react`
and `**/*.tsx` added at that point; it is deliberately left Node-only while no
React source exists.
