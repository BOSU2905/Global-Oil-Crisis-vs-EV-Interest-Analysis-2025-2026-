"""Phase 2L / 2M: a structured registry of every claim made by the original project.

Why this exists as data rather than as prose in a document: the audit found
load-bearing factual assertions scattered through Python string literals with no
sources. Turning them into records makes three things possible -- the frontend
can refuse to render an uncited claim, a reviewer can audit dispositions in one
place, and adding a source later is a data edit rather than a code edit.

IMPORTANT SCOPE NOTE
--------------------
Several claims concern geopolitical and policy events (regional conflict, fuel
subsidy changes, retail fuel prices, vehicle-ownership statistics, national
energy policy). Verifying those requires news and public-policy sources, which
this pipeline has no mandate to adjudicate and which are outside what the two
committed datasets can support. They are therefore handled under **Option B**
from the brief: the claim is not retained as a factual statement, and it is
recorded here with ``disposition = "requires_citation"`` and an empty
``sources`` list for the project owner to fill in.

Nothing in this file invents a source, and no claim is marked verified.
"""

from __future__ import annotations

from dataclasses import dataclass, field


class Status:
    """How the claim stands relative to the committed data."""

    SUPPORTED = "supported_by_data"
    """The dataset supports the claim as stated."""

    OVERSTATED = "overstated_relative_to_data"
    """Directionally right, but the strength or certainty exceeds the evidence."""

    CONTRADICTED = "contradicted_by_data"
    """The dataset shows something different."""

    INVALID_METHOD = "invalid_method"
    """Computed in a way the data does not permit."""

    UNVERIFIABLE_HERE = "external_unverifiable_from_dataset"
    """A factual assertion about the world that these two series cannot test."""

    BEYOND_DATA_WINDOW = "beyond_data_window"
    """Refers to a period outside the observed range."""

    NOT_IN_REPOSITORY = "describes_work_not_present"
    """Documentation describing methods or files that do not exist."""


class Disposition:
    """What should happen to the claim."""

    RETAIN = "retain"
    REWRITE = "rewrite"
    REMOVE = "remove"
    REQUIRES_CITATION = "requires_citation"


@dataclass(frozen=True, slots=True)
class Claim:
    id: str
    origin: str
    """Where the claim appears in the original project."""
    original_text: str
    """Verbatim, trimmed. Kept so the correction is auditable."""
    status: str
    disposition: str
    reason: str
    evidence: tuple[str, ...] = ()
    """Metric ids / artifact paths that establish the status. Empty for claims
    the dataset cannot speak to."""
    suggested_statement: str | None = None
    """Draft replacement wording, data-grounded. The content layer owns final
    prose; this is a starting point, not published copy."""
    sources: tuple[str, ...] = field(default_factory=tuple)
    """Citations. Deliberately empty where none was recorded -- an empty list is
    the signal that the claim may not be published as fact."""

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "origin": self.origin,
            "original_text": self.original_text,
            "status": self.status,
            "disposition": self.disposition,
            "reason": self.reason,
            "evidence": list(self.evidence),
            "suggested_statement": self.suggested_statement,
            "sources": list(self.sources),
            "publishable_as_fact": self.disposition in {Disposition.RETAIN, Disposition.REWRITE}
            and bool(self.evidence),
        }


# ---------------------------------------------------------------------------
# The registry
# ---------------------------------------------------------------------------

