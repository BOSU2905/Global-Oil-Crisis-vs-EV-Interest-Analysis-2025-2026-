import type { ChartAccessibilityContract } from "../../styles/chart-language.ts";
import type { ChartTableRow } from "./contract.ts";

interface ChartTableFallbackProps {
  readonly rows: readonly ChartTableRow[];
  /** Column headers come from the chart's accessibility contract, not from here. */
  readonly a11y: ChartAccessibilityContract;
  /** Matches the `aria-controls` on the toggle in `ChartControls`. */
  readonly id: string;
  readonly className?: string;
}

/**
 * The tabular twin of a chart. First-class, not a courtesy.
 *
 * WHY A TABLE AT ALL
 * A canvas is a single opaque image to assistive technology — there is nothing
 * inside it to read, focus or announce. `docs/product-architecture.md` §5 rule 4 is
 * therefore blunt about it: the table *is* the accessible representation of a chart,
 * and every chart has one. The long description in `ChartFrame` states the finding;
 * this states the values.
 *
 * IT IS UNMOUNTED WHEN CLOSED, NOT `display:none`
 * §4 says the fallback must never be `display:none`-only, and the reason is the same
 * one `ReadMore` was built around: a hidden-but-present table is still reached by
 * find-in-page and still read by a screen reader in browse mode, so "collapsed"
 * would be a lie — and 31 rows of hidden text sitting under every chart is a
 * genuinely worse experience than a table that is not there yet. The parent mounts
 * this only when open, and the toggle carries `aria-expanded` so the state is
 * announced.
 *
 * WHY IT IS NOT OPEN BY DEFAULT
 * Because 31 rows below a chart is the "huge table dumped into the layout" outcome.
 * The control is visible, labelled and keyboard-reachable, which is what the
 * contract requires — reachability, not permanence.
 *
 * SCROLL CONTAINER, NOT A SHRUNKEN TABLE
 * `overflow-x-auto` with `tabIndex={0}` on the wrapper: a scrollable region has to
 * be focusable or a keyboard user cannot scroll it. At 375px four columns do not fit
 * and the honest answer is a scroll, not a font size nobody can read.
 */
export function ChartTableFallback({ rows, a11y, id, className }: ChartTableFallbackProps) {
  const classes = ["overflow-x-auto rounded-lg border border-border"];
  if (className !== undefined) classes.push(className);

  return (
    <div
      id={id}
      className={classes.join(" ")}
      // A focusable scroll region, so the table is reachable without a pointer.
      tabIndex={0}
      role="group"
      aria-labelledby={`${id}-caption`}
    >
      <table className="w-full border-collapse text-left">
        <caption
          id={`${id}-caption`}
          className="border-b border-border bg-surface-raised px-4 py-3 text-left text-meta text-fg-secondary"
        >
          {a11y.title}. {rows.length} weekly observations. {a11y.source}.
        </caption>
        <thead>
          <tr>
            {a11y.tableColumns.map((column) => (
              <th
                key={column}
                scope="col"
                className="border-b border-border px-4 py-2 text-label uppercase whitespace-nowrap text-fg-muted"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.week} className="border-b border-border last:border-b-0">
              {/* The week is the row's identity, so it is a header cell. A screen
                  reader then announces "31 Aug 2025, 66.85" instead of a bare pair
                  of numbers. */}
              <th
                scope="row"
                className="tabular px-4 py-2 text-meta font-normal whitespace-nowrap text-fg-secondary"
              >
                {row.week}
              </th>
              <td className="tabular px-4 py-2 text-meta whitespace-nowrap text-fg">
                {row.oil}
              </td>
              <td className="tabular px-4 py-2 text-meta whitespace-nowrap text-fg">
                {row.interest}
              </td>
              <td className="px-4 py-2 text-meta whitespace-nowrap text-fg-muted">
                {row.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
