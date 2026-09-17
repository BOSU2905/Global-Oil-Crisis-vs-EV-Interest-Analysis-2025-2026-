"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { RefObject } from "react";

import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  DataZoomInsideComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

import { resolveChartTheme, type ChartTheme } from "../../styles/chart-language.ts";
import { BREAKPOINTS } from "../../styles/chart-language.ts";
import type { OptionObject } from "./echarts-option.ts";

/**
 * Only the modules this chart uses are registered.
 *
 * Importing `echarts` wholesale pulls every chart type, every component and both
 * renderers into the bundle — for a two-line time series that is most of a
 * megabyte of code that never runs. The tree-shakable entry points cost one
 * registration call and keep the bundle honest.
 *
 * Registration is module-scoped and idempotent, so it happens once per page rather
 * than once per mount.
 */
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  DataZoomInsideComponent,
  CanvasRenderer,
]);

/** Imperative handle, for the controls that sit outside the canvas. */
export interface EChartHandle {
  /** Return to the full x-domain. Required whenever zoom or pan is enabled. */
  readonly resetZoom: () => void;
  /** Show the axis pointer at an observation index — keyboard stepping. */
  readonly showAt: (dataIndex: number) => void;
  /** Hide the tooltip and pointer. */
  readonly hide: () => void;
  /**
   * Show or hide a series by its ECharts `name`.
   *
   * Drives ECharts' own `legendToggleSelect`, so an HTML legend produces exactly the
   * behaviour the canvas legend would have. It exists because the canvas legend is
   * not keyboard-operable — see `ChartLegend`.
   */
  readonly toggleSeries: (name: string) => void;
}

interface EChartProps {
  /**
   * Builds the option. Called with the resolved theme and the measured width, so
   * the caller owns *what* the chart is and this component owns *when* it is built.
   */
  readonly buildOption: (theme: ChartTheme, widthPx: number) => OptionObject;
  /**
   * Number of observations on the x-axis. Needed so ←/→ stepping can clamp, and
   * required rather than optional because a chart region that is focusable but
   * cannot be stepped is worse than one that is not focusable at all.
   */
  readonly observationCount: number;
  /**
   * Accessible name for the chart region. The canvas itself carries none, because a
   * canvas is opaque to assistive technology — the tabular fallback is the
   * accessible representation, not this.
   */
  readonly ariaLabel: string;
  /** Id of the element holding the long description, wired via `aria-describedby`. */
  readonly describedById: string;
  readonly handleRef?: RefObject<EChartHandle | null>;
  /**
   * Height utilities. A class rather than a style value, because the height is
   * banded: `--chart-height-mobile` below `md`, `--chart-height-standard` above.
   * design-system §5 adapts charts by band, and a continuously scaling height makes
   * every viewport a different chart.
   */
  readonly className?: string;
}

/**
 * Thin client wrapper around an ECharts instance.
 *
 * WHAT IT OWNS — and it is deliberately only lifecycle, never appearance:
 *
 *   - **Lazy mount.** An `IntersectionObserver` defers `init()` until the chart is
 *     near the viewport. A canvas that is never scrolled to should not cost a
 *     layout, a render or a theme resolution.
 *   - **Resize.** A `ResizeObserver` debounced ~100ms calls `resize()`. Debounced
 *     because a drag-resize fires continuously and each `resize()` is a full
 *     relayout; 100ms is the figure `product-architecture.md` §4 specifies.
 *     Crossing the `md` boundary rebuilds the option rather than resizing it,
 *     because the layout changes from dual-axis to stacked panels.
 *   - **Dispose.** `dispose()` on unmount. Without it the instance keeps its
 *     canvas, its listeners and its data alive. `reactStrictMode` double-invokes
 *     effects precisely to surface this class of bug, and it is on.
 *   - **Theme.** Resolved once per theme change, not per render, via a
 *     `prefers-color-scheme` listener — canvas cannot consume `var()`, so a colour
 *     that changes has to be re-read and the option rebuilt.
 *
 * WHAT IT DOES NOT OWN: any colour, size, font or series decision. Those come from
 * `buildOption`, which is a pure `.ts` function the unit tests can call.
 */
