import { Badge } from "../src/components/content/Badge.tsx";
import { Callout } from "../src/components/content/Callout.tsx";
import type { MetricContent } from "../src/components/content/contract.ts";
import { HowToRead } from "../src/components/content/HowToRead.tsx";
import { MetricCard } from "../src/components/content/MetricCard.tsx";
import { ReadMore } from "../src/components/content/ReadMore.tsx";
import { StatHighlight } from "../src/components/content/StatHighlight.tsx";
import { InterestAcrossMarketsChart } from "../src/components/chart/InterestAcrossMarketsChart.tsx";
import { NORMALISATION_CAVEAT } from "../src/components/chart/markets-contract.ts";
import { OilVsWorldwideInterestChart } from "../src/components/chart/OilVsWorldwideInterestChart.tsx";
import { CountryDeepDivePanel } from "../src/components/market/CountryDeepDivePanel.tsx";
import { MarketSynthesisList } from "../src/components/market/MarketSynthesisList.tsx";
import { Container } from "../src/components/layout/Container.tsx";
import { Section } from "../src/components/layout/Section.tsx";
import { SectionHeader } from "../src/components/layout/SectionHeader.tsx";
import { HOW_TO_READ_ENTRIES } from "../src/content/how-to-read.ts";
import { COUNTRY_IDS, getComparability, getSeriesLabel } from "../src/data/index.ts";
import { getArtifacts } from "../src/lib/artifacts.ts";
import { selectInterestAcrossMarkets } from "../src/lib/interest-across-markets.ts";
import { selectMarketSynthesis } from "../src/lib/market-synthesis.ts";
import { selectOilVsWorldwideInterest } from "../src/lib/oil-vs-interest.ts";

/**
 * The report page, as far as it is built.
 *
 * WHAT IS HERE NOW
 * Two charts, the cross-market synthesis and the country deep-dive foundation, on top of
 * the shell, the scope block and the comparability guardrail. Everything rendered is READ
 * from the artifacts through the accessors in `src/data/index.ts` and the selectors in
 * `src/lib/`. No statistic is computed here.
 *
 *     Python pipeline → generated JSON → validated bundle → selector → React
 *
 * WHAT IS DELIBERATELY NOT HERE
 * The hero, the Oil Shock section, the Robustness section, Interpretation, Limitations,
 * About and Creator. Their order is recorded in the `structure` section at the foot of the
 * page, and the reason each is absent is recorded there too — a reader of a report in
 * progress is entitled to know what is missing.
 *
 * **Still no coefficient, p-value or interval appears.** The Robustness section is the
 * one that can carry the specification comparison beside a coefficient, and until it
 * exists a coefficient on this page would have nowhere to be qualified — which is the
 * original project's error. `MetricCard` makes that a compile error rather than a habit:
 * every metric below is `kind: "descriptive"`, and rendering an inferential one requires
 * the specification string and at least one caveat. The deep dives render the
 * specification COMPARISON, in words, with no coefficient.
 *
 * SECTION ORDER, AND THE ONE DEVIATION FROM THE NARRATIVE
 * Context → EV Interest → Global Relationship → Market Synthesis → Country Deep Dives is
 * the narrative order. `comparability` sits ahead of all of it because the constraint that
 * interest levels are series-local must be read before a reader sees five interest lines
 * side by side.
 */
