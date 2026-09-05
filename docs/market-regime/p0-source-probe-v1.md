# Stage 4.1 P0 Source Probe V1

> Date: 2026-09-02  
> Scope: the five source families that gate construction of the first point-in-time Bull/Bear Thermometer backtest dataset.  
> Code baseline: `main` @ `8a1d4c110b5eb8a248701be6cd84470d1fa0d7f7`  
> Status: **SOURCE PROBE V1 — mixed PASS / PARTIAL / NO_GO**

## 1. Executive result

| Probe | V1 result | Meaning |
| --- | --- | --- |
| PBC M2 historical vintages | PASS | official monthly reports with publication timestamps exist back into the 2005 target era; point-in-time reconstruction is feasible |
| PBC AFRE stock vintages | PARTIAL / PROMISING | official stock reports and revision/backcast behavior are confirmed, but a complete first-release monthly vintage catalog from the beginning of the stock series still needs systematic enumeration |
| CSRC securities-market monthly archive for IPO/refinancing | SOURCE FAMILY PASS / FIELD SCHEMA PARTIAL | official archive and original XLS attachments exist back through 2005; publication dates are preserved; old XLS field-level parsing must be validated locally before admitting IPO/refinancing fields |
| A-share market-cap / turnover history | PARTIAL | SSE official historical daily/annual data and SZSE official market-overview data are confirmed; a single strict, unified Shanghai+Shenzhen(+BSE) daily history contract is not yet proven |
| CSI 300 historical TTM PE | NO_GO for strict historical Provider at this probe | CSI official factsheets prove current rolling-PE semantics, but this probe did not find an official automatable 2005-present historical TTM PE time series |

This probe intentionally does **not** downgrade evidence standards to get a complete dataset quickly. A source is admitted only when its historical availability, field semantics and release-time behavior are reproducible.

---

## 2. Probe A — PBC M2 historical vintage

### Result

`PASS`

### Evidence established

People’s Bank of China official historical releases expose monthly M2 values together with publication date/time.

Examples verified during the probe:

- a 2005 official release dated 2005-12-12 14:59 reported end-November M2 balance and YoY growth;
- a 2009 official release retained its historical publication time and linked a monthly `货币供应量统计表` attachment;
- the 2015-01 financial-statistics release is dated 2015-02-13 16:58:58 and explicitly records M2 values plus the then-current statistical notes;
- later releases continue the same report pattern.

The 2015 report also preserves important point-in-time definition notes, for example:

- from October 2011 M2 includes housing provident-fund-center deposits and deposits of non-depository financial institutions at depository institutions;
- the reported M2 YoY rate is calculated on a comparable basis.

### Backtest contract

For each monthly vintage, store:

```text
metricId = MACRO_M2
valueDate
releaseAvailableAt
m2Balance
m2YoYReported
sourceUrl
sourceDefinitionVersion
sourceNotes
revisionClass
```

Primary scoring should prefer the **reported comparable YoY rate available at that historical release**, rather than recomputing every old rate using the newest statistical definition.

### Next implementation task

Build an official PBC release-index collector that enumerates the monthly financial-statistics reports, records the publication timestamp and parses M2 balance/YoY plus definition notes.

No third-party M2 history is required for the strict backtest if the official archive can be enumerated successfully.

---

## 3. Probe B — AFRE / 社会融资规模存量 vintages

### Result

`PARTIAL / PROMISING`

### Evidence established

PBC official sources clearly distinguish:

- AFRE flow / 社会融资规模增量;
- AFRE stock / 社会融资规模存量.

Official stock tables provide both stock level and comparable YoY growth, and describe the current-period values as preliminary.

A critical revision example was verified for 2018: when asset-backed securities of depository institutions and loan write-offs were added to the AFRE definition, PBC published comparable historical data back to 2017.

This confirms that AFRE requires an explicit `definitionVersion` / `revisionSequence` model. A latest revised time series cannot simply be retroactively treated as if historical investors knew the revised series before its publication.

### Strict PIT rule

For backtest date `T`:

- use only an AFRE stock observation/version officially available by `T`;
- if a methodology change later republishes comparable history, the backcast becomes visible only from the publication date of that methodology/revision;
- never replace the earlier information set with the latest reconstructed series.

### Remaining gap

This probe did not yet complete a month-by-month enumeration of the **earliest stock-report publication archive**.

Therefore the following still needs to be built:

```text
AFRE_STOCK_VINTAGE_CATALOG
period -> publication timestamp -> reported stock -> reported YoY -> definition version
```

