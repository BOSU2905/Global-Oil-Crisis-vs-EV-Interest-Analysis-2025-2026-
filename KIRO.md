# KIRO.md — Living Project State

**Project:** Global Oil Crisis vs EV Interest Analysis (2025/2026)

**Last updated:** 2026-09-15 — Phase 3B bootstrap COMPLETE (steps 1–10 of 10)

---

## 0. How to read this document

Part A (§1–§11) is **live state**. It is rewritten as work proceeds and always
describes the *current* repository, not the original plan.

Part B (§12–§24) is **stable contract**: product direction, analytical guardrails
and the verified numbers. It changes only if the pipeline output changes.

The repository is the implementation source of truth. This document is the
project-context source of truth. If the two disagree, **investigate before
changing anything**.

---

# PART A — LIVE STATE

## 1. Operating rules (permanent)

### Governing protocol

Sessions are governed by the **Universal Kiro Protocol**. The rules below are the
project-specific expression of it; these are the parts a resuming session most
often needs and most easily gets wrong.

**Source-of-truth hierarchy** — when determining what is true, in this order:

1. Actual repository state
2. `KIRO.md`
3. `docs/`
4. Tests and validation reports
5. Git history
6. The current instruction
7. General assumptions

The repository outranks this document. If they disagree, **reconcile explicitly
before implementing** — do not assume a phase is incomplete just because its
implementation is unfamiliar, and do not assume this document is correct just
because it is confident.

**Mandatory loop:** READ → INSPECT → RECONCILE → PLAN → IMPLEMENT → VALIDATE →
DOCUMENT → COMMIT → VERIFY → STOP. Never jump from instruction to
implementation.

**Phase boundaries are hard stops.** A phase is complete only when
implementation, validation, documentation, `KIRO.md` and a commit are all done
and the tree is resumable. On reaching that point: **STOP.** Do not
opportunistically start the next phase — it requires a fresh explicit
instruction.

**Never report a check as passed unless it was actually run.** If a gate cannot
run because the project has not reached the necessary phase, record that fact
instead (see the `next build` row in §9).

**No silent decisions** on anything affecting analytical interpretation, product
narrative, architecture, data semantics, user-facing claims or design-system
behaviour. Resolve from existing documentation and evidence; if it cannot be
resolved safely, document the ambiguity and ask. The open Singapore grouping
question in §8 is an example that is deliberately still unresolved rather than
quietly decided.

**No backward regression.** Before completing any task, verify prior phases are
intact — analytical source, generated artifacts, statistical results, tests,
reproducibility, design tokens, documented architecture. A new frontend feature
that silently damages the analytical foundation is a failure, not a success.

### Kiro project ownership

Kiro has full implementation control over this repository and is responsible for:

- implementation
- dependency management
- validation
- documentation
- phase tracking
- maintaining project state
- keeping `KIRO.md` current

The user should not need to manually reconstruct project context between
sessions or between devices.

### Living project documentation

`KIRO.md` is continuously maintained. Every meaningful phase, milestone,
architectural decision, dependency change or major implementation step updates
it — not at the end of the project, but as the work happens.

When a phase completes, mark it **COMPLETE** and record what was implemented,
the relevant commits, validation results, remaining limitations, and the next
phase. When a phase is in progress, record the current sub-step, what is already
done, and what remains.

### Dependency ownership

Kiro identifies, installs, configures, updates and validates every dependency
the project requires. Required packages are never left as merely "planned".

### Per-phase development rules

1. Inspect actual repo state.
2. Identify what is already complete.
3. Make only changes required for the current phase.
4. Preserve analytical integrity.
5. Run relevant validation.
6. Report exactly what changed.
7. Report remaining blockers.
8. STOP at the phase boundary — do not silently continue into unrelated phases.

Never fake dependency installation. Never bypass security controls to obtain
packages. Never vendor arbitrary packages without explicit justification. Never
change analytical conclusions to make the product more visually compelling.

### Device-transition rule

On a fresh device, the first task is **inspection only**: `git status`, recent
commits, `web/package.json`, lockfile, `web/src` tree, Phase 3A files, generated
artifacts, validation reports, Node/npm versions, installed dependencies, and
npm registry reachability. Do not assume this document is newer than the
repository.

### Git identity note (device-specific)

This device has **no git `user.name` / `user.email` configured**, globally or
locally, so `git commit` fails with "Committer identity unknown". Rather than
modifying the user's git config, Kiro passes the identity used by all prior
Phase 2/3A commits via environment variables:

```bash
export GIT_AUTHOR_NAME="Kiro Agent"
export GIT_AUTHOR_EMAIL="244629292+kiro-agent@users.noreply.github.com"
export GIT_COMMITTER_NAME="Kiro Agent"
export GIT_COMMITTER_EMAIL="244629292+kiro-agent@users.noreply.github.com"
```

---

## 2. Project context

Transform the original Streamlit analytical prototype into a polished, modern
SaaS/data-intelligence web product that communicates the analysis as a narrative
intelligence experience rather than a conventional BI dashboard.

Architecture is strictly separated:

```text
Python analytical pipeline  →  generated static JSON artifacts  →  Next.js frontend  →  client-side charts
```

**Python owns analysis. Frontend owns presentation.** No backend is required.
React/Next.js must never compute a statistic.

---

## 3. Current phase

**Phase 3C — Frontend/UI Implementation. Step 1 of 8 COMPLETE.**

Phase 3B (dependency bootstrap) is complete and committed at `f950e2b`.

Phase 3C follows the eight-step order in `docs/product-architecture.md` §10:

| # | Step | Status |
| --- | --- | --- |
| 1 | Next.js + TypeScript + Tailwind scaffold; wire tokens into the Tailwind theme | **COMPLETE** |
| 2 | Swap the hand-rolled validator for Zod behind the same accessors | **NEXT** |
| 3 | `AppShell`, `Container`, `Section`, `SectionHeader`, `Header`, `Navigation` | pending |
| 4 | `Card`, `MetricCard`, `Badge`, `SourceNote`, `StatHighlight`, `ReadMore` | pending |
| 5 | `EChart` + `ChartFrame` + `ChartTableFallback` + the ECharts theme adapter | pending |
| 6 | Hero (§2) and the Robustness section (05) | pending |
| 7 | Remaining narrative sections in order | pending |
| 8 | Responsive, accessibility and performance passes | pending |

**What step 1 did not do, deliberately:** no narrative sections, no hero, no
charts, no navigation, no country deep dives, no interpretation panels. The
application renders a shell and its own scope, and nothing more. Statistics are
absent from the UI on purpose — see §4.

