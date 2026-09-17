"use client";

import { useMemo, useRef, useState } from "react";

import type { DataSource } from "../../data/index.ts";
import type { OilInterestChartData } from "../../lib/oil-vs-interest.ts";
import type { ChartTheme } from "../../styles/chart-language.ts";
import { OIL_IDENTITY, SERIES_IDENTITY } from "../../styles/chart-language.ts";
import { ChartControls } from "./ChartControls.tsx";
import { ChartFrame } from "./ChartFrame.tsx";
import { ChartLegend } from "./ChartLegend.tsx";
import { ChartTableFallback } from "./ChartTableFallback.tsx";
import { EChart, type EChartHandle } from "./EChart.tsx";
import {
  AXIS_TITLE,
  OIL_VS_INTEREST_A11Y,
  OIL_VS_INTEREST_CHART_ID,
  OIL_VS_INTEREST_INTERACTIONS,
  buildChartTableRows,
  formatWeek,
} from "./contract.ts";
import { buildOilVsInterestOption, type SeriesKey } from "./echarts-option.ts";

interface OilVsWorldwideInterestChartProps {
  /** Selected by `selectOilVsWorldwideInterest()` on the server. */
  readonly data: OilInterestChartData;
  /** `manifest.sources[]`, forwarded to the frame's attribution. */
  readonly sources: readonly DataSource[];
  readonly className?: string;
}

/**
 * The Phase 3C step 5 chart prototype: Brent crude against worldwide EV search
 * interest, weekly, over the analysis period.
 *
 * WHAT THIS COMPONENT IS AND IS NOT
 * It is composition and interaction state — nothing else. The data was selected on
 * the server by `selectOilVsWorldwideInterest()`, the option is built by a pure `.ts`
 * function, and the table rows come from the same selected data. This file holds two
 * `useState`s and a ref. **No number below is computed, formatted or compared here.**
 *
 * THE TWO UNITS NEVER SHARE A SCALE
 * Oil is USD per barrel; interest is a 0-100 index Google Trends normalised per
 * series. Both keep their own axis, both axes are named with their unit, and the unit
 * is repeated in the legend label and again in the tooltip. Neither series is
 * rescaled — the option builder is asserted on exactly that point, because
 * normalising oil to 0-100 (or the index a second time) would manufacture the
 * co-movement the chart is supposed to let a reader judge.
 *
 * WHY THE CAVEAT SITS UNDER THE CHART AND NOT IN A FOOTNOTE
 * KIRO.md §16: the project's central finding is that the level association does not
 * survive first differencing. A chart that shows two lines rising together is exactly
 * the artefact §16 exists to qualify, so the qualification is in the frame, visible,
 * without interaction — and it is conditioned on artifact flags
 * (`specification.firstDifferencesSignificant`, `bothSeriesTrendSameDirection`)
 * rather than typed as prose, so it cannot go stale if the pipeline output changes.
 *
 * NO COEFFICIENT APPEARS. The foundation page is asserted to contain no `r =`, no
 * `p =` and no "pearson", and that assertion is deliberately kept: a coefficient
 * belongs to the Robustness section (step 6), which can carry the full specification
 * comparison beside it. Here the comparison travels as words.
 */
