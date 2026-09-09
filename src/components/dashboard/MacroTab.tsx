import { useMemo, useState } from "react";
import { BarChart3, Radar } from "lucide-react";
import { useDisplayNow } from "../../hooks/useDisplayNow";
import { describeDataTime, summarizeDataTimes, summarizeQualityStatuses, type DisplayTimeKind } from "../../utils/dataTrustDisplay";
import type { DataSourceStatus, MacroIndicator } from "../../types";
import { DashboardCard, SectionHeader, StatusBadge } from "../common/terminal";

type MacroRowStatus = DataSourceStatus | "unknown";

type MacroIndicatorRow = {
  key: string;
  label: string;
  category: string;
  value: string | number | null;
  unit?: string;
  date?: string;
  timeKind: DisplayTimeKind;
  source?: string;
  sourceDisplayName: string;
  status: MacroRowStatus;
  description?: string;
  rawKey: string;
};

type MacroGroup = {
  key: string;
  title: string;
  subtitle: string;
  rows: MacroIndicatorRow[];
};

const macroGroups: Array<Omit<MacroGroup, "rows">> = [
  { key: "增长与价格", title: "增长与价格", subtitle: "GDP、PMI、CPI、PPI、工业和消费数据" },
  { key: "流动性", title: "流动性", subtitle: "资金价格、市场杠杆和银行间流动性" },
  { key: "政策与利率", title: "政策与利率", subtitle: "LPR、存准和政策利率线索" },
  { key: "信用与社融", title: "信用与社融", subtitle: "M2、贷款、融资余额等信用扩张指标" },
  { key: "汇率与外部环境", title: "汇率与外部环境", subtitle: "人民币汇率与外部风险观察" },
  { key: "外贸", title: "外贸", subtitle: "出口、进口、顺差和海外需求" },
  { key: "地产", title: "地产", subtitle: "销售、开工、竣工和价格线索" },
  { key: "就业", title: "就业", subtitle: "失业率、招聘和居民收入压力" },
  { key: "风险因子", title: "风险因子", subtitle: "通胀、汇率、信用和市场拥挤度" },
];