---

## 4. Completed work

### Phase 3C step 1 — App Router scaffold + Tailwind token wiring — COMPLETE

Seven files created, four modified. The application now builds, renders and is
browser-tested.

**Created**

```text
web/app/layout.tsx          root layout / AppShell foundation
web/app/page.tsx            foundation page
web/app/globals.css         Tailwind entry + token→theme mapping
web/next.config.mjs         Next configuration
web/src/lib/artifacts.ts    app-side artifact loader
web/playwright.config.ts    E2E configuration
web/e2e/foundation.e2e.ts   8 smoke tests
```

**Modified:** `web/tsconfig.json`, `web/package.json` (added `test:e2e`),
`web/.prettierignore`, `.gitignore`.

#### Token integration — how it works, and why this way

The requirement was to map the existing tokens into Tailwind v4 **without
creating a second token system**. The obstacle: `tokens.css` already occupies
Tailwind's own namespaces (`--color-*`, `--radius-*`, `--font-*`, `--ease-*`), so
a naive `@theme` block would collide with it.

The resolution is `@theme inline` with same-name self-reference:

```css
@theme inline {
  --color-surface: var(--color-surface);
}
```

This emits `.bg-surface { background-color: var(--color-surface) }`. The utility
resolves the variable **at the element**, so dark mode works with no `dark:`
variants anywhere in the markup — `tokens.css` re-declares the same variable
under `prefers-color-scheme: dark` and `[data-theme="dark"]`, and every utility
follows.

Tailwind additionally emits its own `--color-surface: var(--color-surface)` inside
`@layer theme`, which would be circular if it won the cascade. It does not:
`tokens.css` is imported **unlayered**, and unlayered declarations outrank every
layer. **The import order in `globals.css` is therefore load-bearing.** This was
not assumed — it was verified by compiling the pattern through
`@tailwindcss/postcss` 4.3.3 and inspecting the output, and it is now asserted in
a browser by two E2E tests that read computed colours in both themes.

Three token families needed **no** mapping, because `tokens.css` already overrides
the identically-named Tailwind default: `--font-sans`/`--font-mono`,
`--radius-xs…full`, and `--ease-out`/`--ease-in-out`. Three more coincide with
Tailwind's defaults by design: the 4px spacing base (`p-4` *is* `--space-4`), the
400/500/600 weights, and all five breakpoints.

#### Two design-system rules now enforced by the build

- **Tailwind's default colour palette is removed** (`--color-*: initial`, with
  `transparent`/`current`/`inherit` restored). It was a third token system that
  made `bg-red-500` available and let any component bypass the design system by
  accident — precisely the "rainbow palette" outcome `docs/design-system.md` §1
  rejects. Verified absent from the built CSS.
- **Radius above `xl` is removed** (`--radius-2xl/3xl/4xl: initial`). §4 caps
  radius at 12px, so `rounded-2xl` would have contradicted a stated decision.

Shadows are additive rather than reset — only the two overlay tokens are exposed,
since cards must not float.

#### Why the app loader is not in `src/data/`

`tests/analytical-safety.test.ts` asserts the **exact** set of `.ts` files in
`src/data/`. That is a real guardrail: it makes any new module in the data layer a
reviewed act. Rather than weaken the assertion, the app-side loader lives at
`web/src/lib/artifacts.ts`. It imports the five generated JSON files and hands
them to the existing `createArtifactBundle`, which is the transport
`src/data/load-node.ts` always documented for the frontend — the same validation
boundary, a different transport. `load-node.ts` itself is untouched and stays
test-only, so `node:fs` never enters the React module graph.

#### Statistics are deliberately absent from the UI

The page renders scope, not findings: observation period, weekly observation
count, market labels, the partial-week warning and the cross-market comparability
constraint — all read from artifacts. No coefficient, p-value, interval or
classification appears, and an E2E test asserts that (`renders no correlation
coefficient or p-value on the foundation page`).

This is a correctness decision, not timidity. `KIRO.md` §16 requires the
specification comparison to sit immediately beside any level correlation; a
coefficient on a page with nowhere to state that caveat would repeat the original
project's error. Statistics arrive in step 6 together with the Robustness section.

### Phase 3B — dependency bootstrap — COMPLETE

Committed as `f950e2b`. See §6 for the resulting environment and §9 for gates.

### Phase 3A restoration — COMPLETE

Phase 3A had been merged into `origin/phase-2-analytical-remediation` via PR #2
but was **never brought onto `main`**. `main` sat at `d19a7c7` (the PR #1 Phase 2
merge), so the entire frontend foundation was absent from the working tree.

Restored by merge, preserving the original Phase 3A history:

```bash
git merge --no-ff origin/phase-2-analytical-remediation
```