export default function Home() {
  const bundle = getArtifacts();
  const { coverage } = bundle.panel;
  const comparability = getComparability(bundle);
  const partialWeeks = coverage.partial_weeks.length;
  const one = partialWeeks === 1;

  const oilVsInterest = selectOilVsWorldwideInterest(bundle);
  const markets = selectInterestAcrossMarkets(bundle);
  const synthesis = selectMarketSynthesis(bundle);

  // Read, not scanned for: `metrics.global.oil.last_week`. The provisional-week
  // note needs the last week the price series actually covers.
  const lastOilWeek = oilVsInterest.annotations.lastOilWeek;

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

  /**
   * The sections still to come, and why each is absent.
   *
   * Rendered rather than left in a document: the page is a report in progress, and a
   * reader who can see what is missing can judge what is here. `built` is not a promise
   * about a date — it is a statement about which of the twelve conceptual sections have
   * evidence behind them today.
   */
  const structure: readonly {
    readonly label: string;
    readonly built: boolean;
    readonly note: string;
  }[] = [
    { label: "Hero", built: false, note: "Opens with the question and the tension." },
    { label: "Context", built: true, note: "Scope, comparability and how to read this." },
    { label: "Oil Shock", built: false, note: "What the crude price series did." },
    { label: "EV Interest", built: true, note: "Five markets, one chart." },
    { label: "Global Relationship", built: true, note: "Crude against worldwide interest." },
    {
      label: "Robustness",
      built: false,
      note: "The specification comparison. Needs the components that render a coefficient with its caveat.",
    },
    {
      label: "Market Synthesis",
      built: true,
      note: "What the shock revealed across the five.",
    },
    {
      label: "Country Deep Dives",
      built: true,
      note: "One market at a time; chart slot still empty.",
    },
    {
      label: "Interpretation",
      built: false,
      note: "The editorial framework, argued rather than listed.",
    },
    { label: "Limitations", built: false, note: "What this analysis cannot support." },
    { label: "About the Project", built: false, note: "Method, sources and reproducibility." },
    { label: "Creator", built: false, note: "Attribution. Copy is the owner's to write." },
  ];

  return (
    <Container width="page" className="pb-(--section-spacing)">
      {/*
        The page's single h1. A plain block rather than a Section: the hero contract in
        product-architecture.md §2 is its own piece of work, and claiming a section id
        now would put a navigation link on a section that does not exist.
      */}
      <div className="pt-(--section-spacing)">
        <SectionHeader
          sectionId="page"
          headingLevel={1}
          eyebrow="Interactive Analysis"
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
            The finding stays visible; only the drawing convention is behind the
            disclosure. §6 forbids a critical conclusion living inside a ReadMore, and
            "one week is provisional" is exactly that kind of statement -- so it is in
            the summary, with the figure as a StatHighlight.

            The label used to read "What that means for the charts", which promised a
            reading guide and delivered one data caveat. The guide is now its own
            section, and this control is named for what it actually explains.
          */
          <ReadMore
            id="provisional-weeks"
            className="mt-6"
            label="How the charts draw that week"
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
            <p>
              That week is drawn as a dashed segment rather than a solid one, and the tooltip
              names it as a partial week. It is not dropped and not smoothed — a weekly mean
              over fewer days is still the best estimate for the week, it just carries more
              uncertainty than its neighbours.
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
        The reading guide. It sits this early because every question in it is one a reader
        has BEFORE the first chart, and a guide placed after the evidence is a guide that
        arrives too late to prevent a misreading.
      */}
      <Section id="how-to-read">
        <SectionHeader
          sectionId="how-to-read"
          eyebrow="Orientation"
          title="How to Read This Analysis"
          lead="Seven questions this report answers about itself. The short version: the analysis measures co-movement and timing, it establishes no cause, the five market series cannot be compared by height, and the level correlations do not survive comparing week-to-week changes."
        />
        <div className="mt-(--section-header-gap) max-w-reading">
          <HowToRead entries={HOW_TO_READ_ENTRIES} />
        </div>
      </Section>

      {/*
        The normalisation constraint is rendered from countries.json, not retyped.
        It is the guardrail most easily lost in a redesign, and the original
        project's worst analytical error was a cross-market comparison this rule
        forbids -- so it is present before any chart.
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
        EV INTEREST — the five-market chart.

        One chart rather than five country charts, because the question is a comparison of
        timing and five stacked panels would make the reader hold four shapes in memory.
        The guardrail above is repeated here in the reader's words, because a constraint
        read three sections ago is a constraint that has been forgotten.

        The data is selected on the SERVER, so no artifact JSON and no validation code
        reaches the client — only the selected points do.
      */}
      <Section id="ev-interest-markets">
        <SectionHeader
          sectionId="ev-interest-markets"
          eyebrow="EV Interest"
          title="EV Interest Across Five Markets"
          lead="When did EV search interest rise in each market, and how did the timing differ? The five peaks are spread across three calendar months, which is the finding this chart exists to show."
        />
        <div className="mt-(--section-header-gap)">
          <Callout tone="info" kind="Read This First" className="max-w-reading">
            <p className="mt-3 text-small text-fg-secondary">{NORMALISATION_CAVEAT}</p>
          </Callout>
        </div>
        <div className="mt-(--grid-gap)">
          <InterestAcrossMarketsChart data={markets} sources={bundle.manifest.sources} />
        </div>
      </Section>

      {/*
        GLOBAL RELATIONSHIP — crude against the worldwide interest series.

        It follows the five-market chart because the narrative order is EV Interest then
        Global Relationship, and because a reader who has just seen five divergent series
        is better placed to judge what one aggregate line is worth.
      */}
      <Section id="oil-vs-interest">
        <SectionHeader
          sectionId="oil-vs-interest"
          eyebrow="Global Relationship"
          title="Oil Price and Worldwide EV Interest"
          lead="Two measures, two units, two axes — and the caveat that travels with them. The lines rise together, and that co-movement does not survive comparing week-to-week changes."
        />
        <div className="mt-(--section-header-gap)">
          <OilVsWorldwideInterestChart data={oilVsInterest} sources={bundle.manifest.sources} />
        </div>
      </Section>

      {/*
        MARKET SYNTHESIS — the five markets as evidence rows.

        Descriptive, not evaluative: no score, no rank, no ordering by a measured value.
        Each row is a direction within one market, a date, and two classification codes
        turned into phrases, all read from metrics.json.
      */}
      <Section id="market-synthesis">
        <SectionHeader
          sectionId="market-synthesis"
          eyebrow="Market Synthesis"
          title="What the Shock Revealed"
          lead="Five markets, the same weeks, and five different patterns. The rows below are evidence rather than a ranking: each Google Trends series is scaled to its own maximum, so there is no measure on which one market sits above another."
        />
        <div className="mt-(--section-header-gap)">
          <MarketSynthesisList synthesis={synthesis} />
        </div>
      </Section>

      {/*
        COUNTRY DEEP DIVES — one market at a time, from one component.

        No separate country routes: product-architecture.md §1 rules them out because a
        country page lets a reader reach a country conclusion without the evidence that
        qualifies it. Selection is reflected in the URL hash instead, so a deep dive is
        still shareable.
      */}
      <Section id="country-deep-dives">
        <SectionHeader
          sectionId="country-deep-dives"
          eyebrow="Country Deep Dives"
          title="One Market at a Time"
          lead="The same evidence at more depth: the editorial reading, the specification comparison, and the caveats the pipeline attached. A per-market chart is the next thing to land here."
        />
        <div className="mt-(--section-header-gap)">
          <CountryDeepDivePanel synthesis={synthesis} />
        </div>
      </Section>

      {/*
        The information architecture, with what is built marked as built. Not navigation:
        the unbuilt sections have no anchors, and a link that scrolls nowhere is worse
        than a list that is honest about being a list.
      */}
      <Section id="structure">
        <SectionHeader
          sectionId="structure"
          eyebrow="Information Architecture"
          title="Narrative Structure"
          lead="The finished report is one long-scroll argument, read in order. Five of its twelve sections have evidence behind them today; the rest are named here so nothing looks missing by accident."
        />
        <ol className="mt-(--section-header-gap) flex max-w-reading list-none flex-col gap-px overflow-hidden rounded-lg border border-border">
          {structure.map((entry, index) => (
            <li
              key={entry.label}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-surface px-4 py-3 text-small text-fg-secondary"
            >
              <span className="tabular text-fg-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={entry.built ? "text-fg" : ""}>{entry.label}</span>
              {entry.built ? <Badge tone="positive">Built</Badge> : <Badge>To Come</Badge>}
              <span className="w-full text-meta text-fg-muted sm:w-auto sm:flex-1">
                {entry.note}
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </Container>
  );
}
