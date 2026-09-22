"use client";

import { useMemo, useRef, useState } from "react";

import type { CountryId, DataSource } from "../../data/index.ts";
import type { MarketsChartData } from "../../lib/interest-across-markets.ts";
import type { ChartTheme } from "../../styles/chart-language.ts";
import { SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { ChartControls } from "./ChartControls.tsx";
import { ChartFrame } from "./ChartFrame.tsx";
import { ChartLegend } from "./ChartLegend.tsx";
import { ChartReveal } from "./ChartReveal.tsx";
import { ChartTableFallback } from "./ChartTableFallback.tsx";
import { EChart, type EChartHandle } from "./EChart.tsx";
import { formatWeek } from "./contract.ts";
import { buildMarketsOption } from "./markets-option.ts";
import {
  MARKETS_CHART_ID,
  MARKETS_INTERACTIONS,
  NORMALISATION_CAVEAT,
  buildMarketTableRows,
  buildMarketsA11y,
  toMarketTableCells,
} from "./markets-contract.ts";

interface InterestAcrossMarketsChartProps {
  /** Selected by `selectInterestAcrossMarkets()` on the server. */
  readonly data: MarketsChartData;
  /** `manifest.sources[]`, forwarded to the frame's attribution. */
  readonly sources: readonly DataSource[];
  readonly className?: string;
}

/**
 * EV search interest across the five markets, weekly — one chart instead of five.
 *
 * WHY ONE CHART AND NOT FIVE SMALL MULTIPLES
 * Because the question is a comparison. "When did interest rise, and how did the
 * timing differ" is answered by putting the five turns on one x-axis where a reader
 * can see that Norway's is nine weeks before the United States'. Five stacked panels
 * would show five shapes and make the reader hold four of them in memory — and would
 * repeat the same axis, the same caveat and the same legend five times.
 *
 * THE ONE THING THIS CHART MUST NOT LET A READER CONCLUDE
 * That a higher line means more search interest. Each series is an independent Google
 * Trends query rescaled to its own maximum, so every line reaches 100 somewhere and
 * one market's 90 has no defined relationship to another's 70. The constraint is
 * stated in four places, deliberately: in the axis title, in the frame's visible
 * description, in the notes under the plot, and in the tooltip's footer. It is the one
 * piece of copy in this file that is not allowed to be subtle.
 *
 * WHAT IS COMPOSITION AND WHAT IS NOT
 * This file holds two `useState`s and a ref. The data was selected on the server by
 * `selectInterestAcrossMarkets()`, the option is built by a pure `.ts` function, the
 * accessibility contract is built from the same data, and the table rows come from it
 * too. **No number below is computed, formatted or compared here.**
 *
 * NO CLASSIFICATION APPEARS ON THE CHART. The evidence groups and robustness labels
 * travel with the selected data because the market-synthesis rows need them, and this
 * component deliberately renders none of them: a chart of five rising lines annotated
 * with "no detectable association" would be arguing with itself in a space too small
 * to explain why. That explanation is the synthesis section's job.
 */
export function InterestAcrossMarketsChart({
  data,
  sources,
  className,
}: InterestAcrossMarketsChartProps) {
  const chartRef = useRef<EChartHandle | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [hidden, setHidden] = useState<readonly CountryId[]>([]);

  const tableId = `${MARKETS_CHART_ID}-table`;
  const descriptionId = `${MARKETS_CHART_ID}-description`;

  const a11y = useMemo(() => buildMarketsA11y(data), [data]);
  const rows = useMemo(() => toMarketTableCells(buildMarketTableRows(data)), [data]);

  const toggleMarket = (id: CountryId) => {
    setHidden((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  const buildOption = useMemo(
    () => (theme: ChartTheme, widthPx: number, animate: boolean) =>
      buildMarketsOption({
        data,
        theme,
        widthPx,
        animate,
        rootFontSizePx: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        hiddenMarkets: hidden,
        resolveColour: (name) =>
          getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
      }),
    [data, hidden],
  );

  const { peakSpread, coverage } = data;

  return (
    <ChartReveal>
      <ChartFrame
        a11y={a11y}
        eyebrow="EV Interest"
        sources={sources}
        descriptionId={descriptionId}
        className={className}
        controls={
          <div data-chart-settle>
            <ChartControls
              capabilities={MARKETS_INTERACTIONS}
              onReset={() => chartRef.current?.resetZoom()}
              tableOpen={tableOpen}
              onToggleTable={() => setTableOpen((open) => !open)}
              tablePanelId={tableId}
              hasZoomSlider
            />
          </div>
        }
        notes={
          <>
            {/*
              The guardrail, in the reader's words, verbatim from
              `NORMALISATION_CAVEAT` so the chart, the long description and the section
              callout all make exactly the same claim.
            */}
            <p className="max-w-reading text-meta text-fg-secondary">
              <span className="text-fg">Shape and timing, not height.</span>{" "}
              {NORMALISATION_CAVEAT}
            </p>

            {/*
              The peak dispersion, read from the artifact. This is the finding the
              original project got backwards — it claimed a synchronised peak in a
              single month — so the numbers are rendered from
              `metrics.global.peak_dispersion` rather than described.
            */}
            <p className="max-w-reading text-meta text-fg-muted">
              The five peaks fall in <span className="tabular">{peakSpread.distinctWeeks}</span>{" "}
              distinct weeks across{" "}
              <span className="tabular">{peakSpread.distinctMonths.length}</span> calendar
              months, spanning <span className="tabular">{peakSpread.spanWeeks}</span> weeks
              {peakSpread.synchronisedWithinOneMonth
                ? "."
                : " — so they are not synchronised within a single month."}{" "}
              Each market&rsquo;s own peak week is marked with a hollow ring and named in the
              legend.
            </p>

            <p className="max-w-reading text-meta text-fg-muted">
              The shaded band is the elevated crude-price window, from{" "}
              <span className="tabular">{formatWeek(data.oilContext.onsetWeek)}</span> to{" "}
              <span className="tabular">{formatWeek(data.oilContext.lastOilWeek)}</span>. It is
              context for the timing, not an explanation of it: three of these five markets show
              no detectable or inconclusive association with crude prices.
            </p>

            {coverage.partialWeeks.length > 0 ? (
              <p className="max-w-reading text-meta text-fg-muted">
                <span className="tabular">{formatWeek(coverage.partialWeeks[0] ?? "")}</span>{" "}
                rests on fewer than five trading days of crude pricing; the search series are
                unaffected, and the week is marked in the table.
              </p>
            ) : null}
          </>
        }
        fallback={
          tableOpen ? <ChartTableFallback rows={rows} a11y={a11y} id={tableId} /> : null
        }
      >
        <div className="mt-4" data-chart-settle>
          <ChartLegend
            items={data.series.map((market) => ({
              name: market.id,
              label: market.label,
              colour: `var(${SERIES_IDENTITY[market.id].colorVariable})`,
              // The peak week, visible without any hover. §5 rule 5.
              detail: `peak ${formatWeek(market.peakWeek)}`,
              dashed: SERIES_IDENTITY[market.id].dash !== null,
              visible: !hidden.includes(market.id),
            }))}
            onToggle={toggleMarket}
          />
        </div>

        <EChart
          buildOption={buildOption}
          observationCount={data.weeks.length}
          ariaLabel={`${a11y.title}. ${a11y.description}`}
          describedById={descriptionId}
          handleRef={chartRef}
          // Taller than the prototype at every width: five lines need vertical room
          // to stay distinguishable, and the visible zoom slider takes 46px of it.
          className="h-(--chart-height-compact) md:h-(--chart-height-hero)"
        />
      </ChartFrame>
    </ChartReveal>
  );
}
