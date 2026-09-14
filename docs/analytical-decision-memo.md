# Analytical Decision Memo

**Editorial source of truth for Phase 3.** Every number here comes from the final
generated artifacts (`web/src/data/generated/metrics.json`), not from memory or
the original audit. Gate results and the full metric tables are in
[`phase-2-validation.md`](phase-2-validation.md).

If the copy on the site disagrees with this document, this document is right.

---

## 1. What does the data actually support?

**Descriptive** — what is in the data, no inference:

- Brent crude rose from a $60–72 band to $85–111 over the final four weeks of the
  window, peaking at **$111.40/barrel** in the week of **2026-03-15** (+66.6% from
  the first week).
- EV search interest rose in all five markets. Baseline→peak change: Indonesia
  +300.0%, United States +138.3%, Singapore +92.6%, Malaysia +92.3%, Norway
  +69.3%.
- The five interest peaks fall in **four distinct weeks across three calendar
  months**: Norway 2026-01-25, Indonesia and Malaysia 2026-02-15, Singapore
  2026-03-08, United States 2026-03-29.
- Only the United States peaked *after* the oil peak (+2 weeks). Singapore was
  −1 week, Indonesia and Malaysia −4, Norway −7.
- Moving from the baseline to the elevated regime, mean interest rose in four
  markets (US +60.1%, Singapore +44.1%, Malaysia +11.2%, Norway +9.0%) and **fell
  in Indonesia (−31.2%)**.

**Inferential** — what the correlations and intervals say:

- Worldwide: **r = 0.727**, p = 0.000005, ρ = 0.721, 95% CI [0.545, 0.887], n = 30.
- United States: **r = 0.747**, p = 0.000002, ρ = 0.527, CI [0.507, 0.865].
- Singapore: **r = 0.580**, p = 0.00079, ρ = 0.510, CI [0.284, 0.756].
- Malaysia: r = 0.220, p = 0.242, CI [−0.001, 0.471] — includes zero.
- Norway: r = 0.146, p = 0.441, CI [−0.156, 0.443] — includes zero.
- Indonesia: r = −0.019, p = 0.920, CI [−0.181, 0.270] — includes zero.

So three of six series show a positive association in weekly levels that is
distinguishable from zero; three do not.

**Interpretive** — what may reasonably be said:

> Over these seven months, crude prices and EV search interest moved together in
> the United States, Singapore and worldwide, and did not in Indonesia, Malaysia
> or Norway. The strength of that co-movement is not uniform, and the markets
> where it is absent are as informative as the markets where it is present.

That is the ceiling. Nothing here supports a causal statement, and §2 explains why
even the co-movement finding needs a qualifier attached every time it is stated.

---

## 2. What does it NOT support?

**The single most important limitation: no short-run relationship exists.**

Both variables trend upward across the window (oil vs time r = 0.612; interest vs
time r = 0.478 to 0.829). Two series that both trend will correlate in levels
whether or not they are related. Testing that:

| Series | Levels r (p) | First differences r (p) | Linear-detrended r (p) |
| --- | ---: | ---: | ---: |
| Worldwide | **0.727** (<0.0001) | −0.116 (0.548) | **0.527** (0.003) |
| United States | **0.747** (<0.0001) | 0.133 (0.493) | **0.541** (0.002) |
| Singapore | **0.580** (0.0008) | 0.089 (0.647) | 0.164 (0.387) |
| Malaysia | 0.220 (0.242) | −0.148 (0.442) | −0.283 (0.129) |
| Norway | 0.146 (0.441) | 0.143 (0.459) | **−0.505** (0.004) |
| Indonesia | −0.019 (0.920) | −0.087 (0.654) | **−0.448** (0.013) |

**Zero of six series survive first differencing.** Week-to-week changes in crude
prices and EV interest show no detectable relationship anywhere. Linear detrending
disagrees — but a straight line is a poor model of a flat-then-step price path, so
that check is not decisive either. Norway and Indonesia even turn significantly
*negative* after detrending.

The honest conclusion is that **the result is specification-sensitive**, and with
30 observations and one four-week price episode this dataset cannot separate a
genuine relationship from two trends that happened to coincide.

Also not supported:

- **Causation.** No confounder is measured: seasonality, model launches, news
  volume, advertising, policy announcements.
