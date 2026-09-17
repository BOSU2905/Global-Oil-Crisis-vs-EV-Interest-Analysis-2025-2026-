import { Badge } from "../src/components/content/Badge.tsx";
import { Callout } from "../src/components/content/Callout.tsx";
import type { MetricContent } from "../src/components/content/contract.ts";
import { MetricCard } from "../src/components/content/MetricCard.tsx";
import { ReadMore } from "../src/components/content/ReadMore.tsx";
import { StatHighlight } from "../src/components/content/StatHighlight.tsx";
import { OilVsWorldwideInterestChart } from "../src/components/chart/OilVsWorldwideInterestChart.tsx";
import { Container } from "../src/components/layout/Container.tsx";
import { Section } from "../src/components/layout/Section.tsx";
import { SectionHeader } from "../src/components/layout/SectionHeader.tsx";
import { COUNTRY_IDS, getComparability, getSeriesLabel } from "../src/data/index.ts";
import { getArtifacts } from "../src/lib/artifacts.ts";
import { selectOilVsWorldwideInterest } from "../src/lib/oil-vs-interest.ts";

/**
 * Foundation page — Phase 3C steps 1, 3 and 4 of docs/product-architecture.md §10.
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
 * `src/data/index.ts`. No statistic is computed here.
 *
 * WHAT STEP 4 CHANGED, AND WHAT IT DELIBERATELY DID NOT
 * Composition again, plus the content components. The three scope figures are now
 * `MetricCard`s, the comparability block is a real `Callout` instead of the inline
 * warning surface step 1 left as a placeholder, the partial-week note uses
 * `StatHighlight` and `ReadMore`, and the footer's source list is a `SourceNote`.
 *
 * **Still no coefficient, p-value, interval or classification appears.** The
 * `MetricCard`s here are all `kind: "descriptive"` — coverage dates and counts the
 * pipeline observed, not statistics it inferred. Rendering an inferential metric
 * requires the specification comparison beside it (KIRO.md §16), and the sections
 * that can carry that comparison are steps 6–7. `MetricCard` now makes that a
 * compile error rather than a matter of discipline, which was the point of
 * building it before the sections that will use it. An E2E test asserts the page
 * still shows no coefficient.
 */