export function MacroTab({ indicators, generatedAt, now }: { indicators: MacroIndicator[]; generatedAt?: string; now?: Date }) {
  const displayNow = useDisplayNow(now);
  const rows = useMemo(() => buildMacroIndicatorRows(indicators), [indicators]);
  const groups = useMemo(() => buildMacroGroups(rows), [rows]);
  const firstActiveGroup = groups.find((group) => group.rows.length > 0)?.key ?? groups[0]?.key ?? "增长与价格";
  const [selectedGroupKey, setSelectedGroupKey] = useState(firstActiveGroup);
  const [selectionByGroup, setSelectionByGroup] = useState<Record<string, string>>({});
  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) ?? groups[0];
  const selectedRow = selectedGroup.rows.find((row) => row.key === selectionByGroup[selectedGroup.key]) ?? selectedGroup.rows[0];
  const totalMetricCount = rows.length;
  const coveredCount = rows.filter((row) => row.value !== null).length;
  const statusRealMetricCount = rows.filter((row) => row.status === "real").length;
  const times = summarizeDataTimes(rows.map((row) => ({ value: row.date, kind: row.timeKind })), displayNow);
  const otherGroups = groups.slice(4);

  return <section className="min-w-0 space-y-4" aria-label="宏观指标观察">
    <SectionHeader className="page-heading" title="宏观 / 指标观察" description="先核验观测值、时点和来源，再判断它对研究的意义。" />
    <nav aria-label="宏观分类" className="flex min-w-0 flex-wrap items-stretch gap-2 border-b border-borderSoft pb-3">
      {groups.slice(0, 4).map((group) => <button key={group.key} type="button" aria-pressed={selectedGroup.key === group.key} onClick={() => setSelectedGroupKey(group.key)} className={`min-h-11 rounded-md border px-3 py-2 text-sm ${selectedGroup.key === group.key ? "border-control bg-selected font-semibold text-accent" : "border-borderSoft bg-bg2 text-textMuted hover:border-control"}`}>
        {group.title}<span className="ml-2 text-xs font-normal">{group.rows.length ? `${group.rows.length} 项` : "待接入"}</span>
      </button>)}
      <label className="flex min-w-0 items-center"><span className="sr-only">其他宏观分类</span><select aria-label="其他宏观分类" value={otherGroups.some((group) => group.key === selectedGroup.key) ? selectedGroup.key : ""} onChange={(event) => { if (event.target.value) setSelectedGroupKey(event.target.value); }} className={`min-h-11 w-full rounded-md border bg-bg2 px-3 py-2 text-sm ${otherGroups.some((group) => group.key === selectedGroup.key) ? "border-control bg-selected text-accent" : "border-control text-textMuted"}`}>
        <option value="" disabled>其他分类（5）</option>{otherGroups.map((group) => <option key={group.key} value={group.key}>{group.title} · {group.rows.length ? `${group.rows.length} 项` : "待接入"}</option>)}
      </select></label>
    </nav>

    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h3 className="text-base font-semibold text-textStrong">{selectedGroup.title}</h3><p className="mt-1 text-xs leading-5 text-textMuted">{selectedGroup.subtitle}</p></div>
      {selectedGroup.rows.length ? <label className="flex min-w-0 max-w-full items-center gap-2 text-xs text-textMuted"><span className="shrink-0">所选指标</span><select aria-label="所选宏观指标" className="min-h-11 min-w-0 max-w-full rounded-md border border-control bg-bg2 px-3 text-sm text-textStrong" value={selectedRow.key} onChange={(event) => setSelectionByGroup((current) => ({ ...current, [selectedGroup.key]: event.target.value }))}>{selectedGroup.rows.map((row) => <option key={row.key} value={row.key}>{row.label} · {displayValue(row.value)}</option>)}</select></label> : null}
    </div>

    {selectedRow ? <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
      <DashboardCard className="min-w-0 p-4 sm:p-5">
        <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <MacroReadout row={selectedRow} now={displayNow} />
          <div className="flex min-h-48 min-w-0 flex-col justify-center rounded-lg border border-borderSoft bg-surface p-4">
            <BarChart3 className="mb-3 h-6 w-6 text-textWeak" aria-hidden="true" /><h3 className="text-base font-semibold text-textStrong">历史序列尚未接入当前页面</h3><p className="mt-2 text-sm leading-6 text-textMuted">当前可查看快照读数与来源口径；尚无可用的连续历史趋势。</p>
          </div>
        </div>
      </DashboardCard>
      <DashboardCard className="min-w-0 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-textStrong">当前可确认什么</h3>
        <dl className="mt-4 space-y-4 text-sm"><div><dt className="font-medium text-accent">观测与质量</dt><dd className="mt-1 leading-6 text-textMuted">{selectedRow.value === null ? "该条目缺少可用数值，保留来源原有状态。" : "已有一条原始观测；数值存在不等于来源与时效均已核验。"}</dd></div><div><dt className="font-medium text-accent">来源</dt><dd className="mt-1 break-words leading-6 text-textMuted">来源：{selectedRow.sourceDisplayName}</dd></div><div><dt className="font-medium text-accent">时效</dt><dd className="mt-1 leading-6 text-textMuted">时效待核验；文件生成时间不是全部指标的发布时间。</dd></div></dl>
        <details className="mt-4 rounded-md border border-control bg-bg2"><summary className="cursor-pointer px-3 py-3 text-sm text-accent">查看来源与口径</summary><div className="space-y-2 px-3 pb-3 text-xs leading-5 text-textMuted"><p className="break-all">原始字段 key：{selectedRow.rawKey}</p><p className="break-all">原始来源：{selectedRow.source || "未提供"}</p>{selectedRow.description ? <p className="break-words">原始说明：{selectedRow.description}</p> : <p>原始说明未提供。</p>}</div></details>
      </DashboardCard>
    </div> : <DashboardCard className="min-w-0 p-5"><Radar className="mb-3 h-6 w-6 text-textWeak" aria-hidden="true" /><h3 className="font-semibold text-textStrong">该分类数据待接入</h3><p className="mt-2 text-sm leading-6 text-textMuted">该分类暂未接入可用指标；可切换其他分类，全部已有条目仍保留在下方明细中。</p></DashboardCard>}

    <div className="min-w-0 rounded-lg border border-borderSoft bg-bg2 px-4 py-3"><h3 className="text-sm font-semibold text-textStrong">宏观指标观测 · 模型尚未接入</h3><p className="mt-1 text-xs leading-5 text-textMuted">当前不输出方向分或宏观结论。方向判断需要验证指标口径、发布时间、修订记录与正式模型。</p></div>
    <details className="min-w-0 rounded-lg border border-control bg-bg2">
      <summary className="cursor-pointer px-4 py-3 text-sm text-accent"><span>数值覆盖</span> {coveredCount}/{totalMetricCount} · 覆盖与时间口径</summary>
      <div className="grid gap-3 border-t border-borderSoft p-4 text-xs leading-5 text-textMuted sm:grid-cols-2"><p>按展示条目统计，重复指标未去重；仅表示有值，不表示经济强弱。数值缺失 {totalMetricCount - coveredCount}/{totalMetricCount}。</p><p>质量状态 real：{statusRealMetricCount}/{totalMetricCount}；{summarizeQualityStatuses(rows.map((row) => row.status))}</p><p>时间语义：报告期 {times.period}；仅日期 {times.dateOnly}；精确时间 {times.recent + times.older}；缺失 {times.missing}；异常 {times.invalid + times.future}；未知 {times.unknown}。分母 {times.total}，逐项核验。</p><p className="break-words">{describeDataTime(generatedAt, "generated", displayNow).text}。文件生成不代表全部指标已更新。</p></div>
    </details>
    <MacroDetailTable rows={rows} now={displayNow} />
  </section>;
}

