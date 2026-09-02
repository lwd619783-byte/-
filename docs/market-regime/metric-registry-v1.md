# A股牛熊温度计 / Market Regime Metric Registry V1

> Stage 4.1 research contract  
> Baseline date: 2026-09-02  
> Code baseline: `main` @ `8a1d4c110b5eb8a248701be6cd84470d1fa0d7f7`  
> Status: **MODEL CONTRACT DRAFT — no production score is authorized yet**

## 1. Purpose

This registry converts the previously agreed A-share Bull/Bear Thermometer research model into a formal, auditable data contract for the Investment Research Dashboard.

The thermometer is **not a short-term trading signal**. It is a long-horizon market-cycle and risk-exposure control system. The final product is expected to output:

- 0–100 market temperature;
- market-cycle stage;
- risk level;
- major positive contributors;
- major risk contributors;
- long-term account allocation guidance;
- later: historical replay and explanation traces.

The weekly model run must not imply that all underlying data update weekly. Each metric keeps its own native frequency, release calendar, lag, revision behavior and stale rule.

---

## 2. Frozen legacy design carried forward

The prior model documentation established the following base architecture:

| Base module | Legacy seed weight | Role |
| --- | ---: | --- |
| Capital flow | 35% | Observe leveraged/incremental capital entering or leaving equities |
| Market sentiment | 25% | Observe trading heat and retail participation |
| Valuation | 20% | Observe absolute and historical market valuation temperature |
| Stock supply pressure | 10% | Observe equity supply vs capital-return pressure |
| Macro liquidity | 10% | Observe money and credit conditions |

Additional non-base modules:

| Overlay / classifier | Base weight | Role |
| --- | ---: | --- |
| Policy-cycle correction | none | A-share-specific policy regime correction |
| Profit cycle | none | Distinguish liquidity bull from earnings bull and assess bull-market quality |
| Structural bubble temperature | none | Detect industry/theme overheating hidden by broad-index averages |

**Important:** 35/25/20/10/10 are legacy seed weights, not production-approved weights. They remain frozen as a reproducible starting point until the 2005–present historical backtest is complete. Individual metric weights inside each module are intentionally `TBD` in V1.

---

## 3. Temperature bands carried forward

| Temperature | Stage label |
| ---: | --- |
| 0–20 | Extreme freeze / 极度冰点 |
| 20–40 | Bear-market repair / 熊市修复 |
| 40–60 | Healthy bull / 健康牛市 |
| 60–75 | Mid-to-late bull / 牛市中后期 |
| 75–90 | Overheated / 过热区域 |
| 90–100 | Bubble-risk zone / 泡沫风险区域 |

These labels are output semantics only. Thresholds remain subject to backtest validation; no threshold may be silently changed after production admission.

---

## 4. Registry status vocabulary

- `SOURCE_READY`: official source and native frequency are verified; a Provider can be designed next.
- `SOURCE_READY_DERIVED`: component official sources are verified, but the published metric is derived by our model.
- `PROBE_REQUIRED`: concept retained, but a stable machine-readable source contract is not yet proven.
- `DEFINITION_REQUIRED`: source data exists, but formula / accounting scope must be finalized before implementation.
- `NOT_READY`: current dashboard data coverage is structurally insufficient for this market-level metric.
- `DERIVED_TBD`: derived overlay accepted conceptually, but dependency set / formula / cap needs research and backtest.

---

## 5. Required observation contract

Every raw metric observation must eventually persist at least:

```text
metricId
value
unit
valueDate             # date/period the value describes
releaseDateTime       # when the source made it public, if available
fetchedAt             # ingestion time
sourceId
sourceUrl
sourceVersion         # source/schema/provider version
nativeFrequency
isNewSincePreviousRun
revisionSequence
supersedesObservationId
staleState
qualityStatus
rawArtifactHash       # when an artifact is retained
transformVersion      # when a value is derived/transformed
```

Rules:

1. `valueDate`, `releaseDateTime` and `fetchedAt` are different concepts and must never be collapsed.
2. A monthly or quarterly observation remains valid during weeks with no new release; it must be carried forward with `isNewSincePreviousRun=false`.
3. Missing data is never coerced to zero.
4. Revisions create new observation versions; historical values are not silently overwritten.
5. The model run stores the exact metric versions used so a historical temperature can be reproduced.
6. Core scoring must prefer official / regulator / exchange / index-company sources. A third-party terminal may be a fallback only after the source contract documents its role.

---

# 6. Raw Metric Registry

## 6.1 Capital Flow — legacy module weight 35%

### `FLOW_MARGIN_BALANCE` — 融资余额

| Field | Contract |
| --- | --- |
| Role | Leveraged domestic equity capital |
| Native frequency | Trading day |
| Model refresh | Weekly aggregation / latest trading-day snapshot |
| Primary source | Shanghai Stock Exchange + Shenzhen Stock Exchange official margin-trading statistics; add BSE only if its financing data becomes material to the chosen whole-market scope |
| Verified source example | `https://www.sse.com.cn/market/othersdata/margin/sum/` |
| Release lag | Previous trading-day market totals are published before the next trading-day open under SSE disclosure rules |
| Proposed transform | level + weekly change + historical percentile; exact blend TBD |
| Temperature direction | Higher / accelerating leverage normally raises temperature; extreme deleveraging lowers temperature |
| Stale candidate | >3 trading days behind latest eligible exchange date |
| Revision policy | Preserve corrected exchange records if source changes historical values |
| Status | `SOURCE_READY` |

Implementation note: Shanghai and Shenzhen totals must be aggregated with identical date and unit semantics. Do not infer whole-market margin balance from only one exchange.

### `FLOW_EQUITY_ETF_NET_FLOW` — 权益 ETF 资金流

| Field | Contract |
| --- | --- |
| Role | Incremental institutional / retail fund flow into broad equity exposure |
| Native frequency | Daily where underlying shares / subscriptions are available; model aggregation weekly |
| Preferred source order | Exchange / fund-company official ETF data → licensed financial terminal |
| Old-model source assumption | Fund-company announcements / trading data |
| Required definition | Define equity ETF universe; separate broad-based, sector/theme, cross-border and leveraged/other products |
| Proposed transform | Weekly net flow / equity ETF AUM and historical percentile |
| Status | `PROBE_REQUIRED` |

Reason: a reliable **aggregate net-flow** series is not equivalent to ETF turnover. V1 must not substitute turnover for subscriptions/redemptions. A source probe must prove shares outstanding / creation-redemption semantics and historical continuity before this metric scores the model.

### `FLOW_NORTHBOUND` — 北向资金流向

| Field | Contract |
| --- | --- |
| Role | Cross-border capital-flow correction / foreign participation |
| Native frequency | Trading day |
| Model refresh | Weekly aggregation |
| Primary source | HKEX Stock Connect Historical Daily statistics |
| Verified source | `https://www.hkex.com.hk/Mutual-Market/Stock-Connect/Statistics/Historical-Daily?sc_lang=en` |
| Historical monthly source | `https://www.hkex.com.hk/Mutual-Market/Stock-Connect/Statistics/Historical-Monthly?sc_lang=en` |
| Proposed transform | Weekly flow / turnover / historical distribution; exact definition must follow currently published HKEX fields |
| Stale candidate | >3 eligible Stock Connect trading days |
| Status | `SOURCE_READY` |

Guardrail: do not rely on a discontinued intraday field or an unofficial reconstruction. Provider tests must lock the exact HKEX field semantics used by the model.

---

## 6.2 Market Sentiment — legacy module weight 25%

### `SENT_A_SHARE_TURNOVER` — A股成交额 / 市场交易热度

