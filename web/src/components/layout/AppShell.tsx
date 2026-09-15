import type { ReactNode } from "react";

import { SHELL_SECTIONS } from "../../content/sections.ts";
import { getArtifacts } from "../../lib/artifacts.ts";
import { Footer } from "./Footer.tsx";
import { Header } from "./Header.tsx";

interface AppShellProps {
  readonly children: ReactNode;
}

/**
 * The application shell: skip link, and the header / main / footer landmarks.
 *
 * WHAT IT OWNS AND WHAT IT DOES NOT
 * Composition and the page-level accessibility contract (§5): exactly three
 * landmarks, a skip link as the first tab stop, and `#main-content` as its
 * target. It owns no copy of its own — the header's identity, the footer's
 * sources and the navigation's links all come from `Header`, `Footer` and the
 * section registry.
 *
 * The single `h1` belongs to the page, not the shell. A shell-owned `h1` would
 * make every future page's heading structure the shell's decision.
 *
 * WHY IT READS THE ARTIFACTS
 * The footer's attribution and the header's period are artifact values
 * (`manifest.sources[]`, `panel.coverage`), so the shell is where they enter the
 * tree. This is a server component: `getArtifacts()` runs during the build, the
 * bundle is validated once, and no artifact JSON or validation code reaches the
 * client.
 *
 * The period is a display string sliced from the coverage dates rather than a
 * literal, so the header cannot claim a window the data does not cover. That is
 * formatting, not computation — no statistic is derived anywhere in this tree.
 */
export function AppShell({ children }: AppShellProps) {
  const { manifest, panel } = getArtifacts();
  const firstYear = panel.coverage.first_week.slice(0, 4);
  const lastYear = panel.coverage.last_week.slice(0, 4);
  const period = firstYear === lastYear ? firstYear : `${firstYear}–${lastYear}`;

  return (
    <>
      {/* Visible only on focus. First tab stop on every page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:border focus:border-border-strong focus:bg-surface focus:px-4 focus:py-2 focus:text-small focus:text-fg"
      >
        Skip to content
      </a>

      <Header items={SHELL_SECTIONS} period={period} />

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <Footer
        sources={manifest.sources}
        pipelineVersion={manifest.pipeline_version}
        contentHash={manifest.content_hash}
      />
    </>
  );
}
