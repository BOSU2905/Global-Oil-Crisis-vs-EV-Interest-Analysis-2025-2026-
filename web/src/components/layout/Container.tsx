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
 * This is the only component permitted to set a CONTAINER width, and `page` is the
 * frame the shell and the page body share — see `--width-page` in `tokens.css` for
 * why sharing one frame matters rather than nesting two centred ones.
 *
 * Role measures are a different thing and live on the element that carries the
 * role: `--width-title` on a heading and `--width-reading` on prose, both because
 * they are expressed in `ch` and `ch` resolves against the element's own font size.
 * A container cannot hold a `ch` measure for content it does not share a font with.
 */
export function Container({ width, gutters = true, className, children }: ContainerProps) {
  const classes = ["mx-auto w-full", CONTAINER_MAX_WIDTH[width]];
  if (gutters) classes.push("px-(--page-padding-inline)");
  if (className !== undefined) classes.push(className);

  return <div className={classes.join(" ")}>{children}</div>;
}
