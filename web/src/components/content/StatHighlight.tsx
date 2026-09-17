interface StatHighlightProps {
  /** Pre-formatted by the caller. Never computed, never re-rounded. */
  readonly value: string;
  readonly unit?: string;
  /**
   * What the figure is, for assistive technology. A bare "31" inside a sentence
   * reads fine visually and poorly aloud, so the label is required rather than
   * optional.
   */
  readonly label: string;
  readonly className?: string;
}

/**
 * A statistic inline in prose: tabular figures, slightly stronger than the
 * surrounding text.
 *
 * WHY NOT JUST A SPAN WITH `.tabular`
 * Because of the `aria-label`. An inline figure is the one place a number appears
 * without a visible label beside it, so the label has to travel with it. The
 * visible text stays exactly the value; the accessible name adds what it measures.
 *
 * THE FACE IS GEIST SANS, NOT GEIST MONO
 * This is an inline figure in a sentence. `.numeric` would put it in the monospace
 * face and drop a console-looking token into the middle of prose — the same defect
 * that was already fixed once for the *unit* beside it. `.tabular` keeps the
 * surrounding face and adds only the digit alignment.
 *
 * Emphasis is weight and colour against `--color-fg-secondary` body text, not a
 * larger size: a figure that grows mid-sentence breaks the line rhythm. The weight is
 * `font-medium`. That is a real interpolated instance of the bundled Geist variable
 * axis rather than a face the platform has to own, which is what makes 500 usable at
 * all — it was forbidden while the typeface was OS-supplied, because 500 was
 * pixel-identical to 600 on Segoe UI and collapsed to 400 on a 400/700-only face.
 * 600 here read as a heading dropped into a sentence. `text-fg` still does most of
 * the visual work.
 */
export function StatHighlight({ value, unit, label, className }: StatHighlightProps) {
  const classes = ["tabular font-medium text-fg"];
  if (className !== undefined) classes.push(className);

  const accessibleName = unit === undefined ? `${value} ${label}` : `${value} ${unit} ${label}`;

  return (
    <span className={classes.join(" ")} aria-label={accessibleName}>
      {value}
      {unit === undefined ? null : (
        // The unit is a word, not a figure, so it drops back to prose weight. It
        // needs no face change now: `.tabular` never left Geist Sans.
        <span className="font-normal text-fg-secondary">&nbsp;{unit}</span>
      )}
    </span>
  );
}