CLAIMS: tuple[Claim, ...] = (
    # --- headline / global claims -------------------------------------------
    Claim(
        id="synchronised_peak_single_month",
        origin="app.py, dataset description",
        original_text=(
            "a synchronized peak in EV interest across 5 different countries in a single month"
        ),
        status=Status.CONTRADICTED,
        disposition=Disposition.REWRITE,
        reason=(
            "Country interest peaks fall in three different calendar months across four "
            "distinct weeks. Two of the five peaks occur before the oil-price regime "
            "onset, so they cannot be attributed to it."
        ),
        evidence=("global.peak_dispersion",),
        suggested_statement=(
            "Interest rose across all five markets over the observed period, but peak "
            "timing was dispersed rather than synchronised."
        ),
    ),
    Claim(
        id="near_perfect_correlation",
        origin="app.py, worldwide insight",
        original_text=(
            "Data confirms a near-perfect correlation between the March 2026 energy "
            "crisis and EV interest."
        ),
        status=Status.OVERSTATED,
        disposition=Disposition.REWRITE,
        reason=(
            "The measured worldwide association is strong but far from near-perfect, and "
            "it weakens substantially when the short high-price episode is excluded."
        ),
        evidence=("series.worldwide.primary", "series.worldwide.sensitivity"),
        suggested_statement=(
            "Worldwide EV search interest and Brent crude prices moved together over the "
            "observed period, with a strong positive correlation that rests heavily on a "
            "four-week high-price episode."
        ),
    ),
    Claim(
        id="peak_week_and_price_attribution",
        origin="app.py, worldwide insight",
        original_text=(
            "Between March 15 - 22, 2026, as oil prices surged to 0.70/litre, EV interests "
            "hit a maximum score of 100."
        ),
        status=Status.CONTRADICTED,
        disposition=Disposition.REWRITE,
        reason=(
            "Worldwide interest reached 100 in the week beginning 2026-03-29, not during "
            "2026-03-15..22, and in that week the weekly mean crude price was below its own peak."
        ),
        evidence=("series.worldwide.profile", "global.oil"),
        suggested_statement=(
            "Worldwide interest reached its maximum in the week beginning 2026-03-29, one "
            "week after the highest weekly crude price in the series."
        ),
    ),
    Claim(
        id="oil_shocks_greatest_driver",
        origin="app.py, worldwide insight",
        original_text=(
            "This 'Panic Search' Phenomenon proves that fuel price shocks are the single "
            "greatest driver for electric vehicle curiosity worldwide."
        ),
        status=Status.OVERSTATED,
        disposition=Disposition.REMOVE,
        reason=(
            "Two correlated time series cannot establish that one variable is the single "
            "greatest driver of another. No competing driver (seasonality, product "
            "launches, news volume, advertising) is measured or controlled for, and the "
            "word 'proves' is not available from observational correlation."
        ),
        evidence=(),
    ),
    Claim(
        id="energy_security_motivation",
        origin="app.py, executive summary",
        original_text=(
            "EV interest is no longer driven by environmental sentiment, but by National "
            "Energy Security."
        ),
        status=Status.UNVERIFIABLE_HERE,
        disposition=Disposition.REMOVE,
        reason=(
            "The dataset contains a search-volume index and a price series. It contains no "
            "variable describing why anyone searched, so it cannot distinguish between "
            "motivations."
        ),
        evidence=(),
    ),
    Claim(
        id="universal_breaking_point_price",
        origin="app.py, executive summary",
        original_text="the global 'Breaking Point' was identified at the $0.65/Litre mark",
        status=Status.OVERSTATED,
        disposition=Disposition.REWRITE,
        reason=(
            "A threshold inferred from a single four-week episode in one 30-week window is "
            "not identified with enough precision to be called a global breaking point. "
            "The value is also a crude benchmark cost per litre, not a pump price."
        ),
        evidence=("global.oil", "global.regime"),
        suggested_statement=(
            "The elevated-price regime in this window begins in the week of 2026-03-01, "
            "when the weekly mean Brent price rose sharply above its prior range."
        ),
    ),
    # --- invalid method ----------------------------------------------------
    Claim(
        id="most_enthusiastic_market",
        origin="notebooks/main.ipynb, KPI print; mean-score bar chart",
        original_text="Pasar paling antusias: Norway (60.7 avg)",
        status=Status.INVALID_METHOD,
        disposition=Disposition.REMOVE,
        reason=(
            "Each Google Trends export is independently rescaled so its own maximum week "
            "equals 100. Mean scores from different exports therefore sit on different "
            "scales and cannot be ranked against each other. No re-weighting of the "
            "committed files can recover a shared scale; that requires a single "
            "multi-region comparison query."
        ),
        evidence=("meta.trends_normalisation",),
    ),
    # --- country-level statistical claims ---------------------------------
    Claim(
        id="malaysia_exceptional_sensitivity",
        origin="app.py, Malaysia oil-vs-EV insight",
        original_text=(
            "Malaysia exhibits an exceptional sensitivity to global energy shifts ... the "
            "search interest for EVs consistently accelerates toward a perfect score of 100."
        ),
        status=Status.CONTRADICTED,
        disposition=Disposition.REWRITE,
        reason=(
            "Malaysia's measured association with crude prices is weak and its confidence "
            "interval includes zero, so it cannot be described as exceptionally sensitive. "
            "Its interest peak also precedes the price-regime onset."
        ),
        evidence=("series.malaysia.primary", "series.malaysia.profile"),
        suggested_statement=(
            "Malaysia shows no association with crude prices that is distinguishable from "
            "zero at this sample size, and its interest peak precedes the price increase."
        ),
    ),
    Claim(
        id="malaysia_future_crisis_foresight",
        origin="app.py, Malaysia oil-vs-EV insight",
        original_text=(
            "As of April 2026, this data confirms that the Malaysian public is proactively "
            "bracing for the projected June 2026 fuel crisis."
        ),
        status=Status.BEYOND_DATA_WINDOW,
        disposition=Disposition.REMOVE,
        reason=(
            "The observation window ends 2026-03-29. The dataset contains no April 2026 "
            "data and cannot speak to a June 2026 event. A projected future event is not a "
            "finding."
        ),
        evidence=("meta.coverage",),
    ),
    Claim(
        id="usa_strong_association",
        origin="app.py, USA insights",
        original_text=(
            "The data shows a vertical climb to a Perfect Score of 100 on Google Trends ... "
            "the market hit a Perfect 100 Score exactly at the $0.65 price point."
        ),
        status=Status.SUPPORTED,
        disposition=Disposition.REWRITE,
        reason=(
            "The strong positive association and the peak of 100 are both in the data. Only "
            "the causal framing ('search for an exit strategy') and the implied precision of "
            "a price point need softening."
        ),
        evidence=("series.us.primary", "series.us.profile"),
        suggested_statement=(
            "United States interest shows the strongest positive association with crude "
            "prices in this dataset and reaches its maximum in the final observed week."
        ),
    ),
    Claim(
        id="norway_decoupled",
        origin="app.py, Norway insights",
        original_text=(
            "The lack of a major correlation between oil prices and EV search trends proves "
            "that Norway has reached a 'Post-Transition' phase."
        ),
        status=Status.OVERSTATED,
        disposition=Disposition.REWRITE,
        reason=(
            "The statistical half is supported: no association distinguishable from zero. "
            "The explanation -- market maturity or a post-transition phase -- is an external "
            "claim about Norwegian vehicle markets that these two series cannot establish, "
            "and 'proves' overstates it regardless."
        ),
        evidence=("series.norway.primary",),
        suggested_statement=(
            "Norwegian interest shows no association with crude prices distinguishable from "
            "zero in this window. Explaining that absence requires evidence beyond these "
            "two series."
        ),
    ),
    Claim(
        id="indonesia_subsidised_shield",
        origin="app.py, Indonesia insights",
        original_text=(
            "as long as the government maintains the 'Subsidized Shield,' the Indonesian "
            "public views Electric Vehicles more as a FOMO-driven trend rather than an "
            "immediate economic necessity."
        ),
        status=Status.OVERSTATED,
        disposition=Disposition.REWRITE,
        reason=(
            "The absence of association is in the data. Attributing it to fuel subsidies, "
            "and characterising public motivation as trend-driven, are external claims the "
            "dataset cannot support."
        ),
        evidence=("series.indonesia.primary",),
        suggested_statement=(
            "Indonesian interest shows no association with crude prices distinguishable "
            "from zero, and the lowest relative rise of the five markets."
        ),
    ),
    Claim(
        id="singapore_association",
        origin="app.py, Singapore insights",
        original_text=(
            "Singaporeans are exceptionally reactive to Middle Eastern geopolitical shocks."
        ),
        status=Status.OVERSTATED,
        disposition=Disposition.REWRITE,
        reason=(
            "A moderate positive association with crude prices is measurable. Attributing it "
            "specifically to geopolitical events in one region is not testable from this "
            "dataset."
        ),
        evidence=("series.singapore.primary",),
        suggested_statement=(
            "Singapore shows a moderate positive association with crude prices, weaker than "
            "the United States and stronger than the remaining markets."
        ),
    ),
    # --- external factual assertions: Option B, citation required ----------
    Claim(
        id="iran_israel_usa_conflict",
        origin="app.py, Indonesia and Singapore insights",
        original_text="The Escalation of the Iran-Israel-USA Conflict",
        status=Status.UNVERIFIABLE_HERE,
        disposition=Disposition.REQUIRES_CITATION,
        reason=(
            "Presented as the cause of a February 2026 interest spike. Neither committed "
            "dataset contains any geopolitical variable, so this pipeline can neither "
            "confirm the event nor attribute the spike to it. No source was recorded."
        ),
        evidence=(),
    ),
    Claim(
        id="malaysia_subsidy_quota_change",
        origin="app.py, Malaysia EV trends insight",
        original_text=(
            "the Malaysian government was forced to slash fuel subsidies, reducing the "
            "monthly quota from 300 litres to 200 litres per consumer"
        ),
        status=Status.UNVERIFIABLE_HERE,
        disposition=Disposition.REQUIRES_CITATION,
        reason="A specific policy fact with no source recorded anywhere in the repository.",
        evidence=(),
    ),
    Claim(
        id="singapore_pump_prices",
        origin="app.py, Singapore EV trends insight",
        original_text="pump prices skyrocketing to a staggering SGD 3.40 - 4.16 per liter",
        status=Status.UNVERIFIABLE_HERE,
        disposition=Disposition.REQUIRES_CITATION,
        reason=(
            "A retail fuel price. The dataset contains only a crude benchmark price; retail "
            "prices are a different quantity and require their own sourced dataset."
        ),
        evidence=(),
    ),
    Claim(
        id="singapore_ev_ownership_share",
        origin="app.py, Singapore oil-vs-EV insight",
        original_text="actual EV ownership remains at approximately 7%",
        status=Status.UNVERIFIABLE_HERE,
        disposition=Disposition.REQUIRES_CITATION,
        reason="A vehicle-registration statistic absent from both datasets. No source recorded.",
        evidence=(),
    ),
    Claim(
        id="singapore_coe_barrier",
        origin="app.py, Singapore oil-vs-EV insight",
        original_text=(
            "high infrastructure costs and the premium price of the Certificate of "
            "Entitlement (COE)"
        ),
        status=Status.UNVERIFIABLE_HERE,
        disposition=Disposition.REQUIRES_CITATION,
        reason=(
            "A market-structure explanation for a gap between interest and adoption. The "
            "dataset measures neither adoption nor cost."
        ),
        evidence=(),
    ),
    Claim(
        id="indonesia_pump_price",
        origin="app.py, Indonesia oil-vs-EV insight",
        original_text="between 0.40 and 0.45 (approx. Rp7.200 raw price)",
        status=Status.UNVERIFIABLE_HERE,
        disposition=Disposition.REQUIRES_CITATION,
        reason=(
            "Equates a crude benchmark cost per litre with an Indonesian retail pump price. "
            "These are different quantities, and the retail figure has no source."
        ),
        evidence=(),
    ),
    Claim(
        id="us_energy_policy_attribution",
        origin="app.py, USA oil-vs-EV insight",
        original_text=(
            "while U.S. geopolitical strategies (under the Trump administration's energy "
            "policies) contributed to the global supply crunch"
        ),
        status=Status.UNVERIFIABLE_HERE,
        disposition=Disposition.REQUIRES_CITATION,
        reason=(
            "Attributes a global supply outcome to a named administration's policy. Not "
            "testable from a price series and a search index, and no source was recorded."
        ),
        evidence=(),
    ),
    Claim(
        id="us_market_rank_and_manufacturers",
        origin="app.py, USA oil-vs-EV insight",
        original_text=(
            "the world's second-largest EV market in 2025 ... homegrown giants like Tesla "
            "and Rivian"
        ),
        status=Status.UNVERIFIABLE_HERE,
        disposition=Disposition.REQUIRES_CITATION,
        reason="Market-size ranking and industry structure; neither is in the dataset.",
        evidence=(),
    ),
    # --- documentation ----------------------------------------------------
    Claim(
        id="readme_describes_other_project",
        origin="README.md",
        original_text=(
            "Dataset mentah dari IEA/EIA/OPEC ... Unit Standardization: barrels of oil "
            "equivalent vs. Gigawatt-hours ... Forecasting: model regresi ... scripts/ "
            "Helper scripts untuk konversi unit"
        ),
        status=Status.NOT_IN_REPOSITORY,
        disposition=Disposition.REMOVE,
        reason=(
            "No IEA/EIA/OPEC data, no energy-unit standardisation, no CAGR calculation, no "
            "forecasting model and no scripts/ directory exist in the repository. Git "
            "history shows the file began as a README for an unrelated project."
        ),
        evidence=(),
    ),
)


def summarise(claims: tuple[Claim, ...] = CLAIMS) -> dict[str, object]:
    by_disposition: dict[str, list[str]] = {}
    by_status: dict[str, list[str]] = {}
    for claim in claims:
        by_disposition.setdefault(claim.disposition, []).append(claim.id)
        by_status.setdefault(claim.status, []).append(claim.id)
    return {
        "total": len(claims),
        "by_disposition": by_disposition,
        "by_status": by_status,
        "requiring_citation": [
            c.id for c in claims if c.disposition == Disposition.REQUIRES_CITATION
        ],
        "unsourced_count": sum(1 for c in claims if not c.sources and not c.evidence),
    }
