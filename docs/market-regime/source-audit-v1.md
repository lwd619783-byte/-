# A股牛熊温度计数据源审计 V1

> Audit date: 2026-09-02  
> Purpose: verify the source/frequency assumptions inherited from the prior Bull/Bear Thermometer design before any Provider or scoring code is implemented.

## 1. Audit principles

Source priority remains:

1. government / regulator official data;
2. exchange / fund company / index company official data;
3. licensed authoritative financial terminal;
4. no unknown-source website may become a core scoring source.

A source being publicly visible does not automatically make it production-ready. We still require:

- stable identity / endpoint or downloadable artifact;
- field semantics;
- historical continuity;
- release-date semantics;
- revision behavior;
- automation / usage permission review where relevant;
- deterministic parsing tests.

---

## 2. Verified official source families

### 2.1 PBOC — M2 and Aggregate Financing to the Real Economy

Official 2026 statistics index:

`https://www.pbc.gov.cn/diaochatongjisi/116219/116319/2026ntjsj/index.html`

The PBOC 2026 statistics page exposes separate official categories for:

- Aggregate Financing to the Real Economy;
- Money and Banking Statistics;
- Financial Institutions credit statistics;
- Financial Market Statistics;
- CGPI.

M2 / Money Supply source:

`https://www.pbc.gov.cn/diaochatongjisi/116219/116319/2026ntjsj/hbtjgl/index.html`

This page explicitly exposes Money Supply in HTML / XLS / PDF and an Advance Release Calendar.

AFRE source:

`https://www.pbc.gov.cn/diaochatongjisi/116219/116319/2026ntjsj/shrzgm/index.html`

This page explicitly exposes both:

- AFRE Flow;
- AFRE Stock.

**Audit conclusion:** source family and monthly nature are production-source candidates. The scoring transformation for AFRE is still a model-definition question, not a source question.

Status: `SOURCE_READY`.

---

### 2.2 National Bureau of Statistics — industrial profits

Official recent example:

`https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260827_1965126.html`

The official industrial-profit release states that above-scale industrial enterprise financial conditions are surveyed monthly and January is exempt from a standalone report.

The NBS 2026 release calendar:

`https://www.stats.gov.cn/xw/tjxw/tzgg/202512/t20251224_1962137.html`

The calendar schedules the industrial economic efficiency monthly report around the 27th of the relevant release month, with the usual caveat that schedules may be adjusted.

**Audit conclusion:** this metric must not be treated as “weekly”. The weekly model checks whether a new official monthly observation exists and otherwise carries forward the latest valid vintage.

Status: `SOURCE_READY`.

---

### 2.3 National Bureau of Statistics — GDP for Buffett indicator

Official Q2 2026 example:

`https://www.stats.gov.cn/sj/zxfb/202607/t20260716_1964142.html`

NBS documents:

- GDP accounting frequency is quarterly;
- preliminary quarterly GDP is generally released around 15 days after quarter-end;
- final verification may revise values;
- comparable quarterly history is available through the national data system.

**Audit conclusion:** GDP source and frequency are ready, but the Buffett-indicator denominator/numerator formula is not yet frozen.

Source status: `SOURCE_READY`; metric status: `DEFINITION_REQUIRED`.

---

### 2.4 Shanghai Stock Exchange — margin financing balance

Official summary:

`https://www.sse.com.cn/market/othersdata/margin/sum/`

Official detailed data:

`https://www.sse.com.cn/market/othersdata/margin/detail/index.shtml`

SSE margin disclosure rules provide the previous trading-day market financing/margin totals before the next trading-day open.

**Audit conclusion:** margin financing is a trading-day source. The model may aggregate it weekly, but the raw series remains daily.

Status: `SOURCE_READY`.

Open implementation item: define identical aggregation for Shenzhen and, if chosen in the market scope, Beijing Exchange data.

---

### 2.5 Exchange market statistics — turnover

SSE daily overview:

`https://www.sse.com.cn/market/stockdata/overview/day/`

SSE historical daily overview:

`https://www.sse.com.cn/market/stockdata/overview/day/index_his.shtml`

