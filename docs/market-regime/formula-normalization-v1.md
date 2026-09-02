# A股牛熊温度计数学定义与标准化方案 V1

> Stage 4.1 research contract  
> Date: 2026-09-02  
> Status: **BACKTEST CANDIDATE V1 — not production-admitted**

## 1. Objective

This document turns the Stage 4.1 Metric Registry into a calculable research model while explicitly preventing look-ahead, scale-drift and silent missing-data errors.

The V1 objective is not to optimize for the highest historical return. It is to create a simple, explainable, reproducible baseline that can survive historical replay and then be challenged by alternative formulas.

---

## 2. Frozen top-level structure

The inherited base-module weights remain the seed architecture:

| Module | Seed weight |
| --- | ---: |
| Capital Flow | 35% |
| Market Sentiment | 25% |
| Valuation | 20% |
| Stock Supply Pressure | 10% |
| Macro Liquidity | 10% |

Base score:

```text
BaseTemperature_t =
    0.35 * FlowScore_t
  + 0.25 * SentimentScore_t
  + 0.20 * ValuationScore_t
  + 0.10 * SupplyScore_t
  + 0.10 * MacroLiquidityScore_t
```

Policy-cycle correction is applied after the base score:

```text
MarketTemperature_t = clip(BaseTemperature_t + PolicyAdjustment_t, 0, 100)
```

Profit Cycle and Structural Bubble Temperature remain separate classifiers / overlays and do not enter the base 100-point arithmetic in V1.

Reason: forcing them into the same weighted sum would double-count information and make interpretation harder.

---

## 3. General normalization framework

### 3.1 Why absolute values are prohibited

Absolute financing balance, turnover, IPO financing, M2 and other nominal series naturally grow with the economy and market size. Using absolute values would make newer years mechanically look “hotter”.

Every metric therefore must first be transformed into either:

- a ratio to a relevant stock / market size;
- a growth rate;
- a change / acceleration measure;
- or a market-defined valuation multiple.

Only then is it standardized to 0–100.

### 3.2 Point-in-time percentile

Baseline V1 normalization:

```text
PercentileScore_t(x; W) = 100 * empirical_percentile(
    x_t,
    observations available at or before t within trailing window W
)
```

No future data may enter the reference distribution.

For descending-direction signals:

```text
InversePercentileScore = 100 - PercentileScore
```

V1 does not use full-sample percentile ranks in backtests because that would introduce look-ahead.

### 3.3 Default trailing windows

| Data class | V1 baseline window | Reason |
| --- | --- | --- |
| Daily / weekly market-flow and sentiment | 5 years | enough observations while adapting to market-structure change |
| Monthly macro / participation / supply | 10 years | reduce seasonal/noisy monthly effects |
| Valuation | 10 years | valuation regimes need longer context |
| Quarterly Buffett indicator | 10 years | minimum meaningful cross-cycle reference |

During warm-up, use expanding history until the target window is available.

Minimum maturity flags:

| Frequency | Minimum usable history | Preferred full-maturity history |
| --- | ---: | ---: |
| Daily | 252 observations | 5 years |
| Weekly | 52 observations | 5 years |
| Monthly | 24 observations | 10 years |
| Quarterly | 12 observations | 10 years |

A score may be generated during minimum-history warm-up but must carry lower `historyMaturity` confidence.

---

# 4. Frozen metric definitions

## 4.1 Capital Flow

### 4.1.1 Financing leverage — `FLOW_MARGIN_BALANCE`

Raw absolute financing balance is not scored directly.

Primary ratio:

```text
MarginLeverageRatio_t =
    Total_A_Share_Financing_Balance_t
    / Total_A_Share_Negotiable_Market_Cap_t
```

Rationale: leverage must be interpreted relative to the tradable equity base, not nominal RMB amount.

Momentum:

```text
MarginMomentum_t = pct_change(MarginLeverageRatio, 20 trading days)
```

V1 seed score:

```text
MarginScore_t =
    0.70 * Pctl5Y(MarginLeverageRatio_t)
  + 0.30 * Pctl5Y(MarginMomentum_t)
```

Higher leverage / faster leverage build-up → higher temperature.

Historical caveat: margin financing does not exist for the whole 2005–present sample. Pre-availability values remain structurally missing; no synthetic backfill is allowed.

---

### 4.1.2 Equity ETF flow — `FLOW_EQUITY_ETF_NET_FLOW`