- **Merge commit:** `97d1a5c` — "Merge Phase 3A frontend foundation into main"
- **Parents:** `d19a7c7` (main) + `908864f` (PR #2 merge)
- **Phase 3A commits now reachable from `main`:** `384f9c0` (data contract),
  `a0af6f9` (design tokens + chart language), `d8644b8` (design-system and
  product-architecture docs)

Pre-merge safety checks: merge-base `9d777a5`; `git diff 9d777a5 main` empty;
`git merge-tree` reported no conflicts; working tree clean; no stashes.

**19 files restored** (18 added, 1 modified — `web/README.md`; +5,266/−25 lines):

```text
web/package.json                     web/tsconfig.json
web/.prettierrc.json                 web/.prettierignore
web/src/data/artifact-types.ts       web/src/data/artifacts.ts
web/src/data/index.ts                web/src/data/load-node.ts
web/src/data/validate.ts
web/src/styles/tokens.css            web/src/styles/chart-language.ts
web/tests/analytical-safety.test.ts  web/tests/chart-language.test.ts
web/tests/data-contract.test.ts      web/tests/validator.test.ts
web/types/node-minimal.d.ts
docs/design-system.md                docs/product-architecture.md
web/README.md (modified)
```

**Analytical layer confirmed untouched by the merge.** Git tree hashes are
identical across `d19a7c7..HEAD`:

| Path | Tree hash (unchanged) |
| --- | --- |
| `pipeline/` | `5bb617c0a19cf62814a0ee6a44f8ad28b47be9fd` |
| `data/` | `e3b3ea39e6de7ca091a321e48eb45e1601588a11` |
| `web/src/data/generated/` | `0b4db970dfbc032f67d63f975d168d7ff2ad7838` |
| `reports/` | `78aebdc94b36462502b516771caa2d5bdebbaf83` |

`git diff d19a7c7 HEAD -- pipeline/ data/ reports/ web/src/data/generated/ METHODOLOGY.md`
is **empty**.

**Invariant after the Phase 3B bootstrap commit.** The `pipeline/` tree hash above
no longer matches, because `pipeline/README.md` received a documentation-only
test-count fix (190 → 191). The analytical invariant that matters is stricter and
still holds:

| Path | Tree hash | vs `d19a7c7` |
| --- | --- | --- |
| `pipeline/src` | `0d4e1273a1e4b46561015b59d09fbb8b12115e8e` | **identical** |
| `data/` | `e3b3ea39e6de7ca091a321e48eb45e1601588a11` | **identical** |
| `web/src/data/generated/` | `0b4db970dfbc032f67d63f975d168d7ff2ad7838` | **identical** |
| `reports/` | `78aebdc94b36462502b516771caa2d5bdebbaf83` | **identical** |

No analytical source, input datum, generated artifact or report was touched in
this session. The only file changed under `pipeline/` is its README.

### Node runtime bootstrap — COMPLETE

See §6.

### Dependency bootstrap — COMPLETE

Frontend dependencies installed from the live npm registry into `web/`, with
`web/package-lock.json` committed so `npm ci` reproduces the exact tree these
gates ran against. Exact versions in §6.

Configuration written or changed as part of the bootstrap:

- **`web/eslint.config.mjs`** (new) — flat config. The TypeScript and Next rule
  sets are **scoped to `**/*.ts` / `**/*.tsx` on purpose**: left unscoped, the
  `@typescript-eslint` parser is applied to plain `.mjs` files while
  `eslint-config-next` declares globals for them, ESLint 10 then calls
  `scopeManager.addGlobals()`, which `@typescript-eslint/scope-manager@8` does
  not implement, and the run dies with a `TypeError`. `react: { version: "19.3.0" }`
  is pinned because `eslint-plugin-react@7.37.5`'s auto-detection crashes under
  ESLint 10. `src/data/generated/**` is ignored so lint can never rewrite a
  pipeline-owned artifact.
- **`web/postcss.config.mjs`** (new) — registers `@tailwindcss/postcss`. This is
  the only wiring that makes the installed Tailwind dependency functional rather
  than dead weight in the lockfile. Tailwind v4 has no `tailwind.config.js`; the
  theme is configured in CSS via `@theme`, which is **deferred to the UI phase**
  along with the CSS entrypoint.
- **`web/tsconfig.json`** — added `"types": ["node"]`; dropped `types/**/*.d.ts`
  from `include`. TypeScript 6 no longer auto-includes every package under
  `node_modules/@types`, so the ambient types are now declared explicitly. This
  is **narrower** than the old implicit behaviour, not looser. No strictness flag
  was changed or removed.
- **`web/types/node-minimal.d.ts`** — **deleted**, exactly as that file's own
  header instructed, now that real `@types/node` is installed.
- **`.gitignore`** — added `node_modules/`, `.next/`, `out/`, `next-env.d.ts`,
  `playwright-report/`, `test-results/`, `.playwright/`, plus a note recording that
  `web/package-lock.json` is deliberately committed.
- **`web/package.json`** — dependency sets plus the full script surface (§5).

Documentation corrected to match reality, not intent:

- **`web/README.md`** — still described an offline, zero-dependency, ESLint-less
  tree and a `types/node-minimal.d.ts` that no longer exists. Rewritten.
- **`README.md`** — the documented run command `cd pipeline && python -m pipeline.build`
  **cannot work on a fresh checkout**: the package uses a `src/` layout, so
  `pipeline` is not importable until `src` is on the path. Verified by hitting the
  exact failure (`ModuleNotFoundError: No module named 'pipeline'`) in a clean
  venv. Corrected to `PYTHONPATH=src python -m pipeline.build`, with the editable
  install documented as the alternative.
- **`README.md` / `pipeline/README.md`** — test count `190` → `191` (measured).
- **`docs/phase-2-validation.md`** — added a dated reconciliation note for the
  same off-by-one. The original 2026-09-14 row is left as written rather than
  retro-edited, since it is a record of a specific run.

### Earlier phases

Phase 1 (audit), Phase 2 (analytical remediation and reproducibility), Phase 3
(product direction), Phase 3A (frontend/data/design foundations) — see §11.

---

## 5. Current implementation status

| Layer | Status |
| --- | --- |
| Analytical pipeline (`pipeline/`) | **COMPLETE**, zero runtime dependencies, verified |
| Generated artifacts (`web/src/data/generated/`) | **COMPLETE**, fresh, hash-verified |
| Reproducibility / validation | **COMPLETE** |
| Product direction | **LOCKED** |
| Frontend data contract + validators | **COMPLETE** (Phase 3A, now on `main`) |
| Design foundation (tokens, chart language) | **COMPLETE** (Phase 3A, now on `main`) |
| Node runtime | **COMPLETE** — Node 22.23.2 in user space |
| Frontend dependencies installed | **COMPLETE** — locked, `npm ci`-reproducible |
| Frontend toolchain gates (tsc / eslint / prettier / node --test) | **COMPLETE** — all green |
| Python dev gates (pytest / ruff / mypy) | **COMPLETE** — restored via the declared `dev` extra |
| Next.js App Router scaffold | **COMPLETE** — builds clean, 3 static routes |
| Tailwind ↔ design-token integration | **COMPLETE** — verified in-browser, light and dark |
| Browser / E2E harness | **COMPLETE** — Playwright chromium, 8 smoke tests passing |
| React component library (`AppShell`, `Card`, …) | **NOT STARTED** — steps 3–4 |
| Charts / ECharts adapter | **NOT STARTED** — step 5 |
| Narrative sections + hero | **NOT STARTED** — steps 6–7 |
| Responsive / a11y / performance passes | **NOT STARTED** — step 8 |
| Production-ready frontend | **NOT STARTED** |

`web/` now contains a **running application shell** with the data and design
foundations wired into it. It is not the product: there is no `components/`, no
`content/`, and the narrative is a static list of ten section names. `npm run
build` succeeds and `npm run test:e2e` passes, which was not true before this
phase.

---

## 6. Dependencies / environment

### Node runtime — installed this session

The previous device ran Node 22.23.2. This device shipped **Node 20.20.2**, which
does **not** satisfy `web/package.json`'s `engines: { node: ">=22.6" }` and cannot
run the Phase 3A test suite (the tests import `.ts` files directly and depend on
Node's type stripping, added in 22.6).

Installed **Node v22.23.2 (Jod LTS)** in user space — no sudo, no system package
changes:

1. Downloaded the official `node-v22.23.2-linux-x64.tar.xz` from `nodejs.org`.
2. Verified SHA-256 against the official `SHASUMS256.txt`:
   `d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307` → **OK**.
3. Extracted to `~/.local/lib/nodejs/node-v22.23.2-linux-x64`.
4. Symlinked `node`, `npm`, `npx`, `corepack` into `~/.local/bin`, which is
   already ahead of `/usr/bin` on `PATH`, so no shell rc file was modified.

| Tool | Before | Now | Path |
| --- | --- | --- | --- |
| node | 20.20.2 | **22.23.2** | `~/.local/bin/node` |
| npm | 12.0.2 | **10.9.8** (bundled with Node 22) | `~/.local/bin/npm` |

Verified on the new runtime: satisfies `>=22.6`; runs `.ts` files with no flag;
`node --test` executes `.ts` tests importing `.ts` modules.

The system Node 20.20.2 at `/usr/bin/node` is left untouched.

### npm registry

**Reachable.** `npm ping` → PONG (488 ms); registry root, packuments and a real
tarball all return HTTP 200; no proxy configured; no `.npmrc` at user or system
level. The Phase 3B E403 blocker recorded on the previous device **no longer
exists**.

### Frontend dependencies — INSTALLED

Installed into `web/node_modules` (≈695 MB, git-ignored). `web/package-lock.json`
is **committed**: `lockfileVersion 3`, **443 locked packages**.
`npm ci --dry-run` exits 0, confirming the lockfile is in sync with
`package.json`.

Runtime (`dependencies`), exact-pinned — no `^`, no `~`:

| Package | Version |
| --- | --- |
| `next` | 16.3.5 |
| `react` | 19.3.0 |
| `react-dom` | 19.3.0 |
| `echarts` | 6.1.0 |
| `zod` | 4.6.5 |

Dev (`devDependencies`), exact-pinned:

| Package | Version |
| --- | --- |
| `typescript` | 6.0.3 |
| `@types/node` | 22.20.2 |
| `@types/react` | 19.3.0 |
| `@types/react-dom` | 19.3.0 |
| `eslint` | 10.10.0 |
| `@eslint/js` | 10.0.1 |
| `typescript-eslint` | 8.70.0 |
| `eslint-config-next` | 16.3.5 |
| `prettier` | 3.9.6 |
| `@playwright/test` | 1.63.0 |
| `tailwindcss` | 4.3.3 |
| `@tailwindcss/postcss` | 4.3.3 |

Two version constraints were forced by real peer ranges, not preference:

- **TypeScript is held below 7.** `typescript-eslint@8.70.0` declares
  `peerDependencies.typescript: ">=4.8.4 <6.1.0"`, so the registry-latest
  `typescript@7.x` cannot be used with the lint stack. `6.0.3` is the newest
  compatible release and it type-checks the Phase 3A tree cleanly.
- **`@types/node` tracks the runtime major** (22.x), not the registry `latest`
  (26.x). Matching types to the actual runtime is the point.

`echarts-for-react` is **deliberately absent**. `docs/product-architecture.md` §10
step 5 specifies the project builds its own `EChart` + `ChartFrame` +
`ChartTableFallback` + theme adapter over the `ChartTheme` contract in
`web/src/styles/chart-language.ts`. A third-party wrapper would duplicate that and
obscure the token-driven theming.

Two benign observations, recorded so they are not re-investigated:

- `npm ls --depth=0` labels a handful of `@emnapi/*`, `@img/sharp-wasm32`,
  `@napi-rs/wasm-runtime` and `@tybys/wasm-util` entries **"extraneous"**. All of
  them *are* present in the lockfile as `optional: true` cross-platform wasm
  fallbacks for `sharp` (Next's image optimiser). `npm ls` exits 0. Not a problem.
- Next.js anonymous telemetry was **opted out** (`npx next telemetry disable`) to
  avoid unnecessary outbound requests from the build.

Playwright's **chromium binary is installed** as of Phase 3C:
`npx playwright install chromium` fetched Chrome Headless Shell 153.0.8010.12
(playwright build v1243) plus ffmpeg v1011 into `~/.cache/ms-playwright`. The
installer warns that this OS is not officially supported and falls back to the
`ubuntu24.04-x64` build; it works. Firefox and WebKit are **not** installed, and
`playwright.config.ts` therefore declares a chromium-only project — configuring
engines whose binaries are absent would produce failures that look like
application bugs.

### npm scripts (`web/package.json`)

| Script | Command | Works now? |
| --- | --- | --- |
| `dev` | `next dev` | **yes** |
| `build` | `next build` | **yes, clean** — 3 static routes, no warnings |
| `start` | `next start` | **yes** (after a build) |
| `typecheck` | `tsc -p tsconfig.json` | **yes, clean** |
| `lint` | `eslint .` | **yes, clean** |
| `lint:fix` | `eslint . --fix` | yes |
| `test` | `node --test` | **yes, 109/109** |
| `test:e2e` | `playwright test` | **yes, 8/8** (added in Phase 3C) |
| `format` | `prettier --write .` | yes |
| `format:check` | `prettier --check .` | **yes, clean** |
| `verify` | `typecheck && lint && test && format:check` | **yes, all green** |

`verify` is the fast gate and does **not** include `test:e2e`, which builds the app
and starts a server. Run `npm run test:e2e` explicitly, or after `npm run verify`.
`node --test` needs no loader flag: the tests import `.ts` directly and Node ≥22.6
strips types natively.

### Python — dev environment restored

The repository **already declared** the mechanism, so none was invented:
`pipeline/pyproject.toml` → `[project.optional-dependencies] dev = ["pytest>=8", "ruff>=0.6", "mypy>=1.11"]`.

Restored with `uv pip install -e ".[dev]"` from `pipeline/`, into the repo-root
`.venv` (git-ignored):

| Tool | Version |
| --- | --- |
| Python (venv) | 3.11.16 (uv-managed CPython) |
| `pytest` | 9.1.1 |
| `ruff` | 0.16.7 |
| `mypy` | 2.3.1 |
| `oil-ev-pipeline` | 1.0.0, editable |

Version notes:

- The venv is **Python 3.11.16**, while `/usr/bin/python3` on this device is
  **3.14.7**. 3.11 is the correct target: `requires-python = ">=3.11"`,
  `[tool.ruff] target-version = "py311"`, `[tool.mypy] python_version = "3.11"`.
- The editable install is what makes plain `python -m pipeline.build` work; the
  `src/` layout otherwise requires `PYTHONPATH=src`. **The analytical runtime
  itself is unchanged** — still zero runtime dependencies, still stdlib-only.
  `dev` is an optional extra and `scipy`/`numpy` were *not* installed, so
  `tests/test_statistics_scipy.py` still skips.
- One snag: `uv` aborted the first attempt with
  `Failed to acquire lock on the distribution cache … Timeout (300s)` on
  `~/.cache/uv/wheels-v6/pypi/mypy/2.3.1-*.lock`. It was a stale zero-byte lock
  left by the previous interrupted session — `pgrep uv` found no process and
  `fuser` found no holder. Removing that one cache lock file resolved it.

---

## 7. Decisions made

| Decision | Rationale |
| --- | --- |
| Restore Phase 3A by `git merge --no-ff` rather than cherry-pick | Preserves the original Phase 3A commit history and the PR #2 merge; verified conflict-free beforehand |
| Node **22 LTS (22.23.2)**, not 24 | Satisfies `engines >=22.6`; matches the exact runtime the Phase 3A code was authored and validated against, maximising reproducibility of the 109-test baseline; also satisfies ESLint 10's `^22.13.0`. Node 24 LTS is the documented future upgrade path |
| Node installed from official tarball into `~/.local`, checksum-verified | No sudo available or needed; no system packages touched; avoids trusting a third-party version manager |
| Git identity supplied via env vars, not `git config` | Leaves the user's git configuration unmodified while matching the identity of all prior Kiro commits |
| Analytical layer treated as read-only for this whole task | Only `--check` / `--legacy` (both read-only hash comparisons) are run against the pipeline |
| Exact-pin every frontend dependency (no `^`/`~`) | The lockfile already pins transitively; exact ranges in `package.json` make an unintended major bump impossible to introduce silently by editing one file |
| `typescript@6.0.3`, not 7.x | Forced by `typescript-eslint@8.70.0`'s peer range `<6.1.0`. Choosing the lint stack over the newest compiler keeps a real gate rather than a nominal one |
| Created `web/postcss.config.mjs` in the bootstrap | Installing `@tailwindcss/postcss` without it leaves the required PostCSS integration nominal — a dependency in the committed lockfile that does nothing. This is configuration, not UI |
| Did **not** create `web/next.config.mjs` | Next runs on defaults; it is not needed for the dependency baseline, and it cannot be validated with no `app/`. Belongs to the scaffold in §10 step 1 |
| Did **not** wire Tailwind `@theme` tokens or a CSS entrypoint | That is `docs/design-system.md` §8 and `docs/product-architecture.md` §10 step 1 — UI phase, and the boundary for this task |
| Left `tsconfig.json` Node-only (`lib: ["ES2023"]`, no `jsx`, no `.tsx` in `include`) | It type-checks clean today. Adding the DOM lib and JSX support with zero React source present would change type resolution for existing Node code with nothing to validate against. The UI phase adds them together with the first `.tsx` file |
| ESLint TS/Next rules scoped to `.ts`/`.tsx` | Not stylistic — unscoped, ESLint 10 + `@typescript-eslint/scope-manager@8` throw a `TypeError` on `.mjs` config files. See §4 |
| Restored Python tooling via the repo's own `dev` extra into `.venv` | The mechanism was already declared in `pipeline/pyproject.toml`; no new dependency-management architecture was invented |
| Opted out of Next.js telemetry | Avoids unnecessary outbound requests from the build |
| **Phase 3C** — map tokens with `@theme inline` same-name self-reference | The only form that yields ergonomic utilities (`bg-surface`) while keeping `tokens.css` the single source of truth. Verified by compiling the pattern and by two in-browser computed-colour assertions |
| Import `tokens.css` unlayered, after `tailwindcss` | Unlayered declarations outrank `@layer theme`, so the real token values beat Tailwind's circular copy. Load-bearing, and documented as such in `globals.css` |
| Removed Tailwind's default colour palette and radius above `xl` | Both were competing token systems able to bypass documented design-system rules by accident. Enforcing the rules in the build is stronger than enforcing them by review |
| Consume semantic rhythm tokens as `p-(--card-padding)` rather than naming them in `@theme` | They change value under 768px inside `tokens.css`; giving them utility names would split one responsive decision across two files |
| App loader at `src/lib/artifacts.ts`, not `src/data/` | `analytical-safety.test.ts` asserts the exact file list of `src/data/`. Adding a file there would have required weakening a guardrail; adding it elsewhere costs nothing |
| `tsconfig` moved to `esnext` / `bundler` | Turbopack is a bundler, and `nodenext` would require `with { type: "json" }` attributes to import the artifacts. No source file changed — imports already carry explicit `.ts` extensions |
| Wrote Next's four mandatory `tsconfig` options explicitly | `next build` silently rewrites `tsconfig.json` when `jsx`, `esModuleInterop`, `allowJs` or `incremental` are missing, leaving a dirty tree after every build. Stating them keeps the file stable |
| Still **no** `paths` aliases | `node --test` resolves imports itself and ignores tsconfig `paths`. An alias would type-check and then fail at runtime in the test suite |
| No statistics rendered on the scaffold page | §16 requires the specification caveat beside any level correlation. A coefficient with nowhere to qualify it is the original project's error. Asserted by an E2E test |
| Playwright specs named `*.e2e.ts` | `node --test`'s default patterns include `**/*.test.ts`; a Playwright spec collected by the Node runner fails confusingly |
| E2E runs against `next build` output, not `next dev` | The CSS pipeline and RSC rendering both differ in development, and production output is what ships |

---

## 8. Known issues / blockers

**No blockers.** Every environment issue carried into this session is resolved.

Open items, none blocking:

- **`src/data/validate.ts` is still the hand-rolled validator.** Replacing it with
  Zod behind the same accessors is step 2 and is the immediate next task. Zod
  4.6.5 is already installed and currently unused.
- **Only chromium is installed for Playwright.** Firefox/WebKit binaries are
  absent, so cross-engine behaviour is unverified. The cyan/blue colourblind check
  and the screen-reader pass in `docs/product-architecture.md` §5 also remain
  outstanding — they belong to step 8.
- **No axe-core accessibility scan yet.** §5 requires it in CI. The E2E harness now
  exists to host it, but the check is not written.
- **`next dev` is unverified in a browser.** Only the production build is
  E2E-tested, which is the deliberate choice recorded in §7.

Resolved this session:

| Previously open | Resolution |
| --- | --- |
| npm registry E403, no package access | **RESOLVED** — registry fully reachable on this device |
| Node runtime below `>=22.6` | **RESOLVED** — Node 22.23.2 installed in user space |
| `pytest` / `ruff` / `mypy` absent; Phase 2 gates unrunnable | **RESOLVED** — installed via the declared `dev` extra; all gates re-run and green (§9) |
| `web/types/node-minimal.d.ts` stopgap | **RESOLVED** — deleted; real `@types/node@22.20.2` installed |
| `.gitignore` missing `node_modules/` | **RESOLVED** — frontend ignore block added |
| Python test count: 191 vs README's 190 | **RESOLVED** — measured **191 collected, 191 passed, 1 module-level skip**. READMEs corrected; `docs/phase-2-validation.md` given a dated reconciliation note |
| Stale `uv` cache lock from the interrupted session | **RESOLVED** — no holding process; single stale lock file removed |
| **Singapore: editorial grouping vs statistical classification** | **RESOLVED in Phase 3C.** The two are different kinds of object and both stand, with `level_only_association` authoritative. Five binding rules recorded in §19 and mirrored as hard rule 5 in `docs/product-architecture.md` §3. The product may never imply Singapore lacks a level association |
| `tsconfig.json` not React-capable | **RESOLVED** — `jsx`, DOM libs, React types and `**/*.tsx` added; every Phase 3A strictness flag preserved |
| No `next.config.mjs`; `build`/`dev`/`start` unusable | **RESOLVED** — config added, build clean |
| Playwright browser binaries absent | **RESOLVED** — chromium installed; 8 E2E tests pass |

---

## 9. Validation status

All gates below were run on this device, in this session, on the committed tree.

**Analytical (read-only against the pipeline):**

| Gate | Command | Result |
| --- | --- | --- |
| Legacy replay | `python -m pipeline.build --legacy` | **MATCH** — `rows=29`, sha256 `e653ad8c6521dd35` |
| Artifact freshness | `python -m pipeline.build --check` | **PASS** — all 4 artifacts up to date |
| Artifacts unchanged by the merge | 4 git tree hashes + `git diff` | **PASS** — hashes identical, diff empty |

**Python (`pipeline/`):**

| Gate | Command | Result |
| --- | --- | --- |
| Tests | `python -m pytest` | **191 passed, 1 skipped** (6.58 s) |
| Collection | `python -m pytest --collect-only` | **191 tests collected** |
| Lint | `ruff check .` | **All checks passed** |
| Format | `ruff format --check .` | **21 files already formatted** |
| Types (src, strict) | `mypy src` | **Success — no issues in 11 source files** |
| Types (src + tests) | `mypy` | **Success — no issues in 20 source files** |

The single skip is `tests/test_statistics_scipy.py` (module-level): *"SciPy not
installed; stdlib implementations validated against published values instead."*
SciPy is deliberately not installed — the `validate` extra was not requested.

**Frontend (`web/`):**

| Gate | Command | Result |
| --- | --- | --- |
| Tests | `npm test` (`node --test`) | **109 / 109 pass**, 0 fail, 0 skipped |
| Types | `npm run typecheck` (`tsc`, strict) | **clean**, exit 0 |
| Lint | `npm run lint` (`eslint .`) | **clean**, exit 0, no warnings |
| Format | `npm run format:check` (`prettier`) | **clean** |
| Combined | `npm run verify` | **exit 0** |
| Lockfile sync | `npm ci --dry-run` | **exit 0** — lockfile in sync with `package.json` |
| Production build | `npm run build` | **PASS** — compiled in 717 ms, 3 static routes (`/`, `/_not-found`), **no warnings** |
| Browser E2E | `npm run test:e2e` | **8 / 8 pass** (chromium, against the production build) |

The 109-test Phase 3A suite is **unchanged** — no test was added to it, deleted,
skipped or rewritten, and the count is identical before and after Phase 3C.

The eight E2E tests cover: one `h1` plus all three landmarks; the skip link as
first tab stop, becoming visible on focus and targeting `#main-content`; the
observation period and five market labels read from artifacts; the comparability
constraint; the absence of any coefficient or p-value; and — the checks that could
not exist before a browser — computed `background-color` in **light** and **dark**
themes, plus a mapped country token resolving through the primitive chain to
`rgb(8, 145, 178)`.

No test was deleted, skipped or weakened; no TypeScript strictness flag was
relaxed; no analytical file was modified to make a frontend gate pass.

### Baseline commit

**`f950e2b` — "chore: restore frontend foundation and bootstrap dependencies"**
(parent `97d1a5c`). 12 files changed, +7,840 / −112. `node_modules/` is not
tracked; `web/package-lock.json` is.

```text
.gitignore  KIRO.md  README.md  docs/phase-2-validation.md  pipeline/README.md
web/README.md  web/eslint.config.mjs  web/package-lock.json  web/package.json
web/postcss.config.mjs  web/tsconfig.json  web/types/node-minimal.d.ts (deleted)
```

`main` is **ahead of `origin/main` and has not been pushed** — `origin/main` is
still at `d19a7c7` (the Phase 2 merge). Phase 3A (`97d1a5c`) and this baseline
both exist only locally. Pushing `main` was left to the user's discretion.
Check with `git status -sb` / `git log --oneline origin/main..main`.

Artifact hashes verified identical before and after the merge:

```text
panel.json      e446aeb525e12d5b5ff3a0291fa1d06260aa46e7ab45da8cf5b8c032596d471c
metrics.json    5e5f43bf255b1ff70715e391a13b786b55b23128a1e1388fbff8c98674fb4002
countries.json  6789e21c6b3a3aa019832348995e7545b8f5b4cbff88697284ba22687e4ee1fb
claims.json     c46072971a2b59e7b0199351cec59c8c12bf5b53cc0c374c8629b17459112231
```

Every number in §15–§17 was reconciled against `metrics.json` and
`reports/VALIDATION_REPORT.md` this session and matches exactly.

---

## 10. Next step

**Phase 3C step 2 — replace the hand-rolled validator with Zod, behind the same
accessors.**

`docs/product-architecture.md` §10 step 2. Zod 4.6.5 is installed and currently
unused.

The seam already exists and is the reason this step is cheap: `src/data/index.ts`
is the only module application code imports, and `createArtifactBundle` is the
single boundary between untyped JSON and the typed application. The work is to
reimplement `src/data/validate.ts` with Zod schemas while keeping:

1. **The same public surface.** `src/data/index.ts` exports must not change, so
   neither `web/src/lib/artifacts.ts` nor any test needs editing.
2. **`ContractError` with a precise failing path.** The current validator names
   the exact JSON path that failed; Zod's `issues` must be mapped onto that, not
   replaced by a raw `ZodError`.
3. **All 109 tests passing untouched.** `tests/validator.test.ts` is the
   specification for this step — it already asserts the error behaviour, so it is
   the acceptance criterion. Do not edit it to fit the new implementation.
4. **The `src/data/` file list unchanged**, or `analytical-safety.test.ts` fails.
   Replace the contents of `validate.ts`; do not add a module beside it.
5. **No statistical computation introduced** — the same test forbids it statically.

After that, step 3: `AppShell`, `Container`, `Section`, `SectionHeader`, `Header`,
`Navigation`. Note that `layout.tsx` currently inlines a rudimentary header and
footer; step 3 should extract them into the contracted components rather than
grow them in place.

Reminder for every remaining step: the frontend **must not compute a statistic**,
`web/src/data/generated/` is pipeline-owned and must never be edited or
reformatted from the frontend, and the Singapore rules in §19 bind all narrative
copy.

---

## 11. Phase history

| Phase | Description | Status |
| --- | --- | --- |
| Phase 1 | Repository/project audit | **COMPLETE** |
| Phase 2 | Analytical remediation and reproducibility | **COMPLETE** — merged to `main` as `d19a7c7` |
| Phase 3 | Product transformation direction | **COMPLETE** — direction locked |
| Phase 3A | Frontend/data/design foundations | **COMPLETE** — authored on `phase-3a-frontend-foundation`, restored to `main` as `97d1a5c` |
| Phase 3B | Dependency bootstrap (environment baseline) | **COMPLETE** — all 10 steps; validated baseline committed |
| Phase 3C | Frontend/UI implementation | **IN PROGRESS** — step 1 of 8 complete |

### Phase 2 validation record

191 Python tests passed, 1 skipped; ruff clean; mypy clean; reproducibility
checks passed; two independent builds byte-identical for
panel/metrics/countries/claims; deterministic bootstrap configured; artifact
validation passed; clean build passed; legacy analytical replay byte-identical;
freshness checks passed.

### Phase 3B bootstrap record

Phase 3A restored to `main` (`97d1a5c`); Node 22.23.2 installed in user space;
12 dev + 5 runtime frontend dependencies installed and exact-pinned;
`web/package-lock.json` committed (443 packages, `npm ci --dry-run` clean);
ESLint flat config and PostCSS/Tailwind wiring added; `node-minimal.d.ts`
stopgap deleted in favour of real `@types/node`; Python dev tooling restored via
the repo's declared `dev` extra; 109/109 frontend tests, 191/1 Python tests,
tsc/eslint/prettier/ruff/mypy all clean; legacy replay MATCH and artifact
freshness PASS with the analytical tree provably unmodified. No UI implemented.

### Phase 3A implementation record

Framework-independent data contract; artifact validation; data accessors;
frontend/data tests; design tokens; chart-language contract; accessibility
contract; ReadMore contract; product/design architecture documentation.
109 frontend/data tests passing; TypeScript checks clean; Prettier clean.

Phase 3A did **not** constitute the finished frontend.

---

# PART B — STABLE CONTRACT

## 12. Product direction (locked)

The final product should feel like a serious, modern analytical intelligence
product, inspired by Primora, Vercel and modern SaaS/data-intelligence products.

Prioritise: strong typography, generous whitespace, clear visual hierarchy,
subtle borders, layered surfaces, editorial composition, restrained visual
language, useful chart interactions, responsive behaviour, accessibility,
controlled motion.

Avoid: a prettier Streamlit clone, generic BI-dashboard aesthetics, excessive KPI
cards, dense card grids, rainbow charts, unnecessary gradients, decorative hero
graphics, excessive animation, coefficient-first presentation, visualizations
without interpretation.

The product should tell a coherent analytical story.

## 13. Analytical source of truth

The analytical source of truth is the Python pipeline and its generated
artifacts. **The frontend must NOT independently calculate statistical results.**

Core sources: FRED Brent crude `DCOILBRENTEU`; Google Trends country-level EV
interest.

Core transformation: daily Brent → weekly resampling → `$/barrel` converted to
`$/litre` (158.987294928 L/barrel) → weekly merge with Trends → five-country
analytical panel.

Countries: Indonesia, United States, Singapore, Malaysia, Norway (plus a
Worldwide series).

## 14. Google Trends interpretation guardrail

Google Trends country series are independently normalised, each with its own
maximum of 100.

**Valid:** within-country changes, within-country timing, within-country shape,
association between oil and EV interest within a country.

**Invalid:** interpreting absolute Trends levels as comparable across countries;
creating cross-country averages of Trends levels.

## 15. Definitive analytical results

Established ground truth — every figure below was re-verified against
`metrics.json` and `reports/VALIDATION_REPORT.md` on 2026-09-15.

### Level Pearson correlations

| Series | Pearson r | p-value | Spearman rho | Bootstrap CI |
|---|---:|---:|---:|---:|
| Worldwide | 0.7269 | 0.000005 | 0.7212 | [0.545, 0.887] |
| United States | 0.7466 | 0.000002 | 0.5274 | [0.507, 0.865] |
| Singapore | 0.5796 | 0.00079 | 0.5102 | [0.284, 0.756] |
| Malaysia | 0.2203 | 0.242 | 0.2017 | [-0.001, 0.471] |
| Norway | 0.1460 | 0.441 | 0.1449 | [-0.156, 0.443] |
| Indonesia | -0.0191 | 0.920 | 0.1152 | [-0.181, 0.270] |

### Oil shock

- Oil peak week `2026-03-15`; peak Brent `$111.40/barrel`
- Equivalent crude benchmark ≈ `$0.7007/litre` (crude, **not** a pump price)
- Elevated-regime onset `2026-03-01`, week-over-week `+19.5%`
- Baseline weeks 26; elevated weeks 4; total observations `n = 30`

### Descriptive findings

- Crude rose approximately **66.6%** (first week → peak week;
  `global.oil.total_pct_change_first_to_max = 66.6287731475`).
- EV interest increased in all five countries.
- Country peaks were **NOT** synchronised in a single month
  (`synchronised_within_one_month: false`, 3 distinct months, 9-week span).

Peak weeks: Norway `2026-01-25`, Indonesia `2026-02-15`, Malaysia `2026-02-15`,
Singapore `2026-03-08`, United States `2026-03-29`.

The previous claim that the peaks were synchronised in a single month is FALSE
and must never be restored.

## 16. Critical robustness finding

One of the most important analytical conclusions in the project.

| Series | Level Pearson | First-difference | Detrended |
| --- | ---: | ---: | ---: |
| Worldwide | 0.727 | -0.116 | 0.527 |
| United States | 0.747 | 0.133 | 0.541 |
| Singapore | 0.580 | 0.089 | 0.164 |
| Malaysia | 0.220 | -0.148 | -0.283 |
| Norway | 0.146 | 0.143 | -0.505 |
| Indonesia | -0.019 | -0.087 | -0.448 |

**Zero of six series survive first differencing as a positive relationship.**

Both oil prices and Google Trends generally trend upward during the study
window, so a simple level correlation can capture shared time trends.

This robustness/specification comparison MUST be a first-class narrative section
immediately after the Global Relationship section. It must NOT be hidden in a
methodology footnote.

## 17. Country classifications

| Country | Classification | Robustness | Key detail |
| --- | --- | --- | --- |
| Indonesia | `no_detectable_association` | fragile, regime-sensitive | baseline-only r = 0.453, p = 0.020 |
| Norway | `no_detectable_association` | fragile | detrended r = -0.505, p = 0.004 |
| Malaysia | `inconclusive` | fragile | EV peak precedes oil elevated-regime onset by ≈4 weeks |
| Singapore | `level_only_association` | moderate | baseline-only r = 0.304, p = 0.132 |
| United States | `level_only_association` | moderate | survives elevated-regime removal (r = 0.408, p = 0.038); does NOT survive first differencing |

**No country reaches a robust positive association.**

## 18. Lag analysis guardrails

Primary alignment `k = 0` (same seven-day weekly window). An earlier accidental
alignment used `k = +1`; do not silently reproduce it.

Lag scan `k = -4 … +4`, minimum 20 paired observations. Unrestricted maximum
correlations are often negative/unstable and are flagged as potential
trend/specification artifacts. The US `k = +2`, r ≈ 0.841, is post-hoc and
uncorrected.

Do NOT present lag analysis as evidence of causality. No causal claims are
permitted.

## 19. Product narrative

1. Context
2. Oil Shock
3. EV Interest
4. Global Relationship
5. Robustness / Specification Comparison
6. Country Divergence
7. Country Deep Dives
8. Interpretation
9. Limitations
10. Conclusion

### Executive summary framework

These four panels are an **editorial framework**, not a statistical result. They
are interpretive groupings layered on top of the machine classifications, and all
three named panels carry `requires_external_evidence: true`.

- **Subsidized Buffer** — Indonesia
- **Maturity Gap** — Norway + Singapore *(editorial grouping — see below)*
- **Co-Movement Case** — United States + Worldwide
- **Separate Inconclusive Case** — Malaysia

The previous concept named **"Proactive Shift"** was invalidated. Do NOT restore
or reuse it as an analytical conclusion.

#### Singapore: editorial grouping vs statistical classification — RESOLVED

The editorial and statistical groupings genuinely disagree about Singapore, and
that is permitted **only** because they are different kinds of object:

| | Grouping | Status |
| --- | --- | --- |
| **Statistical** | `level_only_association` — Singapore with the **United States** | **Authoritative.** From `metrics.json` → `classification.evidence_group` |
| **Editorial** | **Maturity Gap** — Singapore with **Norway** | Interpretive. From `docs/analytical-decision-memo.md` §6 |

Rules, now binding (mirrored as hard rule 5 in `docs/product-architecture.md` §3):

1. `level_only_association` is the authoritative statistical classification for
   Singapore. Nothing in the product may contradict it.
2. "Maturity Gap" may be retained, but must be presented as an **editorial /
   interpretive grouping**, never as a discovered cluster.
3. Wherever Singapore appears inside Maturity Gap, its evidence group must be
   visible **in the same view**.
4. The product must **never state or imply that Singapore shows no level
   association.** Singapore is r = 0.580, p = 0.0008 — a real level association.
   Norway, its editorial co-member, is `no_detectable_association`. They are not
   statistical peers.
5. The honest form of the Singapore claim is the decision memo's: it responds, but
   the association is carried by the elevated-price episode and does not survive
   its removal — `loses_significance_without_elevated_regime`, baseline-only
   r = 0.304, p = 0.132.

## 20. Interactive chart requirements

Charts support zoom, pan, reset, tooltip, legend interaction and responsive
resizing where appropriate; and have clear axes, correct units, useful
annotations, readable labels, and an accessible fallback/table representation
where appropriate.

Use `Read More` patterns for longer analytical explanations. Charts support the
narrative rather than replace it.

## 21. Target architecture

```text
Python analytical pipeline
        ↓
Generated static JSON artifacts
        ↓
Next.js frontend
        ↓
Interactive client-side charts
```

Expected frontend concepts:

```text
web/
  src/
    data/generated/        panel.json metrics.json countries.json claims.json manifest.json
    content/               methodology/ limitations/ conclusion/ countries/ summary/
    components/charts/     ChartFrame  EChart  options/  ChartTableFallback
```

The exact structure may evolve; the principle must not:
**Python owns analysis. Frontend owns presentation.**

## 22. Generated artifacts

```text
web/src/data/generated/panel.json      metrics.json  countries.json
                       claims.json     manifest.json
reports/VALIDATION_REPORT.md
```

These form the machine-readable contract between pipeline and frontend. Do not
casually rewrite them from React. Regenerate with `python -m pipeline.build`;
verify freshness with `python -m pipeline.build --check`.

Frontend rules restated from `web/README.md`: never compute a statistic; never
compare interest levels across series; never render a claim as fact unless
`publishable_as_fact` is true; never call the crude price a pump price.

## 23. Non-negotiable analytical language

**Use:** "associated with", "co-movement", "level correlation", "consistent
with", "suggests", "inconclusive", "no detectable association",
"specification-sensitive".

**Do NOT use:** "caused", "causes", "drove", "led to", "triggered", "proved that
oil prices increased EV interest" — unless a future analysis explicitly
establishes causal identification, which this project does not.

## 24. Key principle

The project is not trying to prove that an oil shock caused EV interest. It asks:

**Where did oil-price movement and EV search interest move together, how strong
was that apparent relationship, and how much of it survives reasonable
specification checks?**

The most important insight is that apparent level co-movement exists in some
series, but **none of the six series survives first differencing as a positive
relationship**. The final product must make that nuance visible, understandable
and central.
