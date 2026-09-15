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

**Phase 3B — Dependency Bootstrap: COMPLETE. Frontend implementation: NOT
STARTED.**

The bootstrap/recovery task is finished: Phase 3A is on `main`, the Node runtime
is fixed, dependencies are installed and locked, the Phase 3A green baseline is
re-established on real tooling, the Python dev gates are restored, and the
analytical layer is verified unchanged. **No UI was built in this task** — that
was an explicit boundary, not an omission.

| # | Step | Status |
| --- | --- | --- |
| 1 | Restore Phase 3A onto `main` | **COMPLETE** |
| 2 | Update `KIRO.md` | **COMPLETE** |
| 3 | Install Node ≥ 22.6 in user space | **COMPLETE** |
| 4 | Install frontend dependencies + lockfile | **COMPLETE** |
| 5 | Establish `package.json` scripts | **COMPLETE** |
| 6 | Re-establish Phase 3A green baseline | **COMPLETE** — 109/109, tsc/eslint/prettier clean |
| 7 | Restore Python dev environment | **COMPLETE** — pytest/ruff/mypy via the declared `dev` extra |
| 8 | Validate analytical layer unchanged | **COMPLETE** — legacy MATCH, `--check` PASS, diff empty |
| 9 | Update `KIRO.md` again | **COMPLETE** (this rewrite) |
| 10 | Commit the clean baseline | **COMPLETE** — see §9 |

The next session starts the **UI implementation phase**: `docs/product-architecture.md`
§10 step 1. See §10.

---

## 4. Completed work

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
| Real Next.js frontend | **NOT STARTED** — next phase |
| Browser / visual QA | **NOT STARTED** |
| Production-ready frontend | **NOT STARTED** |

What exists in `web/` today is a **framework-independent foundation plus a
validated dependency baseline** — not an application. There is no `app/`, no
`components/`, no `content/`, and no `next.config.mjs`. `npm run build` fails with
"Couldn't find any `pages` or `app` directory", which is the **expected** state at
this boundary and confirms the Next.js toolchain itself resolves and executes.
Phase 3A was never the finished frontend, and neither is this.

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

Playwright's *package* is installed; its **browser binaries are not downloaded**.
That is intentional — no browser test exists yet. The UI phase will need
`npx playwright install` before any end-to-end run.

### npm scripts (`web/package.json`)

| Script | Command | Works now? |
| --- | --- | --- |
| `dev` | `next dev` | needs `app/` — UI phase |
| `build` | `next build` | needs `app/` — UI phase |
| `start` | `next start` | needs a completed build |
| `typecheck` | `tsc -p tsconfig.json` | **yes, clean** |
| `lint` | `eslint .` | **yes, clean** |
| `lint:fix` | `eslint . --fix` | yes |
| `test` | `node --test` | **yes, 109/109** |
| `format` | `prettier --write .` | yes |
| `format:check` | `prettier --check .` | **yes, clean** |
| `verify` | `typecheck && lint && test && format:check` | **yes, all green** |

`verify` is the single command for the whole frontend gate. `node --test` needs no
loader flag: the tests import `.ts` directly and Node ≥22.6 strips types natively.

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

---

## 8. Known issues / blockers

**No blockers.** Every environment issue carried into this session is resolved.

Open items, none blocking:

- **Playwright browser binaries are not installed** (package only). The UI phase
  must run `npx playwright install` before the first end-to-end test.
- **`tsconfig.json` is not yet React-capable.** Needs `jsx`, the DOM lib,
  `@types/react` in `types`, and `**/*.tsx` in `include` — added in the UI phase
  alongside the first component. Deliberate; see §7.
- **No `next.config.mjs`**, and `npm run build` / `dev` / `start` therefore cannot
  succeed yet. Expected at this boundary; see §5.
- **Editorial reconciliation needed before narrative copy is written:** §19's
  executive-summary framework groups "Maturity Gap = Norway + Singapore", while
  the machine grouping in `metrics.json` `global.evidence_groups` places
  Singapore with the US (`level_only_association`) and Norway with Indonesia
  (`no_detectable_association`). `docs/analytical-decision-memo.md` records the
  editorial grouping as deliberate and supported, but the site must not imply
  Singapore lacks a level association. **Still open — this is the one carried item
  with analytical consequences.**

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
| Format | `npm run format:check` (`prettier`) | **clean** — "All matched files use Prettier code style!" |
| Lockfile sync | `npm ci --dry-run` | **exit 0** — lockfile in sync with `package.json` |
| `next build` | `npm run build` | **fails as expected** — no `pages`/`app` dir; confirms the toolchain resolves and runs |

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

**The bootstrap is done. The next session begins the UI implementation phase at
`docs/product-architecture.md` §10 step 1.**

Exact next step:

> **Scaffold the Next.js App Router and wire the design tokens into the Tailwind
> theme.**

Concretely, that first unit of work is:

1. Create `web/app/layout.tsx` and `web/app/page.tsx` (App Router entrypoint), plus
   `web/app/globals.css` importing `@import "tailwindcss"` and the existing
   `web/src/styles/tokens.css`.
2. Add `web/next.config.mjs`.
3. Map `tokens.css` custom properties onto Tailwind utilities with `@theme`
   (Tailwind v4 CSS-first syntax) — closing `docs/design-system.md` §8's first
   deferred item.
4. Extend `web/tsconfig.json` for React: `"jsx": "preserve"`,
   `"lib": ["ES2023", "DOM", "DOM.Iterable"]`, `"types": ["node", "react"]`,
   and `"**/*.tsx"` in `include`. **Do not relax any strictness flag** —
   `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
   `verbatimModuleSyntax` and the rest stay exactly as they are.
5. Re-run `npm run verify`. `npm run build` must now succeed. The 109 existing
   tests must still pass untouched.

Then continue in §10 order: Zod swap behind the same accessors (step 2), layout
primitives (3), content primitives (4), the `EChart`/`ChartFrame`/
`ChartTableFallback` adapter (5), then Hero + Robustness (6) — the two sections
that set the honest tone.

Before writing any narrative copy, settle the Singapore grouping question in §8.

Reminder for that phase: the frontend **must not compute a statistic**, and
`web/src/data/generated/` is pipeline-owned and must never be edited or
reformatted from the frontend.

---

## 11. Phase history

| Phase | Description | Status |
| --- | --- | --- |
| Phase 1 | Repository/project audit | **COMPLETE** |
| Phase 2 | Analytical remediation and reproducibility | **COMPLETE** — merged to `main` as `d19a7c7` |
| Phase 3 | Product transformation direction | **COMPLETE** — direction locked |
| Phase 3A | Frontend/data/design foundations | **COMPLETE** — authored on `phase-3a-frontend-foundation`, restored to `main` as `97d1a5c` |
| Phase 3B | Dependency bootstrap (environment baseline) | **COMPLETE** — all 10 steps; validated baseline committed |
| Phase 3C | Frontend/UI implementation | **NOT STARTED** — begins at `docs/product-architecture.md` §10 step 1 |

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

- **Subsidized Buffer** — Indonesia
- **Maturity Gap** — Norway + Singapore
- **Co-Movement Case** — United States + Worldwide
- **Separate Inconclusive Case** — Malaysia

The previous concept named **"Proactive Shift"** was invalidated. Do NOT restore
or reuse it as an analytical conclusion.

See the reconciliation note in §8 regarding Singapore's placement.

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
