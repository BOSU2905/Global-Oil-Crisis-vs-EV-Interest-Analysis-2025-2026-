"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
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
import {
  cssTimeToMs,
  entranceLength,
  lineSeriesOf,
  nearestLine,
  optionWithout,
  settleWindowEdge,
  wheelDeltaPx,
  wheelZoomFactor,
  zoomCategoryWindow,
  type CategoryWindow,
  type ChartMotion,
  type OptionObject,
} from "./echarts-theme.ts";

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

/**
 * How a build reaches the live chart. The distinction is what stops a legend toggle or a
 * hover from costing the reader their zoom window.
 *
 *   rebuild  first build, layout-band change, theme change: `notMerge`, because the two
 *            layouts have different axis and grid counts; the zoom window is read first
 *            and re-applied after
 *   update   a new option on the SAME layout — a legend toggle, an emphasis change:
 *            merged in, series replaced by id, and `dataZoom` left out entirely, so the
 *            window is never touched and the tooltip stays where it is
 *   resize   the box changed but the band did not: `resize()` only
 */
type RenderMode = "rebuild" | "update" | "resize";

/**
 * Pointer travel, in CSS pixels, after which a press is a drag rather than a click. A
 * drag-pan that ends over a line must not also pin it.
 */
const CLICK_SLOP_PX = 4;

/** Fallback when `--duration-slow` cannot be read. Matches the token's value. */
const RESET_DURATION_FALLBACK_MS = 360;

/**
 * Idle time after which the next wheel event starts a NEW gesture, re-reading the window
 * from the chart. Anything that moved the window meanwhile — the slider, a drag, the
 * keyboard, a reset — is therefore picked up rather than overwritten.
 */
const WHEEL_GESTURE_GAP_MS = 200;

/**
 * The glide between two whole-week windows during a wheel zoom.
 *
 * The same 100ms cubic-out ECharts uses for its own slider, so wheel and slider feel
 * like one control. It is safe here where it was not before because it is dispatched
 * only when the drawn week window actually changes, and never against the gesture.
 *
 * It only runs while the option has animation ENABLED — `getAnimationConfig()` drops a
 * dispatch's tween when it is off. That is why every build after the entrance is built
 * `settled` (animation on, zero durations) rather than with animation off, and why under
 * `prefers-reduced-motion` (`reduced`, animation off) each step is instant. See
 * `ChartMotion`.
 */
const WHEEL_ZOOM_TWEEN = { duration: 100, easing: "cubicOut" } as const;

/**
 * One wheel gesture, held between animation frames.
 *
 * `intent` is where the reader's gesture has taken the window, continuously, in week
 * units; `drawn` is the whole-week window the chart is showing. They differ by design —
 * see `settleWindowEdge` — and keeping both is what lets a slow pinch accumulate without
 * the axis's rounding throwing any of it away. Replaced, never mutated: the React
 * Compiler's lint rejects writes through an object that aliases a ref.
 */
