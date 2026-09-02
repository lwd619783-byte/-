# A股牛熊温度计历史数据可用性与 Point-in-Time 回测数据集设计 V1

> Stage 4.1 research contract  
> Date: 2026-09-02  
> Code baseline: `main` @ `8a1d4c110b5eb8a248701be6cd84470d1fa0d7f7`  
> Status: **BACKTEST DATASET DESIGN V1 — no production temperature authorized**

## 1. Objective

This document defines how the A-share Bull/Bear Thermometer will reconstruct historical weekly information sets without look-ahead.

The target research horizon remains **2005–present**, but V1 explicitly rejects the false assumption that every modern indicator existed with the same definition in 2005.

The backtest must answer two different questions:

1. **What information was actually observable at each historical weekly decision point?**
2. **How comparable is a historical temperature with a modern temperature given changing market infrastructure and statistical definitions?**

Therefore every result must carry both a temperature and a coverage/comparability record.

---

## 2. Fundamental point-in-time rule

For a weekly run at cutoff time `T`, an observation is eligible only when:

```text
observation.releaseAvailableAt <= T
```

The date represented by the statistic is not sufficient.

Example:

- a macro statistic describing August may have `valueDate = 2026-08`;
- it may be released in September;
- a weekly model run before the September publication must not see it.

The dataset therefore distinguishes:

```text
valueDate
releaseDateTime
releaseAvailableAt
fetchedAt
revisionSequence
sourceDefinitionVersion
```

`releaseAvailableAt` is the conservative availability timestamp used by the backtest.

---

## 3. Weekly decision clock V1

The legacy operating rule is “run every Monday”.

V1 freezes the first backtest clock as:

```text
runTimeZone = Asia/Shanghai
runWeekday = Monday
runCutoff = 08:00
```

Each weekly input snapshot is therefore created at **Monday 08:00 Asia/Shanghai**, independent of whether Monday is a trading day.

Rules:

1. daily market data use the latest eligible trading-day observation available before the cutoff;
2. a Monday market holiday does not shift the model clock — the prior eligible trading-day data are carried forward;
3. an official release published after Monday 08:00 enters the following weekly run, unless a later alternative decision-clock experiment is explicitly defined;
4. the baseline backtest must never retrospectively use Monday closing data for a Monday 08:00 decision.

A later sensitivity test may compare a weekend / Monday-close schedule, but V1 admission evidence is anchored to this frozen morning cutoff.

---

## 4. Release-time confidence classes

Historical official archives often provide only a publication date, not an exact intraday timestamp.

Every observation receives one of:

| Class | Meaning | Backtest availability rule |
| --- | --- | --- |
| `EXACT_TIMESTAMP` | official publication timestamp is known | use the exact timestamp |
| `DATE_ONLY_SAFE` | official publication date known, exact time unknown | treat as available at `releaseDate + 1 day 00:00` Asia/Shanghai |
| `SCHEDULE_INFERRED` | release timing inferred from an official calendar, exact archive timestamp absent | usable only in sensitivity research; not strict admission evidence |
| `LATEST_REVISED_PROXY` | only the latest revised historical series is available | cannot enter the primary strict point-in-time backtest |
| `BACKCAST_RELEASED_LATER` | historical values were officially backfilled at a later date | values become eligible only from the backcast publication date onward |
| `STRUCTURALLY_UNAVAILABLE` | metric/market mechanism did not yet exist | never synthesize or backfill |

The conservative `DATE_ONLY_SAFE` rule intentionally sacrifices one day of apparent timeliness to avoid accidental intraday look-ahead.

---

## 5. Historical source eras

The model does not have one homogeneous 2005–present information regime.

### Era A — Pre-leverage market

```text
2005-01-01 through 2010-03-30
```

Known structural limitations:

- exchange margin financing did not yet operate;
- Stock Connect did not exist;
- exact post-One-Code “new investor” statistic did not exist;
- current ETF net-flow source contract is not proven;
- AFRE stock signal was not publicly available;
- nationwide industrial-profit reporting was not monthly under the post-2011 structure.

