# R2-E checkpoint 4 — historical candidates / archive / eligibility

`integration/history.v1.json` is a candidate eligibility ledger, not a formal R2 dataset. Every row points to its source JSON location and candidate hash, retaining field/unit/scope/family/date and source/field rejection reasons. Original D1 inventories and the D2 report are independently replayed and remain unchanged.

| Exchange | Prior D1 field captures | New field captures | Combined captures | Unique family/scope/date/field keys | Formal | Strict PIT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| SSE | 42 | 87 | 129 | 120 | 0 | 0 |
| SZSE | 45 | 484 | 529 | 529 | 0 | 0 |
| BSE | 24 | 18 | 42 | 39 | 0 | 0 |
| Total | 111 | 589 | 700 | 688 | 0 | 0 |

These are field-level evidence counts, not exchange-days or coverage percentages. Twelve repeated keys retain both acquisitions and no truthSelection; unchanged tokens do not prove first release or absence of intervening revision. The 484 SZSE candidates are two 242-date ChiNext tables; they are not an all-SZSE aggregate and cannot establish a calendar from occupied/blank cells.

SSE: every civil date 2021-12-20..2022-01-07 was probed in both official families, plus 2005-01-04. This verifies the local migration response pattern but not full historical trading-day continuity. SZSE: 28 official annual links were inventoried, three yearbooks inspected; another 25 remain explicitly NOT_RUN. BSE: all attachments returned by two bounded annual directories were captured, with pre-launch selected-layer contamination and field-specific revision notes preserved. Annual data were not split into daily values.

Full raw replay passed locally for all new acquisitions and the original D1 archives. Eight large SSE/SZSE PDFs remain in ignored local raw; full replay from a fresh clone is NOT_RUN unless those exact bytes are supplied. BSE small complete PDFs/HTML/JSON and SSE/SZSE small responses are committed. No off-machine durable archive is claimed.

All 700 candidate rows fail existing calendar/definition/release gates. `eligibleObservations=[]`, `formalObservations=[]`, `strictPitObservations=[]`. Full unadmitted target windows remain intact. Validation: candidate-ledger deterministic replay, duplicate-count/source-location checks, re-sealed formal-promotion rejection, yearbook-date/calendar separation, plus actual raw/PDF/candidate replays reported in checkpoint 2. Twelve integration tests pass.
