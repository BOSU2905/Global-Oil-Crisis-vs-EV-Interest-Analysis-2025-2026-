# KIRO.md — Living Project State

**Project:** Global Oil Crisis vs EV Interest Analysis (2025/2026)

**Last updated:** 2026-09-15 — Phase 3C step 4 of 8 COMPLETE (content components),
plus a Windows device-transition fix (typography diagnosis, Windows path defect,
line-ending determinism). Steps 1–4 done; step 5 is next.

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

**Phase 3C — Frontend/UI Implementation. Steps 1–4 of 8 COMPLETE.**

Phase 3B (dependency bootstrap) is complete and committed at `f950e2b`.

Phase 3C follows the eight-step order in `docs/product-architecture.md` §10:

| # | Step | Status |
| --- | --- | --- |
| 1 | Next.js + TypeScript + Tailwind scaffold; wire tokens into the Tailwind theme | **COMPLETE** |
| 2 | Swap the hand-rolled validator for Zod behind the same accessors | **COMPLETE** |
| 3 | `AppShell`, `Container`, `Section`, `SectionHeader`, `Header`, `Navigation` | **COMPLETE** |
| 4 | `Card`, `MetricCard`, `Badge`, `SourceNote`, `StatHighlight`, `ReadMore` (+ `Callout`) | **COMPLETE** |
| 5 | `EChart` + `ChartFrame` + `ChartTableFallback` + the ECharts theme adapter | **NEXT** |
| 6 | Hero (§2) and the Robustness section (05) | pending |
| 7 | Remaining narrative sections in order | pending |
| 8 | Responsive, accessibility and performance passes | pending |

**What steps 1–4 did not do, deliberately:** no narrative sections, no hero, no
charts, no country deep dives, no interpretation panels. The application renders a
shell, its own scope and the three blocks that describe that scope — now built from
the real content components. **No coefficient, p-value, interval or classification
appears anywhere in the UI**, and that is enforced by both a unit test and an E2E
test — see §4.

---

## 4. Completed work

### Phase 3C step 4 — content components — COMPLETE

Nine files created, three modified. Every component named in
`docs/product-architecture.md` §10 step 4 exists, plus `Callout`, which §4 of the
same document specifies and which step 3 explicitly deferred to here.

**Created**

```text
web/src/components/content/contract.ts       tones, the §16 metric gate, ReadMore ids
web/src/components/content/Card.tsx          the one card surface — must not float
web/src/components/content/MetricCard.tsx    one statistic + its structural caveat slot
web/src/components/content/Badge.tsx         caveat codes / evidence groups / verdicts
web/src/components/content/StatHighlight.tsx inline figure, mono + tabular
web/src/components/content/SourceNote.tsx    extracted from Footer
web/src/components/content/Callout.tsx       status-surface caveat block
web/src/components/content/ReadMore.tsx      the §6 disclosure (the only client component)
web/tests/content-contract.test.ts           20 tests
web/e2e/content.e2e.ts                       15 browser tests
```

**Modified:** `web/app/page.tsx` (recomposed with the content components),
`web/src/components/layout/Footer.tsx` (now composes `SourceNote`),
`web/e2e/typography.e2e.ts` (one selector — the numeric role moved from a `<dd>`
into a `MetricCard`).

#### §16 is now a compile error, not a convention

This is the substantive part of the step. KIRO.md §16 requires that a level
correlation never appear without the specification comparison beside it, because
zero of six series survive first differencing. Until now that rule lived in prose.

`MetricContent` in `contract.ts` is a discriminated union:

| Variant | Requires |
| --- | --- |
| `kind: "descriptive"` | nothing beyond label + value. Counts, dates, coverage |
| `kind: "inferential"` | `specification: string` **and** `caveats: readonly [MetricCaveat, ...MetricCaveat[]]` |

The tuple type is what makes "at least one caveat" checkable. **Verified against
`tsc`, not assumed** — a scratch file attempting both violations produced:

```text
error TS2322: Property 'specification' is missing in type … but required in type 'InferentialMetric'
error TS2322: Type '[]' is not assignable to type 'readonly [MetricCaveat, ...MetricCaveat[]]'
             Source has 0 element(s) but target requires 1
```

The scratch file was deleted. Three further layers back it up:

- `assertMetricDisplayable()` catches at runtime what a type cannot — a
  `specification` that is present but blank, or caveats whose codes are all
  whitespace. Both are unit-tested.
- `MetricCard` renders the specification line **unconditionally** for an
  inferential metric. There is no prop that hides it, and a test asserts no
  `hideSpecification` / `showSpecification` / `withoutCaveats` escape hatch has
  been added.
- `value` and `interval` are typed as **strings**, already formatted. A component
  cannot round a coefficient on its way to the screen, and `toFixed(` /
  `toPrecision(` are in the forbidden list the content-layer scan enforces.

#### Statistics are still absent from the UI, now for a sharper reason

Every metric the page renders is `kind: "descriptive"`: the coverage dates, the
weekly observation count and the market count. Those are observations the pipeline
made, not inferences it drew. Sections that can carry a specification comparison
are steps 6–7, so an inferential metric here would have nowhere to be qualified —
the original project's error. Two tests hold the line: a unit test asserts
`app/page.tsx` contains no `kind: "inferential"`, and an E2E test asserts the
rendered body still matches no `r =`, no `p =`, no "pearson" and no "other
specifications".

Building the gate *before* the sections that need it was the point of the ordering.

#### Component decisions worth knowing

| Component | Decision | Why |
| --- | --- | --- |
| `Card` | `shadow-none` written explicitly; `as` prop for `li`/`article` | design-system §1/§4: elevation is border + background delta. Stating it at the place someone would add a shadow is stronger than omitting it. `globals.css` does not even generate a card-sized shadow utility |
| `Badge` | `tone` defaults to `neutral`; children always rendered | §5 forbids colour as the sole cue. Three cues carry meaning and only one is colour; reaching for a colour must be deliberate |
| `MetricCard` | badge **and** sentence for every caveat | A badge alone puts the qualification in a `title` attribute, i.e. behind a hover. The accessibility contract does not allow that |
| `StatHighlight` | `label` is required, rendered as `aria-label` | An inline figure is the one place a number appears with no visible label. "31" reads fine and speaks badly |
| `SourceNote` | a move, not a rewrite | `Footer` already rendered `manifest.sources[]` in the right shape. A test asserts `Footer` no longer references `source.url`, so the list cannot grow back |
| `Callout` | four tones, each mapped to a badge tone | A callout whose surface and badge disagree is worse than either alone. `CALLOUT_BADGE_TONE` makes the pair a single decision |
| `ReadMore` | a real `<button>`, not `<details>`/`<summary>` | §6 asks for animated height, a deep-linkable open state and Escape-to-close. `<details>` gives none of the three reliably |
| `ReadMore` | the panel is **unmounted** when closed, not hidden | A hidden-but-present panel is reachable by find-in-page and by a screen reader in browse mode, which makes "collapsed" a lie |

#### Where the components are used, and the §6 hard rule

`ReadMore` is exercised on the provisional-week note, and the split respects §6:
the finding — that one week rests on fewer than five trading days — is in the
always-visible summary with the figure as a `StatHighlight`; only the charting
instruction is behind the disclosure. §6's list of statements that must never be
inside a `ReadMore` is unaffected, and the comparability guardrail is deliberately
*not* in one: a test asserts the `Callout` is not wrapped by a `ReadMore`, and an
E2E test asserts both the constraint and the remedy are visible without
interaction.

`Callout` replaced the inline warning surface `app/page.tsx` had carried since step
1 — the placeholder that step 3 recorded as waiting for exactly this component.

#### Two defects caught by looking rather than by a gate

Both were found in a rendered screenshot after the suite was green:

- `StatHighlight`'s unit rendered in the mono face, so "1 week" put a word in
  Consolas mid-sentence. The unit now takes the prose face; only the figure needs
  tabular alignment.
- The `MetricCard` caveat and the `ReadMore` summary said nearly the same sentence
  twice. The caveat is now terse ("1 week flagged as partial in the panel") and the
  summary carries the trading-day detail.