Implication:

Under the current V1 missing-data rule, the Capital Flow module is likely unavailable unless an admitted historical ETF-flow reconstruction is found. The broad model can still produce a research-era output only if remaining module coverage satisfies the global threshold.

Comparability label: `LEGACY_PARTIAL`.

### Era B — Margin financing, pre-Connect

```text
2010-03-31 through 2014-11-16
```

Structural change:

- Shanghai/Shenzhen margin-financing mechanism becomes observable from the 2010 launch period;
- Stock Connect still absent.

Under equal internal Capital Flow weights, `MarginScore` alone represents only one of three planned flow submetrics and does not satisfy the current 50% within-module availability rule.

Therefore **Capital Flow remains unavailable in the baseline model unless ETF net-flow history becomes independently admitted**.

Comparability label: `LEVERAGE_PARTIAL`.

### Era C — Shanghai Connect / AFRE transition

```text
2014-11-17 through 2016-12-04
```

Structural changes:

- Shanghai–Hong Kong Stock Connect begins 2014-11-17;
- margin + Northbound gives two of three Capital Flow submetrics, allowing the module to pass the 50% internal-coverage threshold even if ETF flow remains unavailable;
- Northbound scope is Shanghai-only during this era;
- the One-Code investor-statistics regime is transitioning;
- official AFRE stock historical backcast is not available until 2015-02-10.

Sub-break:

```text
2015-02-10
```

From this date, the officially published 2002–2014 AFRE stock backcast becomes historically known and may be used to seed a point-in-time reference distribution. It must not be used in model runs before the publication date.

Comparability label: `CONNECT_SH_PARTIAL`.

### Era D — Full Shanghai + Shenzhen Connect, pre-modern buyback regime

```text
2016-12-05 through 2018-12-31
```

Structural changes:

- Shenzhen–Hong Kong Stock Connect begins 2016-12-05, so Northbound now covers both Shanghai and Shenzhen channels;
- shareholder-reduction disclosure/regulatory definitions experience major 2016–2017 changes;
- the 2018 Company Law amendment materially changes the buyback framework.

Reduction and buyback submetrics must therefore remain definition-versioned and may be excluded from comparable supply history until their event Provider is admitted.

Comparability label: `FULL_CONNECT_TRANSITIONAL_SUPPLY`.

### Era E — Modern market-regime baseline

```text
2019-01-01 onward
```

V1 treats 2019 onward as the preferred modern-comparability era for the eventual supply composite because detailed post-2018 buyback rules are in place.

Sub-break:

```text
2021-11-15
```

Beijing Stock Exchange begins trading and from this date must be included in any metric explicitly defined as “all A shares” when compatible market-cap / turnover semantics are available.

Comparability label:

- 2019-01-01 to 2021-11-14: `MODERN_PRE_BSE`
- 2021-11-15 onward: `MODERN_ALL_A_WITH_BSE`

---

## 6. Metric-by-metric historical availability matrix

### 6.1 Base-score metrics

