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
 * SCROLLSPY — THE ACTIVE SECTION IS COMPUTED FROM GEOMETRY
 * The active section is the last one whose top edge has passed the reading line
 * just below the sticky header. That is read from live layout on every update
 * rather than inferred from the observer's entries, and the distinction is not
 * academic: an `IntersectionObserver` callback only carries the entries that
 * CHANGED. Deciding from those meant that when the active section merely scrolled
 * out of the observed band, the callback contained one non-intersecting entry, no
 * intersecting ones, and nothing was re-evaluated — leaving the previous section
 * highlighted. That produced a genuine ~10% flake in the E2E suite before this was
 * rewritten. Recomputing all three positions costs three `getBoundingClientRect()`
 * calls and is deterministic.
 *
 * TWO TRIGGERS, EACH FOR A REASON
 * `IntersectionObserver` (the mechanism docs/product-architecture.md §4 specifies)
 * fires when a section enters or leaves the region below the reading line, which
 * covers coarse transitions and costs nothing while the page is still. It cannot
 * cover everything: a section already inside that region crossing the line
 * produces no intersection change and therefore no callback. A passive,
 * frame-throttled scroll listener covers exactly that case. Both call the same
 * `sync()`, so there is one decision and two ways of being asked to make it.
 *
 * The reading line is re-read from `--header-height` on every sync, so the
 * highlight stays correct across the `lg` breakpoint where the header changes from
 * one row to two.
 *
 * MOBILE, DELIBERATELY UNDER-ENGINEERED
 * The rail scrolls horizontally, at every width. It used to switch to
 * `overflow-visible` at `lg`, which was correct while there were four sections and
 * wrong at eight: on a 1120px frame the identity block leaves roughly 840px, and eight
 * labels do not fit it. A rail that scrolls cannot overflow the page, and an
 * overflowing header would break the shared left edge the whole layout depends on.
 *
 * Still no drawer, no sheet, no focus trap and no JavaScript for layout. §7's drawer
 * applies to the finished ten-section narrative; a focus trap is a real accessibility
 * liability to get wrong, and a scrolling rail has none of that risk. Revisit when the
 * narrative is complete.
 */
export function Navigation({ items }: NavigationProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const ids = items.map((item) => item.id);

    /** Just below the sticky header: where a reader's eye starts. */
    const readingLine = (): number => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        "--header-height",
      );
      const parsed = Number.parseFloat(raw);
      return (Number.isFinite(parsed) ? parsed : 0) + 1;
    };

    const sync = (): void => {
      const line = readingLine();
      let active: string | null = null;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element === null) continue;
        // Document order, so the last one past the line wins. Before the reader
        // reaches the first section, nothing is current.
        if (element.getBoundingClientRect().top <= line) active = id;
      }
      setActiveId(active);
    };

    let frame = 0;
    const scheduleSync = (): void => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    const observer = new IntersectionObserver(scheduleSync, {
      rootMargin: `-${String(readingLine())}px 0px 0px 0px`,
    });
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element !== null) observer.observe(element);
    }

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync, { passive: true });

    // Deep links land before any scroll or intersection event happens.
    sync();

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
    };
  }, [items]);

  return (
    <nav aria-label="Sections" className="min-w-0">
      <ul className="-mx-1 flex items-center gap-1 overflow-x-auto lg:mx-0">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
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
