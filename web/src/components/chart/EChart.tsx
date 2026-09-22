"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RefObject } from "react";

import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

import { resolveChartTheme, type ChartTheme } from "../../styles/chart-language.ts";
import { BREAKPOINTS } from "../../styles/chart-language.ts";
import type { OptionObject } from "./echarts-theme.ts";

/**
 * Only the modules the charts use are registered.
 *
 * Importing `echarts` wholesale pulls every chart type, every component and both
 * renderers into the bundle — for weekly line series that is most of a megabyte of
 * code that never runs. The tree-shakable entry points cost one registration call
 * and keep the bundle honest.
 *
 * Registration is module-scoped and idempotent, so it happens once per page rather
 * than once per mount. `DataZoomSliderComponent` and `MarkPointComponent` joined the
 * list for the five-market chart: the visible zoom slider and the subtle peak
 * markers respectively.
 */
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  CanvasRenderer,
]);

/** The full x-domain, in the percentages ECharts' dataZoom speaks. */
const FULL_WINDOW = { start: 0, end: 100 } as const;

/** Smallest window a keyboard zoom may produce, as a percentage of the domain. */
const MIN_WINDOW_SPAN = 8;

/** Fallback when `--duration-slow` cannot be read. Matches the token's value. */
const RESET_DURATION_FALLBACK_MS = 360;

/**
 * `prefers-reduced-motion` as an external store.
 *
 * Module scope, so the two functions have stable identities across renders and
 * `useSyncExternalStore` does not resubscribe on every commit.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const subscribeReducedMotion = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const readReducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION_QUERY).matches;

interface ZoomWindow {
  readonly start: number;
  readonly end: number;
}

/** Imperative handle, for the controls that sit outside the canvas. */
export interface EChartHandle {
  /** Return to the full x-domain. Required whenever zoom or pan is enabled. */
  readonly resetZoom: () => void;
  /** Show the axis pointer at an observation index — keyboard stepping. */
  readonly showAt: (dataIndex: number) => void;
  /** Hide the tooltip and pointer. */
  readonly hide: () => void;
}

interface EChartProps {
  /**
   * Builds the option. Called with the resolved theme, the measured width and
   * whether this build is the chart's entrance — so the caller owns *what* the chart
   * is and this component owns *when* it is built.
   */
  readonly buildOption: (theme: ChartTheme, widthPx: number, animate: boolean) => OptionObject;
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
 *   - **Entrance.** An `IntersectionObserver` defers `init()` until the chart is
 *     genuinely in view, and the first `setOption` is the only one that animates.
 *     The wrapper publishes the stage as `data-entrance`, so "did it happen, and did
 *     it stop" is answerable from the DOM rather than from a screenshot.
 *   - **Resize.** A `ResizeObserver` debounced ~100ms calls `resize()`. Debounced
 *     because a drag-resize fires continuously and each `resize()` is a full
 *     relayout; 100ms is the figure `product-architecture.md` §4 specifies.
 *     Crossing the `md` boundary rebuilds the option rather than resizing it,
 *     because the layout changes from dual-axis to stacked panels — and the reader's
 *     zoom window is carried across that rebuild.
 *   - **Dispose.** `dispose()` on unmount. Without it the instance keeps its
 *     canvas, its listeners and its data alive. `reactStrictMode` double-invokes
 *     effects precisely to surface this class of bug, and it is on.
 *   - **Theme.** Resolved once per theme change, not per render, via a
 *     `prefers-color-scheme` listener — canvas cannot consume `var()`, so a colour
 *     that changes has to be re-read and the option rebuilt.
 *   - **Reduced motion.** A `prefers-reduced-motion` listener rebuilds with
 *     animation off. Interaction is untouched: hover, tooltip, crosshair, zoom, pan,
 *     reset and the legend all behave identically.
 *   - **Reset.** See `runReset` — the transition is driven here rather than left to
 *     ECharts, because leaving it to ECharts made it non-deterministic.
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
  /** False until the entrance build has run, so only the first build animates. */
  const enteredRef = useRef(false);
  /** Handle of the in-flight reset transition, so a second reset cancels the first. */
  const resetFrameRef = useRef(0);
  const [visible, setVisible] = useState(false);