The exchange also publishes weekly, monthly and annual market overviews.

**Audit conclusion:** turnover is naturally a trading-day metric. The model should compute weekly heat from official daily observations rather than storing “weekly turnover” as if it were an independently published macro series.

Status: `SOURCE_READY` for SSE; full A-share aggregator still needs SZSE/BSE adapters.

---

### 2.6 HKEX — Northbound Stock Connect

Official daily history:

`https://www.hkex.com.hk/Mutual-Market/Stock-Connect/Statistics/Historical-Daily?sc_lang=en`

Official monthly history:

`https://www.hkex.com.hk/Mutual-Market/Stock-Connect/Statistics/Historical-Monthly?sc_lang=en`

HKEX describes these as historical daily/monthly statistics for Northbound and Southbound fund flows through Shanghai and Shenzhen Stock Connect.

**Audit conclusion:** the official source family is suitable for source-contract design. Provider implementation must lock the exact currently published fields and must not reconstruct a discontinued field from unofficial websites.

Status: `SOURCE_READY`.

---

### 2.7 CSRC — Securities Market Monthly Report

Official index:

`https://www.csrc.gov.cn/csrc/c100120/common_list.shtml`

The page provides regular monthly securities-market statistics (for example, 2026 July statistics published 2026-08-03).

**Audit conclusion:** this is the preferred official source family to probe for monthly IPO / refinancing market-supply fields.

Status: `SOURCE_READY` for source family; `FIELD_PROBE_REQUIRED` before coding.

---

### 2.8 CSI — index valuation snapshots

Official root:

`https://www.csindex.com.cn/`

CSI official index factsheets expose fundamental fields including rolling PE, PB and dividend yield for index snapshots.

**Audit conclusion:** the current valuation concept is supported by an official index source family, but a stable automatable historical PE/PB time series and its use terms must be proven before a long-history percentile Provider is admitted.

Status: `PROBE_REQUIRED`.

---

## 3. Sources that are not yet production-contract ready

### 3.1 Equity ETF net flow

Problem:

- ETF turnover is not ETF net subscription/redemption flow;
- a total market ETF-flow number requires a fixed universe and shares/AUM semantics;
- cross-border/sector/broad-based products can distort interpretation if mixed.

Required probe:

1. identify official shares-outstanding or creation/redemption data source;
2. freeze the equity ETF universe;
3. prove historical continuity;
4. handle corporate/fund events and newly listed ETFs;
5. define whether flows are value-based, share-based, or AUM-normalized.

Until then, the thermometer must not score ETF flow.

Status: `PROBE_REQUIRED`.

---

### 3.2 ChinaClear new investors

Historical official ChinaClear materials clearly contain “new investors” statistics and define investor counts, but this audit did not prove a stable current 2026 monthly machine-readable endpoint suitable for deterministic Provider ingestion.

Required probe:

- current monthly publication location;
- historical archive completeness;
- exact definition changes through time;
- machine-readable extraction route;
- release-date history.

Status: `PROBE_REQUIRED`.

---

### 3.3 Shareholder reductions

Exchange disclosure is authoritative at event level, but market-wide executed reduction amount is not yet proven as a ready-made stable aggregate series.

Required decisions:

- announced plan vs executed amount;
- holder eligibility / threshold;
- cancellations / early termination;
- cross-exchange aggregation;
- free-float denominator;
- duplicate announcement handling.

Status: `PROBE_REQUIRED`.

---

### 3.4 Buybacks

Exchange disclosures are authoritative, but planned ceilings must not be treated as actual capital deployed.

The Provider must distinguish:

- proposed min/max amount;
- executed amount;
- cancellation-oriented buyback;
- incentive/employee-plan inventory;
- later sale of repurchased shares.

Status: `PROBE_REQUIRED`.

---

## 4. Model definitions that remain unresolved even with good data

### 4.1 Chinese Buffett indicator

Data sources exist; definition remains unresolved.

Need to freeze:

- all-A-share market-cap universe;
- inclusion of BSE;
- total vs free-float market cap;
- TTM nominal GDP vs annualized quarter;
- GDP revision handling;
- historical market-structure breaks.

