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
 * Zoom and pan are direct manipulation — wheel, drag, pinch — and giving them
 * buttons would be a second, worse way to do the same thing. Reset has no gesture,
 * and without it a reader who pinch-zooms on a phone can be stranded in a four-week
 * window with no way back. That asymmetry is why the capability contract makes reset
 * mandatory and the others optional.
 *
 * THE HINT IS NOT DECORATION
 * Wheel zoom requires a modifier key, because a chart inside a long-scroll article
 * that swallows the wheel is worse than one that does not zoom at all. A gesture
 * with a modifier is undiscoverable without being told, so it is told — quietly, and
 * only at pointer widths where it applies.
 */
export function ChartControls({
  capabilities,
  onReset,
  tableOpen,
  onToggleTable,
  tablePanelId,
  className,
}: ChartControlsProps) {
  const classes = ["flex flex-wrap items-center gap-2"];
  if (className !== undefined) classes.push(className);

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

      {capabilities.zoom ? (
        <p className="ml-auto hidden text-meta text-fg-muted md:block">
          Ctrl + scroll to zoom · drag to pan · arrow keys to step
        </p>
      ) : null}
    </div>
  );
}