interface WheelGesture {
  readonly intent: CategoryWindow;
  readonly drawn: CategoryWindow;
  /** Product of every event's factor since the last frame was applied. */
  readonly factor: number;
  /** Pointer x, relative to the chart wrapper, at the most recent event. */
  readonly pointerX: number;
  /** Pending `requestAnimationFrame` handle, or 0. */
  readonly frame: number;
  /** `performance.now()` of the most recent event. */
  readonly last: number;
}

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
   * Builds the option. Called with the resolved theme, the measured width and the motion
   * state of this build — `entrance` for the first build, `settled` for every build after
   * it, `reduced` under `prefers-reduced-motion` — so the caller owns *what* the chart is
   * and this component owns *when* it is built.
   */
  readonly buildOption: (
    theme: ChartTheme,
    widthPx: number,
    motion: ChartMotion,
  ) => OptionObject;
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
   * The series id of the line under the pointer, and `null` when it leaves every line.
   * For hover emphasis. Decided geometrically against the drawn segments (`nearestLine`),
   * because ECharts' own hit band for a thin line was measured to sit beside the stroke.
   */
  readonly onLineHover?: (seriesId: string | null) => void;
  /** A click or tap on a line — never the end of a drag-pan. For pinning. */
  readonly onLineClick?: (seriesId: string) => void;
  /**
   * A zoom or pan gesture began (`true`) or ended (`false`): Ctrl + wheel or a trackpad
   * pinch, until the wheel has been idle for `WHEEL_GESTURE_GAP_MS`, or a press that
   * travelled — a drag-pan or the slider — until it is released.
   *
   * While one is active `onLineHover` is NOT called: the view is moving under the pointer,
   * so nothing the pointer passes is a line the reader pointed at. When it ends,
   * `onLineHover` reports the line now under the pointer, if that changed. For callers that
   * hold pointer-driven state still across a gesture.
   */
  readonly onGestureChange?: (active: boolean) => void;
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
 *   - **Wheel zoom.** See `onWheel` — ECharts' own wheel handling zoomed in fixed steps
 *     whatever the size of the gesture, so a slow, gentle pinch lurched back and forth,
 *     and it cancelled plain wheel events so the page could not scroll past a chart.
 *   - **Gestures.** While a zoom or pan is in progress, line hover is not decided — the
 *     lines are moving under the pointer — and the caller is told (`onGestureChange`).
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
  onLineHover,
  onLineClick,
  onGestureChange,
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
  /** The wheel gesture in progress, or `null` between gestures. */
  const wheelRef = useRef<WheelGesture | null>(null);
  /** The option last applied, so a hit test reads exactly the values being drawn. */
  const optionRef = useRef<OptionObject | null>(null);
  const [visible, setVisible] = useState(false);
  /**
   * Set once, when the entrance has finished drawing. A change of it is what moves the live
   * option from `entrance` to `settled` (see the end of `render`), through the same update
   * effect a legend toggle uses.
   */
  const [entranceEnded, setEntranceEnded] = useState(false);

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
   * Abandon a wheel gesture: drop its pending frame and forget its window, so the next
   * wheel event re-reads the chart. Every other control that moves the window calls it.
   */
  const cancelWheel = useCallback((): void => {
    const gesture = wheelRef.current;
    if (gesture !== null && gesture.frame !== 0) cancelAnimationFrame(gesture.frame);
    wheelRef.current = null;
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
    cancelWheel();

    const from = readWindow();
    if (from.start === FULL_WINDOW.start && from.end === FULL_WINDOW.end) {
      // Already home. Still apply once, so a reset is never a no-op the reader
      // cannot distinguish from a broken control.
      applyWindow(FULL_WINDOW);
      return;
    }

    // `cssTimeToMs`, not `parseFloat`: the built CSS serialises the token as `.36s`, and
    // `parseFloat` read that as 0.36ms — the reset snapped on its first frame.
    const parsed = cssTimeToMs(
      getComputedStyle(document.documentElement).getPropertyValue("--duration-slow"),
    );
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
  }, [applyWindow, cancelReset, cancelWheel, readWindow]);

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
      cancelWheel();
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
    [applyWindow, cancelReset, cancelWheel, readWindow],
  );

  /**
   * Apply the wheel gesture's accumulated zoom, once per animation frame.
   *
   * Coalescing is half the fix. A trackpad sends wheel events faster than the screen
   * refreshes, and applying each one separately is what let ECharts' tweens chase each
   * other; here every event since the last frame multiplies into one factor, and the
   * frame applies it once.
   *
   * The anchor is the week under the pointer in the window AS DRAWN, read from the axis
   * itself (`convertToPixel` on the drawn window's two ends), so the week the reader is
   * pointing at stays under the pointer. The new window is computed on the continuous
   * intent and then settled onto whole weeks with hysteresis, and only a change of drawn
   * window is dispatched — so a tremor that does not move a week boundary moves nothing.
   */
  const applyWheelFrame = useCallback((): void => {
    const gesture = wheelRef.current;
    const chart = chartRef.current;
    if (gesture === null || chart === null) return;

    const intervals = observationCount - 1;
    const left = chart.convertToPixel({ xAxisIndex: 0 }, gesture.drawn.start);
    const right = chart.convertToPixel({ xAxisIndex: 0 }, gesture.drawn.end);
    const width = right - left;
    const fraction =
      Number.isFinite(width) && width > 0
        ? Math.min(1, Math.max(0, (gesture.pointerX - left) / width))
        : 0.5;
    const anchor = gesture.drawn.start + fraction * (gesture.drawn.end - gesture.drawn.start);

    const intent = zoomCategoryWindow(
      gesture.intent,
      anchor,
      gesture.factor,
      intervals,
      (MIN_WINDOW_SPAN / 100) * intervals,
    );
    const settled: CategoryWindow = {
      start: settleWindowEdge(intent.start, gesture.drawn.start),
      end: settleWindowEdge(intent.end, gesture.drawn.end),
    };
    const moved =
      settled.end - settled.start >= 1 &&
      (settled.start !== gesture.drawn.start || settled.end !== gesture.drawn.end);
    const drawn = moved ? settled : gesture.drawn;

    wheelRef.current = { ...gesture, intent, drawn, factor: 1, frame: 0 };
    if (!moved) return;

    chart.dispatchAction({
      type: "dataZoom",
      dataZoomIndex: 0,
      start: (drawn.start / intervals) * 100,
      end: (drawn.end / intervals) * 100,
      animation: WHEEL_ZOOM_TWEEN,
    });
  }, [observationCount]);

  /**
   * Every wheel event over the chart, before ECharts sees it.
   *
   * Registered in the CAPTURE phase on the wrapper and stopped there, so ECharts' own
   * listener — which cancels plain wheel events and zooms in fixed 10% steps (see
   * `insideZoom`) — never runs. A plain wheel then does what a reader expects on a long
   * page: it scrolls. Only Ctrl + wheel, which is also how browsers deliver a trackpad
   * pinch, is claimed, and only that is `preventDefault`-ed, so the browser does not
   * page-zoom instead.
   */
  const onWheel = useCallback(
    (event: WheelEvent): void => {
      event.stopPropagation();
      if (!event.ctrlKey) return;
      event.preventDefault();

      const wrapper = wrapperRef.current;
      if (wrapper === null || chartRef.current === null || observationCount < 2) return;
      const deltaPx = wheelDeltaPx(event.deltaY, event.deltaMode);
      if (deltaPx === 0) return;

      const now = performance.now();
      const previous = wheelRef.current;
      let base: WheelGesture;
      if (previous === null || now - previous.last > WHEEL_GESTURE_GAP_MS) {
        // A new gesture starts from wherever the window is NOW, so the slider, a drag,
        // the keyboard or a reset since the last gesture is respected, not overwritten.
        if (previous !== null && previous.frame !== 0) cancelAnimationFrame(previous.frame);
        cancelReset();
        const intervals = observationCount - 1;
        const current = readWindow();
        const intent: CategoryWindow = {
          start: (current.start / 100) * intervals,
          end: (current.end / 100) * intervals,
        };
        base = {
          intent,
          drawn: { start: Math.round(intent.start), end: Math.round(intent.end) },
          factor: 1,
          pointerX: 0,
          frame: 0,
          last: now,
        };
      } else {
        base = previous;
      }

      wheelRef.current = {
        ...base,
        last: now,
        factor: base.factor * wheelZoomFactor(deltaPx),
        pointerX: event.clientX - wrapper.getBoundingClientRect().left,
        frame: base.frame !== 0 ? base.frame : requestAnimationFrame(applyWheelFrame),
      };
    },
    [applyWheelFrame, cancelReset, observationCount, readWindow],
  );

  /**
   * Apply the current option to the live chart. An EFFECT EVENT, not a dependency.
   *
   * It used to be a `useCallback` on `buildOption`, and it was a dependency of the init
   * effect — so every new `buildOption` (a legend toggle) DISPOSED the instance and
   * created a new one. Measured on both charts: zoomed to 32–68%, toggled one legend
   * entry, and the window snapped back to 0–100 on a brand-new canvas element. Now the
   * instance lives exactly as long as the chart is mounted, and a new option is applied
   * in place by the effect below (`"update"`), which keeps the window and the tooltip.
   */
  const render = useEffectEvent((mode: RenderMode): void => {
    const chart = chartRef.current;
    const wrapper = wrapperRef.current;
    if (chart === null || wrapper === null) return;

    // Measured on the WRAPPER, never on the ECharts container. See the note on the
    // returned markup: the container is out of flow and always matches the wrapper, so
    // the wrapper is the only element whose width is the truth.
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    if (width === 0 || height === 0) return;

    const theme = themeRef.current;
    if (theme === null) return;

    const band = width >= BREAKPOINTS.md ? "dual-axis" : "stacked-panels";
    // Published on the wrapper so the rendered layout band is observable. The decision
    // itself lives in `dualAxisLayout()`; this is how an E2E test can see which branch
    // ran, since axis titles are drawn into a canvas and cannot be queried from the DOM.
    wrapper.dataset["layout"] = band;
    const sameBand = band === bandRef.current;

    if (mode === "resize" && sameBand) {
      // Explicit dimensions rather than letting ECharts re-measure: it would read the
      // container it has already sized, which is what made the chart unable to shrink.
      chart.resize({ width, height });
      return;
    }

    if (mode === "update" && sameBand) {
      // Merged, not rebuilt — see `RenderMode`. Leaving `dataZoom` out of the merge is
      // what keeps the reader's window; replacing series by id is what removes a series
      // the legend has hidden. `settled`, not animation off: an emphasis change used to
      // switch animation off, and every zoom step after it jumped instead of gliding.
      const next = buildOption(theme, width, reducedMotion ? "reduced" : "settled");
      optionRef.current = next;
      chart.setOption(optionWithout(next, ["dataZoom"]), { replaceMerge: ["series"] });
      return;
    }

    // The entrance is the FIRST build and only the first build. A band change, a theme
    // change or a legend toggle must update in place — a line that redraws itself from
    // the left edge every time a reader hides a series is decoration, not an entrance.
    // Every build after it is `settled`: nothing animates by itself, but a zoom step still
    // glides.
    const motion: ChartMotion = reducedMotion
      ? "reduced"
      : enteredRef.current
        ? "settled"
        : "entrance";
    const animate = motion === "entrance";
    // Carry the reader's zoom window across a rebuild. `notMerge` resets dataZoom to the
    // option's declared 0-100, so without this a resize silently undid the reader's zoom.
    const previousWindow = bandRef.current === null ? FULL_WINDOW : readWindow();

    bandRef.current = band;
    chart.resize({ width, height });
    const built = buildOption(theme, width, motion);
    optionRef.current = built;
    chart.setOption(built, { notMerge: true });

    if (previousWindow.start !== FULL_WINDOW.start || previousWindow.end !== FULL_WINDOW.end) {
      applyWindow(previousWindow);
    }

    if (animate) {
      enteredRef.current = true;
      wrapper.dataset["entrance"] = "running";
      // One timer, for one transition, whose length is read from the option that runs it —
      // the longest series' stagger plus its duration (`entranceLength`): ECharts exposes no
      // "animation finished" callback. It used to be a fixed 1200ms, which the five-market
      // chart's last line (480ms stagger + 900ms) outlasted.
      //
      // When it ends, the live option moves to `settled`. An entrance option left in place
      // keeps each series' stagger, and ECharts re-runs every line's clip transition on each
      // zoom step with that stagger whenever the step names no delay of its own — the
      // wheel's and a drag-pan's do not. Measured on the five-market chart: 22 extra
      // repaints per wheel gesture, the last one 480ms after the gesture ended, with
      // nothing to show for them. Nothing visible changes at the switch.
      window.setTimeout(() => {
        if (chartRef.current !== chart) return;
        wrapper.dataset["entrance"] = "done";
        setEntranceEnded(true);
      }, entranceLength(built));
    } else if (wrapper.dataset["entrance"] === undefined) {
      enteredRef.current = true;
      wrapper.dataset["entrance"] = reducedMotion ? "reduced" : "done";
    }
  });

  /** The latest line callbacks, callable from listeners the init effect registers. */
  const emitLineHover = useEffectEvent((seriesId: string | null): void => {
    onLineHover?.(seriesId);
  });
  const emitLineClick = useEffectEvent((seriesId: string): void => {
    onLineClick?.(seriesId);
  });
  const emitGesture = useEffectEvent((active: boolean): void => {
    onGestureChange?.(active);
  });
  /** Whether anyone is listening — the prototype chart is not, and skips the hit test. */
  const wantsLineEvents = useEffectEvent(
    (): boolean => onLineHover !== undefined || onLineClick !== undefined,
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
    render("rebuild");

    // Publish the window so an E2E test can assert zoom, pan and reset without
    // reaching into the library or guessing at pixels.
    const publishWindow = () => {
      const current = readWindow();
      wrapper.dataset["zoomStart"] = String(Math.round(current.start * 10) / 10);
      wrapper.dataset["zoomEnd"] = String(Math.round(current.end * 10) / 10);
    };
    publishWindow();
    chart.on("dataZoom", publishWindow);

    // Capture phase and non-passive: `onWheel` must run before ECharts' listener on the
    // canvas, and must be allowed to cancel a Ctrl + wheel so the browser does not zoom
    // the page instead of the chart.
    wrapper.addEventListener("wheel", onWheel, { capture: true, passive: false });

    // Line hover and click, for callers that emphasise or pin a series — decided
    // GEOMETRICALLY against the values being drawn, not by ECharts' element events: its
    // hit band for a 2px line was measured to sit beside the stroke (see `LINE_HIT_PX`).
    const lineAt = (offsetX: number, offsetY: number): string | null => {
      const option = optionRef.current;
      if (option === null || !wantsLineEvents()) return null;
      if (!chart.containPixel({ gridIndex: 0 }, [offsetX, offsetY])) return null;
      const lines = lineSeriesOf(option);
      const count = lines[0]?.values.length ?? 0;
      const raw = Number(chart.convertFromPixel({ xAxisIndex: 0 }, offsetX));
      if (count === 0 || !Number.isFinite(raw)) return null;
      const at = Math.min(count - 1, Math.max(0, Math.round(raw)));
      return nearestLine(
        { x: offsetX, y: offsetY },
        lines.map((line) => ({
          id: line.id,
          vertices: [at - 1, at, at + 1].flatMap((index) => {
            const value = line.values[index];
            if (value === undefined || value === null) return [];
            const pixel = chart.convertToPixel({ seriesId: line.id }, [index, value]);
            return Array.isArray(pixel) ? [{ x: Number(pixel[0]), y: Number(pixel[1]) }] : [];
          }),
        })),
      );
    };

    const zr = chart.getZr();
    let hoveredLine: string | null = null;
    /** Where the pointer last was over the chart, in chart pixels; `null` once it left. */
    let pointer: { readonly x: number; readonly y: number } | null = null;

    // --- gestures: is the reader zooming or panning right now? -----------------------
    // While the view moves under the pointer, nothing the pointer passes is a line the
    // reader pointed at. Measured before this existed: a drag-pan that began on a line
    // lifted it mid-drag, and a zoom begun as the pointer reached a line lifted it
    // mid-gesture — each one an option rebuild in the middle of the motion. So line hover is
    // not decided during a gesture, the caller is told when one starts and ends (it holds
    // any pending lift or drop), and the state is published as `data-gesture`.
    let wheeling = false;
    let dragging = false;
    let wheelIdle: ReturnType<typeof setTimeout> | undefined;
    const gestureActive = (): boolean => wheeling || dragging;
    /** After a gesture: report the line now under the pointer, if it is not the last one. */
    const settleHover = (): void => {
      const id = pointer === null ? null : lineAt(pointer.x, pointer.y);
      if (id === hoveredLine) return;
      hoveredLine = id;
      emitLineHover(id);
    };
    const setGesture = (nextWheeling: boolean, nextDragging: boolean): void => {
      const was = gestureActive();
      wheeling = nextWheeling;
      dragging = nextDragging;
      const active = gestureActive();
      if (active === was) return;
      if (active) wrapper.dataset["gesture"] = "true";
      else wrapper.removeAttribute("data-gesture");
      // The boundary first, then the hover it settles on: a caller that held a pending
      // change re-arms it, and a new line under the pointer then replaces it.
      emitGesture(active);
      if (!active) settleHover();
    };

    const onPlotMove = (event: { offsetX: number; offsetY: number }) => {
      pointer = { x: event.offsetX, y: event.offsetY };
      // During a gesture neither the hover nor the cursor is decided here: ECharts' own drag
      // cursor stays, and `settleHover` decides the line once the view is still.
      if (gestureActive()) return;
      const id = lineAt(event.offsetX, event.offsetY);
      // A line under the pointer is clickable — it pins — so it gets the pointer cursor.
      // Registered after ECharts' own roam listener, so this wins over its `grab` cursor.
      if (id !== null) zr.setCursorStyle("pointer");
      if (id === hoveredLine) return;
      hoveredLine = id;
      emitLineHover(id);
    };
    const onPlotOut = () => {
      pointer = null;
      if (gestureActive() || hoveredLine === null) return;
      hoveredLine = null;
      emitLineHover(null);
    };
    zr.on("mousemove", onPlotMove);
    zr.on("globalout", onPlotOut);

    // A Ctrl + wheel or a pinch is a zoom gesture until the wheel has been idle for as long
    // as `onWheel` waits before starting a new one. A second listener rather than code in
    // `onWheel`, because `onWheel` lives outside this effect and cannot reach this state.
    // Capture phase like it; passive, because this one never cancels anything.
    const onWheelGesture = (event: WheelEvent) => {
      // A plain wheel scrolls the page past the chart. It is not a chart gesture.
      if (!event.ctrlKey) return;
      if (wheelIdle !== undefined) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => {
        wheelIdle = undefined;
        setGesture(false, dragging);
      }, WHEEL_GESTURE_GAP_MS);
      if (!wheeling) setGesture(true, dragging);
    };
    wrapper.addEventListener("wheel", onWheelGesture, { capture: true, passive: true });

    // A press that travelled is a pan, and a pan that ends over a line must not pin it:
    // the browser still fires `click` after the drag.
    let pressX = 0;
    let pressY = 0;
    let travelled = false;
    let pressing = false;
    const onPressStart = (event: PointerEvent) => {
      pressX = event.clientX;
      pressY = event.clientY;
      travelled = false;
      pressing = true;
    };
    const onPressMove = (event: PointerEvent) => {
      if (event.buttons === 0) return;
      const distance = Math.abs(event.clientX - pressX) + Math.abs(event.clientY - pressY);
      if (distance > CLICK_SLOP_PX) travelled = true;
      // A press begun on the chart that has travelled is a drag — a pan, or the slider —
      // until it is released, wherever that happens.
      if (travelled && pressing && !dragging) setGesture(wheeling, true);
    };
    // On the window, because a drag can end anywhere. `travelled` is deliberately left set:
    // the `click` that follows the release reads it.
    const onPressEnd = () => {
      pressing = false;
      if (dragging) setGesture(wheeling, false);
    };
    wrapper.addEventListener("pointerdown", onPressStart, { capture: true, passive: true });
    wrapper.addEventListener("pointermove", onPressMove, { capture: true, passive: true });
    window.addEventListener("pointerup", onPressEnd, { capture: true, passive: true });
    window.addEventListener("pointercancel", onPressEnd, { capture: true, passive: true });
    const onPlotClick = (event: { offsetX: number; offsetY: number }) => {
      if (travelled) return;
      const id = lineAt(event.offsetX, event.offsetY);
      if (id !== null) emitLineClick(id);
    };
    zr.on("click", onPlotClick);

    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        if (frame !== 0) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = 0;
          render("resize");
        });
      }, 100);
    };

    // The WRAPPER is observed, not the ECharts container. Observing the container
    // deadlocks: ECharts writes an inline width onto it, so once it has been sized
    // it never reports a smaller box and the chart can grow but never shrink.
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(wrapper);

    // Dark mode changes every resolved colour, so the theme is re-read and the option
    // rebuilt — including the slider, which a merged update would leave in the old
    // colours. `bandRef` is NOT reset: that sentinel means "first build", and resetting
    // it here used to discard the reader's zoom window on every theme change.
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      themeRef.current = resolveChartTheme(readVariable);
      render("rebuild");
    };
    scheme.addEventListener("change", onScheme);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (frame !== 0) cancelAnimationFrame(frame);
      if (resetFrameRef.current !== 0) cancelAnimationFrame(resetFrameRef.current);
      resetFrameRef.current = 0;
      resizeObserver.disconnect();
      scheme.removeEventListener("change", onScheme);
      wrapper.removeEventListener("wheel", onWheel, { capture: true });
      wrapper.removeEventListener("wheel", onWheelGesture, { capture: true });
      wrapper.removeEventListener("pointerdown", onPressStart, { capture: true });
      wrapper.removeEventListener("pointermove", onPressMove, { capture: true });
      window.removeEventListener("pointerup", onPressEnd, { capture: true });
      window.removeEventListener("pointercancel", onPressEnd, { capture: true });
      if (wheelIdle !== undefined) clearTimeout(wheelIdle);
      cancelWheel();
      chart.off("dataZoom", publishWindow);
      zr.off("mousemove", onPlotMove);
      zr.off("globalout", onPlotOut);
      zr.off("click", onPlotClick);
      chart.dispose();
      chartRef.current = null;
      optionRef.current = null;
    };
    // `render` and the line callbacks are effect events, so they are not dependencies:
    // nothing about a new option may re-create the instance. See `render`.
  }, [visible, readWindow, onWheel, cancelWheel]);

  // --- a new option, applied in place ---------------------------------------
  // A legend toggle or an emphasis change produces a new `buildOption`; a reduced-motion
  // change alters what the next build may animate; the end of the entrance moves the option
  // to `settled`. None of them re-creates the instance: the option is merged into the live
  // chart, keeping the zoom window and the tooltip. Before the chart has mounted `render`
  // returns at once.
  useEffect(() => {
    render("update");
  }, [buildOption, reducedMotion, entranceEnded]);

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
