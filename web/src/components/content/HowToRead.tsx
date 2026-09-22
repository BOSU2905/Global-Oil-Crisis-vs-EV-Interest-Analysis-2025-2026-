"use client";

import { useState, type KeyboardEvent } from "react";

import { HOW_TO_READ_MARKER, type HowToReadEntry } from "../../content/how-to-read.ts";
import { readMorePanelId, readMoreToggleId } from "./contract.ts";
import { Badge } from "./Badge.tsx";

interface HowToReadProps {
  readonly entries: readonly HowToReadEntry[];
  readonly className?: string;
}

/**
 * The reading guide: a list of questions, each opening to a short answer.
 *
 * WHY NOT `ReadMore`
 * `ReadMore`'s contract (`docs/product-architecture.md` §6) is one always-visible
 * summary plus supporting detail behind a "Read more" toggle. That is the right shape
 * for a caveat attached to a statistic and the wrong one here: the QUESTION is the
 * label, so there is no separate summary to show, and seven "Read more" links in a
 * column would tell a reader nothing about what each opens.
 *
 * What is shared is the id derivation. `readMorePanelId` and `readMoreToggleId` come
 * from the content contract, so the toggle's `aria-controls` and the panel's `id` cannot
 * drift apart — the same guarantee `ReadMore` has, from the same two functions.
 *
 * MORE THAN ONE MAY BE OPEN
 * It is not an accordion. A reader comparing the normalisation answer with the causation
 * answer should not have to close one to read the other, and auto-closing is the
 * behaviour that makes disclosure lists frustrating.
 *
 * THE PANEL IS UNMOUNTED WHEN CLOSED
 * Same reason as `ReadMore` and the chart tables: a hidden-but-present panel is still
 * reached by find-in-page and still read in browse mode, so "collapsed" would be a lie.
 *
 * DRAFT COPY IS MARKED ON SCREEN
 * An entry whose `status` is `"draft"` carries a visible badge. A reader is entitled to
 * know which parts of a report are settled, and a report that quietly mixes finished
 * analysis with stand-in prose is worse than one that says which is which.
 */
export function HowToRead({ entries, className }: HowToReadProps) {
  const [open, setOpen] = useState<readonly string[]>([]);

  const toggle = (id: string) => {
    setOpen((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  // Escape closes the entry the focus is inside, and returns focus to its toggle.
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (event.key !== "Escape" || !open.includes(id)) return;
    event.stopPropagation();
    toggle(id);
    document.getElementById(readMoreToggleId(id))?.focus();
  };

  const classes = ["flex list-none flex-col divide-y divide-border border-y border-border"];
  if (className !== undefined) classes.push(className);

  return (
    <ul className={classes.join(" ")}>
      {entries.map((entry) => {
        const isOpen = open.includes(entry.id);
        const panelId = readMorePanelId(entry.id);
        const toggleId = readMoreToggleId(entry.id);

        return (
          <li key={entry.id} id={entry.id} onKeyDown={(event) => onKeyDown(event, entry.id)}>
            <button
              type="button"
              id={toggleId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(entry.id)}
              // Full-width so the whole row is the target, and 44px tall per the
              // accessibility contract.
              className="flex min-h-11 w-full items-center gap-3 py-3 text-left text-small text-fg transition-colors duration-(--duration-fast) ease-out hover:text-fg-secondary"
            >
              {/* Rotation supplements the state; `aria-expanded` carries it for
                  assistive technology and the panel's presence carries it visually. */}
              <span
                aria-hidden="true"
                className={`shrink-0 text-fg-muted transition-transform duration-(--duration-fast) ease-out ${
                  isOpen ? "rotate-90" : "rotate-0"
                }`}
              >
                ›
              </span>
              <span className="flex-1">{entry.question}</span>
              {entry.status === "draft" ? (
                <Badge tone="info" className="shrink-0">
                  {HOW_TO_READ_MARKER}
                </Badge>
              ) : null}
            </button>

            {isOpen ? (
              <div
                id={panelId}
                role="region"
                aria-labelledby={toggleId}
                className="flex flex-col gap-3 pb-4 pl-6 text-small text-fg-secondary"
              >
                {entry.answer.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className="max-w-reading">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