This definition becomes active only after the source probe is admitted.

Preferred transform:

```text
ETFNetFlowRatio_t =
    20D_Equity_ETF_Net_Subscription_Value_t
    / Equity_ETF_AUM_at_start_of_window_t
```

Score candidate:

```text
ETFFlowScore_t = Pctl5Y(ETFNetFlowRatio_t)
```

Do not substitute turnover for net subscriptions/redemptions.

---

### 4.1.3 Northbound flow — `FLOW_NORTHBOUND`

V1 preferred transform after exact HKEX field semantics are locked:

```text
NorthboundFlowRatio_t =
    20D_Northbound_Net_Flow_t
    / Total_A_Share_Negotiable_Market_Cap_t
```

Because the denominator is very large, Provider/backtest may compare an alternative normalization against Connect turnover:

```text
NorthboundFlowIntensity_t =
    20D_Northbound_Net_Flow_t
    / 20D_Northbound_Turnover_t
```

Primary V1 backtest candidate: market-cap-normalized ratio.

Score:

```text
NorthboundScore_t = Pctl5Y(NorthboundFlowRatio_t)
```

Historical caveat: structurally unavailable before Stock Connect.

---

### 4.1.4 Capital Flow module score

Neutral baseline before optimization:

```text
FlowScore_t = weighted_mean_of_available_metric_scores(
    MarginScore,
    ETFFlowScore,
    NorthboundScore,
    seed_internal_weights = equal
)
```

Equal internal weights are intentionally chosen as the first benchmark to reduce discretionary fitting.

No optimized internal weights are production-authorized before the full backtest.

---

## 4.2 Market Sentiment

### 4.2.1 Turnover heat — `SENT_A_SHARE_TURNOVER`

Absolute daily turnover is size-biased. V1 uses turnover intensity:

```text
TurnoverIntensity_t =
    5D_Average_A_Share_Turnover_Value_t
    / Total_A_Share_Negotiable_Market_Cap_t
```

Momentum:

```text
TurnoverMomentum_t =
    TurnoverIntensity_t / mean(TurnoverIntensity, previous 20 trading days) - 1
```

Seed score:

```text
TurnoverScore_t =
    0.75 * Pctl5Y(TurnoverIntensity_t)
  + 0.25 * Pctl5Y(TurnoverMomentum_t)
```

Higher turnover heat → higher market temperature.

This score measures heat, not expected return. High turnover can coexist with a healthy bull or a late-cycle bubble; interpretation comes from the total model and structural-bubble overlay.

---

### 4.2.2 New-investor intensity — `SENT_NEW_INVESTORS`

Once the current ChinaClear source contract is admitted:

```text
NewInvestorRate_m =
    New_Investors_m
    / Total_Investors_end_of_previous_month
```

Score:

```text
NewInvestorScore_m = Pctl10Y(NewInvestorRate_m)
```

Weekly runs carry forward the latest monthly score.

High retail-entry intensity → high temperature / late-cycle participation risk.

---

### 4.2.3 Sentiment module score

Seed internal weights:

```text
SentimentScore_t =
    0.70 * TurnoverScore_t
  + 0.30 * NewInvestorScore_t
```

If NewInvestorScore is not source-admitted, the module temporarily uses TurnoverScore alone and reports reduced metric coverage.

Reason for 70/30 seed: turnover is continuous and timely; new-account data is slow and auxiliary. This is a research seed, not a fitted final parameter.

---

## 4.3 Valuation

### 4.3.1 Primary market PE — `VAL_MARKET_PE_PERCENTILE`

V1 freezes the **CSI 300 rolling/TTM PE** as the primary valuation anchor.

Reason:

- CSI 300 has a continuous, representative large-cap benchmark from the 2004-12-31 base date;
- official CSI factsheets publish rolling PE;
- the current CSI All Share index is broader and includes SSE/SZSE/BSE, but its official factsheet can show PE/PB as unavailable, making it unsuitable as the sole V1 production valuation series.

Definition:

```text
PELevel_t = CSI300_TTM_PE_t
PEScore_t = Pctl10Y(PELevel_t)
```

Higher PE percentile → higher temperature.

Historical constituent changes are accepted as part of the official index methodology; do not reconstruct the CSI 300 using today’s constituents.

---

### 4.3.2 China Buffett indicator — `VAL_BUFFETT_INDICATOR_CN`

