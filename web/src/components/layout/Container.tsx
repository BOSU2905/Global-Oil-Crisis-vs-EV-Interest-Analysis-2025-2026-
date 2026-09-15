import type { ReactNode } from "react";

import { CONTAINER_MAX_WIDTH, type ContainerWidth } from "./contract.ts";

interface ContainerProps {
  /** Width constraint. See docs/design-system.md §4. */
  readonly width: ContainerWidth;
  /**
   * Apply the page gutter. Default true.
   *
   * Set false when nesting one Container inside another, which would otherwise
   * apply the gutter twice. `--page-padding-inline` halves below 768px inside
   * `tokens.css`, so no breakpoint logic belongs here.
   */
  readonly gutters?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Horizontal width constraint, centred.
 *
 * This is the only component permitted to set a max width. Prose must never
 * exceed the measure (`--width-reading`, 68ch), and giving that width a name
 * makes the rule visible at the call site instead of buried in a class list.
 */
export function Container({ width, gutters = true, className, children }: ContainerProps) {
  const classes = ["mx-auto w-full", CONTAINER_MAX_WIDTH[width]];
  if (gutters) classes.push("px-(--page-padding-inline)");
  if (className !== undefined) classes.push(className);

  return <div className={classes.join(" ")}>{children}</div>;
}