| Field | Contract |
| --- | --- |
| Role | Broad trading heat / participation intensity |
| Native frequency | Trading day |
| Model refresh | Weekly: latest, 5-day mean and change |
| Primary source | SSE + SZSE + BSE official market statistics, with a fixed A-share inclusion rule |
| Verified SSE source | `https://www.sse.com.cn/market/stockdata/overview/day/` |
| Proposed transform | 5-day average turnover, turnover/GDP or turnover/free-float normalization candidates, historical percentile |
| Stale candidate | >3 trading days |
| Status | `SOURCE_READY` |

Guardrail: “成交额高” alone is not always bearish. It represents heat; directionality must be learned with the final normalization and interaction rules rather than hard-coded from one observation.

### `SENT_NEW_INVESTORS` — 新增投资者 / 新增开户

| Field | Contract |
| --- | --- |
| Role | Retail participation / late-cycle enthusiasm auxiliary signal |
| Native frequency | Monthly in the legacy design |
| Preferred source | China Securities Depository and Clearing Corporation (ChinaClear) official investor statistics |
| Current verification | Historical official monthly/annual series is verifiable; a stable current 2026 monthly machine-readable endpoint has not yet been proven in this audit |
| Proposed transform | monthly new investors, MoM/YoY and historical percentile |
| Temperature direction | Extremely high participation is a potential late-cycle / top-risk signal, not a simple bullish score |
| Status | `PROBE_REQUIRED` |

Guardrail: do not replace ChinaClear investor counts with app-download, social-media or brokerage marketing estimates.

---

## 6.3 Valuation — legacy module weight 20%

### `VAL_MARKET_PE_PERCENTILE` — 市场 PE 历史百分位

| Field | Contract |
| --- | --- |
| Role | Long-horizon broad-market valuation temperature |
| Native frequency | Daily/periodic source; model refresh weekly |
| Preferred benchmark | CSI broad-market / CSI 300 plus optional all-A-share benchmark; benchmark set must be fixed before backtest |
| Primary source family | China Securities Index (CSI) index valuation / factsheet products |
| Verified source root | `https://www.csindex.com.cn/` |
| Proposed transform | rolling PE percentile over a fixed historical window; exact window TBD |
| Temperature direction | Higher valuation percentile → higher temperature / lower forward margin of safety |
| Status | `PROBE_REQUIRED` |

Reason: current CSI factsheets expose PE/PB snapshots, but the historical machine-readable valuation series and licensing/automation path must be proven before a production Provider is authorized.

### `VAL_BUFFETT_INDICATOR_CN` — 中国版巴菲特指标

| Field | Contract |
| --- | --- |
| Role | Macro valuation cross-check |
| Formula family | A-share total market capitalization / nominal GDP |
| Numerator native frequency | Trading day / month, depending chosen official market-cap source |
| Denominator native frequency | Quarterly nominal GDP |
| Official GDP source | National Bureau of Statistics (NBS) |
| Verified GDP behavior | Quarterly; preliminary quarterly GDP generally released around 15 days after quarter-end and may be revised |
| Compute frequency | Weekly using latest approved GDP vintage, but denominator changes only when new/revised GDP is released |
| Status | `DEFINITION_REQUIRED` |

Definition decisions required before implementation:

1. numerator = SSE + SZSE + BSE A-share total market cap, or another fixed all-A-share universe;
2. denominator = trailing-four-quarter nominal GDP vs annualized latest quarter;
3. treatment of financial-sector market cap and overseas listings;
4. historical reconstruction methodology when market structure changes;
5. versioning when NBS revises GDP history.

No score may be generated until these choices are frozen.

---

## 6.4 Stock Supply Pressure — legacy module weight 10%

The old single “IPO amount” metric is formally replaced by a composite **Stock Supply Pressure** module.

### `SUPPLY_IPO_FINANCING` — IPO 融资额

| Field | Contract |
| --- | --- |
| Native frequency | Monthly model observation |
| Primary source | CSRC Securities Market Monthly Report / exchange issuance statistics |
| Verified source index | `https://www.csrc.gov.cn/csrc/c100120/common_list.shtml` |
| Proposed transform | monthly amount / market capitalization, rolling percentile |
| Status | `SOURCE_READY` for source family; field extraction still needs Provider probe |