function MacroReadout({ row, now }: { row: MacroIndicatorRow; now: Date }) {
  const time = describeDataTime(row.date, row.timeKind, now);
  const invalidTime = time.state === "future" || time.state === "invalid";
  return <section className="min-w-0" aria-label="当前宏观指标读数">
    <h3 className="break-words text-base font-semibold text-textStrong">{row.label}</h3>
    <p className="mt-1 text-xs text-textMuted">单位：{row.unit || "源字段未提供"}</p>
    <p className="my-5 break-words font-mono text-4xl font-semibold leading-tight text-accent">{displayValue(row.value)}</p>
    <p className="text-xs text-textMuted">质量状态：<StatusBadge status={row.status} /></p>
    <p role={invalidTime ? "alert" : undefined} className={`mt-3 break-words text-sm leading-6 ${invalidTime ? "text-warning" : "text-textMuted"}`}>{time.text}</p>
    {row.timeKind !== "period" ? <p className="mt-1 text-xs leading-5 text-textMuted">观察期：源字段未单独提供</p> : null}
    {row.timeKind !== "publication" ? <p className="mt-1 text-xs leading-5 text-textMuted">来源发布时间：待核验</p> : null}
  </section>;
}

function MacroDetailTable({ rows, now }: { rows: MacroIndicatorRow[]; now: Date }) {
  return (
    <DashboardCard className="min-w-0 p-0">
      <div className="border-b border-borderSoft p-4">
        <h3 className="text-base font-semibold text-textStrong">宏观指标明细表</h3>
        <p className="mt-1 text-xs leading-5 text-textMuted">全部已有分类与条目；原始字段和来源可逐条核对，数值覆盖包含重复展示条目。</p>
      </div>
      <div className="max-h-[560px] overflow-auto" tabIndex={0} aria-label="完整宏观指标表，可横向和纵向滚动">
        <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-bg2 text-xs uppercase tracking-[0.12em] text-textWeak">
            <tr>
              {["分类", "指标名称", "观测值", "单位", "时间与时效", "来源", "质量状态", "原始字段 key"].map((header) => (
                <th key={header} className="border-b border-borderSoft px-4 py-3 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={8} className="p-4 text-textMuted">暂无宏观指标；模型尚未接入。</td></tr> : null}
            {rows.map((row) => (
              <tr key={row.key} className="transition hover:bg-cyan/5">
                <td className="border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.category}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top font-medium text-textStrong">{row.label}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top text-right font-mono tabular-nums text-textStrong">{displayValue(row.value)}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.unit || "未知"}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top text-textMuted">{describeDataTime(row.date, row.timeKind, now).text}</td>
                <td className="max-w-[240px] whitespace-normal break-words border-b border-borderSoft px-4 py-3 align-top text-textMuted">{row.sourceDisplayName}</td>
                <td className="border-b border-borderSoft px-4 py-3 align-top">
                  <span className="text-xs text-textMuted">质量状态：<StatusBadge status={row.status} /></span>
                </td>
                <td className="max-w-[260px] whitespace-normal break-words border-b border-borderSoft px-4 py-3 align-top font-mono text-xs text-textWeak" title={row.source || row.rawKey}>
                  <details><summary className="cursor-pointer break-all text-accent">{row.rawKey}</summary><p className="mt-2 break-all text-textMuted">原始来源：{row.source || "未提供"}</p>{row.description ? <p className="mt-1 break-words">{row.description}</p> : null}</details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

export function buildMacroIndicatorRows(indicators: MacroIndicator[]): MacroIndicatorRow[] {
  return indicators.flatMap((indicator) =>
    indicator.metrics.map((metric, index) => {
      const value = normalizeValue(metric.value);
      const status = metric.status ?? "unknown";
      const rawSource = metric.source;

      return {
        key: `${indicator.id}-${index}-${slug(metric.label)}`,
        label: metric.label || "未命名指标",
        category: mapMacroCategory(indicator, metric.label),
        value,
        unit: extractUnit(metric.value),
        date: metric.updatedAt || extractDate(metric.note),
        timeKind: macroTimeKind(metric),
        source: rawSource,
        sourceDisplayName: sourceDisplayName(rawSource),
        status,
        description: metric.note,
        rawKey: `${indicator.id}.${metric.label || index}`,
      };
    }),
  );
}

function buildMacroGroups(rows: MacroIndicatorRow[]): MacroGroup[] {
  return macroGroups.map((group) => ({
    ...group,
    rows: rows.filter((row) => row.category === group.key),
  }));
}

function mapMacroCategory(indicator: MacroIndicator, label: string): string {
  const text = `${indicator.name} ${indicator.category} ${label}`;
  if (/GDP|PMI|CPI|PPI|工业|社零|消费|价格/.test(text)) return "增长与价格";
  if (/SHIBOR|流动性|资金价格/.test(text)) return "流动性";
  if (/LPR|存准|准备金|政策|利率/.test(text)) return "政策与利率";
  if (/M2|贷款|社融|融资|两融|信用/.test(text)) return "信用与社融";
  if (/汇率|美元|人民币|外部/.test(text)) return "汇率与外部环境";
  if (/出口|进口|外贸/.test(text)) return "外贸";
  if (/地产|房/.test(text)) return "地产";
  if (/就业|失业/.test(text)) return "就业";
  if (/风险|杠杆|通胀/.test(text)) return "风险因子";
  return indicator.category || "风险因子";
}

function extractUnit(value?: string): string | undefined {
  // Only units present in the raw value; a label such as 同比 does not prove percent units.
  return value?.match(/亿美元|万亿|亿元|亿|%/)?.[0];
}

function sourceDisplayName(source?: string) {
  if (!source?.trim()) return "未知";
  if (/macro_china_gdp|macro_china_cpi|macro_china_ppi|macro_china_pmi|macro_china_non_man_pmi|macro_china_gyzjz|macro_china_consumer_goods_retail/.test(source)) {
    return "国家统计局 / AKShare";
  }
  if (/macro_china_money_supply|macro_china_new_financial_credit|macro_china_reserve_requirement_ratio/.test(source)) {
    return "央行 / AKShare";
  }
  if (/macro_china_lpr/.test(source)) {
    return "全国银行间同业拆借中心 / AKShare";
  }
  if (/macro_china_shibor_all/.test(source)) {
    return "上海银行间同业拆放利率 / AKShare";
  }
  if (/macro_china_rmb/.test(source)) {
    return "中国外汇交易中心 / AKShare";
  }
  if (/macro_china_market_margin/.test(source)) {
    return "交易所融资融券 / AKShare";
  }
  return source.replace(/^AKShare[:\s]*/i, "AKShare / ");
}

function normalizeValue(value?: string): string | number | null {
  const trimmed = value?.trim();
  if (!trimmed || ["X", "N/A", "NaN", "数据暂缺", "暂未获取", "暂无", "待接入"].includes(trimmed)) return null;
  return trimmed;
}

function displayValue(value: string | number | null) {
  return value === null ? "暂无" : String(value);
}

function extractDate(note?: string): string | undefined {
  const match = note?.match(/(?:日期|月份|报告期|公布)[：:]\s*([^；;,，]+)/);
  return match?.[1]?.trim();
}

function slug(text: string) {
  return text.replace(/[^\da-zA-Z\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
}

/** Only script-proven labels distinguish publication / period. Generic 日期 is ambiguous. */
function macroTimeKind(metric: MacroIndicator["metrics"][number]): DisplayTimeKind {
  if (/(?:月份|报告期)[：:]/.test(metric.note)) return "period";
  if (/公布[：:]/.test(metric.note)) return "publication";
  if (/macro_china_(?:shibor_all|rmb|market_margin_sh\/sz|lpr)$/.test(metric.source ?? "")) return "observation";
  return "unknown";
}