export function OilVsWorldwideInterestChart({
  data,
  sources,
  className,
}: OilVsWorldwideInterestChartProps) {
  const chartRef = useRef<EChartHandle | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  /**
   * Which series the reader has hidden. Owned here and fed into the option, rather
   * than dispatched to ECharts: with the canvas legend off, `legendToggleSelect`
   * updated the legend model and changed nothing on screen, because it is the legend
   * component that applies the selection while rendering.
   */
  const [hidden, setHidden] = useState<readonly SeriesKey[]>([]);

  const tableId = `${OIL_VS_INTEREST_CHART_ID}-table`;
  const descriptionId = `${OIL_VS_INTEREST_CHART_ID}-description`;

  const rows = useMemo(() => buildChartTableRows(data), [data]);

  const toggleSeries = (key: SeriesKey) => {
    setHidden((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  };

  const buildOption = useMemo(
    () => (theme: ChartTheme, widthPx: number) =>
      buildOilVsInterestOption({
        data,
        theme,
        widthPx,
        // The type tokens are authored in `rem` and a custom property resolves to that
        // string verbatim. Canvas has no `rem`, so the root size has to travel with
        // the theme or every label is drawn sub-pixel.
        rootFontSizePx: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        hiddenSeries: hidden,
        resolveColour: (name) =>
          getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
      }),
    [data, hidden],
  );

  const { specification, coverage, annotations } = data;

  return (
    <ChartFrame
      a11y={OIL_VS_INTEREST_A11Y}
      eyebrow="Global Relationship"
      sources={sources}
      descriptionId={descriptionId}
      className={className}
      controls={
        <ChartControls
          capabilities={OIL_VS_INTEREST_INTERACTIONS}
          onReset={() => chartRef.current?.resetZoom()}
          tableOpen={tableOpen}
          onToggleTable={() => setTableOpen((open) => !open)}
          tablePanelId={tableId}
        />
      }
      notes={
        <>
          {/*
            The §16 qualification. Conditioned on artifact flags, so the sentence
            tracks the pipeline rather than a developer's memory of it.
          */}
          {specification.levelsSignificant && !specification.firstDifferencesSignificant ? (
            <p className="max-w-reading text-meta text-fg-secondary">
              <span className="text-fg">Levels only.</span> The two lines rise together across
              the period, and that co-movement does not survive comparing week-to-week{" "}
              <em>changes</em> instead of levels
              {specification.bothSeriesTrendSameDirection
                ? " — both series also trend upward over time, which alone can produce the pattern"
                : ""}
              . The chart shows observed co-movement in shape, not evidence that one measure
              moved the other.
            </p>
          ) : null}

          <p className="max-w-reading text-meta text-fg-muted">
            Interest is a Google Trends index scaled to its own maximum, so its level is not
            comparable with any other market&rsquo;s. Brent crude is a benchmark spot price per
            barrel of crude, not a retail pump price.
          </p>

          {coverage.partialWeeks.length > 0 ? (
            <p className="max-w-reading text-meta text-fg-muted">
              <span className="tabular">{formatWeek(coverage.partialWeeks[0] ?? "")}</span>{" "}
              rests on fewer than five trading days and is drawn dashed.
            </p>
          ) : null}

          {coverage.weeksWithoutOil.length > 0 ? (
            <p className="max-w-reading text-meta text-fg-muted">
              The price line stops at{" "}
              <span className="tabular">{formatWeek(annotations.lastOilWeek)}</span>: the Brent
              extract has no observation for{" "}
              <span className="tabular">{formatWeek(coverage.weeksWithoutOil[0] ?? "")}</span>,
              so the series is broken rather than joined across the gap.
            </p>
          ) : null}
        </>
      }
      fallback={
        tableOpen ? (
          <ChartTableFallback rows={rows} a11y={OIL_VS_INTEREST_A11Y} id={tableId} />
        ) : null
      }
    >
      <div className="mt-4">
        <ChartLegend
          items={[
            {
              name: "oil",
              label: data.labels.oil,
              unit: AXIS_TITLE.oil,
              colour: `var(${OIL_IDENTITY.colorVariable})`,
              visible: !hidden.includes("oil"),
            },
            {
              name: "interest",
              label: data.labels.interest,
              unit: AXIS_TITLE.interest,
              colour: `var(${SERIES_IDENTITY.worldwide.colorVariable})`,
              visible: !hidden.includes("interest"),
            },
          ]}
          onToggle={toggleSeries}
        />
      </div>

      <EChart
        buildOption={buildOption}
        observationCount={data.points.length}
        ariaLabel={`${OIL_VS_INTEREST_A11Y.title}. ${OIL_VS_INTEREST_A11Y.description}`}
        describedById={descriptionId}
        handleRef={chartRef}
        className="h-(--chart-height-mobile) md:h-(--chart-height-standard)"
      />
    </ChartFrame>
  );
}
