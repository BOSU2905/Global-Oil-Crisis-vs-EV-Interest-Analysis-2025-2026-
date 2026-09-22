/**
 * "How to Read This Analysis" — the reading guide, as content.
 *
 * WHAT THIS REPLACES
 * A `ReadMore` labelled "What that means for the charts", which was a control attached
 * to one data caveat and carried a name that promised a reading guide. The guide now
 * exists as its own structure, and the caveat's disclosure is labelled for what it
 * actually explains.
 *
 * WHY IT IS A DISCLOSURE LIST AND NOT A METHODOLOGY PAGE
 * Because every question below is one a reader asks WHILE looking at a chart, and a
 * separate page is somewhere they will not be. Seven questions, each answerable in a
 * paragraph, each collapsed until asked — and the questions themselves are visible, so
 * the list reads as an index of what might be confusing rather than as a wall.
 *
 * THE HARD RULE THIS FILE MUST RESPECT
 * `docs/product-architecture.md` §6: no critical analytical conclusion may live only
 * inside a disclosure. Five things must be visible without interaction — that no series
 * survives first differencing, that cross-market interest levels are not comparable,
 * that the "synchronised peak" claim is unsupported, that three of five markets show no
 * detectable association, and any claim with `publishable_as_fact: false`. Every one of
 * those is stated in the open, in the section lead and beside the charts. What is behind
 * these toggles is the EXPLANATION of each, which is exactly what a disclosure is for.
 *
 * WHICH WORDING IS FINAL AND WHICH IS NOT
 * Each entry declares a `status`. `"final"` means the answer is factual and read from,
 * or directly about, the artifacts. `"draft"` means the human owner will write the
 * finished editorial wording, and the component renders a visible marker so a reader is
 * never misled about which parts of the report are settled. Marking it in the data
 * rather than in a comment is what makes it assertable.
 */

/** Whether an answer is finished prose or standing in for it. */
export type CopyStatus = "final" | "draft";

export interface HowToReadEntry {
  /** Stable id: the toggle and its panel derive their ids from it, and it deep-links. */
  readonly id: string;
  /** The question, as the reader would ask it. Sentence case — it is a control label. */
  readonly question: string;
  /** One or more paragraphs. Kept short on purpose. */
  readonly answer: readonly string[];
  readonly status: CopyStatus;
}

export const HOW_TO_READ_MARKER = "Awaiting final wording";

/**
 * The seven questions.
 *
 * Their order is the order a reader hits the problems: what is being asked, what the
 * data is, how to read a chart, why the five lines cannot be compared by height, why
 * co-movement is not cause, why the specification comparison is the finding rather than
 * a footnote, and why five markets can differ.
 */
export const HOW_TO_READ_ENTRIES: readonly HowToReadEntry[] = [
  {
    id: "how-to-read-question",
    question: "What question is this analysis asking?",
    answer: [
      "Whether EV search interest moved alongside the 2026 Brent crude price shock, and " +
        "whether that pattern differed across five markets. It is a question about " +
        "co-movement and timing, not about cause.",
      "The analysis does not ask whether oil prices increase EV demand, because a weekly " +
        "price series and a relative search index cannot answer that.",
    ],
    status: "final",
  },
  {
    id: "how-to-read-data",
    question: "What data is this built from?",
    answer: [
      "Two sources. Brent crude daily spot prices from FRED, series DCOILBRENTEU, " +
        "resampled to weekly averages; and Google Trends weekly relative search interest " +
        "for electric cars, exported once per market plus a worldwide series.",
      "The crude figure is a benchmark cost per barrel, converted where shown to a cost " +
        "per litre of crude. It is not a retail pump price and must not be read as one.",
      "Every number in this report is produced by a Python pipeline and read from " +
        "generated files. The web layer computes no statistic of its own.",
    ],
    status: "final",
  },
  {
    id: "how-to-read-charts",
    question: "How should the charts be read?",
    answer: [
      "Each chart names its own units on its axes, in its legend and again in its " +
        "tooltip, because the two measures here are on unrelated scales and a dual-axis " +
        "chart can imply a relationship that is only an artefact of the scales chosen.",
      "A dashed segment marks a week that rests on fewer than five trading days. Where " +
        "the crude series has no observation, the line stops rather than being " +
        "interpolated across the gap — joining it would draw a value the data does not " +
        "contain.",
      "Every chart has a data table behind a visible control. The table is the accessible " +
        "representation, not a courtesy: it carries the same values the chart draws, with " +
        "provisional and missing observations marked in words.",
    ],
    status: "final",
  },
  {
    id: "how-to-read-normalisation",
    question: "Why can't the five country lines be compared by height?",
    answer: [
      "Because each country's Google Trends series is a separate query, rescaled so that " +
        "its own highest week equals 100. Every market therefore contains a 100, and the " +
        "scales have no common unit.",
      "A line at 90 in one market does not represent more real-world searching than a " +
        "line at 70 in another. What is comparable is the shape of each series and the " +
        "timing of its turns — which is what the cross-market chart is for.",
      "Putting all five markets on one shared scale would need a single Google Trends " +
        "multi-region comparison query. That is a new export and cannot be recovered from " +
        "the files this analysis uses.",
    ],
    status: "final",
  },
  {
    id: "how-to-read-causation",
    question: "Why isn't co-movement evidence of cause?",
    answer: [
      "Two series that both drift upward over the same months will correlate whether or " +
        "not they are related. Nothing in this design rules out a third factor moving " +
        "both, and nothing establishes the direction of any relationship.",
      "There is also no counterfactual: the analysis observes one period, in which prices " +
        "rose and interest rose. That is consistent with a relationship and equally " +
        "consistent with coincidence.",
      "So the language throughout is deliberate. Series are described as moving together, " +
        "as associated, or as showing no detectable association. None is described as " +
        "driving, causing or triggering another.",
    ],
    status: "final",
  },
  {
    id: "how-to-read-robustness",
    question: "Why does the specification comparison matter so much?",
    answer: [
      "Because it is the result that changes the conclusion. The level correlations look " +
        "strong in several markets, and none of the six series survives first " +
        "differencing as a positive relationship — that is, once week-to-week changes are " +
        "compared instead of levels, the apparent co-movement is gone.",
      "Both variables trend upward across the window, which alone can produce a level " +
        "correlation. A report that showed only the level figures would be reporting that " +
        "shared trend as a finding.",
      "This is why the comparison is a section of its own rather than a methodology " +
        "footnote, and why no coefficient appears anywhere without it.",
    ],
    status: "final",
  },
  {
    id: "how-to-read-divergence",
    question: "Why do the five markets show different patterns?",
    answer: [
      "The measured answer is that they do: the peaks are spread across three calendar " +
        "months, and the classifications range from no detectable association to " +
        "level-only association. No market reaches a robust positive association.",
      "Why they differ is a question this data cannot settle. Subsidy regimes, adoption " +
        "maturity, vehicle taxation and local news coverage are all plausible and all " +
        "external to the dataset — which is why the report's editorial groupings are " +
        "labelled as requiring outside evidence rather than presented as findings.",
    ],
    status: "draft",
  },
];