export default function Home() {
  const bundle = getArtifacts();
  const { coverage } = bundle.panel;
  const comparability = getComparability(bundle);
  const partialWeeks = coverage.partial_weeks.length;
  const one = partialWeeks === 1;
  const chartData = selectOilVsWorldwideInterest(bundle);
  // Read, not scanned for: `metrics.global.oil.last_week`. The provisional-week
  // note needs the last week the price series actually covers.
  const lastOilWeek = chartData.annotations.lastOilWeek;

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

  /*
    Descriptive, every one of them: two dates, a row count and a market count,
    all read from the artifacts. The partial-week caveat is attached to the
    observation count because that is the figure it qualifies -- a caveat that
    sits anywhere else is decoration.

    Labels are Title Case, like every other editorial title in the product. A
    metric-card label IS the card's title, so it follows the heading convention
    rather than the sentence-case convention that governs prose and controls.
  */
  const scope: readonly MetricContent[] = [
    {
      kind: "descriptive",
      label: "Observation Period",
      value: `${coverage.first_week} → ${coverage.last_week}`,
    },
    {
      kind: "descriptive",
      label: "Weekly Observations",
      value: String(coverage.trends_weeks),
      unit: "weeks",
      ...(partialWeeks > 0
        ? {
            caveats: [
              {
                code: "Provisional",
                detail: `${partialWeeks} week${one ? "" : "s"} flagged as partial in the panel.`,
              },
            ],
          }
        : {}),
    },
    {
      kind: "descriptive",
      label: "Markets",
      value: String(COUNTRY_IDS.length),
      unit: "countries",
    },
  ];

  return (
    <Container width="page" className="pb-(--section-spacing)">
      {/*
        The page's single h1. A plain block rather than a Section: section 01
        (Overview) and the hero contract in §2 are step 6, and claiming that id
        now would put a navigation link on a section that does not exist.
      */}
      <div className="pt-(--section-spacing)">
        <SectionHeader
          sectionId="page"
          headingLevel={1}
          eyebrow="Analytical Foundation"
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
        <SectionHeader sectionId="scope" eyebrow="Coverage" title="Observation Scope" />

        <ul className="mt-(--section-header-gap) grid list-none gap-(--grid-gap) sm:grid-cols-3">
          {scope.map((metric) => (
            <MetricCard key={metric.label} metric={metric} as="li" />
          ))}
        </ul>

        <ul className="mt-6 flex flex-wrap gap-2">
          {COUNTRY_IDS.map((id) => (
            <li key={id}>
              <Badge>{getSeriesLabel(bundle, id)}</Badge>
            </li>
          ))}
        </ul>

        {partialWeeks > 0 ? (
          /*
            The finding stays visible; only the charting instruction is behind the
            disclosure. §6 forbids a critical conclusion living inside a ReadMore,
            and "one week is provisional" is exactly that kind of statement -- so it
            is in the summary, with the figure as a StatHighlight.
          */
          <ReadMore
            id="provisional-weeks"
            className="mt-6"
            label="What that means for the charts"
            summary={
              <p>
                <span className="text-fg">Provisional data.</span>{" "}
                <StatHighlight
                  value={String(partialWeeks)}
                  unit={one ? "week" : "weeks"}
                  label="provisional"
                />{" "}
                {one ? "rests" : "rest"} on fewer than five trading days.
              </p>
            }
          >
            {/*
              Step 5 note: this panel used to state a REQUIREMENT for charts that did
              not exist ("charts must mark those weeks visibly"). A chart exists now
              and does mark them, so the copy describes the treatment instead of
              promising it. Every fact below is read from the artifacts by the chart's
              own selector — the dash, the gap and the week labels are the rendering
              of `coverage.partial_weeks` and `coverage.weeks_without_oil`.
            */}
            <p>
              In the chart below, that week is drawn as a dashed segment rather than a solid
              one, and the tooltip names it as a partial week. It is not dropped and not
              smoothed — a weekly mean over fewer days is still the best estimate for the week,
              it just carries more uncertainty than its neighbours.
            </p>
            <p>
              A second gap sits at the end of the period. Google Trends reaches{" "}
              <span className="tabular">{coverage.last_week}</span> but the Brent extract stops
              a week earlier, so the price line ends at{" "}
              <span className="tabular">{lastOilWeek}</span> and is broken rather than joined
              across the missing week. Interpolating it would invent an observation.
            </p>
          </ReadMore>
        ) : null}
      </Section>

      {/*
        The normalisation constraint is rendered from countries.json, not retyped.
        It is the guardrail most easily lost in a redesign, and the original
        project's worst analytical error was a cross-market comparison this rule
        forbids -- so it is present from the first page that exists.

        Step 4 replaced the inline warning surface with `Callout`, which is the
        component product-architecture.md §4 names for exactly this block. Both the
        constraint and the remedy stay visible: neither is behind a disclosure.
      */}
      <Section id="comparability">
        <Callout
          tone="warning"
          kind="Guardrail"
          className="max-w-reading"
          header={
            <SectionHeader
              sectionId="comparability"
              eyebrow="Cross-Market Comparison"
              title="Comparability Constraint"
            />
          }
        >
          <p className="mt-(--section-header-gap) text-small text-fg-secondary">
            {comparability.explanation}
          </p>
          <p className="mt-3 text-small text-fg-secondary">
            <span className="text-fg">Remedy.</span> {comparability.remedy}
          </p>
        </Callout>
      </Section>

      {/*
        THE STEP 5 CHART PROTOTYPE — one chart, not the chart system.

        It sits after the comparability guardrail on purpose: the constraint that
        interest levels are series-local has to be read before a chart puts an
        interest line next to anything. `product-architecture.md` §1 places the
        global relationship at section 04, which is where this will move once the
        narrative sections exist; here it is a prototype for evaluating the visual
        language and the interactions, and nothing downstream depends on its
        position.

        The data is selected on the SERVER. `selectOilVsWorldwideInterest()` runs
        during the build, so no artifact JSON and no validation code reaches the
        client — only the ~31 selected points do.
      */}
      <Section id="oil-vs-interest">
        <SectionHeader
          sectionId="oil-vs-interest"
          eyebrow="Prototype"
          title="Oil Price and Worldwide EV Interest"
          lead="One chart, built to evaluate the visual language and the interactions before the rest of the chart system is written. Two measures, two units, two axes — and a caveat that travels with them."
        />
        <div className="mt-(--section-header-gap)">
          <OilVsWorldwideInterestChart data={chartData} sources={bundle.manifest.sources} />
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
          eyebrow="Information Architecture"
          title="Narrative Structure"
          lead="The finished product is one long-scroll argument in ten sections, read in order. None of them is implemented yet — this page is the shell they will be built into."
        />
        <ol className="mt-(--section-header-gap) flex max-w-reading flex-col gap-px overflow-hidden rounded-lg border border-border">
          {narrative.map((label, index) => (
            <li
              key={label}
              className="flex items-baseline gap-3 bg-surface px-4 py-3 text-small text-fg-secondary"
            >
              <span className="tabular text-fg-subtle">
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
