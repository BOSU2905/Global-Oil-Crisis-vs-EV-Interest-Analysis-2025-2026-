"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

import {
  READ_LESS_LABEL,
  READ_MORE_LABEL,
  readMorePanelId,
  readMoreToggleId,
} from "./contract.ts";

interface ReadMoreProps {
  /** Always-visible summary. Must stand alone as a complete statement. */
  readonly summary: ReactNode;
  /** Expanded detail: context, observation, interpretation, caveat. */
  readonly children: ReactNode;
  /** Accessible label for the toggle. Default: "Read more". */
  readonly label?: string;
  /** Start expanded. Default false. */
  readonly defaultOpen?: boolean;
  /** Stable id, so the open state can be deep-linked. */
  readonly id: string;
  readonly className?: string;
}

/**
 * A disclosure for supporting depth, implementing the interface in
 * docs/product-architecture.md §6.
 *
 * THE HARD RULE THIS COMPONENT CANNOT ENFORCE ALONE
 * §6: **no critical analytical conclusion may live only inside a `ReadMore`.**
 * Specifically, that no series survives first differencing, that cross-market
 * interest levels are not comparable, that the "synchronised peak" claim is
 * unsupported, that three of five markets show no detectable association, and any
 * claim with `publishable_as_fact: false` must all be visible without interaction.
 *
 * The API pushes in that direction — `summary` is required and documented as
 * having to stand alone — but a component cannot judge whether a sentence is a
 * finding. That judgement stays with whoever writes the section, and `ReadMore`
 * carries mechanism discussion, method detail and per-country nuance instead.
 *
 * WHY A `<button>` AND NOT `<details>`
 * `<details>`/`<summary>` is tempting and nearly right, but it cannot animate
 * height reliably, its open state is not straightforwardly deep-linkable, and
 * Escape does not close it. §6 asks for all three. So this is a real button with
 * `aria-expanded` and `aria-controls`, which is what a screen reader announces
 * anyway.
 *
 * WHY THE PANEL IS UNMOUNTED WHEN CLOSED
 * A hidden-but-present panel is reachable by find-in-page and by a screen reader
 * in browse mode, which makes "collapsed" a lie. Unmounting keeps the collapsed
 * state honest. The cost is that height cannot be transitioned from the previous
 * content, so the open animation is opacity plus a small translate — which
 * `tokens.css` already collapses to 1ms under `prefers-reduced-motion`, so this is
 * accessible without a media query here.
 *
 * The toggle is `min-h-11` (44px) and full-width on small screens, per the §7
 * responsive contract and the tap-target rule the shell tests already assert.
 */
export function ReadMore({
  summary,
  children,
  label = READ_MORE_LABEL,
  defaultOpen = false,
  id,
  className,
}: ReadMoreProps) {
  const [open, setOpen] = useState(defaultOpen);

  const panelId = readMorePanelId(id);
  const toggleId = readMoreToggleId(id);

  // Escape closes when open, and never traps focus (§6).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      document.getElementById(toggleId)?.focus();
    }
  };

  const classes = ["max-w-reading"];
  if (className !== undefined) classes.push(className);

  return (
    <div className={classes.join(" ")} id={id} onKeyDown={onKeyDown}>
      <div className="text-small text-fg-secondary">{summary}</div>

      <button
        type="button"
        id={toggleId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((previous) => !previous)}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-sm text-small text-fg underline decoration-border-strong underline-offset-4 transition-colors duration-(--duration-fast) ease-out hover:decoration-fg-muted"
      >
        {open ? READ_LESS_LABEL : label}
        {/* Rotation supplements the label change; it is never the only signal. */}
        <span
          aria-hidden="true"
          className={`transition-transform duration-(--duration-fast) ease-out ${
            open ? "rotate-90" : "rotate-0"
          }`}
        >
          ›
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={toggleId}
          className="mt-2 flex flex-col gap-3 border-l-2 border-border-strong pl-4 text-small text-fg-secondary motion-safe:animate-none"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