- **Cross-market interest levels.** Each Trends export is normalised to its own
  peak; all six contain a 100. "Which market is most interested" is unanswerable
  from these files at any level of effort.
- **Consumer motivation.** The data records searches and prices, not reasons. It
  cannot distinguish environmental concern from cost anxiety.
- **Adoption.** Search interest is not purchase.
- **Retail price effects.** The variable is a global crude benchmark. Consumers
  face pump prices, which differ by tax and subsidy regime and are absent — which
  is exactly why the subsidy explanation cannot be tested here.
- **Anything outside 2025-08-31 → 2026-03-29.**
- **A precise threshold.** The elevated regime begins 2026-03-01; "the global
  breaking point is $0.65/litre" is not identified to that precision by four
  observations.

---

## 3. What should the dashboard emphasize?

In this order. The first two are non-negotiable.

1. **The divergence between markets, not the global average.** The interesting
   finding is that three of five markets show nothing while the US shows a lot.
   That is a real, defensible, scale-free comparison and it is the heart of the
   project.
2. **The specification comparison as a first-class section.** Publishing r = 0.727
   without the differencing result repeats the original project's error in a nicer
   font. Give it a card of its own, near the global chart, not a footnote.
3. **Peak timing dispersion.** A timeline showing four peak weeks across three
   months, with the regime onset (2026-03-01) marked, immediately communicates
   that three markets peaked *before* prices moved. This replaces the false
   "synchronised peak" claim with something more interesting.
4. **Uncertainty made visible.** Confidence intervals on every coefficient, and
   the leave-one-out table shown rather than described. Worldwide r moves at most
   0.056 across leave-one-out; that is worth showing because it is a point in the
   analysis's favour.
5. **The regime imbalance.** 26 baseline weeks vs 4 elevated. Shade it on the
   oil chart so the reader sees how little of the range carries the result.

De-emphasise: the raw magnitude of r. Under-emphasising it is the correct choice
given §2.

---

## 4. Which original narratives survived?

| Original narrative | Verdict | Evidence |
| --- | --- | --- |
| **Indonesia is insulated from oil-price movement** | **Survived** (statistical half) | r = −0.019, p = 0.920, CI spans zero. Also the only market whose interest *fell* into the elevated regime (−31.2%). |
| **Norway shows no meaningful oil/interest relationship** | **Survived** (statistical half) | r = 0.146, p = 0.441, CI spans zero. |
| **The United States moved strongly with oil prices** | **Survived, with qualifier** | r = 0.747, p < 0.0001, strongest of the five; only market peaking after the oil peak (+2w); survives removal of the entire elevated regime (r = 0.408, p = 0.038). Fails differencing. |
| **Singapore is responsive to energy-price pressure** | **Survived, weakened** | r = 0.580, p = 0.0008 — but drops to r = 0.304, p = 0.132 when the price spike is removed, so it is carried by the spike. |
| **The Subsidized Buffer** category | **Supported** | Predicts no detectable association for Indonesia; measured `no_detectable_association`. |
| **The Maturity Gap** category | **Supported** | Predicts Norwegian absence plus Singaporean responsiveness; both measured as predicted. |

Two of three executive categories survive. That is a better outcome than the audit
anticipated, and it means the three-panel structure can be preserved.

---

## 5. Which were weakened?

| Narrative | How it weakens |
| --- | --- |
| **"Near-perfect correlation"** | r = 0.727 is strong, not near-perfect, and it does not survive differencing. |
| **Any oil→interest causal reading** | Downgraded to co-movement everywhere. All three significant series are classified `level_only_association`; **none** reaches `robust_positive_association`. |
| **Singapore's responsiveness** | Real but spike-dependent (see §4). Flagged `loses_significance_without_elevated_regime`. |
| **Norway as "post-transition"** | The absence of association is real; the maturity explanation is external and cannot be tested here. Also note Norway's r flipped from −0.081 (original) to +0.146 (corrected) once alignment and precision were fixed — so the original's "negative correlation" framing was itself an artifact. |
| **Indonesia's stability** | Genuinely no association overall — but `regime_sensitive`: within the baseline regime Indonesia is significantly **positive** (r = 0.453, p = 0.020). Report both or neither. |
| **The $0.65/litre "breaking point"** | Replaced by the data-derived regime onset (2026-03-01, +19.5% week-over-week), stated as a regime boundary rather than a behavioural threshold. |

