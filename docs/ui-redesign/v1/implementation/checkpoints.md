# UI V1.0 implementation checkpoints

Input base: `473289db6da79db5be892015bffc2c75b964abcb` (fetch + live refs/heads/main equality verified).
Branch: `codex/ui-v1-full-implementation-ultra`. This task executes D1–D5 continuously under the user's explicit single-branch authorization. Frozen D0 documents remain historical design evidence.

## D1 — shared shell and themes

- Shared seven-entry shell, compact global controls and contextual data health; independent versioned UI preference, neon default, invalid/unreadable/unwritable preference handling.
- Frozen tokens shared through CSS variables; no theme-dependent business tree, provider, sort or persistence changes. Mobile primary navigation retains all seven entries.
- Common chart color semantics are red up / green down; missing points remain gaps and single points remain visible.
- Focused validation: 7 files / 36 tests PASS; TypeScript PASS; `npm run ui:audit` completed.
- Browser: Chromium at 1600×1000, macro page switched neon/pro/light, same main geometry and text, zero page errors. Screenshots and JSON: `data-cache/ui-v1-acceptance/d1-*` (local evidence, excluded from production).
- Baseline build PASS: initial JS 2,334.70 kB / gzip 534.59 kB, CSS 44.00 kB / gzip 9.90 kB. Vite existing >500 kB chunk warning retained. Baseline browser and build evidence in `data-cache/ui-v1-acceptance/baseline-*`.
- Existing local generated workflow byte-size validation failure is visible and fail-closed in Mixed mode; no provider bytes or validation rules changed. Success/failure fixtures and final page-specific layout checks belong to D2–D5.