V1 definition is now frozen as:

```text
ChinaBuffett_t =
    Total_Market_Capitalization_of_All_A_Shares_t
    / TTM_Nominal_GDP_latest_available_vintage_t
```

Numerator:

- total market capitalization, **not free-float / negotiable market cap**;
- SSE + SZSE + BSE A-share listed companies existing at that historical date;
- BSE enters naturally only after its existence;
- overseas-listed shares are excluded unless they are A-share listed securities in the domestic market-cap statistics.

Denominator:

```text
TTM_Nominal_GDP_q = sum(latest available nominal GDP for the latest 4 quarters)
```

At each weekly model run, use the most recently released GDP vintage that was available at that time.

When NBS revises historical GDP, preserve both vintages for reproducibility.

Score:

```text
BuffettScore_t = Pctl10Y(ChinaBuffett_t)
```

Higher ratio → higher temperature.

Why total rather than negotiable market cap: the Buffett concept compares the economy with the total equity-market capitalization claim, not only the currently tradable float.

---

### 4.3.3 Valuation module score

Seed weights:

```text
ValuationScore_t =
    0.70 * PEScore_t
  + 0.30 * BuffettScore_t
```

Reason: PE is more directly linked to listed-company earnings valuation and updates frequently; the Buffett indicator is a slower macro cross-check.

Backtest challenge set must include:

- 50/50;
- PE only;
- adding PB / dividend-bond spread later if official history is source-admitted.

No alternative replaces the V1 seed without backtest evidence.

---

## 4.4 Stock Supply Pressure

V1 replaces separate arbitrary weights with one economically consistent net-supply flow.

Monthly components:

```text
GrossEquitySupply_m =
      IPO_Financing_m
    + Equity_Refinancing_m
    + Executed_Important_Shareholder_Reduction_m
```

Capital-return offset:

```text
BuybackOffset_m =
    Executed_Cash_Buyback_for_Cancellation_or_permanent_equity_reduction_m
```

V1 net supply:

```text
NetEquitySupply_m = GrossEquitySupply_m - BuybackOffset_m
```

Normalize by market size:

```text
NetSupplyPressure_m =
    rolling_3M_sum(NetEquitySupply)
    / Total_A_Share_Market_Cap_end_of_previous_month
```

Score:

```text
SupplyScore_m = Pctl10Y(NetSupplyPressure_m)
```

Higher net equity supply → higher temperature/risk pressure because more equity claims must be absorbed by capital.

Important accounting rules:

1. announced reduction plans do not count until executed;
2. announced buyback ceilings do not count until executed;
3. employee incentive inventory or later-resold treasury shares do not receive the same offset as cancellation/permanent equity reduction;
4. Provider must prevent duplicated announcement aggregation.

Alternative backtest: use 1M and 6M rolling windows against the 3M baseline.

---

## 4.5 Macro Liquidity

### 4.5.1 M2 signal — `MACRO_M2`

Absolute M2 is prohibited.

Primary series:

```text
M2Growth_m = official M2 YoY growth
```

Momentum:

```text
M2Acceleration_m = M2Growth_m - M2Growth_(m-3)
```

Seed score:

```text
M2Score_m =
    0.70 * Pctl10Y(M2Growth_m)
  + 0.30 * Pctl10Y(M2Acceleration_m)
```

Higher monetary growth / acceleration → higher liquidity temperature.

Because PBOC statistical scope can change, use official comparable series when supplied and version methodology changes.

---

### 4.5.2 Social financing signal — `MACRO_SOCIAL_FINANCING`

V1 primary definition is frozen to **AFRE stock YoY**, not raw monthly flow.

Reason: PBOC defines AFRE flow as financing received during a period and AFRE stock as outstanding financing at period-end; PBOC historical material explicitly notes that flow growth is more volatile while stock growth is more suitable for comparative analysis.

Primary series:

```text
AFREStockGrowth_m = official AFRE stock YoY growth on comparable basis
```

Momentum:

```text
AFREAcceleration_m = AFREStockGrowth_m - AFREStockGrowth_(m-3)
```

Seed score:

```text
AFREScore_m =
    0.70 * Pctl10Y(AFREStockGrowth_m)
  + 0.30 * Pctl10Y(AFREAcceleration_m)
```

Credit Impulse is retained as a challenger, not the V1 primary formula:

