import { Container } from "../src/components/layout/Container.tsx";
import { Section } from "../src/components/layout/Section.tsx";
import { SectionHeader } from "../src/components/layout/SectionHeader.tsx";
import { COUNTRY_IDS, getComparability, getSeriesLabel } from "../src/data/index.ts";
import { getArtifacts } from "../src/lib/artifacts.ts";

/**
 * Foundation page — Phase 3C steps 1 and 3 of docs/product-architecture.md §10.
 *
 * SCOPE, STATED EXPLICITLY
 * This is the application shell standing up, not the product. The narrative
 * sections (§1), the hero (§2), the interpretation framework (§3) and every chart
 * are later steps in the §10 order and are deliberately absent. What this page
 * does do is prove the architecture end to end:
 *
 *     Python pipeline → generated JSON → validated bundle → React
 *
 * Everything rendered below is READ from the artifacts through the accessors in
 * `src/data/index.ts`. No statistic is computed here, and none is displayed:
 * coefficients, p-values, intervals and classifications belong to sections that
 * can also carry the specification caveat that qualifies them (§16 of KIRO.md).
 * Showing a coefficient on a page that has nowhere to explain it is precisely
 * the failure the decision memo warns against.
 *
 * WHAT STEP 3 CHANGED HERE
 * Composition only. The same three blocks, the same copy, the same artifact
 * fields — now expressed with `Section`, `SectionHeader` and `Container` instead
 * of repeated class lists, so the sections are addressable, navigable and
 * consistently spaced. The section ids below are the ones in
 * `src/content/sections.ts`, which is what the header navigation links to;
 * `tests/layout-contract.test.ts` asserts the two agree, so a nav link cannot
 * point at an anchor that is not here. No analytical content was added.
 */
export default function Home() {
  const bundle = getArtifacts();
  const { coverage } = bundle.panel;
  const comparability = getComparability(bundle);

  const narrative = [
    "Overview",
    "Oil Shock",
    "EV Interest",
    "Global Relationship",
    "Robustness",
    "Country Divergence",
    "Country Deep Dives",
    "Interpretation",
    "Limitations",
    "Conclusion",
  ];

  return (
    <Container width="content" className="pb-(--section-spacing)">
      {/*
        The page's single h1. A plain block rather than a Section: section 01
        (Overview) and the hero contract in §2 are step 6, and claiming that id
        now would put a navigation link on a section that does not exist.
      */}
      <div className="pt-(--section-spacing)">
        <SectionHeader
          sectionId="page"
          headingLevel={1}
          eyebrow="Analytical foundation"
          title={
            <>
              Global Oil Crisis <span className="text-fg-subtle">vs</span> EV Interest Analysis
            </>
          }
          lead="An interactive analysis of Brent crude prices and electric-car search interest across five markets, 2025–2026."
        />
      </div>

      {/* Scope, read from the artifacts rather than typed as literals. */}
      <Section id="scope">
        <SectionHeader sectionId="scope" eyebrow="Coverage" title="Observation scope" />
        <dl className="mt-(--section-header-gap) grid gap-(--grid-gap) sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-(--card-padding)">
            <dt className="text-meta text-fg-muted">Observation period</dt>
            <dd className="numeric mt-2 text-stat-small text-fg">
              {coverage.first_week} → {coverage.last_week}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-surface p-(--card-padding)">
            <dt className="text-meta text-fg-muted">Weekly observations</dt>
            <dd className="numeric mt-2 text-stat-small text-fg">{coverage.trends_weeks}</dd>
          </div>
          <div className="rounded-lg border border-border bg-surface p-(--card-padding)">
            <dt className="text-meta text-fg-muted">Markets</dt>
            <dd className="numeric mt-2 text-stat-small text-fg">{COUNTRY_IDS.length}</dd>
          </div>
        </dl>

        <ul className="mt-6 flex flex-wrap gap-2">
          {COUNTRY_IDS.map((id) => (
            <li
              key={id}
              className="rounded-full border border-border bg-surface-raised px-3 py-1 text-meta text-fg-secondary"
            >
              {getSeriesLabel(bundle, id)}
            </li>
          ))}
        </ul>

        {coverage.partial_weeks.length > 0 ? (
          <p className="mt-6 max-w-reading text-small text-fg-secondary">
            <span className="text-fg">Provisional data.</span> {coverage.partial_weeks.length}{" "}
            week
            {coverage.partial_weeks.length === 1 ? "" : "s"} rest on fewer than five trading
            days and are flagged in the panel as partial. Charts must mark them visibly rather
            than presenting them as complete weekly averages.
          </p>
        ) : null}
      </Section>

      {/*
        The normalisation constraint is rendered from countries.json, not retyped.
        It is the guardrail most easily lost in a redesign, and the original
        project's worst analytical error was a cross-market comparison this rule
        forbids -- so it is present from the first page that exists.

        The warning surface is applied here rather than through a component
        because `Callout` (§4) is step 4. One inline treatment now is honest; a
        half-built Callout would be the thing step 4 has to undo.
      */}
      <Section id="comparability">
        <div className="max-w-reading rounded-lg border border-border bg-warning-surface p-(--card-padding)">
          <SectionHeader
            sectionId="comparability"
            eyebrow="Guardrail"
            title="Comparability constraint"
          />
          <p className="mt-(--section-header-gap) text-small text-fg-secondary">
            {comparability.explanation}
          </p>
          <p className="mt-3 text-small text-fg-secondary">
            <span className="text-fg">Remedy.</span> {comparability.remedy}
          </p>
        </div>
      </Section>

      {/*
        The information architecture, listed as intent. Not navigation yet.

        None of the three blocks on this page carries an eyebrow ordinal. The
        numbered sequence `01 — OVERVIEW` … `10 — CONCLUSION` belongs to the
        narrative sections listed below, which do not exist yet; numbering these
        scaffold blocks 01–03 would read as though they were the first three.
        `SectionHeader` supports the ordinal for when those sections arrive.
      */}
      <Section id="structure">
        <SectionHeader
          sectionId="structure"
          eyebrow="Information architecture"
          title="Narrative structure"
          lead="The finished product is one long-scroll argument in ten sections, read in order. None of them is implemented yet — this page is the shell they will be built into."
        />
        <ol className="mt-(--section-header-gap) flex max-w-reading flex-col gap-px overflow-hidden rounded-lg border border-border">
          {narrative.map((label, index) => (
            <li
              key={label}
              className="flex items-baseline gap-3 bg-surface px-4 py-3 text-small text-fg-secondary"
            >
              <span className="numeric text-fg-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </Section>
    </Container>
  );
}
