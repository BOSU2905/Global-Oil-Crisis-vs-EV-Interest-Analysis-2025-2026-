"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The Creator entry in the header.
 *
 * A client component for one reason: the header is rendered by the root layout, which
 * cannot know the route, and the pill must say `aria-current="page"` on the Creator page
 * so its state is announced rather than only drawn. `usePathname()` is the one hook that
 * answers that.
 *
 * A quiet outlined pill: it names its destination in words and with a person glyph, it
 * is an ordinary link — keyboard-reachable, announced as a link, pointer cursor — and it
 * never competes with the analysis for attention.
 */
export function CreatorLink() {
  const current = usePathname() === "/creator";

  return (
    <Link
      href="/creator"
      aria-current={current ? "page" : undefined}
      className={[
        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-small",
        "transition-[color,background-color,border-color] duration-(--duration-fast) ease-out",
        current
          ? "border-border-strong bg-surface-raised text-fg"
          : "border-border text-fg-secondary hover:border-border-interactive hover:bg-surface hover:text-fg",
      ].join(" ")}
    >
      {/* Head and shoulders. Decorative — the word carries the meaning. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <circle cx="8" cy="5.5" r="2.6" />
        <path d="M2.8 13.6c.9-2.5 2.9-3.8 5.2-3.8s4.3 1.3 5.2 3.8" />
      </svg>
      Creator
    </Link>
  );
}