```text
CreditImpulse_candidate =
    change in rolling financing flow relative to nominal GDP
```

Its exact definition must be standardized before comparison.

---

### 4.5.3 Macro liquidity module score

Seed weights:

```text
MacroLiquidityScore_t =
    0.50 * M2Score_latest
  + 0.50 * AFREScore_latest
```

Monthly values are carried forward across weekly runs until the next official release.

---

# 5. Policy-cycle correction

Policy is not allowed to become an unbounded discretionary narrative factor.

V1 freezes the aggregate architecture:

```text
PolicyAdjustment_t = clip(
    sum(EventImpact_i * Decay_i(t)),
    -5,
    +5
)
```

Therefore policy can move the final 0–100 temperature by no more than 5 points in either direction.

Each event must later be classified by a separate versioned taxonomy containing:

- authority;
- domain;
- easing / tightening direction;
- announcement time;
- effective time;
- expiry / reversal time;
- impact tier;
- decay half-life;
- evidence link.

V1 does **not** authorize free-text analyst judgment to directly enter `EventImpact`.

The next policy-specific research task should establish deterministic impact tiers and decay rules.

---

# 6. Profit Cycle classifier

Profit Cycle remains outside the 100-point base score.

Primary observable set:

1. industrial-enterprise profit cycle;
2. listed-company earnings breadth after a market-wide Provider exists.

Industrial-profit candidate:

```text
IndustrialProfitMomentum_m =
    0.60 * percentile(single_month_profit_YoY)
  + 0.40 * percentile(3M_change_in_single_month_profit_YoY)
```

Do not use cumulative YTD growth alone because the cumulative base mechanically smooths turning points.

Future listed-company breadth candidate:

```text
PositiveEarningsBreadth_q =
    companies_with_positive_single_quarter_net_profit_YoY
    / eligible_reporting_universe
```

Potential classifier states for backtest:

- `EARNINGS_LED_BULL`
- `LIQUIDITY_LED_BULL`
- `MIXED_BULL`
- `EARNINGS_DOWNTURN`
- `REPAIR`
- `UNKNOWN`

Exact thresholds are not yet frozen.

---

# 7. Structural Bubble Temperature

V1 makes an important architectural decision:

**Structural Bubble Temperature is a separate 0–100 output and does not directly alter the broad MarketTemperature before its own backtest is complete.**

Reason: a sector bubble can coexist with a neutral broad market. Forcing it into the broad score would destroy interpretability.

Future candidate inputs:

- sector/style PE or PB percentiles;
- turnover concentration;
- return concentration;
- cross-sectional dispersion;
- limit-up / extreme momentum concentration;
- sector ETF-flow concentration;
- sector leverage/financing concentration where source-ready.

The Portfolio / Allocation layer may later apply stricter risk guidance when StructuralBubbleTemperature is high even if MarketTemperature is moderate.

---

# 8. Missing-data and historical-era rules

This model contains indicators that did not exist in 2005. V1 explicitly prohibits fabricating pre-history.

## 8.1 Metric availability

A metric may be:

- `available`;
- `carried_forward_valid`;
- `structurally_unavailable` (source/market mechanism did not yet exist);
- `temporarily_missing`;
- `stale`;
- `source_failed`.

## 8.2 Within-module reweighting

If one metric in a module is structurally unavailable or stale:

```text
ModuleScore = sum(w_i * score_i for eligible i) / sum(w_i for eligible i)
```

but only if at least 50% of the module’s seed internal weight remains eligible.

Otherwise the entire module becomes unavailable.

## 8.3 Cross-module reweighting

If a whole base module is unavailable:

```text
EffectiveBaseTemperature =
    sum(BaseModuleWeight_j * ModuleScore_j for eligible j)
    / sum(BaseModuleWeight_j for eligible j)
```

The system must also emit:

```text
BaseWeightCoverage = sum(original weights of eligible base modules)
```

V1 model output validity:

| Base-weight coverage | Output status |
| ---: | --- |
| >= 80% | normal |
| 65%–80% | reduced confidence |
| 50%–65% | research-only / low confidence |
| < 50% | no temperature; `INSUFFICIENT_COVERAGE` |

This allows 2005–present research without pretending early years have modern Stock Connect / margin / ETF-flow data.

## 8.4 Current-source failure vs structural history

A current Provider outage must not be treated the same as “this metric did not exist historically”.

