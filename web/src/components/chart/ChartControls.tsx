"use client";

import type { ChartInteractionCapabilities } from "../../styles/chart-language.ts";

interface ChartControlsProps {
  /** Only the interactions the chart declares get a control. */
  readonly capabilities: ChartInteractionCapabilities;
  readonly onReset: () => void;
  /** Fallback table state. Omit when a chart has no table (none currently). */
  readonly tableOpen?: boolean;
  readonly onToggleTable?: () => void;
  /** Id of the table panel, for `aria-controls`. */
  readonly tablePanelId?: string;
  /**
   * Whether this chart draws the visible zoom slider.
   *
   * It changes the hint rather than adding a control: with a slider present the
   * primary way to zoom is visible on screen, and the hint's job becomes naming the
   * accelerators. Without one the hint has to name the only gesture there is.
   */
  readonly hasZoomSlider?: boolean;
  readonly className?: string;
}

const BUTTON_CLASS =
  "inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 " +
  "text-small text-fg-secondary transition-colors duration-(--duration-fast) ease-out " +
  "hover:border-border-interactive hover:text-fg";

/**
 * The controls a chart declares, and no others.
 *
 * `ChartControls` renders from `ChartInteractionCapabilities` rather than from props
 * a caller passes ad hoc, which is what stops a chart growing a button for an
 * interaction it does not support. `assertInteractionsCoherent()` already refuses a
 * zoomable chart with no reset, so by the time this renders the combination is known
 * to be sane.
 *
 * WHY RESET IS A BUTTON AND ZOOM IS NOT
 * Zoom and pan are direct manipulation — the slider, the wheel, a drag, a pinch — and
 * giving them buttons would be a second, worse way to do the same thing. Reset has no
 * gesture, and without it a reader who pinch-zooms on a phone can be stranded in a
 * four-week window with no way back. That asymmetry is why the capability contract
 * makes reset mandatory and the others optional.
 *
 * THE HINT IS NOT DECORATION
 * Every gesture named in it is undiscoverable without being told: a wheel modifier, a
 * drag on a plot, and two keys. So it is told — quietly, and only the parts that
 * apply. The keyboard half is named for everyone rather than hidden behind a
 * pointer-width media query, because it is the only zoom a keyboard user has: ECharts
 * paints the slider into the canvas, where nothing can be focused.
 */
export function ChartControls({
  capabilities,
  onReset,
  tableOpen,
  onToggleTable,
  tablePanelId,
  hasZoomSlider,
  className,
}: ChartControlsProps) {
  const classes = ["flex flex-wrap items-center gap-2"];
  if (className !== undefined) classes.push(className);

  const gestures: string[] = [];
  if (capabilities.zoom) {
    gestures.push(
      hasZoomSlider === true ? "Drag the slider below to zoom" : "Ctrl + scroll to zoom",
    );
  }
  if (capabilities.pan) gestures.push("drag the plot to pan");
  if (capabilities.zoom) gestures.push("+ / − keys to zoom");
  if (capabilities.inspect) gestures.push("arrow keys to step");

  return (
    <div className={classes.join(" ")}>
      {capabilities.reset ? (
        <button type="button" onClick={onReset} className={BUTTON_CLASS}>
          Reset view
        </button>
      ) : null}

      {onToggleTable === undefined || tablePanelId === undefined ? null : (
        <button
          type="button"
          onClick={onToggleTable}
          aria-expanded={tableOpen === true}
          aria-controls={tablePanelId}
          className={BUTTON_CLASS}
        >
          {tableOpen === true ? "Hide data table" : "View data table"}
        </button>
      )}

      {gestures.length === 0 ? null : (
        <p className="ml-auto hidden text-meta text-fg-muted md:block">
          {gestures.join(" · ")}
        </p>
      )}
    </div>
  );
}
