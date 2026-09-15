"use client";

import { useEffect, useState } from "react";

import type { NavSection } from "../../content/sections.ts";

interface NavigationProps {
  readonly items: readonly NavSection[];
}

/**
 * Section navigation for the long-scroll page.
 *
 * STRUCTURE
 * A `<nav>` landmark with an accessible name, containing an ordered list of
 * ordinary anchors. Anchors, not buttons: the destinations are real ids, so the
 * links are shareable, work without JavaScript, and get browser-native keyboard
 * behaviour instead of a hand-rolled key handler.
 *
 * SCROLLSPY
 * `IntersectionObserver` marks the section currently under the header with
 * `aria-current="true"` — the active state is therefore announced, not just
 * coloured, which §5 requires ("no information conveyed by colour alone"). The
 * observer's top inset is read from `--header-height` rather than hard-coded, so
 * the highlight switches exactly when a section clears the sticky header, at both
 * of the token's breakpoint values.
 *
 * The bottom inset (-55%) means a section becomes active once its top third is on
 * screen, which keeps the highlight from flickering between two sections while
 * scrolling through a boundary.
 *
 * MOBILE, DELIBERATELY UNDER-ENGINEERED
 * The rail scrolls horizontally below `lg`, where the header is two rows. No
 * drawer, no sheet, no focus trap, no JavaScript for layout. §7's drawer applies
 * to the ten-section narrative; with three links a drawer would be more moving
 * parts than content, and a focus trap is a real accessibility liability to get
 * wrong. Revisit when the narrative sections land in steps 6–7.
 */
export function Navigation({ items }: NavigationProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headerHeight =
      getComputedStyle(document.documentElement).getPropertyValue("--header-height").trim() ||
      "0px";

    const observer = new IntersectionObserver(
      (entries) => {
        const onScreen = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = onScreen[0];
        if (first !== undefined) setActiveId(first.target.id);
      },
      { rootMargin: `-${headerHeight} 0px -55% 0px` },
    );

    for (const item of items) {
      const element = document.getElementById(item.id);
      if (element !== null) observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [items]);

  return (
    <nav aria-label="Sections">
      <ul className="-mx-1 flex items-center gap-1 overflow-x-auto lg:mx-0 lg:overflow-visible">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "true" : undefined}
                className={[
                  // 44px minimum tap target, per the accessibility contract.
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3",
                  "text-small transition-colors duration-(--duration-fast) ease-out",
                  isActive
                    ? "text-fg aria-[current]:underline aria-[current]:decoration-accent aria-[current]:decoration-2 aria-[current]:underline-offset-[6px]"
                    : "text-fg-muted hover:text-fg-secondary",
                ].join(" ")}
              >
                {item.navLabel}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
