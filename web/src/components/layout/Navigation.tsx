"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";

import type { NavSection } from "../../content/sections.ts";
import { sectionOrdinal } from "./contract.ts";

interface NavigationProps {
  readonly items: readonly NavSection[];
}

/**
 * Section navigation, as a floating indicator rather than a header rail.
 *
 * WHY IT LEFT THE HEADER
 * Eight labels in a sticky header crowded the identity and scrolled sideways on every
 * screen narrower than ~1500px. The page is read top to bottom, so what a reader needs
 * most of the time is WHERE they are, and only occasionally a way to jump. The indicator
 * shows the first permanently and the second on request:
 *
 *   default   one dot per section on the right edge (bottom-right below `xl`). The
 *             current section's dot is ELONGATED — a shape cue, so the state is not
 *             carried by colour alone — and its name is the toggle's description
 *   click     a compact menu with the section names; the current one is marked with
 *             `aria-current`, weight and a bar. Choosing one scrolls there (smoothly,
 *             except under reduced motion) and closes the menu
 *   dismiss   outside pointer-down, Escape (focus returns to the toggle), or Tab past
 *             the last entry
 *
 * It is `position: fixed`, so it takes no content width. From `xl` it sits in the frame
 * margin, which `tokens.css` sizes so it never meets the content edge.
 *
 * THE SCROLLSPY IS THE ONE THAT ALREADY WORKED, UNCHANGED
 * The active section is the last one whose top has passed the reading line under the
 * sticky header, read from live geometry on every update — not from an
 * `IntersectionObserver`'s entries, which only carry what CHANGED and once left the
 * previous section highlighted (a ~10% E2E flake before it was rewritten). The observer
 * and a passive, frame-throttled scroll listener are only triggers for one `sync()`.
 *
 * THE MENU STAYS MOUNTED, AND IS `inert` + `visibility: hidden` WHEN CLOSED
 * Unlike `ReadMore`, whose panel holds prose that find-in-page must not reach, this
 * panel holds eight links that also exist as headings. Keeping it mounted lets it fade
 * and scale out instead of vanishing; `inert` and `visibility: hidden` take it out of
 * the tab order and the accessibility tree exactly as unmounting would.
 */
export function Navigation({ items }: NavigationProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const currentId = `${menuId}-current`;

  // --- scrollspy -------------------------------------------------------------
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

  // --- dismissal: outside pointer-down and Escape, only while open ----------
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      const root = rootRef.current;
      if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // --- on open, focus the current entry (or the first) ----------------------
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const target =
      root?.querySelector<HTMLAnchorElement>('a[aria-current="true"]') ??
      root?.querySelector<HTMLAnchorElement>("a");
    target?.focus();
  }, [open]);

  /** Focus leaving the whole indicator — Tab past the last entry — closes it. */
  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && rootRef.current?.contains(next)) return;
    if (next !== null) setOpen(false);
  };

  /** ↑/↓/Home/End move between entries, the menu-button convention. */
  const onMenuKeyDown = (event: KeyboardEvent<HTMLOListElement>): void => {
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>("a")];
    const index = links.findIndex((link) => link === document.activeElement);
    let next = index;
    if (event.key === "ArrowDown") next = (index + 1) % links.length;
    else if (event.key === "ArrowUp") next = (index - 1 + links.length) % links.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = links.length - 1;
    else return;
    event.preventDefault();
    links[next]?.focus();
  };

  const activeIndex = items.findIndex((item) => item.id === activeId);
  const activeLabel = activeIndex === -1 ? null : (items[activeIndex]?.navLabel ?? null);

  return (
    <nav
      ref={rootRef}
      aria-label="Sections"
      data-state={open ? "open" : "closed"}
      data-active-section={activeId ?? ""}
      onBlur={onBlur}
      className="fixed right-4 bottom-4 z-30 xl:top-1/2 xl:right-5 xl:bottom-auto xl:-translate-y-1/2"
    >
      <button
        ref={toggleRef}
        type="button"
        aria-label="Jump to section"
        aria-expanded={open}
        aria-controls={menuId}
        aria-describedby={currentId}
        onClick={() => setOpen((value) => !value)}
        className={[
          "group flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-3 rounded-full",
          "border border-border bg-surface/90 px-4 shadow-overlay backdrop-blur-sm",
          "transition-[background-color,border-color] duration-(--duration-medium) ease-out",
          "hover:border-border-interactive",
          "xl:flex-col xl:gap-0 xl:border-transparent xl:bg-transparent xl:px-3 xl:py-3",
          "xl:shadow-none xl:backdrop-blur-none xl:hover:border-border xl:hover:bg-surface",
          open ? "xl:border-border xl:bg-surface" : "",
        ].join(" ")}
      >
        <span id={currentId} className="sr-only">
          {activeLabel === null ? "Not yet in a section" : `Current section: ${activeLabel}`}
        </span>
        <span aria-hidden="true" className="flex items-center gap-1.5 xl:flex-col">
          {items.map((item, index) => (
            <span
              key={item.id}
              data-active={index === activeIndex ? "true" : "false"}
              className={[
                "block rounded-full transition-[width,height,background-color] duration-(--duration-medium) ease-out",
                index === activeIndex
                  ? "h-1.5 w-4 bg-fg xl:h-4 xl:w-1.5"
                  : "h-1.5 w-1.5 bg-fg-subtle group-hover:bg-fg-muted",
              ].join(" ")}
            />
          ))}
        </span>
      </button>

      <div
        id={menuId}
        inert={!open}
        className={[
          "absolute right-0 bottom-full mb-3 w-60 origin-bottom-right",
          "xl:top-1/2 xl:right-full xl:bottom-auto xl:mr-3 xl:mb-0 xl:-translate-y-1/2 xl:origin-right",
          "rounded-lg border border-border bg-surface p-2 shadow-overlay",
          // Visibility is in the transition only while CLOSING, so the panel stays
          // visible while it fades out. Opening flips it instantly: a `visibility`
          // transition starts at `hidden`, and focusing an entry in a hidden panel fails
          // — measured, the first draft left focus on the toggle.
          open
            ? "visible scale-100 opacity-100 transition-[opacity,scale] duration-(--duration-medium) ease-out"
            : "invisible scale-95 opacity-0 transition-[opacity,scale,visibility] duration-(--duration-medium) ease-out",
        ].join(" ")}
      >
        {/* Decorative: the landmark is already named "Sections". A div, not a `p`, so
            nothing that looks for the page's eyebrows can find a hidden one here. */}
        <div aria-hidden="true" className="px-3 pt-2 pb-1 text-label uppercase text-fg-muted">
          On This Page
        </div>
        <ol onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => {
            const isActive = item.id === activeId;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className={[
                    // 44px minimum tap target, per the accessibility contract.
                    "flex min-h-11 origin-left items-center gap-3 rounded-md px-3 text-small",
                    "transition-[color,background-color,scale] duration-(--duration-medium) ease-out",
                    "hover:scale-[1.05] hover:bg-surface-raised motion-reduce:hover:scale-100",
                    isActive ? "text-fg" : "text-fg-muted hover:text-fg",
                  ].join(" ")}
                >
                  <span aria-hidden="true" className="tabular w-5 text-meta text-fg-subtle">
                    {sectionOrdinal(index + 1)}
                  </span>
                  <span className={isActive ? "font-medium" : ""}>{item.navLabel}</span>
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="ml-auto h-4 w-0.5 rounded-full bg-accent"
                    />
                  ) : null}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
