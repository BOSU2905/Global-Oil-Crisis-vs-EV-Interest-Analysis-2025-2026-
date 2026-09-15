import type { NavSection } from "../../content/sections.ts";
import { Container } from "./Container.tsx";
import { Navigation } from "./Navigation.tsx";

interface HeaderProps {
  readonly items: readonly NavSection[];
  /** Observation period, e.g. `2025–2026`. Derived from the panel coverage. */
  readonly period: string;
}

/**
 * Sticky product header: identity, observation period, section navigation.
 *
 * LAYOUT AND WHY THE HEIGHT IS A TOKEN
 * Two rows below `lg` (identity, then the nav rail), one row at `lg` and above.
 * That is the whole responsive behaviour — no drawer, no scroll listener, no
 * JavaScript. The consequence is that the header has two heights, which matters
 * because `Section` offsets its anchor by `--header-height`; the token is
 * therefore declared per breakpoint in `tokens.css` and checked against the
 * rendered box by an E2E test at both widths.
 *
 * "Condenses on scroll" from docs/product-architecture.md §4 is deliberately NOT
 * implemented here. It would make the header height dynamic, which is exactly the
 * value every section anchor depends on; doing it correctly means driving the
 * offset from a measured height rather than a token. That belongs with the
 * responsive/performance pass in step 8, not in the step that establishes the
 * shell.
 *
 * The theme toggle named in the same contract row is also deferred: it needs
 * client state, persistence and an inline script to avoid a wrong-theme flash on
 * first paint. `tokens.css` already implements both themes through
 * `prefers-color-scheme`, so the product is fully themed without it.
 */
export function Header({ items, period }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur-sm">
      <Container
        width="page"
        className="flex flex-col gap-1 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-h4 font-medium tracking-tight text-fg">
            Oil Prices <span className="text-fg-subtle">vs</span> EV Interest
          </span>
          <span className="numeric text-meta text-fg-muted">{period}</span>
        </div>

        <Navigation items={items} />
      </Container>
    </header>
  );
}
