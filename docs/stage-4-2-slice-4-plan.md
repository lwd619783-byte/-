# Stage 4.2 / Slice 4 Plan — Cross-source Industry Provider Proof

Status: **FROZEN PLAN** — implementation now **D0 GO / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**; see [Slice 4 delivery](stage-4-2-slice-4.md). The frozen scope below is unchanged.

Base after Slice 3 functional merge:

`origin/main = 6a9aa233b4351938b39c247833d9e72d99854269`

## 1. Objective

Prove that the Industry Data Platform is not robotics/NBS-specific.

Slice 4 must add a second materially different official provider and a second industry / fundamental dimension while reusing the existing Industry Metric Registry, Generic Provider, Signal/Event, Evidence and Industry Workspace.

Preferred pilot: existing `oil-shipping` industry with official U.S. EIA petroleum data.

Candidate dimensions:

- inventory: U.S. commercial crude-oil stocks excluding SPR;
- flow: U.S. crude-oil exports or another directly published weekly petroleum flow series.

Exact EIA route / series identity, units, frequency and metadata must be independently discovered from official EIA sources during D0. The implementation must not trust guessed series IDs from chat or comments.

## 2. Why this pilot

This creates a materially different proof from Slice 1–3:

- provider family: EIA instead of NBS;
- geography: U.S. / global-market context instead of China;
- frequency: weekly instead of monthly;
- dimensions: inventory / physical flow instead of output + native YoY;
- industry: oil shipping instead of robotics.

It therefore tests whether the platform contracts are truly reusable before a prosperity/regime layer is introduced.

## 3. Source Adapter seam

Introducing a second provider is the point to formalize the source-specific adapter dispatch seam.

Registry remains the owner/discovery source of truth. Source-specific parsing/replay stays code-owned and fail-closed.

The implementation should avoid accumulating owner constants in one build script. Add the smallest versioned adapter registry/dispatch contract needed to register at least:

- existing NBS industrial-production adapter;
- new EIA petroleum adapter.

Do not create a general arbitrary plugin execution system.

## 4. Acquisition policy

D0 must verify an official, reproducible acquisition path.

EIA API v2 is an official option but requires an API key. If the execution environment has no authorized key, Codex must look for an official EIA downloadable/bulk/retained-file path that can be replayed without inventing credentials.

If no compliant official acquisition route can be demonstrated, stop with a documented `NO_GO` rather than substituting an unofficial source.

Raw bytes / payloads, exact source metadata and hashes must be retained for deterministic replay.

## 5. Metric semantics

Metrics must be directly published official values.

No derived “oil-shipping demand”, “prosperity”, “bullish/bearish” or composite score in this Slice.

Any delta shown must have an explicit semantic contract suitable for the metric:

- inventory: adjacent retained absolute difference may be allowed only if registered explicitly;
- flow series: adjacent retained absolute difference may be allowed only if the presentation contract says so.

Do not call an adjacent difference an official WoW rate unless EIA directly publishes that rate.

## 6. Time / PIT

Keep distinct:

- observation period / week ending;
- publication date/time if officially proven;
- releaseAvailableAt if officially proven;
- acquiredAt / generatedAt.

Do not infer publication or releaseAvailableAt from week-ending date or fetch time.

If exact release availability cannot be proved, keep it null / UNPROVED and preserve NOT_ADMITTED boundaries.

## 7. Product proof

The existing `oil-shipping` Industry Workspace should be able to:

- enumerate the new registered metrics;
- render history in the existing auditable metric/chart surface;
- create deterministic Signal / Change Event projection when the source/release grouping is unambiguous;
- surface the event in Research Inbox without using stock-price movement as a proxy;
- open Evidence for the exact source inputs.

The existing industry-chain visualization should remain a research-context view; no need to redesign it in Slice 4.

## 8. Explicit non-goals

Do not implement yet:

- Industry Prosperity Score / Regime;
- AI Claim / Thesis;
- global cross-industry ranking;
- new Portfolio work;
- MCP / Agent;
- production/data admission elevation;
- automatic scheduled refresh SLA;
- Company Guidance cross-epoch P2 unless it directly blocks this Slice.

## 9. Acceptance

At minimum prove:

1. a second official source family replays from retained raw bytes/payloads;
2. a second industry is discoverable through the existing registry/provider seam;
3. weekly frequency and non-NBS units work without robotics-specific branching;
4. source adapter dispatch is explicit and fail-closed;
5. missing/conflicted/revision/time uncertainty propagates;
6. non-target industries do not receive proxy data;
7. the existing robotics/NBS owners remain byte/semantic stable;
8. Signal/Event/Inbox integration does not invent prosperity conclusions;
9. all normal project gates and Hosted CI remain green.

## 10. Follow-on

If Slice 4 proves at least two independent source families and multiple fundamental dimensions, Slice 5 may begin a narrowly defined Industry Prosperity / Regime V1 with explicit methodology, normalization and missing-data behavior.