---

## 6. Which were removed?

| Removed claim | Reason |
| --- | --- |
| "Synchronized peak in EV interest across 5 different countries in a single month" | **Contradicted.** 4 distinct weeks, 3 months, 9-week span. `synchronised_within_one_month: false`. |
| "Pasar paling antusias: Norway (60.7 avg)" and the mean-score bar chart | **Invalid method.** Independently normalised series cannot be ranked by mean. Unfixable from the committed files. |
| "Proves that fuel price shocks are the single greatest driver for EV curiosity worldwide" | No competing driver is measured; observational correlation cannot support "proves" or "greatest". |
| "EV interest is no longer driven by environmental sentiment, but by National Energy Security" | The dataset contains no motivation variable. |
| "As of April 2026 … bracing for the projected June 2026 fuel crisis" | Outside the data window; a projection is not a finding. |
| Malaysia's "exceptional sensitivity … accelerates toward a perfect score of 100" | **Contradicted.** r = 0.220, p = 0.242, CI includes zero; peak precedes the price rise by four weeks. |
| README's IEA/EIA/OPEC sources, barrels↔GWh standardisation, CAGR, forecasting, `scripts/` | None exist in the repository. |

### The Proactive Shift must be restructured

`verdict: not_supported` — both members fail, for different reasons:

- **Malaysia** has no measurable association (r = 0.220, p = 0.242), and its peak
  precedes the price rise. There is no proactive response in this data to explain.
- **United States** has the strongest association in the dataset, but it is
  `level_only_association`, so "fast, decisive pivot" overstates what survives.

**Recommendation: keep the three-panel structure, redefine the third panel.** The
pipeline already emits a data-derived grouping:

```
no_detectable_association  →  Indonesia, Norway
inconclusive               →  Malaysia
level_only_association     →  Singapore, United States
```

A defensible relabelling that preserves the editorial identity:

| Panel | Members | Claim |
| --- | --- | --- |
| **The Subsidized Buffer** | Indonesia | Interest shows no relationship to crude prices, and fell as prices rose. |
| **The Maturity Gap** | Norway, Singapore | Norway shows no relationship; Singapore responds but only during the price spike. |
| **The Co-Movement Case** *(replaces The Proactive Shift)* | United States, Worldwide | The clearest co-movement in the dataset — and the clearest illustration of why co-movement is not enough. |

Malaysia becomes an explicit fourth case or a caveat within the framework: a
market whose interest rose sharply for reasons this data cannot attribute to oil.
Do not force it into a panel.

**All three categories must carry `requires_external_evidence: true` visibly.**
The names assert mechanisms — subsidy buffering, market maturity — and a price
series plus a search index cannot establish a mechanism. Present them as an
**editorial framework**, never as discovered clusters.

---

## 7. What visualizations should be built from the final metrics?

Each entry names the fields it reads. Nothing on this list requires the frontend
to compute anything.