Status: `DEFINITION_REQUIRED`.

### 4.2 Social financing signal

PBOC provides both flow and stock series. The legacy phrase “social financing scale” is not precise enough for scoring.

Backtest candidates:

- AFRE stock YoY;
- monthly AFRE flow normalized by GDP / trend;
- credit impulse;
- blended stock-growth + impulse signal.

Status: `DEFINITION_REQUIRED`.

### 4.3 Market PE percentile

Current PE snapshots are observable, but the benchmark and historical window are model choices.

Need to freeze:

- CSI 300 vs broader all-A benchmark;
- PE type (TTM / static / forward where applicable);
- historical percentile window;
- negative-profit / index methodology handling;
- whether PB or equity-bond spread joins the valuation module later.

Status: `DEFINITION_REQUIRED` after source probe.

---

## 5. Existing dashboard data that must NOT be misused

### Existing 56-company financial Provider

The current dashboard A-share financial Provider has strong company-level integrity for the 56-stock research universe.

It is **not sufficient** to calculate “A-share listed-company earnings breadth” for the Market Regime Engine.

A production profit-cycle breadth metric needs either:

- all A-share companies; or
- a fixed representative benchmark universe with documented historical constituent handling.

Status for market-level earnings breadth: `NOT_READY`.

---

## 6. Frequency corrections vs the old spreadsheet

The prior source table was directionally correct but sometimes used “weekly” to describe how the model reviews data. V1 now separates native source frequency from model frequency.

| Legacy item | Old wording | Correct V1 interpretation |
| --- | --- | --- |
| Financing balance | weekly / trading day | raw daily; weekly aggregation |
| ETF flow | weekly | source may be daily; weekly aggregation after source contract |
| Northbound | daily summary weekly | raw daily; weekly aggregation |
| Turnover | daily weekly summary | raw daily; weekly aggregation |
| New investors | monthly | monthly |
| PE percentile | weekly/monthly | underlying valuation source + weekly model computation |
| Buffett indicator | quarterly | GDP quarterly, market cap higher frequency; model can recompute weekly using latest GDP vintage |
| IPO financing | monthly | monthly |
| Reductions | week/month | event-driven raw; week/month aggregation |
| M2 | monthly | monthly |
| AFRE | monthly | monthly |
| Industrial profits | monthly | monthly, January special case |
| Listed-company earnings | quarterly | reporting-season event stream / quarterly snapshot |

This correction is foundational for the web implementation. “Every Monday” is the model-run rule, not a promise that every source produces a new value every Monday.

---

## 7. Provider work order recommended after this audit

Source-contract build order:

1. `FLOW_MARGIN_BALANCE` — easiest official daily Provider;
2. `SENT_A_SHARE_TURNOVER` — official daily exchange aggregation;
3. `MACRO_M2` — official monthly PBOC series + release calendar;
4. `MACRO_SOCIAL_FINANCING` — source Provider first, scoring definition later;
5. `PROFIT_INDUSTRIAL` — official monthly NBS + release schedule;
6. `FLOW_NORTHBOUND` — HKEX daily history;
7. `SUPPLY_IPO_FINANCING` + `SUPPLY_REFINANCING` — CSRC monthly field probe;
8. PE historical valuation source probe;
9. ChinaClear current investor-series probe;
10. ETF net-flow probe;
11. reduction/buyback event aggregation Provider;
12. market-wide listed-company earnings breadth Provider.

This order favors official sources with clear cadence before ambiguous derived series.

---

## 8. Admission rule

No metric enters the final 0–100 temperature merely because an API call succeeds.

Each scoring metric must have:

- accepted definition;
- verified source contract;
- historical availability sufficient for the intended backtest or an explicitly documented shorter-history treatment;
- release-time semantics;
- revision handling;
- stale behavior;
- deterministic validation;
- missing-data behavior;
- versioned normalization formula;
- backtest evidence.

Until these gates are met, the Market Regime Engine remains a research-stage module and must not emit a production investment temperature.