  /*
    `useSyncExternalStore` rather than a `useEffect` that calls `setState`.

    A media query IS an external store, which is what this hook is for, and reading it
    in an effect body triggers a cascading render on every mount — `react-hooks` rejects
    it for exactly that reason. The server snapshot is `false` because there is no media
    query on the server; that is harmless here, because the chart does not mount until an
    `IntersectionObserver` fires in a browser.

    Declared before `render` because `render` depends on it: a reader who turns reduced
    motion on gets a rebuild with animation off rather than a stale option.
  */
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  );

  // --- zoom window helpers --------------------------------------------------

  /**
   * The window ECharts currently shows, as percentages.
   *
   * Read from the resolved option rather than tracked in React state: the reader can
   * change it by wheel, by drag or by dragging the slider, none of which passes
   * through this component, so the model is the only honest source.
   */
  const readWindow = useCallback((): ZoomWindow => {
    const chart = chartRef.current;
    if (chart === null) return FULL_WINDOW;
    const zooms = chart.getOption()["dataZoom"];
    const first = Array.isArray(zooms)
      ? (zooms[0] as Record<string, unknown> | undefined)
      : undefined;
    const start = Number(first?.["start"]);
    const end = Number(first?.["end"]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return FULL_WINDOW;
    return { start, end };
  }, []);

  /**
   * Apply a window, instantly.
   *
   * `dataZoomIndex: 0` is explicit because a chart may declare both an `inside` and a
   * `slider` component; ECharts then links every dataZoom that targets the same axis,
   * so naming one addresses the group. Without the index the payload matches all of
   * them by accident rather than by intent.
   *
   * `animation: { duration: 0 }` is the load-bearing part. `getAnimationConfig()` in
   * ECharts gives the update payload's animation the HIGHEST priority, above the
   * option's own `animationDurationUpdate` — so passing zero here means each frame is
   * applied immediately and the only animation running is the one below.
   */
  const applyWindow = useCallback((next: ZoomWindow): void => {
    chartRef.current?.dispatchAction({
      type: "dataZoom",
      dataZoomIndex: 0,
      start: next.start,
      end: next.end,
      animation: { duration: 0 },
    });
  }, []);

  const cancelReset = useCallback((): void => {
    if (resetFrameRef.current !== 0) {
      cancelAnimationFrame(resetFrameRef.current);
      resetFrameRef.current = 0;
    }
    wrapperRef.current?.removeAttribute("data-resetting");
  }, []);

  /**
   * Return to the full domain, deterministically.
   *
   * WHY THIS IS NOT ONE `dispatchAction`
   * It used to be, and the result was a reset that felt smooth after some gestures
   * and snapped after others. Two mechanisms in ECharts 6 produce that, and both were
   * read in the library source rather than guessed at:
   *
   *   1. **The roam dispatch is throttled.** `roams.js` pushes every wheel/drag
   *      increment through a `fixRate` throttle whose interval `DataZoomModel`
   *      defaults to 100ms while animation is on. The last increment of a gesture is
   *      therefore *scheduled*, not sent — so a reset issued within that window was
   *      overwritten by a roam action that arrived after it, and the view snapped
   *      back to where the gesture had left it.
   *   2. **The roam dispatch carries its own animation.** It sets
   *      `animation: { easing: "cubicOut", duration: 100 }`, and
   *      `getAnimationConfig()` treats the update payload as the highest-priority
   *      source. A reset sent with no animation payload fell back to the option's
   *      `animationDurationUpdate` instead, so the reset's duration and easing
   *      depended on what the reader had done immediately before it.
   *
   * So the transition is owned here: read the current window, interpolate to the full
   * domain over `--duration-slow`, and apply each frame with animation suppressed. A
   * trailing throttled roam action that lands mid-transition is overwritten by the
   * next frame instead of winning, every sequence takes the same path, and a second
   * reset cancels the first rather than racing it.
   *
   * REDUCED MOTION NEEDS NO BRANCH. `tokens.css` collapses `--duration-slow` to 1ms
   * under `prefers-reduced-motion`, so the loop below completes on its first frame.
   * The token is the single source of truth, exactly as it is for CSS transitions.
   */
  const runReset = useCallback((): void => {
    const chart = chartRef.current;
    const wrapper = wrapperRef.current;
    if (chart === null || wrapper === null) return;

    cancelReset();

    const from = readWindow();
    if (from.start === FULL_WINDOW.start && from.end === FULL_WINDOW.end) {
      // Already home. Still apply once, so a reset is never a no-op the reader
      // cannot distinguish from a broken control.
      applyWindow(FULL_WINDOW);
      return;
    }

    const rawDuration = getComputedStyle(document.documentElement).getPropertyValue(
      "--duration-slow",
    );
    const parsed = Number.parseFloat(rawDuration);
    const duration =
      Number.isFinite(parsed) && parsed > 0 ? parsed : RESET_DURATION_FALLBACK_MS;

    const started = performance.now();
    wrapper.dataset["resetting"] = "true";

    const step = (now: number): void => {
      const elapsed = now - started;
      const linear = elapsed >= duration ? 1 : elapsed / duration;
      // cubic-out, written without `Math.pow`: the chart layer's safety scan forbids
      // it, and three multiplications are clearer anyway.
      const inverse = 1 - linear;
      const eased = 1 - inverse * inverse * inverse;

      applyWindow({
        start: from.start + (FULL_WINDOW.start - from.start) * eased,
        end: from.end + (FULL_WINDOW.end - from.end) * eased,
      });

      if (linear >= 1) {
        // Land on the exact domain rather than on the last interpolated value.
        applyWindow(FULL_WINDOW);
        resetFrameRef.current = 0;
        wrapper.removeAttribute("data-resetting");
        return;
      }
      resetFrameRef.current = requestAnimationFrame(step);
    };

    resetFrameRef.current = requestAnimationFrame(step);
  }, [applyWindow, cancelReset, readWindow]);

  /**
   * Keyboard zoom, because the visible slider is drawn into the canvas.
   *
   * ECharts paints the slider's handles, so they cannot be tabbed to or focused —
   * the same limitation that made the legend HTML. §5 rule 6 requires every control
   * to be operable by keyboard, so `+` and `-` zoom about the centre of the current
   * window and the reset button returns it. Announced in the control hint, not left
   * to be discovered.
   */
  const zoomBy = useCallback(
    (factor: number): void => {
      cancelReset();
      const current = readWindow();
      const span = current.end - current.start;
      const centre = current.start + span / 2;
      const nextSpan = Math.min(100, Math.max(MIN_WINDOW_SPAN, span * factor));
      let start = centre - nextSpan / 2;
      let end = centre + nextSpan / 2;
      if (start < 0) {
        end -= start;
        start = 0;
      }
      if (end > 100) {
        start -= end - 100;
        end = 100;
      }
      applyWindow({ start: Math.max(0, start), end: Math.min(100, end) });
    },
    [applyWindow, cancelReset, readWindow],
  );

  /**
   * `buildOption` is a dependency rather than a ref.
   *
   * An earlier draft mirrored it into a ref and assigned during render, to avoid
   * re-initialising the instance when the parent re-rendered. `react-hooks/refs`
   * rejected it, and correctly: a ref written during render can be stale for the
   * commit that reads it. The dependency is safe because callers memoise
   * `buildOption` on the selected data, which does not change at runtime — the
   * artifacts are read at build time.
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

      // The entrance is the FIRST build and only the first build. A band change, a
      // theme change or a legend toggle must update in place — a line that redraws
      // itself from the left edge every time a reader hides a series is decoration,
      // not an entrance.
      const animate = !enteredRef.current && !reducedMotion;
      // Carry the reader's zoom window across a rebuild. `notMerge` resets dataZoom
      // to the option's declared 0-100, so without this a resize silently undid a
      // zoom the reader had set.
      const previousWindow = bandRef.current === null ? FULL_WINDOW : readWindow();

      bandRef.current = band;
      chart.resize({ width, height });
      // `notMerge` because the two layouts have different axis and grid counts;
      // merging a one-grid option into a two-grid instance leaves the second grid
      // behind as an orphan.
      chart.setOption(buildOption(theme, width, animate), { notMerge: true });

      if (
        previousWindow.start !== FULL_WINDOW.start ||
        previousWindow.end !== FULL_WINDOW.end
      ) {
        applyWindow(previousWindow);
      }

      if (animate) {
        enteredRef.current = true;
        wrapper.dataset["entrance"] = "running";
        // One timer, for one transition, whose length is the option's own entrance
        // duration plus the stagger — not an arbitrary delay standing in for an
        // event. ECharts exposes no "animation finished" callback, and the value
        // published here is only an observable marker: nothing about the chart's
        // behaviour depends on it.
        window.setTimeout(() => {
          if (wrapperRef.current !== null) wrapperRef.current.dataset["entrance"] = "done";
        }, 1200);
      } else if (wrapper.dataset["entrance"] === undefined) {
        enteredRef.current = true;
        wrapper.dataset["entrance"] = reducedMotion ? "reduced" : "done";
      }
    },
    [applyWindow, buildOption, readWindow, reducedMotion],
  );

  // --- mount when genuinely in view ----------------------------------------
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
      // No positive `rootMargin`. The prototype pre-mounted 200px early so the chart
      // was already drawn by the time it was read; with an entrance animation that is
      // exactly wrong — the line would draw itself off-screen and the reader would
      // arrive at a finished chart. A threshold rather than a bare crossing, so a
      // chart that is one pixel into view does not start.
      { threshold: 0.15 },
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

    // Publish the window so an E2E test can assert zoom, pan and reset without
    // reaching into the library or guessing at pixels.
    const publishWindow = () => {
      const current = readWindow();
      wrapper.dataset["zoomStart"] = String(Math.round(current.start * 10) / 10);
      wrapper.dataset["zoomEnd"] = String(Math.round(current.end * 10) / 10);
    };
    publishWindow();
    chart.on("dataZoom", publishWindow);

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
      bandRef.current = null;
      render(true);
    };
    scheme.addEventListener("change", onScheme);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (frame !== 0) cancelAnimationFrame(frame);
      if (resetFrameRef.current !== 0) cancelAnimationFrame(resetFrameRef.current);
      resetFrameRef.current = 0;
      resizeObserver.disconnect();
      scheme.removeEventListener("change", onScheme);
      chart.off("dataZoom", publishWindow);
      chart.dispose();
      chartRef.current = null;
    };
  }, [visible, render, readWindow]);

  // --- imperative handle for the external controls --------------------------
  useImperativeHandle(
    handleRef,
    (): EChartHandle => ({
      resetZoom: runReset,
      showAt: (dataIndex: number) => {
        const chart = chartRef.current;
        if (chart === null) return;
        // The LAST series, not the first. Series 0 is the oil line, which has a null
        // at the final week — and `showTip` against a null point produces nothing, so
        // pressing End did not open the readout for the one week whose missing
        // observation most needs explaining. The last series has a value at every
        // index. With `trigger: "axis"` the tooltip reads every series at that index
        // regardless of which one is named here.
        const series = chart.getOption()["series"];
        const seriesIndex = Array.isArray(series) ? Math.max(0, series.length - 1) : 0;
        chart.dispatchAction({ type: "showTip", seriesIndex, dataIndex });
      },
      hide: () => {
        chartRef.current?.dispatchAction({ type: "hideTip" });
      },
    }),
    [runReset],
  );

  /**
   * Keyboard access, per the §5 accessibility contract: the chart region is
   * focusable, ←/→ step the axis pointer so the per-week readout does not depend on a
   * pointer device, and `+`/`-` reach the zoom the canvas slider cannot offer a
   * keyboard. Escape dismisses the readout.
   *
   * The index lives on the DOM node rather than in React state because the arrow
   * keys must not re-render the tree on every press — a re-render would rebuild the
   * option and, worse, could restart the entrance.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const chart = chartRef.current;
    if (chart === null || observationCount === 0) return;

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(0.6);
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomBy(1 / 0.6);
      return;
    }

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
