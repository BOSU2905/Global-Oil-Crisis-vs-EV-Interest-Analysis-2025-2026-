"use client";

import type { MarkerShape } from "../../styles/chart-language.ts";
import { MARKER_PATH } from "./echarts-theme.ts";

interface LegendItem<Key extends string> {
  /** Series key the chart understands. Passed straight back to `onToggle`. */
  readonly name: Key;
  /** Display label. Carries the unit, so the axis mapping is unambiguous. */
  readonly label: string;
  /** Resolved colour for the swatch. */
  readonly colour: string;
  /**
   * Which axis this series is read against, named for the reader.
   *
   * Optional, because it only makes sense where there is more than one axis. On the
   * five-market chart all five series share one axis and one unit, so repeating it
   * five times would add noise and no information — the axis title carries it once.
   */
  readonly unit?: string;
  /**
   * A second fact about the series, shown beside the label without any hover.
   *
   * It exists for the five-market chart's peak weeks. §5 rule 5 forbids critical
   * information being hover-only, and "when did this market turn" is the chart's whole
   * question — so each market's peak date is stated in the legend, not only in the
   * tooltip and the table.
   */
  readonly detail?: string;
  /**
   * The series' marker, drawn on its swatch — the same shape as its hover dot, its peak
   * marker and its tooltip row, so the shape is a cue a reader can carry between them.
   * Omitted where there is no marker (the prototype's two series differ by unit and axis).
   */
  readonly marker?: MarkerShape;
  /** Pinned by the reader. Stated in words, not by the swatch alone. */
  readonly pinned?: boolean;
  readonly visible: boolean;
}

interface ChartLegendProps<Key extends string> {
  readonly items: readonly LegendItem<Key>[];
  readonly onToggle: (name: Key) => void;
  /**
   * The entry under the pointer or holding keyboard focus, or `null`. For hover emphasis:
   * focusing an entry emphasises its series exactly as hovering it does, so emphasis is
   * reachable without a pointer.
   */
  readonly onHover?: (name: Key | null) => void;
  readonly className?: string;
}

/**
 * The chart legend, as real DOM.
 *
 * WHY NOT ECHARTS' OWN LEGEND
 * Because it is painted into the canvas, and that fails two requirements at once.
 * `docs/product-architecture.md` §5 rule 6 requires every control to be reachable and
 * operable by keyboard — a shape on a canvas cannot be tabbed to, focused or
 * announced. And it is untestable without guessing pixel coordinates; measured, clicks
 * across the entire canvas legend strip toggled nothing observable.
 *
 * These are `<button aria-pressed>` rather than checkboxes: the control does not
 * collect a value, it performs an action with a sticky state, which is what
 * `aria-pressed` describes — here, whether the series is shown.
 *
 * NOT COLOUR ALONE (§5 rule 7). The swatch, the marker shape and the label each say
 * which series is which. Hiding a series strikes its label through and drops its
 * opacity, and a pinned series says "Pinned" — no state is carried by colour alone.
 */
export function ChartLegend<Key extends string>({
  items,
  onToggle,
  onHover,
  className,
}: ChartLegendProps<Key>) {
  const classes = ["flex flex-wrap items-center gap-x-5 gap-y-2"];
  if (className !== undefined) classes.push(className);

  return (
    <ul className={classes.join(" ")}>
      {items.map((item) => (
        <li key={item.name}>
          <button
            type="button"
            aria-pressed={item.visible}
            onClick={() => onToggle(item.name)}
            onPointerEnter={() => onHover?.(item.name)}
            onPointerLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(item.name)}
            onBlur={() => onHover?.(null)}
            className={[
              "group inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm text-meta",
              "transition-colors duration-(--duration-fast) ease-out",
              item.visible ? "text-fg-secondary hover:text-fg" : "text-fg-subtle",
            ].join(" ")}
          >
            {/* A short solid line, because the series are lines, with the series' own
                marker on it. Dimmed rather than hidden when the series is off, so the
                control still reads as a toggle. */}
            <span
              aria-hidden="true"
              className="relative inline-flex h-2.5 w-4 shrink-0 items-center transition-opacity duration-(--duration-fast)"
              style={{ opacity: item.visible ? 1 : 0.3 }}
            >
              <span className="block h-0.5 w-full" style={{ backgroundColor: item.colour }} />
              {item.marker === undefined || item.marker === "none" ? null : (
                <svg
                  viewBox="0 0 10 10"
                  className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2"
                >
                  <path d={MARKER_PATH[item.marker]} fill={item.colour} />
                </svg>
              )}
            </span>
            <span className={item.visible ? "" : "line-through"}>{item.label}</span>
            {item.unit === undefined ? null : (
              <span className="text-fg-muted">{item.unit}</span>
            )}
            {item.detail === undefined ? null : (
              <span className="tabular text-fg-muted">{item.detail}</span>
            )}
            {item.pinned === true ? (
              <span className="text-label uppercase text-fg">Pinned</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