| # | Visualization | Reads | Why it earns its place |
| --- | --- | --- | --- |
| 1 | **Dual-axis oil + worldwide interest over time**, with the elevated regime shaded and the partial week dashed | `panel.rows[].oil.*_exact`, `interest.worldwide`, `regime`, `is_partial_week` | The two headline series have never appeared in one frame. Shading from `regime` shows the imbalance without a word of copy. |
| 2 | **Specification comparison** — three coefficients per series with significance marked | `trend_diagnostics.specifications[]`, `agreement` | The most important caveat, as a chart rather than a paragraph. Reading "levels significant, differences not" across six rows makes the point instantly. |
| 3 | **Correlation dot-and-whisker**, ordered, with a shaded "not distinguishable from zero" band | `primary.pearson_r`, `bootstrap_ci` | Replaces the invalid mean-score bar chart. Shows immediately that three of five CIs cross zero. |
| 4 | **Peak timeline** — five markers on a shared axis with the oil peak and regime onset marked | `peak_dispersion.peaks`, `regime.onset_week`, `oil.max_week` | Corrects the synchronised-peak claim visually. Three markers sit left of the onset line. |
| 5 | **Per-country scatter with OLS fit and CI band**, points coloured by recency | `panel.rows`, `primary.fit`, `primary.pearson_r/p/n` | Recency colouring makes the 4-point leverage visible instead of asserted. |
| 6 | **Small multiples, 5 panels, shared shape emphasis** with an explicit "each scaled to its own peak" caption | `panel.rows[].interest` | Shape comparison is legitimate; the caption prevents the level misreading. |
| 7 | **Leave-one-out strip** per series | `sensitivity.leave_one_out.per_observation[]` | Showing robustness is the single strongest credibility signal available. |
| 8 | **Lag profile** −4…+4 with non-negative lags emphasised and the negative-lag artifact annotated | `lag_profile`, `best_lag`, `unrestricted_lag_maximum_is_negative` | Turns a statistical trap into a teaching moment. |
| 9 | **Baseline→elevated change**, diverging bars | `profile.scale_free.baseline_to_elevated_pct_change` | Scale-free, and Indonesia's −31.2% against four positives is the sharpest single image in the dataset. |
| 10 | **Data table** with `trading_days`, `is_partial_week`, both oil units | `panel.rows` | 31 rows — show them all, no pagination. |

**Do not build:** any ranking of markets by interest level; any chart implying a
causal arrow from oil to interest; a single "the answer is r = 0.73" hero number.

---

## 8. Which claims require external sources before publication?

Eight, all registered in `claims.json` with `disposition: requires_citation`,
`sources: []` and `publishable_as_fact: false`. No source was invented for any of
them.

| Claim ID | Assertion |
| --- | --- |
| `iran_israel_usa_conflict` | Regional conflict escalation as the February 2026 driver |
| `malaysia_subsidy_quota_change` | Fuel subsidy quota cut from 300 to 200 litres per consumer per month |
| `singapore_pump_prices` | Pump prices of SGD 3.40–4.16 per litre |
| `singapore_ev_ownership_share` | EV ownership ≈ 7% |
| `singapore_coe_barrier` | Certificate of Entitlement and infrastructure costs as adoption barriers |
| `indonesia_pump_price` | Indonesian pump price ≈ Rp 7,200 |
| `us_energy_policy_attribution` | A named administration's energy policy contributing to the global supply crunch |
| `us_market_rank_and_manufacturers` | Second-largest EV market in 2025; Tesla and Rivian as domestic supply chain |

These are not decorative — they supply the entire causal mechanism behind the
executive summary. Without them the project has patterns and no explanations,
which is an honest position but a different one.

Three acceptable resolutions per claim: **(A)** record a real source and label it
external context; **(B)** leave it visibly marked as requiring sourcing (a
rendered "unsourced" badge, not silent omission); **(C)** reword into a
data-supported statement. Not acceptable: rendering any of them as an established
fact.

The frontend should enforce this mechanically — `publishable_as_fact === false`
routes to an "unsourced context" treatment, never to body copy.

---

## Recommended sequencing before Phase 3 content is written

Two data-collection actions would change what the site is allowed to claim, and
both are cheap. Doing them *before* the copy is written is much cheaper than
after.

| # | Action | Effect |
| --- | --- | --- |
| 1 | **Re-export Google Trends over a 5-year window** (weekly granularity is returned for ranges up to 5 years) | n goes from 31 to ≈260, covering several price cycles instead of one 4-week spike. This is the only change that can resolve the differencing problem, because it supplies real price variation outside a single episode. `data/raw/DCOILBRENTEU.csv` already spans 2021-03-23 → 2026-03-23, so the oil side is free. |
| 2 | **Re-export as a single multi-region comparison query** | Puts all five markets on one shared scale, making level comparison and "which market responded most" legitimate. Recovers an entire class of analysis currently prohibited. |
| 3 | **Record query provenance** — term, category, geo, retrieval date | Closes the reproducibility gap. Minutes of work. |

The pipeline requires **no code changes** to consume a longer series: it reads the
weekly grid from the files and asserts its own assumptions. Re-run
`python -m pipeline.build --report` and every artifact, metric and report updates
together.

If these are not feasible, Phase 3 can proceed on the current contract — but the
narrative must be the one in §1–§3, and the specification comparison must be a
headline section rather than a caveat.
