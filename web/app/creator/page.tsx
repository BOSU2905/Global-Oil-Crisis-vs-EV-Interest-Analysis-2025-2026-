import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "../../src/components/layout/Container.tsx";
import { SectionHeader } from "../../src/components/layout/SectionHeader.tsx";

export const metadata: Metadata = {
  title: "Creator — Global Oil Crisis vs EV Interest Analysis",
  description: "Who built this analysis, and how.",
};

/**
 * The Creator page — deliberately minimal.
 *
 * WHAT IS HERE, AND WHERE EACH LINE COMES FROM
 * The name and affiliation are the README's author line, verbatim. The second paragraph
 * describes what the repository demonstrably contains. Nothing else is claimed: no
 * biography, no links the owner has not published, no portrait. KIRO.md records that
 * the page's final design and copy are the owner's to write; this version exists so the
 * header's Creator entry leads somewhere real rather than nowhere.
 */
export default function CreatorPage() {
  return (
    <Container width="page" className="pb-(--section-spacing)">
      <div className="pt-(--section-spacing)">
        <SectionHeader
          sectionId="creator"
          headingLevel={1}
          eyebrow="Creator"
          title="Benedictus Alfred Djaja"
          lead="Data Science undergraduate, Bina Nusantara University."
        />

        <div className="mt-(--section-header-gap) flex max-w-reading flex-col gap-4 text-body text-fg-secondary">
          <p>
            This report is an independent analytical project: a zero-dependency Python pipeline
            that turns two public datasets into validated JSON artifacts, a written record of
            what the data does and does not support, and this interactive frontend, which
            renders those artifacts without computing a statistic of its own.
          </p>
        </div>

        <p className="mt-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-small text-fg-secondary transition-[color,background-color,border-color] duration-(--duration-fast) ease-out hover:border-border-interactive hover:bg-surface hover:text-fg"
          >
            <span aria-hidden="true">←</span> Back to the report
          </Link>
        </p>
      </div>
    </Container>
  );
}
