import type { ElementType, ReactNode } from "react";

interface CardProps {
  /**
   * `div` by default. `li` or `article` where the surrounding markup needs it.
   *
   * `| undefined` is explicit on both optional props because `tsconfig.json` sets
   * `exactOptionalPropertyTypes`. `Card` is the one primitive here designed to be
   * wrapped, so a caller must be able to forward a possibly-undefined prop
   * straight through without inventing a default it does not want.
   */
  readonly as?: ElementType | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/**
 * The one card surface: background, hairline border, `--radius-lg`, and padding
 * from `--card-padding`.
 *
 * `shadow-none` is written explicitly rather than left to the default. It is the
 * single rule this component exists to hold: design-system.md §1 and §4 state that
 * elevation here comes from border plus background delta, and that shadow is
 * reserved for genuinely overlaid surfaces — popovers, dialogs, dropdowns. Cards
 * must not float. Stating it in the class list makes the decision visible at the
 * place someone would otherwise add a shadow, and `globals.css` does not even
 * generate a card-sized shadow utility to reach for.
 *
 * Padding is `p-(--card-padding)` rather than `p-8`, because that token drops to
 * 20px under 768px inside `tokens.css`. One responsive decision, one place.
 */
export function Card({ as: Tag = "div", className, children }: CardProps) {
  const classes = ["rounded-lg border border-border bg-surface p-(--card-padding) shadow-none"];
  if (className !== undefined) classes.push(className);

  return <Tag className={classes.join(" ")}>{children}</Tag>;
}