### `SUPPLY_REFINANCING` — 再融资规模

| Field | Contract |
| --- | --- |
| Native frequency | Monthly model observation |
| Primary source | CSRC / exchange official issuance statistics |
| Proposed transform | monthly equity-related refinancing / market cap, rolling percentile |
| Status | `SOURCE_READY` for source family; accounting-scope probe required |

### `SUPPLY_REDUCTION` — 重要股东减持压力

| Field | Contract |
| --- | --- |
| Native frequency | Event-driven; weekly/monthly aggregation |
| Preferred source | SSE / SZSE / BSE official disclosure announcements |
| Required definition | actual completed reduction amount vs announced maximum; large-holder scope; double-count handling |
| Proposed transform | executed reduction amount / free-float market cap |
| Status | `PROBE_REQUIRED` |

Guardrail: announced plans and executed reductions must not be mixed.

### `SUPPLY_BUYBACK` — 上市公司回购支撑

| Field | Contract |
| --- | --- |
| Native frequency | Event-driven; weekly/monthly aggregation |
| Preferred source | Exchange official buyback disclosures |
| Required definition | distinguish proposed ceiling, actual executed amount, cancellation-oriented buyback and incentive inventory |
| Temperature interaction | Executed/cancellation buybacks offset supply pressure; do not treat proposed maximum as cash actually deployed |
| Status | `PROBE_REQUIRED` |

### `SUPPLY_PRESSURE_COMPOSITE` — 股票供给压力综合指标

Dependencies: `SUPPLY_IPO_FINANCING`, `SUPPLY_REFINANCING`, `SUPPLY_REDUCTION`, `SUPPLY_BUYBACK`.

Formula is intentionally `TBD`. V1 accepts the dependency graph but not a weight formula. The backtest must determine whether flows are normalized by market cap, turnover, free float, or a blended denominator.

Status: `DERIVED_TBD`.

---

## 6.5 Macro Liquidity — legacy module weight 10%

### `MACRO_M2` — M2

| Field | Contract |
| --- | --- |
| Role | Broad monetary liquidity condition |
| Native frequency | Monthly |
| Primary source | People’s Bank of China (PBOC), Money Supply / Money and Banking Statistics |
| Verified source | `https://www.pbc.gov.cn/diaochatongjisi/116219/116319/2026ntjsj/hbtjgl/index.html` |
| Release calendar | Use PBOC Advance Release Calendar where available |
| Proposed transform | YoY growth, momentum vs recent trend; exact normalization TBD |
| Stale candidate | expected-release miss + grace period, not “7 days since last value” |
| Revision policy | Preserve published vintage and subsequent revisions/statistical-scope changes |
| Status | `SOURCE_READY` |

### `MACRO_SOCIAL_FINANCING` — 社会融资规模

| Field | Contract |
| --- | --- |
| Role | Credit-cycle / credit impulse condition |
| Native frequency | Monthly |
| Primary source | PBOC Aggregate Financing to the Real Economy (AFRE) |
| Verified source | `https://www.pbc.gov.cn/diaochatongjisi/116219/116319/2026ntjsj/shrzgm/index.html` |
| Available official series | Flow and Stock tables |
| Definition decision | stock YoY, monthly flow surprise, credit impulse, or blended signal; V1 does not silently pick one |
| Revision policy | Version methodological/statistical-scope revisions |
| Status | `DEFINITION_REQUIRED` |

Recommendation for the next research task: compare `AFRE stock YoY` vs `credit impulse` in historical backtest rather than using raw monthly flow alone.

---

# 7. Quality / Overlay Registry

## 7.1 Profit Cycle — bull-market quality classifier

### `PROFIT_INDUSTRIAL` — 规模以上工业企业利润

| Field | Contract |
| --- | --- |
| Native frequency | Monthly survey; January data is not separately reported |
| Primary source | National Bureau of Statistics |
| Verified release behavior | NBS industrial economic efficiency report is scheduled around the 27th; monthly survey with January exempt |
| Verified source example | `https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260827_1965126.html` |
| Proposed transform | cumulative YoY + single-month YoY + acceleration/deceleration; formula TBD |
| Revision policy | Keep revised historical official values as a new vintage |
| Status | `SOURCE_READY` |

