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
 * A statistic inline in prose: mono, tabular figures, slightly stronger than the
 * surrounding text.
 *
 * WHY NOT JUST A SPAN WITH `.numeric`
 * Because of the `aria-label`. An inline figure is the one place a number appears
 * without a visible label beside it, so the label has to travel with it. The
 * visible text stays exactly the value; the accessible name adds what it measures.
 *
 * Emphasis is weight and colour against `--color-fg-secondary` body text, not a
 * larger size: a figure that grows mid-sentence breaks the line rhythm. Note that
 * `--weight-medium` is not a distinct face on every platform (design-system.md
 * §3), which is why `text-fg` does the visual work and the weight only reinforces
 * it.
 */
export function StatHighlight({ value, unit, label, className }: StatHighlightProps) {
  const classes = ["numeric font-medium text-fg"];
  if (className !== undefined) classes.push(className);

  const accessibleName = unit === undefined ? `${value} ${label}` : `${value} ${unit} ${label}`;

  return (
    <span className={classes.join(" ")} aria-label={accessibleName}>
      {value}
      {unit === undefined ? null : (
        // The unit is a word, so it takes the prose face rather than the numeric
        // one. Only the figure needs tabular alignment.
        <span className="font-sans font-normal text-fg-secondary">&nbsp;{unit}</span>
      )}
    </span>
  );
}