export function EChart({
  buildOption,
  observationCount,
  ariaLabel,
  describedById,
  handleRef,
  className,
}: EChartProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const themeRef = useRef<ChartTheme | null>(null);
  const bandRef = useRef<"dual-axis" | "stacked-panels" | null>(null);
  const [visible, setVisible] = useState(false);

  /**
   * `buildOption` is a dependency rather than a ref.
   *
   * An earlier draft mirrored it into a ref and assigned during render, to avoid
   * re-initialising the instance when the parent re-rendered. `react-hooks/refs`
   * rejected it, and correctly: a ref written during render can be stale for the
   * commit that reads it. The dependency is safe because callers memoise
   * `buildOption` on the selected data, which does not change at runtime — the
   * artifacts are read at build time. If it ever does change, a full re-init is the
   * right response anyway, because the series would be different data.
   */
  const render = useCallback(
    (force: boolean) => {
      const chart = chartRef.current;
      const wrapper = wrapperRef.current;
      if (chart === null || wrapper === null) return;

      // Measured on the WRAPPER, never on the ECharts container. See the note on
      // the returned markup: the container is out of flow and always matches the
      // wrapper, so the wrapper is the only element whose width is the truth.
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      if (width === 0 || height === 0) return;

      const theme = themeRef.current;
      if (theme === null) return;

      const band = width >= BREAKPOINTS.md ? "dual-axis" : "stacked-panels";
      // Published on the wrapper so the rendered layout band is observable. The
      // decision itself lives in `dualAxisLayout()`; this is how an E2E test can see
      // which branch ran, since axis titles are drawn into a canvas and cannot be
      // queried from the DOM.
      wrapper.dataset["layout"] = band;

      if (!force && band === bandRef.current) {
        // Explicit dimensions rather than letting ECharts re-measure: it would read
        // the container it has already sized, which is what made the chart unable
        // to shrink in the first place.
        chart.resize({ width, height });
        return;
      }

      bandRef.current = band;
      chart.resize({ width, height });
      // `notMerge` because the two layouts have different axis and grid counts;
      // merging a one-grid option into a two-grid instance leaves the second grid
      // behind as an orphan.
      chart.setOption(buildOption(theme, width), { notMerge: true });
    },
    [buildOption],
  );

  // --- lazy mount -----------------------------------------------------------
  useEffect(() => {
    const element = wrapperRef.current;
    if (element === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Start work just before the chart arrives, so it is drawn by the time it is
      // read rather than animating in under the reader's eye.
      { rootMargin: "200px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // --- init, theme, resize, dispose ----------------------------------------
  useEffect(() => {
    if (!visible) return;
    const element = containerRef.current;
    const wrapper = wrapperRef.current;
    if (element === null || wrapper === null) return;

    const readVariable = (name: string): string =>
      getComputedStyle(document.documentElement).getPropertyValue(name);

    themeRef.current = resolveChartTheme(readVariable);
    const chart = echarts.init(element, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    bandRef.current = null;
    render(true);

    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        if (frame !== 0) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = 0;
          render(false);
        });
      }, 100);
    };

    // The WRAPPER is observed, not the ECharts container. Observing the container
    // deadlocks: ECharts writes an inline width onto it, so once it has been sized
    // it never reports a smaller box and the chart can grow but never shrink.
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(wrapper);

    // Dark mode changes every resolved colour, so the theme is re-read and the
    // option rebuilt. Once per change, never per render.
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      themeRef.current = resolveChartTheme(readVariable);
      render(true);
    };
    scheme.addEventListener("change", onScheme);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (frame !== 0) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      scheme.removeEventListener("change", onScheme);
      chart.dispose();
      chartRef.current = null;
    };
  }, [visible, render]);

  // --- imperative handle for the external controls --------------------------
  useImperativeHandle(
    handleRef,
    (): EChartHandle => ({
      resetZoom: () => {
        chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
      },
      showAt: (dataIndex: number) => {
        const chart = chartRef.current;
        if (chart === null) return;
        // The LAST series, not the first. Series 0 is the oil line, which has a null
        // at the final week — and `showTip` against a null point produces nothing, so
        // pressing End did not open the readout for the one week whose missing
        // observation most needs explaining. The last series is the interest line,
        // which has a value at every index. With `trigger: "axis"` the tooltip reads
        // every series at that index regardless of which one is named here.
        const series = chart.getOption()["series"];
        const seriesIndex = Array.isArray(series) ? Math.max(0, series.length - 1) : 0;
        chart.dispatchAction({ type: "showTip", seriesIndex, dataIndex });
      },
      hide: () => {
        chartRef.current?.dispatchAction({ type: "hideTip" });
      },
      toggleSeries: (name: string) => {
        chartRef.current?.dispatchAction({ type: "legendToggleSelect", name });
      },
    }),
    [],
  );

  /**
   * Keyboard access, per the §5 accessibility contract: the chart region is
   * focusable and ←/→ step the axis pointer, so the per-week readout does not
   * depend on a pointer device. Escape dismisses it.
   *
   * The index lives on the DOM node rather than in React state because the arrow
   * keys must not re-render the tree on every press — a re-render would rebuild the
   * option and restart the line animation.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const chart = chartRef.current;
    if (chart === null || observationCount === 0) return;

    const current = Number(event.currentTarget.dataset["index"] ?? "-1");

    let next = current;
    if (event.key === "ArrowRight") next = Math.min(observationCount - 1, current + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, current === -1 ? 0 : current - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = observationCount - 1;
    else if (event.key === "Escape") {
      chart.dispatchAction({ type: "hideTip" });
      event.currentTarget.dataset["index"] = "-1";
      return;
    } else return;

    event.preventDefault();
    event.currentTarget.dataset["index"] = String(next);
    const series = chart.getOption()["series"];
    const seriesIndex = Array.isArray(series) ? Math.max(0, series.length - 1) : 0;
    chart.dispatchAction({ type: "showTip", seriesIndex, dataIndex: next });
  };

  const classes = ["relative w-full"];
  if (className !== undefined) classes.push(className);

  return (
    <div
      ref={wrapperRef}
      className={classes.join(" ")}
      // `img` rather than `figure`: to assistive technology this is one opaque
      // graphic. The table below it is the representation that can be read.
      role="img"
      aria-label={ariaLabel}
      aria-describedby={describedById}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-chart-canvas="true"
      data-index="-1"
    >
      {/*
        TWO ELEMENTS, AND THE SECOND ONE IS WHY THE CHART CAN SHRINK.

        ECharts writes an inline `width` onto whatever element it is initialised in.
        With the instance mounted directly on the sized wrapper, that inline width
        became the wrapper's width, the wrapper stopped tracking its parent, the
        ResizeObserver never saw a smaller box, and the chart could grow but never
        shrink — measured: at a 375px viewport the canvas stayed 1006px wide and the
        page gained 668px of horizontal overflow.

        Absolutely positioning the container takes it out of flow, so its inline
        width cannot feed back into the wrapper's layout. The wrapper is sized purely
        by CSS, and it is the element both the ResizeObserver and `render()` measure.
      */}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
