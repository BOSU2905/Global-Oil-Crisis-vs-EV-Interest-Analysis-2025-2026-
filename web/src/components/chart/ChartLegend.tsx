"use client";

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
   * Dashed rather than solid swatch.
   *
   * Redundant encoding: the five markets are distinguished by colour AND dash, and a
   * legend that showed five identical solid rules would drop the cue the palette's
   * closest pair depends on.
   */
  readonly dashed?: boolean;
  readonly visible: boolean;
}

interface ChartLegendProps<Key extends string> {
  readonly items: readonly LegendItem<Key>[];
  readonly onToggle: (name: Key) => void;
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
 * `aria-pressed` describes. Toggling dispatches ECharts' own `legendToggleSelect`, so
 * the behaviour is exactly what the canvas legend would have done.
 *
 * NOT COLOUR ALONE (§5 rule 7). Three cues carry which series is which: the swatch,
 * the label, and the unit beside it. Hiding a series also strikes its label through
 * and drops its opacity, so the state is not carried by colour either.
 */
export function ChartLegend<Key extends string>({
  items,
  onToggle,
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
            className={[
              "group inline-flex min-h-11 items-center gap-2 rounded-sm text-meta",
              "transition-colors duration-(--duration-fast) ease-out",
              item.visible ? "text-fg-secondary hover:text-fg" : "text-fg-subtle",
            ].join(" ")}
          >
            {/* A short line, because the series are lines. Dimmed rather than hidden
                when the series is off, so the control still reads as a toggle. The
                dash is copied from the series' own identity, so the swatch cannot
                claim a solid line where the plot draws a dashed one. */}
            <span
              aria-hidden="true"
              className="h-0 w-3 shrink-0 transition-opacity duration-(--duration-fast)"
              style={{
                borderTopWidth: 2,
                borderTopStyle: item.dashed === true ? "dashed" : "solid",
                borderTopColor: item.colour,
                opacity: item.visible ? 1 : 0.3,
              }}
            />
            <span className={item.visible ? "" : "line-through"}>{item.label}</span>
            {item.unit === undefined ? null : (
              <span className="text-fg-muted">{item.unit}</span>
            )}
            {item.detail === undefined ? null : (
              <span className="tabular text-fg-muted">{item.detail}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
