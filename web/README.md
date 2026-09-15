# web/

Presentation layer for the Oil vs EV analysis. **Phase 3A: framework-independent
foundation only — no Next.js, no React, no charts yet.**

The npm registry is unreachable in the build environment, so nothing that
requires a package could be written and verified. What is here is everything that
does not: the typed data contract, boundary validation, accessors, design tokens
and the chart-language contract — all type-checked and tested offline.

## Layout

```text
web/
├── package.json               no dependencies; scripts use only global tooling
├── tsconfig.json              strict, nodenext, verbatimModuleSyntax
├── types/node-minimal.d.ts    temporary stand-in for @types/node (see below)
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

Run from `web/`. Requires Node ≥22.6 (TypeScript runs natively via type
stripping). No install step.

```bash
npm run typecheck     # tsc --noEmit, strict
npm run test          # node --test  (109 tests)
npm run format:check  # prettier
npm run verify        # all three
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
cd ../pipeline/src
python -m pipeline.build          # regenerate
python -m pipeline.build --check  # fail if stale
```

## Two documented workarounds

**`types/node-minimal.d.ts`** — `@types/node` cannot be installed offline, so
`node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:url` and
`structuredClone` are declared locally. It is hand-written from the documented
APIs, contains no third-party source, and is a strict subset of the real types.
Delete it in Phase 3B and add `@types/node`.

**No ESLint** — ESLint cannot parse TypeScript without
`@typescript-eslint/parser`, which is not installable. `tsc --strict` plus
Prettier is the current gate. ESLint arrives in Phase 3B.

## Phase 3B

Requires the npm registry: Next.js app and routing, React components, Tailwind
theme wiring, the ECharts adapter, browser rendering, real responsive
verification, chart interaction, and visual QA.