| Metric | Target earliest PIT use | Structural / definition break | V1 backtest status |
| --- | --- | --- | --- |
| `FLOW_MARGIN_BALANCE` | 2010-03-31 launch era | financing universe / exchange rule changes must be versioned | `PIT_TARGET_READY` after historical Provider extraction |
| `FLOW_EQUITY_ETF_NET_FLOW` | unknown | first domestic ETF listed 2005, but this does **not** prove historical net-subscription data | `EXCLUDE_UNTIL_PROBE` |
| `FLOW_NORTHBOUND` | 2014-11-17 | Shanghai-only until 2016-12-04; Shanghai+Shenzhen from 2016-12-05 | `PIT_TARGET_READY` with scope version |
| `SENT_A_SHARE_TURNOVER` | 2005 target | BSE enters 2021-11-15; exchange aggregation semantics must match | `PIT_TARGET_READY` after SSE/SZSE/BSE aggregation probe |
| `SENT_NEW_INVESTORS` | 2015 target | One-Code statistical regime transition in 2014; earlier “new stock accounts” is not the same metric | `EXCLUDE_PRE_2015`; exact first eligible month still probe |
| `VAL_MARKET_PE_PERCENTILE` | potentially 2005/2006 warm-up | CSI 300 launched 2005-04-08; continuous historical official PE series still unproven | `BLOCKED_BY_SOURCE_PROBE` |
| `VAL_BUFFETT_INDICATOR_CN` | 2005 target if market-cap history admitted | BSE added from 2021-11-15; GDP vintages/revisions must be preserved | `PIT_DESIGN_READY`, source extraction pending |
| `SUPPLY_IPO_FINANCING` | 2005 target | monthly CSRC archive exists pre-2005; attachment fields need deterministic parser | `PIT_SOURCE_FAMILY_READY` |
| `SUPPLY_REFINANCING` | 2005 target | financing taxonomy may change | `PIT_SOURCE_FAMILY_READY` |
| `SUPPLY_REDUCTION` | 2017 comparable-regime target | major 2016/2017 regulatory break | `EXCLUDE_UNTIL_EVENT_PROVIDER` |
| `SUPPLY_BUYBACK` | 2019 comparable-regime target | 2018 law change / 2018–2019 detailed-rule transition | `EXCLUDE_UNTIL_EVENT_PROVIDER` |
| `MACRO_M2` | 2005 | definition revisions, notably 2011 and 2018 in the 2005+ sample | `PIT_TARGET_READY_WITH_DEFINITION_VERSION` |
| `MACRO_SOCIAL_FINANCING` | 2015-02-10 for V1 stock-based signal | increment officially published from 2011; stock historical backcast released 2015-02-10 | `PIT_ELIGIBLE_FROM_BACKCAST_RELEASE` |

### 6.2 Quality / overlay metrics

| Metric | Target earliest PIT use | Break / limitation | V1 status |
| --- | --- | --- | --- |
| `PROFIT_INDUSTRIAL` | 2005 at lower frequency; 2011 monthly nationwide | 2011 threshold changed from RMB 5m to 20m and nationwide reporting cadence changed | `PIT_VERSIONED_QUALITY_OVERLAY` |
| `PROFIT_LISTED_BREADTH` | unknown | current 56-stock Provider is not whole-market breadth | `NOT_READY` |
| `POLICY_CYCLE_CORRECTION` | potentially 2005 | requires a structured official-event historical dataset with decay semantics | `DISABLED_IN_INITIAL_BACKTEST` |
| `STRUCTURAL_BUBBLE_TEMPERATURE` | separate research track | needs sector/style historical cross-section | `DISABLED_FROM_BROAD_INITIAL_BACKTEST` |

---

## 7. Important historical break details

## 7.1 Margin financing

Official exchange materials identify 2010-03-31 as the launch date of the margin-trading pilot transaction period.

Backtest rule:

```text
before 2010-03-31 => STRUCTURALLY_UNAVAILABLE
on/after launch => eligible only when historical exchange observation is released/available
```

Never reconstruct pre-2010 financing balances as zero.

---

## 7.2 Stock Connect

Backtest scope version:

```text
before 2014-11-17:
    NORTHBOUND_SCOPE = NONE

2014-11-17 through 2016-12-04:
    NORTHBOUND_SCOPE = SHANGHAI_CONNECT_ONLY

2016-12-05 onward:
    NORTHBOUND_SCOPE = SHANGHAI_PLUS_SHENZHEN_CONNECT
```

A historical percentile reference distribution may span the scope change only if the transform/version explicitly records that break. V1 should also report a sensitivity test that restarts the Northbound percentile history at 2016-12-05.

---

## 7.3 ChinaClear investor statistics

The 2014 One-Code transition creates a semantic break.

V1 rule:

- pre-One-Code “new stock accounts” are not converted into `new investors`;
- 2014 is a transition year;
- use the post-One-Code investor statistic only after its exact historical publication contract is proven;
- target operational backtest start = 2015.

This preserves semantic identity at the expense of a shorter history.

---

## 7.4 M2 definition versions