- If the latest carried-forward observation remains inside its stale policy, reuse it and flag `isNew=false`.
- If it exceeds stale policy, metric becomes unavailable for that run.
- Never convert a failure to zero.

---

# 9. Confidence output

Temperature and confidence are separate.

Every weekly result must eventually provide:

```text
MarketTemperature
BaseWeightCoverage
MetricCoverage
SourceQuality
HistoryMaturity
InputVintageManifestId
FormulaVersion
```

V1 recommended confidence display:

```text
ConfidenceScore = 100 *
    BaseWeightCoverage
    * MetricCoverageFactor
    * SourceQualityFactor
    * HistoryMaturityFactor
```

Exact factor calibration is UI/research metadata and must not modify the temperature itself.

---

# 10. Backtest candidate matrix

To reduce overfitting, the first historical replay must test a small pre-declared matrix rather than thousands of arbitrary combinations.

## Candidate A — V1 baseline

- legacy module weights 35/25/20/10/10;
- formulas in this document;
- equal weights within Capital Flow;
- Sentiment 70/30;
- Valuation 70/30;
- Macro 50/50;
- 5Y market percentiles, 10Y macro/valuation/supply percentiles;
- policy adjustment disabled first, then enabled separately;
- structural bubble disabled from broad score.

## Candidate B — equal module weights

- 20/20/20/20/20;
- all other definitions unchanged.

Purpose: test whether the inherited high 35% capital-flow weight is actually justified.

## Candidate C — slower valuation/macro model

- 30 Flow / 20 Sentiment / 25 Valuation / 10 Supply / 15 Macro;
- definitions unchanged.

Purpose: see whether the long-account use case benefits from lower short-term flow sensitivity.

## Candidate D — AFRE Credit Impulse challenger

Same as Candidate A except AFRE stock growth is replaced by a pre-defined Credit Impulse series.

No optimization beyond this matrix should be attempted until these transparent baselines are understood.

---

# 11. Historical validation targets

The backtest is not judged only by portfolio return.

Required diagnostics:

1. temperature behavior around 2005–2007 bull market;
2. 2008 collapse response;
3. 2014–2015 leverage/liquidity bull and bubble warning;
4. 2018 bear market;
5. 2020–2021 structural growth bubble;
6. 2024–present policy/liquidity cycle;
7. false overheating signals during healthy earnings expansions;
8. false cold signals during policy-driven market repair;
9. stability week-to-week for a long-horizon allocation tool;
10. sensitivity to one missing data source;
11. model-era / coverage differences before margin trading and Stock Connect existed.

Recommended statistical outputs:

- forward 3M / 6M / 12M broad-index return by temperature bucket;
- forward drawdown by temperature bucket;
- hit rate for extreme-temperature risk warnings;
- persistence / transition matrix of temperature regimes;
- correlation and redundancy between metric scores;
- contribution decomposition;
- coverage/confidence by historical period.

The model should not be optimized to predict the exact market top or bottom.

---

# 12. Decisions frozen by V1

The following definitions may now be treated as the Stage 4.1 baseline unless backtest evidence forces a versioned change:

1. top-level legacy module weights remain the first candidate, not final truth;
2. standardized scores use point-in-time trailing percentiles, never full-sample ranks;
3. financing balance is normalized by negotiable market cap;
4. turnover is normalized by negotiable market cap;
5. CSI 300 TTM PE is the primary V1 market PE anchor;
6. China Buffett indicator = total A-share market cap / TTM nominal GDP;
7. stock supply pressure = 3M net equity supply / total market cap;
8. M2 uses YoY growth plus 3M acceleration;
9. AFRE uses stock YoY growth plus 3M acceleration as the primary V1 signal;
10. raw monthly AFRE flow is not the primary score;
11. policy correction is capped at ±5 points;
12. Profit Cycle does not enter the base 100-point score;
13. Structural Bubble Temperature remains a separate output;
14. structurally unavailable historical metrics are not synthetically backfilled;
15. every result carries coverage/confidence metadata.

---

# 13. Next Stage 4.1 task

The next work item is **Historical Data Availability & Backtest Dataset Design V1**:

- determine the earliest reliable history for every frozen raw/transformed series;
- identify source-definition breaks;
- determine which official histories can be downloaded automatically;
- design the point-in-time vintage storage schema;
- create a backtest dataset manifest;
- only then implement historical ingestion and run Candidate A–D.
