import type { AShareFinancialData, FinancialReport, Stock } from "../types";
import { safeEvidenceUrl } from "../utils/evidenceUrl";

/** Ephemeral presentation rows, never a Metric/Evidence registry or persistence payload. */
export interface ChartAuditView {
  title: string;
  scope: string;
  quality: string[];
  rows: Array<{ label: string; value: string; href?: string }>;
  records: Array<{ title: string; rows: ChartAuditView["rows"] }>;
  linkage: null;
}
const unknown = "未提供 / unknown";
const text = (value: string | number | boolean | null | undefined) => value === null || value === undefined || value === "" ? unknown : String(value);
const row = (label: string, value?: string | number | boolean | null) => ({ label, value: text(value) });
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const orderedStates = (values: Array<string | undefined>) => [...new Set(values.map(value => value || "unknown"))].sort(compare);
const proofRows = () => [
  row("公开可得时间 releaseAvailableAt", "未提供 / 未证明"),
  row("严格 PIT", "未证明 / unknown"), row("数据准入", unknown), row("生产准入", unknown),
  row("Evidence Graph / revision continuity", "未证明 / unknown"),
];
const linkRow = (url?: string) => ({ ...row("来源 HTTP(S)", safeEvidenceUrl(url) ? url : url ? "不可安全打开" : undefined), ...(safeEvidenceUrl(url) ? { href: safeEvidenceUrl(url)! } : {}) });
const finite = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value);
export const chartNumericValue = (value: number | null | undefined): number | null => finite(value) ? value! : null;

export function priceChartAudit(stock: Stock, points: NonNullable<Stock["priceHistory"]>): ChartAuditView {
  const candidate = stock.priceHistorySource;
  const owner = candidate?.id === stock.id && candidate.points === stock.priceHistory && points.every(point => candidate.points.includes(point)) ? candidate : undefined;
  const dates = points.map(point => point.date).sort(compare);
  const available = points.filter(point => finite(point.close)).length;
  return {
    title: "收盘价 / close", scope: `${stock.name} · ${stock.code} · ${stock.id}`,
    quality: orderedStates([owner?.quality.status, ...(!points.length ? ["missing"] : available < points.length ? ["partial"] : [])]),
    rows: [row("序列 owner", owner?.id), row("单位 / 币种"), row("期间口径 / 原生频率", "交易日期读数；原生频率未提供"),
      row("观测日期范围", dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : undefined),
      row("发布时间"), row("数据更新时间（非发布）", owner?.quality.updatedAt), row("来源身份", owner?.quality.source),
      row("来源 endpoint", owner?.quality.sourceEndpoint), linkRow(owner?.quality.sourceUrl), row("解析状态"),
      row("来源错误", owner?.quality.errorMessage),
      row("数值完整性", `${available}/${points.length} 个有限数值；仅当前观察范围，不证明交易日覆盖`),
      row("freshness", owner?.quality.status === "stale" ? "stale" : unknown),
      row("版本 / revision"), row("转换 / 公式", "直接读取 close；复权口径未提供；缺失不连接"), ...proofRows()],
    records: [], linkage: null,
  };
}

export const financialChartFields = ["operatingRevenue", "netProfitAttributableToParent", "netOperatingCashFlow"] as const;
export function financialChartAudit(stock: Stock, detail: AShareFinancialData | null, reports: FinancialReport[], period: "singleQuarter" | "cumulative", scope: string | undefined): ChartAuditView {
  const owner = detail?.id === stock.id && detail.stockCode === stock.code ? detail : null;
  const selected = owner ? reports.filter(report => owner.reports.includes(report) && report.stockCode === owner.stockCode && report.market === owner.market && report.statementScope === scope) : [];
  const records = selected.map(report => {
    const values = financialChartFields.map(field => report.status === "conflicted" ? null : report[period]?.[field]);
    return { title: `${report.reportPeriod} · ${report.statementScope} · ${report.sourceIdentifier}`, rows: [
      row("报告期（非发布时间）", report.reportPeriod), row("报告类型", report.reportType), row("发布时间 announcementDate", report.announcementDate),
      row("采集 fetchedAt", report.fetchedAt), row("生成 generatedAt", report.generatedAt), row("来源更新 sourceUpdatedAt", report.sourceUpdatedAt),
      row("来源身份", report.provider), row("来源记录", report.sourceIdentifier), linkRow(report.sourceUrl),
      row("单位 / 币种", `${report.currency} / ${report.normalizedUnit}`), row("报告质量", report.status), row("解析状态"),
      row("报告错误", report.errorMessage),
      row("图表数值完整性", `${values.filter(finite).length}/3`),
      ...financialChartFields.map((field, index) => row(`${field}（${period}）`, finite(values[index]) ? values[index] : null)),
      row("owner 原始字段覆盖", `${report.rawFieldCoverage.available}/${report.rawFieldCoverage.total}`),
      row("owner 核心字段覆盖", `${report.coreFieldCoverage.available}/${report.coreFieldCoverage.total}`),
      row("字段状态（owner）", JSON.stringify(Object.fromEntries(Object.entries(report.fieldStatus).sort(([a], [b]) => compare(a, b))))),
      row("Provider 版本（非 report revision）", report.providerVersion), row("修订 isRestated", report.isRestated), row("report revision"),
      row("派生 isDerived", report.isDerived), row("派生公式", report.derivationMethod), row("派生来源期间", [...report.sourcePeriods].map(text).sort(compare).join(" / ")),
      row("单位转换", `${report.sourceUnit} × ${report.normalizationFactor} → ${report.normalizedUnit}`), row("审计状态", report.auditStatus),
    ] };
  }).sort((a, b) => compare(a.title, b.title) || compare(JSON.stringify(a.rows), JSON.stringify(b.rows)));
  const available = selected.flatMap(report => financialChartFields.map(field => report.status === "conflicted" ? null : report[period]?.[field])).filter(finite).length;
  return {
    title: "营业收入 / 归母净利润 / 经营现金流", scope: `${stock.name} · ${stock.code} · ${stock.id}`,
    quality: orderedStates([owner?.status, owner?.quality.status, ...selected.map(report => report.status), ...(!selected.length ? ["missing"] : available < selected.length * 3 ? ["partial"] : [])]),
    rows: [row("owner", owner?.id), row("期间口径", period), row("报表范围", scope), row("原生频率", selected.length ? "报告期 / reportType 见逐期元数据" : undefined),
      row("schema 版本", owner?.schemaVersion), row("数据包采集时间", owner?.fetchedAt), row("数据包生成时间", owner?.generatedAt),
      row("数据包错误", owner?.currentFetchError ?? owner?.errorMessage),
      row("freshness", owner?.status === "stale" || owner?.quality.status === "stale" ? "stale" : unknown),
      row("数值完整性", `${available}/${selected.length * 3}；冲突值不绘制`), ...proofRows()],
    records, linkage: null,
  };
}
