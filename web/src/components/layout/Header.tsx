import Link from "next/link";

import { Container } from "./Container.tsx";
import { CreatorLink } from "./CreatorLink.tsx";

interface HeaderProps {
  /** Observation period, e.g. `2025–2026`. Derived from the panel coverage. */
  readonly period: string;
}

/**
 * Sticky product header: identity, observation period, and the Creator entry.
 *
 * ONE ROW AT EVERY WIDTH
 * The section rail that used to live here is now the floating indicator the report page
 * renders (`Navigation`), so the header no longer stacks into two rows below `lg`. That
 * made `--header-height` — the anchor offset every `Section` depends on — a single
 * measured value, and an E2E test still compares it with the rendered box at desktop
 * and mobile widths.
 *
 * The identity is a link home, which is the way back from the Creator page. The period
 * is hidden below `sm`: at 375px the identity and the Creator pill need the whole row,
 * and the hero states the same years in its lead.
 *
 * TYPE: THE ROLE DECIDES, NOT THIS COMPONENT. The wordmark carries no weight utility;
 * `--text-h4-weight` is the decision. The period is `.tabular`, a date range a reader
 * reads rather than an identifier a reader copies.
 */
export function Header({ period }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-sm">
      <Container width="page" className="flex items-center justify-between gap-4 py-3">
        <Link href="/" className="group flex min-w-0 items-baseline gap-3 rounded-sm">
          <span className="text-h4 tracking-tight whitespace-nowrap text-fg transition-colors duration-(--duration-fast) ease-out group-hover:text-fg-secondary">
            Oil Prices <span className="text-fg-subtle">vs</span> EV Interest
          </span>
          <span className="tabular hidden text-meta text-fg-muted sm:inline">{period}</span>
        </Link>

        <CreatorLink />
      </Container>
    </header>
  );
}