A third was caught by the browser instead: Tailwind v4's `shadow-none` does **not**
compute to the keyword `none` — it emits the composed shadow chain with every layer
transparent. The card test asserts no layer has colour rather than asserting the
keyword, which would have failed for the right reason and the wrong cause.

### Device transition to Windows — typography diagnosis and portability fixes — COMPLETE

The project moved from a Linux laptop to a Windows 11 PC and "looked different,
especially the typography". Diagnosed before changing anything. **The typography
difference is not a defect and no font declaration was changed.** Two unrelated
*real* portability defects were found while diagnosing it, and both are fixed.

#### The typography difference: cause established, no code change warranted

The product ships **no typeface**. Verified, not assumed:

- No `.woff`, `.woff2`, `.ttf`, `.otf` or `.eot` file anywhere in the repository.
- No `@font-face` rule in any stylesheet at runtime, and **zero** font requests of
  any kind on a page load (14 requests total, none for a font, none to
  `fonts.googleapis.com` / `fonts.gstatic.com`).
- No `next/font`, no `next/font/local`, no Google Fonts import.
- Exactly one font-family declaration site: `--font-sans` / `--font-mono` /
  `--font-numeric` in `tokens.css` §4, applied at `body` and `.numeric` in
  `globals.css`. No competing declaration, and Tailwind overrides nothing — the
  computed `font-family` on every element is the token stack verbatim.

