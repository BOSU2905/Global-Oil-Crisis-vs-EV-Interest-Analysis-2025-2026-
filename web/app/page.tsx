import { COUNTRY_IDS, getComparability, getSeriesLabel } from "../src/data/index.ts";
import { getArtifacts } from "../src/lib/artifacts.ts";

/**
 * Foundation page — Phase 3C step 1 of docs/product-architecture.md §10.
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
    <div className="mx-auto max-w-page px-(--page-padding-inline) py-(--section-spacing)">
      <header className="max-w-reading">
        <p className="text-label uppercase text-fg-muted">Analytical foundation</p>
        <h1 className="mt-3 text-display text-fg">
          Global Oil Crisis <span className="text-fg-subtle">vs</span> EV Interest Analysis
        </h1>
        <p className="mt-6 text-lead text-fg-secondary">
          An interactive analysis of Brent crude prices and electric-car search interest across
          five markets, 2025–2026.
        </p>
      </header>

      {/* Scope, read from the artifacts rather than typed as literals. */}
      <section aria-labelledby="scope-heading" className="mt-16">
        <h2 id="scope-heading" className="text-label uppercase text-fg-muted">
          Observation scope
        </h2>
        <dl className="mt-4 grid gap-(--grid-gap) sm:grid-cols-3 max-w-content">
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
      </section>

      {/*
        The normalisation constraint is rendered from countries.json, not retyped.
        It is the guardrail most easily lost in a redesign, and the original
        project's worst analytical error was a cross-market comparison this rule
        forbids -- so it is present from the first page that exists.
      */}
      <section
        aria-labelledby="comparability-heading"
        className="mt-16 max-w-reading rounded-lg border border-border bg-warning-surface p-(--card-padding)"
      >
        <h2 id="comparability-heading" className="text-label uppercase text-warning">
          Comparability constraint
        </h2>
        <p className="mt-3 text-small text-fg-secondary">{comparability.explanation}</p>
        <p className="mt-3 text-small text-fg-secondary">
          <span className="text-fg">Remedy.</span> {comparability.remedy}
        </p>
      </section>

      {/* The information architecture, listed as intent. Not navigation yet. */}
      <section aria-labelledby="outline-heading" className="mt-16 max-w-reading">
        <h2 id="outline-heading" className="text-label uppercase text-fg-muted">
          Narrative structure
        </h2>
        <p className="mt-3 text-small text-fg-secondary">
          The finished product is one long-scroll argument in ten sections, read in order. None
          of them is implemented yet — this page is the shell they will be built into.
        </p>
        <ol className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border border-border">
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
      </section>
    </div>
  );
}