PBOC documentation identifies multiple historical money-supply definition revisions, including within the 2005+ window:

- October 2011: additional categories such as non-deposit financial-institution deposits / housing provident-fund deposits enter the statistical scope;
- January 2018: money-market-fund shares with monetary/payment characteristics enter M2.

Dataset fields must include:

```text
statisticalDefinitionVersion
publishedComparableGrowthRate
```

V1 preference:

When the historical official release publishes a “comparable-basis” YoY growth rate, preserve and score the value actually published at that time rather than recomputing an artificial historical YoY from today’s latest revised level series.

A later `LATEST_REVISED_SERIES` sensitivity backtest may be run separately but cannot replace strict PIT evidence.

---

## 7.5 AFRE / social financing

This is a special point-in-time trap.

Historical facts:

- AFRE increment was formally compiled/published from 2011;
- on 2015-02-10 PBOC officially released AFRE stock historical data for 2002–2014;
- the stock historical values therefore existed economically before 2015, but were not publicly available as this stock dataset before the 2015 release.

Since V1 base formula uses **AFRE stock YoY**, the strict backtest rule is:

```text
T < 2015-02-10:
    MACRO_SOCIAL_FINANCING = STRUCTURALLY_UNAVAILABLE_FOR_V1_STOCK_SIGNAL

T >= 2015-02-10:
    official 2002–2014 backcast history becomes known and may seed percentile/momentum calculations
```

This avoids one of the largest possible look-ahead errors in the model.

Candidate D Credit Impulse / increment-based research may eventually have an earlier point-in-time start, but it must be treated as a separate formula version.

---

## 7.6 Industrial-enterprise profits

NBS documents a major 2011 comparability/cadence change:

- before 2011, the above-scale threshold was lower and nationwide monthly coverage/cadence differed;
- from 2011 the main-business-revenue threshold changed to RMB 20m and nationwide monthly reporting expanded, with January exempt;
- comparable prior-year values were supplied under the new threshold for transition analysis.

V1 historical classifier rule:

```text
2005–2010:
    use only nationwide-compatible release points (primarily Mar/Jun/Sep/Dec under the documented old cadence)
    carry forward between eligible releases
    qualityFrequency = QUARTER_LIKE

2011 onward:
    use nationwide monthly release cadence (January exempt)
    qualityFrequency = MONTHLY
```

Because Profit Cycle is a quality classifier rather than a base 100-point module, this frequency break does not invalidate the base score but must reduce quality-overlay comparability.

---

## 7.7 Shareholder reductions

The reduction framework experienced material rule changes in January 2016 and May 2017.

V1 rule:

- do not force pre-2017 event history into the same comparable aggregate;
- target comparable executed-reduction Provider from 2017 onward;
- announcements/plans and completed reductions remain separate event states;
- older history may be analyzed as `LEGACY_REDUCTION_RESEARCH`, not merged silently.

---

## 7.8 Buybacks

Buybacks existed before 2018, but the October 2018 Company Law amendment and subsequent exchange implementation rules materially expanded and changed the mechanism.

V1 rule:

- older buybacks remain historical research evidence;
- target a comparable executed-buyback aggregate from 2019 onward;
- distinguish proposal ceiling from actual executed amount;
- distinguish cancellation-oriented buybacks from employee/incentive inventory.

---

## 7.9 ETFs

The first domestic ETF was listed in 2005, but existence of ETF trading is not evidence that an official historical market-wide net-subscription series is available.

V1 rule:

`FLOW_EQUITY_ETF_NET_FLOW` stays excluded from the strict initial backtest until a reproducible shares-outstanding / subscription-redemption history is proven.

ETF turnover must never substitute for ETF net flow.

---

## 7.10 CSI 300 valuation

CSI 300 was formally published on 2005-04-08 with a 2004-12-31 base date, and official launch materials included a market PE snapshot.

However, V1 has not yet proven a continuous official machine-readable historical TTM PE series sufficient for weekly point-in-time percentiles.

Therefore:

- the formula definition remains frozen as CSI 300 TTM PE;
- the valuation module must not be filled with an unrelated third-party series without a documented source contract;
- if historical PE cannot be sourced legally/reproducibly, Valuation becomes unavailable for those weeks or a separately versioned challenger benchmark is designed;
- no silent splice between different PE methodologies.

This is currently one of the most important remaining Source Probe blockers.

---

## 8. All-A-share market aggregation rules

Several transforms depend on total A-share turnover / market capitalization.

V1 market scope:

```text
2005 through 2021-11-14:
    SSE A shares + SZSE A shares

2021-11-15 onward:
    SSE A shares + SZSE A shares + BSE eligible A-share market
```

For each exchange, Provider implementation must confirm identical semantics for:

- total market capitalization;
- negotiable/free-float market capitalization;
- turnover value;
- date/time basis;
- currency/unit.

If exchange definitions are not directly additive, the aggregator must explicitly transform them to one canonical definition before use.

The BSE opening is a `sourceDefinitionVersion` break, not a reason to rewrite earlier history.

---

## 9. Historical-data quality tiers

Every metric-week cell receives a backtest quality tier:

| Tier | Definition |
| --- | --- |
| `A_STRICT_PIT` | official value + exact/date-safe release availability + original/as-published vintage |
| `B_PIT_WITH_SCOPE_BREAK` | official PIT value but market/statistical scope has a documented version break |
| `C_BACKCAST_KNOWN_AT_TIME` | backcast history is used only after its actual historical release date |
| `D_REVISED_PROXY` | latest revised series used because original vintage unavailable; excluded from primary admission metrics |
| `X_STRUCTURAL_MISSING` | mechanism/statistic did not exist |
| `X_SOURCE_NOT_ADMITTED` | data may exist but no acceptable source contract yet |

Primary backtest admission statistics should be reported both:

1. using all allowed A/B/C cells;
2. using A-only or A+B subsets where feasible.

This exposes sensitivity to historical-data quality instead of hiding it.

---

## 10. Dataset entities

The eventual research pipeline should produce the following logical entities.

### 10.1 `SourceDefinitionVersion`

```text
sourceDefinitionVersionId
sourceId
validFrom
validTo
marketScope
statisticalDefinition
unit
notes
primaryEvidenceUrl
```

Examples:

- Northbound Shanghai-only vs Shanghai+Shenzhen;
- M2 pre/post 2011 revision;
- M2 pre/post 2018 revision;
- all-A market cap pre/post BSE;
- industrial profits pre/post 2011 threshold change.

### 10.2 `RawSourceArtifact`

```text
artifactId
sourceId
sourceUrl
publishedAtRaw
releaseAvailableAt
releaseTimeConfidence
fetchedAt
sha256
contentType
localOrObjectStoragePath
```

### 10.3 `MetricObservationVintage`

```text
observationId
metricId
valueDate
value
unit
releaseDateTime
releaseAvailableAt
revisionSequence
supersedesObservationId
sourceDefinitionVersionId
artifactId
qualityTier
```

### 10.4 `WeeklyBacktestClock`

```text
weekId
runCutoff
latestEligibleTradingDate
calendarVersion
```

### 10.5 `BacktestInputManifest`

Immutable manifest of every observation version used by one weekly run:

```text
manifestId
weekId
formulaVersion
metricObservationIds[]
moduleAvailability
baseWeightCoverage
metricCoverage
qualityTierCounts
createdAt
```

### 10.6 `WeeklyFeatureMatrix`

Derived values only after input manifest is frozen:

```text
weekId
metricId
rawValue
transformedValue
percentileScore
historyWindowStart
historyObservationCount
historyMaturity
eligible
exclusionReason
```

### 10.7 `BacktestRunResult`

```text
weekId
candidateId
baseTemperature
policyAdjustment
marketTemperature
flowScore
sentimentScore
valuationScore
supplyScore
macroLiquidityScore
profitCycleState
structuralBubbleTemperature
baseWeightCoverage
confidenceClass
inputManifestId
formulaVersion
```

---

