// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { EarningsExpectationComparison, EarningsExpectationSnapshot, ProviderEvidenceRelationRecord, Stock } from "../../types";
import { EarningsExpectationCenter } from "./EarningsExpectationCenter";
import { getMockDashboardData } from "../../services/providers/mockProvider";

afterEach(() => { cleanup(); delete document.documentElement.dataset.theme; });

type Props = ComponentProps<typeof EarningsExpectationCenter>;
const stock = { id: "synthetic", code: "000001.SZ", name: "Synthetic 长名称预期来源与证据审计研究公司", market: "A股", industryId: "tech", segmentId: "segment" } as Stock;
function snapshot(overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot {
  return { id: "local", stockId: stock.id, market: "A股", reportPeriod: "2026-06-30", periodScope: "half_year", metric: "revenue", estimateShape: "point", value: 100, lowerBound: null, upperBound: null, currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourceCategory: "user_estimate", sourceName: "Synthetic 用户预测", sourceTitle: "Synthetic 研究记录", sourceUrl: null, sourcePublishedAt: null, sourcePublishedAtPrecision: null, sourcePublishedAtResolution: null, sourcePublishedAtTimeZone: null, sourcePublishedAtCalendarDate: null, asOfDate: "2026-06-01", formedAt: null, formedAtPrecision: "date", formedAtResolution: "date", formedAtTimeZone: null, formedAtCalendarDate: "2026-06-01", analystCount: null, institutionCount: null, ingestionMethod: "manual", createdAt: "2026-06-01T00:00:00.000Z", createdBy: "synthetic", sourceVerificationStatus: "verified", notes: "Synthetic fixture only", correctsSnapshotId: null, correctionScope: null, schemaVersion: 2, ...overrides };
}
function comparison(value: EarningsExpectationSnapshot, overrides: Partial<EarningsExpectationComparison> = {}): EarningsExpectationComparison {
  return { id: `comparison-${value.id}`, snapshotId: value.id, actualEventId: "synthetic-actual", stockId: value.stockId, reportPeriod: value.reportPeriod, periodScope: value.periodScope, metric: value.metric, expectedValue: value.value, expectedLowerBound: value.lowerBound, expectedUpperBound: value.upperBound, actualValue: 120, absoluteDifference: 20, relativeDifference: 0.2, comparisonResult: "above", comparisonMethod: "Synthetic supplied comparison", isExAnte: true, beforeActualDisclosure: true, beforeAnyPerformanceDisclosure: true, actualDisclosureAt: "2026-07-01T08:00:00.000Z", performanceInformationCutoff: "2026-07-01T08:00:00.000Z", comparisonAvailableAt: "2026-07-01T08:00:00.000Z", comparabilityStatus: "comparable", nonComparableReasons: [], calculatedAt: "2026-07-01", ...overrides };
}
function props(overrides: Partial<Props> = {}): Props {
  return { snapshots: [snapshot()], comparisons: [], importHistory: [], stocks: [stock], industries: [{ ...getMockDashboardData().industries[0], id: "tech", name: "Synthetic 行业", segments: [] }], watchItems: [], providerLoadStatus: "idle", timeZone: "Asia/Shanghai", onAdd: vi.fn(), onCorrect: vi.fn(), onImport: vi.fn(), onOpenStock: vi.fn(), onRetryProvider: vi.fn(), ...overrides };
}

describe("EarningsExpectationCenter UI V1 workflows", () => {
  it("retains ten filters and all four frozen content entries across the three main views", () => {
    render(<EarningsExpectationCenter {...props()} />);
    expect(screen.getByRole("button", { name: "对比" }).getAttribute("aria-pressed")).toBe("true");
    for (const name of ["有效快照", "业务修订", "数据纠错", "导入记录"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "来源核验" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "更多筛选" }));
    for (const name of ["公司", "行业", "报告期", "指标", "来源类别", "来源核验", "事前有效", "比较结果", "存在修订", "观察清单"]) expect(screen.getByLabelText(name, { exact: true })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("公司", { exact: true }), { target: { value: "Synthetic" } });
    fireEvent.change(screen.getByLabelText("来源核验", { exact: true }), { target: { value: "verified" } });
    fireEvent.click(screen.getByRole("button", { name: "更多筛选 · 已启用 1" }));
    expect(screen.queryByRole("combobox", { name: "来源核验" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "来源与时间审计" }));
    fireEvent.click(screen.getByRole("button", { name: "导入记录" }));
    expect(screen.getByText("尚无导入记录")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "对比" }));
    expect((screen.getByLabelText("公司", { exact: true }) as HTMLInputElement).value).toBe("Synthetic");
    expect(screen.getByRole("button", { name: "更多筛选 · 已启用 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "清除高级条件" }));
    expect((screen.getByLabelText("公司", { exact: true }) as HTMLInputElement).value).toBe("Synthetic");
  });

  it("keeps display groups separate for different period scope, currency, unit and accounting basis", () => {
    const values = [snapshot(), snapshot({ id: "scope", sourceName: "Synthetic scope", periodScope: "year_to_date" }), snapshot({ id: "currency", sourceName: "Synthetic currency", currency: "HKD" }), snapshot({ id: "unit", sourceName: "Synthetic unit", unit: "million_yuan" }), snapshot({ id: "basis", sourceName: "Synthetic basis", accountingBasis: "IFRS" })];
    render(<EarningsExpectationCenter {...props({ snapshots: values })} />);
    const groups = within(screen.getByLabelText("同口径对照组")).getAllByRole("option");
    expect(groups).toHaveLength(5);
    expect(new Set(groups.map((option) => (option as HTMLOptionElement).value)).size).toBe(5);
  });

  it("plots only supplied comparable point and range results and retains independent source qualifications", () => {
    const point = snapshot({ value: -100 });
    const range = snapshot({ id: "range", sourceCategory: "institution_single", sourceName: "Synthetic 单机构", estimateShape: "range", value: null, lowerBound: -200, upperBound: -50 });
    const missing = snapshot({ id: "missing", sourceName: "Synthetic 缺值", value: null, sourceVerificationStatus: "pending" });
    render(<EarningsExpectationCenter {...props({ snapshots: [point, range, missing], comparisons: [comparison(point, { actualValue: -75 }), comparison(range, { actualValue: -75, comparisonResult: "within", relativeDifference: null })] })} />);
    const chart = screen.getByRole("region", { name: "来源区间对照" });
    expect(within(chart).getAllByRole("img")).toHaveLength(2);
    expect(chart.querySelectorAll("rect")).toHaveLength(1);
    expect(chart.querySelectorAll("circle")).toHaveLength(2);
    const missingRow = within(chart).getByRole("article", { name: "用户个人预测 Synthetic 缺值" });
    expect(within(missingRow).queryByRole("img")).toBeNull();
    expect(missingRow.textContent).toContain("缺失 元");
    expect(missingRow.textContent).toContain("来源核验：待核验");
    expect(missingRow.textContent).toContain("事前有效：未认定 / 待匹配");
    expect(missingRow.textContent).toContain("数值可比性：待匹配");
  });

  it("keeps conflicts visible by default, excludes them from the plot and retains local values in audit", () => {
    const conflict = snapshot({ id: "synthetic-conflict", value: 987654321 });
    const relation: ProviderEvidenceRelationRecord = { localSnapshotId: conflict.id, providerSnapshotId: "official", relation: "content_conflict", conflictingFields: ["value"] };
    render(<EarningsExpectationCenter {...props({ snapshots: [conflict], comparisons: [], providerRelationByLocalId: new Map([[conflict.id, relation]]) })} />);
    expect(screen.getByRole("alert").textContent).toContain("财务内容冲突");
    expect(screen.getByRole("alert").textContent).toContain("value");
    expect(within(screen.getByRole("region", { name: "来源区间对照" })).queryByRole("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看冲突详情" }));
    const audit = screen.getByRole("region", { name: "来源与时间审计详情" });
    expect(audit.textContent).toContain("987654321 元");
    expect(audit.textContent).toContain("synthetic-conflict");
    expect(audit.textContent).toContain("official");
    expect(audit.querySelector("details")?.open).toBe(true);
  });

  it("keeps official records read-only and passes original local correction and company objects to callbacks", () => {
    const official = snapshot({ id: "official", sourceCategory: "company_guidance", sourceName: "Synthetic 官方", ingestionMethod: "provider" });
    const local = snapshot();
    const input = props({ snapshots: [official, local], providerLoadStatus: "success", providerSnapshotIds: new Set([official.id]) });
    render(<EarningsExpectationCenter {...input} />);
    expect(screen.getAllByRole("button", { name: "创建纠正" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "创建纠正" }));
    expect(input.onCorrect).toHaveBeenCalledTimes(1);
    expect(input.onCorrect).toHaveBeenCalledWith(local);
    fireEvent.click(screen.getAllByRole("button", { name: "个股详情" })[0]);
    expect(input.onOpenStock).toHaveBeenCalledTimes(1);
    expect(input.onOpenStock).toHaveBeenCalledWith(stock);
    fireEvent.click(screen.getByRole("button", { name: "添加业绩预期" }));
    fireEvent.click(screen.getByRole("button", { name: "导出 / 快照导入" }));
    expect(input.onAdd).toHaveBeenCalledTimes(1);
    expect(input.onImport).toHaveBeenCalledTimes(1);
  });

  it("preserves local snapshots and retry after a global provider failure supplied by the active-record selector", () => {
    const local = snapshot();
    const official = snapshot({ id: "official", sourceName: "Synthetic 官方", sourceCategory: "company_guidance", ingestionMethod: "provider" });
    const input = props({ snapshots: [local, official], providerLoadStatus: "success", providerSnapshotIds: new Set([official.id]) });
    const { rerender } = render(<EarningsExpectationCenter {...input} />);
    rerender(<EarningsExpectationCenter {...input} snapshots={[local]} providerSnapshotIds={new Set()} providerLoadStatus="error" providerLoadError="synthetic workflow checksum failure" />);
    expect(screen.getByRole("alert").textContent).toContain("本地快照仍可使用");
    const sources = screen.getByRole("region", { name: "来源区间对照" });
    expect(sources.textContent).toContain("Synthetic 用户预测");
    expect(sources.textContent).not.toContain("Synthetic 官方");
    fireEvent.click(screen.getByRole("button", { name: "导入记录" }));
    expect(screen.getByRole("alert").textContent).toContain("synthetic workflow checksum failure");
    fireEvent.click(screen.getByRole("button", { name: "重试数据加载" }));
    expect(input.onRetryProvider).toHaveBeenCalledTimes(1);
  });

  it("preserves the selected group, advanced filters and business input across all three theme renders", () => {
    const values = [snapshot(), snapshot({ id: "later", reportPeriod: "2026-12-31", periodScope: "full_year" })];
    const input = props({ snapshots: values });
    const before = JSON.stringify(input.snapshots);
    const { rerender } = render(<EarningsExpectationCenter {...input} />);
    const select = screen.getByLabelText("同口径对照组") as HTMLSelectElement;
    const chosen = select.options[1].value;
    fireEvent.change(select, { target: { value: chosen } });
    fireEvent.click(screen.getByRole("button", { name: "更多筛选" }));
    fireEvent.change(screen.getByLabelText("来源核验", { exact: true }), { target: { value: "verified" } });
    for (const theme of ["pro", "light", "neon"]) {
      document.documentElement.dataset.theme = theme;
      rerender(<EarningsExpectationCenter {...input} />);
      expect((screen.getByLabelText("同口径对照组") as HTMLSelectElement).value).toBe(chosen);
      expect((screen.getByLabelText("来源核验", { exact: true }) as HTMLSelectElement).value).toBe("verified");
      expect(JSON.stringify(input.snapshots)).toBe(before);
    }
  });

  it("retains import batch order, exact counts and structured row issues without applying page filters", () => {
    const input = props({ importHistory: [{ id: "synthetic-import", importedAt: "2026-07-03T00:00:00Z", ingestionMethod: "csv_import", mode: "merge", fileName: "synthetic.csv", totalCount: 6, addedCount: 2, duplicateCount: 1, conflictCount: 1, invalidCount: 2, issues: [{ row: 5, code: "synthetic-invalid", message: "Synthetic 原始校验失败", raw: { value: "bad" } }] }] });
    render(<EarningsExpectationCenter {...input} />);
    fireEvent.change(screen.getByLabelText("公司", { exact: true }), { target: { value: "no match" } });
    fireEvent.click(screen.getByRole("button", { name: "导入记录" }));
    expect(screen.getByText("synthetic.csv · CSV")).toBeTruthy();
    expect(screen.getByText("第 5 行 · [synthetic-invalid] Synthetic 原始校验失败")).toBeTruthy();
    const batch = within(screen.getByText("synthetic.csv · CSV").closest("article")!);
    for (const [label, value] of [["输入", "6"], ["新增", "2"], ["重复", "1"], ["冲突", "1"], ["无效", "2"]]) expect(batch.getByText(label, { exact: true }).nextElementSibling?.textContent).toBe(value);
    expect(input.importHistory[0].issues[0].raw).toEqual({ value: "bad" });
  });

  it("distinguishes no business snapshots from an empty filter without manufacturing a line", () => {
    const { rerender } = render(<EarningsExpectationCenter {...props({ snapshots: [] })} />);
    expect(screen.getByText("尚无业绩预期快照")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    rerender(<EarningsExpectationCenter {...props()} />);
    fireEvent.change(screen.getByLabelText("公司", { exact: true }), { target: { value: "no match" } });
    expect(screen.getByText("没有匹配的业绩预期")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps equal-time warnings visible while business revision and correction views stay distinct", () => {
    const first = snapshot({ id: "a", formedAt: "2026-06-01T07:00:00.000Z", formedAtPrecision: "datetime" });
    const second = snapshot({ id: "z", value: 110, formedAt: "2026-06-01T15:00:00+08:00", formedAtPrecision: "datetime" });
    render(<EarningsExpectationCenter {...props({ snapshots: [first, second] })} />);
    expect(screen.getByText(/时间关系为 equal/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "业务修订" }));
    expect(screen.getByText(/时间关系为 equal/)).toBeTruthy();
    expect(screen.queryByText(/业务预测较前值.*%/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "数据纠错" }));
    expect(screen.getByText("当前对照组没有数据纠错")).toBeTruthy();
  });
});