### `PROFIT_LISTED_BREADTH` — 上市公司盈利扩散

| Field | Contract |
| --- | --- |
| Native frequency | Quarterly / reporting-season event stream |
| Required universe | Whole A-share market or a frozen representative benchmark universe |
| Candidate measures | share of companies with positive profit growth; earnings revision breadth; ROE/profit-margin breadth |
| Current dashboard coverage | Existing A-share financial Provider covers only the 56-company research pool |
| Status | `NOT_READY` for whole-market regime scoring |

Guardrail: the existing 56-company research pool must not be mislabeled as “A-share earnings breadth”. A market-wide or benchmark-consistent earnings Provider is required.

### `PROFIT_CYCLE_CLASSIFIER`

Dependencies: `PROFIT_INDUSTRIAL` + `PROFIT_LISTED_BREADTH` and later optional earnings-expectation breadth.

Purpose: label a bull phase as liquidity-led, earnings-led, mixed, weakening-earnings, etc. It is a classifier/quality overlay, not part of the original 100% weighted base score.

Status: `DERIVED_TBD`.

---

## 7.2 Policy-Cycle Correction

### `POLICY_CYCLE_CORRECTION`

| Field | Contract |
| --- | --- |
| Native frequency | Event-driven |
| Source priority | State Council / PBOC / CSRC / NDRC / Ministry of Finance / exchanges and other competent official agencies |
| Purpose | Capture A-share-specific policy easing/tightening that may not yet appear in slow macro data |
| Input form | Structured policy events with release time, authority, policy domain, direction, magnitude/evidence grade |
| Score cap | TBD; must be capped so narrative policy tagging cannot dominate the quantitative base score |
| Status | `DERIVED_TBD` |

Rules:

1. No media interpretation enters the correction factor as a core event unless it traces to an official primary source.
2. The event must distinguish announcement, implementation and expiry/effective dates.
3. A policy event must have an explicit decay rule before production.
4. Every policy correction must be explainable by event IDs used in that model run.

---

## 7.3 Structural Bubble Temperature

### `STRUCTURAL_BUBBLE_TEMPERATURE`

Purpose: detect severe theme/industry overheating even when the broad index temperature is moderate.

Candidate dependencies for research, not yet frozen:

- industry / style valuation percentiles;
- turnover concentration in top-performing sectors;
- breadth vs index return divergence;
- cross-sectional return dispersion;
- limit-up / extreme momentum concentration;
- theme ETF flow concentration;
- sector-level financing balance / leverage where available.

Status: `DERIVED_TBD`.

Guardrail: this overlay must not be approximated by manually labeling a popular sector “bubble”. It needs a reproducible cross-sectional formula and historical replay.

---

# 8. Weekly Runtime Semantics

The model remains a **weekly** decision-support system.

Default run process:

1. Start a new weekly run (legacy operating rule: Monday; if the market or source has not produced new data, use the latest eligible observation).
2. Refresh all daily/trading-day source candidates available since the previous run.
3. Check every monthly / quarterly source release calendar.
4. If no new monthly/quarterly release exists, carry forward the latest valid observation and set `isNewSincePreviousRun=false`.
5. If an expected release is missing beyond its metric-specific grace period, mark the metric `stale` / `source_unavailable`; do not replace it with zero.
6. Resolve revisions as new observation versions.
7. Freeze an input manifest for the model run.
8. Only then calculate module scores and final temperature after the scoring formula has been admitted.

This separates three cadences:

- **source cadence**: when the world publishes a new observation;
- **ingestion cadence**: when our Provider checks / fetches it;
- **model cadence**: when the Bull/Bear Thermometer produces a weekly output.

---

# 9. Release / Stale Policy V1

Staleness must be calendar-aware rather than a universal elapsed-time threshold.