## 11. Storage / repository layout V1

Historical raw artifacts may become too large for the frontend bundle and should not be imported by React components.

Proposed research layout:

```text
research-data/
  market-regime/
    source-catalog/
    raw/                 # local/object-store; large files generally not committed
    extracted/           # normalized source observations
    vintages/            # immutable observation versions
    manifests/           # weekly PIT input manifests
    features/            # derived weekly feature matrices
    backtests/           # candidate outputs + diagnostics

scripts/
  market-regime/
    fetch-*.py|mjs
    extract-*.py|mjs
    build-weekly-manifests.*
    build-features.*
    run-backtest.*
    validate-backtest.*

docs/market-regime/
  metric-registry-v1.md
  source-audit-v1.md
  formula-normalization-v1.md
  backtest-dataset-design-v1.md
```

Git policy:

- commit schemas, source catalog, compact manifests/summaries, tests and deterministic sample fixtures;
- do not commit huge raw historical downloads solely for convenience;
- raw artifacts must still have hashes and reproducible provenance;
- no historical dataset is allowed into the browser initial bundle.

---

## 12. Initial strict-backtest feasibility by era

Assuming ETF flow remains unavailable and the current internal Flow weights remain equal:

| Era | Capital Flow | Other base modules | Expected base-weight coverage before source blockers | Interpretation |
| --- | --- | --- | ---: | --- |
| 2005–2010-03-30 | unavailable | sentiment/valuation/supply/macro targeted | up to ~65% | research-only / low-to-reduced confidence; valuation/source gaps may reduce further |
| 2010-03-31–2014-11-16 | margin alone insufficient for Flow module | same | up to ~65% | still pre-Connect partial model |
| 2014-11-17–2016-12-04 | margin + SH Northbound makes Flow eligible | other modules progressively improve | up to 100% minus unavailable metric/module blockers | reduced scope confidence |
| 2016-12-05–2018-12-31 | margin + full SH/SZ Northbound | modern core closer to complete | high potential coverage | transitional supply definitions |
| 2019 onward | modern Flow + supply regime | highest source comparability | highest potential coverage | preferred modern validation era |

Important: “up to” is not a promise. PE history, supply-field parsing, investor data and other source probes can still lower actual weekly coverage.

---

## 13. Primary vs secondary backtests

### Primary: `PIT_STRICT_V1`

Allowed data quality:

- A_STRICT_PIT;
- B_PIT_WITH_SCOPE_BREAK;
- C_BACKCAST_KNOWN_AT_TIME.

Disallowed:

- latest revised values that were not known then;
- synthetic pre-history;
- source substitutions without a versioned contract.

This is the only backtest eligible to support production admission.

### Secondary: `REVISED_HISTORY_SENSITIVITY`

May use latest revised official history where original vintages cannot be recovered.

Purpose:

- understand economic relationship;
- compare formula robustness;
- identify whether vintage revisions materially alter conclusions.

It must be visually and statistically separated from the strict backtest.

### Secondary: `MODERN_ERA_ONLY`

Start in 2019 and evaluate the model under the most comparable modern structure.

Purpose:

- test current operating usefulness;
- prevent weak early-era coverage from dominating parameter selection.

### Secondary: `LEGACY_PARTIAL`

2005–2014 partial model.

Purpose:

- inspect 2005–2007 / 2008 / 2014 behavior;
- never claim it has the same evidence structure as the modern model.

---

## 14. Warm-up rules under later-released backcasts

A later official backcast may immediately provide substantial historical context, but only after release.

Example: AFRE stock.

At the first weekly cutoff after 2015-02-10:

- the official 2002–2014 backcast is known;
- the model may use those historical observations to construct the reference distribution;
- this does **not** imply the model could have used AFRE stock in 2008.

The manifest therefore records both:

```text
historicalValueDate
historicalReleaseAvailableAt
```

This rule also applies to any future official historical reconstruction.

---

## 15. Forward-return evaluation protocol

The thermometer is a risk-control system, not a one-week trading strategy.

Each weekly score should later be evaluated against at least:

