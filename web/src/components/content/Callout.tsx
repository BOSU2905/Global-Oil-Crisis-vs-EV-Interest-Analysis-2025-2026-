import type { ReactNode } from "react";

import { Badge } from "./Badge.tsx";
import { CALLOUT_BADGE_TONE, CALLOUT_TONE_CLASS, type CalloutTone } from "./contract.ts";

interface CalloutProps {
  readonly tone?: CalloutTone;
  /** Short word for the badge, e.g. `Guardrail`. Uppercased by CSS. */
  readonly kind: string;
  readonly children: ReactNode;
  /** Optional heading slot, for a callout that owns a `SectionHeader`. */
  readonly header?: ReactNode;
  readonly className?: string;
}

/**
 * A limitation or caveat block on a status surface.
 *
 * WHAT IT REPLACES
 * The inline warning surface that `app/page.tsx` carried on the comparability
 * block since step 1. That block was written with a note saying a half-built
 * `Callout` would be worse than one honest inline treatment; this is the component
 * that note was waiting for, and the markup moves here unchanged in substance.
 *
 * The two callouts the product needs are named in product-architecture.md §4: the
 * Google Trends normalisation constraint, and the first-differencing result. Both
 * are things a reader must not miss, which is why the surface is a status colour
 * *and* a worded badge — never the colour alone (§5).
 *
 * Radius is `--radius-lg`, matching `Card`, and there is no shadow: a callout is
 * emphasis inside the page, not an overlay above it.
 */
export function Callout({ tone = "warning", kind, children, header, className }: CalloutProps) {
  const classes = [
    "rounded-lg border p-(--card-padding) shadow-none",
    CALLOUT_TONE_CLASS[tone],
  ];
  if (className !== undefined) classes.push(className);

  return (
    <div className={classes.join(" ")}>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={CALLOUT_BADGE_TONE[tone]}>{kind}</Badge>
      </div>
      {header === undefined ? null : <div className="mt-3">{header}</div>}
      {children}
    </div>
  );
}