### Backtest admission status

- Source semantics: PASS
- Revision/backcast semantics: PASS
- Complete historical first-release catalog: NOT YET COMPLETE
- Final metric status: `PARTIAL`

---

## 4. Probe C — CSRC securities-market monthly archive

### Result

`SOURCE FAMILY PASS / FIELD SCHEMA PARTIAL`

### Evidence established

The CSRC `证券市场月报` archive preserves historical monthly entries and actual publication dates.

The archive was verified back through the start of the target sample:

- 2005-01 statistics published 2005-02-11;
- 2005-10 statistics published 2005-11-14;
- 2005-12 statistics published 2006-01-11;
- historical pages continue through 2006–2007, 2010–2011, 2014–2015 and modern years.

Individual historical pages expose original `.xls` attachments. Samples confirmed:

- `2005年12月统计数据.xls`;
- `2010年12月统计数据.xls`;
- a 2015-12 statistics attachment.

### Important limitation found

The web-reading environment used in this research turn cannot parse the legacy `application/vnd.ms-excel` attachments directly. The attachment URLs are visible, but field-level inspection returned unsupported-content-type errors.

Therefore the source family is real and publication timestamps are usable, but this audit must not claim that `IPO financing` and `refinancing` columns have already been schema-verified across eras.

### Required local probe

Codex/local tooling should download representative XLS files from at least:

```text
2005-12
2010-12
2015-12
2020-12
2025-12
```

Then inspect:

- sheet names;
- IPO-related financing fields;
- seasoned/refinancing fields;
- units;
- cumulative vs monthly semantics;
- formula cells;
- merged cells/header changes;
- whether old months are standalone or year-to-date values;
- whether field names change across registration-system reforms.

The parser must retain the original artifact hash.

### Admission status

- archive continuity: PASS
- release-date semantics: PASS
- original artifact availability: PASS
- historical field schema: PARTIAL
- production extraction contract: NOT YET ADMITTED

---

## 5. Probe D — broad A-share turnover and market capitalization

### Result

`PARTIAL`

### Shanghai Stock Exchange

SSE official historical stock-overview pages provide:

- daily historical data;
- weekly/monthly/annual views;
- annual selector extending at least to 1999;
- total / negotiable market-cap and turnover-type fields.

Important SSE definition breaks already exposed by the official page include:

- from 2019-07-22 the displayed aggregate stock data excludes stock-repurchase data and reflects the stated board composition;
- from 2020-05-01 turnover-rate definitions distinguish total-market-cap turnover and negotiable-market-cap turnover.

Therefore an SSE adapter must version these source-definition breaks.

### Shenzhen Stock Exchange

SZSE official monthly market-overview documents expose fields including:

- total market capitalization;
- negotiable market capitalization;
- monthly total turnover value;
- average daily turnover;
- trading-day count;
- listed-company count.

This confirms that official market-size and turnover aggregates exist at least at monthly frequency.

### Beijing Stock Exchange

BSE is structurally relevant only after its launch era and official homepage exposes total/negotiable market-cap fields for the current market.

It must never be synthetically inserted into pre-BSE history.

### Unresolved requirement

The V1 sentiment formula uses a 5-day turnover intensity and the margin formula uses negotiable market capitalization. A strict weekly backtest therefore needs an exchange-consistent daily series for Shanghai + Shenzhen, and BSE after its applicable era.

This probe has **not yet proven one unified daily historical contract** for all exchanges back to 2005.

### V1 fallback research option

Two backtest variants may later be tested, but they must not be mixed silently:

1. `STRICT_DAILY_MARKET`: aggregate official daily exchange data after all adapters are admitted;
2. `SLOW_MONTHLY_MARKET`: use official monthly market-cap / turnover vintages for a slower research-only challenger model.

Candidate A baseline remains blocked from strict implementation until the daily Shanghai+Shenzhen contract is proven.

---

## 6. Probe E — CSI 300 historical TTM PE

### Result

`NO_GO for strict historical Provider in P0 Probe V1`

### What is verified

CSI official factsheets clearly expose current fundamental fields such as:

- `滚动市盈率` / rolling PE;
- PB;
- dividend yield;
- index market-cap statistics.

The official factsheet also states that index indicators are calculated using the index calculation share base.

This validates the **current PE field semantics** and supports CSI as an authoritative valuation source family.

### What is not verified

This probe did not find an official public path that provides a deterministic, automatable **2005-present historical daily/weekly CSI 300 TTM PE time series** with release/availability semantics.

The CSI public site exposes current factsheets and valuation/data product navigation, but the historical PE series required by this backtest was not established.