```text
forward_1M_return
forward_3M_return
forward_6M_return
forward_12M_return
forward_3M_max_drawdown
forward_6M_max_drawdown
forward_12M_max_drawdown
```

Benchmark candidates should be frozen before running performance selection, for example:

- CSI 300 as the primary broad-market risk benchmark;
- an all-A-share total-return benchmark as a challenger if a robust history is available.

The first validation focuses on monotonic risk relationships:

- do higher temperature buckets show lower future margin of safety / higher drawdown risk?
- do very low temperature buckets historically correspond to better long-horizon opportunity sets?
- is the model stable enough for weekly allocation guidance?

Do not optimize for maximum CAGR alone.

---

## 16. Required cycle diagnostics

Every candidate A–D must publish a dedicated event table around:

1. 2005–2007 bull market;
2. 2008 crisis;
3. 2014–2015 leverage/liquidity bull;
4. 2018 bear market;
5. 2020–2021 structural growth bubble;
6. 2024–present policy/liquidity cycle.

Each event table must show:

```text
week
marketTemperature
moduleScores
baseWeightCoverage
metricCoverage
qualityTierCounts
keyContributors
keyMissingMetrics
benchmarkLevel
forwardReturn
forwardMaxDrawdown
```

This prevents a headline temperature curve from hiding weak data coverage.

---

## 17. Remaining source-probe blockers before data construction

Priority order:

### P0

1. **CSI 300 historical TTM PE** — prove a reproducible historical valuation source / licensing path.
2. **All-A turnover + total/negotiable market cap** — build an identical-definition SSE + SZSE (+ BSE from 2021-11-15) source contract.
3. **CSRC monthly report attachment parser** — prove IPO and refinancing monthly fields from 2005 onward with publication-date provenance.
4. **Historical M2 vintage extraction** — preserve as-published/comparable YoY and definition versions.
5. **AFRE stock publication evolution** — verify frequency transition and original historical release/vintage sequence from 2015 onward.

### P1

6. ChinaClear post-One-Code monthly new-investor history and exact first comparable month.
7. reduction executed-amount event Provider from comparable 2017 regime onward.
8. executed buyback event Provider from comparable 2019 regime onward.
9. ETF net-subscription history.

### P2 / overlay

10. market-wide listed-company earnings breadth;
11. structured historical policy-event dataset;
12. structural-bubble historical cross-sectional dataset.

---

## 18. Dataset admission gates

Before `PIT_STRICT_V1` is allowed to produce a candidate temperature history:

- [ ] every included metric has a versioned source contract;
- [ ] release availability is known at least to `DATE_ONLY_SAFE` quality;
- [ ] no `LATEST_REVISED_PROXY` is silently mixed into primary scoring;
- [ ] structural mechanism start dates are enforced;
- [ ] definition/scope breaks are versioned;
- [ ] weekly Monday 08:00 manifests are immutable;
- [ ] every score can be reproduced from observation IDs;
- [ ] future data cannot enter historical percentile windows;
- [ ] missing metrics follow the existing reweighting/coverage rules;
- [ ] base-weight coverage is emitted for every week;
- [ ] raw artifact/source hash provenance exists where applicable;
- [ ] validation catches duplicate dates, unit drift, impossible revisions and release-date regressions.

---

## 19. V1 conclusion

The research goal remains “2005–present”, but the correct interpretation is now:

> **A point-in-time historical replay with explicit coverage eras, not a fictional full-coverage series.**

The most defensible model history will likely have:

- **2005–2014:** legacy partial evidence, valuable for cycle research but lower comparability;
- **2014–2018:** transition toward modern capital-flow and investor infrastructure;
- **2019–present:** preferred modern-regime validation window;
- **2021-11-15 onward:** all-A aggregation additionally includes BSE under a new market-scope version.

A historical temperature is never interpreted without its `BaseWeightCoverage`, source-quality tier and formula/source-definition versions.

The next Stage 4.1 task is therefore not parameter optimization. It is to execute the P0 source probes and construct the first immutable point-in-time observation catalog.