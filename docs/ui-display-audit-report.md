# UI Display Audit Report

Generated: 2026-09-09T14:33:41.550Z

## Scope
- Planned responsive checklist (not measured by this command): 1920, 1600, 1440, 1280, 1024, 768, 390, 320.
- Static source surfaces: 首页 / 宏观 / 行业 / 个股池 / 公司研究五标签 / 观察清单 / 验证中心 / 预期证据.
- Screenshot directory prepared: `docs/ui-screenshots/`.
- This lightweight audit is static. It does not create screenshots because the project does not include a browser automation dependency.

## Scope limitations
- This scan only detects the listed legacy color classes in the listed source files.
- It does not certify contrast, focus, layout, business state, persistence, or browser behavior.
- NEON-RC1 uses one shared component tree with neon / pro / light display tokens.
- The frozen design and actual UI V1 browser evidence are indexed in [implementation acceptance](ui-redesign/v1/implementation/acceptance.md).
- Historical drawer dimensions and expected truncation rules are not runtime findings for the new five-tab company page.

## Width Checklist
| Width | Expected Result |
| --- | --- |
| 1920px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 1600px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 1440px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 1280px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 1024px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 768px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 390px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 320px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |

## Static Findings
- No high-risk legacy light-theme classes found in audited files.

## Runtime checks
- Verify the screenshot matrix, 320px, 200% zoom, keyboard, reduced motion and abnormal states in the separate acceptance evidence.
- Verify independent theme/data modes and unchanged business exports with actual browser interactions.
- No runtime PASS is inferred from this static command.
