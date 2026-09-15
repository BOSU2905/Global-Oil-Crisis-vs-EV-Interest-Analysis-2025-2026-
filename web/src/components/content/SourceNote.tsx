import type { DataSource } from "../../data/index.ts";

interface SourceNoteProps {
  /** `manifest.sources[]`, unaltered. */
  readonly sources: readonly DataSource[];
  /** Heading text. `Sources` in the footer; a chart may want `Source`. */
  readonly heading?: string;
  /**
   * Heading level. The footer's list is named by an `h2`; a source note inside a
   * chart frame sits under a section heading and needs `h3`.
   */
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
}

/**
 * Attribution, read from the manifest.
 *
 * THIS IS AN EXTRACTION, NOT A NEW COMPONENT
 * `Footer` rendered this list from step 3 onwards; step 4 moves it here and leaves
 * `Footer` composing. Nothing about the markup or the data path changed, which is
 * the point — the component boundary was already in the right place.
 *
 * NO HARD-CODED URL, EVER (product-architecture.md §4)
 * Every field comes from `manifest.sources[]`, so the credit list cannot drift
 * from the data the pipeline actually read. A URL typed into this file would be a
 * claim about provenance that nothing verifies.
 *
 * `rel="noreferrer noopener"` on every outbound link, and the series id is
 * `.numeric` because `DCOILBRENTEU` is an identifier a reader may need to copy.
 */
export function SourceNote({
  sources,
  heading = "Sources",
  headingLevel = 2,
  className,
}: SourceNoteProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <div className={className}>
      <Heading className="text-label uppercase text-fg-muted">{heading}</Heading>
      <ul className="mt-3 flex flex-col gap-2">
        {sources.map((source) => (
          <li key={source.id} className="text-meta text-fg-secondary">
            <a
              href={source.url}
              className="rounded-xs underline decoration-border-strong underline-offset-2 transition-colors duration-(--duration-fast) ease-out hover:decoration-fg-muted"
              rel="noreferrer noopener"
              target="_blank"
            >
              {source.publisher} — {source.name}
            </a>
            {source.series_id !== null ? (
              <span className="numeric text-fg-muted"> ({source.series_id})</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
