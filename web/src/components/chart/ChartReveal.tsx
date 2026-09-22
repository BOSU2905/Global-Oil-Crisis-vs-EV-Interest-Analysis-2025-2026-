"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ChartRevealProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * The first step of a chart's entrance: the frame itself settles into place.
 *
 * WHY A SEPARATE COMPONENT
 * `ChartFrame` is a server component and must stay one — it renders the title, the
 * description, the long description and the attribution, none of which needs a
 * browser. An `IntersectionObserver` does. Wrapping rather than converting keeps the
 * frame's markup on the server and confines the client boundary to eleven lines of
 * state.
 *
 * THE SEQUENCE, AND WHERE EACH PART LIVES
 *
 *   1. the frame fades and rises        this component, via CSS on `[data-chart-reveal]`
 *   2. the line draws left to right     ECharts, via the entrance duration in the option
 *   3. the legend and controls settle   CSS, staggered off the same attribute
 *   4. everything stops                no step 4 exists; there is nothing to stop
 *
 * Step 4 is the important one. Once the attribute flips the observer disconnects and
 * no further state changes, so the chart is still until the reader touches it. There
 * is no scroll listener, no continuous transform and nothing that re-renders on
 * scroll: KIRO §10's rule is that the data stays still, and the cheapest way to
 * guarantee that is to have no mechanism capable of moving it.
 *
 * REDUCED MOTION NEEDS NO BRANCH HERE. The transition duration comes from
 * `--duration-slow`, which `tokens.css` collapses to 1ms under
 * `prefers-reduced-motion`, and the translate offset comes from `--reveal-offset`,
 * which collapses to 0. The element still ends up visible; it simply arrives without
 * travelling. That is why the attribute is `entered` rather than a class that adds
 * opacity — a missed media query cannot leave content invisible.
 */
export function ChartReveal({ children, className }: ChartRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEntered(true);
          observer.disconnect();
        }
      },
      // Slightly earlier than the canvas's own threshold, so the frame has begun to
      // settle by the time the line starts drawing. That ordering is the whole point
      // of having two triggers rather than one.
      { threshold: 0.08 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const classes: string[] = [];
  if (className !== undefined) classes.push(className);

  return (
    <div
      ref={ref}
      data-chart-reveal={entered ? "entered" : "pending"}
      className={classes.join(" ")}
    >
      {children}
    </div>
  );
}