That is the documented decision, in two places written before this session:
`tokens.css` principle 4 ("System font stacks only — no `next/font/google`, no
downloaded webfonts") and `docs/design-system.md` §3. So the typeface is chosen by
the operating system on purpose, and it therefore differs per machine.

What it resolves to here, measured in the browser by advance-width comparison
against two sentinel families:

| | Windows 11 + Chromium 153.0.8010.12 |
| --- | --- |
| `ui-sans-serif` | **does not resolve** — Safari-only keyword, ignored by Chromium |
| `system-ui` | resolves, metrically identical to `"Segoe UI"` → **wins the sans stack** |
| `-apple-system`, `BlinkMacSystemFont`, `"Helvetica Neue"`, `"Noto Sans"` | absent |
| `Roboto`, `Arial` | installed but never reached — `system-ui` precedes them |
| `ui-monospace`, `SFMono-Regular`, `"SF Mono"`, `Menlo`, `"Liberation Mono"` | absent |
| `Consolas` | resolves → **wins the mono/numeric stack** |

**The browser is not the variable.** Playwright installed Chrome Headless Shell
**153.0.8010.12 (build v1243)** on this PC — the identical build recorded for the
previous device in §6. Same engine, same CSS, different OS font layer.

Everything the project actually controls is identical and correct on this machine.
At 1280px and 375px, every role's computed `font-size`, `line-height`,
`letter-spacing` and `font-weight` equals its token value exactly (display 60/36px,
h2 32/24px, label 12px at 0.9px tracking, body 16px/26.88px, and so on); `.numeric`
carries `tabular-nums`; uppercase appears only on eyebrows; horizontal overflow is
0 at 375px; there are no console errors.

Two consequences of the system-stack decision are real and now documented in
`docs/design-system.md` §3 rather than left to be rediscovered:

- **`--weight-medium: 500` is not a distinct face on Windows.** Measured by
  drawing the same string to a canvas at each weight and hashing the pixels: 400
  is distinct, **500 and 600 are pixel-identical**, 700 is distinct. The design
  system's three weights collapse to two here — and collapse *differently* on a
  Linux face shipping only 400/700, where 500 renders as 400 and 600 as 700. This
  is the most likely thing that read as "the typography changed": heading and
  eyebrow emphasis is OS-dependent.
- **`--width-reading: 68ch` changes physical width with the face.** `1ch` is
  8.63px under Segoe UI at 16px, so the measure is 586.5px here. A different
  default face gives a different column width, hence different paragraph line
  counts and section heights from identical CSS.

Deliberately **not** done, and why:

| Not done | Reason |
| --- | --- |
| Bundle a webfont via `next/font/local` | Requires choosing a typeface. That reverses a decision recorded in two documents and changes the product's visual identity — a design decision for the user, not a diagnosis outcome. §1 forbids silent decisions of exactly this kind |
| `next/font/google` | Same, plus it reintroduces the build-time network dependency `design-system.md` §3 rules out |
| Change `--font-sans` ordering, or drop `ui-sans-serif` | It is inert in Chromium and correct in Safari. Removing it would change nothing on any machine and lose real coverage |
| Install a font on Windows | Would make one developer's machine the reference and leave the repository no more deterministic than before |
| Raise `--weight-medium` to 600 to "restore" emphasis | The tokens are not wrong; the platform face has no 500. Changing the token is a visual change with no evidence behind it |

The honest summary: **deterministic typography would require the project to ship a
typeface, which is a product decision that has not been made.** Everything short
of that is now deterministic and enforced by a test.

#### Defect 1: every `import.meta.url` path was wrong on Windows

`npm test` failed to load **all five** test files on this PC. Root cause, in four
files:

```ts
const here = fileURLToPath(import.meta.url);
const webRoot = join(here.slice(0, here.lastIndexOf("/")), "..");
```

On Windows `fileURLToPath` returns backslashes, so `lastIndexOf("/")` is **-1**,
`slice(0, -1)` drops the last *character* instead of the filename, and `webRoot`
resolves one directory too deep. The observable failure was
`ENOENT … web\tests\app\page.tsx`. The same idiom in `src/data/load-node.ts`
broke `generatedDir()`, which is why the two artifact test files failed as well.

Fixed by using `import.meta.dirname` (stable since Node 21.2, so inside the
declared `engines: >=22.6` floor) in `src/data/load-node.ts`,
`tests/analytical-safety.test.ts`, `tests/chart-language.test.ts` and
`tests/layout-contract.test.ts`. No assertion was changed, added, removed or
weakened: **120/120 pass**, the same count as before the move.

This was latent, not introduced by the move — the code was simply never run on
Windows.

#### Defect 2: line endings depended on the developer's git config

This PC has global `core.autocrlf=true`, so every tracked text file arrived in the
working tree as CRLF while the committed blobs are LF. Consequences, measured:

- `npm run format:check` failed on **37 files** — Prettier's default
  `endOfLine: "lf"` treats a CRLF file as unformatted. `npm run verify`, the
  project's own gate, could not pass on a clean checkout.
- The pipeline-owned artifacts no longer hashed to the values in §9. `panel.json`
  hashed `6e03f7a8…` on disk against a recorded `e446aeb5…`.

**The artifacts were never modified.** Proved by hashing three ways: the committed
blob, the bytes on disk, and the on-disk bytes with CRLF normalised to LF.

| Artifact | Committed blob | On disk (CRLF) | On disk, LF-normalised |
| --- | --- | --- | --- |
| `panel.json` | `e446aeb525e12d5b` | `6e03f7a841f3b0cf` | `e446aeb525e12d5b` |
| `metrics.json` | `5e5f43bf255b1ff7` | `63b3185d98d0bfbe` | `5e5f43bf255b1ff7` |
| `countries.json` | `6789e21c6b3a3aa0` | `ef4caef401727bf0` | `6789e21c6b3a3aa0` |
| `claims.json` | `c46072971a2b59e7` | `03809b6d8befd5c9` | `c46072971a2b59e7` |

Every committed blob matches §9 exactly, and LF-normalising the working copy
reproduces it. Only the checkout was different.

Fixed by adding **`.gitattributes`** with `* text=auto eol=lf`, which pins the
working tree to LF on every platform regardless of any machine's `core.autocrlf`,
and normalising the existing working tree to match. Binary extensions are marked
`binary` so they are never converted or diffed as text.

`python -m pipeline.build --check` was verified to pass **either way** — it reads
in Python text mode and is newline-insensitive. An earlier draft of the
`.gitattributes` rationale claimed the freshness gate was affected; that claim was
tested, found false, and removed rather than shipped.

#### What was added

One file: **`web/e2e/typography.e2e.ts`** — 9 tests, the deterministic half of the
type contract. It asserts the three font stacks verbatim, the computed size /
line-height / tracking / weight of every role at **both** 1280px and 375px, the
mono stack plus `tabular-nums` on `.numeric`, uppercase only on `.text-label`,
that the size hierarchy is strictly decreasing, that 400 and 600 render as
distinct faces, and that the page requests **zero** fonts and declares **zero**
`@font-face` rules — so an accidental `next/font` import or a stray Google Fonts
`@import` fails the suite instead of shipping.

Which face the OS supplied, and whether 500 and 600 are distinct on it, are
recorded as **test annotations rather than assertions**: asserting them would fail
every machine that is not the author's, which is the opposite of a portable gate.
No screenshot baseline was created — with an OS-dependent typeface a pixel
baseline would be a machine-specific artifact masquerading as a contract.

E2E total: **32 tests** (8 foundation + 15 shell + 9 typography).

### Phase 3C step 3 — application shell and layout primitives — COMPLETE

Ten files created, three modified. `app/layout.tsx` shrank from 89 lines to 37: it
now describes the HTML document and delegates everything else, which was the
explicit purpose of this step.

**Created**

```text
web/src/components/layout/AppShell.tsx       skip link + the three landmarks
web/src/components/layout/Header.tsx         sticky identity + period + nav
web/src/components/layout/Navigation.tsx     client: section rail + scrollspy
web/src/components/layout/Footer.tsx         attribution from manifest.sources[]
web/src/components/layout/Container.tsx      width variant
web/src/components/layout/Section.tsx        landmark + rhythm + anchor offset
web/src/components/layout/SectionHeader.tsx  eyebrow + title + lead
web/src/components/layout/contract.ts        shared width map and id helpers
web/src/content/sections.ts                  the section registry nav reads
web/tests/layout-contract.test.ts            11 tests
web/e2e/shell.e2e.ts                         14 browser tests
```

**Modified:** `web/app/layout.tsx` (reduced to the document),
`web/app/page.tsx` (recomposed with the primitives — no content added),
`web/src/styles/tokens.css` (one new token, below).

#### The scrollspy bug the test suite found after the first commit

The first implementation decided the active section from the `IntersectionObserver`
callback's own entries: filter to the intersecting ones, sort by top edge, take the
first. That is wrong in two ways, and the E2E suite failed with it roughly **1 run
in 10**.

An observer callback carries only the entries that **changed**. So when the active
section merely scrolled out of the observed band, the callback contained one
non-intersecting entry and no intersecting ones, nothing was re-evaluated, and the
previous section stayed highlighted. Separately, sorting by top edge favoured a
section that had mostly scrolled past over the one the reader was actually in.

The rewrite computes the active section from **live geometry**: the last section
whose top edge has passed the reading line just below the header, read on every
update. Three `getBoundingClientRect()` calls, deterministic, no dependence on
which entries a callback batched. It is triggered by two things, each covering what
the other cannot:

| Trigger | Covers |
| --- | --- |
| `IntersectionObserver` (the mechanism §4 specifies) | entering/leaving the region below the reading line, plus the initial state; free while the page is still |
| passive, frame-throttled `scroll` listener | a section **already inside** that region crossing the line, which produces no intersection change and therefore no observer callback |

Verified with 15 repeats of the scrollspy tests (30/30) and three consecutive full
E2E runs (23/23 each). A second test now covers the failing case directly by
scrolling to each section's top in both directions and asserting `aria-current`
follows — the original test only clicked links, which is why the defect survived
the first commit.

Diagnosing it also corrected a false reading of my own instrumentation: an earlier
probe appeared to show the anchor landing 144px low, which was the probe measuring
mid-smooth-scroll. Measured after settling, a deep link lands at exactly
`scrollY = 884`, `top = 69px` — the header height, as intended.

#### Component boundaries

| Component | Owns | Does not own |
| --- | --- | --- |
| `AppShell` | skip link, `header`/`main`/`footer` landmarks, reading the artifacts the chrome needs | any copy, the `h1`, any width decision |
| `Header` | product identity, observation period, the nav slot, stickiness | which sections exist |
| `Navigation` | the rail, scrollspy, active state | the section list — it is passed in |
| `Footer` | attribution, pipeline version, content hash | hard-coded URLs; every source is read from `manifest.sources[]` |
| `Container` | the ONLY max-width in the product | vertical rhythm |
| `Section` | landmark, `aria-labelledby`, rhythm, anchor offset | width, headings |
| `SectionHeader` | eyebrow, title, optional lead, the heading id | its own width beyond the reading measure |

The `h1` stays with the page, not the shell: a shell-owned `h1` makes every future
page's heading structure the shell's decision.

`AppShell` reads the artifacts because the footer's sources and the header's period
are artifact values. It is a server component, so `getArtifacts()` runs at build
time and neither the JSON nor the validator reaches the client. The header period
is sliced from `panel.coverage` rather than typed as `2025–2026`, so the chrome
cannot claim a window the data does not cover — display formatting, not
computation.

#### The section registry, and why navigation links cannot rot

`src/content/sections.ts` lists the sections that **exist** — `scope`,
`comparability`, `structure`. Not the ten narrative sections from
`docs/product-architecture.md` §1: those are steps 6–7, and registering them now
would ship navigation links that scroll nowhere.

`tests/layout-contract.test.ts` asserts the registry and `app/page.tsx` agree in
both directions — every nav target is rendered as a `<Section id=…>`, and every
rendered section is reachable from the nav. A broken anchor is invisible to `tsc`
and to `next build`, so it needed its own check.

#### One new token: `--header-height`

`Section` offsets each anchor by `scroll-mt-(--header-height)` so the sticky header
cannot cover a heading a reader just navigated to. Two components depend on the
same number, so it is a token rather than a literal, and it has two values because
the header is one row at `lg` and two rows below it.

Both values are **measured, not estimated**: 69px desktop, 98px narrow. The first
draft said 68px and 100px; the E2E test that compares the token against the
rendered box failed with `--header-height (68px) must be >= the rendered header
(69px)` — the 1px bottom border. That test is the reason the token is right, and it
runs at both widths on every E2E run.

#### Responsive behaviour

| Width | Header | Navigation |
| --- | --- | --- |
| ≥1024 (`lg`) | one row: identity left, rail right | inline row |
| <1024 | two rows: identity, then the rail | horizontally scrollable rail |

Adaptation is a layout decision, not scaled-down desktop CSS: the header changes
row count and the token that anchors follow changes with it. Rhythm needs no
breakpoint logic in any component — `--page-padding-inline`, `--section-spacing`,
`--card-padding` and `--grid-gap` already swap below 768px inside `tokens.css`.

An E2E test asserts zero horizontal overflow at 375px, and another asserts prose
never exceeds `--width-reading` at 1280px.

#### Accessibility decisions

- **Anchors, not buttons**, for section links: real ids, shareable URLs, native
  keyboard behaviour, and they work with JavaScript disabled.
- **`aria-current="true"`** marks the active section, so the scrollspy state is
  announced rather than only coloured — §5 forbids colour-only information.
- **44px minimum tap target** on every nav link (`min-h-11`), asserted at 375px.
- **Landmark naming**: each `<section>` points `aria-labelledby` at its own
  heading, derived by `sectionTitleId()` so the two cannot drift.
- **Heading levels** are restricted by `SectionHeader`'s API to `h1` or `h2`, and
  an E2E test walks every heading on the page asserting no level is skipped.
- **Eyebrows are uppercased by CSS**, not in the string, so a screen reader reads
  "Observation scope" rather than spelling out capitals.
- Focus rings are untouched — `:focus-visible` in `globals.css` still applies
  `--focus-ring` globally.

#### Deliberately deferred, with reasons

| Contract item | Why not now |
| --- | --- |
| Header "condenses on scroll" (§4) | It makes the header height dynamic, and that height is what every section anchor depends on. Doing it correctly means driving the offset from a measured height instead of a token — that belongs with step 8 |
| Theme toggle (§4) | Needs client state, persistence and an inline script to avoid a wrong-theme first paint. `tokens.css` already ships both themes via `prefers-color-scheme`, so nothing is missing functionally |
| Mobile drawer / sheet (§4, §7) | Three links. A drawer means a focus trap, which is a real accessibility liability to get wrong for no gain. The horizontally scrollable rail is the baseline; revisit when the ten narrative sections exist |
| `Card`, `Callout`, `SourceNote` (§4) | Step 4. The comparability block keeps its inline warning surface rather than a half-built `Callout` that step 4 would have to undo |

#### Component tests are browser tests, and that is forced

Node 22.23.2 cannot load `.tsx`: importing one under `node --test` fails with
`ERR_UNKNOWN_FILE_EXTENSION`, because JSX is not TypeScript syntax and the runtime
has no transform for it. Verified directly rather than assumed.

So the split is: logic that can live in a `.ts` module is unit-tested
(`tests/layout-contract.test.ts`, 11 tests — width variants, id derivation,
registry/page agreement, the token's existence, that the shell has not grown back
into `layout.tsx`, and that no layout component computes a statistic), and
everything that only exists once rendered is tested in Chromium
(`e2e/shell.e2e.ts`, 14 tests). Adding a JSX transform to the unit-test toolchain
to render six presentational components would be dependency weight without a
payoff, and Playwright tests the production build rather than a simulated one.

### Phase 3C step 2 — Zod validation boundary — COMPLETE

`web/src/data/validate.ts` replaced in place: 1,115 hand-rolled lines →
**768 lines** of Zod 4.6.5 schemas (+643/−990). One source file changed. No other
file in the data layer was touched, and `docs/` needed no architectural revision
because the architecture did not change — the boundary, the accessors and the
module layout are identical; only the implementation behind them is different.

#### Public surface: unchanged where it matters, narrowed where it did not

`src/data/index.ts` is **byte-identical**. `artifacts.ts`, `artifact-types.ts`,
`load-node.ts`, all four test files and `package.json` are byte-identical.

`validate.ts` still exports `ContractError` plus the same five functions
(`validatePanel`, `validateCountries`, `validateMetrics`, `validateClaims`,
`validateManifest`) with the same signatures. It **no longer** exports the eight
hand-rolled combinators `obj`, `str`, `num`, `int`, `bool`, `arr`, `isoDate`,
`oneOf`. Nothing imported them — verified by grep across `src/`, `tests/`, `app/`
and `e2e/` before deletion — and `index.ts` only ever re-exported
`ContractError`, so no consumer sees a difference. They were the deleted
library's internals; keeping them would have meant keeping the library.

#### `ContractError` path mapping

`ContractError` itself is unchanged. Zod issues are converted in exactly one
place: `parseArtifact` takes `error.issues[0]`, renders `issue.path` through
`formatPath` (array indices as `[0]`, object keys as `.key`, artifact name as the
root segment) and throws. A `ZodError` never escapes the module.

**Path parity was measured, not assumed.** The old implementation was checked out
to a scratch file and both validators were run over 52 identical mutations — the
41 the acceptance tests perform, plus 11 the tests do not cover (empty rows,
registry missing a series, series key/id disagreement, malformed `content_hash`,
flipped `scale_free` flag, unknown `evidence_groups` key, extra keys at two
depths, and all five root-type failures). **All 52 produced the identical
`ContractError.path`**, including deep cases such as
`panel.rows[0].oil.brent_usd_per_barrel_exact`,
`metrics.series.us.trend_diagnostics.specifications[0].id` and
`manifest.artifacts.panel.json`. The scratch file was deleted; it is not in the
tree.

This mattered because the obvious Zod translation silently breaks it: modelling a
nullable field as `z.union([schema, z.null()])` collapses every inner failure into
one `invalid_union` issue at the union's own path, so
`panel.rows[3].oil.brent_usd_per_barrel_exact` would have been reported as
`panel.rows[3].oil`. `.nullable()` preserves inner paths; every nullable field
uses it, and no union appears in the file.

#### Schema architecture

Four layers, all inside `validate.ts` (the `src/data/` file list is asserted by
`analytical-safety.test.ts`, so a `schemas.ts` beside it would fail the suite):

1. **Primitives** — `finite`, `integer`, `text`, `flag`, `isoDate`, `sha256`,
   `interestScore`, `correlation`, `probability`, plus the id and vocabulary
   enums built from `SERIES_IDS`/`COUNTRY_IDS`.
2. **Shared shapes** — `coverageSchema`, `intervalSchema`, `claimsSummarySchema`,
   each declared once and reused by the artifacts that embed them.
3. **Per-artifact schemas** — one per JSON file, composed from the above.
4. **Five exported functions**, each one line: `parseArtifact(schema, raw, root)`.

Each function declares the existing interface as its return type, so `tsc` proves
the schema output matches the hand-written contract in `artifact-types.ts`. The
types stay the source of truth for consumers and the schemas stay the source of
truth for runtime shape, with the compiler checking they agree — rather than
inferring public types from schemas, which would have made `index.ts`'s exported
types depend on Zod.

Three Zod behaviours are load-bearing and were each verified against 4.6.5
before use, because the error contract fails quietly if any is wrong:

| Behaviour | Why it is relied on |
| --- | --- |
| `.nullable()` preserves inner issue paths; a union does not | the 8 nullable fields keep precise paths |
| `z.record(z.enum(IDS), value)` is exhaustive **and** rejects unknown keys at the record's own path | exactly replaces the old `exactRecord`, derived from `SERIES_IDS`/`COUNTRY_IDS` rather than restating them |
| refinements do not run when the base parse of the same schema failed | preserves fail-fast ordering, so a cross-field check never fires on a wrong-typed value |

`z.iso.date()` also replaced the old regex-plus-`Date`-round-trip calendar check:
verified to reject `2026-02-30`, `2025-02-29`, `2026-13-01`, `31/08/2025` and
`2026-03-01T00:00:00Z` while accepting `2024-02-29`. `z.number()` already rejects
`NaN` and `±Infinity` and names which it received, which is why the "NaN is
reported as NaN" test passes with no custom check.

#### Validation semantics: same contract, deliberately

Every domain rule the old validator enforced is enforced now, at the same path:
interest scores in 0–100, `pearson_r` in [−1, 1] and `pearson_p` in [0, 1] **on
`CorrelationBundle` only** (the old file did not range-check `spearman_rho`, lag
points, specifications or variants, and neither does this one), non-inverted
intervals, `is_partial_week` agreeing with `trading_days`, `regime` null exactly
when `oil` is null, sensitivity variants carrying statistics only when
`computable`, both `_comparable_across_series` guard flags, the claims
publishability gate, `summary.total` agreeing with the claim list,
`coverage.trends_weeks` agreeing with the row count, registry completeness,
series key/id agreement, SHA-256 digest format and the RFC 3339 UTC timestamp
form. Unknown keys are still tolerated everywhere except the three exact records
— `z.object` strips them, which is what the old field-by-field reader did.

**Schema coverage was proved, not assumed:** a scratch copy with every `z.object`
rewritten to `z.strictObject` validates all five real artifacts cleanly, so no
field present in the artifacts is left unvalidated. That scratch copy was also
deleted.

Two differences are deliberate and immaterial:

- **`z.int()` also requires a safe integer** (|n| ≤ 2^53−1). Every integer in
  these artifacts is a count, index or week offset over 31 observations.
- **Message wording follows Zod** where the old text carried no extra meaning.
  Where it did, the old message is preserved verbatim — the interval-inversion,
  variant-computability, comparability-flag, claims-gate, coverage-mismatch,
  registry-completeness and key/id messages are unchanged, and the messages that
  quoted the offending value still quote it (`Google Trends interest must lie in
  0-100, got 140`).

#### Analytical safety

`zod` enters the app bundle, not the analytical layer. No statistic is computed:
`analytical-safety.test.ts`'s static scan, identity checks and value-injection
tests all pass unchanged, and the cross-field checks compare two values the
pipeline already emitted rather than deriving either. `src/data/` still holds
exactly five `.ts` files.

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
| Frontend data contract + validators | **COMPLETE** — Zod 4.6.5 boundary as of Phase 3C step 2 |
| Design foundation (tokens, chart language) | **COMPLETE** (Phase 3A, now on `main`) |
| Node runtime | **COMPLETE** — Node 22.23.2 in user space |
| Frontend dependencies installed | **COMPLETE** — locked, `npm ci`-reproducible |
| Frontend toolchain gates (tsc / eslint / prettier / node --test) | **COMPLETE** — all green |
| Python dev gates (pytest / ruff / mypy) | **COMPLETE** — restored via the declared `dev` extra |
| Next.js App Router scaffold | **COMPLETE** — builds clean, 3 static routes |
| Tailwind ↔ design-token integration | **COMPLETE** — verified in-browser, light and dark |
| Browser / E2E harness | **COMPLETE** — Playwright chromium, 8 smoke tests passing |
| React component library (`AppShell`, `Card`, …) | **SHELL + LAYOUT + CONTENT COMPLETE** — `AppShell`, `Header`, `Navigation`, `Footer`, `Container`, `Section`, `SectionHeader`, `Card`, `MetricCard`, `Badge`, `StatHighlight`, `SourceNote`, `Callout`, `ReadMore`. `InsightCard` and `CountrySelector` belong to the sections that use them (steps 6–7) |
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

### Windows 11 PC — current device (2026-09-15)

The project now runs on a second machine. Recorded because several observations in
this section were made on the Linux laptop and are device-specific.

| | Linux laptop (previous) | Windows 11 PC (current) |
| --- | --- | --- |
| OS | Linux x64 | Windows 11 Pro, build 26200 |
| Node | 22.23.2 | **24.19.0** |
| npm | 10.9.8 | **11.17.0** |
| Playwright chromium | Chrome Headless Shell 153.0.8010.12 (v1243) | **identical build** |
| `core.autocrlf` | unset | **`true`** — see §4, now overridden by `.gitattributes` |
| Python | 3.11.16 venv (uv) | **3.14.7** venv (`python -m venv`) |
| pytest / ruff / mypy | 9.1.1 / 0.16.7 / 2.3.1 | **identical versions** |

Node 24.19.0 satisfies `engines: { node: ">=22.6" }` and runs the whole gate set
clean. It was **not** changed to match the previous device: no runtime difference
was observed after the path defect in §4 was fixed, and pinning a runtime to
reproduce a bug is not reproducibility.

`npm ci` reproduces the tree from `web/package-lock.json` on this device:
**0 version mismatches, 0 extraneous packages**, and the 85 lockfile entries that
are absent from `node_modules` are all `optional: true` platform binaries for
other operating systems (`@img/sharp-darwin-*`, `@img/sharp-libvips-linux-*`,
`@emnapi/*`, wasm fallbacks) — verified by comparing every entry, not by
inspection.

Two npm 11 differences worth recording, neither a problem:

- npm 11 gates lifecycle scripts. `npm ci` warns that `unrs-resolver@1.12.2`'s
  `postinstall` was **not** run (`npm approve-scripts` is the opt-in). `eslint .`
  is clean regardless, so the resolver's native binding is not required by this
  configuration. Nothing was approved, because nothing needed it.
- Python here is 3.14.7 rather than the 3.11.16 the previous device used.
  `requires-python = ">=3.11"`, and `[tool.ruff] target-version`/`[tool.mypy]
  python_version` both stay `py311`, so the tools still check against 3.11
  semantics. All 191 tests pass on 3.14.7.

### Node runtime — installed on the previous device

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
| **Phase 3C step 2** — `.nullable()` for every nullable field, never `z.union([schema, z.null()])` | A union collapses inner failures into one `invalid_union` issue at the union's own path, which would report `panel.rows[3].oil` instead of the field inside it. Verified against 4.6.5 |
| `z.record(z.enum(IDS), value)` instead of hand-listing the six series keys | Exhaustive keys plus unknown-key rejection at the record's own path — the old `exactRecord` contract — derived from `SERIES_IDS`/`COUNTRY_IDS`, so adding a market cannot leave the validator behind |
| Return the existing interfaces from the `validate*` functions rather than exporting `z.infer` types | `tsc` then proves schema and contract agree, while `index.ts`'s exported types stay independent of Zod. Inferring the public types would make every consumer's type depend on a schema library |
| Deleted the eight exported combinators instead of keeping them as a shim | Nothing imported them (verified by grep), they have no Zod analogue, and keeping them would keep the library this step deletes |
| Verified path parity against the old implementation over 52 mutations before deleting it | The acceptance tests assert `path.includes(fragment)`, which a less precise path can still satisfy. Substring matching is not proof of parity; a field-by-field comparison is |
| Kept range checks exactly where the old validator had them | `pearson_r`/`pearson_p` are range-checked on `CorrelationBundle` only. Zod makes it trivial to add the same bounds to lag points, specifications and variants, which would be a new analytical rule invented by the tool rather than by the contract |
| **Phase 3C step 3** — `--header-height` as a token, measured in a browser rather than estimated | Two components depend on the number (`Header` renders it, `Section` offsets anchors by it). The E2E check caught a 1px error from the header's bottom border in the first draft |
| Section rhythm is `margin-top`, not `padding-top` | `scroll-margin-top` positions the border box and a margin sits outside it, so a deep link lands on the heading rather than `--section-spacing` above it. Same visual rhythm, correct anchor |
| A section registry (`src/content/sections.ts`) holding only the sections that exist | Registering the ten narrative sections now would ship navigation links that scroll nowhere. A test asserts registry and page agree both ways, because a dead anchor is invisible to `tsc` and to `next build` |
| Navigation is anchors with `aria-current`, not buttons with JS routing | Real ids are shareable and keyboard-native, and `aria-current` makes the scrollspy state audible rather than colour-only |
| Scrollspy decides from live geometry, with the observer as a trigger only | An `IntersectionObserver` callback carries only the entries that changed, so deciding from them left the previous section highlighted when the active one scrolled out of the band — a ~10% E2E flake. A passive frame-throttled scroll listener covers the case the observer structurally cannot: a section already inside the band crossing the reading line |
| Horizontally scrollable nav rail instead of a mobile drawer | Three links do not justify a focus trap, which is the part of a drawer most easily got wrong. Revisit at ten sections |
| Deferred the header's condense-on-scroll and the theme toggle | Condensing makes the header height dynamic, and that height is the anchor offset every section depends on; the toggle needs persistence plus an inline script to avoid a wrong-theme flash. Both are step 8 work, and `prefers-color-scheme` already themes the product |
| Component tests live in Playwright, not `node --test` | Node 22.23.2 cannot load `.tsx` (`ERR_UNKNOWN_FILE_EXTENSION`, verified). A JSX transform in the unit-test toolchain to render six presentational components is dependency weight for no gain; Playwright tests the real production build |
| Page body uses the `content` width, not `page` | At 1280px a `page`-width body left the composition against the left edge with a void beside it. `content` centres the column, which is what the width variant is for. Caught by looking at a screenshot, not by a test |
| No eyebrow ordinals on the three scaffold blocks | Numbering them `01`–`03` read as though they were narrative sections 01–03, while the real ten are listed inside one of them. `SectionHeader` keeps the ordinal API for when those sections arrive |
| **Windows transition** — kept the system font stack; changed no font declaration | The stack is a decision recorded in `tokens.css` principle 4 and `design-system.md` §3, and the diagnosis found nothing broken: zero font requests, no `@font-face`, one declaration site, every computed type value equal to its token. Shipping a typeface to force cross-machine parity reverses a documented decision and changes the visual identity — that is the user's call, not a diagnosis outcome |
| Asserted the type contract, annotated the OS-supplied face | Sizes, line-heights, tracking, stacks, tabular figures and "zero fonts downloaded" are the project's own and are identical everywhere, so they are assertions. Which face Windows or Linux supplies is not, so it is a test annotation. Asserting it would fail every machine but the author's |
| No screenshot baseline for typography | With an OS-dependent typeface a pixel baseline is a machine-specific artifact posing as a contract. Screenshots were used as evidence during the diagnosis and deleted |
| `import.meta.dirname` instead of slicing `import.meta.url` | `fileURLToPath` returns backslashes on Windows, so `lastIndexOf("/")` is -1 and the slice silently resolves one directory too deep. It broke all five test files. `import.meta.dirname` is correct on every platform and is inside the declared Node floor |
| `.gitattributes` with `* text=auto eol=lf`, rather than relaxing Prettier's `endOfLine` | Setting `endOfLine: "auto"` would have silenced the failing gate while leaving the working tree's bytes dependent on each developer's `core.autocrlf` — including the bytes of the pipeline-owned artifacts whose digests the project publishes. Pinning the checkout fixes the cause; loosening the linter hides it |
| Did not change Node to 22.x to match the previous device | 24.19.0 satisfies `engines >=22.6` and passes every gate once the path defect is fixed. The failure was a portability bug in the repository, not a runtime incompatibility; pinning a runtime to reproduce a bug is not reproducibility |
| **Phase 3C step 4** — express §16 as a discriminated union rather than a lint rule or a review habit | An `inferential` metric that cannot be constructed without its specification comparison makes the project's most important presentational rule a compile error. Verified against `tsc` with both violations before relying on it |
| `value` and `interval` typed as `string`, not `number` | Rounding a coefficient is a presentational decision that belongs in the pipeline or an accessor, made once. A string also makes arithmetic on a statistic impossible on the way to the screen, which is the analytical-safety rule restated as a type |
| Every caveat renders a badge **and** a sentence | A badge alone leaves the qualification in a `title` attribute — behind a hover, invisible to touch and to a screen reader in browse mode. §5 does not allow information to depend on hover |
| `ReadMore` unmounts its panel instead of hiding it | A hidden-but-present panel is still found by find-in-page and still read in browse mode, so "collapsed" would be a lie. The cost is that height cannot be transitioned from the previous content, which is why the animation is opacity and translate |
| `ReadMore` is a `<button>` + `aria-expanded`, not `<details>`/`<summary>` | §6 requires animated disclosure, a deep-linkable open state and Escape-to-close. `<details>` delivers none of the three reliably, and a button is what a screen reader announces anyway |
| `Card` takes an `as` prop, and its optional props are typed `| undefined` | `exactOptionalPropertyTypes` is on, so a wrapper cannot forward a possibly-undefined prop through a plain `?:`. `Card` is the primitive designed to be wrapped, so it absorbs that instead of forcing every caller to invent a default |
| Metric cards sit in a `<ul>`, not a `<dl>` | `MetricCard` renders `<p>` for label and value, and a `div` inside a `dl` must contain `dt`/`dd`. Making the component emit `dt`/`dd` would force every future use into a definition list |
| Kept the foundation page free of inferential metrics even though the component now exists | Steps 6–7 build the sections that can carry a specification comparison. A coefficient here would have nowhere to be qualified, which is exactly what §16 forbids. Two tests assert it stays that way |

---

## 8. Known issues / blockers

**No blockers.** Every environment issue carried into this session is resolved.

Open items, none blocking:

- **The product ships no typeface, so the rendered face is OS-dependent.** This is
  the documented decision (`tokens.css` principle 4, `design-system.md` §3) and it
  is now measured rather than assumed: Segoe UI + Consolas on Windows, whatever
  fontconfig resolves on Linux. Two consequences are open by design — `500` is not
  a distinct weight on Segoe UI, and `--width-reading: 68ch` is a different
  physical width per face, so paragraph wrapping and section heights legitimately
  differ between machines. **Fully deterministic typography would require shipping
  a typeface, which is a product decision that has not been made.** Recorded in §4
  and `design-system.md` §3 with the evidence.
- **Only chromium is installed for Playwright.** Firefox/WebKit binaries are
  absent, so cross-engine behaviour is unverified. The cyan/blue colourblind check
  and the screen-reader pass in `docs/product-architecture.md` §5 also remain
  outstanding — they belong to step 8.
- **Three shell features are deliberately deferred** with reasons recorded in §4
  and §7: the header's condense-on-scroll, the theme toggle, and a mobile
  drawer/sheet for navigation. None is missing functionality — the product is
  fully themed via `prefers-color-scheme` and fully navigable via the rail.
- **`--header-height` is a measured constant, not a computed one.** It matches the
  rendered header at both breakpoints and an E2E test proves it, but a future
  change to the header's padding or type size needs the token updated with it. The
  test will fail loudly if that is forgotten, which is the intended safety net.
- **Component behaviour is only testable in a browser.** Node cannot load `.tsx`,
  so `npm test` covers layout logic and `npm run test:e2e` covers rendering. A
  change that breaks a component visually but not structurally is caught by the
  E2E suite or not at all.
- **No axe-core accessibility scan yet.** §5 requires it in CI. The E2E harness now
  exists to host it, but the check is not written.
- **`next dev` is unverified in a browser.** Only the production build is
  E2E-tested, which is the deliberate choice recorded in §7.

Resolved this session:

| Previously open | Resolution |
| --- | --- |
| Windows preview "looks different, especially typography" | **DIAGNOSED, no application change needed.** The project ships no typeface; `system-ui` resolves to Segoe UI here and to a different face on Linux. Nothing failed to load. Evidence and consequences in §4 |
| `npm test` loaded 0 of 5 test files on Windows | **RESOLVED** — `import.meta.url` sliced at `"/"` breaks on backslash paths. Four files switched to `import.meta.dirname`; 120/120 pass |
| `npm run format:check` failed on 37 untouched files | **RESOLVED** — `core.autocrlf=true` made the checkout CRLF against LF blobs. `.gitattributes` pins `eol=lf` for every platform |
| Artifact digests unverifiable on Windows | **RESOLVED** — the same CRLF cause. Committed blobs always matched §9; the three-way hash proof is in §4 |
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
| `src/data/validate.ts` was the hand-rolled validator; Zod installed but unused | **RESOLVED in Phase 3C step 2.** Replaced in place with Zod 4.6.5 schemas. `index.ts` unchanged, 109/109 tests pass unedited, error paths identical across 52 mutations |

---

## 9. Validation status

### Phase 3C step 4 validation (2026-09-15, Windows)

| Gate | Command | Result |
| --- | --- | --- |
| New content tests | `node --test tests/content-contract.test.ts` | **20 / 20 pass** |
| Full frontend suite | `npm test` | **140 / 140 pass**, 0 fail, 0 skipped (120 + 20) |
| Types | `npm run typecheck` | **clean**, exit 0 |
| Lint | `npm run lint` | **clean**, exit 0 |
| Format | `npm run format:check` | **clean** |
| Combined | `npm run verify` | **exit 0** |
| Production build | `npm run build` | **PASS** — 3 static routes, no warnings |
| Browser E2E | `npm run test:e2e` | **47 / 47 pass** (8 foundation + 15 shell + 9 typography + 15 content) |
| §16 gate is a compile error | scratch file through `tsc` | **2 / 2 violations rejected** (TS2322 on both) |
| Python tests | `python -m pytest` | **191 passed, 1 skipped** |
| Python lint / format | `ruff check .` / `ruff format --check .` | **clean** / **21 files already formatted** |
| Types (src + tests) | `mypy` | **no issues in 20 source files** |
| Artifact freshness | `python -m pipeline.build --check` | **PASS** |

No existing test was edited, skipped or weakened. The 120-test count from step 3 is
intact inside the new total, and the 32 E2E tests from before step 4 all still pass
— one selector in `typography.e2e.ts` changed because the numeric role moved from a
`<dd>` into a `MetricCard`, which is a markup change, not a weakened assertion.

**Analytical integrity after step 4.** Tree hashes identical to the baseline:

| Path | Tree hash | vs baseline |
| --- | --- | --- |
| `pipeline/src` | `0d4e1273a1e4b46561015b59d09fbb8b12115e8e` | **identical** |
| `data/` | `e3b3ea39e6de7ca091a321e48eb45e1601588a11` | **identical** |
| `web/src/data/generated/` | `0b4db970dfbc032f67d63f975d168d7ff2ad7838` | **identical** |
| `reports/` | `78aebdc94b36462502b516771caa2d5bdebbaf83` | **identical** |

`git diff` over `pipeline/ data/ reports/ web/src/data/ METHODOLOGY.md` is
**empty** — the whole data layer, not just the artifacts, is untouched by step 4.

**Visual verification.** Screenshots at 1280×1400 and 375×1000, with the disclosure
both closed and open, were looked at: three bordered non-floating metric cards, the
provisional badge with its sentence beside it, five market badges, the guardrail
callout with its worded badge, the disclosure expanding to a left-ruled panel, and
correct stacking with tighter padding at 375px. Diagnostic screenshots and the
capture script were deleted.

### Windows device-transition validation (2026-09-15)

Every gate below was run on the Windows 11 PC, on this tree, after the two fixes in
§4. Commands are as a developer would run them from `web/` and `pipeline/`.

| Gate | Command | Result |
| --- | --- | --- |
| Lockfile reinstall | `npm ci` | **exit 0** — tree reproduced from the lockfile |
| Frontend tests | `npm test` | **120 / 120 pass**, 0 fail, 0 skipped |
| Types | `npm run typecheck` | **clean**, exit 0 |
| Lint | `npm run lint` | **clean**, exit 0 |
| Format | `npm run format:check` | **clean** after `.gitattributes` normalisation (37 files failed before) |
| Combined | `npm run verify` | **exit 0** |
| Production build | `npm run build` | **PASS** — 3 static routes, no warnings |
| Browser E2E | `npm run test:e2e` | **32 / 32 pass** (8 foundation + 15 shell + 9 typography) |
| Typography suite alone | `npx playwright test e2e/typography.e2e.ts` | **9 / 9 pass** |
| Python tests | `python -m pytest` | **191 passed, 1 skipped** (4.89 s) |
| Python lint | `ruff check .` | **All checks passed** |
| Python format | `ruff format --check .` | **21 files already formatted** |
| Types (src) | `mypy src` | **no issues in 11 source files** |
| Types (src + tests) | `mypy` | **no issues in 20 source files** |
| Artifact freshness | `python -m pipeline.build --check` | **PASS** — all 4 artifacts up to date |

Counts are identical to the Linux baseline: 120 frontend tests, 191 Python tests,
1 skip. No test was added to the existing suites, edited, skipped or weakened —
the only new tests are the 9 in `e2e/typography.e2e.ts`.

**Analytical integrity.** Nothing under `pipeline/`, `data/`, `reports/` or
`web/src/data/generated/` was modified. The four committed artifact digests match
§9's record exactly; the CRLF/LF three-way hash comparison proving it is in §4.
`git diff` over those paths is empty.

**Visual verification.** Screenshots were taken at 1280×900 and 375×800 and looked
at: Segoe UI throughout with Consolas for the numeric values, correct
eyebrow → title → lead → body hierarchy, cards bordered rather than floating,
uppercase only on eyebrows, no overflow at 375px. Diagnostic screenshots and the
probe script were deleted; nothing scratch remains in the tree.

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

### Step 3 re-validation (application shell)

Every gate below was run on the committed tree. No existing test was edited,
skipped or weakened; the 109-test Phase 3A suite is intact inside the new total.

| Gate | Command | Result |
| --- | --- | --- |
| New layout tests | `node --test tests/layout-contract.test.ts` | **11 / 11 pass** |
| Full frontend suite | `npm test` | **120 / 120 pass**, 0 fail, 0 skipped (109 + 11) |
| Types | `npm run typecheck` | **clean**, exit 0 |
| Lint | `npm run lint` | **clean**, exit 0 |
| Format | `npm run format:check` | **clean** |
| Combined | `npm run verify` | **exit 0** |
| Production build | `npm run build` | **PASS** — 3 static routes, no warnings |
| Browser E2E | `npm run test:e2e` | **23 / 23 pass** (chromium; 8 foundation + 15 shell) |
| Python tests | `python -m pytest` | **191 passed, 1 skipped** |
| Python lint / types | `ruff check .` / `mypy src` | **clean** / **no issues in 11 files** |

The 15 shell tests cover: the named `nav` landmark and one link per registered
section; every `href` resolving to an element that exists; nav links as the tab
stops after the skip link; 44px tap targets at 375px; the `--header-height` token
against the rendered header at **both** 1280px and 375px; a deep-linked heading
sitting below the header's bottom edge; the header staying at `y = 0` while
scrolling; `aria-current` moving between sections by click **and** by scroll
position in both directions; the one-row/two-row switch; zero horizontal overflow
at 375px; prose within `--width-reading`; every section named by its own heading
id; and no skipped heading level anywhere on the page.

**One defect reached the first commit and was caught by the suite, not by review.**
The scrollspy failed about 1 run in 10; the cause and the rewrite are in §4. Its
stability was then established by 15 repeats of the scrollspy tests (30/30) and
three consecutive full runs (23/23 each), rather than by one green run.

Two problems were found by looking at rendered screenshots rather than by any
gate, and both were fixed: the page body was left-aligned in a `page`-width
container leaving a large void at 1280px, and the scaffold blocks carried eyebrow
ordinals `01`–`03` that read as the narrative sections. Neither is expressible as
an assertion, which is the argument for looking.

Analytical integrity after step 3 — tree hashes identical to the baseline:

| Path | Tree hash | vs baseline |
| --- | --- | --- |
| `pipeline/src` | `0d4e1273a1e4b46561015b59d09fbb8b12115e8e` | **identical** |
| `data/` | `e3b3ea39e6de7ca091a321e48eb45e1601588a11` | **identical** |
| `web/src/data/generated/` | `0b4db970dfbc032f67d63f975d168d7ff2ad7838` | **identical** |
| `reports/` | `78aebdc94b36462502b516771caa2d5bdebbaf83` | **identical** |

`git diff` over `pipeline/ data/ reports/ web/src/data/generated/ METHODOLOGY.md`
is empty, and `git diff -- web/src/data/` is empty: the whole data layer, not just
the artifacts, is untouched by this step.

### Step 2 re-validation (Zod boundary)

Every gate below was re-run on the committed tree after `validate.ts` was
replaced. `tests/validator.test.ts` and `tests/analytical-safety.test.ts` were
**not edited**.

| Gate | Command | Result |
| --- | --- | --- |
| Acceptance: validator | `node --test tests/validator.test.ts` | **46 / 46 pass** |
| Acceptance: analytical safety | `node --test tests/analytical-safety.test.ts` | **13 / 13 pass** |
| Full frontend suite | `npm test` | **109 / 109 pass**, 0 fail, 0 skipped |
| Types | `npm run typecheck` | **clean**, exit 0 |
| Lint | `npm run lint` | **clean**, exit 0 |
| Format | `npm run format:check` | **clean** |
| Combined | `npm run verify` | **exit 0** |
| Production build | `npm run build` | **PASS** — 3 static routes, no warnings |
| Browser E2E | `npm run test:e2e` | **8 / 8 pass** (chromium) |
| Python tests | `python -m pytest` | **191 passed, 1 skipped** |
| Python lint / types | `ruff check .` / `mypy src` | **clean** / **no issues in 11 files** |

The build and E2E runs matter more than usual here: they are what proves the new
validator works inside the Next/Turbopack module graph. `app/page.tsx` renders
artifact-driven content through `src/lib/artifacts.ts` → `createArtifactBundle` →
these schemas, so a Zod boundary that only worked under `node --test` would fail
`npm run build`.

Two additional checks were run beyond the gate set, both with scratch files that
were deleted afterwards:

| Check | Method | Result |
| --- | --- | --- |
| Error-path parity | old implementation restored from git to a scratch file; both validators run over 52 identical mutations | **52 / 52 identical `ContractError.path`**, 0 different |
| Schema coverage | scratch copy with every `z.object` → `z.strictObject`, run against all five real artifacts | **complete** — no artifact field is left unvalidated |

Analytical integrity after step 2 — tree hashes identical to the baseline in §4:

| Path | Tree hash | vs baseline |
| --- | --- | --- |
| `pipeline/src` | `0d4e1273a1e4b46561015b59d09fbb8b12115e8e` | **identical** |
| `data/` | `e3b3ea39e6de7ca091a321e48eb45e1601588a11` | **identical** |
| `web/src/data/generated/` | `0b4db970dfbc032f67d63f975d168d7ff2ad7838` | **identical** |
| `reports/` | `78aebdc94b36462502b516771caa2d5bdebbaf83` | **identical** |

`git diff` over `pipeline/ data/ reports/ web/src/data/generated/ METHODOLOGY.md`
is empty, and the four artifact digests still match the values recorded below.

**Note for future sessions:** `python -m pipeline.build --legacy` is **not**
read-only — it writes the artifacts, which rewrites `manifest.json`'s
`generated_at` and dirties the tree. Only `--check` is read-only. Use
`--out $(mktemp -d)` when a replay is wanted without touching the committed
artifacts.

No test was deleted, skipped or weakened; no TypeScript strictness flag was
relaxed; no analytical file was modified to make a frontend gate pass.

The eight E2E tests cover: one `h1` plus all three landmarks; the skip link as
first tab stop, becoming visible on focus and targeting `#main-content`; the
observation period and five market labels read from artifacts; the comparability
constraint; the absence of any coefficient or p-value; and — the checks that could
not exist before a browser — computed `background-color` in **light** and **dark**
themes, plus a mapped country token resolving through the primitive chain to
`rgb(8, 145, 178)`.

No test was deleted, skipped or weakened; no TypeScript strictness flag was
relaxed; no analytical file was modified to make a frontend gate pass.

### Commits

| Phase | Commit | Subject |
| --- | --- | --- |
| 3B baseline | **`f950e2b`** | chore: restore frontend foundation and bootstrap dependencies |
| 3B docs | `f1786fe`, `8705377` | record the 3B baseline hash and push status |
| Protocol | **`76db6f5`** | docs: record the Universal Kiro Protocol operating rules in KIRO.md |
| 3C step 1 | **`94bf7cf`** | feat: scaffold the Next.js App Router and wire design tokens into Tailwind |
| 3C step 1 docs | **`64d904f`** | docs: record the Phase 3C step 1 commit hash in KIRO.md |
| Reconciliation | `f002259` | docs: correct the KIRO.md push status and phase header after reconciliation |
| 3C step 2 | **`0131f74`** | feat: replace the hand-rolled validator with a Zod runtime schema boundary |
| 3C step 2 docs | `97b69f1` | docs: record the Phase 3C step 2 commit hash in KIRO.md |
| 3C step 3 | **`6acb553`** | feat: build the application shell and layout primitives |
| 3C step 3 fix | **`ee03249`** | fix: decide the scrollspy from geometry rather than observer entries |

`6acb553` changed 17 files: 10 created (7 components, `contract.ts`,
`src/content/sections.ts`, and the two test files), 3 source files modified
(`app/layout.tsx`, `app/page.tsx`, `tokens.css`) and 4 documents updated. Nothing
under `web/src/data/` was touched. `ee03249` then rewrote `Navigation`'s scrollspy
after the E2E suite exposed a ~10% flake in it (see §4).

`0131f74` changed 3 files: `web/src/data/validate.ts` (+643/−990), plus `KIRO.md`
and `web/README.md`. Nothing else in `web/src/data/` was touched.

`94bf7cf` changed 14 files (9 modified, 5 added trees). `node_modules/`, `.next/`,
`next-env.d.ts`, `*.tsbuildinfo` and Playwright output are all ignored and untracked;
`web/package-lock.json` is tracked.

**Push status — corrected 2026-09-15 during post-reset reconciliation.** Kiro
performed no push; the user subsequently synchronised the branch. `git ls-remote
origin refs/heads/main` returns `64d904f`, so `main` and `origin/main` are
**identical** and `git rev-list --left-right --count origin/main...main` is `0 0`.
Phase 3A (`97d1a5c`), the 3B baseline (`f950e2b`) and the 3C step 1 scaffold
(`94bf7cf`) are all on the remote. The earlier statement in this section — that
`origin/main` was still at `d19a7c7` and the work existed only locally — was true
when written and is now superseded. Re-check with `git status -sb` /
`git log --oneline origin/main..main`.

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

**Phase 3C step 5 — `EChart`, `ChartFrame`, `ChartControls`, `ChartTableFallback`
and the ECharts theme adapter.**

`docs/product-architecture.md` §10 step 5, with each component's responsibility in
§4 of the same document, the accessibility requirements for charts in §5, and the
typed visual contract in `web/src/styles/chart-language.ts` (whose `CHART_TOKENS`
are already asserted against `tokens.css` by `tests/chart-language.test.ts`).

Where step 5 starts from what step 4 built:

1. **`ChartFrame` is a `Card` with slots**, not a new surface. Eyebrow, title, a
   one-line "what to look for", the chart slot, controls, a `SourceNote` and the
   fallback toggle. It must not float either.
2. **`EChart` is the only client component in the chart layer.** Lazy mount via
   `IntersectionObserver`, `ResizeObserver` → debounced `resize()`, `dispose()` on
   unmount, theme resolved once per theme change. `reactStrictMode` is on precisely
   because this is the class of code it catches.
3. **The theme adapter reads CSS custom properties at runtime**, so charts inherit
   light/dark from `tokens.css` with no second palette. `chart-language.ts` already
   defines the DOM-free resolver contract.
4. **`ChartTableFallback` is first-class**, never `display:none`-only. Every chart
   has a tabular twin.
5. **`echarts` 6.1.0 is already installed and unused.** `echarts-for-react` is
   deliberately absent — the project builds its own wrapper over the `ChartTheme`
   contract.
6. **Still no statistic is computed.** A chart series is artifact data passed
   through; axis ranges and tick formatting are presentation, but any derived
   figure must already exist in the artifacts.

### Chart direction — decided, to be implemented in step 5

Recorded here so the visual language is not re-litigated when the adapter is
written. These are constraints on step 5, not work for any earlier step.

**Appearance**

- Dark/black plotting treatment; restrained green as the primary analytical
  signal; thin, precise data strokes; subtle axes and gridlines; generous
  whitespace; editorial data-intelligence appearance.
- **No** generic ECharts blue/orange/rainbow palette and **no** BI-style chart
  grid. `--chart-grid-*` is horizontal-only for exactly this reason: vertical
  gridlines add noise to a time series.
- The reserved-colour rule stands: `--color-oil` is never assigned to a country,
  and country colours are identifiers carrying no ranking (design-system §2).

**Interaction**

- A contextual tooltip persists while the pointer remains inside the chart and
  updates as it moves across observations, disappearing on leaving the
  interaction region.
- Paired oil/EV charts expose **both** variables for the same weekly observation,
  with the week visible in the tooltip.
- Important event annotations stay visible without hover — the elevated-regime
  window and the oil peak are part of the argument, not a hover reward.

**Motion**

- Subtle line draw-in on viewport entry, ~1–2s, once.
- Optional very slow ambient emphasis only where it stays analytically quiet.
- **The underlying data points never move.** No continuous frame-by-frame React
  re-rendering; animation belongs to the canvas, not to the component tree.
- Hover and analytical reading take priority over ambient motion, and
  `prefers-reduced-motion` is honoured — `tokens.css` §6 already collapses every
  duration to 1ms globally, so a missed component cannot reintroduce motion.

The principle, stated once: **the data stays still, the interface breathes.**

Still binding for every remaining step:

- The frontend **must not compute a statistic**. `analytical-safety.test.ts`
  enforces it over `src/data/`, `layout-contract.test.ts` over the layout
  components, and `content-contract.test.ts` over the content components —
  including `toFixed(` and `toPrecision(`, because formatting a coefficient is the
  pipeline's job. The chart layer must join that check in step 5.
- §16 binds anything that renders a statistic: use `MetricContent`'s
  `kind: "inferential"` variant, which cannot be constructed without the
  specification comparison and at least one caveat.
- `web/src/data/generated/` is pipeline-owned. Never edit or reformat it from the
  frontend.
- New modules must not be added to `src/data/` — its file list is asserted.
  Components belong in `src/components/`, content in `src/content/`.
- The Singapore rules in §19 bind all narrative copy: `level_only_association` is
  authoritative, "Maturity Gap" is editorial only, and nothing may imply Singapore
  lacks a level association.
- Register new sections in `src/content/sections.ts` as they are built, so
  navigation and anchors cannot drift.
- Typography is OS-supplied by design (§4). Do not "fix" a per-machine typeface
  difference; chart label sizes come from `--chart-*-size` tokens, which are
  deterministic, while the face is not.

---

## 11. Phase history

| Phase | Description | Status |
| --- | --- | --- |
| Phase 1 | Repository/project audit | **COMPLETE** |
| Phase 2 | Analytical remediation and reproducibility | **COMPLETE** — merged to `main` as `d19a7c7` |
| Phase 3 | Product transformation direction | **COMPLETE** — direction locked |
| Phase 3A | Frontend/data/design foundations | **COMPLETE** — authored on `phase-3a-frontend-foundation`, restored to `main` as `97d1a5c` |
| Phase 3B | Dependency bootstrap (environment baseline) | **COMPLETE** — all 10 steps; validated baseline committed |
| Phase 3C | Frontend/UI implementation | **IN PROGRESS** — steps 1–4 of 8 complete |

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