### Consequence

Do not:

- scrape a random third-party PE history and label it `CSI official`;
- reconstruct historical PE from today’s constituents;
- use a full-sample valuation percentile derived from a modern vendor without documenting vintage limitations.

### Allowed next routes

Route A — preferred if available:

- licensed Wind / Choice / iFinD / CSI-authorized data feed;
- contract must document index, PE type, date, licensing, historical continuity and adjustment methodology.

Route B — expensive but auditable:

- reconstruct historical index PE from point-in-time CSI constituent files plus point-in-time company earnings and calculation-share methodology;
- this is a separate project and must handle negative earnings, constituent changes and historical index methodology.

Route C — temporary backtest exclusion:

- mark `VAL_MARKET_PE_PERCENTILE` unavailable until an admitted historical source exists;
- valuation module may still use Buffett indicator if coverage thresholds permit.

P0 V1 recommends **Route C first**, while separately probing licensed historical valuation data. This avoids blocking the rest of the dataset on one valuation source.

---

## 7. Source-readiness matrix after P0 Probe V1

| Data family | Source continuity | PIT release time | Revision/version semantics | Field schema | V1 status |
| --- | --- | --- | --- | --- | --- |
| PBC M2 | strong | strong | strong | strong | PASS |
| PBC AFRE stock | strong in later archive | strong in verified later reports | strong / revisions confirmed | strong | PARTIAL — catalog gap |
| CSRC monthly archive | strong to 2005 | strong | needs field-era versioning | old XLS not yet parsed | PARTIAL |
| SSE market totals | strong | market-date semantics | source breaks documented | good | PASS for SSE component |
| SZSE market totals | monthly confirmed | publication artifact/date | needs historical adapter | monthly fields confirmed | PARTIAL for daily need |
| BSE market totals | post-launch only | current official | structural-era boundary | current fields confirmed | PARTIAL / era-limited |
| CSI 300 rolling PE | current source strong | current snapshot | historical series unresolved | current field confirmed | NO_GO historical |

---

## 8. Immediate buildable dataset slice

After this probe, the first dataset construction should **not** try to fill every V1 metric.

The first strict observation catalog can start with:

```text
MACRO_M2                -> START BUILD
MACRO_AFRE_STOCK        -> START CATALOG, mark early-vintage gaps explicitly
CSRC_MONTHLY_ARTIFACTS  -> START INDEX/DOWNLOAD CATALOG
SSE_MARKET_DAILY        -> START ADAPTER
```

Blocked / second-probe items:

```text
CSI300_TTM_PE_HISTORY   -> NO_GO / licensed-source probe
SZSE_MARKET_DAILY       -> SECOND PROBE REQUIRED
BSE_MARKET_DAILY        -> SECOND PROBE, post-launch only
CSRC_IPO_FIELDS          -> LOCAL XLS SCHEMA PROBE REQUIRED
CSRC_REFINANCING_FIELDS -> LOCAL XLS SCHEMA PROBE REQUIRED
```

---

## 9. Recommended next Codex task

The next task is now concrete enough to move from research-only documentation into a **data-ingestion research branch**, without implementing the final Market Regime Engine.

Recommended scope:

### Task 4.1-R1 — Historical Observation Catalog Skeleton

Implement only:

1. typed `MetricObservationVintage` / `SourceDefinitionVersion` / `ReleaseConfidenceClass` schemas;
2. filesystem layout for raw source artifacts and normalized observation catalogs;
3. PBC M2 historical release index collector;
4. PBC AFRE stock release index collector;
5. CSRC securities-monthly-report index collector that records page publication date and original XLS URL/hash but does not yet interpret financing fields;
6. SSE historical-market adapter probe;
7. manifest generation and deterministic validation;
8. no score calculation;
9. no UI changes;
10. no `data:refresh` integration.

This task should prove that historical vintages can be ingested and replayed before any 0–100 temperature code exists.

---

## 10. Gate to the first real backtest

Do not run Candidate A–D until all of the following exist:

- observation catalog schema;
- PBC M2 vintages;
- admitted AFRE stock vintage window or explicit exclusion eras;
- broad-market turnover/cap history sufficient for the candidate being tested;
- CSRC supply fields parsed or Supply module marked unavailable;
- valuation source decision (admitted history or explicit unavailable module);
- weekly Monday-08:00 input-manifest builder;
- coverage/comparability flags.

The first historical temperature curve should therefore emerge from a reproducible observation catalog, not from a hand-assembled spreadsheet.