| Metric class | Native frequency | V1 stale principle |
| --- | --- | --- |
| Exchange trading data | trading day | stale if materially behind the latest eligible trading date (candidate: >3 trading days) |
| Weekly aggregate from daily data | weekly model output | stale if the required daily observations are incomplete beyond the allowed market-holiday rule |
| Monthly official macro | monthly | stale only after the official expected release date + metric-specific grace period |
| Quarterly GDP / financial | quarterly | stale only after statutory / official release window + grace period |
| Event-driven disclosures | event-driven | freshness is based on ingestion coverage / last successful scan, not on “no event this week” |
| Derived metrics | dependency-driven | stale when any required dependency is stale beyond the formula’s allowed carry-forward policy |

Exact grace periods are Stage 4.1 follow-up parameters and must be validated against actual official release histories.

---

# 10. Source-readiness Summary

| ID | Metric | Native frequency | Registry status |
| --- | --- | --- | --- |
| FLOW_MARGIN_BALANCE | 融资余额 | daily | SOURCE_READY |
| FLOW_EQUITY_ETF_NET_FLOW | 权益 ETF 资金流 | daily/weekly aggregate | PROBE_REQUIRED |
| FLOW_NORTHBOUND | 北向资金 | daily | SOURCE_READY |
| SENT_A_SHARE_TURNOVER | A股成交额 | daily | SOURCE_READY |
| SENT_NEW_INVESTORS | 新增投资者 | monthly | PROBE_REQUIRED |
| VAL_MARKET_PE_PERCENTILE | 市场 PE 百分位 | weekly compute | PROBE_REQUIRED |
| VAL_BUFFETT_INDICATOR_CN | 中国版巴菲特指标 | weekly compute / quarterly GDP | DEFINITION_REQUIRED |
| SUPPLY_IPO_FINANCING | IPO 融资 | monthly | SOURCE_READY (field probe) |
| SUPPLY_REFINANCING | 再融资 | monthly | SOURCE_READY (scope probe) |
| SUPPLY_REDUCTION | 重要股东减持 | event → week/month | PROBE_REQUIRED |
| SUPPLY_BUYBACK | 回购 | event → week/month | PROBE_REQUIRED |
| MACRO_M2 | M2 | monthly | SOURCE_READY |
| MACRO_SOCIAL_FINANCING | 社融 | monthly | DEFINITION_REQUIRED |
| PROFIT_INDUSTRIAL | 工业企业利润 | monthly (Jan exempt) | SOURCE_READY |
| PROFIT_LISTED_BREADTH | 上市公司盈利扩散 | quarterly/event | NOT_READY |
| POLICY_CYCLE_CORRECTION | 政策周期修正 | event-driven | DERIVED_TBD |
| STRUCTURAL_BUBBLE_TEMPERATURE | 结构性泡沫温度 | dependency-driven | DERIVED_TBD |

---

# 11. What V1 deliberately does not decide

The following are **not** authorized by this registry:

- final individual metric weights;
- final normalization functions;
- exact historical percentile windows;
- the Chinese Buffett-indicator accounting definition;
- the social-financing transformation;
- ETF flow source/provider;
- shareholder reduction / buyback aggregation formula;
- policy correction magnitude/decay;
- structural bubble formula;
- final profit-cycle classifier;
- final 0–100 production temperature.

Those decisions belong to the next Stage 4.1 research and backtest tasks.

---

# 12. Backtest admission requirement

Before the thermometer may become a production feature:

1. obtain/reconstruct historical metric vintages as far back as reasonably possible, target 2005–present;
2. explicitly cover 2005–2007, 2008, 2014–2015, 2018, and 2024–present cycles;
3. prevent look-ahead by using release dates, not only value dates;
4. document source/definition breaks;
5. compare alternative normalization and weight sets;
6. measure whether outputs are stable enough for long-horizon risk control rather than short-term timing;
7. lock a formula version and store it with every generated run.

Any future indicator, source, definition or weight change requires a registry version update and historical revalidation.