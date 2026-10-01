"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

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
 * How long the pointer must rest on a line before it lifts, and how long a lifted line
 * survives the pointer slipping off it. Without the first, reading across the plot
 * flashes every line the pointer crosses; without the second, a 2px line flickers while
 * a reader traces it.
 */
const LINE_DWELL_MS = 120;
const LINE_LEAVE_MS = 180;

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
 * description, in the notes under the plot, and in the tooltip's footer.
 *
 * EMPHASIS, AND WHAT IT IS NOT
 * A reader can lift one market: hover or focus its legend entry, rest the pointer on its
 * line, or pin it — click its line, or press its number (1–5) with the chart focused.
 * The rest dim. It is driven only by where the reader points, it is off by default, and
 * it changes no value and no axis, so a lifted line is never "more" of anything. Pinning
 * ends with a second click, Escape, `0`, Reset view, or hiding the market.
 *
 * WHAT IS COMPOSITION AND WHAT IS NOT
 * This file holds interaction state and nothing else. The data was selected on the server
 * by `selectInterestAcrossMarkets()`, the option is built by a pure `.ts` function, the
 * accessibility contract and the table rows come from the same data. **No number below
 * is computed, formatted or compared here.**
 *
 * NO CLASSIFICATION APPEARS ON THE CHART. The evidence groups and robustness labels
 * travel with the selected data because the market-synthesis view needs them, and this
 * component deliberately renders none of them: a chart of five rising lines annotated
 * with "no detectable association" would be arguing with itself in a space too small
 * to explain why.
 */
export function InterestAcrossMarketsChart({
  data,
  sources,
  className,
}: InterestAcrossMarketsChartProps) {
  const chartRef = useRef<EChartHandle | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [hidden, setHidden] = useState<readonly CountryId[]>([]);
  /** Lifted while hovered or focused — the legend entry or, after a dwell, the line. */
  const [hovered, setHovered] = useState<CountryId | null>(null);
  /** Lifted until the reader lets go of it. */
  const [pinned, setPinned] = useState<CountryId | null>(null);
  const lineTimer = useRef<number | undefined>(undefined);

  const tableId = `${MARKETS_CHART_ID}-table`;
  const descriptionId = `${MARKETS_CHART_ID}-description`;
  const order = useMemo(() => data.series.map((market) => market.id), [data]);

  const a11y = useMemo(() => buildMarketsA11y(data), [data]);
  const rows = useMemo(() => toMarketTableCells(buildMarketTableRows(data)), [data]);

  // Hidden markets cannot be emphasised: there is no line to lift.
  const emphasised = useMemo(() => {
    const ids: CountryId[] = [];
    for (const id of [pinned, hovered]) {
      if (id !== null && !hidden.includes(id) && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [hidden, hovered, pinned]);

  useEffect(() => () => window.clearTimeout(lineTimer.current), []);

  const asMarket = (id: string | null): CountryId | null =>
    id === null ? null : (order.find((entry) => entry === id) ?? null);

  const toggleMarket = (id: CountryId) => {
    setHidden((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
    // A market that disappears takes its emphasis with it.
    if (pinned === id) setPinned(null);
    if (hovered === id) setHovered(null);
  };

  /** Line hover, with a dwell before lifting and a grace period before dropping. */
  const onLineHover = (id: string | null) => {
    window.clearTimeout(lineTimer.current);
    const market = asMarket(id);
    lineTimer.current = window.setTimeout(
      () => setHovered(market),
      market === null ? LINE_LEAVE_MS : LINE_DWELL_MS,
    );
  };

  const togglePin = (id: CountryId | null) => {
    setPinned((current) => (id === null || current === id ? null : id));
  };

  /**
   * Keyboard pinning, with the chart region focused: `1`–`5` pin a market in legend
   * order, pressing it again or `0` or Escape lets go. Keys EChart does not handle
   * bubble up to here, so arrow-key stepping keeps working while a market is pinned.
   */
  const onChartKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "0") {
      if (pinned !== null) setPinned(null);
      return;
    }
    if (!/^[1-9]$/.test(event.key)) return;
    const market = order[Number(event.key) - 1];
    if (market === undefined || hidden.includes(market)) return;
    event.preventDefault();
    togglePin(market);
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
        emphasised,
        resolveColour: (name) =>
          getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
      }),
    [data, hidden, emphasised],
  );

  const { peakSpread, coverage } = data;
  const pinnedLabel = data.series.find((market) => market.id === pinned)?.label;
  const pinKeys = `1–${String(order.length)}`;

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
              onReset={() => {
                chartRef.current?.resetZoom();
                setPinned(null);
              }}
              tableOpen={tableOpen}
              onToggleTable={() => setTableOpen((open) => !open)}
              tablePanelId={tableId}
              hasZoomSlider
              hints={[`click a line or press ${pinKeys} to pin a market`]}
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
              Each market&rsquo;s own peak week is marked with a hollow copy of its marker and
              named in the legend.
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
              marker: SERIES_IDENTITY[market.id].marker,
              pinned: pinned === market.id,
              visible: !hidden.includes(market.id),
            }))}
            onToggle={toggleMarket}
            onHover={(id) => {
              window.clearTimeout(lineTimer.current);
              setHovered(id);
            }}
          />
        </div>

        {/*
          Announced, so a keyboard reader who pins with a number key hears what happened,
          and visible, so everyone can see how to let go. Present only while pinned.
        */}
        <p role="status" className="mt-1 min-h-5 text-meta text-fg-muted">
          {pinnedLabel === undefined ? null : (
            <>
              <span className="text-fg">{pinnedLabel} pinned.</span> Click its line again, press
              Escape or reset the view to let go.
            </>
          )}
        </p>

        {/*
          `data-emphasised` and `data-pinned` publish the interaction state, like
          `data-zoom-start` does for the window: the lines are canvas, so this is how a
          test — or a reader of the DOM — can tell which market is lifted.
        */}
        <div
          onKeyDown={onChartKeyDown}
          data-emphasised={emphasised.join(" ")}
          data-pinned={pinned ?? ""}
        >
          <EChart
            buildOption={buildOption}
            observationCount={data.weeks.length}
            ariaLabel={`${a11y.title}. ${a11y.description}`}
            describedById={descriptionId}
            handleRef={chartRef}
            onLineHover={onLineHover}
            onLineClick={(id) => togglePin(asMarket(id))}
            // Taller than the prototype at every width: five lines need vertical room
            // to stay distinguishable, and the visible zoom slider takes 46px of it.
            className="h-(--chart-height-compact) md:h-(--chart-height-hero)"
          />
        </div>
      </ChartFrame>
    </ChartReveal>
  );
}
